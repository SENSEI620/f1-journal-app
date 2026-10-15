// Compara o montar() do app de celular com o do programa de PC (main.js da V1.0.40) em vários casos.
// Uso: STUDIO_DIR="/caminho/F1 Journal Studio" node test/01-montar.js   (sem STUDIO_DIR, tenta a pasta padrão de trabalho)
const Module = require('module'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const STUDIO = process.env.STUDIO_DIR || '/home/claude/studio-v1040/F1 Journal Studio';
if (!fs.existsSync(path.join(STUDIO, 'main.js'))) { console.log('PULADO: main.js do programa de PC não encontrado (defina STUDIO_DIR)'); process.exit(0); }
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'f1par-')), H = {}, noop = () => {};
const fake = { app: { getPath: (n) => (n === 'userData' ? D : path.join(D, n)), getVersion: () => '1.0.40', whenReady: () => ({ then: noop }), on: noop, quit: noop, isPackaged: false },
  BrowserWindow: class {}, Menu: { setApplicationMenu: noop }, ipcMain: { handle: (c, f) => (H[c] = f) }, shell: {}, dialog: {}, clipboard: {}, nativeImage: {}, safeStorage: { isEncryptionAvailable: () => false }, globalShortcut: {}, desktopCapturer: {}, screen: {} };
const orig = Module._load; Module._load = function (r, ...a) { return r === 'electron' ? fake : orig.call(this, r, ...a); };
const mainArq = path.join(STUDIO, 'main.js');
const src = fs.readFileSync(mainArq, 'utf8') + '\n;module.exports = { preparar, montar, camposDe, tamanhoDe, videoAreaDe, textosDe, enquadresDe, avisosOffline, cssFontes };';
const m = new Module(mainArq, null); m.filename = mainArq; m.paths = Module._nodeModulePaths(STUDIO); process.chdir(STUDIO); m._compile(src, mainArq);
const PC = m.exports; PC.preparar();
const Cel = require('../www/js/montar.js');
const tpls = path.join(STUDIO, 'dev-tests/fixtures/templates'), TPL = path.join(D, 'templates');
const extras = {
  'visual.html': '<!doctype html><html><head><meta charset="utf-8"><meta name="post-size" content="1080x1920"></head><body><div data-texto="titulo" data-ttam="64" data-tpeso="800" data-tal="left">{{titulo}}</div><div data-texto="sub" data-ttam="40" data-tpeso="400" data-tal="center" data-fit="1" data-tam="40">{{sub}}</div><div data-foto="imagem_x" data-fx="50" data-fy="50" data-fz="100"><div class="f1f" style="background-image:url({{imagem_x}})"></div></div><meta name="video-area" content="10, 20.4, 500,300 ,12"></body></html>',
};
for (const [n, h] of Object.entries(extras)) fs.writeFileSync(path.join(TPL, n), h);
for (const f of fs.readdirSync(tpls)) fs.copyFileSync(path.join(tpls, f), path.join(TPL, f));
const casos = [
  {}, { titulo: 'Olá <b>mundo</b> & "aspas"\nsegunda linha', cor_destaque: '#ff0000' },
  { titulo_html: 'Texto <span style="color:#f00">vermelho</span>', kicker: 'k\r\nx', imagem_fundo: 'data:image/png;base64,AAAA', cor_destaque: '#00ff00' },
  { titulo: 'x', titulo__tam: 90, titulo__neg: '0', titulo__al: 'right', sub: 'y', sub__tam: 33, sub__neg: '1', imagem_x: 'data:image/png;base64,BBBB', imagem_x__zoom: 250, imagem_x__x: 20, imagem_x__y: 80 },
  { titulo: 'x', titulo__tam: 'abc', titulo__al: 'xxx', imagem_x__zoom: 9999 },
];
let n = 0;
for (const f of fs.readdirSync(TPL).filter((x) => x.endsWith('.html'))) {
  const nome = f.slice(0, -5), html = fs.readFileSync(path.join(TPL, f), 'utf8');
  assert.deepStrictEqual(Cel.camposDe(html), PC.camposDe(path.join(TPL, f))); assert.deepStrictEqual(Cel.tamanhoDe(html), PC.tamanhoDe(html)); assert.deepStrictEqual(Cel.videoAreaDe(html), PC.videoAreaDe(html));
  assert.deepStrictEqual(Cel.textosDe(html), PC.textosDe(html)); assert.deepStrictEqual(Cel.enquadresDe(html), PC.enquadresDe(html));
  for (const v of casos) { assert.strictEqual(Cel.montar(html, v, { fontsCss: PC.cssFontes() }), PC.montar(nome, v), `${nome} ${JSON.stringify(v).slice(0, 80)}`); n++; }
  const inst = fs.existsSync(path.join(D, 'fonts')) ? fs.readdirSync(path.join(D, 'fonts')).map((a) => (a.match(/^(.+)-\d+\./) || [])[1]).filter(Boolean) : [];
  assert.deepStrictEqual(Cel.avisosOffline(html, inst), PC.avisosOffline(html)); n++;
}
console.log('T_montar ok (' + n + ' comparações iguais ao programa de PC)');
fs.rmSync(D, { recursive: true, force: true }); process.exit(0);
