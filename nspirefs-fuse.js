const Fuse = require('fuse-native');
const fs = require('fs');
const path = require('path');
const stat = require('fuse-native/test/fixtures/stat');
const child_process = require("child_process");

const tools = '/usr/bin/nspire-tools';
const fm = 'filemanager';
const DIR_SIZE = 4096;
const MAX_CACHE_AGE = 7000; // ms
const MAX_CACHE_AGE_INFO = 30000; // ms

var c_err = '';

function exec(...command) {
	const c = tools + ' ' + command.map(x => x.replaceAll(' ', '\\ ')).join(' ');
	var p;
	try {
		p = child_process.execSync(c);
	}
	catch (e) {
		return {
			exit: e.status,
			stdout: e.stdout.toString()
		};
	}
	return {
		exit: 0,
		stdout: p.toString()
	}
}

function splitPath(p) {
	return path.resolve(p).split('/').filter(x => x);
}

function joinPath(p) {
	return '/' + p.join('/');
}

function createStat(date, size, dir=false) {
	const d = typeof date === 'string' ? new Date(date) : date;
	const stat = {
		mtime: d,
		atime: d,
		ctime: d,
		size: dir ? DIR_SIZE : size,
		mode: dir ? 0o40755 : 0o100644,
		uid: process.getuid(),
		gid: process.getgid()
	};
	return stat;
}

function error() {
	if (process.getuid() != 0) {
		c_err = 'Error.\nPlease check USB connection or run this program as root.\n';
	} else {
		c_err = 'Error.\nPlease check USB connection.\n';
	}
}

const cache = {
	stat: createStat(new Date(), DIR_SIZE, true),
	list: {}
};

function getLocalCache(path, add=true) {
	var e = true;
	var localCache = cache;
	splitPath(path).forEach((f, i, l) => {
		if (!e || !localCache.list) {
			e = false;
			return;
		}
		if (!localCache.list[f]) {
			if (add) {
				localCache.list[f] = { list: {} };
			} else {
				e = false;
				return;
			}
		}
		localCache = localCache.list[f];
	});

	if (e) {
		return localCache;
	}
}

function ls(path) {
	const localCache = getLocalCache(path, false);
	if (localCache && localCache.stat && localCache.lexp > new Date()) {
		return Object.keys(localCache.list);
	}

	const o = exec(fm, 'ls', path);
	if (o.stdout.toLowerCase().startsWith('error')) {
		error();
		return;
	}
	c_err = '';
	const localCache_ = getLocalCache(path);

	localCache_.lexp = new Date().getTime() + MAX_CACHE_AGE;

	return o.stdout.split('\n').filter(l => l).map(l => {
		const z = l.split('\t');
		var file = z[2];
		var dir = false;
		if (file.startsWith('\033')) {
			file = file.slice(9);
			dir = true;
		}
		file = file.slice(0, file.indexOf('\0'));
		if (!localCache_.list[file]) {
			localCache_.list[file] = {};
		}
		const lc = localCache_.list[file];
		lc.stat = createStat(z[1], z[0], dir);
		if (!lc.list) {
			lc.list = {};
		}
		lc.exp = new Date().getTime() + MAX_CACHE_AGE;
		return file;
	});
}

const infos = [ 'Name', 'Size', 'Date', 'Type' ];
function info(path) {
	const localCache = getLocalCache(path, false);
	if (localCache && localCache.stat && localCache.exp > new Date()) {
		return localCache.stat;
	}

	const o = exec(fm, 'info', path);
	if (o.stdout.toLowerCase().startsWith('error')) {
		error();
		return;
	}
	c_err = '';

	var i = {};
	o.stdout.split('\n').forEach(x => {
		infos.forEach(z => {
			if (x.startsWith(z)) {
				i[z] = x.slice(z.length + 2);
			}
		});
	});

	const dir = i.Type == 'directory';
	const stat = createStat(i.Date, parseInt(i.Size), dir);
	const localCache_ = getLocalCache(path);
	localCache_.stat = stat;
	localCache_.exp = new Date().getTime() + MAX_CACHE_AGE;
	return stat;
}

var hwInfoCache = { info: '' };
function hwInfo() {
	if (!hwInfoCache.info || hwInfoCache.exp < new Date()) {
		const o = exec('info');
		if (o.stdout.toLowerCase().startsWith('error')) {
			error();
			return '';
		}
		c_err = '';

		hwInfoCache.info = o.stdout;
		hwInfoCache.exp = new Date().getTime() + MAX_CACHE_AGE_INFO;
	}

	return hwInfoCache.info;
}

const fuse = new Fuse(
	'mnt',
	{
		readdir: function (path, cb) {
			const p = splitPath(path);
			if (p.length) {
				if (p[0] == 'My Documents') {
					const l = ls(joinPath(p.slice(1)));
					if (!l) {
						return cb(Fuse.ENOENT);
					}
					return cb(null, l);
				}
				return cb(Fuse.ENOENT);
			} else {
				const r = [ 'My Documents', 'info' ];
				if (c_err) {
					r.push('error');
				}
				return cb(null, r);
			}
		},
		getattr: function (path, cb) {
			const p = splitPath(path);
			if (p.length) {
				if (p[0] == 'My Documents') {
					const dPath = joinPath(p.slice(1));
					if (dPath === '/') {
						return cb(null, stat({ mode: 0o40555, size: 4096 }));
					}
					return cb(null, info(dPath))
				} else {
					if (p[0] == 'info') {
						return cb(null, stat({ mode: 0o100444, size: hwInfo().length }));
					} else if (p[0] == 'error' && c_err) {
						return cb(null, stat({ mode: 0o100444, size: c_err.length }));
					}
				}
			} else {
				return cb(null, stat({ mode: 0o40555, size: 4096 }));
			}
			return cb(Fuse.ENOENT);
		},
		open: function (path, flags, cb) {
			return cb(0, 42);
		},
		release: function (path, fd, cb) {
			return cb(0);
		},
		read: function (path, fd, buf, len, pos, cb) {
			const p = splitPath(path);
			if (p.length) {
				if (p[0] == 'My Documents') {
					const dPath = joinPath(p.slice(1));
					return cb(0);
				} else {
					if (p[0] == 'info') {
						const str = hwInfo().slice(pos, pos + len);
						buf.write(str);
						return cb(str.length);
					} else if (p[0] == 'error' && c_err) {
						const str = c_err.slice(pos, pos + len);
						buf.write(str);
						return cb(str.length);
					}
				}
			}
		}
	},
	{
		debug: true,
		allowOther: true
	}
);

fuse.mount(function (err) {
	if (err) {
		throw err;
	}
});

// vim: set ts=4 sw=4 tw=0 noet :
