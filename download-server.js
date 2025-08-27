import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.DOWNLOAD_PORT || 4100);
const filePath = path.resolve('/workspace/bin-2-basket.zip');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/bin-2-basket.zip') {
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': stats.size,
        'Content-Disposition': 'attachment; filename="bin-2-basket.zip"'
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', () => {
        res.end();
      });
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Download server running on http://localhost:${PORT}/bin-2-basket.zip`);
});

