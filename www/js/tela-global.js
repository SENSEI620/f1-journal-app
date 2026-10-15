// Postagem Global: manda uma imagem ou vídeo + legenda pro n8n (mesmo fluxo do programa de PC).
const Global = (() => {
  let arq = null, urlPrev = null, enviando = false;
  const status = (m, cls) => { const s = $('#gStatus'); s.textContent = m || ''; s.className = 'status ' + (cls || ''); };
  const validar = () => { $('#gEnviar').disabled = enviando || !arq; };
  function mostrar() {
    const S = $('#gSolta'); if (urlPrev) URL.revokeObjectURL(urlPrev); urlPrev = null; S.innerHTML = '';
    if (!arq) { S.className = 'solta'; S.append(el('div', '', '<b>Toque para escolher</b><br><small>imagem ou vídeo (até 60 MB)</small>')); validar(); return; }
    urlPrev = URL.createObjectURL(arq); S.className = 'solta tem';
    const i = Envio.infoArquivo(arq), m = el(i.midia === 'video' ? 'video' : 'img'); m.src = urlPrev; if (i.midia === 'video') { m.controls = true; m.muted = true; m.playsInline = true; }
    const info = el('div', 'info', `<span><b></b><small>${fmtTam(arq.size)}</small></span>`), tr = el('button', 'botao vidro', 'Trocar'); tr.type = 'button';
    info.querySelector('b').textContent = arq.name; tr.onclick = (e) => { e.stopPropagation(); escolher(); }; info.append(tr); S.append(m, info); validar();
  }
  async function escolher() {
    const f = await escolherArquivo($('#arqGlobal'), 'image/*,video/*'); if (!f) return;
    try { Envio.infoArquivo(f); arq = f; status(''); } catch (e) { toast(limpaErro(e), 'erro', 5000); return; } mostrar();
  }
  async function ultimos() {
    const U = $('#gUltimos'); U.innerHTML = ''; const l = (await DB.cfg('enviosGeral', [])).slice(-8).reverse(); if (!l.length) return;
    U.append(el('h3', 'sub', 'Últimos envios'));
    l.forEach((x) => { const d = el('div', 'envio'); d.append(el('b', '', x.midia === 'video' ? '🎬 ' + x.nome : '🖼 ' + x.nome), el('small', 'nota', fmtHora(x.quando) + (x.legenda ? ' · ' + x.legenda.slice(0, 60) : ''))); U.append(d); });
  }
  function iniciar() {
    $('#gSolta').onclick = (e) => { if (!arq) escolher(); };
    const leg = $('#gLeg'); leg.oninput = () => { $('#gCont').textContent = leg.value.length + ' / 2200'; $('#gCont').classList.toggle('erro', leg.value.length > 2200); };
    $('#btGlobalCfg').onclick = () => { App.irPara('config'); Config.abrirSecao('n8n'); };
    $('#gEnviar').onclick = async () => {
      if (!arq || enviando) return; if (leg.value.length > 2200 && !(await perguntar({ titulo: 'Legenda passa de 2200', texto: 'O Instagram corta acima disso. Enviar mesmo assim?', ok: 'Enviar' }))) return;
      enviando = true; validar(); status('Enviando... pode demorar com vídeo.');
      try { await Envio.global(arq, leg.value); status('Enviado!', 'ok'); arq = null; leg.value = ''; leg.oninput(); mostrar(); ultimos(); } catch (e) { status(limpaErro(e), 'erro'); }
      enviando = false; validar();
    };
    mostrar(); ultimos();
  }
  return { iniciar, ultimos };
})();
