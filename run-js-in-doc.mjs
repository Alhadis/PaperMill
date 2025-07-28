#!/usr/bin/env node

import {statSync, existsSync, readFileSync} from "fs";
import assert          from "assert";
import {createServer}  from "http";
import {fileURLToPath} from "url";
import {join, dirname} from "path";
import {promisify}     from "util";
import {execFile}      from "child_process";

const exec = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));

const [htmlPath, jsPath] = process.argv.slice(2);
const htmlSource = readFileSync(htmlPath, "utf8");
const jsSource   = readFileSync(jsPath,   "utf8");
const htmlStats  = statSync(htmlPath);

const dedent = (...args) => String.raw(...args).replace(
	/^\n((\t+)(?:\S.*)(?:\n\2.*)+)\n\t*$/g,
	(_, src, indent) => src
		.split("\n")
		.map(s => s.startsWith(indent) ? s.slice(indent.length) : s)
		.join("\n"));

createServer(async (request, response) => {
	const {url, method} = request;
	if("/" === url){
		if("POST" === method){
			const size = request.headers["content-length"];
			const body = await new Promise(resolve => {
				const chunks = [];
				request.on("readable", () => {
					const chunk = request.read();
					null !== chunk
						? chunks.push(chunk)
						: resolve(Buffer.concat(chunks).toString("utf8"));
				});
			});
			assert.strictEqual(size, body.length, "Payload size differs to Content-Length header");
			process.stdout.write(body);
			const msg = `Wrote ${body.length} byte(s) to stdout\n`;
			response.writeHead(200, {
				"Content-Type": "text/plain; charset=utf-8",
				"Content-Length": msg.length,
			});
			response.write(msg);
			return response.end();
		}
		else{
			const html = htmlSource + dedent `
				<script type="module">
					${jsSource}
					{
						const body = document.documentElement.outerHTML;
						fetch("/", {
							method: "POST", body,
							headers: {
								"Content-Type": "text/html; charset=utf-8",
								"Content-Length": body.length,
							},
						}).then(response => response.text());
					}
				</script>
			`;
			response.writeHead(200, {
				"Cache-Control":  "no-cache",
				"Content-Length": html.length,
				"Content-Type":   "text/html; charset=utf-8",
				"Last-Modified":  htmlStats.mtime.toUTCString(),
			});
			response.write(html);
			return response.end();
		}
	}
	else{
		const path = join(root, request.url);
		let stats;
		try{ stats = statSync(path); }
		catch(error){
			response.writeHead(404, {
				"Cache-Control":  "no-cache",
				"Content-Type":   "text/plain; charset=utf-8",
				"Content-Length": path.length + 15,
			}).write(`No such file: ${path}\n`);
			return response.end();
		}
		if(existsSync(path) && stats.isFile()){
			const type = (await exec("file", ["-b", "--mime", path])).stdout.trim();
			const body = readFileSync(path);
			response.writeHead(200, {
				"Cache-Control":  "max-age=864000",
				"Content-Type":   type || "text/plain; charset=utf8",
				"Content-Length": body.length,
				"Last-Modified":  stats.mtime.toUTCString(),
			});
			response.write(body);
			return response.end();
		}
	}
}).listen(1336);
