"""A: Command palette. Search-first, verbs and pages in one list, preview of what the highlighted item does."""
import os
from fm_common import *  # noqa: F401,F403

PX, PW, PY = 250, 940, 92
SEP = "\u00a0\u00a0·\u00a0\u00a0"
LW = 540                     # results column width; preview takes the rest
IN_H, STRIP_H, FOOT_H = 68, 50, 48


def title_with_match(x, y, pre, match, post, size=15):
    return (f'<text x="{x}" y="{y}" class="b w6" font-size="{size}" fill="{INK}">{pre}'
            f'<tspan class="b w7" text-decoration="underline">{match}</tspan>{post}</text>')


def group(x, y, label, n):
    return t(x, y, f"{label} · {n}", 12, INK3, "lb w7", extra=' letter-spacing="1.2"')


def row(y, ic, title, sub, right="", hl=False):
    """title = (pre, match, post)."""
    x = PX
    o = []
    if hl:
        o.append(rect(x + 10, y, LW - 20, 54, TINT, 6))
        o.append(rect(x + 10, y, 4, 54, ACCENT, 1))
    o.append(rect(x + 28, y + 13, 28, 28, "#fff" if hl else PANEL, 6, BORDER, 1))
    o.append(icon(ic, x + 33, y + 18, 18, INK))
    o.append(title_with_match(x + 70, y + 24, *title))
    o.append(t(x + 70, y + 43, sub, 12.5, INK2))
    o.append(right)
    return "".join(o)


