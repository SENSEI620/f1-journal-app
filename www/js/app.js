// Arranque do app e navegação entre as abas.
const App = (() => {
  let atual = 'templates';
  function irPara(p) {
    atual = p; $$('.pagina').forEach((s) => (s.hidden = s.id !== 'p-' + p)); $$('#abas button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    if (p === 'imagens') Imagens.pintar(); if (p === 'global') Global.ultimos(); window.scrollTo(0, 0);
  }
  async function iniciar() {
    try { if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !Net.nativo()) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
    Nav.iniciar && Nav.iniciar();
    $$('#abas button').forEach((b) => (b.onclick = () => irPara(b.dataset.p)));
    Rico.setCoresNomes(await DB.cfg('coresNomes', {}));
    Folha.iniciar(); Criar.iniciar(); Global.iniciar(); await Config.montar(); await Templ.iniciar(); await Templ.carregar(); irPara('templates');
    // aviso silencioso de novidades no servidor
    try { const s = await DB.cfg('sync', {}); if (s.tipo && s.enderecos) { const n = await Promise.race([Sync.contarNovidades(), dormir(6000).then(() => null)]); if (n && (n.novos || n.atualizados)) toast(`${n.novos} novo(s) e ${n.atualizados} atualizado(s) no servidor. Toque em sincronizar.`, '', 5000); } } catch (e) {}
  }
  window.addEventListener('DOMContentLoaded', () => iniciar().catch((e) => { console.error(e); toast('Erro ao abrir o app: ' + limpaErro(e), 'erro', 8000); }));
  return { irPara, iniciar };
})();
