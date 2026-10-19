// E2E 용 모의 GitHub Gist API 서버(메모리). 토큰 TOKEN 만 허용.
'use strict';
const http = require('http');

const TOKEN = 'ghp_e2eTestToken000000000000000000000000';

function startMockGist(port = 0) {
  const gists = {};
  let n = 0;
  const log = [];
  const server = http.createServer((req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Accept, Content-Type, X-GitHub-Api-Version',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Content-Type': 'application/json',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      log.push(`${req.method} ${u.pathname}`);
      const send = (status, obj) => { res.writeHead(status, cors); res.end(JSON.stringify(obj)); };
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { message: 'Bad credentials' });
      const data = body ? JSON.parse(body) : null;
      const stamp = () => new Date().toISOString();
      if (req.method === 'GET' && u.pathname === '/gists') {
        return send(200, u.searchParams.get('page') === '1' ? Object.values(gists).map((g) => ({ id: g.id, files: g.files })) : []);
      }
      if (req.method === 'POST' && u.pathname === '/gists') {
        const id = `mock${++n}`;
        gists[id] = { id, files: data.files, updated_at: stamp(), public: data.public };
        return send(201, gists[id]);
      }
      const id = u.pathname.split('/')[2];
      const g = gists[id];
      if (!g) return send(404, { message: 'Not Found' });
      if (req.method === 'GET') return send(200, g);
      if (req.method === 'PATCH') { Object.assign(g.files, data.files); g.updated_at = stamp(); return send(200, g); }
      return send(405, {});
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    const { port: p } = server.address();
    resolve({ url: `http://127.0.0.1:${p}`, gists, log, close: () => new Promise((r) => server.close(r)) });
  }));
}

module.exports = { startMockGist, TOKEN };
