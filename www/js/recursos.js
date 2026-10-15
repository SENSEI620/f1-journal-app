// Fontes, recortes e extras do app + leitura de fotos.
const Recursos = (() => {
  const FONTES_PADRAO = [['Anton', 400], ['Inter', 400], ['Inter', 700], ['Inter', 800], ['Syne', 700], ['Syne', 800]]; // vêm dentro do app (www/fonts)
  const FORMATOS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
  let cssCache = null, familiasCache = null;

  const blobParaDataUrl = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
  const bytesParaB64 = (bytes) => Net.paraBase64(bytes);

  // CSS com todas as fontes (base64), igual ao cssFontes() do programa de PC
  async function fontsCss() {
    if (cssCache) return cssCache;
    const partes = [], fam = new Set();
    for (const [familia, peso] of FONTES_PADRAO) {
      try {
        const r = await fetch(`fonts/${familia}-${peso}.woff2`); if (!r.ok) continue;
        partes.push(`@font-face{font-family:"${familia}";font-weight:${peso};src:url(data:font/woff2;base64,${bytesParaB64(new Uint8Array(await r.arrayBuffer()))}) format("woff2");}`); fam.add(familia);
      } catch (e) {}
    }
    for (const { chave, valor } of await DB.todos('blobs')) { // fontes que vieram do PC (Sync)
      if (!String(chave).startsWith('fonte:')) continue;
      const m = String(valor.arquivo).match(/^(.+)-(\d+)\.(woff2|woff|ttf|otf)$/); if (!m) continue;
      partes.push(`@font-face{font-family:"${m[1]}";font-weight:${m[2]};src:url(data:font/${m[3]};base64,${bytesParaB64(new Uint8Array(await valor.blob.arrayBuffer()))}) format("${FORMATOS[m[3]]}");}`); fam.add(m[1]);
    }
    familiasCache = [...fam]; return (cssCache = partes.join('\n'));
  }
  const familias = async () => { await fontsCss(); return familiasCache; };
  const invalidarFontes = () => { cssCache = null; familiasCache = null; };

  // recortes e extras (imagens): valor "recorte:arquivo.png" / "extra:arquivo.png"
  const PREFIXO = { recortes: 'rec', extras: 'ext' };
  const listaBib = async (lib) => (await DB.todos('blobs')).filter((x) => String(x.chave).startsWith(PREFIXO[lib] + ':')).map((x) => ({ arquivo: x.valor.arquivo, blob: x.valor.blob })).sort((a, b) => a.arquivo.localeCompare(b.arquivo));
  const guardarBib = (lib, arquivo, blob) => DB.put('blobs', PREFIXO[lib] + ':' + arquivo, { arquivo, blob });
  const excluirBib = (lib, arquivo) => DB.del('blobs', PREFIXO[lib] + ':' + arquivo);

  // Descobre as imagens da biblioteca que os valores pedem e devolve uma função síncrona valor -> data URL
  async function resolverBib(valores) {
    const mapa = {};
    for (const v of Object.values(valores || {})) {
      const s = String(v || ''), m = s.match(/^(recorte|extra):(.+)$/); if (!m || mapa[s]) continue;
      const reg = await DB.get('blobs', (m[1] === 'extra' ? 'ext' : 'rec') + ':' + m[2]);
      mapa[s] = reg ? await blobParaDataUrl(reg.blob) : '';
    }
    return (valor) => mapa[valor] || '';
  }

  // Monta o HTML final de um template com os valores (usado na prévia, na miniatura e na imagem final)
  async function montarHtml(html, valores) {
    return Montar.montar(html, valores, { fontsCss: await fontsCss(), imagemUri: await resolverBib(valores) });
  }

  // Foto escolhida no celular: encolhe (lado maior até maxLado) e devolve data URL. Foto de câmera de 12 MP vira ~1 MB: mais rápido e sem estourar a memória.
  async function lerFoto(arquivo, maxLado = 3000) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = new Image(); img.decoding = 'async';
      await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('Não consegui abrir essa imagem.')); img.src = url; });
      const k = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
      if (k === 1 && /^image\/(jpeg|png|webp)$/.test(arquivo.type) && arquivo.size < 1.5 * 1048576) return blobParaDataUrl(arquivo);
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const png = arquivo.type === 'image/png' && c.width * c.height < 4e6; // PNG pequeno mantém transparência
      return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9);
    } finally { URL.revokeObjectURL(url); }
  }

  return { fontsCss, familias, invalidarFontes, listaBib, guardarBib, excluirBib, resolverBib, montarHtml, lerFoto, blobParaDataUrl };
})();
