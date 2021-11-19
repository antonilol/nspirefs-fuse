const fs = require('fs');
const path = require('path');
const { execSync } = require("child_process");

const tools = '/usr/bin/nspire-tools';

const DIR_RW = 0o40755;
const FILE_RW = 0o100644;
const DIR_SIZE = 4096;

var errMsg = '';

function error() {
	if (process.getuid() != 0) {
		errMsg = 'Error.\nPlease check USB connection or run this program as root.\n';
	} else {
		errMsg = 'Error.\nPlease check USB connection.\n';
	}
}

function clearError() {
	errMsg = '';
}

function getError() {
	return errMsg;
}


function exec(...command) {
	var p;
	try {
		p = execSync(tools + ' ' + command.map(x => x.replaceAll(' ', '\\ ')).join(' '));
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
		mode: dir ? DIR_RW : FILE_RW,
		uid: process.getuid(),
		gid: process.getgid()
	};
	return stat;
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

module.exports = {
	error, clearError, getError,
	exec,
	splitPath, joinPath,
	createStat,
	getLocalCache
};

// vim: set ts=4 sw=4 tw=0 noet :
