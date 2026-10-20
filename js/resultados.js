/*
  Resultados (campeonato-simulador/resultados/): busca GET /api/resultados e
  monta o ranking da fase (seletiva / campeonato) e categoria (420R / Academy)
  escolhidas. Tempos chegam em milissegundos. Estado das abas vai no hash
  (#seletiva-420r, #campeonato-academy...).
*/
(() => {
  const CATS = ["420R", "Academy"];
  const FASES = ["seletiva", "campeonato"];
  const NOME_FASE = { seletiva: "da seletiva", campeonato: "do campeonato" };
  const elAtualizado = document.querySelector("[data-res-atualizado]");
  const abasFase = [...document.querySelectorAll("[data-fase]")];
  const abasCat = [...document.querySelectorAll("[data-cat]")];
  let dados = null;
  let fase = "seletiva";
  let cat = "420R";

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
    CATS.forEach((c) => {
      const painel = document.querySelector(`[data-painel="${c}"]`);
      painel.hidden = c !== cat;
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

  async function carregar() {
    try {
      const r = await fetch("/api/resultados", { headers: { Accept: "application/json" } });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error("falha");
      dados = d;
      render();
    } catch {
      elAtualizado.textContent = "Não foi possível carregar os resultados agora. Tente atualizar a página.";
    }
  }
  carregar();
})();
