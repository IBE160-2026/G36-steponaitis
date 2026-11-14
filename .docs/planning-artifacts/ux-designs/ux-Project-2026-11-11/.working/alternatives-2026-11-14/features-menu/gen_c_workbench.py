"""C: Workbench. Every step as a tile that previews its screen and reports its state; a Next up card says what to do now."""
import os
from fm_common import *  # noqa: F401,F403

SX, SY, SW, SH = 24, 76, 1392, 812     # sheet
GX, GY = 48, 176                       # tile grid origin
TW, TH, TG = 238, 268, 16              # tile size and gap
RX = GX + 4 * TW + 3 * TG + TG         # right column x
RW = SX + SW - 24 - RX                 # right column width


def mini_bin(x, y, c, w, h):
    return (rect(x, y, w, h, CLS[c], 2) +
            rect(x + 2.5, y + h * 0.3, w - 5, h * 0.46, "#fff", 1) +
            f'<use href="#{GLY[c]}" x="{x + w/2 - h*0.17:.1f}" y="{y + h*0.36:.1f}" width="{h*0.34:.1f}" height="{h*0.34:.1f}"/>')


def mini_wall(x, y, w, rows, best_row=None, h_bin=24):
    """rows top to bottom; cells F/M/S/D/. ; returns svg."""
    n = len(rows[0])
    pad, gap = 10, 3
    lab = 40 if best_row is not None else 0
    bw = (w - 2 * pad - lab - (n - 1) * gap) / n
    lvl = h_bin + 9
    hh = len(rows) * lvl + 10
    o = [rect(x, y, w, hh, "url(#louvre2)", 6)]
    for r, row in enumerate(rows):
        by = y + 6 + r * lvl
        for c_, ch in enumerate(row):
            bx = x + pad + lab + c_ * (bw + gap)
            o.append(slot(bx, by, bw, h_bin) if ch == "." else mini_bin(bx, by, ch, bw, h_bin))
        beam = BEST if best_row == r else "#1F2326"
        o.append(rect(x + pad + lab - 3, by + h_bin + 2, w - 2 * pad - lab + 6, 4, beam))
        if lab:
            o.append(t(x + 8, by + (8 if best_row == r else 16), f"L{len(rows) - r}", 12, ONDARK, LB))
            if best_row == r:
                o.append(rect(x + 6, by + 12, 32, 14, BEST, 2) + t(x + 22, by + 23, "BEST", 11, INK, LB, "middle"))
    return "".join(o)


def state_head(x, y, i, state):
    """Top row of a tile: step disc + state word."""
    cx, cy = x + 28, y + 30
    if state == "current":
        o = step_disc(cx, cy, i + 1, "current", r=13, dark=False)
        o += rect(cx + 20, cy - 12, 92, 24, "#fff", 3, INK, 1.5) + t(cx + 66, cy + 5, "You are here", 12.5, INK, "b w7", "middle")
    elif state == "done":
        o = step_disc(cx, cy, i + 1, "done", r=11, dark=False) + t(cx + 20, cy + 5, f"Step {i+1} · done", 12.5, INK2, "b w6")
    else:
        o = step_disc(cx, cy, i + 1, "todo", r=11, dark=False) + t(cx + 20, cy + 5, f"Step {i+1} · output", 12.5, INK2, "b w6")
    return o


def tile(i, state, stat, sub, visual, action):
    col, row = i % 4, i // 4
    x, y = GX + col * (TW + TG), GY + row * (TH + TG)
    cur = state == "current"
    o = [rect(x, y, TW, TH, "#fff", 8, INK if cur else BORDER, 2 if cur else 1)]
    o.append(state_head(x, y, i, state))
    tg, _ = code_tag(x + TW - 16, y + 20, CODES[i], anchor_end=True)
    o.append(tg)
    o.append(t(x + 16, y + 78, STEPS[i], 24 if tw(STEPS[i], 24, "lb w7") < TW - 32 else 22, INK, LB))
    o.append(visual(x + 16, y + 94, TW - 32))
    o.append(t(x + 16, y + 194, stat, 13.5, INK, "b w7"))
    o.append(t(x + 16, y + 213, sub, 12.5, INK2))
    if cur:
        o.append(rect(x + 16, y + TH - 46, TW - 32, 36, INK, 6))
        o.append(icon("i-check", x + 28, y + TH - 39, 18, "#fff"))
        o.append(t(x + 54, y + TH - 25, action, 14, "#fff", "b w7"))
    else:
        o.append(rect(x + 16, y + TH - 40, TW - 32, 1, HAIR))
        o.append(t(x + 16, y + TH - 16, action, 13.5, INK, "b w7", extra=' text-decoration="underline"'))
        o.append(icon("i-arrow-r", x + TW - 34, y + TH - 30, 18, INK))
    return "".join(o)


