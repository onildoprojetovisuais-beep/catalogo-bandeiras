#!/usr/bin/env python3
"""
Pipeline de mídia — Nova Home Scuderia Bandeiras
Gera AVIF (primário) + JPEG (fallback) em larguras responsivas, com nome
de arquivo baseado em hash de conteúdo (cache imutável).

Uso:
    python scripts/build-media.py            # gera tudo
    python scripts/build-media.py --dry-run  # só lista o que faria
    python scripts/build-media.py --manifest # imprime o manifesto JSON usado pelo HTML

Regras (doc/VISUAL-DIRECTION.md §6.4, §16):
  - Só processa os arquivos listados no MANIFEST abaixo. Nada de "processar a pasta
    inteira": cada entrada foi confirmada como segura de usar pelos relatórios K/D/I.
  - NÃO inclui: material externo do Caterham (Projeto-caterham/…, pendente de
    aprovação de direitos — item 6), o mosaico "nosso time" (pendente de
    confirmação de Rubens/Suzuki — item 7), hero-conexoes-v2 (estética proibida),
    Imagens/pilotos/ antigo (contém Rafael Suzuki), renders 3D/CGI, marcas parceiras
    (raster diverge da copy), lei de incentivo / stock car em números (dados de
    terceiro / fora de escopo).
  - Larguras: 480 / 800 / 1280 / 1920 (nunca upscale além da largura original).
  - AVIF qualidade ~52 (medido no relatório G: reduções de 88-99%). JPEG fallback
    qualidade 78, progressive.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = ROOT
OUT_DIR = ROOT / "assets-build" / "img"
WIDTHS = (480, 800, 1280, 1920)
AVIF_QUALITY = 52
JPEG_QUALITY = 78

# slug -> caminho de origem relativo à raiz do projeto
MANIFEST: dict[str, str] = {
    # Dobra 02 / 06 — complexo (aéreas e ambientes reais)
    "complexo-1": "assets/Imagens/complexo/1.png",
    "complexo-2": "assets/Imagens/complexo/2.png",
    "complexo-3": "assets/Imagens/complexo/3.png",
    "complexo-4": "assets/Imagens/complexo/4.png",
    "complexo-5": "assets/Imagens/complexo/5.png",
    "complexo-6": "assets/Imagens/complexo/image00016.jpeg",
    "complexo-7": "assets/Imagens/complexo/7.png",
    "local-auditorio": "assets/Imagens/local/auditorio.jpg",
    "local-gastronomia": "assets/Imagens/local/gastronomia.jpg",
    # Carrossel "Os Espaços" — fotos atualizadas pelo usuário (2026-09-25,
    # pasta assets/Imagens/estrutura/novas-imagens/), substituem as
    # anteriores nos mesmos slugs. "espaço motor.jpeg" é foto nova (o card
    # usava complexo-7 antes; ganhou slug próprio).
    "estrutura-acesso-aereo": "assets/Imagens/estrutura/novas-imagens/heliponto.png",
    "estrutura-area-multiuso": "assets/Imagens/estrutura/area multiuso.png",
    "estrutura-auditorio": "assets/Imagens/estrutura/novas-imagens/auditorio.jpeg",
    "estrutura-coworking": "assets/Imagens/estrutura/novas-imagens/coworking.png.jpeg",
    "estrutura-espaco-motor": "assets/Imagens/estrutura/novas-imagens/espaço motor.jpeg",
    "estrutura-garagem": "assets/Imagens/estrutura/novas-imagens/oficina.png",
    "estrutura-gastronomia": "assets/Imagens/estrutura/gastronom,ia.png",
    # Hero / CTA final (fallback enquanto o material Caterham externo não é aprovado)
    "final-imagem": "assets/Imagens/final/imagem final@2x.png",
    # Hero (topo) — nova imagem aprovada (só a versão mobile; a versão desk
    # segue excluída, ver EXCLUDED_NOTE)
    "topo-hero": "assets/Imagens/topo/imagem topo mobile.png",
    # Dobra 03 / 04 / 07 — o que é a Scuderia
    "oque-esporte": "assets/Imagens/o que é/esporte.png",
    "oque-estrutura": "assets/Imagens/o que é/estrutura.png",
    "oque-experiencias": "assets/Imagens/o que é/experiencias.png",
    # Dobra 04 — Team Building (karts/drift; NUNCA legendar como Caterham)
    "race-experience-karts": "assets/Imagens/race experience/RACE EXPERIENCE.png",
    "team-building": "assets/Imagens/tem-building.jpeg",  # pit stop em equipe — foto do Team Building (04)
    # Dobra 04 — momento audiovisual (emoção.mp4 + apoio): bastidores reais do
    # pit lane, fornecidos pelo usuário (2026-09-24). Foto de apoio ao vídeo
    # protagonista, não substitui o Team Building acima.
    "experiencias-bastidores": "assets/Imagens/experiencias/bastidores.jpg",
    # Dobra 04 — os 5 cards de princípios ao lado do vídeo (2026-09-24, 3ª
    # rodada): fotos reais do acervo Caterham (Fazenda Capuava), copiadas
    # para Imagens/experiencias/principios/ (não dependem mais do projeto
    # Caterham externo).
    "principio-trabalho-equipe": "assets/Imagens/experiencias/principios/trabalho-em-equipe.jpg",
    "principio-confianca": "assets/Imagens/experiencias/principios/confianca.jpg",
    "principio-comunicacao": "assets/Imagens/experiencias/principios/comunicacao.jpg",
    "principio-tomada-decisao": "assets/Imagens/experiencias/principios/tomada-de-decisao.jpg",
    "principio-pressao": "assets/Imagens/experiencias/principios/atuacao-sob-pressao.jpg",
    # Dobra 07 — Conteúdo / Festival de Interlagos
    "evento-truck-lounge": "assets/Imagens/experiencia do evento/Truck Lounge.png",
    "evento-arquibancada": "assets/Imagens/experiencia do evento/Arquibancada.png",
    "evento-camarotes": "assets/Imagens/experiencia do evento/Camarotes.png",
    "evento-boxes": "assets/Imagens/experiencia do evento/Visitação aos Boxe.png",
    # Faixa de Autoridade / Pilotos & Time / Palestras — só os 4 nomes atuais
    "piloto-atila": "assets/Imagens/pilotos-premium/atila.png",
    "piloto-christian": "assets/Imagens/pilotos-premium/cristian.png",
    "piloto-ingo": "assets/Imagens/pilotos-premium/ingo.png",
    "piloto-nelsinho": "assets/Imagens/pilotos-premium/nelson.png",
    # Logo (interino — raster reduzido; pendência: pedir vetor/SVG real, ver item 9 do VISUAL-DIRECTION)
    "logo-raster": "Brand/1124_Bandeiras_RGB_L-RW.png",
    # Dobra 05 — Caterham: lockup oficial Scuderia Bandeiras x Caterham Motorsport
    # Brasil, extraído do projeto aprovado `Projeto-caterham/Caterham - V3`
    # (site em produção, distinto do material "Festival - Interlagos" pendente acima).
    "caterham-logo": "assets/Imagens/caterham/logo-scuderia-caterham.png",
    # Fundo do fecho ("O piloto conduz. Você sente.") — foto real do evento
    # (Fazenda Capuava), fornecida pelo cliente.
    "caterham-fecho-photo": "assets/Imagens/caterham/20260528_scuderiabandeiras_raceexperience_fazendacapuava_dudabairros-1000.jpg",
    # Caterham Esports Brasil (campeonato de simulador, 2026-10-14) — fotos reais
    # dos simuladores na Race Experience da Fazenda Capuava (Duda Bairros,
    # 26/07/2026), fornecidas pelo usuário. Substituem o 420R de estúdio que
    # ocupava a seção antes. Usadas na home (#campeonato-simulador) e na página
    # de inscrição (campeonato-simulador/).
    "esports-cockpit": "assets/Imagens/caterham/simulador/esports/simulador-1365.jpg",
    "esports-lado": "assets/Imagens/caterham/simulador/esports/simulador-4026.jpg",
    "esports-aberto": "assets/Imagens/caterham/simulador/esports/simulador-1273.jpg",
    "esports-piloto": "assets/Imagens/caterham/simulador/esports/simulador-3920.jpg",
    # Dobra 08 — mosaico "Somos todos Scuderia Bandeiras" (prova dos 50+ profissionais).
    # Arte atualizada pelo usuário (2026-09-25), substitui a versão anterior
    # ("imagem time bandeiras desk.jpg", removida). Item 7 continua aberto:
    # confirmar que Rubens Barrichello / Rafael Suzuki não estão no mosaico
    # ANTES de qualquer publicação.
    "time-mosaico": "assets/Imagens/nosso time/Mosaico.png",
    # Redesenho 2026-09-26 (pedido do usuário): volta ao layout de 2 recortes
    # + painel de texto central (em vez da imagem única full-bleed acima) —
    # mesma foto usada nos dois flancos (esquerdo/direito) da faixa.
    "time-mosaico-foto": "assets/Imagens/nosso time/Mosaico 1.png",
    # QA-054 (2026-09-30): o flanco direito deixa de repetir a mesma metade —
    # usa a parte complementar fornecida pelo time ("Mosaico 2.png").
    "time-mosaico-foto-2": "assets/Imagens/nosso time/Mosaico 2.png",
    # Dobra 10 — "Marcas que fazem parte da nossa história": arte pronta fornecida
    # pelo usuário como ativo oficial (2026-09-22), versão PNG transparente
    # ("marcas-que-fazem-parte-da-nossa-historia 1.png"). O recorte tira só a
    # área vazia das bordas; a transparência é preservada (sai AVIF + WebP).
    # Pendência da copy continua: lista final depende de aprovação comercial/jurídica.
    "marcas-historia": "assets/Imagens/marcas parceiras/marcas-historia-recorte.png",
    # Dobra "Também no escopo" — 4 fotos reais dos cards (2026-09-22).
    "escopo-caterham": "assets/Imagens/escopo/caterham-2032.jpg.jpeg",
    "escopo-ativacoes": "assets/Imagens/escopo/ativacoes.jpg.jpeg",
    "escopo-experiencias": "assets/Imagens/escopo/experiencias corporativas.jpg.jpeg",
    "escopo-projetos": "assets/Imagens/escopo/projetos.JPG.jpeg",
    # Dobra 03 — mosaico "O ecossistema" (5 peças): fotos reais fornecidas
    # pelo usuário (2026-09-23), uma por peça.
    "eco-pilotos": "assets/Imagens/ecossistema/pilotos.png",
    "eco-carros": "assets/Imagens/ecossistema/carros.jpeg",
    # QA-053 (2026-09-30): foto aprovada do espaço físico da Scuderia (fachada
    # com o logo, pátio e mural) para o painel 01 do Ecossistema.
    "eco-espaco-scuderia": "assets/Imagens/complexo/imagem-scuderia-complexo.png",
    "eco-pista": "assets/Imagens/ecossistema/pista.jpeg",
    "eco-estrutura": "assets/Imagens/ecossistema/estrutura.JPG.jpeg",
    "eco-producao": "assets/Imagens/ecossistema/producoes.jpg.jpeg",
}

EXCLUDED_NOTE = """
NÃO PROCESSADOS DE PROPÓSITO (ver doc/VISUAL-DIRECTION.md §16):
  - Projeto-caterham/Caterham - Festival - Interlagos/*  (pendente aprovação de direitos, item 6)
  - Imagens/nosso time/* exceto o mosaico               (o mosaico entrou só para revisão local; item 7 segue aberto)
  - Imagens/pilotos/*                                    (contém RAFAEL SUZUKI.png)
  - Imagens/pilotos-premium/{rafael-suzuki,rubens-barrichelo,pilotosfinal}.jpg
  - Imagens/topo/hero-conexoes-v2*.png                   (estética proibida: túnel IA, speed lines vermelhas)
  - Imagens/topo/imagem topo desk.png                    (contém Rubens/Rafael, badge Stock Car, velocímetro)
  - Imagens/marcas parceiras/MARCAS PARCEIRAS.png        (30 marcas, diverge da lista de 15 da copy;
                                                          a dobra 10 usa marcas-historia-recorte.png)
  - Imagens/lei de incentivo/*, Imagens/stock car em numeros/*  (fora de escopo / dado de terceiro)
  - carros/*, assets/car/*, Imagens/complexo/bg.jpg      (renders 3D / CGI, era Stock Car)
"""


# Sprint 05 (cache immutable): o hash do nome do arquivo é calculado sobre o ARQUIVO-FONTE.
# O vercel.json serve assets-build/img/*-<hash>.* com "Cache-Control: immutable" (1 ano).
# Por isso, se QUALQUER parâmetro de saída mudar (WIDTHS, AVIF_QUALITY, JPEG_QUALITY,
# recorte/redimensionamento) com a fonte igual, os bytes mudariam mantendo o mesmo nome e
# navegadores/CDN reteriam a versão antiga. Nesse caso, bumpe PIPELINE_VERSION: ele entra no
# hash e TODOS os nomes mudam. Vazio = hashes atuais inalterados.
PIPELINE_VERSION = ""


def content_hash(path: Path, length: int = 10) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    if PIPELINE_VERSION:
        h.update(PIPELINE_VERSION.encode("utf-8"))
    return h.hexdigest()[:length]


def has_real_alpha(im: Image.Image) -> bool:
    """True só se existir transparência de verdade (não um canal alfa 100% opaco)."""
    if im.mode == "P" and "transparency" in im.info:
        return True
    if im.mode in ("RGBA", "LA"):
        alpha = im.getchannel("A")
        return alpha.getextrema()[0] < 255
    return False


def build_one(slug: str, rel_src: str, dry_run: bool) -> dict:
    src = SRC_ROOT / rel_src
    if not src.exists():
        print(f"  [FALTA] {slug}: {rel_src} não encontrado", file=sys.stderr)
        return {}

    digest = content_hash(src)
    with Image.open(src) as im:
        alpha = has_real_alpha(im)
        # AVIF/WebP preservam transparência; JPEG não. Só usamos JPEG como
        # fallback quando NÃO há transparência real — senão o fallback
        # composita um fundo sólido por baixo do logo/recorte (bug real:
        # convert("RGB") direto acharia preto por padrão).
        fallback_ext = "webp" if alpha else "jpg"
        im = im.convert("RGBA") if alpha else im.convert("RGB")
        orig_w, orig_h = im.size
        aspect = orig_h / orig_w

        variants = {"avif": {}, fallback_ext: {}}
        usable_widths = [w for w in WIDTHS if w <= orig_w] or [orig_w]
        for w in usable_widths:
            h = round(w * aspect)
            resized = im.resize((w, h), Image.LANCZOS)
            base_name = f"{slug}-{w}w-{digest}"

            if not dry_run:
                out_avif = OUT_DIR / f"{base_name}.avif"
                out_fallback = OUT_DIR / f"{base_name}.{fallback_ext}"
                resized.save(out_avif, format="AVIF", quality=AVIF_QUALITY)
                if fallback_ext == "webp":
                    resized.save(out_fallback, format="WEBP", quality=JPEG_QUALITY)
                else:
                    resized.save(out_fallback, format="JPEG", quality=JPEG_QUALITY,
                                  progressive=True, optimize=True)

            variants["avif"][w] = f"assets-build/img/{base_name}.avif"
            variants[fallback_ext][w] = f"assets-build/img/{base_name}.{fallback_ext}"

        orig_size = src.stat().st_size
        print(f"  [OK] {slug:28s} {orig_w}x{orig_h} ({orig_size/1024:.0f} KB)"
              f"{' [alpha->webp]' if alpha else ''} -> "
              f"{len(usable_widths)} larguras" + (" [dry-run]" if dry_run else ""))

        return {
            "slug": slug,
            "source": rel_src,
            "original_size_bytes": orig_size,
            "width": orig_w,
            "height": orig_h,
            "aspect_ratio": round(orig_w / orig_h, 4),
            "has_alpha": alpha,
            "fallback_ext": fallback_ext,
            "avif": variants["avif"],
            fallback_ext: variants[fallback_ext],
        }


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    only_manifest = "--manifest" in sys.argv

    if not only_manifest:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        print(f"Processando {len(MANIFEST)} imagens confirmadas como seguras...")
        print(EXCLUDED_NOTE)

    manifest_out = {}
    for slug, rel_src in MANIFEST.items():
        entry = build_one(slug, rel_src, dry_run or only_manifest)
        if entry:
            manifest_out[slug] = entry

    manifest_path = ROOT / "assets-build" / "manifest.json"
    if not only_manifest and not dry_run:
        manifest_path.write_text(json.dumps(manifest_out, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nManifesto gravado em {manifest_path.relative_to(ROOT)}")
    else:
        print(json.dumps(manifest_out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
