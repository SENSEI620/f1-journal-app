// Rede. No app (Android) as chamadas passam pelo motor nativo do Capacitor: assim funcionam em http:// (o PC na rede de casa) e sem o bloqueio de CORS.
// No navegador (PWA / testes) usa o fetch normal. O mesmo código vale para os dois.
const Net = (() => {
  const nativo = () => !!(window.Capacitor && typeof window.Capacitor.nativePromise === 'function' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const chamarNativo = (plugin, metodo, opcoes) => window.Capacitor.nativePromise(plugin, metodo, opcoes);

  const paraBase64 = (bytes) => { // Uint8Array -> base64 (em pedaços, para não estourar a pilha)
    let s = ''; const T = 0x8000;
    for (let i = 0; i < bytes.length; i += T) s += String.fromCharCode.apply(null, bytes.subarray(i, i + T));
    return btoa(s);
  };
  const deBase64 = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

  const corrida = (promessa, ms) => { // limite de tempo para o que não tem cancelamento próprio
    let t; const fim = new Promise((_, no) => { t = setTimeout(() => no(Object.assign(new Error('O servidor não respondeu.'), { name: 'TimeoutError' })), ms); });
    return Promise.race([promessa, fim]).finally(() => clearTimeout(t));
  };

  // Monta o corpo multipart/form-data na mão (campos de texto + arquivos). Devolve { tipo, bytes }.
  // campos: { nome: 'valor' }; arquivos: [{ campo, nome, tipo, bytes (Uint8Array) }]
  const multipart = (campos, arquivos = []) => {
    const fronteira = '----f1studio' + Math.random().toString(16).slice(2) + Date.now().toString(16), enc = new TextEncoder(), partes = [];
    const esc = (s) => String(s).replace(/"/g, '%22').replace(/[\r\n]+/g, ' ');
    for (const [k, v] of Object.entries(campos || {})) partes.push(enc.encode(`--${fronteira}\r\nContent-Disposition: form-data; name="${esc(k)}"\r\n\r\n${String(v)}\r\n`));
    for (const a of arquivos) {
      partes.push(enc.encode(`--${fronteira}\r\nContent-Disposition: form-data; name="${esc(a.campo)}"; filename="${esc(a.nome)}"\r\nContent-Type: ${a.tipo || 'application/octet-stream'}\r\n\r\n`), a.bytes, enc.encode('\r\n'));
    }
    partes.push(enc.encode(`--${fronteira}--\r\n`));
    const total = partes.reduce((n, p) => n + p.length, 0), bytes = new Uint8Array(total); let pos = 0;
    for (const p of partes) { bytes.set(p, pos); pos += p.length; }
    return { tipo: 'multipart/form-data; boundary=' + fronteira, bytes };
  };

  // pedir(url, { metodo, headers, json, corpo: { tipo, bytes }, tempo, binario })
  // devolve { status, ok, texto, bytes (se binario), tipo (Content-Type) }
  async function pedir(url, { metodo = 'GET', headers = {}, json, corpo, tempo = 8000, binario = false } = {}) {
    headers = { ...headers };
    if (json !== undefined) headers['Content-Type'] = 'application/json';
    if (corpo) headers['Content-Type'] = corpo.tipo;
    if (nativo()) {
      const op = { url, method: metodo, headers, connectTimeout: tempo, readTimeout: tempo };
      if (json !== undefined) op.data = JSON.stringify(json);
      if (corpo) { op.data = paraBase64(corpo.bytes); op.dataType = 'file'; } // o motor nativo grava os bytes do base64 direto no corpo
      if (binario) op.responseType = 'blob'; // devolve base64
      const r = await corrida(chamarNativo('CapacitorHttp', 'request', op), tempo + 2000);
      let texto = '', bytes = null;
      if (binario) bytes = deBase64(String(r.data || ''));
      else texto = typeof r.data === 'string' ? r.data : JSON.stringify(r.data == null ? '' : r.data);
      const h = r.headers || {}, tipo = h['Content-Type'] || h['content-type'] || '';
      return { status: r.status, ok: r.status >= 200 && r.status < 300, texto, bytes, tipo };
    }
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), tempo);
    try {
      const r = await fetch(url, { method: metodo, headers, signal: ctl.signal, body: json !== undefined ? JSON.stringify(json) : corpo ? new Blob([corpo.bytes], { type: corpo.tipo }) : undefined });
      const tipo = r.headers.get('content-type') || '';
      if (binario) return { status: r.status, ok: r.ok, texto: '', bytes: new Uint8Array(await r.arrayBuffer()), tipo };
      return { status: r.status, ok: r.ok, texto: await r.text(), bytes: null, tipo };
    } finally { clearTimeout(t); }
  }

  // Erro em português simples
  function msgErro(e) {
    const m = String((e && e.message) || e || '');
    if ((e && e.name === 'TimeoutError') || (e && e.name === 'AbortError') || /timed? ?out/i.test(m)) return 'O servidor não respondeu. Você está na rede de casa? O endereço mudou?';
    if (/UnknownHost|Unable to resolve|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|Failed to fetch|NetworkError|Network request failed|Connection refused|No route to host|Cleartext/i.test(m)) return 'Sem conexão com o servidor. Você está na rede de casa (ou com internet)? O endereço está certo?';
    if (/^401/.test(m)) return 'Login ou código incorreto.';
    return m;
  }

  // Pede e já trata erro HTTP (devolve o texto). Mensagem: "401 texto do servidor"
  async function texto(url, op) {
    const r = await pedir(url, op);
    if (!r.ok) { let m = r.texto; try { m = JSON.parse(r.texto).error || r.texto; } catch (e) {} throw new Error(`${r.status} ${m}`.slice(0, 160)); }
    return r.texto;
  }

  return { nativo, chamarNativo, pedir, texto, multipart, msgErro, paraBase64, deBase64 };
})();
