// Banco do app (IndexedDB): templates, fotos, configurações e histórico. Tudo fica só no celular.
// Lojas: kv (configurações), tpl (templates), blobs (fotos/fontes/miniaturas), hist (imagens geradas).
const DB = (() => {
  const STORES = ['kv', 'tpl', 'blobs', 'hist'];
  let aberto = null;
  const abrir = () => aberto || (aberto = new Promise((ok, falha) => {
    const r = indexedDB.open('f1studio', 1);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  }));
  const rodar = (loja, modo, fn) => abrir().then((db) => new Promise((ok, falha) => {
    const t = db.transaction(loja, modo); let res;
    try { res = fn(t.objectStore(loja)); } catch (e) { return falha(e); }
    t.oncomplete = () => ok(res && 'result' in res ? res.result : res);
    t.onerror = t.onabort = () => falha(t.error);
  }));
  const api = {
    get: (loja, chave) => rodar(loja, 'readonly', (o) => o.get(chave)),
    put: (loja, chave, valor) => rodar(loja, 'readwrite', (o) => o.put(valor, chave)),
    del: (loja, chave) => rodar(loja, 'readwrite', (o) => o.delete(chave)),
    keys: (loja) => rodar(loja, 'readonly', (o) => o.getAllKeys()),
    limpar: (loja) => rodar(loja, 'readwrite', (o) => o.clear()),
    // todos os registros da loja: [{ chave, valor }]
    todos: (loja) => abrir().then((db) => new Promise((ok, falha) => {
      const t = db.transaction(loja, 'readonly'), s = t.objectStore(loja), ks = s.getAllKeys(), vs = s.getAll();
      t.oncomplete = () => ok(ks.result.map((k, i) => ({ chave: k, valor: vs.result[i] })));
      t.onerror = () => falha(t.error);
    })),
    // configurações simples (guardadas na loja kv)
    cfg: async (chave, padrao) => { const v = await api.get('kv', chave); return v === undefined ? padrao : v; },
    setCfg: (chave, valor) => api.put('kv', chave, valor),
  };
  return api;
})();

const CORES_PADRAO = ['#e24b4a', '#ef9f27', '#d85a30', '#378add', '#f8b500', '#22d3ee']; // mesma paleta inicial do programa de PC
const APP_VERSAO = '1.0.1';
