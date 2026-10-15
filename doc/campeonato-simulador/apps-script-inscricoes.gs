/**
 * Caterham Esports Brasil 2026 — recebe as inscrições do site e grava numa planilha.
 *
 * COMO ATIVAR (uma vez):
 *  1. Crie uma Planilha Google (ex.: "Caterham Esports Brasil 2026 — Inscrições").
 *  2. Extensões → Apps Script. Apague o conteúdo e cole este arquivo inteiro.
 *  3. Troque SECRET abaixo por um texto aleatório longo (ex.: 32 letras/números).
 *  4. Implantar → Nova implantação → tipo "App da Web".
 *       Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
 *     Copie a URL que termina em /exec.
 *  5. No projeto da Vercel (Settings → Environment Variables), crie:
 *       CATERHAM_ESPORTS_WEBHOOK_URL    = a URL /exec
 *       CATERHAM_ESPORTS_WEBHOOK_SECRET = o mesmo SECRET do passo 3
 *     e faça um novo deploy.
 *  Até o passo 5, o formulário do site responde "as inscrições ainda não estão
 *  recebendo envios" (nada é perdido em silêncio).
 */
const SECRET = "TROQUE-POR-UM-TEXTO-ALEATORIO";
const ABA = "Inscrições";

const COLUNAS = [
  "registration_id", "submitted_at", "category", "full_name", "birth_date", "email", "whatsapp",
  "city", "state", "iracing_name", "iracing_customer_id", "irating_declared", "discord",
  "sim_team", "instagram", "academy_fallback_420r", "real_motorsport_experience",
  "experience_description", "accept_regulation", "truth_declaration", "qualifying_ack",
  "grid_ack", "privacy_consent", "marketing_consent", "source", "championship",
];

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    if (dados.secret !== SECRET) return json_({ ok: false, error: "unauthorized" });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const planilha = SpreadsheetApp.getActiveSpreadsheet();
      const aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
      if (aba.getLastRow() === 0) {
        aba.appendRow(COLUNAS);
        aba.setFrozenRows(1);
      }
      // prefixo ' impede que a planilha interprete texto do usuário como fórmula
      aba.appendRow(COLUNAS.map(function (c) {
        const v = dados[c] === undefined || dados[c] === null ? "" : dados[c];
        return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v;
      }));
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
