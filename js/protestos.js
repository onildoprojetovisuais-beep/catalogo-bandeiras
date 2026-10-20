/*
  Protestos (campeonato-simulador/protestos/): busca o protocolo e o Pix em
  GET /api/protestos, envia replay e comprovante direto para o Blob privado
  (VercelBlob.upload, de js/vendor/) e grava o formulário em POST /api/protestos.
*/
(() => {
  const API = "/api/protestos";
  const MB = 1024 * 1024;
  const TIPOS_COMPROVANTE = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  const $ = (s) => document.querySelector(s);
  const form = $("#form-protesto");
  const alerta = $("#alerta");
  const botao = $("[data-enviar]");
  let protocolo = "";

  const extensao = (nome) => (String(nome).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";

  function avisar(texto) {
    alerta.hidden = !texto;
    alerta.textContent = texto || "";
    if (texto) alerta.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function progresso(texto, fracao) {
    $("[data-progresso]").hidden = texto == null;
    if (texto == null) return;
    $("[data-progresso-texto]").textContent = texto;
    $("[data-progresso-barra]").style.transform = `scaleX(${fracao || 0})`;
  }

  async function carregarPix() {
    try {
      const r = await fetch(API, { headers: { Accept: "application/json" }, cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error();
      protocolo = d.protest_id;
      $("[data-pix-qr]").src = d.qr;
      $("[data-pix-recebedor]").textContent = d.recebedor;
      $("[data-pix-id]").textContent = d.protest_id;
      $("[data-pix-codigo]").value = d.pix;
      $("[data-pix]").hidden = false;
      $("[data-pix-carregando]").hidden = true;
      botao.disabled = false;
    } catch {
      $("[data-pix-carregando]").textContent = "Não foi possível gerar o Pix agora. Atualize a página para tentar de novo.";
    }
  }

  $("[data-pix-copiar]").addEventListener("click", async (e) => {
    const campo = $("[data-pix-codigo]");
    try { await navigator.clipboard.writeText(campo.value); } catch { campo.select(); document.execCommand("copy"); }
    e.currentTarget.textContent = "Código copiado";
  });

  function validar() {
    form.classList.add("foi-enviado");
    const invalido = form.querySelector(":invalid");
    if (invalido) {
      invalido.focus();
      return "Preencha os campos obrigatórios marcados em vermelho.";
    }
    const replay = form.replay.files[0];
    const comprovante = form.receipt.files[0];
    if (extensao(replay.name) !== "rpy") return "O replay precisa ser o arquivo .rpy do iRacing.";
    if (replay.size > 250 * MB) return "O replay passa de 250 MB.";
    if (!TIPOS_COMPROVANTE[extensao(comprovante.name)]) return "O comprovante precisa ser PDF, PNG, JPG ou WEBP.";
    if (comprovante.size > 15 * MB) return "O comprovante passa de 15 MB.";
    return "";
  }

  async function enviarArquivo(caminho, arquivo, contentType, rotulo) {
    return window.VercelBlob.upload(caminho, arquivo, {
      access: "private",
      handleUploadUrl: API,
      contentType,
      multipart: arquivo.size > 20 * MB,
      onUploadProgress: ({ percentage }) => progresso(`${rotulo}… ${Math.round(percentage)}%`, percentage / 100),
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    avisar("");
    const problema = validar();
    if (problema) return avisar(problema);
    if (!protocolo || !window.VercelBlob) return avisar("A página não terminou de carregar. Atualize e tente de novo.");

    const replay = form.replay.files[0];
    const comprovante = form.receipt.files[0];
    let ext = extensao(comprovante.name);
    if (ext === "jpeg") ext = "jpg";

    botao.disabled = true;
    try {
      await enviarArquivo(`protestos/${protocolo}/replay.rpy`, replay, "application/octet-stream", "Enviando o replay");
      await enviarArquivo(`protestos/${protocolo}/comprovante.${ext}`, comprovante, TIPOS_COMPROVANTE[ext], "Enviando o comprovante");
      progresso("Registrando o protesto…", 1);

      const dados = Object.fromEntries(new FormData(form));
      delete dados.replay;
      delete dados.receipt;
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dados,
          action: "submit",
          protest_id: protocolo,
          deadline_ack: form.deadline_ack.checked,
          receipt_ext: ext,
          replay_name: replay.name,
          receipt_name: comprovante.name,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || "Não foi possível registrar o protesto.");

      form.hidden = true;
      progresso(null);
      $("[data-sucesso-id]").textContent = d.protest_id;
      const ok = $("[data-sucesso]");
      ok.hidden = false;
      ok.focus();
      ok.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      progresso(null);
      avisar(`${err.message || "Falha no envio."} Seus dados continuam no formulário: confira a conexão e envie de novo.`);
      botao.disabled = false;
    }
  });

  carregarPix();
})();
