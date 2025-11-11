import http from 'node:http';
import handler from './score.js';

const port = process.env.PORT ? Number(process.env.PORT) : 8787;

const server = http.createServer(async (req, res) => {
	const { method, url } = req;
	console.log(`[req] ${method} ${url}`);

	// CORS and preflight
	if (method === 'OPTIONS') {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.statusCode = 204;
		return res.end();
	}

	if (method === 'POST' && url === '/api/score') {
		return handler(req, res);
	}

	res.setHeader('Access-Control-Allow-Origin', '*');
	res.statusCode = 404;
	res.end('Not Found');
});

server.listen(port, () => {
	console.log(`[dev] listening on http://localhost:${port}`);
});


