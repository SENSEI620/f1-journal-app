// Compara a imagem gerada pelo motor do celular (SVG + canvas) com uma captura real do Chromium do mesmo HTML.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), assert = require('assert');
const { servidor, comparar } = require('./auxiliar'), T = require('./templates-teste');
(async () => {
  const { s, url } = await servidor(), nav = await chromium.launch(), ctx = await nav.newContext({ viewport: { width: 1080, height: 1350 } });
  const pag = await ctx.newPage(); pag.on('pageerror', (e) => console.log('ERRO NA PÁGINA', e.message));
  await pag.goto(url + '/__t/render.html');
  const foto = T.fotoTeste(); fs.mkdirSync(path.join(__dirname, 'saida'), { recursive: true });
  let falhou = 0;
  for (const t of T.lista) {
    const valores = Object.fromEntries(Object.entries(t.valores).map(([k, v]) => [k, v === 'FOTO' ? foto : v]));
    const html = await pag.evaluate(([h, v]) => Recursos.montarHtml(h, v), [t.html, valores]);
    const { w, h } = { w: 1080, h: /1920/.test(t.html) ? 1920 : 1350 };
    const ver = await ctx.newPage(); await ver.setViewportSize({ width: w, height: h }); await ver.setContent(html, { waitUntil: 'load' });
    await ver.evaluate(() => document.fonts.ready); await ver.waitForTimeout(700);
    const real = await ver.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }); await ver.close();
    const t0 = Date.now();
    const b64 = await pag.evaluate(async (h) => { const r = await Render.imagem(h, {}); return { w: r.w, h: r.h, avisos: r.avisos, b64: await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result.split(',')[1]); f.readAsDataURL(r.blob); }) }; }, html);
    const meu = Buffer.from(b64.b64, 'base64'), ms = Date.now() - t0;
    fs.writeFileSync(path.join(__dirname, 'saida', t.nome + '-real.png'), real); fs.writeFileSync(path.join(__dirname, 'saida', t.nome + '-app.png'), meu);
    const c = comparar(real, meu); fs.writeFileSync(path.join(__dirname, 'saida', t.nome + '-dif.png'), c.mapa);
    const bom = c.pct < 1.0; if (!bom && !t.tolerante) falhou++;
    console.log(`${bom ? 'OK ' : t.tolerante ? 'AVISO' : 'FALHA'} ${t.nome.padEnd(16)} dif=${c.pct.toFixed(3)}% medio=${c.medio.toFixed(2)} ${ms}ms avisos=${JSON.stringify(b64.avisos)}`);
  }
  await nav.close(); s.close();
  if (falhou) { console.log('T_FALHA render'); process.exit(1); } console.log('T_render ok'); process.exit(0);
})().catch((e) => { console.log('T_FALHA', e.stack || e.message); process.exit(1); });
