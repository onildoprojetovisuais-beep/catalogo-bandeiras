// /api/seletiva-admin — painel da seletiva (campeonato-simulador/seletiva/admin/).
// Exige Authorization: Bearer <CATERHAM_ADMIN_TOKEN>.
//
//   GET                                    estado: arquivos enviados, exclusões, ranking com cust_id
//   POST {action:"import", category, mode, file_name, content}
//                                          lê o eventresult.json e soma ao ranking. Reenviar a
//                                          mesma sessão (mesmo subsession_id) substitui a anterior.
//   POST {action:"delete_import", id}      remove um arquivo do ranking
//   POST {action:"exclude", category, cust_id, reason}   tira o piloto do ranking (Reg. 2.2.12)
//   POST {action:"include", category, cust_id}           desfaz a exclusão

const {
  CATEGORIAS, MODOS, lerEstado, salvarEstado, guardarOriginal, lerEventResult, montarRanking, autorizado,
} = require("./_seletiva");

const MAX_CONTEUDO = 4 * 1024 * 1024; // limite de corpo das Vercel Functions é 4,5 MB

function resumo(estado) {
  return {
    imports: estado.imports
      .map(({ entries, ...imp }) => ({ ...imp, pilotos: entries.length }))
      .sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at))),
    exclusions: estado.exclusions,
    ranking: montarRanking(estado),
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (!autorizado(req)) {
    res.status(401).json({ ok: false, error: "Senha do painel incorreta." });
    return;
  }

  try {
    if (req.method === "GET") {
      res.status(200).json({ ok: true, ...resumo(await lerEstado()) });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      res.status(405).json({ ok: false });
      return;
    }

    const b = req.body && typeof req.body === "object" ? req.body : {};
    const estado = await lerEstado();

    if (b.action === "import") {
      if (!CATEGORIAS.includes(b.category)) return erro(res, "Escolha a categoria.");
      const modo = MODOS.includes(b.mode) ? b.mode : "auto";
      const conteudo = typeof b.content === "string" ? b.content : "";
      if (!conteudo) return erro(res, "Arquivo vazio.");
      if (conteudo.length > MAX_CONTEUDO) return erro(res, "Arquivo maior que 4 MB.");

      let lido;
      try {
        lido = lerEventResult(conteudo, modo);
      } catch (e) {
        return erro(res, e.message);
      }
      if (!lido.entries.length) return erro(res, "Nenhuma volta válida encontrada nas sessões usadas.");

      const id = String(lido.subsession_id || Date.now());
      const registro = {
        id: `${b.category}-${id}`,
        category: b.category,
        subsession_id: lido.subsession_id,
        file_name: String(b.file_name || "").slice(0, 120),
        mode: modo,
        uploaded_at: new Date().toISOString(),
        start_time: lido.start_time,
        track: lido.track,
        session_name: lido.session_name,
        sessoes_usadas: lido.sessoes_usadas,
        sessoes_no_arquivo: lido.sessoes_no_arquivo,
        carros: lido.carros,
        entries: lido.entries,
      };
      const substituiu = estado.imports.some((i) => i.id === registro.id);
      estado.imports = estado.imports.filter((i) => i.id !== registro.id).concat(registro);
      await guardarOriginal(b.category, id, conteudo);
      await salvarEstado(estado);
      res.status(200).json({ ok: true, substituiu, importado: { ...registro, entries: undefined, pilotos: lido.entries.length }, ...resumo(estado) });
      return;
    }

    if (b.action === "delete_import") {
      const antes = estado.imports.length;
      estado.imports = estado.imports.filter((i) => i.id !== b.id);
      if (estado.imports.length === antes) return erro(res, "Arquivo não encontrado.");
      await salvarEstado(estado);
      res.status(200).json({ ok: true, ...resumo(estado) });
      return;
    }

    if (b.action === "exclude" || b.action === "include") {
      const custId = Number(b.cust_id);
      if (!CATEGORIAS.includes(b.category) || !Number.isInteger(custId) || custId < 1) {
        return erro(res, "Informe categoria e Customer ID.");
      }
      estado.exclusions = estado.exclusions.filter((e) => !(e.category === b.category && e.cust_id === custId));
      if (b.action === "exclude") {
        estado.exclusions.push({
          category: b.category,
          cust_id: custId,
          reason: String(b.reason || "").slice(0, 200),
          at: new Date().toISOString(),
        });
      }
      await salvarEstado(estado);
      res.status(200).json({ ok: true, ...resumo(estado) });
      return;
    }

    erro(res, "Ação desconhecida.");
  } catch (err) {
    console.error("[seletiva-admin]", err && err.message);
    res.status(500).json({ ok: false, error: "Erro no servidor. Tente de novo em instantes." });
  }
};

function erro(res, mensagem) {
  res.status(400).json({ ok: false, error: mensagem });
}
