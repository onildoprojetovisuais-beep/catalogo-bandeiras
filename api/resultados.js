// /api/resultados — rankings publicados em campeonato-simulador/resultados/.
//
//   GET                                     público: rankings da seletiva e do campeonato
//   POST {fase, file_name, categorias}      painel (Authorization: Bearer <CATERHAM_ADMIN_TOKEN>):
//                                           publica o ranking de uma fase, substituindo o anterior.
//                                           categorias = { Academy: [{name, ms}], "420R": [...] }
//   POST {fase, action:"delete"}            painel: tira a fase do ar
//
// O CSV é lido no navegador (js/resultados-admin.js) e só nome do piloto e tempo
// chegam aqui. E-mail, Customer ID e demais colunas nunca saem do computador.
// Armazenamento: Vercel Blob privado, resultados/state.json.

const { get, put } = require("@vercel/blob");
const { CATEGORIAS, autorizado } = require("./_seletiva");

const FASES = ["seletiva", "campeonato"];
const VAGAS = { seletiva: 30 };
const STATE_PATH = "resultados/state.json";
const MAX_PILOTOS = 300;

async function lerEstado() {
  const r = await get(STATE_PATH, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return {};
  return (await new Response(r.stream).json()) || {};
}

async function salvarEstado(estado) {
  await put(STATE_PATH, JSON.stringify(estado), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

// Ordena por tempo e recalcula posição e diferença: não depende da coluna posicao do CSV.
function limparCategoria(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .slice(0, MAX_PILOTOS)
    .map((p, i) => ({
      name: String((p && p.name) || "").trim().slice(0, 80),
      ms: Math.round(Number(p && p.ms)),
      ordem: i,
    }))
    .filter((p) => p.name && p.ms > 0 && p.ms < 3600000)
    .sort((a, b) => a.ms - b.ms || a.ordem - b.ordem)
    .map((p, i, todos) => ({ pos: i + 1, name: p.name, ms: p.ms, gap: p.ms - todos[0].ms }));
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const estado = await lerEstado();
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
      res.status(200).json({ ok: true, fases: estado });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ ok: false });
      return;
    }
    if (!autorizado(req)) {
      res.status(401).json({ ok: false, error: "Senha do painel incorreta." });
      return;
    }

    const b = req.body && typeof req.body === "object" ? req.body : {};
    if (!FASES.includes(b.fase)) return erro(res, "Escolha a fase (seletiva ou campeonato).");
    const estado = await lerEstado();

    if (b.action === "delete") {
      delete estado[b.fase];
      await salvarEstado(estado);
      res.status(200).json({ ok: true, fases: estado });
      return;
    }

    const categorias = {};
    let total = 0;
    for (const cat of CATEGORIAS) {
      categorias[cat] = limparCategoria(b.categorias && b.categorias[cat]);
      total += categorias[cat].length;
    }
    if (!total) return erro(res, "Nenhum piloto com tempo encontrado no arquivo.");

    estado[b.fase] = {
      atualizado_em: new Date().toISOString(),
      arquivo: String(b.file_name || "").slice(0, 120),
      vagas: VAGAS[b.fase] || null,
      categorias,
    };
    await salvarEstado(estado);
    res.status(200).json({ ok: true, fases: estado });
  } catch (err) {
    console.error("[resultados]", err && err.message);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ ok: false, error: "Erro no servidor. Tente de novo em instantes." });
  }
};

function erro(res, mensagem) {
  res.status(400).json({ ok: false, error: mensagem });
}
