// webhook de mentira (imita o Webhook do n8n recebendo a imagem)
const http = require('http');
let ultimo = null;
http.createServer((req, res) => {
  const partes = []; req.on('data', (d) => partes.push(d)); req.on('end', () => {
    const b = Buffer.concat(partes);
    if (req.url === '/_ultimo') { res.end(JSON.stringify(ultimo)); return; }
    if (req.headers['x-token'] !== 'seg1') { res.writeHead(401); res.end('{"error":"senha errada"}'); return; }
    const txt = b.toString('latin1');
    ultimo = { tipo: (req.headers['content-type'] || '').split(';')[0], tamanho: b.length, campoImagem: /name="imagem"; filename="[^"]+\.(png|jpg)"/.test(txt), origem: /name="origem"/.test(txt), campos: Object.fromEntries([...txt.matchAll(/name="(\w+)"\r\n\r\n([^\r]*)\r\n/g)].map((m) => [m[1], m[2]])) };
    res.writeHead(200); res.end('{"ok":true}');
  });
}).listen(3903);
