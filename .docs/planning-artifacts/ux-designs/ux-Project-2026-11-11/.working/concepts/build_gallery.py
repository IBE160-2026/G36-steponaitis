"""Builds index.html: a gallery of the 10 SVG design concepts.

Run from anywhere:  uv run --with markdown python build_gallery.py
"""
from pathlib import Path
import html
import re
import markdown

ROOT = Path(__file__).resolve().parent
SURFACES = [
    ("warehouse-layout", "Warehouse layout"),
    ("interface", "Interface"),
    ("landing", "Landing page"),
    ("features-menu", "Features menu"),
    ("screen-map", "All other screens"),
]

concepts = []
for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and p.name[:2].isdigit()):
    md_path = d / "concept.md"
    md_text = md_path.read_text(encoding="utf-8") if md_path.exists() else ""
    title = d.name[3:].replace("-", " ").title()
    for line in md_text.splitlines():
        if line.startswith("#"):
            title = re.sub(r"^\d+\s*[·—–-]?\s*", "", line.lstrip("# ").strip())
            title = re.sub(r"^(Concept)\s*[:·—–-]?\s*", "", title).strip('"“” ')
            break
    body = "\n".join(l for l in md_text.splitlines() if not l.startswith("# ")) if md_text else ""
    concepts.append({
        "id": d.name,
        "num": d.name[:2],
        "title": title,
        "card": markdown.markdown(body, extensions=["tables"]),
        "files": {s: (d / f"{s}.svg").exists() for s, _ in SURFACES},
    })


def frame(cid, surface, label, big=False):
    src = f"{cid}/{surface}.svg"
    return (
        f'<figure class="frame{" big" if big else ""}">'
        f'<a class="open" href="{src}" target="_blank" rel="noopener" aria-label="Open {html.escape(label)} full size">'
        f'<object data="{src}" type="image/svg+xml" tabindex="-1" aria-hidden="true"></object></a>'
        f"<figcaption>{html.escape(label)}<a href=\"{src}\" target=\"_blank\" rel=\"noopener\">Open full size</a></figcaption></figure>"
    )


nav = "".join(
    f'<a href="#c{c["num"]}"><span class="n">{c["num"]}</span>{html.escape(c["title"])}</a>' for c in concepts
)

concept_sections = []
for c in concepts:
    frames = []
    for i, (s, label) in enumerate(SURFACES):
        if c["files"][s]:
            frames.append(frame(c["id"], s, label, big=i < 2))
        else:
            frames.append(f'<figure class="frame missing"><div>Missing: {s}.svg</div></figure>')
    concept_sections.append(
        f'<section class="concept" id="c{c["num"]}">'
        f'<header><span class="bignum">{c["num"]}</span><h2>{html.escape(c["title"])}</h2></header>'
        f'<div class="concept-body"><article class="card">{c["card"]}</article>'
        f'<div class="frames">{"".join(frames)}</div></div></section>'
    )

compare_sections = []
for s, label in SURFACES:
    cells = "".join(
        f'<div class="cmp"><span class="tag">{c["num"]} · {html.escape(c["title"])}</span>'
        + (frame(c["id"], s, label) if c["files"][s] else '<div class="missing">Missing</div>')
        + "</div>"
        for c in concepts
    )
    compare_sections.append(
        f'<section class="compare" id="s-{s}"><h2>{label}: all concepts</h2><div class="grid">{cells}</div></section>'
    )

