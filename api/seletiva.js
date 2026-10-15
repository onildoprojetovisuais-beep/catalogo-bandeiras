// GET /api/seletiva — ranking público da Fase Classificatória (ver api/_seletiva.js).
// A CDN da Vercel guarda a resposta por 60s: depois de um envio no painel, o
// ranking novo aparece no site em até 1 minuto.

const { lerEstado, montarRanking } = require("./_seletiva");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false });
    return;
  }
  try {
    const ranking = montarRanking(await lerEstado());
    for (const cat of Object.keys(ranking.categorias)) {
      ranking.categorias[cat] = ranking.categorias[cat].map(({ cust_id, ...publico }) => publico);
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ ok: true, ...ranking });
  } catch (err) {
    console.error("[seletiva]", err && err.message);
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ ok: false });
  }
};
