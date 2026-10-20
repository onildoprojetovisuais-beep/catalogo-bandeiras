// Lógica compartilhada dos protestos da Scuderia Bandeiras Esports Cup 2026
// (Regulamento 4.3). Arquivo com "_" no nome: a Vercel não o publica como rota,
// só é importado por api/protestos.js e api/protestos-admin.js.
// Porta para a Vercel do módulo PHP em doc/campeonato-simulador/caterham-esports-modulos/protestos/.
//
// Armazenamento: Vercel Blob privado, uma pasta por protesto:
//   protestos/<id>/protesto.json     dados do formulário + situação (fonte da verdade)
//   protestos/<id>/replay.rpy        replay do iRacing, enviado direto do navegador
//   protestos/<id>/comprovante.<ext> comprovante do Pix, enviado direto do navegador
// Um arquivo por protesto: dois envios ao mesmo tempo nunca sobrescrevem um ao outro.

const crypto = require("crypto");
const { get, head, put, list } = require("@vercel/blob");

// Recebedor do Pix (Reg. 4.3.6: taxa de R$ 50,00). Chave CNPJ; cidade conforme o cadastro do CNPJ.
const PIX = {
  chave: process.env.CATERHAM_PROTEST_PIX_KEY || "17314483000100",
  nome: process.env.CATERHAM_PROTEST_PIX_NAME || "A51 MARKETING E EVENTOS LTDA",
  cidade: process.env.CATERHAM_PROTEST_PIX_CITY || "VOTORANTIM",
  valor: 50,
};

const MAX_REPLAY = 250 * 1024 * 1024;
const MAX_COMPROVANTE = 15 * 1024 * 1024;
const EXT_COMPROVANTE = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
const CATEGORIAS = ["Academy", "420R"];
const STATUS_DESPORTIVO = ["recebido", "em_analise", "procedente", "improcedente", "nao_admitido"];
const STATUS_FINANCEIRO = ["comprovante_pendente", "pagamento_verificado", "devolucao_pendente", "devolvido"];

const ID_RE = /^CESB\d{8}[A-HJ-NP-Z2-9]{6}$/;

function novoId() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let sufixo = "";
  for (const b of bytes) sufixo += alfabeto[b % alfabeto.length];
  const data = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CESB${data}${sufixo}`; // 18 caracteres, vira o txid do Pix
}

// Caminhos que o navegador pode enviar para o Blob. Qualquer outro é recusado.
function arquivoPermitido(pathname) {
  const m = /^protestos\/([A-Z0-9]+)\/(replay\.rpy|comprovante\.(pdf|png|jpg|webp))$/.exec(pathname || "");
  if (!m || !ID_RE.test(m[1])) return null;
  return m[2] === "replay.rpy"
    ? { id: m[1], tipo: "replay", max: MAX_REPLAY, tipos: undefined }
    : { id: m[1], tipo: "comprovante", max: MAX_COMPROVANTE, tipos: [EXT_COMPROVANTE[m[3]]] };
}

/* ---------------- Pix BR Code estático (manual do BR Code do Banco Central) ---------------- */
function tlv(id, valor) {
  if (valor.length > 99) throw new Error(`Campo Pix ${id} passa de 99 caracteres.`);
  return id + String(valor.length).padStart(2, "0") + valor;
}
function ascii(s, max) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .-]/g, "")
    .replace(/\s+/g, " ").trim().slice(0, max);
}
function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function pixCopiaECola(txid) {
  const payload =
    tlv("00", "01") +
    tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", PIX.chave)) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", PIX.valor.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", ascii(PIX.nome, 25)) +
    tlv("60", ascii(PIX.cidade, 15)) +
    tlv("62", tlv("05", txid)) +
    "6304";
  return payload + crc16(payload);
}

/* ---------------- Armazenamento ---------------- */
const caminhoDados = (id) => `protestos/${id}/protesto.json`;

async function lerProtesto(id) {
  const r = await get(caminhoDados(id), { access: "private", useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return new Response(r.stream).json();
}

async function salvarProtesto(p) {
  await put(caminhoDados(p.protest_id), JSON.stringify(p), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

async function existe(pathname) {
  try {
    return await head(pathname);
  } catch {
    return null;
  }
}

async function listarProtestos() {
  const caminhos = [];
  let cursor;
  do {
    const r = await list({ prefix: "protestos/", cursor, limit: 1000 });
    for (const b of r.blobs) if (b.pathname.endsWith("/protesto.json")) caminhos.push(b.pathname.split("/")[1]);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const todos = await Promise.all(caminhos.map((id) => lerProtesto(id).catch(() => null)));
  return todos.filter(Boolean).sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
}

module.exports = {
  PIX, CATEGORIAS, STATUS_DESPORTIVO, STATUS_FINANCEIRO, ID_RE,
  novoId, arquivoPermitido, pixCopiaECola, lerProtesto, salvarProtesto, existe, listarProtestos,
};
