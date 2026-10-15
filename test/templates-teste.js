// Templates de teste: os 3 do programa de PC + um "tudo junto" no estilo do que o editor visual gera (veGerarHtml) + um com vidro (backdrop-filter).
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const fix = (n) => fs.readFileSync(path.join(__dirname, 'fixtures/templates', n + '.html'), 'utf8');

// foto de teste (gradiente colorido com faixas), sempre igual
function fotoTeste(w = 800, h = 1000) {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, faixa = Math.floor(x / 80) % 2;
    p.data[i] = Math.round((x / w) * 255); p.data[i + 1] = Math.round((y / h) * 255); p.data[i + 2] = faixa ? 200 : 60; p.data[i + 3] = 255;
  }
  return 'data:image/png;base64,' + PNG.sync.write(p).toString('base64');
}

const veFit = 'function veFit(raiz){(raiz||document).querySelectorAll("[data-fit]").forEach(function(b){var dentro=b.firstElementChild,t=Number(b.dataset.tam),min=Number(b.dataset.min)||10,cs=getComputedStyle(b);if(!dentro)return;var util=b.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);b.style.fontSize=t+"px";while(t>min&&dentro.offsetHeight>util+1){t-=2;b.style.fontSize=t+"px";}});}';
const editorCompleto = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="post-size" content="1080x1350"><title>Completo</title>
<style>html,body{margin:0;padding:0}body{width:1080px;height:1350px;overflow:hidden}.post{position:relative;width:1080px;height:1350px;overflow:hidden;background:#101826}</style></head>
<body><div class="post">
<div data-foto="imagem_foto" data-fx="50" data-fy="50" data-fz="100" style="position:absolute;left:0;top:0;width:1080px;height:800px;border-radius:0px;overflow:hidden;"><div class="f1f" style="position:absolute;left:0;top:0;width:100%;height:100%;background-repeat:no-repeat;background-size:cover;background-position:50% 50%;--fz:1;transform:scale(calc(var(--fz) * 1));transform-origin:50% 50%;background-image:url('{{imagem_foto}}');"></div></div>
<div style="position:absolute;left:0px;top:560px;width:1080px;height:790px;background:linear-gradient(180deg, color-mix(in srgb, #101826 0%, transparent), #101826);border-radius:0px;"></div>
<div style="position:absolute;left:60px;top:520px;width:380px;height:70px;background:{{cor_destaque}};border-radius:0px 24px 24px 0px;box-shadow:0px 10px 30px rgba(0,0,0,.5);"></div>
<div data-texto="kicker" data-ttam="40" data-tpeso="800" data-tal="left" style="position:absolute;left:80px;top:520px;width:340px;height:70px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;font-family:'Inter',sans-serif;font-size:40px;font-weight:800;color:#ffffff;text-align:left;line-height:1.1;letter-spacing:2px;white-space:pre-wrap;word-break:break-word;text-transform:uppercase;"><div>{{kicker}}</div></div>
<div data-texto="titulo" data-ttam="96" data-tpeso="400" data-tal="left" data-fit="1" data-tam="96" data-min="40" style="position:absolute;left:60px;top:620px;width:960px;height:400px;display:flex;flex-direction:column;justify-content:flex-start;box-sizing:border-box;font-family:'Anton',sans-serif;font-size:96px;font-weight:400;color:#ffffff;text-align:left;line-height:1.1;letter-spacing:0px;white-space:pre-wrap;word-break:break-word;-webkit-text-stroke:2px #000000;paint-order:stroke fill;"><div>{{titulo}}</div></div>
<div style="position:absolute;left:60px;top:1050px;width:960px;height:120px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;font-family:'Syne',sans-serif;font-size:72px;font-weight:800;text-align:left;line-height:1.1;white-space:pre-wrap;"><div style="background:linear-gradient(90deg, {{cor_destaque}}, #22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent;">GRADIENTE NO TEXTO</div></div>
<div style="position:absolute;left:800px;top:900px;width:200px;height:200px;transform:rotate(15deg);filter:drop-shadow(0px 10px 15px rgba(0,0,0,.6));"><svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style="display:block;overflow:visible"><polygon fill="{{cor_destaque}}" points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38" vector-effect="non-scaling-stroke"/></svg></div>
<div style="position:absolute;left:60px;top:1200px;width:140px;height:80px;border-radius:40px;overflow:hidden;clip-path:polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%);"><div class="f1f" style="position:absolute;left:0;top:0;width:100%;height:100%;background-size:cover;filter:grayscale(100%) contrast(120%);background-image:url('{{imagem_foto}}');"></div></div>
<div style="position:absolute;left:230px;top:1215px;width:700px;height:60px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;font:700 34px 'Inter';color:#9fb3c8;"><span>@f1journalnews · linha longa para testar o corte com reticências quando passa do limite da caixa de texto</span></div>
<div style="position:absolute;left:0px;top:1330px;width:1080px;height:20px;background:{{cor_destaque}};"></div>
</div><script>${veFit}veFit();if(document.fonts)document.fonts.ready.then(function(){veFit();});</script>
</body></html>`;
const vidro = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:1080px;height:1350px;overflow:hidden;background:#222}.f{position:absolute;inset:0;background:url('{{imagem_foto}}') center/cover}.v{position:absolute;left:140px;top:500px;width:800px;height:300px;border-radius:40px;background:color-mix(in srgb,#ffffff 25%,transparent);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}.t{position:absolute;left:180px;top:600px;font:800 90px Inter;color:#fff}</style></head><body><div class="f"></div><div class="v"></div><div class="t">{{titulo}}</div></body></html>`;

module.exports = {
  fotoTeste,
  lista: [
    { nome: 'breaking', html: fix('breaking'), valores: { nome_bomba: 'BOMBA', descricao_html: 'Descrição <span style="color:#f8b500">com cor</span>', cor_destaque: '#e24b4a', imagem_fundo: 'FOTO' } },
    { nome: 'citacao', html: fix('post-de-citacao'), valores: { kicker: 'Última hora', titulo_html: 'Título com <span class="hl">destaque</span> e <b>negrito</b>', cor_destaque: '#378add', imagem_fundo: 'FOTO', imagem_recorte: '' } },
    { nome: 'editor-completo', html: editorCompleto, valores: { kicker: 'Exclusivo', titulo: 'TÍTULO MUITO GRANDE QUE PRECISA ENCOLHER PARA CABER NA CAIXA DO TEMPLATE', cor_destaque: '#e24b4a', imagem_foto: 'FOTO', titulo__tam: 80 } },
    { nome: 'editor-vazio', html: editorCompleto, valores: { cor_destaque: '#f8b500' } },
    { nome: 'vidro', html: vidro, valores: { titulo: 'Vidro', imagem_foto: 'FOTO' }, tolerante: true },
  ],
};
