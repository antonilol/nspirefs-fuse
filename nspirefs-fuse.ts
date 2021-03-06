import * as Fuse from 'fuse-native';
import * as stat from 'fuse-native/test/fixtures/stat';
import * as utils from './utils';

const fm = 'filemanager';

if (process.argv.length < 3) {
	console.log('Mount point unspecified');
	process.exit(1);
}

const mount = process.argv[2];

const DIR_RO = 0o40555;
const DIR_RW = 0o40755;
const FILE_RO = 0o100444;
const FILE_RW = 0o100644;
const DIR_SIZE = 4096;
const MAX_CACHE_AGE = 7000; // ms
const MAX_CACHE_AGE_INFO = 30000; // ms


function ls(path: string) {
	const localCache = utils.getLocalCache(path, false);
	if (localCache && localCache.stat && localCache.lexp > new Date().getTime()) {
		return Object.keys(localCache.list);
	}

	const o = utils.exec(fm, 'ls', path);
	if (o.stdout.toLowerCase().startsWith('error')) {
		utils.error();
		return;
	}
	utils.clearError();
	const localCache_ = utils.getLocalCache(path);

	localCache_.lexp = new Date().getTime() + MAX_CACHE_AGE;

	return o.stdout.split('\n').filter(l => l).map(l => {
		// size, date, name
		const z = l.split('\t');
		var file = z[2];
		var dir = false;
		if (file.startsWith('\x1b')) {
			file = file.slice(9);
			dir = true;
		}
		file = file.slice(0, file.indexOf('\0'));
		if (!localCache_.list[file]) {
			localCache_.list[file] = {};
		}
		const lc = localCache_.list[file];
		lc.stat = utils.createStat(z[1], parseInt(z[0]), dir);
		if (!lc.list) {
			lc.list = {};
		}
		lc.exp = new Date().getTime() + MAX_CACHE_AGE;
		return file;
	});
}

const keys = [ 'Name', 'Size', 'Date', 'Type' ];
function info(path: string) {
	const localCache = utils.getLocalCache(path, false);
	if (localCache && localCache.stat && localCache.exp > new Date().getTime()) {
		return localCache.stat;
	}

	const o = utils.exec(fm, 'info', path);
	if (o.stdout.toLowerCase().startsWith('error')) {
		utils.error();
		return;
	}
	utils.clearError();

	const i: {
		Name: string,
		Size: string,
		Date: string,
		Type: string
	} = o.stdout.split('\n').reduce((v, x) => {
		keys.forEach(z => {
			if (x.startsWith(z)) {
				v[z] = x.slice(z.length + 2);
			}
		});
		return v;
	}, {}) as any;

	const dir = i.Type == 'directory';
	const stat = utils.createStat(i.Date, parseInt(i.Size), dir);
	const localCache_ = utils.getLocalCache(path);
	localCache_.stat = stat;
	localCache_.exp = new Date().getTime() + MAX_CACHE_AGE;
	return stat;
}

const hwInfoCache = { info: '', exp: 0 };
function hwInfo() {
	if (hwInfoCache.exp < new Date().getTime()) {
		const o = utils.exec('info');
		if (o.stdout.toLowerCase().startsWith('error')) {
			utils.error();
			return '';
		}
		utils.clearError();

		hwInfoCache.info = o.stdout;
		hwInfoCache.exp = new Date().getTime() + MAX_CACHE_AGE_INFO;
	}

	return hwInfoCache.info;
}

const fuse = new Fuse(
	mount,
	{
		init: function(cb) {
			hwInfo();
			return cb(0);
		},
		readdir: function(path, cb) {
			const p = utils.splitPath(path);
			if (p.length) {
				if (p[0] == 'My Documents') {
					const l = ls(utils.joinPath(p.slice(1)));
					if (!l) {
						return cb(Fuse.ENOENT);
					}
					return cb(null, l);
				}
				return cb(Fuse.ENOENT);
			} else {
				const r = [ 'My Documents', 'info' ];
				if (utils.getError()) {
					r.push('error');
				}
				return cb(null, r);
			}
		},
		getattr: function(path, cb) {
			const p = utils.splitPath(path);
			if (p.length) {
				if (p[0] == 'My Documents') {
					const dPath = utils.joinPath(p.slice(1));
					if (dPath === '/') {
						return cb(null, stat({ mode: DIR_RO, size: DIR_SIZE }));
					}
					return cb(null, info(dPath))
				} else {
					if (p[0] == 'info') {
						return cb(null, stat({ mode: FILE_RO, size: hwInfo().length }));
					} else if (p[0] == 'error' && utils.getError()) {
						return cb(null, stat({ mode: FILE_RO, size: utils.getError().length }));
					}
				}
			} else {
				return cb(null, stat({ mode: DIR_RO, size: DIR_SIZE }));
			}
			return cb(Fuse.ENOENT);
		},
		open: function(path, flags, cb) {
			return cb(0, 42);
		},
		release: function(path, fd, cb) {
			return cb(0);
		},
		read: function(path, fd, buf, len, pos, cb) {
			const p = utils.splitPath(path);
			if (p.length) {
				if (p[0] == 'My Documents') {
					const dPath = utils.joinPath(p.slice(1));
					return cb(0);
				} else {
					if (p[0] == 'info') {
						const str = hwInfo().slice(pos, pos + len);
						buf.write(str);
						return cb(str.length);
					} else if (p[0] == 'error' && utils.getError()) {
						const str = utils.getError().slice(pos, pos + len);
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

fuse.mount(function(err) {
	if (err) {
		throw err;
	}
});
