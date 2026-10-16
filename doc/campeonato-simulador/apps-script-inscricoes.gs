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
 *  - Sai da conta Google que fez a implantação ("Executar como: Eu"). Conta definida
 *    em 16/10/2026: ativacoes@scuderiabandeiras.com — implantar logado nela.
 *  - Ao colar uma versão nova deste arquivo, MANTENHA a linha SECRET do script atual.
 *  - Quem se inscreveu antes do e-mail estar ligado: rode listarPendentes (confere) e
 *    depois enviarParaJaInscritos (envia). A coluna 29 "E-mail de confirmação" marca
 *    quem já recebeu; rodar de novo não duplica.
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
// Coluna 29: data/hora em que o e-mail de confirmação saiu (vazia = ainda não recebeu).
const COL_EMAIL_ENVIADO = COLUNAS.length + 3;
const TITULO_EMAIL_ENVIADO = "E-mail de confirmação";

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
        marcarEnviado_(aba, linha);
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

function marcarEnviado_(aba, linha) {
  if (!aba.getRange(1, COL_EMAIL_ENVIADO).getValue()) {
    aba.getRange(1, COL_EMAIL_ENVIADO).setValue(TITULO_EMAIL_ENVIADO);
  }
  const quando = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  aba.getRange(linha, COL_EMAIL_ENVIADO).setValue("Enviado em " + quando);
}

// Inscritos que ainda não receberam o e-mail: linha com e-mail, sem marca na coluna 29,
// fora a linha de teste. Um envio por endereço (inscrição repetida não recebe duas vezes).
function pendentes_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
  const valores = aba.getDataRange().getValues();
  const iEmail = COLUNAS.indexOf("email");
  const iNome = COLUNAS.indexOf("full_name");
  const vistos = {};
  const lista = [];
  for (let r = 1; r < valores.length; r++) {
    const linha = valores[r];
    const email = String(linha[iEmail] || "").trim().toLowerCase();
    const nome = String(linha[iNome] || "");
    const jaEnviado = String(linha[COL_EMAIL_ENVIADO - 1] || "") !== "";
    if (!email || /TESTE - APAGAR/i.test(nome)) continue;
    if (jaEnviado) { vistos[email] = true; continue; }
    lista.push({ linha: r + 1, email: email, nome: nome, duplicado: !!vistos[email], dados: linha });
    vistos[email] = true;
  }
  return { aba: aba, lista: lista };
}

// PASSO 1 — confira antes: Executar → listarPendentes e veja o "Registro de execução".
function listarPendentes() {
  const p = pendentes_().lista;
  Logger.log(p.length + " inscrição(ões) sem e-mail de confirmação:");
  p.forEach(function (x) {
    Logger.log("linha " + x.linha + " · " + x.nome + " · " + x.email + (x.duplicado ? " (endereço repetido, não recebe de novo)" : ""));
  });
}

// PASSO 2 — envia para quem se inscreveu antes do e-mail estar ligado. Pode rodar de novo
// sem risco: quem já tem a marca na coluna 29 é pulado.
function enviarParaJaInscritos() {
  const p = pendentes_();
  let enviados = 0, falhas = 0;
  p.lista.forEach(function (x) {
    if (x.duplicado) {
      p.aba.getRange(x.linha, COL_EMAIL_ENVIADO).setValue("Não reenviado (e-mail repetido)");
      return;
    }
    const dados = {};
    COLUNAS.forEach(function (c, i) { dados[c] = x.dados[i]; });
    dados.email = x.email;
    try {
      enviarConfirmacao_(dados);
      marcarEnviado_(p.aba, x.linha);
      enviados++;
    } catch (err) {
      p.aba.getRange(x.linha, COL_OBSERVACOES).setValue("Falha ao enviar e-mail: " + String(err));
      falhas++;
    }
  });
  Logger.log("Enviados: " + enviados + " · Falhas: " + falhas + " (motivo na coluna Observações internas)");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
