// Config: servidor de templates, webhook do n8n, formato da imagem, paleta de cores, armazenamento.
const Config = (() => {
  const secoes = {};
  const sec = (id, titulo, montar) => { const d = el('details'); d.dataset.id = id; d.append(el('summary', '', titulo)); const c = el('div', 'corpo'); d.append(c); secoes[id] = d; montar(c); return d; };
  const campo = (rot, tipo, valor, ph) => { const l = el('label', '', rot), i = el('input'); i.type = tipo; i.value = valor || ''; if (ph) i.placeholder = ph; i.autocomplete = 'off'; i.spellcheck = false; i.autocapitalize = 'off'; return [l, i]; };
  const botao = (txt, cls, fn) => { const b = el('button', 'botao ' + cls, txt); b.type = 'button'; b.onclick = fn; return b; };

  async function sync(c) {
    const s = await DB.cfg('sync', { tipo: 'n8n' });
    const lt = el('label', '', 'Tipo de servidor'), sel = el('select');
    [['n8n', 'Template Manager (n8n)'], ['store', 'Template Store (site)'], ['pc', 'Programa de PC (Compartilhar)']].forEach(([v, n]) => { const o = el('option', '', n); o.value = v; sel.append(o); }); sel.value = s.tipo || 'n8n';
    const [le, end] = campo('Endereço(s) (separe por espaço)', 'text', s.enderecos, 'ex: 192.168.0.10:3004'), [lc, cod] = campo('Código de acesso', 'password', s.codigo), [lu, usu] = campo('Usuário', 'text', s.usuario), [lp, sen] = campo('Senha', 'password', s.senha);
    const dica = el('p', 'dica'), pintar = () => { const st = sel.value === 'store'; [lc, cod].forEach((x) => (x.hidden = st)); [lu, usu, lp, sen].forEach((x) => (x.hidden = !st)); dica.textContent = sel.value === 'pc' ? 'No PC, ligue "Compartilhar" no F1 Journal Studio. Porta padrão 3790. Também traz cores, recortes, extras e fontes.' : sel.value === 'n8n' ? 'Porta padrão 3004.' : 'Porta padrão 3001.'; };
    sel.onchange = pintar; pintar();
    const salvar = async () => { await DB.setCfg('sync', { tipo: sel.value, enderecos: end.value.trim(), codigo: cod.value, usuario: usu.value.trim(), senha: sen.value }); };
    const st = el('p', 'status', '');
    const testar = botao('Testar conexão', 'vidro', async () => { await salvar(); st.className = 'status'; st.textContent = 'Testando...'; try { const r = await Sync.conectar(); st.className = 'status ok'; st.textContent = `Conectou em ${r.base}. ${r.lista.length} template(s) lá.`; } catch (e) { st.className = 'status erro'; st.textContent = limpaErro(e); } });
    const sinc = botao('Sincronizar agora', 'ouro', async () => { await salvar(); App.irPara('templates'); Templ.sincronizar(); });
    const b = el('div', 'botoes'); b.append(testar, sinc);
    c.append(lt, sel, le, end, lc, cod, lu, usu, lp, sen, dica, b, st);
    [end, cod, usu, sen].forEach((i) => (i.onchange = salvar)); sel.addEventListener('change', salvar);
  }
  async function n8n(c) {
    const n = await DB.cfg('n8n', {}), [lu, urls] = campo('Endereço do webhook (pode colocar mais de um)', 'text', n.urls, 'http://IP:5678/webhook/...'), [lt, tok] = campo('Token (x-token)', 'password', n.token);
    const st = el('p', 'status'), salvar = async () => { await DB.setCfg('n8n', { urls: urls.value.trim(), token: tok.value.trim() }); st.className = 'status ok'; st.textContent = 'Salvo.'; };
    urls.onchange = tok.onchange = salvar; c.append(lu, urls, lt, tok, el('p', 'dica', 'É o mesmo webhook do programa de PC. Usado em "Enviar pro n8n" e na Postagem Global.'), st);
  }
  async function imagem(c) {
    const f = await DB.cfg('imagem', { formato: 'png', qualidade: 92 }), lf = el('label', '', 'Formato da imagem'), sel = el('select');
    [['png', 'PNG (melhor qualidade)'], ['jpg', 'JPG (arquivo menor)']].forEach(([v, n]) => { const o = el('option', '', n); o.value = v; sel.append(o); }); sel.value = f.formato;
    const lq = el('label', '', 'Qualidade do JPG: ' + f.qualidade + '%'), q = el('input'); q.type = 'range'; q.min = 60; q.max = 100; q.value = f.qualidade;
    const salvar = () => { lq.textContent = 'Qualidade do JPG: ' + q.value + '%'; DB.setCfg('imagem', { formato: sel.value, qualidade: Number(q.value) }); };
    sel.onchange = q.oninput = salvar; c.append(lf, sel, lq, q);
  }
  async function paleta(c) {
    const cores = await DB.cfg('cores', CORES_PADRAO), P = el('div', 'paleta'); c.append(P, el('p', 'dica', 'Toque numa cor para remover. Para criar uma nova, use "Salvar na paleta" ao criar um post, ou sincronize com o PC.'));
    const pintar = () => { P.innerHTML = ''; cores.forEach((cor, i) => { const b = el('b'); b.style.background = cor; b.title = Rico.nomeCor(cor); b.onclick = async () => { if (cores.length < 2) return toast('Deixe pelo menos uma cor.'); if (await perguntar({ titulo: 'Remover esta cor?', texto: Rico.nomeCor(cor) + ' ' + cor.toUpperCase(), ok: 'Remover' })) { cores.splice(i, 1); await DB.setCfg('cores', cores); pintar(); } }; P.append(b); }); };
    pintar();
  }
  async function armaz(c) {
    const info = el('p', 'dica'), atualizar = async () => { const h = (await DB.todos('hist')).length, m = (await DB.keys('blobs')).filter((k) => k.startsWith('mini:')).length; info.textContent = `${h} imagem(ns) no histórico · ${m} miniatura(s) guardadas.`; };
    const bm = botao('Limpar miniaturas', 'vidro', async () => { for (const k of (await DB.keys('blobs')).filter((k) => k.startsWith('mini:'))) await DB.del('blobs', k); toast('Miniaturas limpas.', 'ok'); atualizar(); });
    const bh = botao('Apagar histórico de imagens', 'vidro', async () => { if (await perguntar({ titulo: 'Apagar o histórico?', texto: 'As imagens já compartilhadas não são afetadas.', ok: 'Apagar' })) { await DB.limpar('hist'); Imagens.pintar(); atualizar(); } });
    const b = el('div', 'botoes'); b.append(bm, bh); c.append(info, b); c.closest('details').addEventListener('toggle', atualizar); atualizar();
  }
  async function montar() {
    const C = $('#cfgConteudo'); C.className = 'cfg'; C.innerHTML = '';
    C.append(sec('sync', 'Sync com o servidor', (c) => sync(c)), sec('n8n', 'Enviar pro n8n', (c) => n8n(c)), sec('imagem', 'Formato da imagem', (c) => imagem(c)), sec('paleta', 'Paleta de cores', (c) => paleta(c)), sec('armaz', 'Armazenamento', (c) => armaz(c)));
    const sobre = el('p', 'dica', `F1 Journal Studio App · versão ${APP_VERSAO} · edição de templates de imagem. Vídeo vem numa próxima versão.`); C.append(sobre);
  }
  function abrirSecao(id) { const d = secoes[id]; if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }
  return { montar, abrirSecao };
})();
