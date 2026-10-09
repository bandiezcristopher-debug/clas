#!/usr/bin/env node
/* Tiny static server for ./public (no dependencies).
   PORT=8080 npm start        change the port
   npm run dev                same, and tells the browser to reload when a file changes */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'public');
const PORT = +process.env.PORT || 8000;
const WATCH = process.argv.includes('--watch');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const clients = new Set();
if (WATCH) {
  let t;
  fs.watch(ROOT, { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => clients.forEach(r => r.write('data: reload\n\n')), 100); });
}
const RELOAD = '<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>';

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (WATCH && url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    if (WATCH && ext === '.html') buf = Buffer.from(buf.toString('utf8').replace('</body>', RELOAD + '</body>'));
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`CAAP form generator running at http://localhost:${PORT}` + (WATCH ? '  (auto-reload on)' : '')));
