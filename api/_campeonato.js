// Classificação do campeonato (Regulamento 3). Arquivo com "_": não vira rota,
// só é importado por api/resultados.js.
//
// Entrada: baterias publicadas pelo painel de resultados, cada uma
//   { categoria, etapa: 1-5, bateria: 1 (Heat) | 2 (Feature), resultados: [{ pos, name, status }] }
// status: "" (classificado), "DQ" desclassificado, "NC" não completou 75%, "ABS" ausente.
// Piloto que não aparece numa bateria disputada conta como ABS.
//
// 3.2.2  P1 = 31, P2 = 29 ... P30 = 1; status = 0 ponto.
// 3.1.2  2 descartes por piloto ao fim do campeonato; 3.1.4 DQ não pode ser descartado.
// 3.4.1  desempate: vitórias, 2º lugares, 3º...; depois o melhor resultado na última
//        bateria, na anterior, e assim por diante.

const CATEGORIAS = ["Academy", "420R"];
const ETAPAS = [
  { n: 1, data: "20/10" },
  { n: 2, data: "27/10" },
  { n: 3, data: "10/11" },
  { n: 4, data: "17/11" },
  { n: 5, data: "24/11" },
];
const DESCARTES = 2;
const STATUS = ["DQ", "NC", "ABS"];

const pontos = (pos) => (pos === 1 ? 31 : pos >= 2 && pos <= 30 ? 31 - pos : 0);
const chaveBateria = (etapa, bateria) => `${etapa}-${bateria}`;
const chavePiloto = (nome) => String(nome).trim().replace(/\s+/g, " ").toLowerCase();

// Para o desempate: posição válida vale ela mesma; qualquer status fica atrás de todos.
const ordemResultado = (r) => (r.s ? 999 : r.p);

function classificar(baterias) {
  const ordenadas = [...baterias].sort((a, b) => a.etapa - b.etapa || a.bateria - b.bateria);
  const chaves = ordenadas.map((b) => chaveBateria(b.etapa, b.bateria));

  const pilotos = new Map();
  ordenadas.forEach((b) => {
    b.resultados.forEach((r) => {
      const k = chavePiloto(r.name);
      if (!pilotos.has(k)) pilotos.set(k, { name: r.name, res: {} });
      const p = pilotos.get(k);
      p.name = r.name; // fica a grafia da bateria mais recente
      const s = STATUS.includes(r.status) ? r.status : "";
      p.res[chaveBateria(b.etapa, b.bateria)] = { p: s === "ABS" ? null : r.pos || null, s };
    });
  });

  const linhas = [...pilotos.values()].map((p) => {
    const res = {};
    chaves.forEach((k) => {
      const r = p.res[k] || { p: null, s: "ABS" };
      res[k] = { ...r, pts: r.s ? 0 : pontos(r.p) };
    });
    const total = chaves.reduce((t, k) => t + res[k].pts, 0);

    // Descartes: os 2 resultados de menos pontos, nunca um DQ. Empate em pontos: descarta o mais antigo.
    const descartaveis = chaves.filter((k) => res[k].s !== "DQ").sort((a, b) => res[a].pts - res[b].pts || chaves.indexOf(a) - chaves.indexOf(b));
    const descartados = new Set(descartaveis.slice(0, DESCARTES));
    const totalCom = chaves.reduce((t, k) => t + (descartados.has(k) ? 0 : res[k].pts), 0);

    const contagem = new Array(31).fill(0);
    chaves.forEach((k) => { if (!res[k].s && res[k].p >= 1 && res[k].p <= 30) contagem[res[k].p]++; });

    return { name: p.name, res, total, totalCom, descartados: [...descartados], contagem };
  });

  const ordenar = (campo) => (a, b) => {
    if (b[campo] !== a[campo]) return b[campo] - a[campo];
    for (let pos = 1; pos <= 30; pos++) if (a.contagem[pos] !== b.contagem[pos]) return b.contagem[pos] - a.contagem[pos];
    for (let i = chaves.length - 1; i >= 0; i--) {
      const d = ordemResultado(a.res[chaves[i]]) - ordemResultado(b.res[chaves[i]]);
      if (d) return d;
    }
    return a.name.localeCompare(b.name, "pt-BR");
  };

  const montar = (campo, comDescartes) => {
    const lista = [...linhas].sort(ordenar(campo));
    const lider = lista.length ? lista[0][campo] : 0;
    return lista.map((l, i) => ({
      pos: i + 1,
      name: l.name,
      pts: l[campo],
      gap: l[campo] - lider,
      res: chaves.map((k) => ({ ...l.res[k], d: comDescartes && l.descartados.includes(k) })),
    }));
  };

  return {
    baterias: ordenadas.map((b) => ({ etapa: b.etapa, bateria: b.bateria })),
    sem: montar("total", false),
    com: montar("totalCom", true),
  };
}

// Visão pública: só o que a página precisa, por categoria.
function visaoPublica(camp) {
  const baterias = Object.values((camp && camp.baterias) || {});
  const categorias = {};
  CATEGORIAS.forEach((c) => { categorias[c] = classificar(baterias.filter((b) => b.categoria === c)); });
  return { atualizado_em: (camp && camp.atualizado_em) || null, etapas: ETAPAS, descartes: DESCARTES, categorias };
}

// Valida uma bateria vinda do painel. Devolve null se não der para usar.
function limparBateria(b) {
  if (!b || !CATEGORIAS.includes(b.categoria)) return null;
  const etapa = Number(b.etapa);
  const bateria = Number(b.bateria);
  if (!ETAPAS.some((e) => e.n === etapa) || ![1, 2].includes(bateria) || !Array.isArray(b.resultados)) return null;
  const vistos = new Set();
  const resultados = [];
  for (const r of b.resultados.slice(0, 200)) {
    const name = String((r && r.name) || "").trim().replace(/\s+/g, " ").slice(0, 80);
    const status = STATUS.includes(r && r.status) ? r.status : "";
    const pos = Math.round(Number(r && r.pos)) || 0;
    if (!name || vistos.has(chavePiloto(name))) continue;
    if (!status && !(pos >= 1 && pos <= 200)) continue;
    vistos.add(chavePiloto(name));
    resultados.push({ pos: pos > 0 ? pos : null, name, status });
  }
  if (!resultados.length) return null;
  return { categoria: b.categoria, etapa, bateria, resultados, chave: `${b.categoria}|${etapa}|${bateria}` };
}

module.exports = { CATEGORIAS, ETAPAS, STATUS, pontos, classificar, visaoPublica, limparBateria };
