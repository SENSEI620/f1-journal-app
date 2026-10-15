// Monta o HTML do post: troca {{campo}} pelo que foi digitado e injeta fontes e ajustes.
// É a MESMA lógica do programa de PC (main.js: montar, ajustesTexto, enquadreCss...). Se mudar lá, mude aqui (o teste test/01-montar.js compara os dois).
const Montar = (() => {
  const escapa = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const camposDe = (html) => [...new Set([...String(html).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

  // tamanho do post: <meta name="post-size" content="1080x1350">
  function tamanhoDe(html) {
    const r = String(html).match(/<meta\s+name="post-size"\s+content="(\d+)x(\d+)"/);
    if (!r) return { w: 1080, h: 1350 };
    const lim = (n) => Math.min(4000, Math.max(200, Number(n)));
    return { w: lim(r[1]), h: lim(r[2]) };
  }
  // template de vídeo (área do vídeo). No celular os de vídeo ficam escondidos por enquanto.
  function videoAreaDe(html) {
    const r = String(html).match(/<meta\s+name="video-area"\s+content="\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*"/);
    if (!r) return null; const n = (v) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? x : 0; };
    return { x: n(r[1]), y: n(r[2]), w: Math.max(2, n(r[3])), h: Math.max(2, n(r[4])), raio: Math.max(0, n(r[5])) };
  }
  const textosDe = (html) => { const o = {}; for (const m of String(html).matchAll(/data-texto="(\w+)" data-ttam="([\d.]+)" data-tpeso="(\w+)" data-tal="(\w+)"( data-fit="1")?/g)) o[m[1]] = { tam: +m[2], peso: +m[3] || 400, al: m[4], fit: !!m[5] }; return o; };
  const enquadresDe = (html) => { const o = {}; for (const m of String(html).matchAll(/data-foto="(imagem\w*)" data-fx="([\d.]+)" data-fy="([\d.]+)" data-fz="([\d.]+)"/g)) o[m[1]] = { x: +m[2], y: +m[3], z: +m[4] }; return o; };

  function ajustesTexto(html, valores) {
    const bases = new Set(Object.keys(valores || {}).map((k) => (k.match(/^(\w+?)__(?:tam|neg|al)$/) || [])[1]).filter(Boolean));
    if (!bases.size) return { html, css: '' }; const info = textosDe(html); let css = '';
    for (const b of bases) {
      const i = info[b]; if (!i) continue; let r = '';
      const t = Number(valores[b + '__tam']);
      if (Number.isFinite(t) && valores[b + '__tam'] !== '' && valores[b + '__tam'] !== null) {
        const v = Math.min(400, Math.max(8, Math.round(t)));
        if (i.fit) html = html.replace(new RegExp(`(data-texto="${b}"[^>]*?data-fit="1" data-tam=")[\\d.]+`), `$1${v}`);
        else r += `font-size:${v}px!important;`;
      }
      const n = valores[b + '__neg']; if (n === '1' || n === 1 || n === true) r += 'font-weight:800!important;'; else if (n === '0' || n === 0 || n === false) r += 'font-weight:400!important;';
      const a = valores[b + '__al']; if (['left', 'center', 'right', 'justify'].includes(a)) r += `text-align:${a}!important;`;
      if (r) css += `[data-texto="${b}"]{${r}}`;
    }
    return { html, css };
  }
  function enquadreCss(valores) {
    const bases = new Set(Object.keys(valores).map((k) => (k.match(/^(imagem\w*?)__(?:x|y|zoom)$/) || [])[1]).filter(Boolean));
    const n = (v, d, a, b) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
    return [...bases].map((b) => { const x = n(valores[b + '__x'], 50, 0, 100), y = n(valores[b + '__y'], 50, 0, 100), z = n(valores[b + '__zoom'], 100, 100, 400); return `[data-foto="${b}"] > .f1f{--fz:${z / 100} !important;background-position:${x}% ${y}% !important;transform-origin:${x}% ${y}% !important}`; }).join('');
  }

  // ctx = { fontsCss: 'css das fontes', imagemUri: (valor) => 'data:...' }  (recorte:arquivo / extra:arquivo viram imagem de verdade)
  function montar(html, valores = {}, ctx = {}) {
    html = String(html).replace(/\{\{(\w+)\}\}/g, (_, k) => {
      let v = valores[k] ?? '';
      if (/^(recorte|extra):/.test(String(v))) v = ctx.imagemUri ? ctx.imagemUri(String(v)) : '';
      const cru = k.endsWith('_html') || k.startsWith('imagem') || k === 'cor_destaque';
      return cru ? v : escapa(v).replace(/\r?\n/g, '<br>');
    });
    const tx = ajustesTexto(html, valores); html = tx.html;
    return html.replace('</head>', `<style>${ctx.fontsCss || ''}${enquadreCss(valores)}${tx.css}</style></head>`);
  }

  // avisa o que pode não funcionar sem internet (fonte que não veio junto, imagem/script de link externo)
  function avisosOffline(html, fontesInstaladas) {
    const av = [], inst = new Set([...fontesInstaladas].map((f) => String(f).toLowerCase()));
    for (const m of String(html).matchAll(/family=([^&:"')]+)/g)) {
      const f = decodeURIComponent(m[1]).replace(/\+/g, ' ');
      if (!inst.has(f.toLowerCase())) av.push(`A fonte "${f}" não está instalada (sem internet vira Arial).`);
    }
    const sem = String(html).replace(/@import\s+url\([^)]*\)\s*;?/g, '');
    const urls = [...new Set([...sem.matchAll(/(?:src=|url\()\s*["']?(https?:\/\/[^"')\s]+)/g)].map((m) => m[1]))];
    urls.forEach((u) => av.push('Usa um link da internet: ' + u.slice(0, 70)));
    return av;
  }

  return { escapa, camposDe, tamanhoDe, videoAreaDe, textosDe, enquadresDe, ajustesTexto, enquadreCss, montar, avisosOffline };
})();
if (typeof module !== 'undefined') module.exports = Montar; // para o teste em Node
