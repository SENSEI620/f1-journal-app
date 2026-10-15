// Desenha o template e gera a imagem (PNG/JPG) DENTRO do celular, sem servidor.
// Como: abre o HTML numa moldura escondida (as fontes e os scripts do template rodam), copia o resultado para um SVG com <foreignObject>
// (com tudo embutido: fotos e fontes em base64) e desenha esse SVG num <canvas>. É a técnica que o Chrome/WebView do Android suporta.
// Limites: efeitos que dependem do que está ATRÁS do elemento (backdrop-filter / "vidro") podem sair sem o desfoque; veja test/02-render.js.
const Render = (() => {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  let fila = Promise.resolve(); // um desenho por vez (o celular é pequeno): miniaturas esperam, a imagem final entra na frente
  const naFila = (fn, prioridade) => { const p = (prioridade ? Promise.resolve() : fila).then(fn); if (!prioridade) fila = p.catch(() => {}); return p; };

  const MIME_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
  async function urlParaDataUrl(url) { // baixa um recurso externo (imagem, fonte) e embute como data:
    const r = await Net.pedir(url, { binario: true, tempo: 15000 });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ext = (url.split('?')[0].match(/\.(\w+)$/) || [])[1];
    const tipo = (r.tipo || '').split(';')[0] || MIME_EXT[String(ext).toLowerCase()] || 'application/octet-stream';
    return `data:${tipo};base64,${Net.paraBase64(r.bytes)}`;
  }
  async function trocarUrls(css, avisos) { // url(http...) dentro de CSS -> url(data:...)
    const re = /url\(\s*(['"]?)(https?:\/\/[^'")\s]+)\1\s*\)/gi, achados = [...css.matchAll(re)];
    for (const m of achados) { try { css = css.split(m[0]).join(`url("${await urlParaDataUrl(m[2])}")`); } catch (e) { avisos.push('Não consegui baixar: ' + m[2].slice(0, 60)); } }
    return css;
  }
  async function embutirRecursos(raiz, avisos) {
    for (const st of raiz.querySelectorAll('style')) st.textContent = await trocarUrls(st.textContent.replace(/@import\s+(?:url\([^)]*\)|["'][^"']*["'])[^;]*;?/g, ''), avisos);
    for (const e of raiz.querySelectorAll('[style*="url("]')) e.setAttribute('style', await trocarUrls(e.getAttribute('style'), avisos));
    for (const img of raiz.querySelectorAll('img[src]')) {
      const s = img.getAttribute('src');
      if (/^https?:/i.test(s)) { try { img.setAttribute('src', await urlParaDataUrl(s)); } catch (e) { avisos.push('Não consegui baixar: ' + s.slice(0, 60)); } }
    }
    raiz.querySelectorAll('script,link,iframe').forEach((x) => x.remove()); // os scripts já rodaram na moldura; o SVG não executa nada
  }


  // "Vidro" (backdrop-filter): dentro do SVG o navegador ignora esse efeito. Então, para cada elemento com backdrop-filter, o app coloca DENTRO dele uma cópia
  // de tudo que está atrás (o que vem antes no HTML), desfocada com o mesmo filtro, e passa a cor/fundo do próprio elemento para uma camada por cima.
  function emularVidro(doc, raiz) {
    const win = doc.defaultView, vivos = [...doc.body.querySelectorAll('*')], bg = (cs) => `background-color:${cs.backgroundColor};background-image:${cs.backgroundImage};background-repeat:${cs.backgroundRepeat};background-position:${cs.backgroundPosition};background-size:${cs.backgroundSize}`;
    const csR = win.getComputedStyle(doc.documentElement), csB = win.getComputedStyle(doc.body), semBg = (c) => (c.backgroundColor === 'rgba(0, 0, 0, 0)' || c.backgroundColor === 'transparent') && c.backgroundImage === 'none';
    const fundoPagina = semBg(csR) ? bg(csB) : bg(csR);
    let n = 0;
    vivos.forEach((e, i) => {
      const cs = win.getComputedStyle(e), filtro = cs.backdropFilter && cs.backdropFilter !== 'none' ? cs.backdropFilter : cs.webkitBackdropFilter;
      if (!filtro || filtro === 'none') return;
      const corpo = raiz.querySelector('body'), c = [...corpo.querySelectorAll('*')][i]; if (!c) return;
      const r = e.getBoundingClientRect(), esq = r.left + e.clientLeft, topo = r.top + e.clientTop;
      const antes = corpo.cloneNode(true), ca = [...antes.querySelectorAll('*')][i];
      for (let no = ca; no && no !== antes; no = no.parentNode) while (no.nextSibling) no.parentNode.removeChild(no.nextSibling); // tira o que vem depois
      ca.parentNode.removeChild(ca); // e o próprio elemento
      antes.setAttribute('style', (antes.getAttribute('style') || '') + `;position:absolute;left:${-esq}px;top:${-topo}px;filter:${filtro}`);
      const raio = `${cs.borderTopLeftRadius} ${cs.borderTopRightRadius} ${cs.borderBottomRightRadius} ${cs.borderBottomLeftRadius}`, d = doc;
      const L = d.createElement('div'), T = d.createElement('div'); L.className = 'f1-vidro';
      L.setAttribute('style', `position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;z-index:-2;border-radius:${raio};${fundoPagina}`); L.appendChild(antes);
      T.setAttribute('style', `position:absolute;left:0;top:0;right:0;bottom:0;z-index:-1;border-radius:${raio};${bg(cs)}`);
      c.insertBefore(T, c.firstChild); c.insertBefore(L, c.firstChild);
      const st = c.getAttribute('style') || ''; c.setAttribute('style', st + ';background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;isolation:isolate;' + (cs.position === 'static' ? 'position:relative;' : ''));
      n++;
    });
    return n;
  }

  async function abrirMoldura(html, w, h) {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-same-origin allow-scripts');
    f.setAttribute('aria-hidden', 'true');
    Object.assign(f.style, { position: 'fixed', left: '-30000px', top: '0', width: w + 'px', height: h + 'px', border: '0', visibility: 'hidden', pointerEvents: 'none' });
    document.body.appendChild(f);
    await new Promise((ok) => { f.onload = ok; f.srcdoc = html; });
    const doc = f.contentDocument;
    try { await doc.fonts.ready; } catch (e) {}
    await dormir(600); // tempo para o ajuste automático de fonte do template rodar (igual ao programa de PC)
    return f;
  }

  // Desenha o HTML e devolve a imagem. opc: { w, h, formato: 'png'|'jpg', qualidade: 0-100, escala: 1 }
  function imagem(html, opc = {}, prioridade = true) {
    return naFila(async () => {
      const { w, h } = opc.w ? opc : Montar.tamanhoDe(html), escala = opc.escala || 1, avisos = [];
      const f = await abrirMoldura(html, w, h);
      try {
        const doc = f.contentDocument, raiz = doc.documentElement.cloneNode(true);
        const cs = f.contentWindow.getComputedStyle(doc.documentElement), cb = f.contentWindow.getComputedStyle(doc.body);
        emularVidro(doc, raiz);
        await embutirRecursos(raiz, avisos);
        // No documento o fundo do <body> "sobe" para a página toda; dentro do SVG o <html> é só uma caixa. Copia o fundo e o tamanho para ele.
        const semFundo = (s) => (s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'transparent') && s.backgroundImage === 'none';
        const estilo = [`width:${w}px`, `min-height:${h}px`, 'margin:0'];
        if (semFundo(cs)) estilo.push(`background-color:${cb.backgroundColor}`, `background-image:${cb.backgroundImage}`, `background-repeat:${cb.backgroundRepeat}`, `background-position:${cb.backgroundPosition}`, `background-size:${cb.backgroundSize}`);
        raiz.setAttribute('style', (raiz.getAttribute('style') || '') + ';' + estilo.join(';'));
        const xhtml = new XMLSerializer().serializeToString(raiz);
        const W = Math.round(w * escala), H = Math.round(h * escala);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;
        const img = new Image();
        await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('Não consegui desenhar o template (o navegador do celular recusou o HTML).')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        try { await img.decode(); } catch (e) {}
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'); if (opc.formato === 'jpg') { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
        g.drawImage(img, 0, 0, W, H);
        const tipo = opc.formato === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise((ok) => c.toBlob(ok, tipo, Math.min(1, Math.max(0.6, (opc.qualidade || 92) / 100))));
        if (!blob) throw new Error('Não consegui gerar o arquivo da imagem (pouca memória?).');
        return { blob, w: W, h: H, avisos };
      } finally { f.remove(); }
    }, prioridade);
  }

  return { imagem, dormir };
})();
