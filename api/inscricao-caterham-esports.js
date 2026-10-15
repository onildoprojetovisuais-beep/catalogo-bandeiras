// Vercel Function (Node.js, zero-config). Recebe a inscrição do Caterham
// Esports Brasil (campeonato-simulador/, js/caterham-esports.js), valida no
// servidor e repassa para a planilha via Web App do Google Apps Script — o
// mesmo padrão do site Caterham (Projeto-caterham/.../google-apps-script).
// O navegador nunca fala direto com o Google: a CSP do site só libera
// connect-src 'self', e a URL/segredo ficam fora do frontend.
//
// Env vars no projeto Vercel (passo a passo em
// doc/campeonato-simulador/apps-script-inscricoes.gs):
//   CATERHAM_ESPORTS_WEBHOOK_URL    — URL /exec do Web App do Apps Script
//   CATERHAM_ESPORTS_WEBHOOK_SECRET — texto aleatório, igual ao SECRET do script
//
// Sem a URL configurada responde 503 e a página avisa que as inscrições ainda
// não estão recebendo envios (nunca finge sucesso).

const crypto = require("crypto");

const TIMEOUT_MS = 10000;
const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const OBRIGATORIOS = [
  "full_name", "birth_date", "email", "whatsapp", "city", "state",
  "iracing_name", "discord", "category", "real_motorsport_experience",
];
const DECLARACOES = ["accept_regulation", "truth_declaration", "qualifying_ack", "grid_ack", "privacy_consent"];
const LIMITES = {
  full_name: 120, email: 160, whatsapp: 30, city: 80, iracing_name: 80, discord: 60,
  sim_team: 80, instagram: 60, experience_description: 1200,
};

const texto = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function validar(b) {
  const erros = [];
  for (const k of OBRIGATORIOS) if (!texto(b[k])) erros.push(k);
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email))) erros.push("email");
  if (b.state && !UFS.has(String(b.state))) erros.push("state");
  if (b.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.birth_date))) erros.push("birth_date");
  if (!["Academy", "420R"].includes(b.category)) erros.push("category");
  if (b.category === "Academy" && !["Sim", "Não"].includes(b.academy_fallback_420r)) erros.push("academy_fallback_420r");
  if (!["Sim", "Não"].includes(b.real_motorsport_experience)) erros.push("real_motorsport_experience");
  if (b.real_motorsport_experience === "Sim" && !texto(b.experience_description)) erros.push("experience_description");
  const id = Number(b.iracing_customer_id);
  if (!Number.isInteger(id) || id < 1) erros.push("iracing_customer_id");
  const ir = Number(b.irating_declared);
  if (!Number.isInteger(ir) || ir < 0 || ir > 15000) erros.push("irating_declared");
  for (const k of DECLARACOES) if (b[k] !== "Sim") erros.push(k);
  return [...new Set(erros)];
}

function normalizar(b) {
  const out = {};
  for (const [k, max] of Object.entries(LIMITES)) out[k] = texto(b[k], max);
  return {
    ...out,
    birth_date: texto(b.birth_date, 10),
    state: texto(b.state, 2),
    category: b.category,
    academy_fallback_420r: b.category === "Academy" ? b.academy_fallback_420r : "",
    real_motorsport_experience: b.real_motorsport_experience,
    iracing_customer_id: Number(b.iracing_customer_id),
    irating_declared: Number(b.irating_declared),
    accept_regulation: "Sim",
    truth_declaration: "Sim",
    qualifying_ack: "Sim",
    grid_ack: "Sim",
    privacy_consent: "Sim",
    marketing_consent: b.marketing_consent === "Sim" ? "Sim" : "Não",
    source: "site_scuderia_bandeiras",
    championship: "Scuderia Bandeiras Esports Cup 2026",
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.website) {
    // honeypot preenchido: responde como sucesso e descarta
    res.status(200).json({ ok: true });
    return;
  }

  const erros = validar(body);
  if (erros.length) {
    res.status(400).json({ ok: false, fields: erros });
    return;
  }

  const url = process.env.CATERHAM_ESPORTS_WEBHOOK_URL;
  if (!url) {
    res.status(503).json({ ok: false, configured: false });
    return;
  }

  const registration_id = "CEB26-" + crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  const dados = {
    ...normalizar(body),
    registration_id,
    submitted_at: new Date().toISOString(),
    secret: process.env.CATERHAM_ESPORTS_WEBHOOK_SECRET || "",
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // Apps Script responde com 302 para o resultado; fetch segue o redirect.
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(dados),
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    const resposta = await r.json().catch(() => ({}));
    if (!r.ok || resposta.ok === false) throw new Error("planilha recusou: " + r.status);
    res.status(200).json({ ok: true, registration_id });
  } catch (err) {
    console.error("[inscricao-caterham-esports]", err && err.message);
    res.status(502).json({ ok: false });
  }
};
