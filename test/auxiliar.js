// Peças comuns dos testes: servidor estático (www/), navegador, comparação de imagens.
const http = require('http'), fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const RAIZ = path.resolve(__dirname, '..', 'www');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
function servidor(porta = 0) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
      const arq = u.startsWith('/__t/') ? path.join(__dirname, 'paginas', u.slice(5)) : path.join(RAIZ, u);
      if (!arq.startsWith(RAIZ) && !arq.startsWith(path.join(__dirname, 'paginas'))) { res.writeHead(403); return res.end(); }
      fs.readFile(arq, (e, d) => { if (e) { res.writeHead(404); return res.end('nao'); } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' }); res.end(d); });
    }).listen(porta, '127.0.0.1', () => ok({ s, url: 'http://127.0.0.1:' + s.address().port }));
  });
}
// compara dois PNG (Buffer): devolve { pct: % de pixels diferentes (> tol), medio: erro médio 0-255 }
function comparar(a, b, tol = 24) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) throw new Error(`tamanhos diferentes: ${A.width}x${A.height} vs ${B.width}x${B.height}`);
  let dif = 0, soma = 0; const n = A.width * A.height, mapa = new PNG({ width: A.width, height: A.height });
  for (let i = 0; i < n; i++) {
    let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A.data[i * 4 + c] - B.data[i * 4 + c]));
    soma += m; const d = m > tol; if (d) dif++;
    mapa.data[i * 4] = d ? 255 : A.data[i * 4] >> 2; mapa.data[i * 4 + 1] = d ? 0 : A.data[i * 4 + 1] >> 2; mapa.data[i * 4 + 2] = d ? 0 : A.data[i * 4 + 2] >> 2; mapa.data[i * 4 + 3] = 255;
  }
  return { pct: (dif / n) * 100, medio: soma / n, mapa: PNG.sync.write(mapa) };
}
module.exports = { servidor, comparar, RAIZ };
