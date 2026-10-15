// Peças comuns da interface: atalhos do DOM, aviso rápido, perguntas, menu flutuante e botão Voltar do Android.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const svg = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const limpaErro = (e) => String((e && e.message) || e || 'Erro desconhecido').replace(/^.*Error: /, '');
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hashRapido = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + '.' + t.length; };
const fmtTam = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const fmtHora = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

let toastTimer;
function toast(texto, tipo, ms = 3200) {
  const t = $('#toast'); t.textContent = texto; t.className = tipo || ''; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}

// Pergunta/aviso simples. Devolve: true/false (confirmação) ou o texto digitado (se input) ou null (cancelou).
function perguntar({ titulo, texto = '', input = false, valor = '', ok = 'OK', cancelar = 'Cancelar', semCancelar = false }) {
  return new Promise((resolve) => {
    const d = $('#dlg'), i = $('#dlgInp');
    $('#dlgTit').textContent = titulo; $('#dlgTxt').textContent = texto; $('#dlgTxt').hidden = !texto;
    i.hidden = !input; i.value = valor; $('#dlgSim').textContent = ok; $('#dlgNao').textContent = cancelar; $('#dlgNao').hidden = semCancelar;
    const fim = () => { d.removeEventListener('close', fim); resolve(d.returnValue === 'sim' ? (input ? i.value.trim() : true) : input ? null : false); };
    d.addEventListener('close', fim); d.returnValue = ''; d.showModal(); if (input) setTimeout(() => { i.focus(); i.select(); }, 50);
  });
}

// Menu flutuante perto de um botão: itens = [{ texto, fazer, perigo }]
function menuCard(ancora, itens) {
  $$('.menu-card').forEach((m) => m.remove());
  const m = el('div', 'menu-card'), r = ancora.getBoundingClientRect();
  itens.forEach((it) => { const b = el('button', it.perigo ? 'perigo' : '', it.texto); b.onclick = (e) => { e.stopPropagation(); m.remove(); it.fazer(); }; m.append(b); });
  document.body.append(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + h + 12 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', function fora(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', fora); } }), 0);
}

// Botão Voltar do Android: cada tela "por cima" (criar, resultado) empilha um passo no histórico; Voltar fecha a de cima.
const Nav = (() => {
  const pilha = [];
  addEventListener('popstate', () => { const f = pilha.pop(); if (f) f(); });
  return {
    abrir(aoFechar) { pilha.push(aoFechar); history.pushState({ n: pilha.length }, ''); },
    fechar() { if (pilha.length) history.back(); }, // dispara o popstate acima
    tem: () => pilha.length > 0,
  };
})();

// Lê um arquivo escolhido pelo usuário (input type=file)
function escolherArquivo(input, tipos) {
  return new Promise((ok) => {
    input.accept = tipos || input.accept; input.value = '';
    input.onchange = () => ok(input.files && input.files[0] ? input.files[0] : null);
    input.oncancel = () => ok(null);
    input.click();
  });
}
