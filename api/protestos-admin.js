// /api/protestos-admin — painel dos protestos (campeonato-simulador/protestos/admin/).
// Exige Authorization: Bearer <CATERHAM_ADMIN_TOKEN>.
//
//   GET                                          lista todos os protestos
//   POST {action:"update", id, sporting_status, payment_status, admin_notes}
//   POST {action:"link", id, kind:"replay"|"comprovante"}
//                                                link temporário (15 min) para baixar o arquivo privado
//   POST {action:"delete_replay", id}            apaga só o .rpy depois do julgamento (libera espaço)

const { del, issueSignedToken, presignUrl } = require("@vercel/blob");
const { autorizado } = require("./_seletiva");
const { STATUS_DESPORTIVO, STATUS_FINANCEIRO, ID_RE, lerProtesto, salvarProtesto, listarProtestos } = require("./_protestos");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (!autorizado(req)) {
    res.status(401).json({ ok: false, error: "Senha do painel incorreta." });
    return;
  }

  try {
    if (req.method === "GET") {
      res.status(200).json({ ok: true, protestos: await listarProtestos() });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ ok: false });
      return;
    }

    const b = req.body && typeof req.body === "object" ? req.body : {};
    const id = String(b.id || "");
    if (!ID_RE.test(id)) return erro(res, "Protesto inválido.");
    const p = await lerProtesto(id);
    if (!p) return erro(res, "Protesto não encontrado.");

    if (b.action === "update") {
      if (STATUS_DESPORTIVO.includes(b.sporting_status)) p.sporting_status = b.sporting_status;
      if (STATUS_FINANCEIRO.includes(b.payment_status)) p.payment_status = b.payment_status;
      if (typeof b.admin_notes === "string") p.admin_notes = b.admin_notes.slice(0, 5000);
      p.updated_at = new Date().toISOString();
      await salvarProtesto(p);
      res.status(200).json({ ok: true, protesto: p });
      return;
    }

    if (b.action === "link") {
      const arq = b.kind === "replay" ? p.replay : b.kind === "comprovante" ? p.payment_receipt : null;
      if (!arq || !arq.pathname || arq.deleted_at) return erro(res, "Arquivo indisponível.");
      const validUntil = Date.now() + 15 * 60 * 1000;
      const token = await issueSignedToken({ pathname: arq.pathname, operations: ["get"], validUntil });
      const { presignedUrl } = await presignUrl(token, { operation: "get", pathname: arq.pathname, access: "private", validUntil });
      res.status(200).json({ ok: true, url: presignedUrl });
      return;
    }

    if (b.action === "delete_replay") {
      if (p.replay && p.replay.pathname && !p.replay.deleted_at) {
        await del(p.replay.pathname);
        p.replay.deleted_at = new Date().toISOString();
        await salvarProtesto(p);
      }
      res.status(200).json({ ok: true, protesto: p });
      return;
    }

    erro(res, "Ação desconhecida.");
  } catch (err) {
    console.error("[protestos-admin]", err && err.message);
    res.status(500).json({ ok: false, error: "Erro no servidor. Tente de novo em instantes." });
  }
};

function erro(res, mensagem) {
  res.status(400).json({ ok: false, error: mensagem });
}
