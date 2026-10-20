/*
  Painel de resultados (campeonato-simulador/resultados/admin/). Lê o CSV no
  navegador, mostra a prévia e envia só o necessário para POST /api/resultados:
  - Seletiva: {name, ms} por categoria (ranking por tempo).
  - Campeonato: baterias {categoria, etapa, bateria, resultados:[{pos, name, status}]};
    os pontos são calculados no servidor (api/_campeonato.js).
  A senha é a mesma do painel da seletiva e fica na sessão do navegador
  (sessionStorage "sel-token").
*/
(() => {
  const API = "/api/resultados";
  const CATS = ["420R", "Academy"];
  const BATERIA = { 1: "Heat", 2: "Feature" };
  const $ = (s) => document.querySelector(s);
  let token = "";
  try { token = sessionStorage.getItem("sel-token") || ""; } catch {}
  let texto = "";
  let lido = null;

  const tempo = (ms) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, "0")}`;
  const dataHora = (iso) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";

  function msg(el, t, erro) {
    el.hidden = !t;
    el.textContent = t || "";
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

  function colunas(cab) {
    const norm = (s) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return Object.fromEntries(cab.map((c, i) => [norm(c), i]));
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

  function interpretarSeletiva(texto) {
    const [cab, ...linhas] = lerCsv(texto);
    if (!cab) throw new Error("Arquivo vazio.");
    const col = colunas(cab);
    if (col.categoria == null || col.piloto == null || (col.tempo_ms == null && col.melhor_volta == null)) {
      throw new Error("Para a seletiva, o CSV precisa das colunas categoria, piloto e tempo_ms (ou melhor_volta).");
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

  function bateria(v) {
    const s = String(v || "").toLowerCase();
    if (/feat|final|2/.test(s)) return 2;
    if (/heat|1/.test(s)) return 1;
    return 0;
  }

  function status(v) {
    const s = String(v || "").trim().toUpperCase();
    if (!s) return "";
    if (["DQ", "DSQ", "DESC", "DESCLASSIFICADO"].includes(s)) return "DQ";
    if (["NC", "DNF", "NAO CLASSIFICADO", "NÃO CLASSIFICADO"].includes(s)) return "NC";
    if (["ABS", "DNS", "AUSENTE"].includes(s)) return "ABS";
    return null;
  }

  function interpretarCampeonato(texto) {
    const [cab, ...linhas] = lerCsv(texto);
    if (!cab) throw new Error("Arquivo vazio.");
    const col = colunas(cab);
    const faltam = ["categoria", "etapa", "bateria", "posicao", "piloto"].filter((c) => col[c] == null);
    if (faltam.length) throw new Error(`Para o campeonato, faltam as colunas: ${faltam.join(", ")}. O cabeçalho precisa ser categoria;etapa;bateria;posicao;piloto;status.`);

    const mapa = new Map();
    const erros = [];
    linhas.forEach((l, i) => {
      const n = i + 2; // linha da planilha (1 é o cabeçalho)
      const cat = categoria(l[col.categoria]);
      const etapa = Number(String(l[col.etapa] || "").replace(/\D/g, ""));
      const bat = bateria(l[col.bateria]);
      const name = String(l[col.piloto] || "").trim();
      const st = status(col.status == null ? "" : l[col.status]);
      const pos = Number(String(l[col.posicao] || "").replace(/\D/g, "")) || 0;
      if (!cat) return erros.push(`linha ${n}: categoria "${l[col.categoria] || ""}" (use 420R ou Academy)`);
      if (!(etapa >= 1 && etapa <= 5)) return erros.push(`linha ${n}: etapa "${l[col.etapa] || ""}" (use 1 a 5)`);
      if (!bat) return erros.push(`linha ${n}: bateria "${l[col.bateria] || ""}" (use Heat 1 ou Feature)`);
      if (!name) return erros.push(`linha ${n}: piloto vazio`);
      if (st === null) return erros.push(`linha ${n}: status "${l[col.status]}" (deixe em branco ou use DQ, NC, ABS)`);
      if (!st && !pos) return erros.push(`linha ${n}: ${name} sem posição`);
      const chave = `${cat}|${etapa}|${bat}`;
      if (!mapa.has(chave)) mapa.set(chave, { categoria: cat, etapa, bateria: bat, resultados: [] });
      mapa.get(chave).resultados.push({ pos: pos || null, name, status: st });
    });

    const baterias = [...mapa.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.etapa - b.etapa || a.bateria - b.bateria);
    baterias.forEach((b) => {
      b.resultados.sort((x, y) => (x.status === "ABS") - (y.status === "ABS") || (x.pos || 999) - (y.pos || 999));
      const posicoes = b.resultados.filter((r) => r.pos).map((r) => r.pos);
      const repetidas = posicoes.filter((p, i) => posicoes.indexOf(p) !== i);
      if (repetidas.length) erros.push(`${b.categoria} etapa ${b.etapa} ${BATERIA[b.bateria]}: posição repetida (${[...new Set(repetidas)].join(", ")})`);
    });
    return { baterias, erros };
  }

  function tabela(titulo, cabecalho, linhas) {
    const wrap = document.createElement("div");
    wrap.className = "adm__tabela-wrap";
    const h = document.createElement("h3");
    h.textContent = titulo;
    const t = document.createElement("table");
    const cab = t.createTHead().insertRow();
    cabecalho.forEach((x) => { const th = document.createElement("th"); th.textContent = x; cab.appendChild(th); });
    const corpo = t.createTBody();
    linhas.forEach((cels) => {
      const tr = corpo.insertRow();
      cels.forEach((x) => { const td = tr.insertCell(); if (x instanceof Node) td.appendChild(x); else td.textContent = x; });
    });
    if (!linhas.length) corpo.insertRow().insertCell().textContent = "Nada para mostrar.";
    wrap.append(h, t);
    return wrap;
  }

  const fase = () => $("[data-envio] [name=fase]").value;

  function reinterpretar() {
    lido = null;
    msg($("[data-previa-msg]"), "");
    msg($("[data-envio-msg]"), "");
    if (texto) {
      try { lido = fase() === "campeonato" ? interpretarCampeonato(texto) : interpretarSeletiva(texto); }
      catch (err) { msg($("[data-previa-msg]"), err.message, true); }
    }
    previa();
  }

  function previa() {
    const alvo = $("[data-previa]");
    alvo.replaceChildren();
    $("[data-publicar]").disabled = !lido || !!(lido.erros && lido.erros.length);
    if (!lido) return;

    if (fase() === "campeonato") {
      lido.baterias.forEach((b) => {
        alvo.appendChild(tabela(
          `${b.categoria} · Etapa ${b.etapa} · ${BATERIA[b.bateria]} · ${b.resultados.length} pilotos`,
          ["Pos.", "Piloto", "Status"],
          b.resultados.map((r) => [r.pos ? `P${r.pos}` : "—", r.name, r.status || ""])
        ));
      });
      if (lido.erros.length) {
        msg($("[data-previa-msg]"), `Corrija a planilha antes de publicar:\n• ${lido.erros.slice(0, 15).join("\n• ")}${lido.erros.length > 15 ? `\n… e mais ${lido.erros.length - 15}` : ""}`, true);
      } else {
        msg($("[data-previa-msg]"), `Prévia: ${lido.baterias.length} bateria(s). Cada bateria publicada substitui a mesma bateria já existente; as outras continuam como estão. Os pontos são calculados pelo site.`);
      }
      return;
    }

    CATS.forEach((c) => alvo.appendChild(tabela(
      `Caterham ${c} · ${lido.categorias[c].length} com tempo`,
      ["Pos.", "Piloto", "Tempo"],
      lido.categorias[c].map((p, i) => [String(i + 1), p.name, tempo(p.ms)])
    )));
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

  function botao(textoBotao, pergunta, corpo) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "adm__mini";
    b.textContent = textoBotao;
    b.addEventListener("click", async () => {
      if (!window.confirm(pergunta)) return;
      try { renderPublicado((await api("POST", corpo)).fases); } catch (e) { alert(e.message); }
    });
    return b;
  }

  function renderPublicado(fases) {
    const alvo = $("[data-publicado]");
    alvo.replaceChildren();

    const s = fases.seletiva;
    alvo.appendChild(tabela("Seletiva", ["Atualizado", "Arquivo", "420R", "Academy", ""], s
      ? [[dataHora(s.atualizado_em), s.arquivo || "—", String(s.categorias["420R"].length), String(s.categorias.Academy.length),
          botao("Tirar do ar", "Tirar o ranking da seletiva do site?", { fase: "seletiva", action: "delete" })]]
      : []));

    const c = fases.campeonato;
    const linhas = [];
    if (c) {
      CATS.forEach((cat) => {
        const cl = c.categorias[cat];
        cl.baterias.forEach((b, i) => {
          const vencedor = cl.sem.find((l) => l.res[i] && l.res[i].p === 1 && !l.res[i].s);
          const pilotos = cl.sem.filter((l) => l.res[i] && l.res[i].s !== "ABS").length;
          linhas.push([cat, `Etapa ${b.etapa}`, BATERIA[b.bateria], String(pilotos), vencedor ? vencedor.name : "—",
            botao("Remover", `Remover ${cat} etapa ${b.etapa} ${BATERIA[b.bateria]} da classificação?`,
              { fase: "campeonato", action: "delete_bateria", categoria: cat, etapa: b.etapa, bateria: b.bateria })]);
        });
      });
    }
    alvo.appendChild(tabela(`Campeonato${c ? ` · atualizado ${dataHora(c.atualizado_em)}` : ""}`, ["Categoria", "Etapa", "Bateria", "Pilotos", "Vencedor", ""], linhas));
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
    const arq = e.target.files[0];
    texto = arq ? await arq.text() : "";
    reinterpretar();
  });
  $("[data-envio] [name=fase]").addEventListener("change", reinterpretar);

  $("[data-envio]").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!lido) return;
    const f = e.target;
    const corpo = fase() === "campeonato"
      ? { fase: "campeonato", file_name: f.arquivo.files[0].name, baterias: lido.baterias }
      : { fase: "seletiva", file_name: f.arquivo.files[0].name, categorias: lido.categorias };
    const b = $("[data-publicar]");
    b.disabled = true;
    msg($("[data-envio-msg]"), "Publicando…");
    try {
      const d = await api("POST", corpo);
      msg($("[data-envio-msg]"), "Publicado. O site atualiza em até 1 minuto.");
      renderPublicado(d.fases);
    } catch (err) {
      msg($("[data-envio-msg]"), err.message, true);
    } finally {
      b.disabled = false;
    }
  });

  if (token) entrar().catch(() => {});
})();
