import * as path from 'path';
import { execSync } from 'child_process';

const tools = '/usr/bin/nspire-tools';

const DIR_RW = 0o40755;
const FILE_RW = 0o100644;
const DIR_SIZE = 4096;

var errMsg = '';

export function error() {
	if (process.getuid() != 0) {
		errMsg = 'Error.\nPlease check USB connection or run this program as root.\n';
	} else {
		errMsg = 'Error.\nPlease check USB connection.\n';
	}
}

export function clearError() {
	errMsg = '';
}

export function getError() {
	return errMsg;
}

export function exec(...command: string[]): { exit: number, stdout: string } {
	var p: Buffer;
	try {
		p = execSync(tools + ' ' + command.map(x => x.replace(/ /g, '\\ ')).join(' '));
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

export function splitPath(p: string): string[] {
	return path.resolve(p).split('/').filter(x => x);
}

export function joinPath(p: string[]): string {
	return '/' + p.join('/');
}

export interface Stat {
	mtime: Date,
	atime: Date,
	ctime: Date,
	size: number,
	mode: number,
	uid: number,
	gid: number
}

export function createStat(date: Date | string, size: number, dir=false): Stat {
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

export interface Cache {
	list?: { [f: string]: Cache },
	stat?: Stat,
	exp?: number,
	lexp?: number
}

const cache: Cache = {
	stat: createStat(new Date(), DIR_SIZE, true),
	list: {}
};

export function getLocalCache(path: string, add=true): Cache | undefined {
	var e = true;
	var localCache = cache;
	splitPath(path).forEach(f => {
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
