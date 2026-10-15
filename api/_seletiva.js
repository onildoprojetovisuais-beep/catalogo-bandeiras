// Lógica compartilhada do ranking da Fase Classificatória (seletiva) da
// Scuderia Bandeiras Esports Cup 2026. Arquivo com "_" no nome: a Vercel não
// o publica como rota, só é importado por api/seletiva.js e api/seletiva-admin.js.
//
// Regulamento 2.2: vale a melhor volta válida e sem incidentes de cada piloto
// entre 15/10 16:00 e 18/10 23:59 (Snetterton 200). Empate: quem fez primeiro.
// Até 30 classificados por categoria.
//
// O eventresult.json do iRacing não traz volta a volta, só a melhor volta de
// cada piloto por sessão. Por isso a fonte padrão é a sessão de classificação
// (Lone Qualifying), onde o próprio iRacing invalida volta com incidente.
//
// Armazenamento: Vercel Blob privado (BLOB_READ_WRITE_TOKEN, criado ao ligar o
// store "scuderia-esports-cup" ao projeto).
//   seletiva/state.json                    imports + exclusões (fonte da verdade)
//   seletiva/arquivos/<cat>-<id>.json      cópia do arquivo original enviado

const crypto = require("crypto");
const { get, put } = require("@vercel/blob");

const CATEGORIAS = ["Academy", "420R"];
const VAGAS = 30;
const STATE_PATH = "seletiva/state.json";
const MODOS = ["auto", "qualify", "practice", "all"];

function estadoVazio() {
  return { version: 1, imports: [], exclusions: [] };
}

async function lerEstado() {
  const r = await get(STATE_PATH, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return estadoVazio();
  const dados = await new Response(r.stream).json();
  return { ...estadoVazio(), ...dados };
}

async function salvarEstado(estado) {
  await put(STATE_PATH, JSON.stringify(estado), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

async function guardarOriginal(categoria, id, conteudo) {
  await put(`seletiva/arquivos/${categoria}-${id}.json`, conteudo, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

const ehQualify = (s) => /qualif/i.test(`${s.simsession_type_name || ""} ${s.simsession_name || ""}`);
const ehPractice = (s) => /practice|warmup/i.test(`${s.simsession_type_name || ""} ${s.simsession_name || ""}`);

function escolherSessoes(sessoes, modo) {
  if (modo === "qualify") return sessoes.filter(ehQualify);
  if (modo === "practice") return sessoes.filter(ehPractice);
  if (modo === "all") return sessoes;
  const q = sessoes.filter(ehQualify);
  return q.length ? q : sessoes.filter(ehPractice);
}

// Lê o eventresult.json do iRacing e devolve a melhor volta de cada piloto.
function lerEventResult(texto, modo) {
  let bruto;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const d = bruto && bruto.data ? bruto.data : bruto;
  const sessoes = d && Array.isArray(d.session_results) ? d.session_results : null;
  if (!sessoes) throw new Error("Não parece um eventresult do iRacing (falta session_results).");

  const usadas = escolherSessoes(sessoes, modo);
  if (!usadas.length) throw new Error("Nenhuma sessão do tipo escolhido foi encontrada no arquivo.");
  const lido = melhoresVoltas(d, sessoes, usadas);
  // Classificação aberta mas não corrida (todos com -1): no automático, cai para o treino.
  if (modo === "auto" && !lido.entries.length && usadas.some(ehQualify)) {
    const treino = sessoes.filter(ehPractice);
    if (treino.length) return melhoresVoltas(d, sessoes, treino);
  }
  return lido;
}

function melhoresVoltas(d, sessoes, usadas) {
  const melhores = new Map();
  const carros = new Set();
  for (const s of usadas) {
    const quali = ehQualify(s);
    for (const r of s.results || []) {
      if (!r || r.ai || !r.cust_id) continue;
      if (r.car_name) carros.add(r.car_name);
      const qualiLap = Number(r.best_qual_lap_time) > 0 ? Number(r.best_qual_lap_time) : 0;
      const volta = quali && qualiLap ? qualiLap : Number(r.best_lap_time);
      if (!(volta > 0)) continue;
      const qualiAt = quali && r.best_qual_lap_at && !String(r.best_qual_lap_at).startsWith("1970") ? r.best_qual_lap_at : "";
      const quando = qualiAt || d.start_time || "";
      const atual = melhores.get(r.cust_id);
      if (!atual || volta < atual.lap || (volta === atual.lap && quando < atual.at)) {
        melhores.set(r.cust_id, {
          cust_id: r.cust_id,
          name: String(r.display_name || "").slice(0, 80),
          lap: volta,
          at: quando,
          incidents: Number(r.incidents) || 0,
        });
      }
    }
  }

  return {
    subsession_id: d.subsession_id || null,
    start_time: d.start_time || null,
    track: d.track ? [d.track.track_name, d.track.config_name].filter(Boolean).join(" · ") : "",
    session_name: d.session_name || d.league_season_name || "",
    sessoes_usadas: usadas.map((s) => s.simsession_name || s.simsession_type_name),
    sessoes_no_arquivo: sessoes.map((s) => `${s.simsession_name || "?"} (${s.simsession_type_name || "?"})`),
    carros: [...carros],
    entries: [...melhores.values()],
  };
}

function montarRanking(estado) {
  const excluidos = new Set(estado.exclusions.map((e) => `${e.category}:${e.cust_id}`));
  const saida = {};
  for (const cat of CATEGORIAS) {
    const melhores = new Map();
    for (const imp of estado.imports) {
      if (imp.category !== cat) continue;
      for (const e of imp.entries) {
        if (excluidos.has(`${cat}:${e.cust_id}`)) continue;
        const atual = melhores.get(e.cust_id);
        if (!atual || e.lap < atual.lap || (e.lap === atual.lap && e.at < atual.at)) {
          melhores.set(e.cust_id, { ...e, name: e.name || (atual && atual.name) || "" });
        }
      }
    }
    const lista = [...melhores.values()].sort(
      (a, b) => a.lap - b.lap || String(a.at).localeCompare(String(b.at)) || a.cust_id - b.cust_id
    );
    const lider = lista.length ? lista[0].lap : 0;
    saida[cat] = lista.map((e, i) => ({
      pos: i + 1,
      cust_id: e.cust_id,
      name: e.name,
      lap: e.lap,
      gap: i === 0 ? 0 : e.lap - lider,
      classificado: i < VAGAS,
    }));
  }
  const datas = estado.imports.map((i) => i.uploaded_at).filter(Boolean).sort();
  return {
    atualizado_em: datas.length ? datas[datas.length - 1] : null,
    vagas: VAGAS,
    categorias: saida,
  };
}

function autorizado(req) {
  const esperado = process.env.CATERHAM_ADMIN_TOKEN || "";
  const cabecalho = String(req.headers.authorization || "");
  const enviado = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!esperado || !enviado) return false;
  const a = crypto.createHash("sha256").update(esperado).digest();
  const b = crypto.createHash("sha256").update(enviado).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  CATEGORIAS, MODOS, VAGAS,
  lerEstado, salvarEstado, guardarOriginal, lerEventResult, montarRanking, autorizado,
};
