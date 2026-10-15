// Aba Templates: grade de templates de imagem, busca, favoritos, miniaturas e Sync.
const Templ = (() => {
  let lista = [], favs = new Set(), usos = {}, soFav = false, termo = '', obs = null, fundoAmostra = null;
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  async function carregar() {
    const regs = await DB.todos('tpl'); favs = new Set(await DB.cfg('favs', [])); usos = await DB.cfg('usos', {});
    const fontes = await Recursos.familias();
    lista = regs.map(({ valor: r }) => ({ ...r, campos: Montar.camposDe(r.html), tamanho: Montar.tamanhoDe(r.html), video: !!Montar.videoAreaDe(r.html), avisos: Montar.avisosOffline(r.html, fontes), textos: Montar.textosDe(r.html), enquadra: Montar.enquadresDe(r.html), visual: /<!--F1EDITOR:/.test(r.html), uso: usos[r.id] || 0 }));
    pintar();
  }
  const porId = (id) => lista.find((t) => t.id === id);

  // valores de exemplo para a miniatura (iguais ao programa de PC)
  function fundoDeAmostra() {
    if (fundoAmostra) return fundoAmostra;
    const c = document.createElement('canvas'); c.width = 540; c.height = 675; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 540, 675);
    gr.addColorStop(0, '#2b3a67'); gr.addColorStop(1, '#0b1020'); g.fillStyle = gr; g.fillRect(0, 0, 540, 675);
    return (fundoAmostra = c.toDataURL('image/jpeg', 0.7));
  }
  const amostraDe = (t) => Object.fromEntries(t.campos.map((k) => [k, k === 'cor_destaque' ? '#e24b4a' : k === 'imagem_fundo' ? fundoDeAmostra() : k.startsWith('imagem') ? '' : k.endsWith('_html') ? 'Texto de <span class="hl">exemplo</span>' : 'Exemplo']));

  async function miniDe(t) { // miniatura em cache (blob) ou desenha uma nova
    const chave = 'mini:' + t.id + ':' + hashRapido(t.html), ja = await DB.get('blobs', chave);
    if (ja) return ja.blob;
    const html = await Recursos.montarHtml(t.html, amostraDe(t));
    const r = await Render.imagem(html, { escala: 300 / t.tamanho.w, formato: 'jpg', qualidade: 80, w: t.tamanho.w, h: t.tamanho.h }, false);
    for (const { chave: k } of await DB.todos('blobs')) if (String(k).startsWith('mini:' + t.id + ':') && k !== chave) DB.del('blobs', k); // some a miniatura velha
    await DB.put('blobs', chave, { blob: r.blob }); return r.blob;
  }
  function observar(cartao, t) {
    if (!obs) obs = new IntersectionObserver((es) => es.forEach(async (e) => {
      if (!e.isIntersecting) return; obs.unobserve(e.target);
      const tp = porId(e.target.dataset.id), m = $('.mini', e.target); if (!tp) return;
      try { const blob = await miniDe(tp), u = URL.createObjectURL(blob); m.classList.remove('carregando'); m.innerHTML = ''; const im = el('img'); im.src = u; im.alt = ''; im.onload = () => URL.revokeObjectURL(u); m.append(im); }
      catch (err) { m.classList.remove('carregando'); m.innerHTML = '<span class="nota" style="padding:8px;display:block">Sem miniatura</span>'; }
    }), { root: $('#p-templates'), rootMargin: '200px' });
    obs.observe(cartao);
  }

  function pintar() {
    const g = $('#grade'); g.innerHTML = ''; if (obs) { obs.disconnect(); obs = null; }
    const q = semAcento(termo.trim()), vis = lista.filter((t) => !t.video && (!soFav || favs.has(t.id)) && (!q || semAcento(t.nome).includes(q)));
    vis.sort((a, b) => (favs.has(b.id) - favs.has(a.id)) || (b.uso - a.uso) || a.nome.localeCompare(b.nome));
    const ocultos = lista.filter((t) => t.video).length, nota = $('#notaVideo');
    nota.hidden = !ocultos; nota.textContent = ocultos ? `${ocultos} template${ocultos > 1 ? 's' : ''} de vídeo ${ocultos > 1 ? 'ficam' : 'fica'} só no programa de PC por enquanto.` : '';
    if (!vis.length) {
      const sem = !lista.length;
      g.append(el('div', 'vazio', sem ? '<b>Nenhum template ainda</b>Baixe os seus templates do servidor ou do programa de PC.' : '<b>Nada encontrado</b>Tente outro nome ou desligue o filtro de favoritos.'));
      if (sem) { const b = el('button', 'botao ouro', 'Sincronizar agora'); b.onclick = sincronizar; g.firstChild.append(b); }
      return;
    }
    for (const t of vis) {
      const c = el('div', 'card'); c.dataset.id = t.id; c.setAttribute('role', 'button'); c.tabIndex = 0;
      c.innerHTML = `<div class="mini carregando"></div><span class="nome"></span>`; $('.nome', c).textContent = t.nome;
      const fav = el('button', 'fav' + (favs.has(t.id) ? ' on' : ''), svg('<path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.7 20l1.1-6L3.4 9.8l6-.8z"/>')); fav.setAttribute('aria-label', 'Favoritar');
      const mais = el('button', 'mais', svg('<circle cx="12" cy="5.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="18.5" r="1.2"/>')); mais.setAttribute('aria-label', 'Mais opções');
      fav.onclick = (e) => { e.stopPropagation(); alternarFav(t.id); }; mais.onclick = (e) => { e.stopPropagation(); menu(mais, t); };
      c.onclick = () => Criar.abrir(t); c.onkeydown = (e) => { if (e.key === 'Enter') Criar.abrir(t); };
      $('.mini', c).append(fav, mais);
      if (t.avisos.length) $('.mini', c).append(el('span', 'selo', '⚠ ' + t.avisos.length));
      g.append(c); observar(c, t);
    }
  }

  async function alternarFav(id) { favs.has(id) ? favs.delete(id) : favs.add(id); await DB.setCfg('favs', [...favs]); pintar(); }
  async function marcarUso(id) { usos[id] = Date.now(); const t = porId(id); if (t) t.uso = usos[id]; await DB.setCfg('usos', usos); }

  function menu(ancora, t) {
    const itens = [
      { texto: favs.has(t.id) ? 'Tirar dos favoritos' : 'Favoritar', fazer: () => alternarFav(t.id) },
      { texto: 'Renomear', fazer: async () => { const n = await perguntar({ titulo: 'Renomear template', input: true, valor: t.nome, ok: 'Salvar' }); if (n) { const r = await DB.get('tpl', t.id); await DB.put('tpl', t.id, { ...r, nome: n.replace(/[\\/]/g, '').slice(0, 80) }); carregar(); } } },
      { texto: 'Duplicar', fazer: async () => { const r = await DB.get('tpl', t.id), id = 'local-' + Math.random().toString(36).slice(2, 10); await DB.put('tpl', id, { id, nome: t.nome + ' (cópia)', html: r.html, criado: Date.now() }); toast('Duplicado.', 'ok'); carregar(); } },
    ];
    if (Templ.aoEditar && t.visual) itens.push({ texto: 'Editar no editor visual', fazer: () => Templ.aoEditar(t) });
    itens.push({ texto: 'Excluir do celular', perigo: true, fazer: async () => {
      if (!(await perguntar({ titulo: 'Excluir "' + t.nome + '"?', texto: 'Só some deste celular. Se ele ainda existir no servidor, volta no próximo Sync.', ok: 'Excluir' }))) return;
      await DB.del('tpl', t.id); for (const { chave } of await DB.todos('blobs')) if (String(chave).startsWith('mini:' + t.id + ':')) DB.del('blobs', chave); carregar();
    } });
    menuCard(ancora, itens);
  }

  let sincronizando = false;
  async function sincronizar() {
    if (sincronizando) return; const sync = await DB.cfg('sync', {});
    if (!sync.tipo || !sync.enderecos) { toast('Configure o servidor primeiro.'); App.irPara('config'); return; }
    sincronizando = true; const bt = $('#btSync'); bt.classList.add('gira'); bt.disabled = true; bt.classList.remove('novidade');
    try {
      const r = await Sync.sincronizar(); await carregar();
      const linhas = [`${r.novos.length} novo${r.novos.length === 1 ? '' : 's'}`, `${r.atualizados.length} atualizado${r.atualizados.length === 1 ? '' : 's'}`];
      if (r.conflitos.length) linhas.push(`${r.conflitos.length} com edição sua (não mexi): ${r.conflitos.join(', ')}`);
      if (r.removidos.length) linhas.push(`${r.removidos.length} não existe${r.removidos.length === 1 ? '' : 'm'} mais no servidor (ficaram aqui)`);
      if (r.predef) linhas.push(r.predef.erro ? 'Cores/recortes/fontes: ' + r.predef.erro : `${r.predef.cores} cor(es) e ${r.predef.arquivos} arquivo(s) do PC`);
      await perguntar({ titulo: 'Sync concluído', texto: linhas.join('\n'), semCancelar: true });
    } catch (e) { toast(limpaErro(e), 'erro', 6000); }
    sincronizando = false; bt.classList.remove('gira'); bt.disabled = false;
  }

  function iniciar() {
    $('#btSync').onclick = sincronizar;
    $('#busca').oninput = (e) => { termo = e.target.value; pintar(); };
    $('#btFav').onclick = (e) => { soFav = !soFav; e.currentTarget.setAttribute('aria-pressed', String(soFav)); pintar(); };
  }
  return { iniciar, carregar, pintar, sincronizar, porId, marcarUso, amostraDe, get lista() { return lista; }, aoEditar: null };
})();
