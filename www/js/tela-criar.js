// Tela de criar o post: prévia ao vivo no topo, campos embaixo, botão Gerar imagem.
// Os campos seguem as mesmas regras do programa de PC (ordem: foto, recorte, extra, textos, cor; _html = texto com cor; cor_destaque = cor do post).
const Criar = (() => {
  const NOMES = { cor_destaque: 'Cor de destaque', imagem_fundo: 'Imagem de fundo', imagem_recorte: 'Recorte (camada 2)', imagem_extra: 'Extra' };
  const ICO_ESQ = '<path d="M15 5l-7 7 7 7"/>';
  let t = null, valores = {}, cores = [], bibs = { recortes: [], extras: [] }, timer = null, tam = { w: 1080, h: 1350 }, gerando = false, fmtAlvo = null, gradC1 = null;

  const nomeBonito = (k) => { const n = NOMES[k] || k.replace(/_html$/, '').replace(/_/g, ' '); return n.charAt(0).toUpperCase() + n.slice(1); };
  const agendar = () => { clearTimeout(timer); timer = setTimeout(preview, 300); };

  // ---------- prévia ----------
  async function preview() {
    if (!t) return;
    try { $('#quadro').srcdoc = await Recursos.montarHtml(t.html, valores); ajustar(); } catch (e) { toast('Erro na prévia: ' + limpaErro(e), 'erro'); }
  }
  function ajustar() { // encolhe o post para caber no topo da tela (até ~38% da altura)
    const box = $('#criarRolagem'); if (!box || !t || box.clientWidth < 10) return;
    const k = Math.min((box.clientWidth - 32) / tam.w, (innerHeight * 0.38) / tam.h);
    Object.assign($('#prev').style, { width: Math.round(tam.w * k) + 'px', height: Math.round(tam.h * k) + 'px' });
    Object.assign($('#quadro').style, { width: tam.w + 'px', height: tam.h + 'px', transform: `scale(${k})` });
  }
  new ResizeObserver(() => ajustar()).observe($('#criarRolagem'));
  new ResizeObserver((es) => document.documentElement.style.setProperty('--acao-h', es[0].target.offsetHeight + 'px')).observe($('.acao'));

  // ---------- campos ----------
  function deslizante(rot, min, max, valor, aoMudar) {
    const w = el('div', 'deslizante'), r = el('input'), o = el('output');
    r.type = 'range'; r.min = min; r.max = max; r.step = 1; r.value = valor; o.textContent = valor + '%';
    r.oninput = () => { o.textContent = r.value + '%'; aoMudar(Number(r.value)); };
    w.append(el('label', '', rot), r, o); return w;
  }
  function campoImagem(k, enq) {
    const caixa = el('div', 'foto', '<span><b>+</b>Foto</span>'); caixa.setAttribute('role', 'button'); caixa.tabIndex = 0;
    const mostrar = (url) => { caixa.style.backgroundImage = `url("${url}")`; caixa.classList.add('tem'); };
    caixa.onclick = async () => {
      const arq = await escolherArquivo($('#arqFoto'), 'image/*'); if (!arq) return;
      try { valores[k] = await Recursos.lerFoto(arq); mostrar(valores[k]); agendar(); } catch (e) { toast(limpaErro(e), 'erro'); }
    };
    if (valores[k]) mostrar(valores[k]);
    const linha = el('div', 'foto-linha'); linha.append(caixa);
    const rem = el('button', 'botao vidro', 'Tirar foto'); rem.type = 'button'; rem.hidden = !valores[k];
    rem.onclick = () => { valores[k] = ''; caixa.style.backgroundImage = ''; caixa.classList.remove('tem'); rem.hidden = true; agendar(); };
    const antes = caixa.onclick; caixa.onclick = async () => { await antes(); rem.hidden = !valores[k]; };
    linha.append(rem);
    if (!enq) return linha;
    const bloco = el('div'), ctl = el('div'); bloco.append(linha, ctl);
    const pintar = () => {
      ctl.innerHTML = '';
      const mk = (rot, c, min, max, pad) => deslizante(rot, min, max, valores[k + c] ?? pad, (v) => { valores[k + c] = v; agendar(); });
      const bt = el('button', 'botao vidro', 'Voltar ao enquadramento padrão'); bt.type = 'button'; bt.style.marginTop = '12px';
      bt.onclick = () => { delete valores[k + '__zoom']; delete valores[k + '__x']; delete valores[k + '__y']; pintar(); agendar(); };
      ctl.append(mk('Zoom', '__zoom', 100, 300, enq.z), mk('Posição horizontal', '__x', 0, 100, enq.x), mk('Posição vertical', '__y', 0, 100, enq.y), bt);
    };
    pintar(); return bloco;
  }
  function campoBib(k, lib) {
    const w = el('div', 'rec'), pre = (lib === 'recortes' ? 'recorte' : 'extra') + ':';
    [{ arquivo: '' }, ...bibs[lib]].forEach((r) => {
      const v = r.arquivo ? pre + r.arquivo : '', d = el('div', 'rc' + ((valores[k] || '') === v ? ' sel' : ''), r.arquivo ? '' : 'Nenhum');
      if (r.arquivo) { const im = el('img'); im.alt = r.arquivo; im.src = r.url; d.append(im); }
      d.onclick = () => { valores[k] = v; w.replaceWith(campoBib(k, lib)); agendar(); }; w.append(d);
    });
    const add = el('div', 'rc add', '+'); add.setAttribute('aria-label', 'Adicionar imagem');
    add.onclick = async () => {
      const arq = await escolherArquivo($('#arqFoto'), 'image/*'); if (!arq) return;
      const nome = arq.name.replace(/[^\p{L}\p{N}_\-. ]/gu, '') || 'imagem.png';
      await Recursos.guardarBib(lib, nome, arq); await carregarBibs(); valores[k] = pre + nome; w.replaceWith(campoBib(k, lib)); agendar();
    };
    w.append(add); return w;
  }
  async function carregarBibs() {
    for (const lib of ['recortes', 'extras']) { (bibs[lib] || []).forEach((r) => URL.revokeObjectURL(r.url)); bibs[lib] = (await Recursos.listaBib(lib)).map((r) => ({ ...r, url: URL.createObjectURL(r.blob) })); }
  }
  function campoCor(k) {
    const w = el('div'), car = el('div', 'carrossel'), cor = el('input'), nome = el('input'), aviso = el('small', 'nome-cor-msg');
    cor.type = 'color'; cor.value = valores[k];
    const marcar = () => { [...car.children].forEach((b) => b.classList.toggle('sel', (b.dataset.c || '') === String(valores[k]).toLowerCase())); const s = car.querySelector('.sel'); if (s) car.scrollTo({ left: s.offsetLeft - car.clientWidth / 2 + 22 }); };
    const usar = (c) => { valores[k] = c; cor.value = c; $('#t-criar').style.setProperty('--destaque', c); marcar(); agendar(); };
    cores.forEach((c) => { const b = el('b'); b.style.background = c; b.dataset.c = c.toLowerCase(); b.title = Rico.nomeCor(c); b.setAttribute('role', 'button'); b.setAttribute('aria-label', Rico.nomeCor(c) + ' ' + c); b.onclick = () => usar(c); car.append(b); });
    cor.oninput = () => usar(cor.value);
    nome.placeholder = 'Nome da cor (ex: Ferrari, Mercedes, dourado)'; nome.autocomplete = 'off'; nome.spellcheck = false; nome.setAttribute('list', 'dlCores');
    const aplicarNome = (avisar) => {
      const r = Rico.achaCorNome(nome.value); if (!nome.value.trim()) { aviso.textContent = ''; return; }
      if (r) { usar(r.hex); aviso.className = 'nome-cor-msg ok'; aviso.textContent = '✔ ' + r.hex.toUpperCase(); }
      else if (avisar) { aviso.className = 'nome-cor-msg erro'; aviso.textContent = 'Não conheço essa cor. Escolha no seletor e use "Salvar na paleta": ela passa a ter esse nome.'; }
    };
    nome.oninput = () => aplicarNome(false); nome.onchange = () => aplicarNome(true); nome.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarNome(true); nome.blur(); } };
    const salvar = el('button', 'botao vidro', 'Salvar na paleta'); salvar.type = 'button';
    salvar.onclick = async () => {
      const n = nome.value.trim(), hex = cor.value.toLowerCase(), ja = Rico.achaCorNome(n);
      if (n && !/^#?[0-9a-f]{6}$/i.test(n) && !(ja && ja.hex.toLowerCase() === hex)) { const cn = { ...Rico.getCoresNomes(), [n]: hex }; Rico.setCoresNomes(cn); await DB.setCfg('coresNomes', cn); }
      if (!cores.some((x) => x.toLowerCase() === hex)) { cores.push(cor.value); await DB.setCfg('cores', cores); }
      w.replaceWith(campoCor(k)); toast('Cor salva na paleta.', 'ok');
    };
    const linha = el('div', 'linha-cor'); linha.append(cor, salvar);
    w.append(car, nome, aviso, linha); marcar(); setTimeout(marcar, 60); return w;
  }
  function campoTexto(k) {
    const longo = /legenda|descri|texto|corpo|resumo|citacao/.test(k), c = el(longo ? 'textarea' : 'input');
    if (longo) c.rows = 3; else { c.type = 'text'; c.enterKeyHint = 'done'; }
    c.value = valores[k] || ''; c.autocomplete = 'off'; c.spellcheck = true;
    const cresce = () => { if (!longo) return; c.style.height = 'auto'; c.style.height = Math.min(c.scrollHeight + 2, innerHeight * 0.4) + 'px'; };
    c.oninput = () => { valores[k] = c.value; cresce(); agendar(); }; if (!longo) c.onkeydown = (e) => { if (e.key === 'Enter') c.blur(); }; setTimeout(cresce, 0);
    return c;
  }
  function campoHtml(k) {
    const ed = el('div', 'edit'); ed.contentEditable = 'true'; ed.spellcheck = false; ed.dataset.ph = 'Digite aqui. Para colorir, selecione um trecho.'; ed.setAttribute('role', 'textbox'); ed.setAttribute('aria-multiline', 'true');
    ed.innerHTML = valores[k] || '';
    ed.addEventListener('input', () => { valores[k] = Rico.serializar(ed); agendar(); });
    ed.addEventListener('beforeinput', (e) => { if (e.inputType === 'insertParagraph') { e.preventDefault(); document.execCommand('insertLineBreak'); } }); // Enter = quebra de linha (teclado do celular também)
    ed.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); } });
    ed.addEventListener('paste', (e) => { const cd = e.clipboardData; if (!cd) return; e.preventDefault(); document.execCommand('insertText', false, cd.getData('text/plain')); }); // cola só o texto
    return ed;
  }
  // tamanho da letra, negrito e alinhamento SÓ deste post (o padrão do template, usado pelo n8n, não muda)
  function barraTexto(k, info) {
    const bar = el('div', 'tx-bar'), padNeg = Number(info.peso) >= 600;
    const ALS = [['left', 'Alinhar à esquerda', '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'], ['center', 'Centralizar', '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'], ['right', 'Alinhar à direita', '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>']];
    const rz = el('button', '', '↺'), inp = el('input'), menos = el('button', '', '−'), mais = el('button', '', '+'), neg = el('button', '', 'B');
    [rz, menos, mais, neg].forEach((b) => (b.type = 'button')); inp.type = 'number'; inp.inputMode = 'numeric'; inp.min = 8; inp.max = 400;
    rz.setAttribute('aria-label', 'Voltar ao padrão do template'); menos.setAttribute('aria-label', 'Letra menor'); mais.setAttribute('aria-label', 'Letra maior'); neg.setAttribute('aria-label', 'Negrito');
    const als = ALS.map(([v, tit, d]) => { const b = el('button', '', svg(d)); b.type = 'button'; b.dataset.al = v; b.setAttribute('aria-label', tit); return b; });
    const gTam = el('span', 'tx-g'); gTam.append(menos, inp, mais); const gAl = el('span', 'tx-g'); gAl.append(neg, ...als);
    bar.append(el('span', 'tx-rot', info.fit ? 'Letra (máx.)' : 'Letra'), gTam, gAl, rz);
    const tem = () => ['__tam', '__neg', '__al'].some((c) => valores[k + c] !== undefined);
    const pintar = () => {
      const tm = valores[k + '__tam'] ?? info.tam, n = valores[k + '__neg'] === undefined ? padNeg : valores[k + '__neg'] === '1', al = valores[k + '__al'] ?? info.al;
      if (document.activeElement !== inp) inp.value = tm; neg.classList.toggle('on', n); als.forEach((b) => b.classList.toggle('on', b.dataset.al === al)); rz.disabled = !tem();
    };
    const guardar = (c, v, padrao) => { if (v === padrao) delete valores[k + c]; else valores[k + c] = v; pintar(); agendar(); };
    const atual = () => Number(valores[k + '__tam'] ?? info.tam), mudaTam = (v) => guardar('__tam', Math.max(8, Math.min(400, Math.round(Number(v) || info.tam))), info.tam);
    inp.oninput = () => { const v = Number(inp.value); if (v >= 8 && v <= 400) mudaTam(v); }; inp.onblur = pintar; menos.onclick = () => mudaTam(atual() - 2); mais.onclick = () => mudaTam(atual() + 2);
    neg.onclick = () => guardar('__neg', (valores[k + '__neg'] === undefined ? padNeg : valores[k + '__neg'] === '1') ? '0' : '1', padNeg ? '1' : '0');
    als.forEach((b) => (b.onclick = () => guardar('__al', b.dataset.al, info.al)));
    rz.onclick = () => { ['__tam', '__neg', '__al'].forEach((c) => delete valores[k + c]); pintar(); agendar(); };
    pintar(); return bar;
  }

  // ---------- barra de formatação (aparece ao selecionar texto num campo colorível) ----------
  const barra = () => $('#barraFmt');
  function ocultarFmt() { barra().hidden = true; fmtAlvo = null; }
  function montarBarra(painel) {
    const b = barra(); b.innerHTML = ''; const linha = el('div', 'fb-linha');
    [['Cor', () => abrirPainel('cor')], ['Gradiente', () => abrirPainel('grad')], ['Limpar', () => formatar('limpar')]].forEach(([txt, fn]) => { const x = el('button', '', txt); x.type = 'button'; x.onclick = fn; linha.append(x); });
    b.append(linha); if (painel) b.append(painel);
  }
  function abrirPainel(tipo) {
    gradC1 = null;
    const p = el('div'), tit = el('div', 'fb-titulo', tipo === 'cor' ? 'Escolha a cor' : 'Gradiente: escolha a 1ª cor'), g = el('div', 'fb-cores'), prev = el('div', 'fb-prev'); prev.hidden = true;
    const chip = (cor, titulo, clique, cls) => { const x = el('b', cls || ''); if (cor) x.style.background = cor; x.setAttribute('aria-label', titulo); x.onclick = clique; g.append(x); };
    if (tipo === 'cor') chip(null, 'Cor do post (acompanha a cor de destaque)', () => formatar('post'), 'postcor');
    cores.forEach((c) => chip(c, Rico.nomeCor(c) + ' ' + c.toUpperCase(), () => {
      if (tipo === 'cor') return formatar('cor', c);
      if (!gradC1) { gradC1 = c; tit.textContent = 'Agora escolha a 2ª cor'; prev.hidden = false; prev.style.background = c; return; }
      formatar('grad', [gradC1, c]);
    }));
    p.append(tit, g, prev); montarBarra(p);
  }
  function formatar(tipo, arg) {
    const ed = fmtAlvo, sel = getSelection(); if (!ed || !sel.rangeCount) return;
    const r = sel.getRangeAt(0), s = Rico.posicao(ed, r.startContainer, r.startOffset), e = Rico.posicao(ed, r.endContainer, r.endOffset); if (s === e) return;
    ed.innerHTML = Rico.trechosParaHtml(Rico.aplicarEstilo(Rico.lerTrechos(ed), s, e, tipo, arg));
    const r2 = document.createRange(), i = Rico.localizar(ed, s), f = Rico.localizar(ed, e);
    r2.setStart(i.no, i.off); r2.setEnd(f.no, f.off); sel.removeAllRanges(); sel.addRange(r2);
    ed.dispatchEvent(new Event('input')); montarBarra();
  }
  let selTimer = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer); selTimer = setTimeout(() => {
      if ($('#t-criar').hidden) return;
      const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return ocultarFmt();
      const no = sel.getRangeAt(0).commonAncestorContainer, ed = (no.nodeType === 3 ? no.parentNode : no).closest && (no.nodeType === 3 ? no.parentNode : no).closest('.edit');
      if (!ed) return ocultarFmt();
      if (fmtAlvo !== ed || barra().hidden) { fmtAlvo = ed; montarBarra(); } barra().hidden = false;
    }, 120);
  });
  ['pointerdown', 'mousedown'].forEach((ev) => barra().addEventListener(ev, (e) => e.preventDefault())); // tocar na barra não pode tirar a seleção do texto
  barra().addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

  // ---------- abrir / fechar ----------
  async function abrir(tp, pre) {
    t = tp; tam = t.tamanho || { w: 1080, h: 1350 }; cores = await DB.cfg('cores', CORES_PADRAO); Rico.setCoresNomes(await DB.cfg('coresNomes', {})); await carregarBibs();
    valores = { cor_destaque: cores[0] || '#e24b4a', ...(pre || {}) }; clearTimeout(timer);
    $('#criarTitulo').textContent = t.nome; $('#t-criar').style.setProperty('--destaque', valores.cor_destaque);
    const av = $('#avisosTpl'); av.innerHTML = t.avisos.length ? '<div class="aviso"><b>Atenção para usar sem internet</b><br>' + t.avisos.map((a) => a.replace(/</g, '&lt;')).join('<br>') + '</div>' : '';
    const dl = el('datalist'); dl.id = 'dlCores'; Rico.listaNomesCor().forEach((n) => { const o = el('option'); o.value = n.replace(/\b\w/g, (m) => m.toUpperCase()); dl.append(o); });
    const C = $('#campos'); C.innerHTML = ''; C.append(dl);
    const rank = (k) => (k === 'cor_destaque' ? 9 : k.includes('recorte') ? 1 : k.includes('extra') ? 2 : k.startsWith('imagem') ? 0 : 5);
    [...t.campos].sort((a, b) => rank(a) - rank(b)).forEach((k) => {
      let campo;
      if (k === 'cor_destaque') campo = campoCor(k); else if (k.includes('recorte')) campo = campoBib(k, 'recortes'); else if (k.includes('extra')) campo = campoBib(k, 'extras');
      else if (k.startsWith('imagem')) campo = campoImagem(k, t.enquadra && t.enquadra[k]); else if (k.endsWith('_html')) campo = campoHtml(k); else campo = campoTexto(k);
      const lab = el('label', '', nomeBonito(k)); C.append(lab, campo);
      if (t.textos && t.textos[k]) C.append(barraTexto(k, t.textos[k]));
    });
    if (!t.campos.length) C.append(el('p', 'nota', 'Este template não tem campos para preencher.'));
    $('#t-criar').hidden = false; $('#criarRolagem').scrollTop = 0; Nav.abrir(() => fechar(true)); ajustar(); preview();
  }
  function fechar(deHistorico) {
    if (!deHistorico) return Nav.fechar(); // botão Voltar da tela: passa pelo histórico
    clearTimeout(timer); ocultarFmt(); $('#t-criar').hidden = true; $('#quadro').srcdoc = ''; t = null;
    bibs.recortes.concat(bibs.extras).forEach((r) => URL.revokeObjectURL(r.url));
  }

  // nome do arquivo: data e hora + título do post (igual ao programa de PC)
  function nomeArquivo(tp, v, ext) {
    const texto = ['titulo', 'titulo_html', 'nome_bomba', 'citacao_html', 'kicker', 'legenda'].map((k) => v[k]).find((x) => x && String(x).trim()) || tp.nome;
    const limpa = (s) => String(s).replace(/[^\p{L}\p{N}_\-(). ,]/gu, '').replace(/\s+/g, ' ').replace(/^[ .]+|[ .]+$/g, '');
    const limpo = limpa(String(texto).replace(/<[^>]*>/g, ' ').replace(/&\w+;/g, ' ')).replace(/\s+/g, ' ').slice(0, 40).trim() || limpa(tp.nome) || 'post', d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())} - ${limpo}.${ext}`;
  }
  async function gerar() {
    if (!t || gerando) return; gerando = true; const bt = $('#btGerar'); bt.disabled = true; bt.textContent = 'Gerando a imagem...'; document.activeElement && document.activeElement.blur();
    try {
      const f = await DB.cfg('imagem', { formato: 'png', qualidade: 92 }), html = await Recursos.montarHtml(t.html, valores);
      const r = await Render.imagem(html, { formato: f.formato, qualidade: f.qualidade });
      const nome = nomeArquivo(t, valores, f.formato === 'jpg' ? 'jpg' : 'png');
      await Imagens.registrar({ template: t, valores, blob: r.blob, nome, w: r.w, h: r.h });
      Templ.marcarUso(t.id);
      if (r.avisos.length) toast(r.avisos[0], 'erro', 5000);
      Folha.abrir({ blob: r.blob, nome, w: r.w, h: r.h, info: { template: t.nome, id: t.id, tipo: 'IMG', pasta: '' } });
    } catch (e) { toast('Erro ao gerar: ' + limpaErro(e), 'erro', 6000); }
    gerando = false; bt.disabled = false; bt.textContent = 'Gerar imagem';
  }
  function iniciar() { $('#btVoltar').onclick = () => fechar(false); $('#btGerar').onclick = gerar; }
  return { iniciar, abrir, fechar, get atual() { return t; }, get valores() { return valores; }, preview, nomeArquivo };
})();
