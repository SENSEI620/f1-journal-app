// Texto com cor em parte da frase (campos _html) e nomes de cores ("Ferrari" aplica a cor).
// A lógica de "trechos" é a MESMA do programa de PC (public/index.html), para o HTML sair igual. Só a barra de formatação é nova (feita para toque).
const Rico = (() => {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paraHex = (c) => {
    c = (c || '').trim(); if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
    const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    return m ? '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('') : null;
  };
  const chaveEst = (e) => JSON.stringify([e.cls || '', e.cor || '', e.grad || '', !!e.b]);
  function lerTrechos(raiz) {
    const trechos = [];
    const add = (t, est) => { if (!t) return; const u = trechos[trechos.length - 1]; if (u && chaveEst(u.est) === chaveEst(est)) u.t += t; else trechos.push({ t, est }); };
    (function andar(no, est) {
      if (no.nodeType === 3) return add(no.data.replace(/ /g, ' '), est);
      if (no.nodeName === 'BR') return add('\n', est);
      let e = est;
      if (no.nodeType === 1 && no !== raiz) {
        e = { ...est };
        if (no.nodeName === 'B' || no.nodeName === 'STRONG') e.b = true;
        if (typeof no.className === 'string' && no.className.trim()) e.cls = (e.cls ? e.cls + ' ' : '') + no.className.trim();
        const st = no.style;
        if (st && /gradient/.test(st.backgroundImage || '')) {
          const g = (st.backgroundImage.match(/#[0-9a-f]{6}|rgba?\([^)]*\)/gi) || []).map(paraHex).filter(Boolean).slice(0, 2);
          if (g.length === 2) e.grad = g;
        } else if (st && st.color) { const c = paraHex(st.color); if (c) e.cor = c; }
      }
      for (const f of no.childNodes) andar(f, e);
    })(raiz, {});
    return trechos;
  }
  function trechosParaHtml(trechos) {
    return trechos.map(({ t, est }) => {
      let h = esc(t).replace(/\n/g, '<br>');
      if (est.b) h = '<b>' + h + '</b>';
      if (est.grad) return `<span style="background:linear-gradient(90deg,${est.grad[0]},${est.grad[1]});-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent">${h}</span>`;
      if (est.cor) return `<span style="color:${est.cor}">${h}</span>`;
      if (est.cls) return `<span class="${est.cls}">${h}</span>`;
      return h;
    }).join('');
  }
  const serializar = (ed) => trechosParaHtml(lerTrechos(ed)).replace(/(<br>)+$/, '');
  const tamanhoNo = (no) => (no.nodeType === 3 ? no.length : no.nodeName === 'BR' ? 1 : [...no.childNodes].reduce((s, f) => s + tamanhoNo(f), 0));
  function posicao(raiz, alvo, off) {
    let n = 0, achou = false;
    (function andar(no) {
      if (achou) return;
      if (no === alvo) { n += no.nodeType === 3 ? off : [...no.childNodes].slice(0, off).reduce((s, f) => s + tamanhoNo(f), 0); achou = true; return; }
      if (no.nodeType === 3) { n += no.length; return; }
      if (no.nodeName === 'BR') { n += 1; return; }
      for (const f of no.childNodes) { andar(f); if (achou) return; }
    })(raiz);
    return n;
  }
  function localizar(raiz, pos) {
    let n = 0, res = null;
    (function andar(no) {
      if (res) return;
      if (no.nodeType === 3) { if (pos <= n + no.length) res = { no, off: pos - n }; else n += no.length; return; }
      if (no.nodeName === 'BR') { n += 1; return; }
      for (const f of no.childNodes) { andar(f); if (res) return; }
    })(raiz);
    return res || { no: raiz, off: raiz.childNodes.length };
  }
  function aplicarEstilo(trechos, s, e, tipo, arg) {
    const novo = { cor: () => ({ cor: arg }), grad: () => ({ grad: arg }), post: () => ({ cls: 'hl' }), limpar: () => ({}) }[tipo];
    const saida = []; let pos = 0;
    for (const r of trechos) {
      const ini = pos, fim = pos + r.t.length; pos = fim;
      const a = Math.max(s, ini), b = Math.min(e, fim);
      if (a >= b) { saida.push(r); continue; }
      if (a > ini) saida.push({ t: r.t.slice(0, a - ini), est: r.est });
      saida.push({ t: r.t.slice(a - ini, b - ini), est: novo() });
      if (b < fim) saida.push({ t: r.t.slice(b - ini), est: r.est });
    }
    return saida.reduce((m, r) => { const u = m[m.length - 1]; if (u && chaveEst(u.est) === chaveEst(r.est)) u.t += r.t; else m.push({ t: r.t, est: r.est }); return m; }, []);
  }

  // nome da cor calculado pelo código (dicas)
  function nomeCor(hex) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (l < 0.12) return 'Preto'; if (l > 0.92) return 'Branco';
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (s < 0.12) return l < 0.35 ? 'Cinza escuro' : l > 0.7 ? 'Cinza claro' : 'Cinza';
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
    const nome = h < 15 || h >= 345 ? 'Vermelho' : h < 32 ? 'Laranja' : h < 48 ? 'Âmbar' : h < 70 ? 'Amarelo' : h < 160 ? 'Verde' : h < 195 ? 'Ciano' : h < 255 ? 'Azul' : h < 290 ? 'Roxo' : 'Rosa';
    return l < 0.3 ? nome + ' escuro' : l > 0.75 ? nome + ' claro' : nome;
  }

  // cores com nome (iguais às do programa de PC; os nomes que o usuário salvou valem mais)
  const COR_NOMES = { 'ferrari': '#dc0000', 'scuderia ferrari': '#dc0000', 'vermelho ferrari': '#dc0000', 'red bull': '#3671c6', 'redbull': '#3671c6', 'oracle red bull': '#3671c6', 'mercedes': '#27f4d2', 'mercedes amg': '#27f4d2', 'mclaren': '#ff8000', 'aston martin': '#229971', 'alpine': '#ff87bc', 'alpine azul': '#0093cc', 'williams': '#64c4ff',
    'haas': '#b6babd', 'racing bulls': '#6692ff', 'rb': '#6692ff', 'visa cash app rb': '#6692ff', 'sauber': '#52e252', 'kick sauber': '#52e252', 'audi': '#f50537', 'cadillac': '#d4af37',
    'vermelho': '#e24b4a', 'vermelho escuro': '#8b0000', 'azul': '#1e5fff', 'azul escuro': '#0a1f66', 'azul claro': '#6cb4ff', 'ciano': '#00e5ff', 'verde': '#16a34a', 'verde claro': '#4ade80', 'verde limao': '#a3e635', 'amarelo': '#facc15', 'dourado': '#f8b500', 'ouro': '#f8b500', 'laranja': '#ff8000', 'rosa': '#ff6fb5', 'roxo': '#7c3aed', 'violeta': '#8b5cf6',
    'preto': '#000000', 'branco': '#ffffff', 'cinza': '#808080', 'cinza escuro': '#333333', 'cinza claro': '#cccccc', 'prata': '#c0c0c0', 'marrom': '#7b4a2b', 'bordo': '#6d0f1f' };
  let coresNomes = {};
  const setCoresNomes = (o) => { coresNomes = o || {}; };
  const getCoresNomes = () => coresNomes;
  const normNome = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9# ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tabelaNomesCor = () => { const t = {}; Object.entries(COR_NOMES).forEach(([n, c]) => (t[normNome(n)] = c)); Object.entries(coresNomes).forEach(([n, c]) => (t[normNome(n)] = c)); return t; };
  function achaCorNome(txt) { // { hex, nome } ou null: nome exato, parte do nome (se só dá uma cor) ou código (#e24b4a / e24b4a)
    const q = normNome(txt); if (!q) return null;
    if (/^#?[0-9a-f]{6}$/.test(q)) return { hex: '#' + q.replace('#', ''), nome: q.replace('#', '').toUpperCase() };
    const t = tabelaNomesCor(); if (t[q]) return { hex: t[q], nome: q };
    if (q.length < 3) return null;
    const achou = Object.keys(t).filter((n) => n.startsWith(q) || n.split(' ').some((p) => p.startsWith(q))), cs = [...new Set(achou.map((n) => t[n]))];
    return cs.length === 1 ? { hex: cs[0], nome: achou[0] } : null;
  }
  const listaNomesCor = () => { const t = { ...COR_NOMES, ...coresNomes }; return Object.keys(t).sort((a, b) => (coresNomes[b] ? 1 : 0) - (coresNomes[a] ? 1 : 0) || a.localeCompare(b)); };

  return { lerTrechos, trechosParaHtml, serializar, posicao, localizar, aplicarEstilo, nomeCor, achaCorNome, listaNomesCor, setCoresNomes, getCoresNomes, COR_NOMES };
})();