surface_nav = "".join(f'<a href="#s-{s}">{label}</a>' for s, label in SURFACES)

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Warehouse Planner Concepts</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root {{
  --bg: #f3f3f1; --ink: #17181a; --muted: #5d6066; --rule: #d5d5d1; --panel: #ffffff; --accent: #2a4bd7;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{ --bg: #141517; --ink: #ececea; --muted: #a2a5ab; --rule: #34363a; --panel: #1d1f22; --accent: #8ea2ff; }}
}}
:root[data-theme="dark"] {{ --bg: #141517; --ink: #ececea; --muted: #a2a5ab; --rule: #34363a; --panel: #1d1f22; --accent: #8ea2ff; }}
* {{ box-sizing: border-box; }}
html {{ scroll-behavior: smooth; scroll-padding-top: 120px; }}
body {{ margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 "Hanken Grotesk", system-ui, sans-serif; }}
::selection {{ background: var(--accent); color: #fff; }}
a {{ color: var(--accent); text-underline-offset: 3px; }}
a:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 3px; }}
.top {{ position: sticky; top: 0; z-index: 5; background: var(--bg); border-bottom: 1px solid var(--rule); padding: 14px 32px 10px; }}
.top h1 {{ margin: 0 0 8px; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }}
.top h1 span {{ color: var(--muted); font-weight: 400; }}
.navrow {{ display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 6px; }}
.navrow b {{ font-size: 13px; color: var(--muted); font-weight: 500; margin-right: 6px; min-width: 92px; }}
.navrow a {{ font-size: 13px; text-decoration: none; color: var(--ink); border: 1px solid var(--rule); background: var(--panel); border-radius: 999px; padding: 3px 11px; }}
.navrow a:hover {{ border-color: var(--accent); color: var(--accent); }}
.navrow .n {{ font-variant-numeric: tabular-nums; color: var(--muted); margin-right: 6px; }}
main {{ padding: 8px 32px 80px; max-width: 1800px; margin: 0 auto; }}
.intro {{ max-width: 72ch; color: var(--muted); margin: 24px 0 8px; }}
.concept {{ padding: 48px 0 24px; border-bottom: 1px solid var(--rule); }}
.concept header {{ display: flex; align-items: baseline; gap: 16px; margin-bottom: 18px; }}
.bignum {{ font-size: 56px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }}
.concept h2 {{ margin: 0; font-size: 30px; letter-spacing: -0.02em; }}
.concept-body {{ display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: 28px; align-items: start; }}
.card {{ position: sticky; top: 130px; background: var(--panel); border: 1px solid var(--rule); border-radius: 10px; padding: 18px 20px; font-size: 14px; max-height: calc(100vh - 150px); overflow: auto; }}
.card h2, .card h3 {{ font-size: 15px; margin: 14px 0 4px; }}
.card p {{ margin: 0 0 10px; }}
.card ul {{ padding-left: 18px; margin: 0 0 10px; }}
.card code {{ font-size: 12.5px; }}
.frames {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }}
.frame {{ margin: 0; background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }}
.frame.big {{ grid-column: span 3; }}
.frame .open {{ display: block; aspect-ratio: 1440 / 900; position: relative; }}
.frame object {{ width: 100%; height: 100%; display: block; pointer-events: none; }}
.frame figcaption {{ display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; font-size: 13px; font-weight: 500; border-top: 1px solid var(--rule); }}
.frame figcaption a {{ font-weight: 400; }}
.missing {{ padding: 40px; color: var(--muted); text-align: center; }}
.compare {{ padding: 48px 0 16px; border-bottom: 1px solid var(--rule); }}
.compare h2 {{ font-size: 26px; letter-spacing: -0.02em; margin: 0 0 16px; }}
.compare .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }}
.cmp .tag {{ display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }}
.divider {{ margin-top: 64px; font-size: 13px; color: var(--muted); }}
@media (max-width: 900px) {{
  .top, main {{ padding-left: 16px; padding-right: 16px; }}
  .concept-body {{ grid-template-columns: 1fr; }}
  .card {{ position: static; max-height: none; }}
  .frames, .compare .grid {{ grid-template-columns: 1fr; }}
  .frame.big {{ grid-column: auto; }}
}}
</style>
</head>
<body>
<div class="top">
  <h1>Smart Warehouse Planner <span>· 10 design concepts · 2026-11-11</span></h1>
  <nav class="navrow" aria-label="Concepts"><b>By concept</b>{nav}</nav>
  <nav class="navrow" aria-label="Compare surfaces"><b>Compare</b>{surface_nav}</nav>
</div>
<main>
<p class="intro">Ten deliberately different directions, each drawn as SVG at 1440 × 900: warehouse layout and interface first (the two most important surfaces), then landing page, features menu and a sheet of all remaining screens. All data is synthetic. Click any frame to open it full size. "Compare" puts the same surface from all ten concepts side by side.</p>
{"".join(concept_sections)}
<p class="divider">Side-by-side comparison</p>
{"".join(compare_sections)}
</main>
</body>
</html>
"""
(ROOT / "index.html").write_text(page, encoding="utf-8")
print(f"Wrote {ROOT / 'index.html'} with {len(concepts)} concepts")
