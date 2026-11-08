// Servidor estático mínimo para previsualizar la web en local: node scripts/serveWeb.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'web');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT) || 4321;
http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.normalize(path.join(root, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('No encontrado');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Web en http://localhost:${port}`));
