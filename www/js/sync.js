// Sync com o servidor (ou com o PC): baixa os templates (e, do PC, também cores, recortes, extras e fontes).
// É a mesma lógica do programa de PC (main.js: ADAPT, conectar, sincronizar): nunca apaga nada e nunca perde uma edição sua.
const Sync = (() => {
  const hash = async (t) => {
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
    catch (e) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return 'd' + h.toString(16) + t.length; } // sem crypto (página sem https): hash simples
  };
  const lerLista = async (base, h, prefixo) => JSON.parse(await Net.texto(base + '/templates', { headers: h })).map((t) => ({ id: t.id, gid: prefixo + t.id, nome: t.name || t.id, atualizadoEm: String(t.updated_at) }));

  // Três tipos de fonte, iguais aos do programa de PC
  const ADAPT = {
    n8n: { // Template Manager do n8n (porta 3004): código de acesso
      entrar: async (base, c) => ({ 'x-access-code': c.codigo || '' }),
      listar: (base, h) => lerLista(base, h, 'n8n:'),
      baixar: (base, h, id) => Net.texto(base + '/templates/' + encodeURIComponent(id) + '/html', { headers: h }),
      enviar: (base, h, id, nome, html) => subir(base, h, id, html),
    },
    store: { // Template Store, o site (porta 3001): usuário e senha
      entrar: async (base, c) => ({ Authorization: 'Bearer ' + JSON.parse(await Net.texto(base + '/auth/login', { metodo: 'POST', json: { username: c.usuario, password: c.senha } })).token }),
      listar: (base, h) => lerLista(base, h, 'store:'),
      baixar: (base, h, id) => Net.texto(base + '/templates/' + encodeURIComponent(id), { headers: h }),
      enviar: (base, h, id, nome, html) => subir(base, h, id, html, { name: nome, description: '' }),
    },
    pc: { // o programa de PC com "Compartilhar" ligado (porta 3790): só leitura, código de acesso
      entrar: async (base, c) => ({ 'x-access-code': c.codigo || '' }),
      listar: (base, h) => lerLista(base, h, ''),
      baixar: (base, h, id) => Net.texto(base + '/templates/' + encodeURIComponent(id) + '/html', { headers: h }),
    },
  };
  async function subir(base, h, id, html, extra = {}) { // envia um template (multipart) pro servidor
    const mp = Net.multipart({ template_id: id, ...extra }, [{ campo: 'template', nome: id + '.html', tipo: 'text/html', bytes: new TextEncoder().encode(html) }]);
    const t = await Net.texto(base + '/templates/upload', { metodo: 'POST', headers: h, corpo: mp, tempo: 20000 });
    try { return JSON.parse(t).id || id; } catch (e) { return id; }
  }

  const enderecos = (txt) => String(txt || '').split(/[\s,;]+/).filter(Boolean).map((e) => (/^https?:\/\//.test(e) ? e : 'http://' + e).replace(/\/+$/, ''));
  async function conectar() { // tenta cada endereço da lista até um responder
    const c = await DB.cfg('sync', {});
    if (!c.tipo || !c.enderecos) throw new Error('Configure o servidor na aba Config > Sync com o servidor.');
    const ad = ADAPT[c.tipo]; let ultimo;
    for (const base of enderecos(c.enderecos)) {
      try { const h = await ad.entrar(base, c); return { tipo: c.tipo, ad, base, h, lista: await ad.listar(base, h) }; } catch (err) { ultimo = err; }
    }
    throw new Error('Não consegui conectar. ' + Net.msgErro(ultimo));
  }

  const nomeUnico = (nome, usados) => { let n = String(nome || 'template').replace(/\.html$/i, '').trim() || 'template', i = 2; const b = n; while (usados.has(n.toLowerCase())) n = `${b} ${i++}`; usados.add(n.toLowerCase()); return n; };

  async function sincronizar() {
    const { tipo, ad, base, h, lista } = await conectar();
    const r = { base, novos: [], atualizados: [], conflitos: [], removidos: [], iguais: 0 };
    const regs = await DB.todos('tpl'), porId = new Map(regs.map((x) => [x.chave, x.valor])), usados = new Set(regs.map((x) => String(x.valor.nome).toLowerCase()));
    for (const t of lista) {
      const loc = porId.get(t.gid);
      if (loc && loc.remotoEm === t.atualizadoEm) { r.iguais++; continue; }
      const html = await ad.baixar(base, h, t.id), hRemoto = await hash(html);
      if (!loc) { const nome = nomeUnico(t.nome, usados); await DB.put('tpl', t.gid, { id: t.gid, nome, html, remotoEm: t.atualizadoEm, remotoHash: hRemoto, criado: Date.now() }); r.novos.push(nome); continue; }
      const hLocal = await hash(loc.html), hUltimo = loc.remotoHash;
      if (hLocal === hRemoto) { await DB.put('tpl', t.gid, { ...loc, remotoEm: t.atualizadoEm, remotoHash: hRemoto }); r.iguais++; continue; }
      if (hUltimo && hLocal !== hUltimo) { // você editou aqui
        if (hRemoto === hUltimo) r.iguais++; else r.conflitos.push(loc.nome);
        continue;
      }
      await DB.put('tpl', t.gid, { ...loc, anterior: loc.html, html, remotoEm: t.atualizadoEm, remotoHash: hRemoto }); r.atualizados.push(loc.nome); // guarda a versão antiga em "anterior"
    }
    const noServidor = new Set(lista.map((t) => t.gid));
    if (tipo !== 'pc') for (const [id, v] of porId) if (id.startsWith(tipo + ':') && !noServidor.has(id)) r.removidos.push(v.nome);
    if (tipo === 'pc') { try { r.predef = await sincronizarPredef(base, h); } catch (e) { r.predef = { erro: Net.msgErro(e) }; } }
    await DB.setCfg('ultimoSync', Date.now());
    return r;
  }

  // do PC: cores, recortes, extras e fontes que faltam aqui (nunca apaga nada)
  async function sincronizarPredef(base, h) {
    const r = { cores: 0, arquivos: 0 }, rem = JSON.parse(await Net.texto(base + '/predef', { headers: h }));
    const locais = await DB.cfg('cores', CORES_PADRAO), tem = new Set(locais.map((c) => c.toLowerCase())), novas = (rem.cores || []).filter((c) => !tem.has(String(c).toLowerCase()));
    if (novas.length) { await DB.setCfg('cores', [...locais, ...novas]); r.cores = novas.length; }
    for (const [tipo, pre] of [['recortes', 'rec'], ['extras', 'ext'], ['fontes', 'fonte']]) {
      for (const f of rem[tipo] || []) {
        const arq = String(f.arquivo).split(/[\\/]/).pop(), chave = pre + ':' + arq;
        if (await DB.get('blobs', chave)) continue;
        const resp = await Net.pedir(`${base}/predef/${tipo}/${encodeURIComponent(arq)}`, { headers: h, binario: true, tempo: 30000 });
        if (!resp.ok) continue;
        const ext = (arq.match(/\.(\w+)$/) || [])[1] || '', tipoMime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[ext.toLowerCase()] || 'application/octet-stream';
        await DB.put('blobs', chave, { arquivo: arq, blob: new Blob([resp.bytes], { type: tipoMime }) }); r.arquivos++;
        if (tipo === 'fontes') Recursos.invalidarFontes();
      }
    }
    return r;
  }

  async function contarNovidades() { // só conta o que mudou no servidor (aviso ao abrir o app)
    const { lista } = await conectar(), porId = new Map((await DB.todos('tpl')).map((x) => [x.chave, x.valor]));
    let novos = 0, atualizados = 0;
    for (const t of lista) { const l = porId.get(t.gid); if (!l) novos++; else if (l.remotoEm && l.remotoEm !== t.atualizadoEm) atualizados++; }
    return { novos, atualizados };
  }

  // manda um template feito/editado no celular para o servidor (n8n ou Template Store). Nunca sobrescreve outro template do servidor.
  async function enviarTemplate(reg) {
    const c = await DB.cfg('sync', {}); if (c.tipo === 'pc') throw new Error('Essa fonte é só leitura. Para enviar, use o servidor (n8n ou Template Store) em Config.');
    const { tipo, ad, base, h, lista } = await conectar();
    const prefixo = tipo + ':'; let idServ = reg.id.startsWith(prefixo) ? reg.id.slice(prefixo.length) : null;
    if (idServ && !lista.some((t) => t.id === idServ)) idServ = null;
    const slug = String(reg.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'template';
    let id = idServ || slug, i = 2; if (!idServ) while (lista.some((t) => t.id === id)) id = slug + '-' + i++;
    const novoId = await ad.enviar(base, h, id, reg.nome, reg.html);
    return { id: novoId, gid: prefixo + novoId, base };
  }

  return { ADAPT, conectar, sincronizar, sincronizarPredef, contarNovidades, enviarTemplate, hash, enderecos };
})();
