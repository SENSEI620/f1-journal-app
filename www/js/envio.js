// Envio para o n8n: (1) imagem pronta de um template e (2) Postagem Global (imagem ou vídeo + legenda).
// Os campos são os mesmos do programa de PC (main.js: enviarN8n e postarGeral), então os fluxos do n8n funcionam sem mudar nada.
const Envio = (() => {
  const EXT_IMG = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']), EXT_VIDEO = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv']);
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' };
  const MAX_VIDEO = 60 * 1048576; // o motor de rede do app manda o arquivo em base64 (memória do celular): vídeo grande fica para uma versão com envio nativo
  const extDe = (nome) => (String(nome).match(/\.(\w+)$/) || [])[1]?.toLowerCase() || '';

  async function webhook() {
    const n = await DB.cfg("n8n", {}), urls = String(n.urls || "").split(/[\s,;]+/).filter(Boolean);
    return { urls, token: n.token || '' };
  }
  async function bytesDe(blob) { return new Uint8Array(await blob.arrayBuffer()); }

  // tenta cada endereço do webhook até um aceitar
  async function postar(urls, token, campos, arquivo, tempo) {
    let ultimo;
    for (const url of urls) {
      try {
        const mp = Net.multipart(campos, [arquivo]);
        const r = await Net.pedir(url, { metodo: 'POST', headers: token ? { 'x-token': token } : {}, corpo: mp, tempo });
        if (!r.ok) throw new Error(`${r.status} ${String(r.texto).slice(0, 120)}`);
        return { url, resposta: String(r.texto).slice(0, 300), quando: Date.now() };
      } catch (err) { ultimo = err; }
    }
    throw new Error('Não consegui enviar. ' + Net.msgErro(ultimo));
  }

  // imagem gerada de um template. info (opcional): { template, id, tipo: 'IMG', pasta }
  async function imagem(blob, nomeArquivo, info) {
    const { urls, token } = await webhook();
    if (!urls.length) throw new Error('Configure o webhook em Config > Enviar pro n8n.');
    const ext = extDe(nomeArquivo) || 'png', campos = { origem: 'F1 Journal Studio App ' + APP_VERSAO, formato: ext };
    if (info && info.template) Object.assign(campos, { template: String(info.template), template_tipo: info.tipo === 'MOV' ? 'MOV' : 'IMG', template_pasta: String(info.pasta || ''), template_id: String(info.id || '') });
    return postar(urls, token, campos, { campo: 'imagem', nome: nomeArquivo, tipo: MIME[ext] || 'image/png', bytes: await bytesDe(blob) }, 30000);
  }

  // Postagem Global: arquivo (File ou Blob com .name) + legenda
  function infoArquivo(f) {
    const nome = f.name || 'arquivo', ext = extDe(nome) || (f.type || '').split('/')[1] || '';
    const midia = EXT_IMG.has(ext) || /^image\//.test(f.type || '') ? 'imagem' : EXT_VIDEO.has(ext) || /^video\//.test(f.type || '') ? 'video' : '';
    if (!midia) throw new Error('Esse arquivo não serve. Use imagem (PNG, JPG, WEBP, GIF) ou vídeo (MP4, MOV, M4V, WEBM, MKV).');
    if (f.size < 100) throw new Error('O arquivo está vazio ou incompleto.');
    if (midia === 'video' && f.size > MAX_VIDEO) throw new Error('Vídeo grande demais para o app por enquanto (máximo ' + Math.round(MAX_VIDEO / 1048576) + ' MB). Corte ou comprima antes.');
    return { nome, ext: EXT_IMG.has(ext) || EXT_VIDEO.has(ext) ? ext : midia === 'imagem' ? 'jpg' : 'mp4', midia, tamanho: f.size };
  }
  async function global(f, legenda) {
    const { urls, token } = await webhook();
    if (!urls.length) throw new Error('Configure o webhook (engrenagem desta tela ou Config > Enviar pro n8n).');
    const i = infoArquivo(f), texto = String(legenda || '').replace(/\r\n/g, '\n').slice(0, 5000);
    const campos = { legenda: texto, tipo: 'geral', id_postagem: 'geral', midia: i.midia, nome_arquivo: i.nome, formato: i.ext, origem: 'F1 Journal Studio App ' + APP_VERSAO, quando: 'agora', agendar_em: '' };
    const r = await postar(urls, token, campos, { campo: 'arquivo', nome: i.nome, tipo: f.type || MIME[i.ext] || 'application/octet-stream', bytes: await bytesDe(f) }, 5 * 60 * 1000);
    const lista = await DB.cfg('enviosGeral', []); lista.push({ nome: i.nome, midia: i.midia, quando: r.quando, legenda: texto.slice(0, 300), url: r.url, tamanho: i.tamanho }); await DB.setCfg('enviosGeral', lista.slice(-100));
    return r;
  }
  return { imagem, global, infoArquivo, webhook, MAX_VIDEO };
})();
