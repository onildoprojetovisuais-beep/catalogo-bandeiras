/*
  Painel da seletiva (campeonato-simulador/seletiva/admin/). A senha fica só
  na sessão do navegador (sessionStorage) e vai no cabeçalho Authorization.
*/
(() => {
  const API = "/api/seletiva-admin";
  const $ = (s) => document.querySelector(s);
  let token = "";
  try { token = sessionStorage.getItem("sel-token") || ""; } catch {}

  const tempo = (v) => {
    const ms = Math.round(v / 10);
    return `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, "0")}`;
  };
  const dataHora = (iso) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";

  function msg(el, texto, erro) {
    el.hidden = !texto;
    el.textContent = texto || "";
    el.classList.toggle("is-erro", !!erro);
  }

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

  function linhaTabela(tabela, celulas, tag = "td") {
    const tr = (tag === "th" ? tabela.createTHead() : tabela.tBodies[0] || tabela.createTBody()).insertRow();
    celulas.forEach((c) => {
      const el = document.createElement(tag);
      if (c instanceof Node) el.appendChild(c); else el.textContent = c;
      tr.appendChild(el);
    });
  }

  function botao(texto, aoClicar) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "adm__mini";
    b.textContent = texto;
    b.addEventListener("click", aoClicar);
    return b;
  }

  function render(d) {
    const imp = $("[data-imports]");
    imp.replaceChildren();
    if (!d.imports.length) {
      linhaTabela(imp, ["Nenhum arquivo enviado ainda."]);
    } else {
      linhaTabela(imp, ["Enviado", "Categoria", "Evento", "Sessões usadas", "Pilotos", ""], "th");
      d.imports.forEach((i) => {
        linhaTabela(imp, [
          dataHora(i.uploaded_at),
          i.category,
          `${i.file_name || "—"}\n#${i.subsession_id || "?"} · ${i.track || ""}\nCarros: ${(i.carros || []).join(", ")}`,
          (i.sessoes_usadas || []).join(", "),
          String(i.pilotos),
          botao("Remover", async () => {
            if (!window.confirm(`Remover o arquivo ${i.file_name || i.id} do ranking?`)) return;
            try { render(await api("POST", { action: "delete_import", id: i.id })); } catch (e) { alert(e.message); }
          }),
        ]);
      });
    }

    const exc = $("[data-exclusoes]");
    exc.replaceChildren();
    if (d.exclusions.length) {
      linhaTabela(exc, ["Categoria", "Customer ID", "Motivo", ""], "th");
      d.exclusions.forEach((e) => {
        linhaTabela(exc, [e.category, String(e.cust_id), e.reason || "—", botao("Reincluir", async () => {
          try { render(await api("POST", { action: "include", category: e.category, cust_id: e.cust_id })); } catch (er) { alert(er.message); }
        })]);
      });
    }

    const rk = $("[data-ranking]");
    rk.replaceChildren();
    Object.entries(d.ranking.categorias).forEach(([cat, lista]) => {
      const bloco = document.createElement("div");
      const h = document.createElement("h3");
      h.textContent = `${cat} (${lista.length})`;
      const t = document.createElement("table");
      if (lista.length) {
        linhaTabela(t, ["Pos.", "Piloto", "Cust. ID", "Volta"], "th");
        lista.forEach((p) => linhaTabela(t, [String(p.pos), p.name, String(p.cust_id), tempo(p.lap)]));
      } else {
        linhaTabela(t, ["Sem tempos."]);
      }
      bloco.append(h, t);
      rk.appendChild(bloco);
    });
  }

  async function entrar() {
    const d = await api("GET");
    try { sessionStorage.setItem("sel-token", token); } catch {}
    $("[data-login]").hidden = true;
    $("[data-painel]").hidden = false;
    render(d);
  }

  $("[data-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    token = e.target.token.value.trim();
    try { await entrar(); } catch (er) { msg($("[data-login-msg]"), er.message, true); }
  });

  $("[data-envio]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const el = $("[data-envio-msg]");
    const arquivo = f.arquivo.files[0];
    if (!arquivo) return;
    const btn = f.querySelector("button");
    btn.disabled = true;
    msg(el, "Enviando…");
    try {
      const d = await api("POST", {
        action: "import",
        category: f.category.value,
        mode: f.mode.value,
        file_name: arquivo.name,
        content: await arquivo.text(),
      });
      const i = d.importado;
      msg(el, `${d.substituiu ? "Evento atualizado" : "Arquivo importado"}: ${i.pilotos} pilotos com volta válida (${i.category}).\nSessões usadas: ${(i.sessoes_usadas || []).join(", ")}\nCarros no arquivo: ${(i.carros || []).join(", ")}`);
      f.arquivo.value = "";
      render(d);
    } catch (er) {
      msg(el, er.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  $("[data-exclusao]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const el = $("[data-exclusao-msg]");
    try {
      render(await api("POST", { action: "exclude", category: f.category.value, cust_id: Number(f.cust_id.value), reason: f.reason.value }));
      msg(el, "Piloto excluído do ranking.");
      f.reset();
    } catch (er) {
      msg(el, er.message, true);
    }
  });

  if (token) entrar().catch(() => {});
})();