def make():
    o = [rec_page(), toolbar(current=6, launcher_open=True), dim(64, 0.55)]
    ph = IN_H + STRIP_H + 560 + FOOT_H
    o.append(f'<g filter="url(#pop)">{rect(PX, PY, PW, ph, "#fff", 10)}</g>')
    o.append(rect(PX, PY, PW, ph, "none", 10, "#C9C6BE", 1))
    # ---- search input (the whole head of the palette)
    o.append(icon("i-search", PX + 26, PY + 22, 24, INK))
    o.append(t(PX + 66, PY + 43, "move", 22, INK, "b w5"))
    o.append(rect(PX + 66 + tw("move", 22, "b w5") + 9, PY + 22, 2, 28, INK))
    s, w = keycap(PX + PW - 110, PY + 23, "Esc")
    o.append(s + t(PX + PW - 110 + w + 8, PY + 39, "close", 13, INK2))
    o.append(rect(PX, PY + IN_H, PW, 1, HAIR))
    # ---- where you are
    sy = PY + IN_H
    o.append(rect(PX + 1, sy + 1, PW - 2, STRIP_H - 1, PANEL))
    o.append(t(PX + 26, sy + 31, "You are in", 13, INK2))
    o.append(f'<text x="{PX+100}" y="{sy+31}" class="b w5" font-size="13" fill="{INK}">'
             f'<tspan class="lb w7" font-size="15">Spring re-slot 2026</tspan>'
             f'{SEP}Recommendations, step 6 of 8{SEP}round 1{SEP}15 to apply</text>')
    fx = PX + PW - 30 - 7 * 30
    o.append(f'<path d="M{fx} {sy+25} H{fx + 5*30}" stroke="{INK}" stroke-width="2"/>')
    o.append(f'<path d="M{fx + 5*30} {sy+25} H{fx + 7*30}" stroke="{INK3}" stroke-width="1.5" stroke-dasharray="3 3"/>')
    for i in range(8):
        st = "done" if i < 5 else ("current" if i == 5 else "todo")
        o.append(step_disc(fx + i * 30, sy + 25, i + 1, st, r=8 if st != "current" else 10, dark=False))
    o.append(rect(PX, sy + STRIP_H, PW, 1, HAIR))
    # ---- body: results
    by = sy + STRIP_H
    bh = 560
    o.append(rect(PX + LW, by + 1, PW - LW - 1, bh - 1, PANEL))
    o.append(rect(PX + LW, by, 1, bh, HAIR))
    y = by + 30
    o.append(group(PX + 28, y, "ACTIONS", 3))
    y += 10
    o.append(row(y, "i-undo", ("Undo last ", "move", ""), "Move 3 · 9723950 goes back to A-03-04-02", hl=True))
    y += 56
    o.append(row(y, "i-lift", ("Manual ", "move", "…"), "Choose a part and the location it goes to"))
    y += 56
    s, kw = keys(0, 0, ["Alt", "A"])
    k, _ = keys(PX + LW - 26 - kw, y + 16, ["Alt", "A"])
    o.append(row(y, "i-check", ("Apply ", "move", " #4 (selected)"), "8044172 · A-12-04-02 → A-14-02-01", k))
    y += 56 + 30
    o.append(group(PX + 28, y, "GO TO", 2))
    y += 10
    tag, _ = code_tag(PX + LW - 26, y + 17, "MOV", anchor_end=True)
    o.append(row(y, "i-print", ("", "Move", " list"), "Step 8 · print view with tick boxes · 3 moves", tag))
    y += 56
    tag, _ = code_tag(PX + LW - 26, y + 17, "B/A", anchor_end=True)
    o.append(row(y, "i-compare", ("Before/after (", "move", "s in and out)"), "Step 7 · per aisle and total", tag))
    y += 56 + 30
    o.append(group(PX + 28, y, "HOW TO", 1))
    y += 10
    tag, _ = code_tag(PX + LW - 26, y + 17, "LOC", anchor_end=True)
    o.append(row(y, "i-wall", ("Drag a bin to ", "move", " or swap it"), "On the Locations wall · mouse only", tag))
    y += 56 + 30
    o.append(group(PX + 28, y, "PARTS, LOCATIONS AND PLANS", 0))
    o.append(t(PX + 28, y + 24, "No part, location or saved plan matches “move”.", 13, INK2))
    # ---- preview of the highlighted item
    qx, qw = PX + LW + 32, PW - LW - 64
    y = by + 34
    o.append(t(qx, y, "WHAT IT DOES", 12, INK3, "lb w7", extra=' letter-spacing="1.2"'))
    o.append(t(qx, y + 38, "Undo last move", 30, INK, LB))
    for i, line in enumerate(("Puts the last applied move back in the",
                              "planning copy. The part returns to its",
                              "from-location. One move at a time.")):
        o.append(t(qx, y + 72 + i * 21, line, 14, INK))
    cy = y + 148
    o.append(rect(qx, cy, qw, 128, "#fff", 6, BORDER, 1))
    o.append(swatch(qx + 18, cy + 16, "F", 30))
    o.append(t(qx + 60, cy + 30, "9723950", 16, INK, LB))
    o.append(t(qx + 60, cy + 48, "Headlight bulb H7 - Peugeot 308", 12.5, INK2))
    o.append(t(qx + 18, cy + 76, "now", 11.5, INK3, "b w6"))
    s1, w1 = chip(qx + 18, cy + 84, "A-05-01-03", 98)
    o.append(s1)
    o.append(icon("i-arrow-r", qx + 126, cy + 88, 18, INK))
    o.append(t(qx + 156, cy + 76, "back to", 11.5, INK3, "b w6"))
    s2, w2 = chip(qx + 156, cy + 84, "A-03-04-02", 98)
    o.append(s2)
    o.append(t(qx, cy + 156, "Recommendation #2 of rule 1 is open again.", 13, INK2))
    o.append(icon("i-info", qx, cy + 172, 18, INK))
    o.append(t(qx + 26, cy + 186, "A swap is two moves: undo it twice.", 13, INK2))
    o.append(t(qx, cy + 226, "ALSO ON", 12, INK3, "lb w7", extra=' letter-spacing="1.2"'))
    o.append(t(qx, cy + 248, "Recommendations, top right", 13, INK, "b w5"))
    o.append(t(qx, cy + 268, "The message after each move", 13, INK, "b w5"))
    # run button
    bty = by + bh - 76
    o.append(rect(qx, bty, qw, 46, INK, 6))
    o.append(icon("i-undo", qx + 18, bty + 14, 18, "#fff"))
    o.append(t(qx + 46, bty + 29, "Undo move 3", 15, "#fff", "b w7"))
    s, w = keycap(qx + qw - 64, bty + 12, "Enter", dark=True)
    o.append(s)
    # ---- footer: keys and codes
    fy = by + bh
    o.append(rect(PX, fy, PW, 1, HAIR))
    x = PX + 26
    for labs, word in ((["↑", "↓"], "move"), (["Enter"], "run"), (["Ctrl", "K"], "opens this anywhere")):
        s, w = keys(x, fy + 13, labs)
        o.append(s + t(x + w + 8, fy + 29, word, 13, INK2))
        x += w + 8 + tw(word, 13) + 22
    o.append(t(PX + PW - 26, fy + 29, "Or type a code: OVR PRT LOC GRP BST REC B/A MOV SAV NEW SET", 13, INK2, "b w5", "end"))
    return svg("Smart Warehouse Planner — Features menu A: Command palette",
               "Alternative A for the features menu: a search-first command palette over the dimmed Recommendations page. "
               "The query 'move' finds actions, pages and how-to tips in one grouped list with codes and shortcuts; "
               "a strip shows the plan and step 6 of 8, and a preview explains what the highlighted 'Undo last move' will do.",
               "\n".join(o))


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "A-command-palette.svg")
    open(out, "w", encoding="utf-8").write(make())
    print("wrote", out)
