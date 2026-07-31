import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, normalize, resolve, sep } from 'node:path';

const [directoryArg, portArg = '4321', host = '127.0.0.1'] = process.argv.slice(2);
if (!directoryArg) {
  throw new Error('Usage: node serve-static.mjs <directory> [port] [host]');
}

const root = resolve(directoryArg);
const port = Number(portArg);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${host}`).pathname);
  const requestedPath = resolve(root, `.${normalize(pathname)}`);
  if (requestedPath !== root && !requestedPath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const filePath = existsSync(requestedPath) && statSync(requestedPath).isFile()
    ? requestedPath
    : resolve(root, 'index.html');
  if (!existsSync(filePath)) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}`);
});
