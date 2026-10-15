// Roda depois de "npx cap add android": libera http:// (o PC da rede de casa), põe nome, versão e ícone. Seguro rodar mais de uma vez.
const fs = require('fs'), path = require('path'), { desenhar } = require('./icone');
const A = path.join(__dirname, '..', 'android'), pk = require('../package.json');
if (!fs.existsSync(A)) { console.error('Pasta android não existe. Rode "npx cap add android" antes.'); process.exit(1); }
// 1) manifesto: tráfego http liberado
const mf = path.join(A, 'app/src/main/AndroidManifest.xml'); let x = fs.readFileSync(mf, 'utf8');
if (!/usesCleartextTraffic/.test(x)) x = x.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
fs.writeFileSync(mf, x);
// 2) nome do app
const sv = path.join(A, 'app/src/main/res/values/strings.xml'); if (fs.existsSync(sv)) fs.writeFileSync(sv, fs.readFileSync(sv, 'utf8').replace(/(<string name="app_name">)[^<]*/, '$1F1 Journal Studio').replace(/(<string name="title_activity_main">)[^<]*/, '$1F1 Journal Studio'));
// 3) versão
const bg = path.join(A, 'app/build.gradle'); let g = fs.readFileSync(bg, 'utf8'); const [a, b, c] = pk.version.split('.').map(Number);
g = g.replace(/versionCode \d+/, 'versionCode ' + (a * 10000 + b * 100 + c)).replace(/versionName "[^"]*"/, 'versionName "' + pk.version + '"'); fs.writeFileSync(bg, g);
// 4) ícone (troca os PNG de cada densidade; remove o ícone adaptativo padrão para valer o nosso)
const res = path.join(A, 'app/src/main/res'), tam = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, n] of Object.entries(tam)) { const pasta = path.join(res, 'mipmap-' + d); fs.mkdirSync(pasta, { recursive: true }); fs.writeFileSync(path.join(pasta, 'ic_launcher.png'), desenhar(n)); fs.writeFileSync(path.join(pasta, 'ic_launcher_round.png'), desenhar(n, true)); fs.writeFileSync(path.join(pasta, 'ic_launcher_foreground.png'), desenhar(n)); }
fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
console.log('Android preparado:', pk.version);
