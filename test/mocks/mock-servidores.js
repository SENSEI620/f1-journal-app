// Servidores de mentira com as mesmas rotas do código do servidor real
const http = require('http');
const T = { 'news-post': { name: 'news-post', html: '<html>NEWS v1 {{titulo}}</html>', up: '2026-10-01T10:00:00Z' }, 'fp-podium': { name: 'fp-podium', html: '<html>PODIO {{piloto}}</html>', up: '2026-10-01T11:00:00Z' } };
const corpo = (req) => new Promise((ok) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => ok(b)); });
const send = (res, c, t, tipo = 'application/json') => { res.writeHead(c, { 'Content-Type': tipo }); res.end(t); };
function admin(req, res, url, b) {
  if (url.startsWith('/_set/')) { const id = url.slice(6), j = JSON.parse(b); T[id] = { ...(T[id] || { name: id }), ...j }; return send(res, 200, '{}'); }
  if (url.startsWith('/_del/')) { delete T[url.slice(6)]; return send(res, 200, '{}'); }
}
http.createServer(async (req, res) => { // estilo porta 3004: x-access-code
  const b = await corpo(req), url = req.url; if (url.startsWith('/_')) return admin(req, res, url, b);
  if (req.headers['x-access-code'] !== 'cod123') return send(res, 401, '{"error":"Codigo invalido"}');
  if (url === '/templates') return send(res, 200, JSON.stringify(Object.entries(T).map(([id, t]) => ({ id, name: id, filename: id + '.html', size: t.html.length, updated_at: t.up }))));
  const m = url.match(/^\/templates\/([^/]+)\/html$/); if (m && T[m[1]]) return send(res, 200, T[m[1]].html, 'text/html');
  send(res, 404, '{"error":"nao"}');
}).listen(3901);
http.createServer(async (req, res) => { // estilo porta 3001: login + Bearer
  const b = await corpo(req), url = req.url; if (url.startsWith('/_')) return admin(req, res, url, b);
  if (url === '/auth/login') { const j = JSON.parse(b); return j.username === 'user1' && j.password === 'pw1' ? send(res, 200, '{"token":"tok-abc"}') : send(res, 401, '{"error":"Usuario ou senha incorretos"}'); }
  const m = url.match(/^\/templates\/([^/]+)$/); if (req.method === 'GET' && m && T[m[1]]) return send(res, 200, T[m[1]].html, 'text/html');
  if (req.headers.authorization !== 'Bearer tok-abc') return send(res, 401, '{"error":"Token invalido"}');
  if (url === '/templates') return send(res, 200, JSON.stringify(Object.entries(T).map(([id, t]) => ({ id, name: t.name, updated_at: t.up }))));
  send(res, 404, '{}');
}).listen(3902);
