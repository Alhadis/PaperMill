#!/usr/bin/env node

import DotEnv from "dotenv";
import {readFileSync} from "fs";

const BLACKLIST = `
	_ CDPATH COLUMNS ERRNO EUID EXECSHELL GROUPS HOME IFS LINES
	OLDPWD OPTARG OPTIND PATH PPID PWD REPLY SHELL TERM TMPDIR UID
`.trim().split(/\s+/);
const env = DotEnv.parse(readFileSync(process.argv[2], "utf8"));
const keys = new Set();
for(let [key, value] of Object.entries(env)){
	key = key.replace(/[-_]+/g, "_");
	if(/^\d|^PS\d+$/.test(key) || BLACKLIST.includes(key))
		continue;
	keys.add(key);
	if(/[^\]~\#+:@^\w\[/.-]/.test(value))
		value = !value.includes("'")
			? `'${value}'`
			: `"${value.replace(/[$"\\@]/g, "\\$&")}"`;
	process.stdout.write(`${key}=${value}\n`);
}
for(const key of keys)
	process.stdout.write(`export ${key}\n`);
