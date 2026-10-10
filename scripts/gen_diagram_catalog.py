#!/usr/bin/env python3
"""Генератор каталога схем Mermaid для сайта lovii.

Проходит по навигации сайта (mkdocs.yml), находит все блоки ```mermaid,
определяет тип диаграммы и ближайший заголовок раздела и собирает
страницу-каталог docs/research/diagram-catalog.md со ссылками на
страницы и якоря разделов.

Запуск: ./.venv/bin/python scripts/gen_diagram_catalog.py
"""
import os
import re
import pathlib
import yaml
from pymdownx.slugs import slugify as _slugify_factory

_SLUGIFY = _slugify_factory(casefold=True)

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

TYPE_NAMES = {
    "flowchart": "Блок-схема",
    "graph": "Блок-схема",
    "sequenceDiagram": "Последовательность",
    "erDiagram": "ER-диаграмма",
    "stateDiagram": "Стейт-машина",
    "stateDiagram-v2": "Стейт-машина",
    "gantt": "Диаграмма Ганта",
    "quadrantChart": "Квадрант",
    "classDiagram": "Диаграмма классов",
    "timeline": "Таймлайн",
}


def slugify(heading: str) -> str:
    """Тот же slugify, что в mkdocs.yml (pymdownx.slugs, casefold)."""
    s = re.sub(r"[*_`\[\]]", "", heading)  # markdown-разметка до парсера
    return _SLUGIFY(s, "-")


def parse_nav(items, group=""):
    """Список (группа верхнего уровня меню, путь относительно docs/)."""
    out = []
    for item in items:
        if isinstance(item, str):
            out.append((group, item))
        elif isinstance(item, dict):
            for title, value in item.items():
                if isinstance(value, str):
                    out.append((group or title, value))
                elif isinstance(value, list):
                    out.extend(parse_nav(value, title))
    return out


def parse_diagrams(path: pathlib.Path):
    """Список (заголовок раздела, тип диаграммы) по блокам ```mermaid."""
    lines = path.read_text(encoding="utf-8").split("\n")
    out = []
    heading = ""
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("```"):
            lang = line[3:].strip()
            j = i + 1
            while j < len(lines) and lines[j].strip() != "```":
                j += 1
            if lang == "mermaid":
                first = ""
                for k in range(i + 1, j):
                    if lines[k].strip():
                        first = lines[k].strip()
                        break
                typ = first.split()[0] if first else "?"
                out.append((heading, typ))
            i = j + 1
        else:
            m = re.match(r"^#{1,4}\s+(.*)$", line)
            if m:
                heading = m.group(1).strip()
            i += 1
    return out


def main():
    cfg = yaml.load(
        (ROOT / "mkdocs.yml").read_text(encoding="utf-8"), yaml.UnsafeLoader
    )
    nav = parse_nav(cfg["nav"])

    rows_by_section = {}
    order = []
    counts = {}
    total = 0
    pages_with = 0

    for section, path in nav:
        p = DOCS / path
        if not p.exists() or path.endswith("diagram-catalog.md"):
            continue
        diagrams = parse_diagrams(p)
        if not diagrams:
            continue
        pages_with += 1
        top = section
        if top not in rows_by_section:
            rows_by_section[top] = []
            order.append(top)
        for heading, typ in diagrams:
            tname = TYPE_NAMES.get(typ, typ)
            counts[tname] = counts.get(tname, 0) + 1
            total += 1
            anchor = slugify(heading) if heading else ""
            rel = os.path.relpath(path, "research")  # каталог в research/
            rows_by_section[top].append((rel, heading, tname, anchor))

    out = []
    out.append("# Каталог схем сайта")
    out.append("")
    out.append(
        f"> Все диаграммы проекта в одном месте: **{total} схем на {pages_with} страницах**. "
        "Из любой строки каталога можно перейти прямо к схеме на её странице. "
        "Схемы автоматически перерисовываются при переключении светлой/тёмной темы."
    )
    out.append("")
    out.append("**Состав по типам:**")
    out.append("")
    out.append("| Тип | Количество |")
    out.append("|---|---|")
    for tname, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        out.append(f"| {tname} | {n} |")
    out.append("")

    n = 0
    for top in order:
        out.append(f"## {top}")
        out.append("")
        out.append("| № | Схема | Тип | Переход |")
        out.append("|---|---|---|---|")
        for rel, heading, tname, anchor in rows_by_section[top]:
            n += 1
            name = heading if heading else "(в начале страницы)"
            if anchor:
                page_link = f"[к схеме]({rel}#{anchor})"
            else:
                page_link = f"[к схеме]({rel})"
            out.append(f"| {n} | {name} | {tname} | {page_link} |")
        out.append("")

    (DOCS / "research" / "diagram-catalog.md").write_text(
        "\n".join(out) + "\n", encoding="utf-8"
    )
    print(f"Каталог создан: {total} схем, {pages_with} страниц, секций: {len(order)}")
    for tname, c in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {tname}: {c}")


if __name__ == "__main__":
    main()
