/*
  Resultados (campeonato-simulador/resultados/): busca GET /api/resultados e
  monta, para a categoria escolhida (420R / Academy):
  - Seletiva: ranking por melhor volta (tempos em milissegundos).
  - Campeonato: classificação por pontos já calculada no servidor
    (api/_campeonato.js), com e sem os 2 descartes.
  Estado das abas vai no hash (#seletiva-420r, #campeonato-academy...).
*/
(() => {
  const CATS = ["420R", "Academy"];
  const FASES = ["seletiva", "campeonato"];
  const NOME_FASE = { seletiva: "da seletiva", campeonato: "do campeonato" };
  const elAtualizado = document.querySelector("[data-res-atualizado]");
  const abasFase = [...document.querySelectorAll("[data-fase]")];
  const abasCat = [...document.querySelectorAll("[data-cat]")];
  const BATERIA = { 1: "Heat 1", 2: "Feature" };
  const main = document.querySelector("#resultados");
  let dados = null;
  let fase = "seletiva";
  let cat = "420R";
  let modo = "sem"; // "sem" ou "com" descartes

  const tempo = (ms) => {
    const min = Math.floor(ms / 60000);
    const seg = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
    return min ? `${min}:${seg}` : seg.replace(/^0/, "");
  };
  const gap = (ms) => (ms ? `+${(ms / 1000).toFixed(3)}` : "—");
  const dataHora = (iso) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });

  function celula(tag, classe, texto) {
    const td = document.createElement(tag);
    if (classe) td.className = classe;
    td.textContent = texto;
    return td;
  }

  function tabela(lista, vagas) {
    const t = document.createElement("table");
    t.className = "sel__tabela";
    const cab = t.createTHead().insertRow();
    [["c-pos", "Pos."], ["c-nome", "Piloto"], ["c-volta", "Tempo"], ["c-gap", "Diferença"]].forEach(([c, txt]) => {
      const th = celula("th", c, txt);
      th.scope = "col";
      cab.appendChild(th);
    });
    const corpo = t.createTBody();
    lista.forEach((p) => {
      if (vagas && p.pos === vagas + 1) {
        const corte = corpo.insertRow();
        corte.className = "sel__corte";
        const td = celula("td", "", `Linha de corte · ${vagas} vagas`);
        td.colSpan = 4;
        corte.appendChild(td);
      }
      const tr = corpo.insertRow();
      if (vagas && p.pos > vagas) tr.className = "is-fora";
      tr.append(
        celula("td", "c-pos", String(p.pos)),
        celula("td", "c-nome", p.name),
        celula("td", "c-volta", tempo(p.ms)),
        celula("td", "c-gap", gap(p.gap))
      );
    });
    return t;
  }

  function vazio(texto) {
    const p = document.createElement("p");
    p.className = "sel__vazio";
    p.textContent = texto;
    return p;
  }

  function el(tag, classe, ...filhos) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    e.append(...filhos.filter((f) => f != null));
    return e;
  }

  function celulaResultado(r, borda) {
    const td = el("td", `r${borda ? " e" : ""}`);
    if (!r) {
      td.classList.add("pend");
      td.append("–");
      return td;
    }
    if (r.s) td.classList.add(r.s.toLowerCase());
    else if (r.p === 1) td.classList.add("p1");
    if (r.d) td.classList.add("drop");
    td.append(el("span", "", r.s || `P${r.p}`), el("small", "", `${r.pts} pts`));
    return td;
  }

  function campeonato(f, c) {
    const cl = f.categorias[c];
    const frag = document.createDocumentFragment();
    frag.append(el("p", "cls__intro", `P1 soma 31 pontos e P30 soma 1. Só pontua quem completar 75% da distância do vencedor. Ao final das 10 baterias, os ${f.descartes} piores resultados de cada piloto são descartados (desclassificação não pode ser descartada).`));

    const feitas = new Set(cl.baterias.map((b) => b.etapa));
    const proxima = f.etapas.find((e) => !feitas.has(e.n));
    const faixa = el("div", "cls__etapas");
    f.etapas.forEach((e) => {
      const estado = feitas.has(e.n) ? "is-feita" : proxima && proxima.n === e.n ? "is-proxima" : "";
      const rotulo = estado === "is-feita" ? " · disputada" : estado ? " · próxima" : "";
      faixa.append(el("div", `cls__etapa ${estado}`, el("b", "", `Etapa ${e.n}`), el("span", "", e.data + rotulo)));
    });
    frag.append(faixa);

    if (!cl.baterias.length) {
      frag.append(vazio("A classificação desta categoria aparece aqui depois da primeira etapa."));
      return frag;
    }

    // Descartes só fazem sentido com várias baterias; antes disso, só a soma.
    const temModo = cl.baterias.length >= 3;
    const usar = temModo ? modo : "sem";
    const barra = el("div", "cls__barra");
    if (temModo) {
      const grupo = el("div", "cls__modo");
      grupo.setAttribute("role", "group");
      grupo.setAttribute("aria-label", "Descartes");
      [["sem", "Sem descartes"], ["com", `Com ${f.descartes} descartes`]].forEach(([v, t]) => {
        const b = el("button", "", t);
        b.type = "button";
        b.setAttribute("aria-pressed", String(usar === v));
        b.addEventListener("click", () => { modo = v; render(); });
        grupo.append(b);
      });
      barra.append(grupo);
    }
    barra.append(el("p", "cls__nota", usar === "com"
      ? "Projeção com os descartes aplicados desde já. Oficialmente, os descartes entram ao final da temporada."
      : "Pontos somados, sem descarte. Os descartes entram ao final da temporada."));
    frag.append(barra);

    const indice = new Map(cl.baterias.map((b, i) => [`${b.etapa}-${b.bateria}`, i]));
    const t = el("table", "cls__tabela");
    const h1 = t.createTHead().insertRow();
    const h2 = t.tHead.insertRow();
    const thPos = el("th", "c-pos", "Pos.");
    const thNome = el("th", "c-nome", "Piloto");
    const thPts = el("th", "c-pts", "Pontos");
    const thGap = el("th", "c-gap", "Dif.");
    [thPos, thNome, thPts, thGap].forEach((th) => { th.rowSpan = 2; th.scope = "col"; });
    h1.append(thPos, thNome);
    f.etapas.forEach((e) => {
      const th = el("th", "e", `Etapa ${e.n}`);
      th.colSpan = 2;
      th.scope = "colgroup";
      h1.append(th);
      [1, 2].forEach((b) => {
        const x = el("th", b === 1 ? "e" : "", BATERIA[b]);
        x.scope = "col";
        h2.append(x);
      });
    });
    h1.append(thPts, thGap);

    const corpo = t.createTBody();
    cl[usar].forEach((l) => {
      const tr = corpo.insertRow();
      tr.append(el("td", "c-pos", String(l.pos)), el("td", "c-nome", l.name));
      f.etapas.forEach((e) => [1, 2].forEach((b) => {
        const i = indice.get(`${e.n}-${b}`);
        tr.append(celulaResultado(i == null ? null : l.res[i], b === 1));
      }));
      tr.append(el("td", "c-pts", String(l.pts)), el("td", "c-gap", l.gap ? String(l.gap) : "—"));
    });
    frag.append(el("div", "cls__wrap", t));

    const item = (marca, classe, texto) => el("span", "", el("b", classe, marca), texto);
    const legenda = el("div", "cls__legenda",
      item("P4", "", "posição na bateria e pontos"),
      item("DQ", "dq", "desclassificado (0 pts, não descartável)"),
      item("NC", "", "não completou 75% (0 pts)"),
      item("ABS", "", "ausente (0 pts)"));
    if (usar === "com") legenda.append(el("span", "", el("s", "", "P18"), "resultado descartado"));
    frag.append(legenda);
    return frag;
  }

  function marcar(abas, chave, valor, foco) {
    abas.forEach((b) => {
      const ativa = b.dataset[chave] === valor;
      b.setAttribute("aria-selected", String(ativa));
      b.tabIndex = ativa ? 0 : -1;
      if (ativa && foco) b.focus();
    });
  }

  function render() {
    const f = dados && dados.fases ? dados.fases[fase] : null;
    main.classList.toggle("is-largo", fase === "campeonato");
    CATS.forEach((c) => {
      const painel = document.querySelector(`[data-painel="${c}"]`);
      painel.hidden = c !== cat;
      if (fase === "campeonato") {
        painel.replaceChildren(f ? campeonato(f, c) : vazio("A classificação do campeonato aparece aqui depois da primeira etapa."));
        return;
      }
      const lista = (f && f.categorias && f.categorias[c]) || [];
      painel.replaceChildren(
        lista.length ? tabela(lista, f.vagas) : vazio(`O resultado ${NOME_FASE[fase]} nesta categoria ainda não foi publicado.`)
      );
    });
    if (dados) {
      elAtualizado.textContent = f && f.atualizado_em
        ? `Atualizado em ${dataHora(f.atualizado_em)} (horário de Brasília)`
        : "Aguardando publicação";
    }
  }

  function selecionar(novaFase, novaCat, foco) {
    fase = novaFase;
    cat = novaCat;
    marcar(abasFase, "fase", fase, foco === "fase");
    marcar(abasCat, "cat", cat, foco === "cat");
    render();
    try { history.replaceState(null, "", `#${fase}-${cat.toLowerCase()}`); } catch {}
  }

  function ligarAbas(abas, chave, valores) {
    abas.forEach((b, i) => {
      const escolher = (v, foco) => (chave === "fase" ? selecionar(v, cat, foco) : selecionar(fase, v, foco));
      b.addEventListener("click", () => escolher(b.dataset[chave]));
      b.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const prox = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
        escolher(prox.dataset[chave], chave);
      });
    });
  }
  ligarAbas(abasFase, "fase", FASES);
  ligarAbas(abasCat, "cat", CATS);

  const [hFase, hCat] = location.hash.slice(1).toLowerCase().split("-");
  selecionar(FASES.includes(hFase) ? hFase : "seletiva", hCat === "academy" ? "Academy" : "420R");
  const escolhidoNoLink = FASES.includes(hFase);

  async function carregar() {
    try {
      const r = await fetch("/api/resultados", { headers: { Accept: "application/json" } });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error("falha");
      dados = d;
      // Sem aba no link: depois que o campeonato começa, ele é o que se quer ver.
      const camp = d.fases && d.fases.campeonato;
      if (!escolhidoNoLink && camp && CATS.some((c) => camp.categorias[c].baterias.length)) selecionar("campeonato", cat);
      else render();
    } catch {
      elAtualizado.textContent = "Não foi possível carregar os resultados agora. Tente atualizar a página.";
    }
  }
  carregar();
})();
