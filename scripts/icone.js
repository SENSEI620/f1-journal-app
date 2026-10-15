// Desenha o ícone do app (fundo escuro, faixa vermelha e "F1" estilizado em barras) em qualquer tamanho. Sem dependências além do pngjs.
const { PNG } = require('pngjs');
function desenhar(n, redondo) {
  const p = new PNG({ width: n, height: n });
  const ret = (x, y, a, b, c, d) => x >= a * n && x < c * n && y >= b * n && y < d * n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4; let c = [14, 15, 20, 255];
    const dx = x - n / 2, dy = y - n / 2;
    if (redondo && dx * dx + dy * dy > (n / 2) * (n / 2)) c = [0, 0, 0, 0];
    else {
      if (ret(x, y, 0, 0.84, 1, 0.9)) c = [226, 75, 74, 255];
      // "F": haste + 2 braços ; "1": haste + bandeira
      if (ret(x, y, 0.20, 0.22, 0.30, 0.72) || ret(x, y, 0.20, 0.22, 0.46, 0.31) || ret(x, y, 0.20, 0.42, 0.40, 0.50)) c = [248, 181, 0, 255];
      if (ret(x, y, 0.62, 0.22, 0.72, 0.72) || ret(x, y, 0.50, 0.30, 0.62, 0.38)) c = [245, 245, 245, 255];
    }
    p.data.set(c, i);
  }
  return PNG.sync.write(p);
}
module.exports = { desenhar };
if (require.main === module) { const fs = require('fs'), path = require('path'), d = path.join(__dirname, '..', 'www', 'icons'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'icon-192.png'), desenhar(192)); fs.writeFileSync(path.join(d, 'icon-512.png'), desenhar(512)); console.log('ícones gerados'); }
