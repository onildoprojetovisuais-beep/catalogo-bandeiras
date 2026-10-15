#!/usr/bin/env python3
"""
Build de HTML — expande <x-img> em <picture> real usando assets-build/manifest.json.

Site estático, sem framework, sem bundler (doc/VISUAL-DIRECTION.md §4). Este
script substitui só a tag customizada <x-img>; todo o resto do HTML é editado
à mão em index.template.html e passa direto.

Uso:
    python scripts/build-html.py

Tag de origem (em index.template.html):
    <x-img slug="complexo-6" alt="Texto alternativo real" sizes="100vw"
           loading="lazy" fetchpriority="auto" class="foo"></x-img>

Vira:
    <picture class="foo">
      <source type="image/avif" srcset="...480w, ...800w, ...1280w" sizes="100vw">
      <img src="...maior-fallback..." srcset="...fallback larguras..." sizes="100vw"
           width="W" height="H" alt="Texto alternativo real" loading="lazy" decoding="async">
    </picture>

`loading="eager"` e `fetchpriority="high"` devem ser usados só no candidato a
LCP (no máximo 1 por página, tipicamente a imagem do Hero).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "assets-build" / "manifest.json"
# (template, saída, prefixo dos caminhos de assets-build). Páginas em subpasta usam
# prefixo "/" porque os caminhos do manifesto são relativos à raiz do site.
PAGES = [
    (ROOT / "index.template.html", ROOT / "index.html", ""),
    (ROOT / "campeonato-simulador" / "index.template.html", ROOT / "campeonato-simulador" / "index.html", "/"),
    (ROOT / "campeonato-simulador" / "seletiva" / "index.template.html", ROOT / "campeonato-simulador" / "seletiva" / "index.html", "/"),
]

TAG_RE = re.compile(r"<x-img\s+([^>]*?)/?>\s*(?:</x-img>)?", re.IGNORECASE)
ATTR_RE = re.compile(r'([a-zA-Z_-]+)\s*=\s*"([^"]*)"')


def parse_attrs(attr_str: str) -> dict:
    return {m.group(1): m.group(2) for m in ATTR_RE.finditer(attr_str)}


def build_picture(attrs: dict, manifest: dict, prefix: str = "") -> str:
    slug = attrs.get("slug")
    if not slug or slug not in manifest:
        raise ValueError(f"<x-img> com slug desconhecido ou ausente: {attrs}")

    entry = manifest[slug]
    fallback_ext = entry["fallback_ext"]
    avif = {w: prefix + u for w, u in entry["avif"].items()}
    fallback = {w: prefix + u for w, u in entry[fallback_ext].items()}
    widths = sorted(int(w) for w in avif.keys())
    sizes = attrs.get("sizes", "100vw")

    avif_srcset = ", ".join(f"{avif[str(w)]} {w}w" for w in widths)
    fallback_srcset = ", ".join(f"{fallback[str(w)]} {w}w" for w in widths)
    largest = fallback[str(widths[-1])]

    loading = attrs.get("loading", "lazy")
    fetchpriority_attr = f' fetchpriority="{attrs["fetchpriority"]}"' if "fetchpriority" in attrs else ""
    decoding = "sync" if loading == "eager" else "async"
    css_class = f' class="{attrs["class"]}"' if "class" in attrs else ""
    alt = attrs.get("alt", "")
    if alt == "":
        # decorativa explícita: alt="" precisa ser passado por quem escreve o
        # template — se não veio nenhum atributo alt, é erro de autor, não
        # decoração silenciosa.
        if "alt" not in attrs:
            raise ValueError(f"<x-img slug=\"{slug}\"> sem atributo alt (use alt=\"\" se for decorativa)")

    mime = "image/webp" if fallback_ext == "webp" else "image/jpeg"

    return (
        f'<picture{css_class}>'
        f'<source type="image/avif" srcset="{avif_srcset}" sizes="{sizes}">'
        f'<source type="{mime}" srcset="{fallback_srcset}" sizes="{sizes}">'
        f'<img src="{largest}" width="{entry["width"]}" height="{entry["height"]}" '
        f'alt="{alt}" loading="{loading}" decoding="{decoding}"{fetchpriority_attr}>'
        f'</picture>'
    )


def build_page(template_path: Path, output_path: Path, prefix: str, manifest: dict) -> None:
    template = template_path.read_text(encoding="utf-8")

    count = 0
    errors = []

    def replace(match: re.Match) -> str:
        nonlocal count
        attrs = parse_attrs(match.group(1))
        try:
            result = build_picture(attrs, manifest, prefix)
            count += 1
            return result
        except ValueError as e:
            errors.append(str(e))
            return match.group(0)

    output = TAG_RE.sub(replace, template)

    # Sprint 04: comentarios HTML sao documentacao interna (~15 KB) - fora do build publico.
    output = re.sub(r"<!--.*?-->", "", output, flags=re.S)
    output = re.sub(r"\n[ \t]*(?:\n[ \t]*)+\n", "\n\n", output)

    if errors:
        print(f"ERROS ao expandir <x-img> em {template_path.name}:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    output_path.write_text(output, encoding="utf-8")
    print(f"{count} <x-img> expandidas -> {output_path.relative_to(ROOT)}")


def main() -> None:
    if not MANIFEST_PATH.exists():
        print("assets-build/manifest.json não existe — rode scripts/build-media.py primeiro.", file=sys.stderr)
        sys.exit(1)

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    for template_path, output_path, prefix in PAGES:
        if not template_path.exists():
            print(f"{template_path.relative_to(ROOT)} não encontrado.", file=sys.stderr)
            sys.exit(1)
        build_page(template_path, output_path, prefix, manifest)


if __name__ == "__main__":
    main()
