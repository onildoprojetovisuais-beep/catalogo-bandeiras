/**
 * Scuderia Bandeiras Esports Cup 2026 — recebe as inscrições do site, grava na
 * planilha e manda ao piloto o e-mail de confirmação com a senha do servidor iRacing.
 *
 * COMO ATIVAR (uma vez):
 *  1. Suba doc/campeonato-simulador/Inscricoes-Esports-Cup-2026.xlsx no Google Drive e
 *     salve como Planilha Google (já vem com a aba "Inscrições", cabeçalhos e resumo).
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
 *
 * E-MAIL DE CONFIRMAÇÃO
 *  - Sai da conta Google que fez a implantação ("Executar como: Eu"). Para sair do
 *    e-mail do Workspace, a implantação precisa ser feita logado nessa conta.
 *  - Texto, assunto e senha ficam no bloco EMAIL abaixo. Depois de editar:
 *    Implantar → Gerir implementações → lápis → Versão: Nova versão → Implementar
 *    (a URL /exec continua a mesma).
 *  - Se o envio falhar, a inscrição continua gravada e o motivo aparece na coluna
 *    "Observações internas" da linha.
 */
const SECRET = "TROQUE-POR-UM-TEXTO-ALEATORIO";
const ABA = "Inscrições";

const EMAIL = {
  ENVIAR: true,
  REMETENTE: "Scuderia Bandeiras E-sports Cup",
  RESPONDER_PARA: "", // vazio = responde para a própria conta que envia
  ASSUNTO: "Inscrição confirmada · Scuderia Bandeiras E-sports Cup",
  SENHA_IRACING: "bandeiras",
  DISCORD: "https://discord.gg/KfryC8GQF",
  // {nome}, {categoria}, {id}, {senha} e {discord} são trocados pelos dados do piloto.
  // Uma linha em branco separa parágrafos. Linha que começa com "## " vira título em negrito.
  // Texto aprovado em 16/10/2026.
  TEXTO: [
    "Olá, piloto!",
    "",
    "A contagem regressiva começou!",
    "",
    "Você está inscrito na Scuderia Bandeiras E-sports Cup e queremos que esteja pronto para acelerar e fazer parte dessa experiência com a gente!",
    "",
    "Para se preparar, confira abaixo as informações importantes para sua participação:",
    "",
    "## Acesso à competição",
    "",
    "O acesso será realizado pela plataforma iRacing, utilizando a senha de acesso: {senha}",
    "",
    "## Dúvidas e suporte",
    "",
    "Tem alguma dúvida sobre a competição? Nosso Discord será o ponto de encontro para orientações, informações e suporte aos participantes.",
    "",
    "Acesse aqui: {discord}",
    "",
    "Fique atento aos nossos comunicados para não perder nenhuma informação importante sobre a competição.",
    "",
    "Prepare seu equipamento, ajuste seu setup e esteja pronto para acelerar. Nos vemos na pista (:",
    "",
    "Scuderia Bandeiras E-sports Cup",
    "Sua próxima disputa começa aqui!",
  ].join("\n"),
};

const COLUNAS = [
  "registration_id", "submitted_at", "category", "full_name", "birth_date", "email", "whatsapp",
  "city", "state", "iracing_name", "iracing_customer_id", "irating_declared", "discord",
  "sim_team", "instagram", "academy_fallback_420r", "real_motorsport_experience",
  "experience_description", "accept_regulation", "truth_declaration", "qualifying_ack",
  "grid_ack", "privacy_consent", "marketing_consent", "source", "championship",
];
// Status (27) e Observações internas (28) vêm logo depois das colunas acima.
const COL_OBSERVACOES = COLUNAS.length + 2;

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    if (dados.secret !== SECRET) return json_({ ok: false, error: "unauthorized" });

    let aba, linha;
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const planilha = SpreadsheetApp.getActiveSpreadsheet();
      aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
      if (aba.getLastRow() === 0) {
        aba.appendRow(COLUNAS);
        aba.setFrozenRows(1);
      }
      // prefixo ' impede que a planilha interprete texto do usuário como fórmula
      aba.appendRow(COLUNAS.map(function (c) {
        const v = dados[c] === undefined || dados[c] === null ? "" : dados[c];
        return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v;
      }));
      linha = aba.getLastRow();
    } finally {
      lock.releaseLock();
    }

    // A inscrição já está salva: falha no e-mail não pode virar erro para o piloto.
    if (EMAIL.ENVIAR) {
      try {
        enviarConfirmacao_(dados);
      } catch (errEmail) {
        aba.getRange(linha, COL_OBSERVACOES).setValue("Falha ao enviar e-mail: " + String(errEmail));
      }
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function enviarConfirmacao_(dados) {
  const primeiroNome = String(dados.full_name || "").trim().split(/\s+/)[0] || "piloto";
  const texto = EMAIL.TEXTO
    .replace(/\{nome\}/g, primeiroNome)
    .replace(/\{categoria\}/g, dados.category || "")
    .replace(/\{id\}/g, dados.registration_id || "")
    .replace(/\{senha\}/g, EMAIL.SENHA_IRACING)
    .replace(/\{discord\}/g, EMAIL.DISCORD);

  const html = texto.split(/\n\s*\n/).map(function (p) {
    if (p.indexOf("## ") === 0) return "<p><strong>" + escapar_(p.slice(3)) + "</strong></p>";
    const seguro = escapar_(p).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
    return "<p>" + seguro.replace(/\n/g, "<br>") + "</p>";
  }).join("");

  const opcoes = {
    to: dados.email,
    subject: EMAIL.ASSUNTO,
    body: texto.replace(/^## /gm, ""),
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">' + html + "</div>",
    name: EMAIL.REMETENTE,
  };
  if (EMAIL.RESPONDER_PARA) opcoes.replyTo = EMAIL.RESPONDER_PARA;
  MailApp.sendEmail(opcoes);
}

function escapar_(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Rode esta função uma vez pelo editor (Executar → testarEmail) para autorizar o envio
// de e-mails e ver como a mensagem chega na sua própria caixa.
function testarEmail() {
  enviarConfirmacao_({
    full_name: "Piloto Teste",
    category: "Academy",
    registration_id: "CEB26-TESTE",
    email: Session.getActiveUser().getEmail(),
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
