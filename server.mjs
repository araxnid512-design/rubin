// Мини-сервер без зависимостей для просмотрщика: npm start → http://localhost:8080
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json',
	'.glb': 'model/gltf-binary',
	'.gltf': 'model/gltf+json',
	'.png': 'image/png',
};

export function startServer(port = PORT) {
	const server = createServer(async (req, res) => {
		const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
		if (!file.startsWith(ROOT)) {
			res.writeHead(403).end();
			return;
		}
		try {
			const data = await readFile(file);
			res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
			res.end(data);
		} catch {
			res.writeHead(404).end('Not found');
		}
	});
	return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	await startServer();
	console.log(`Просмотрщик зомби: http://localhost:${PORT}`);
}
