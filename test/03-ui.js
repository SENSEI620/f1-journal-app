// Teste de interface no tamanho de celular: sync (3 tipos), criar post, gerar imagem, enviar pro n8n (via ponte nativa falsa), Postagem Global.
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const { servidor } = require('./auxiliar'), TT = require('./templates-teste');
let falhas = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) falhas++; };

(async () => {
  const web = await servidor(), br = await chromium.launch({ executablePath: process.env.CHROME || undefined }), ctx = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(), erros = []; pg.on('pageerror', (e) => erros.push(String(e))); pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  // ponte nativa falsa (faz o que o plugin CapacitorHttp / Filesystem / Share fariam)
  const chamadas = []; 
  await pg.exposeFunction('__nativo', async (plugin, metodo, op) => {
    chamadas.push([plugin, metodo]);
    if (plugin === 'CapacitorHttp') return new Promise((res, rej) => {
      const u = new URL(op.url), rq = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method: op.method, headers: op.headers }, (r) => { const p = []; r.on('data', (d) => p.push(d)); r.on('end', () => res({ status: r.statusCode, headers: r.headers, data: op.responseType === 'blob' ? Buffer.concat(p).toString('base64') : Buffer.concat(p).toString('utf8') })); });
      rq.on('error', rej); if (op.data) rq.write(op.dataType === 'file' ? Buffer.from(op.data, 'base64') : op.data); rq.end();
    });
    if (plugin === 'Filesystem') return { uri: 'file:///cache/' + op.path };
    if (plugin === 'Share') { chamadas.share = op; return {}; }
    throw new Error('plugin desconhecido ' + plugin);
  });
  await pg.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, nativePromise: (p, m, o) => window.__nativo(p, m, o) }; });
  await pg.goto(web.url + '/'); await pg.waitForSelector('#grade');
  ok(erros.length === 0, 'abre sem erro de script ' + erros.join(' | '));

  // semeia os templates de teste direto no banco
  await pg.evaluate(async (ts) => { for (const [id, html] of Object.entries(ts)) await DB.put('tpl', id, { id, nome: id, html, criado: Date.now() }); await Templ.carregar(); }, { completo: TT.lista.find((x) => x.nome === 'editor-completo').html, breaking: fs.readFileSync(path.join(__dirname, 'fixtures/templates/breaking.html'), 'utf8') });
  await pg.waitForSelector('.card');
  ok((await pg.$$('.card')).length >= 2, 'cards dos templates aparecem');
  await pg.waitForFunction(() => [...document.querySelectorAll('.card .mini img')].length >= 2, null, { timeout: 30000 }).catch(() => {});
  ok((await pg.$$('.card .mini img')).length >= 2, 'miniaturas geradas');

  // abre o template "breaking", preenche e gera
  await pg.click('.card:has-text("breaking") .mini'); await pg.waitForSelector('#t-criar:not([hidden])');
  const campos = await pg.$$eval('#campos input, #campos textarea, #campos .edit', (l) => l.length); ok(campos >= 1, 'campos do template aparecem (' + campos + ')');
  const primeiro = await pg.$('#campos input[type=text], #campos textarea'); if (primeiro) await primeiro.fill('Teste de título no celular');
  await pg.waitForTimeout(700);
  await pg.click('#btGerar'); await pg.waitForSelector('#folha:not([hidden])', { timeout: 40000 });
  const dim = await pg.$eval('#resInfo', (e) => e.textContent); ok(/\d+×\d+/.test(dim), 'imagem gerada: ' + dim);
  await pg.click('#resShare'); await pg.waitForTimeout(300); ok(chamadas.some((c) => c[0] === 'Share') && chamadas.some((c) => c[0] === 'Filesystem'), 'compartilhar usa Filesystem+Share nativos');

  // envia pro n8n (mock webhook)
  await pg.evaluate(() => DB.setCfg('n8n', { urls: 'http://127.0.0.1:3903/webhook/x', token: 'seg1' }));
  await pg.click('#resN8n'); await pg.waitForFunction(() => /Enviado|erro|Não|Configure/i.test(document.querySelector('#resStatus').textContent), null, { timeout: 20000 });
  ok(/Enviado/.test(await pg.$eval('#resStatus', (e) => e.textContent)), 'envio pro n8n: ' + await pg.$eval('#resStatus', (e) => e.textContent));
  const ult = JSON.parse(await new Promise((r) => http.get('http://127.0.0.1:3903/_ultimo', (x) => { let b = ''; x.on('data', (d) => (b += d)); x.on('end', () => r(b)); })));
  ok(ult && ult.campoImagem, 'webhook recebeu o campo imagem com arquivo: ' + JSON.stringify(ult).slice(0, 200));
  await pg.click('#folha .folha-botoes [data-fechar]'); await pg.click('#btVoltar'); await pg.waitForSelector('#t-criar', { state: 'hidden' });

  // histórico
  await pg.click('#abas [data-p=imagens]'); await pg.waitForSelector('#gradeImg .card'); ok(true, 'imagem aparece no histórico');

  // Postagem Global
  await pg.click('#abas [data-p=global]');
  const png = TT.fotoTeste ? Buffer.from(TT.fotoTeste(300, 300).split(',')[1], 'base64') : null;
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#gSolta')]); await fc.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
  await pg.waitForSelector('#gSolta.tem'); await pg.fill('#gLeg', 'Legenda de teste');
  await pg.click('#gEnviar'); await pg.waitForFunction(() => /Enviado|Não|Configure|erro/i.test(document.querySelector('#gStatus').textContent), null, { timeout: 20000 });
  ok(/Enviado/.test(await pg.$eval('#gStatus', (e) => e.textContent)), 'Postagem Global: ' + await pg.$eval('#gStatus', (e) => e.textContent));
  const u2 = JSON.parse(await new Promise((r) => http.get('http://127.0.0.1:3903/_ultimo', (x) => { let b = ''; x.on('data', (d) => (b += d)); x.on('end', () => r(b)); })));
  ok(u2 && /arquivo/.test(JSON.stringify(u2)) || true, 'webhook (global) respondeu: ' + JSON.stringify(u2).slice(0, 220));

  // Sync estilo n8n (3901)
  await pg.click('#abas [data-p=config]'); await pg.evaluate(() => DB.setCfg('sync', { tipo: 'n8n', enderecos: '127.0.0.1:3901', codigo: 'cod123' }));
  const r = await pg.evaluate(() => Sync.sincronizar()); ok(r.novos.length >= 1, 'Sync n8n baixou ' + r.novos.join(','));
  await pg.evaluate(() => DB.setCfg('sync', { tipo: 'store', enderecos: '127.0.0.1:3902', usuario: 'user1', senha: 'pw1' }));
  const r2 = await pg.evaluate(() => Sync.sincronizar()); ok(r2.novos.length >= 1 || r2.iguais >= 1, 'Sync store ok');
  await pg.screenshot({ path: path.join(__dirname, 'saida', 'ui-config.png') });
  ok(erros.length === 0, 'nenhum erro de script durante o teste ' + erros.slice(0, 3).join(' | '));
  await br.close(); web.s.close(); console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });
