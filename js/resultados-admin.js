/*
  Painel de resultados (campeonato-simulador/resultados/admin/). Lê o CSV de
  ranking no navegador, mostra a prévia e envia só {name, ms} por categoria
  para POST /api/resultados. A senha é a mesma do painel da seletiva e fica
  na sessão do navegador (sessionStorage "sel-token").
*/
(() => {
  const API = "/api/resultados";
  const CATS = ["420R", "Academy"];
  const $ = (s) => document.querySelector(s);
  let token = "";
  try { token = sessionStorage.getItem("sel-token") || ""; } catch {}
  let lido = null;

  const tempo = (ms) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, "0")}`;
  const dataHora = (iso) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";

  function msg(el, texto, erro) {
    el.hidden = !texto;
    el.textContent = texto || "";
    el.classList.toggle("is-erro", !!erro);
  }

  // CSV com aspas opcionais; separador detectado na linha de cabeçalho.
  function lerCsv(texto) {
    texto = texto.replace(/^﻿/, "");
    const primeira = texto.split(/\r?\n/, 1)[0];
    const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ";" : ",";
    const linhas = [];
    let linha = [], campo = "", aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = "";
      } else campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter((l) => l.some((v) => v.trim()));
  }

  function paraMs(tempoMs, volta) {
    const n = Number(String(tempoMs || "").trim());
    if (n > 0) return Math.round(n);
    const m = String(volta || "").trim().replace(",", ".").match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
    return m ? Math.round((Number(m[1] || 0) * 60 + Number(m[2])) * 1000) : 0;
  }

  function categoria(v) {
    const s = String(v || "").toLowerCase();
    if (s.includes("420")) return "420R";
    if (s.includes("academy")) return "Academy";
    return null;
  }

  function interpretar(texto) {
    const [cab, ...linhas] = lerCsv(texto);
    if (!cab) throw new Error("Arquivo vazio.");
    const col = Object.fromEntries(cab.map((c, i) => [c.trim().toLowerCase(), i]));
    if (col.categoria == null || col.piloto == null || (col.tempo_ms == null && col.melhor_volta == null)) {
      throw new Error("O CSV precisa das colunas categoria, piloto e tempo_ms (ou melhor_volta).");
    }
    const out = { categorias: { "420R": [], Academy: [] }, semTempo: { "420R": 0, Academy: 0 }, ignoradas: 0 };
    linhas.forEach((l) => {
      const cat = categoria(l[col.categoria]);
      const name = String(l[col.piloto] || "").trim();
      if (!cat || !name) { out.ignoradas++; return; }
      const ms = paraMs(l[col.tempo_ms], l[col.melhor_volta]);
      if (ms > 0) out.categorias[cat].push({ name, ms });
      else out.semTempo[cat]++;
    });
    CATS.forEach((c) => out.categorias[c].sort((a, b) => a.ms - b.ms));
    return out;
  }

  function tabela(titulo, lista) {
    const wrap = document.createElement("div");
    wrap.className = "adm__tabela-wrap";
    const h = document.createElement("h3");
    h.textContent = titulo;
    const t = document.createElement("table");
    const cab = t.createTHead().insertRow();
    ["Pos.", "Piloto", "Tempo"].forEach((x) => { const th = document.createElement("th"); th.textContent = x; cab.appendChild(th); });
    const corpo = t.createTBody();
    lista.forEach((p, i) => {
      const tr = corpo.insertRow();
      [String(p.pos || i + 1), p.name, tempo(p.ms)].forEach((x) => { tr.insertCell().textContent = x; });
    });
    if (!lista.length) corpo.insertRow().insertCell().textContent = "Nenhum piloto com tempo.";
    wrap.append(h, t);
    return wrap;
  }

  function previa() {
    const alvo = $("[data-previa]");
    alvo.replaceChildren();
    $("[data-publicar]").disabled = !lido;
    if (!lido) return;
    CATS.forEach((c) => alvo.appendChild(tabela(`Caterham ${c} · ${lido.categorias[c].length} com tempo`, lido.categorias[c])));
    const notas = CATS.filter((c) => lido.semTempo[c]).map((c) => `${c}: ${lido.semTempo[c]} sem tempo (não aparecem no site)`);
    if (lido.ignoradas) notas.push(`${lido.ignoradas} linha(s) sem categoria ou piloto ignorada(s)`);
    msg($("[data-previa-msg]"), notas.length ? `Prévia. ${notas.join(" · ")}.` : "Prévia do que será publicado.");
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

  function renderPublicado(fases) {
    const t = $("[data-publicado]");
    t.replaceChildren();
    const cab = t.createTHead().insertRow();
    ["Fase", "Atualizado", "Arquivo", "420R", "Academy", ""].forEach((x) => { const th = document.createElement("th"); th.textContent = x; cab.appendChild(th); });
    const corpo = t.createTBody();
    ["seletiva", "campeonato"].forEach((f) => {
      const d = fases[f];
      const tr = corpo.insertRow();
      tr.insertCell().textContent = f === "seletiva" ? "Seletiva" : "Campeonato";
      if (!d) { const td = tr.insertCell(); td.colSpan = 5; td.textContent = "Não publicado."; return; }
      [dataHora(d.atualizado_em), d.arquivo || "—", String(d.categorias["420R"].length), String(d.categorias.Academy.length)]
        .forEach((x) => { tr.insertCell().textContent = x; });
      const b = document.createElement("button");
      b.type = "button";
      b.className = "adm__mini";
      b.textContent = "Tirar do ar";
      b.addEventListener("click", async () => {
        if (!window.confirm(`Tirar o ranking da fase ${f} do site?`)) return;
        try { renderPublicado((await api("POST", { fase: f, action: "delete" })).fases); } catch (e) { alert(e.message); }
      });
      tr.insertCell().appendChild(b);
    });
  }

  async function entrar() {
    // GET é público; a senha é conferida no primeiro envio. Aqui só abre o painel.
    const r = await fetch(API, { headers: { Accept: "application/json" }, cache: "no-store" });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error("Não foi possível carregar os resultados publicados.");
    $("[data-login]").hidden = true;
    $("[data-painel]").hidden = false;
    renderPublicado(d.fases || {});
  }

  $("[data-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    token = e.target.token.value.trim();
    try { sessionStorage.setItem("sel-token", token); } catch {}
    try { await entrar(); } catch (err) { msg($("[data-login-msg]"), err.message, true); }
  });

  $("[data-envio] [name=arquivo]").addEventListener("change", async (e) => {
    lido = null;
    msg($("[data-envio-msg]"), "");
    const arq = e.target.files[0];
    if (arq) {
      try { lido = interpretar(await arq.text()); } catch (err) { msg($("[data-previa-msg]"), err.message, true); }
    }
    previa();
  });

  $("[data-envio]").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!lido) return;
    const f = e.target;
    const botao = $("[data-publicar]");
    botao.disabled = true;
    msg($("[data-envio-msg]"), "Publicando…");
    try {
      const d = await api("POST", { fase: f.fase.value, file_name: f.arquivo.files[0].name, categorias: lido.categorias });
      msg($("[data-envio-msg]"), "Publicado. O site atualiza em até 1 minuto.");
      renderPublicado(d.fases);
    } catch (err) {
      msg($("[data-envio-msg]"), err.message, true);
    } finally {
      botao.disabled = false;
    }
  });

  if (token) entrar().catch(() => {});
})();
