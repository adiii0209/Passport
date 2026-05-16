const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, 'tmpdist-check');
const port = 4173;

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(root, requestPath);

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Preview server running on http://127.0.0.1:${port}`);
});
