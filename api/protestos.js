// /api/protestos — formulário público de protestos (campeonato-simulador/protestos/).
//
//   GET                                   novo protocolo + Pix Copia e Cola + QR Code (SVG)
//   POST {type:"blob.generate-client-token", ...}
//                                         token para o navegador enviar replay/comprovante direto
//                                         ao Blob (o .rpy passa do limite de 4,5 MB das Functions)
//   POST {action:"submit", protest_id, ...campos, receipt_ext}
//                                         confere se os dois arquivos chegaram e grava o protesto

const QRCode = require("qrcode");
const { handleUpload } = require("@vercel/blob/client");
const {
  PIX, CATEGORIAS, ID_RE, novoId, arquivoPermitido, pixCopiaECola, lerProtesto, salvarProtesto, existe,
} = require("./_protestos");

const linha = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const texto = (v, max) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const id = novoId();
      const pix = pixCopiaECola(id);
      const svg = await QRCode.toString(pix, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      res.status(200).json({
        ok: true,
        protest_id: id,
        valor: PIX.valor,
        recebedor: PIX.nome,
        pix,
        qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ ok: false });
      return;
    }

    const b = req.body && typeof req.body === "object" ? req.body : {};

    if (typeof b.type === "string" && b.type.startsWith("blob.")) {
      const resposta = await handleUpload({
        body: b,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          const regra = arquivoPermitido(pathname);
          if (!regra) throw new Error("Arquivo não permitido.");
          if (await existe(`protestos/${regra.id}/protesto.json`)) throw new Error("Protesto já enviado.");
          return {
            maximumSizeInBytes: regra.max,
            allowedContentTypes: regra.tipos,
            addRandomSuffix: false,
            allowOverwrite: true,
            validUntil: Date.now() + 60 * 60 * 1000,
          };
        },
      });
      res.status(200).json(resposta);
      return;
    }

    if (b.action !== "submit") return erro(res, "Ação desconhecida.");
    if (linha(b.website, 10)) return erro(res, "Envio inválido.");

    const id = linha(b.protest_id, 30).toUpperCase();
    if (!ID_RE.test(id)) return erro(res, "Protocolo inválido. Atualize a página e tente de novo.");
    const p = {
      protest_id: id,
      submitted_at: new Date().toISOString(),
      full_name: linha(b.full_name, 150),
      email: linha(b.email, 180).toLowerCase(),
      iracing_customer_id: linha(b.iracing_customer_id, 12).replace(/\D/g, ""),
      category: CATEGORIAS.includes(b.category) ? b.category : "",
      stage: Number(b.stage),
      heat: Number(b.heat),
      lap: Number(b.lap),
      cars_involved: texto(b.cars_involved, 1000),
      incident_description: texto(b.incident_description, 5000),
      protest_basis: texto(b.protest_basis, 5000),
    };
    if (!p.full_name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email) || !p.iracing_customer_id || !p.category) {
      return erro(res, "Preencha corretamente nome, e-mail, Customer ID e categoria.");
    }
    if (!(p.stage >= 1 && p.stage <= 5) || ![1, 2].includes(p.heat) || !(Number.isInteger(p.lap) && p.lap >= 1)) {
      return erro(res, "Informe etapa, bateria e volta válidas.");
    }
    if (p.cars_involved.length < 2 || p.incident_description.length < 10 || p.protest_basis.length < 5) {
      return erro(res, "Preencha pilotos envolvidos, descrição do incidente e fundamento do protesto.");
    }
    if (b.deadline_ack !== true) return erro(res, "Confirme a ciência do prazo de 24 horas.");

    const ext = ["pdf", "png", "jpg", "webp"].includes(b.receipt_ext) ? b.receipt_ext : "";
    if (!ext) return erro(res, "Comprovante deve ser PDF, PNG, JPG ou WEBP.");
    if (await lerProtesto(id)) return erro(res, "Este protocolo já foi usado. Atualize a página e envie de novo.");

    const [replay, comprovante] = await Promise.all([
      existe(`protestos/${id}/replay.rpy`),
      existe(`protestos/${id}/comprovante.${ext}`),
    ]);
    if (!replay) return erro(res, "O replay .rpy não chegou. Tente enviar de novo.");
    if (!comprovante) return erro(res, "O comprovante não chegou. Tente enviar de novo.");

    Object.assign(p, {
      fee: PIX.valor,
      pix_txid: id,
      sporting_status: "recebido",
      payment_status: "comprovante_pendente",
      admin_notes: "",
      replay: { pathname: replay.pathname, size: replay.size, original_name: linha(b.replay_name, 200) },
      payment_receipt: { pathname: comprovante.pathname, size: comprovante.size, original_name: linha(b.receipt_name, 200) },
    });
    await salvarProtesto(p);
    res.status(200).json({ ok: true, protest_id: id });
  } catch (err) {
    console.error("[protestos]", err && err.message);
    // Erros do onBeforeGenerateToken são do usuário; o resto é falha do servidor.
    if (/não permitido|já enviado/.test(String(err && err.message))) return erro(res, err.message);
    res.status(500).json({ ok: false, error: "Erro no servidor. Tente de novo em instantes." });
  }
};

function erro(res, mensagem) {
  res.status(400).json({ ok: false, error: mensagem });
}
