/*
  Ranking da seletiva (campeonato-simulador/seletiva/): busca GET /api/seletiva,
  monta a tabela de cada categoria e controla as abas Academy / 420R.
  Tempos chegam em décimos de milésimo de segundo (padrão do iRacing).
*/
(() => {
  const CATS = ["Academy", "420R"];
  const elAtualizado = document.querySelector("[data-sel-atualizado]");
  const abas = [...document.querySelectorAll("[data-cat]")];

  const tempo = (v) => {
    const ms = Math.round(v / 10);
    const min = Math.floor(ms / 60000);
    const seg = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
    return min ? `${min}:${seg}` : seg.replace(/^0/, "");
  };
  const gap = (v) => (v ? `+${(Math.round(v / 10) / 1000).toFixed(3)}` : "—");
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
    [["c-pos", "Pos."], ["c-nome", "Piloto"], ["c-volta", "Melhor volta"], ["c-gap", "Diferença"]].forEach(([c, txt]) => {
      const th = celula("th", c, txt);
      th.scope = "col";
      cab.appendChild(th);
    });
    const corpo = t.createTBody();
    lista.forEach((p) => {
      if (p.pos === vagas + 1) {
        const corte = corpo.insertRow();
        corte.className = "sel__corte";
        const td = celula("td", "", `Linha de corte · ${vagas} vagas`);
        td.colSpan = 4;
        corte.appendChild(td);
      }
      const tr = corpo.insertRow();
      if (!p.classificado) tr.className = "is-fora";
      tr.append(
        celula("td", "c-pos", String(p.pos)),
        celula("td", "c-nome", p.name),
        celula("td", "c-volta", tempo(p.lap)),
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

  function render(dados) {
    CATS.forEach((cat) => {
      const painel = document.querySelector(`[data-painel="${cat}"]`);
      const lista = (dados.categorias && dados.categorias[cat]) || [];
      painel.replaceChildren(
        lista.length ? tabela(lista, dados.vagas || 30) : vazio("Nenhum tempo publicado ainda nesta categoria. O ranking é atualizado ao longo da seletiva.")
      );
    });
    elAtualizado.textContent = dados.atualizado_em
      ? `Atualizado em ${dataHora(dados.atualizado_em)} (horário de Brasília)`
      : "Aguardando os primeiros tempos";
  }

  function selecionar(cat, foco) {
    abas.forEach((b) => {
      const ativa = b.dataset.cat === cat;
      b.setAttribute("aria-selected", String(ativa));
      b.tabIndex = ativa ? 0 : -1;
      document.querySelector(`[data-painel="${b.dataset.cat}"]`).hidden = !ativa;
      if (ativa && foco) b.focus();
    });
    try { history.replaceState(null, "", `#${cat.toLowerCase()}`); } catch {}
  }

  abas.forEach((b, i) => {
    b.addEventListener("click", () => selecionar(b.dataset.cat));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const prox = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
      selecionar(prox.dataset.cat, true);
    });
  });
  if (location.hash.toLowerCase() === "#420r") selecionar("420R");

  async function carregar() {
    try {
      const r = await fetch("/api/seletiva", { headers: { Accept: "application/json" } });
      const dados = await r.json();
      if (!r.ok || !dados.ok) throw new Error("falha");
      render(dados);
    } catch {
      elAtualizado.textContent = "Não foi possível carregar o ranking agora. Tente atualizar a página.";
    }
  }
  carregar();
  // Página aberta por muito tempo (live, transmissão): recarrega a cada 2 min.
  setInterval(() => { if (!document.hidden) carregar(); }, 120000);
})();
