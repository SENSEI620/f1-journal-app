// Folha de resultado (compartilhar / enviar / baixar) e histórico das imagens geradas.
const Folha = (() => {
  let cur = null, url = null;
  const status = (m, cls) => { const s = $('#resStatus'); s.textContent = m || ''; s.className = 'status ' + (cls || ''); };

  async function compartilhar(item) { // Android: grava no cache e abre a folha de compartilhar do sistema
    const f = new File([item.blob], item.nome, { type: item.blob.type || 'image/png' });
    if (Net.nativo()) {
      const data = Net.paraBase64(new Uint8Array(await item.blob.arrayBuffer()));
      const g = await Net.chamarNativo('Filesystem', 'writeFile', { path: 'f1/' + item.nome, data, directory: 'CACHE', recursive: true });
      await Net.chamarNativo('Share', 'share', { title: item.nome, files: [g.uri] });
      return;
    }
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: item.nome }); return; }
    baixar(item);
  }
  function baixar(item) {
    const u = URL.createObjectURL(item.blob), a = el('a'); a.href = u; a.download = item.nome; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  function abrir(item) {
    cur = item; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(item.blob);
    $('#resImg').src = url; $('#resInfo').textContent = `${item.w}×${item.h} px · ${fmtTam(item.blob.size)}`; status('');
    $('#resN8n').hidden = !item.info; $('#folha').hidden = false; Nav.abrir(() => fechar(true));
  }
  function fechar(deHist) { if (!deHist) return Nav.fechar(); $('#folha').hidden = true; $('#resImg').removeAttribute('src'); if (url) URL.revokeObjectURL(url); url = null; cur = null; }
  function iniciar() {
    $$('#folha [data-fechar]').forEach((b) => (b.onclick = () => fechar(false)));
    $('#resShare').onclick = async () => { try { await compartilhar(cur); } catch (e) { if (!/cancel|abort/i.test(String(e && (e.message || e.name || e)))) status('Não consegui compartilhar: ' + limpaErro(e), 'erro'); } };
    $('#resSalvar').onclick = () => { baixar(cur); status('Arquivo baixado.', 'ok'); };
    $('#resN8n').onclick = async () => {
      const b = $('#resN8n'); b.disabled = true; status('Enviando pro n8n...');
      try { await Envio.imagem(cur.blob, cur.nome, cur.info); status('Enviado pro n8n.', 'ok'); } catch (e) { status(limpaErro(e), 'erro'); }
      b.disabled = false;
    };
  }
  return { iniciar, abrir, fechar };
})();

const Imagens = (() => {
  const MAX = 40; let urls = [];
  async function registrar({ template, blob, nome, w, h }) {
    const id = Date.now().toString(36);
    await DB.put('hist', id, { id, template: template.nome, tid: template.id, nome, w, h, blob, criado: Date.now() });
    const todos = (await DB.todos('hist')).sort((a, b) => b.valor.criado - a.valor.criado);
    for (const x of todos.slice(MAX)) await DB.del('hist', x.chave);
  }
  async function pintar() {
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
    const G = $('#gradeImg'); G.innerHTML = '';
    const lista = (await DB.todos('hist')).map((x) => x.valor).sort((a, b) => b.criado - a.criado);
    if (!lista.length) { G.append(el('p', 'nota', 'Nenhuma imagem ainda. Gere um post na aba Templates e ele aparece aqui.')); return; }
    for (const r of lista) {
      const u = URL.createObjectURL(r.blob); urls.push(u);
      const c = el('button', 'card'), m = el('div', 'mini'), im = el('img'); c.type = 'button'; im.src = u; im.alt = r.nome; im.loading = 'lazy'; m.append(im);
      c.append(m, el('div', 'nome', r.template)); c.append(el('small', 'nota', fmtHora(r.criado)));
      c.onclick = () => Folha.abrir({ blob: r.blob, nome: r.nome, w: r.w, h: r.h, info: { template: r.template, id: r.tid, tipo: 'IMG', pasta: '' } });
      let seg; c.oncontextmenu = (e) => e.preventDefault();
      c.addEventListener('pointerdown', () => { seg = setTimeout(async () => { seg = null; if (await perguntar({ titulo: 'Apagar esta imagem?', texto: r.nome, ok: 'Apagar' })) { await DB.del('hist', r.id); pintar(); } }, 700); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => c.addEventListener(ev, () => clearTimeout(seg)));
      G.append(c);
    }
  }
  return { registrar, pintar };
})();