# ---------------------------------------------------------------- visuals (x, y, w) -> svg, ~90px tall
def v_overview(x, y, w):
    counts = [("F", 142), ("M", 310), ("S", 457), ("D", 636)]
    total = sum(n for _, n in counts)
    o, cx = [], x
    for c, n in counts:
        sw_ = w * n / total
        o.append(rect(cx, y + 8, sw_ - 2, 26, CLS[c], 2))
        cx += sw_
    for k, (c, n) in enumerate(counts):
        lx = x + k * (w / 4)
        o.append(mini_bin(lx, y + 48, c, 18, 18))
        o.append(t(lx + 22, y + 62, f"{n}", 13, INK, LB))
    return "".join(o)


def v_parts(x, y, w):
    o = []
    for k, (pn, picks) in enumerate((("4410281", "61"), ("9723950", "44"), ("5315766", "37"))):
        ry = y + 2 + k * 27
        o.append(t(x, ry + 17, f"#{k+1}", 14, INK, LB))
        o.append(mini_bin(x + 28, ry + 2, "F", 20, 20))
        o.append(t(x + 56, ry + 17, pn, 14, INK, LB))
        o.append(t(x + w, ry + 17, f"{picks} picks", 12.5, INK2, anchor="end"))
        if k < 2:
            o.append(rect(x, ry + 25, w, 1, HAIR))
    return "".join(o)


def v_locations(x, y, w):
    return mini_wall(x, y + 4, w, [list("FM.SD.MS"), list("SF.DMSFM")])


def v_groups(x, y, w):
    o = [mini_bin(x + 20, y + 6, "F", 40, 40), mini_bin(x + 116, y + 6, "M", 40, 40)]
    o.append(f'<path d="M{x+66} {y+26} H{x+110}" stroke="{INK}" stroke-width="1.6" stroke-dasharray="3 3"/>')
    o.append(f'<circle cx="{x+88}" cy="{y+26}" r="13" fill="#fff" stroke="{INK}" stroke-width="1.2"/>')
    o.append(icon("i-link", x + 79, y + 17, 18, INK))
    o.append(t(x + 40, y + 64, "4410281", 13, INK, LB, "middle"))
    o.append(t(x + 136, y + 64, "4410297", 13, INK, LB, "middle"))
    return "".join(o)


def v_best(x, y, w):
    o = [mini_wall(x, y + 4, w, [list("SD.MFS"), list("FFMF.F")], best_row=1)]
    return "".join(o)


def v_rec(x, y, w):
    o = [t(x, y + 50, "15", 60, INK, LB), t(x + 72, y + 26, "to apply", 15, INK, "b w7"),
         t(x + 72, y + 46, "or keep in place", 13, INK2)]
    # 19 recommendations: 3 applied, 1 outdated, 15 open
    segs = [(3, INK, None), (1, "url(#hatch)", BORDER), (15, "#fff", INK)]
    cx = x
    for n, f, s in segs:
        sw_ = w * n / 19
        o.append(rect(cx, y + 62, sw_ - 2, 14, f, 2, s, 1))
        cx += sw_
    return "".join(o)


def v_ba(x, y, w):
    o = [t(x, y + 14, "Fast-moving in best locations", 12, INK3)]
    for k, (lab, n) in enumerate((("Import", 58), ("Plan", 61))):
        ry = y + 26 + k * 30
        o.append(t(x, ry + 16, lab, 13, INK2, "b w6"))
        bw = (w - 92) * n / 70
        o.append(rect(x + 52, ry + 4, bw, 16, CLS["F"] if k else "#fff", 2, INK if not k else None, 1))
        o.append(t(x + 60 + bw, ry + 17, str(n), 14, INK, LB))
    return "".join(o)


