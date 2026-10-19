#!/usr/bin/env node
// www/ 를 로컬에서 띄우는 정적 서버(테스트·미리보기용). 사용: node scripts/serve-web.js [포트=8080] [폴더=www]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function serve(dir, port) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(root, p.endsWith('/') ? p + 'index.html' : p);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (require.main === module) {
  const port = Number(process.argv[2]) || 8080;
  serve(process.argv[3] || path.join(__dirname, '..', 'www'), port).then(() => console.log(`http://127.0.0.1:${port}/`));
}
module.exports = { serve };
