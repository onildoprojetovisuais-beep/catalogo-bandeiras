#!/usr/bin/env python3
"""
Build de CSS — Sprint 04 (performance).

Concatena css/tokens.css + css/base.css + css/components.css + css/race-league.css
(ordem original; race-league.css entrou em 2026-11-02, escopo .rl) em
css/site.min.css removendo SÓ comentários e espaços redundantes. Não reescreve
regras, não reordena, não toca em valores: a cascata e as @layer ficam idênticas
(uma folha com as três em sequência = as três folhas em sequência).

Os arquivos-fonte comentados continuam sendo a fonte da verdade; edite-os e rode:
    python scripts/build-css.py
Ordem do pipeline: build-media.py -> build-css.py -> build-html.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ["tokens.css", "base.css", "components.css", "race-league.css"]
OUT = ROOT / "css" / "site.min.css"


def strip_comments(css: str) -> str:
    """Remove /* ... */ respeitando strings e url()."""
    out, i, n = [], 0, len(css)
    while i < n:
        c = css[i]
        if c in "\"'":
            q, j = c, i + 1
            while j < n and css[j] != q:
                j += 2 if css[j] == "\\" else 1
            out.append(css[i : j + 1])
            i = j + 1
        elif css.startswith("/*", i):
            j = css.find("*/", i + 2)
            i = n if j == -1 else j + 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


def squeeze(css: str) -> str:
    """Colapsa espaços e tira os desnecessários ao redor de { } ; , (sem mexer em ':'/operadores)."""
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};,])\s*", r"\1", css)
    css = css.replace(";}", "}")
    return css.strip()


def main() -> None:
    parts = []
    total_in = 0
    for name in SOURCES:
        src = (ROOT / "css" / name).read_text(encoding="utf-8")
        total_in += len(src.encode("utf-8"))
        parts.append(squeeze(strip_comments(src)))
    out = "\n".join(parts) + "\n"
    OUT.write_text(out, encoding="utf-8")
    print(f"{OUT.name}: {total_in} B -> {len(out.encode('utf-8'))} B")


if __name__ == "__main__":
    sys.exit(main())
