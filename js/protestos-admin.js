/*
  Painel de protestos (campeonato-simulador/protestos/admin/). Mesma senha dos
  outros painéis, guardada na sessão do navegador (sessionStorage "sel-token").
*/
(() => {
  const API = "/api/protestos-admin";
  const $ = (s) => document.querySelector(s);
  const DESPORTIVO = { recebido: "Recebido", em_analise: "Em análise", procedente: "Procedente", improcedente: "Improcedente", nao_admitido: "Não admitido" };
  const FINANCEIRO = { comprovante_pendente: "Comprovante a conferir", pagamento_verificado: "Pagamento verificado", devolucao_pendente: "Devolução pendente", devolvido: "Taxa devolvida" };
  const BATERIA = { 1: "Bateria 1 (Heat)", 2: "Bateria 2 (Feature)" };
  let token = "";
  try { token = sessionStorage.getItem("sel-token") || ""; } catch {}

  const dataHora = (iso) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
  const tamanho = (b) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : "");

  async function api(metodo, corpo) {
    const r = await fetch(API, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    let dados = {};
    try { dados = await r.json(); } catch {}
    if (r.status === 401) {
      try { sessionStorage.removeItem("sel-token"); } catch {}
      $("[data-painel]").hidden = true;
      $("[data-login]").hidden = false;
    }
    if (!r.ok || !dados.ok) throw new Error(dados.error || `Erro ${r.status}`);
    return dados;
  }

  function el(tag, props = {}, ...filhos) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...filhos.filter((f) => f != null));
    return e;
  }

  function seletor(opcoes, valor) {
    const s = el("select");
    Object.entries(opcoes).forEach(([v, t]) => s.append(el("option", { value: v, textContent: t, selected: v === valor })));
    return s;
  }

  function botaoArquivo(p, kind, rotulo, meta) {
    if (!meta || meta.deleted_at) return el("span", { className: "ajuda", textContent: `${rotulo}: apagado` });
    return el("button", {
      type: "button", className: "adm__mini", textContent: `Baixar ${rotulo} ${tamanho(meta.size)}`,
      onclick: async () => {
        try { window.location.href = (await api("POST", { action: "link", id: p.protest_id, kind })).url; } catch (e) { alert(e.message); }
      },
    });
  }

  function cartao(p) {
    const dl = el("dl");
    [
      ["Enviado", dataHora(p.submitted_at)],
      ["Piloto", `${p.full_name}\n${p.email} · Customer ID ${p.iracing_customer_id}`],
      ["Categoria", p.category],
      ["Etapa", `Etapa ${p.stage} · ${BATERIA[p.heat] || p.heat} · volta ${p.lap}`],
      ["Envolvidos", p.cars_involved],
      ["Incidente", p.incident_description],
      ["Fundamento", p.protest_basis],
      ["Taxa", `R$ ${Number(p.fee || 0).toFixed(2).replace(".", ",")} · txid ${p.pix_txid}`],
    ].forEach(([t, d]) => dl.append(el("dt", { textContent: t }), el("dd", { textContent: d })));

    const desportivo = seletor(DESPORTIVO, p.sporting_status);
    const financeiro = seletor(FINANCEIRO, p.payment_status);
    const notas = el("textarea", { value: p.admin_notes || "", maxLength: 5000 });
    const msg = el("p", { className: "adm__msg", hidden: true });

    const salvar = el("button", {
      type: "button", className: "btn btn--lima", textContent: "Salvar",
      onclick: async () => {
        try {
          await api("POST", { action: "update", id: p.protest_id, sporting_status: desportivo.value, payment_status: financeiro.value, admin_notes: notas.value });
          msg.hidden = false; msg.classList.remove("is-erro"); msg.textContent = "Salvo.";
        } catch (e) { msg.hidden = false; msg.classList.add("is-erro"); msg.textContent = e.message; }
      },
    });

    const apagarReplay = p.replay && !p.replay.deleted_at
      ? el("button", {
          type: "button", className: "adm__mini", textContent: "Apagar replay (libera espaço)",
          onclick: async () => {
            if (!window.confirm(`Apagar o replay do protesto ${p.protest_id}? Faça isso só depois do julgamento.`)) return;
            try { await api("POST", { action: "delete_replay", id: p.protest_id }); carregar(); } catch (e) { alert(e.message); }
          },
        })
      : null;

    return el("article", { className: "adm__card" },
      el("h3", { textContent: `${p.protest_id} · ${DESPORTIVO[p.sporting_status] || p.sporting_status} · ${FINANCEIRO[p.payment_status] || p.payment_status}` }),
      dl,
      el("div", { className: "adm__acoes" }, botaoArquivo(p, "replay", "replay", p.replay), botaoArquivo(p, "comprovante", "comprovante", p.payment_receipt), apagarReplay),
      el("div", { className: "adm__linha" },
        el("label", {}, "Situação desportiva", desportivo),
        el("label", {}, "Situação financeira", financeiro)),
      el("label", {}, "Anotações internas", notas),
      el("div", { className: "adm__acoes" }, salvar),
      msg);
  }

  async function carregar() {
    const d = await api("GET");
    $("[data-login]").hidden = true;
    $("[data-painel]").hidden = false;
    $("[data-contagem]").textContent = `${d.protestos.length} protesto(s)`;
    $("[data-lista]").replaceChildren(...(d.protestos.length ? d.protestos.map(cartao) : [el("p", { textContent: "Nenhum protesto enviado ainda." })]));
  }

  $("[data-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    token = e.target.token.value.trim();
    try { sessionStorage.setItem("sel-token", token); } catch {}
    try { await carregar(); } catch (err) {
      const m = $("[data-login-msg]");
      m.hidden = false;
      m.textContent = err.message;
    }
  });
  $("[data-atualizar]").addEventListener("click", () => carregar().catch((e) => alert(e.message)));
  if (token) carregar().catch(() => {});
})();