def v_move(x, y, w):
    px, pw = x + 20, w - 40
    o = [rect(px, y, pw, 80, "#fff", 0, "#000", 1)]
    # a picture of the printed sheet (decorative): text as ruled bars, only the round box is lettered
    o.append(rect(px + 10, y + 9, pw * 0.62, 6, "#000"))
    o.append(rect(px + 10, y + 21, pw - 20, 1.2, "#000"))
    o.append(rect(px + 10, y + 27, 54, 16, "none", 0, "#000", 1.2))
    o.append(t(px + 37, y + 39.5, "ROUND 1", 11, "#000", LB, "middle"))
    for k in range(3):
        ly = y + 50 + k * 9.5
        o.append(rect(px + 10, ly, 7, 7, "none", 0, "#000", 1))
        o.append(rect(px + 22, ly + 2, 30, 3, "#000"))
        o.append(rect(px + 58, ly + 2, 34, 3, "#000", extra=' fill-opacity="0.55"'))
        o.append(rect(px + 98, ly + 2, 34, 3, "#000", extra=' fill-opacity="0.55"'))
    return "".join(o)


def make():
    o = [rec_page(), toolbar(current=6, launcher_open=True), dim(64, 0.55)]
    o.append(f'<g filter="url(#pop)">{rect(SX, SY, SW, SH, GROUND, 10)}</g>')
    # ---- head
    o.append(t(GX, 108, "WORKBENCH · EVERY FEATURE OF THIS PLAN", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    o.append(f'<text x="{GX}" y="146" class="lb w7" font-size="32" fill="{INK}">Spring re-slot 2026'
             f'<tspan class="b w4" font-size="14" fill="{INK2}" dx="16">Data as of 2026-09-30 · round 1 · 15 recommendations to decide</tspan></text>')
    sx_ = RX
    o.append(rect(sx_, 106, RW - 56, 44, "#fff", 6, INPUT_B, 1))
    o.append(icon("i-search", sx_ + 14, 118, 20, INK))
    o.append(t(sx_ + 44, 134, "Go to: code or name", 14, INK3))
    k, kw = keys(0, 0, ["Ctrl", "K"])
    k, _ = keys(sx_ + RW - 56 - 12 - kw, 117, ["Ctrl", "K"])
    o.append(k)
    o.append(rect(SX + SW - 24 - 44, 106, 44, 44, "#fff", 6, BORDER, 1))
    o.append(icon("i-x", SX + SW - 24 - 33, 117, 22, INK))
    # ---- tiles
    tiles = [
        ("done", "1,545 parts by class", "2,000 locations · as of 2026-09-30", v_overview, "Open Overview"),
        ("done", "142 fast · 636 dead stock", "Ranked by picks in the period", v_parts, "Open Parts"),
        ("done", "79.2% occupied · 416 empty", "Bin wall per aisle, or a list", v_locations, "Open the wall"),
        ("done", "214 pick groups", "Top pair: 14 shared jobs", v_groups, "Open Pick groups"),
        ("done", "174 best · 7 empty", "6 marks: aisle, level, location", v_best, "Edit best-location marks"),
        ("current", "3 applied · 1 outdated", "31 no space · 19 in round 1", v_rec, "Continue round 1"),
        ("todo", "Moves in and out per aisle", "Updates after every move", v_ba, "Open Before/after"),
        ("todo", "3 moves · 1 round", "A4, black and white", v_move, "Print the move list"),
    ]
    for i, (st, stat, sub, vis, act) in enumerate(tiles):
        assert tw(stat, 13.5, "b w7") < TW - 20, stat
        o.append(tile(i, st, stat, sub, vis, act))
    # ---- right column: Next up
    ny = GY
    o.append(rect(RX, ny, RW, TH, INK, 8))
    o.append(t(RX + 22, ny + 34, "NEXT UP", 12, ONDARK2, "lb w7", extra=' letter-spacing="1.3"'))
    o.append(t(RX + 22, ny + 70, "Decide the 15 open", 27, "#fff", LB))
    o.append(t(RX + 22, ny + 100, "recommendations", 27, "#fff", LB))
    for k_, line in enumerate(("Apply each one or keep the part in",
                               "place. Then run round 2, check",
                               "Before/after and print the move list.")):
        o.append(t(RX + 22, ny + 130 + k_ * 20, line, 13.5, ONDARK))
    o.append(rect(RX + 22, ny + 198, RW - 44, 40, "#fff", 6))
    o.append(t(RX + 38, ny + 223, "Open #1 · 4410281 Brake pads", 14, INK, "b w7"))
    o.append(icon("i-arrow-r", RX + RW - 52, ny + 209, 18, INK))
    # ---- right column: Plans
    py = GY + TH + TG
    o.append(rect(RX, py, RW, TH, "#fff", 8, BORDER, 1))
    o.append(t(RX + 20, py + 32, "PLANS", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    o.append(t(RX + RW - 20, py + 32, "All saved plans (SAV)", 13, INK, "b w7", "end", ' text-decoration="underline"'))
    plans = [("Autumn tidy 2026", "Data as of 2026-08-31 · round 2 · 41 moves"),
             ("Aisle A fast-movers trial", "Data as of 2026-09-30 · round 1 · 12 moves"),
             ("Dead stock sweep", "Data as of 2026-06-30 · no moves yet")]
    for k_, (n, s) in enumerate(plans):
        ry = py + 46 + k_ * 48
        o.append(rect(RX + 20, ry, RW - 40, 1, HAIR))
        o.append(t(RX + 20, ry + 22, n, 14, INK, "b w7"))
        o.append(t(RX + 20, ry + 40, s, 12, INK2))
        o.append(icon("i-chev-r", RX + RW - 38, ry + 14, 18, INK2))
    by = py + TH - 64
    o.append(rect(RX + 20, by, 118, 40, "#fff", 6, INK, 1))
    o.append(icon("i-plus", RX + 32, by + 11, 18, INK))
    o.append(t(RX + 56, by + 25, "New Plan", 14, INK, "b w7"))
    o.append(rect(RX + 148, by, RW - 168, 40, "#fff", 6, BORDER, 1))
    o.append(icon("i-sliders", RX + 160, by + 11, 18, INK))
    o.append(t(RX + 184, by + 25, "Analysis settings", 13.5, INK, "b w7"))
    # ---- bottom band: stage 2 + keyboard
    bb = GY + 2 * TH + 2 * TG + 8
    o.append(t(GX, bb + 14, "COMING IN STAGE 2", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    for k_, (code, name) in enumerate((("CAT", "Category check"), ("LBL", "Location labels"))):
        ix = GX + k_ * (TW + TG)
        o.append(rect(ix, bb + 28, TW, 48, "none", 6, INPUT_B, 1.2, ' stroke-dasharray="5 4"'))
        o.append(icon("i-lock", ix + 14, bb + 43, 18, INK3))
        o.append(t(ix + 42, bb + 57, code, 15, INK3, LB))
        o.append(t(ix + 80, bb + 57, name, 14, INK2, "b w6"))
    kx = GX + 2 * (TW + TG)
    o.append(t(kx, bb + 14, "KEYBOARD", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    rows = [(["Ctrl", "K"], "Open the workbench"), (["Ctrl", "/"], "Search the page"), (["Esc"], "Close"),
            (["Alt", "A"], "Apply"), (["Alt", "O"], "Other location"), (["Alt", "K"], "Keep in place")]
    for k_, (ks, lab) in enumerate(rows):
        cx = kx + (k_ % 3) * 270
        cy = bb + 28 + (k_ // 3) * 30
        k, w = keys(cx, cy, ks)
        o.append(k + t(cx + w + 10, cy + 16, lab, 13, INK))
    return svg("Smart Warehouse Planner — Features menu C: Workbench",
               "Alternative C for the features menu: a paper workbench sheet over the dimmed Recommendations page. "
               "Eight step tiles each preview their screen (class bar, ranked parts, bin wall, pick group, best rail, open recommendations, "
               "before/after numbers, a printed move list) with state and counts; a Next up card, plans and settings, stage-2 slots and the keyboard box.",
               "\n".join(o))


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "C-workbench.svg")
    open(out, "w", encoding="utf-8").write(make())
    print("wrote", out)
