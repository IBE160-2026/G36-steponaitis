"""Simplified, legible screen thumbnails for the screen-map alternatives (Bin Wall style).

Every drawer takes a box (x, y, w, h) in final sheet pixels and draws at fixed type sizes
(11px minimum), fitting as many rows as the box allows. Nothing is scaled down, so text
stays readable at any thumbnail size. Helpers and tokens come from the landing generator.
"""
import os, sys, random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "landing-redesign"))
from gen_landing import (t, logo, svg, INK, INK2, INK3, GROUND, SURF, BORDER, HAIR, BAND,  # noqa: E402,F401
                         ONDARK, ONDARK2, ONDARK_NAV, CLS, GLY, LBL, BEST, BEST_L, ACCENT, LB)

INPUT_B, ERR, ERR_T, TINT, QUIET = "#8A9097", "#D33A2C", "#FBE6E3", "#F3EFFD", "#FAFAF7"
TRACK, TRACK_E, MUTED_D = "#16191C", "#3A4046", "#9AA1A8"

STEPS = ["Overview", "Parts", "Locations", "Pick groups", "Best locations",
         "Recommendations", "Before/after", "Move list"]
CODES = ["OVR", "PRT", "LOC", "GRP", "BST", "REC", "B/A", "MOV"]

_uid = [0]


def uid(p="c"):
    _uid[0] += 1
    return f"{p}{_uid[0]}"


def tw(s, size, cls="b w4"):
    """Rough text width estimate (px) for layout checks."""
    f = 0.47 if "lb" in cls else (0.58 if ("w6" in cls or "w7" in cls) else 0.54)
    return len(s) * size * f


def fit(s, size, maxw, cls="b w4"):
    if tw(s, size, cls) <= maxw:
        return s
    while s and tw(s + "…", size, cls) > maxw:
        s = s[:-1]
    return s.rstrip(" ,·-–") + "…"


def rect(x, y, w, h, fill, rx=0, stroke=None, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"{s}{extra}/>'


def icon(name, x, y, s=16, c=INK):
    return f'<use href="#{name}" x="{x:.1f}" y="{y:.1f}" width="{s}" height="{s}" stroke="{c}" color="{c}"/>'


def hline(x, y, w, c=HAIR, h=1):
    return rect(x, y, w, h, c)


# ------------------------------------------------------------------ small parts
def mini_bin(x, y, c, w, h):
    o = [rect(x, y, w, h, CLS[c], 1.5), rect(x, y, w, max(1.5, h * 0.1), "#000", 1, extra=' fill-opacity="0.22"')]
    if w >= 9 and h >= 9:
        ww, wh = w - max(2, w * 0.18), min(h * 0.46, w * 0.62)
        wx, wy = x + (w - ww) / 2, y + h * 0.3
        o.append(rect(wx, wy, ww, wh, "#fff", 1))
        g = min(wh - 2, ww - 2, 9)
        o.append(f'<use href="#{GLY[c]}" x="{x + w/2 - g/2:.1f}" y="{wy + (wh-g)/2:.1f}" width="{g:.1f}" height="{g:.1f}"/>')
    return "".join(o)


def class_bin(x, y, c, w=34, h=32, label=True):
    """A bin with glyph + 3-letter label (used where there is room)."""
    o = [rect(x, y, w, h, CLS[c], 2), rect(x, y, w, 4, "#000", 1.5, extra=' fill-opacity="0.22"'),
         rect(x + 3, y + h * 0.3, w - 6, h * 0.46, "#fff", 1)]
    gy = y + h * 0.3 + (h * 0.46 - 9) / 2
    if label and w >= 40:
        o.append(f'<use href="#{GLY[c]}" x="{x+6:.1f}" y="{gy:.1f}" width="9" height="9"/>')
        o.append(t(f"{x+18:.1f}", f"{gy+8.5:.1f}", LBL[c], 11, INK, LB))
    else:
        o.append(f'<use href="#{GLY[c]}" x="{x + w/2 - 4.5:.1f}" y="{gy:.1f}" width="9" height="9"/>')
    return "".join(o)


def btn(x, y, label, kind="primary", h=24, size=11.5, icon_name=None):
    w = tw(label, size, "b w7") + 22 + (18 if icon_name else 0)
    if kind == "primary":
        o = rect(x, y, w, h, INK, 4)
        fg = "#fff"
    else:
        o = rect(x, y, w, h, "#fff", 4, INK if kind == "secondary" else INPUT_B, 1.1)
        fg = INK
    tx = x + 11
    if icon_name:
        o += icon(icon_name, x + 8, y + (h - 13) / 2, 13, fg)
        tx += 18
    o += t(f"{tx:.1f}", f"{y + h/2 + size*0.36:.1f}", label, size, fg, "b w7")
    return o, w


def btn_right(xr, y, label, kind="primary", h=24, size=11.5, icon_name=None):
    w = tw(label, size, "b w7") + 22 + (18 if icon_name else 0)
    return btn(xr - w, y, label, kind, h, size, icon_name)[0]


def tag(x, y, s, fill=INK, fg="#fff", size=11, h=16):
    w = tw(s, size, LB) + 10
    return rect(x, y, w, h, fill, 2) + t(f"{x + w/2:.1f}", f"{y + h - 4:.1f}", s, size, fg, LB, "middle"), w


def link(x, y, s, size=11.5, anchor=None):
    return t(x, y, s, size, INK, "b w7", anchor, ' text-decoration="underline"')


def page_title(x, y, s, size=18):
    return t(x, y, s, size, INK, LB)


def table(x, y, w, cols, rows, maxh, row_h=22, head=True, size=11.5, hl=None, quiet=None):
    """cols: list of (label, dx, anchor, cls). rows: list of lists of str. Returns (svg, used_h)."""
    o = [rect(x, y, w, 0, SURF)]
    hh = 20 if head else 0
    n = max(0, min(len(rows), int((maxh - hh - 2) // row_h)))
    H = hh + n * row_h
    o = [rect(x, y, w, H, SURF, 4, BORDER, 1)]
    if head:
        o.append(f'<path d="M{x} {y+4} a4 4 0 0 1 4 -4 H{x+w-4} a4 4 0 0 1 4 4 V{y+hh} H{x} Z" fill="{BAND}"/>')
        for lab, dx, anc, _ in cols:
            o.append(t(x + dx if anc != "end" else x + dx, y + 14, lab, 11, INK2, "b w6", anc))
    for i in range(n):
        ry = y + hh + i * row_h
        if hl is not None and i == hl:
            o.append(rect(x + 1, ry, w - 2, row_h, TINT))
            o.append(rect(x + 1, ry, 3, row_h, ACCENT))
        if i:
            o.append(hline(x + 1, ry, w - 2))
        for (lab, dx, anc, cls), val in zip(cols, rows[i]):
            fc = INK3 if (quiet and i in quiet) else INK
            o.append(t(x + dx, ry + row_h / 2 + size * 0.36, val, size, fc, cls, anc))
    return "".join(o), H


# ------------------------------------------------------------------ the wall
def wall_grid(seed, cols, levels=4, empty=0.12):
    r = random.Random(seed)
    cs = "FFMMSSSDDD"
    return [[("." if r.random() < empty else r.choice(cs)) for _ in range(cols)] for _ in range(levels)]


def mini_wall(x, y, w, h, grid, best=(), frames=(), lifted=None, target=None, labels=True, sec=4,
              sel=None):
    """grid rows from top level (L4) to L1. best: level numbers with a rail. lifted/target: (row, col)."""
    levels, cols = len(grid), len(grid[0])
    lab = 30 if labels else 6
    o = [rect(x, y, w, h, "url(#louvre2)", 5)]
    top, bot = 6, 6
    lh = (h - top - bot) / levels
    pitch = (w - lab - 6) / cols
    bw, bh = pitch - 2, lh - 6
    pos = {}
    for li, row in enumerate(grid):
        lvl = levels - li
        ly = y + top + li * lh
        isbest = lvl in best
        if labels:
            ty = ly + bh / 2 + (0 if isbest and bh >= 26 else 4)
            o.append(t(x + 7, ty, f"L{lvl}", 11, ONDARK, LB))
            if isbest and bh >= 26:
                o.append(rect(x + 4, ly + bh / 2 + 3, 24, 12, BEST, 1.5))
                o.append(t(x + 16, ly + bh / 2 + 12.5, "BEST", 8.5, INK, LB, "middle"))
        o.append(rect(x + lab - 2, ly + bh + 1.5, w - lab - 2, 2.5, BEST if isbest else "#1F2326"))
        for ci, c in enumerate(row):
            bx = x + lab + ci * pitch
            pos[(li, ci)] = (bx, ly, bw, bh)
            if c == ".":
                o.append(rect(bx, ly, bw, bh, "#141719", 1))
            else:
                o.append(mini_bin(bx, ly, c, bw, bh))
            if (li, ci) in frames:
                o.append(rect(bx - 1.5, ly - 1.5, bw + 3, bh + 3, "none", 2, BEST, 2))
    for s in range(0, cols + 1, sec):
        ux = x + lab + s * pitch - 2
        o.append(rect(ux, y + 4, 2, h - 8, "#454B52"))
    if target:
        bx, by, bw2, bh2 = pos[target]
        o.append(rect(bx, by, bw2, bh2, "#141719", 1))
        o.append(rect(bx - 2, by - 2, bw2 + 4, bh2 + 4, "none", 2.5, ACCENT, 2.2))
    if lifted:
        bx, by, bw2, bh2 = pos[lifted]
        o.append(rect(bx, by, bw2, bh2, "#141719", 1))
        o.append(rect(bx, by, bw2, bh2, "none", 1, "#fff", 1, ' stroke-dasharray="3 2"'))
        lx, ly2 = bx + 4, by - bh2 * 0.45
        if target:
            tx, ty, _, _ = pos[target]
            o.append(f'<path d="M{lx+bw2+2:.1f} {ly2+bh2*0.4:.1f} C {lx+bw2+40:.1f} {ly2:.1f}, {tx+bw2/2+30:.1f} {ty-26:.1f}, {tx+bw2/2:.1f} {ty-4:.1f}" '
                     f'fill="none" stroke="{ACCENT}" stroke-width="2.4" stroke-linecap="round" marker-end="url(#ahv)"/>')
        o.append(f'<g filter="url(#lift)">{mini_bin(lx, ly2, "F", bw2 + 2, bh2 + 2)}</g>')
    if sel:
        bx, by, bw2, bh2 = pos[sel]
        o.append(rect(bx - 2.5, by - 2.5, bw2 + 5, bh2 + 5, "none", 3, ACCENT, 2.4))
    return "".join(o), pos


def key_line(x, y, size=11, items=("F", "M", "S", "D"), names=("Fast", "Medium", "Slow", "Dead stock"), best=True):
    o = [t(x, y + 10, "Key", size, INK, "b w7")]
    cx = x + 30
    for c, n in zip(items, names):
        o.append(mini_bin(cx, y, c, 13, 13))
        o.append(t(cx + 17, y + 10, n, size, INK))
        cx += 17 + tw(n, size) + 12
    if best:
        o.append(rect(cx, y, 13, 13, "#141719", 1.5, BEST, 2))
        o.append(t(cx + 17, y + 10, "Best", size, INK))
    return "".join(o)


# ------------------------------------------------------------------ chrome
def toolbar(x, y, w, step=None, plan=True, h=30):
    """Mini app toolbar: logo, plate (if plan), flow-bar dots with the current step as a pill, launcher, avatar."""
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#louvre)"/>']
    o.append(f'<g transform="translate({x+7} {y+5}) scale(0.667)">{logo(0, 0)}</g>')
    if plan == "public":
        o.append(t(x + 34, y + 20, "Smart Warehouse Planner", 12.5, "#fff", LB))
        return "".join(o)
    right = x + w - 8
    # avatar + launcher
    o.append(f'<circle cx="{right-10}" cy="{y+h/2}" r="10" fill="{ONDARK}"/>')
    o.append(t(right - 10, y + h / 2 + 4, "JS", 10, INK, LB, "middle"))
    o.append(rect(right - 44, y + 5, 20, 20, TRACK, 3, TRACK_E, 1))
    o.append(icon("i-menu", right - 41, y + 8, 14, ONDARK))
    if not plan:
        o.append(t(x + 34, y + 20, "Smart Warehouse Planner", 12.5, "#fff", LB))
        return "".join(o)
    px = x + 34
    pw = 118
    o.append(rect(px, y + 5, pw, 20, "#fff", 2))
    o.append(rect(px, y + 5, 4, 20, INK, 1))
    o.append(t(px + 9, y + 19, "Spring re-slot 2026", 11, INK, LB))
    # flow steps
    fx = px + pw + 8
    fw = right - 52 - fx
    o.append(rect(fx, y + 4, fw, 22, TRACK, 4, TRACK_E, 1))
    cur = f"{step} {STEPS[step-1]}" if step else ""
    curw = (tw(cur, 11, LB) + 22) if step else 0
    dots = 8 - (1 if step else 0)
    dw = (fw - curw - 8) / max(dots, 1)
    cx = fx + 4
    for i in range(1, 9):
        if i == step:
            o.append(rect(cx, y + 7, curw, 16, "#fff", 3))
            o.append(f'<circle cx="{cx+9}" cy="{y+15}" r="5.5" fill="none" stroke="{INK}" stroke-width="1.2"/>')
            o.append(t(cx + 9, y + 18.5, str(i), 8.5, INK, LB, "middle"))
            o.append(t(cx + 18, y + 19, STEPS[i - 1], 11, INK, LB))
            cx += curw
        else:
            dcx = cx + dw / 2
            done = step is not None and i < step or step is None
            if done and i <= 7:
                o.append(f'<circle cx="{dcx:.1f}" cy="{y+15}" r="5.5" fill="{ONDARK_NAV}"/>')
                o.append(f'<path d="M{dcx-2.6:.1f} {y+15.2} l1.9 1.9 3.4 -3.6" fill="none" stroke="{INK}" stroke-width="1.3" stroke-linecap="round"/>')
            else:
                o.append(f'<circle cx="{dcx:.1f}" cy="{y+15}" r="5.5" fill="none" stroke="{MUTED_D}" stroke-width="1"/>')
            cx += dw
    return "".join(o)


def screen(x, y, w, h, body, chrome="plan", step=None, title=None, meta=None, pad=12, title_size=18):
    """Framed screen. body(bx, by, bw, bh) -> svg for the page content below the title."""
    cid = uid("clip")
    o = [f'<clipPath id="{cid}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7"/></clipPath>',
         rect(x, y, w, h, GROUND, 7), f'<g clip-path="url(#{cid})">']
    cy = y
    if chrome:
        o.append(toolbar(x, y, w, step, plan=(True if chrome == "plan" else ("public" if chrome == "public" else False))))
        cy += 30
    bx, bw = x + pad, w - 2 * pad
    by = cy + pad
    if title:
        o.append(page_title(bx, by + title_size * 0.8, title, title_size))
        by += title_size + 4
        if meta:
            o.append(t(bx, by + 11, fit(meta, 11, bw), 11, INK2))
            by += 17
        by += 6
    o.append(body(bx, by, bw, y + h - pad - by))
    o.append("</g>")
    o.append(rect(x, y, w, h, "none", 7, INK, 1.2))
    return "".join(o)


# ------------------------------------------------------------------ screen bodies
def body_saved(bx, by, bw, bh):
    o = [btn_right(bx + bw, by - 32, "New Plan", icon_name="i-plus")]
    wide = bw >= 330
    cols = [("Plan", 10, None, "b w7"), ("Data as of", bw * (0.47 if wide else 0.56), None, "lb w6")]
    if bw < 250:
        cols = [("Plan", 10, None, "b w7"), ("Edited", bw - 10, "end", "b w4")]
    if wide:
        cols.append(("Last edited", bw * 0.72, None, "b w4"))
    rows = [["Spring re-slot 2026", "2026-09-30", "today 09:47"],
            ["Aisle A fast-movers trial", "2026-09-30", "2026-11-08"],
            ["Autumn tidy 2026", "2026-08-31", "2026-10-21"],
            ["Dead stock sweep", "2026-06-30", "2026-07-14"]]
    maxw = (cols[1][1] - 16)
    if bw < 250:
        rows = [[r[0], r[2].replace("today ", "")] for r in rows]
        maxw = bw - 60
    rows = [[fit(r[0], 11.5, maxw, "b w7")] + r[1:] for r in rows]
    s, H = table(bx, by, bw, cols, rows, bh - 18, row_h=24)
    o.append(s)
    if bh - H > 20:
        o.append(t(bx, by + H + 17, fit("Saved automatically · shared by everyone who logs in", 11, bw), 11, INK2))
    return "".join(o)


def file_tile(x, y, w, name, ok=True, err=False):
    o = [rect(x, y, w, 40, "#fff", 4, ERR if err else INPUT_B, 1.5 if err else 1)]
    base = name.split(".")[0]
    if w < 120:
        o[0] = rect(x, y, w, 28, "#fff", 4, ERR if err else INPUT_B, 1.5 if err else 1)
        o.append(icon("i-file", x + 5, y + 7, 13, INK))
        o.append(t(x + 21, y + 18, fit(base, 11, w - 40, "b w7"), 11, INK, "b w7"))
        o.append(icon("i-alert" if err else "i-check", x + w - 17, y + 7, 13, ERR if err else INK))
        return "".join(o)
    o.append(t(x + 8, y + 15, base + " file", 11, INK2, "b w6"))
    o.append(icon("i-file", x + 6, y + 21, 13, INK))
    o.append(t(x + 22, y + 32, fit(name, 11, w - 30, "b w7"), 11, INK, "b w7"))
    if err:
        o.append(icon("i-alert", x + w - 18, y + 5, 13, ERR))
    elif ok:
        o.append(icon("i-check", x + w - 18, y + 5, 13, INK))
    return "".join(o)


def body_newplan(bx, by, bw, bh, error=False):
    o = [t(bx, by + 10, "Plan name", 11, INK, "b w6")]
    o.append(rect(bx, by + 16, min(bw, 240), 26, "#fff", 4, INPUT_B, 1))
    o.append(t(bx + 8, by + 33, "Autumn re-slot", 12, INK))
    fy = by + 54
    gw = (bw - 16) / 3
    if gw < 90:
        for i, n in enumerate(("Locations.xlsx", "Inventory.xlsx", "Transactions.xlsx")):
            ty = fy + i * 26
            o.append(rect(bx, ty, bw, 22, "#fff", 3, ERR if (error and i == 1) else INPUT_B, 1))
            o.append(icon("i-file", bx + 5, ty + 4, 13, INK))
            o.append(t(bx + 22, ty + 15, n, 11, INK, "b w7"))
            o.append(icon("i-alert" if (error and i == 1) else "i-check", bx + bw - 18, ty + 4, 13, ERR if (error and i == 1) else INK))
        ny = fy + 3 * 26 + 6
    else:
        for i, n in enumerate(("Locations.xlsx", "Inventory.xlsx", "Transactions.xlsx")):
            o.append(file_tile(bx + i * (gw + 8), fy, gw, n, ok=True, err=(error and i == 1)))
        ny = fy + (52 if gw >= 120 else 40)
    if error:
        eh = 46
        o.append(rect(bx, ny, bw, eh, ERR_T, 4, ERR, 1))
        o.append(icon("i-alert", bx + 7, ny + 7, 14, ERR))
        o.append(t(bx + 27, ny + 18, fit("Import stopped: nothing was saved.", 11.5, bw - 34, "b w7"), 11.5, INK, "b w7"))
        o.append(t(bx + 27, ny + 35, fit("Inventory.xlsx is missing the column Quantity.", 11, bw - 34), 11, INK))
        ny += eh + 10
    if ny + 24 <= by + bh:
        o.append(btn(bx, ny, "Import")[0])
        if bw > 250:
            o.append(link(bx + 78, ny + 16, fit("Or reuse the import of a saved plan", 11.5, bw - 84, "b w7")))
    return "".join(o)


def body_overview(bx, by, bw, bh):
    o = []
    data = [("F", "142", "fast"), ("M", "287", "medium"), ("S", "480", "slow"), ("D", "636", "dead stock")]
    gw = (bw - 18) / 4
    th = 64 if bh > 150 else 52
    for i, (c, n, lab) in enumerate(data):
        x = bx + i * (gw + 6)
        o.append(rect(x, by, gw, th, "#fff", 4, BORDER, 1))
        if gw < 80:
            o.append(class_bin(x + 6, by + 10, c, 17, 17, label=False))
            o.append(t(x + 28, by + 25, n, 16, INK, LB))
        else:
            o.append(class_bin(x + 8, by + 9, c, 22, 22, label=False))
            o.append(t(x + 36, by + 28, n, 19, INK, LB))
        o.append(t(x + 8, by + th - 10, lab if tw(lab, 11) <= gw - 12 else lab.split()[0], 11, INK2))
    y = by + th + 10
    lines = [("2,000 locations · 416 empty", "i-wall"), ("174 best locations · 7 empty", "i-ribbon"),
             ("1,545 parts · 3 kept in place", "i-box")]
    for s, ic in lines:
        if y + 18 > by + bh - (22 if bh > 150 else 0):
            break
        o.append(icon(ic, bx, y, 14, INK))
        o.append(t(bx + 20, y + 11, fit(s, 11.5, bw - 22), 11.5, INK))
        y += 19
    if y + 16 <= by + bh:
        o.append(link(bx, y + 12, "Settings this plan uses →"))
    return "".join(o)


PARTS = [("1", "F", "4410281", "Brake pads, front – VW Golf", "61"),
         ("2", "F", "9723950", "Headlight bulb H7 – Peugeot 308", "44"),
         ("3", "F", "4410297", "Brake disc, front – VW Golf", "38"),
         ("4", "F", "5315766", "Air filter – Audi A4", "37"),
         ("5", "F", "8044172", "Oil filter – Toyota Corolla", "33"),
         ("6", "F", "2555849", "Brake hose – Toyota Corolla", "29"),
         ("7", "M", "1180342", "Wiper blades – Skoda Octavia", "11")]


def body_parts(bx, by, bw, bh):
    o = [rect(bx, by, min(bw * 0.55, 220), 24, "#fff", 4, INPUT_B, 1), icon("i-search", bx + 6, by + 5, 14, INK3),
         t(bx + 26, by + 16, fit("Search part or description", 11, min(bw * 0.55, 220) - 30), 11, INK3)]
    # class filter chips
    cx = bx + min(bw * 0.55, 220) + 8
    for c in ("F", "M", "S", "D"):
        if cx + 26 > bx + bw:
            break
        o.append(rect(cx, by + 2, 22, 20, "#fff", 3, BORDER, 1))
        o.append(f'<use href="#{GLY[c]}" x="{cx+6}" y="{by+7}" width="10" height="10"/>')
        cx += 26
    y = by + 32
    rh = 30
    o.append(rect(bx, y, bw, 0, SURF))
    n = int((by + bh - y) // rh)
    rows = PARTS[:max(n, 0)]
    o.append(rect(bx, y, bw, len(rows) * rh, "#fff", 4, BORDER, 1))
    for i, (rk, c, pn, d, pk) in enumerate(rows):
        ry = y + i * rh
        if i:
            o.append(hline(bx + 1, ry, bw - 2))
        o.append(t(bx + 8, ry + 20, f"#{rk}", 13, INK, LB))
        o.append(mini_bin(bx + 30, ry + 6, c, 18, 18))
        o.append(t(bx + 56, ry + 19.5, pn, 12.5, INK, LB))
        o.append(t(bx + 108, ry + 19.5, fit(d, 11.5, bw - 108 - 64), 11.5, INK))
        o.append(t(bx + bw - 8, ry + 19.5, f"{pk} picks", 11.5, INK2, "b w4", "end"))
    return "".join(o)


def body_locations(bx, by, bw, bh, wall_only=False):
    o = []
    aisles = [("A", "86.8"), ("B", "85.1"), ("C", "82.0"), ("D", "78.9"), ("E", "77.2"),
              ("F", "80.7"), ("G", "75.0"), ("H", "78.5"), ("I", "65.3")]
    lw = 0 if wall_only else (78 if (bw >= 300 and bh >= 150) else 0)
    if lw:
        ah = min(22, (bh) / 9)
        for i, (a, p) in enumerate(aisles):
            ay = by + i * ah
            if ay + ah > by + bh + 1:
                break
            sel = i == 0
            o.append(rect(bx, ay, lw - 8, ah - 3, TINT if sel else "#fff", 3, INK if sel else BORDER, 1.2 if sel else 1))
            o.append(t(bx + 6, ay + ah / 2 + 3, a, 12, INK, LB))
            o.append(t(bx + lw - 14, ay + ah / 2 + 3, f"{p}%", 11, INK, LB, "end"))
    wx, ww = bx + lw, bw - lw
    o.append(t(wx, by + 12, "Aisle A", 15, INK, LB))
    o.append(t(wx + 52, by + 12, fit("86.8% · 30 empty", 11, ww - 150), 11, INK2))
    # Wall | List segmented
    sx = wx + ww - 78
    o.append(rect(sx, by, 78, 18, "#fff", 3, INK, 1))
    o.append(rect(sx + 1, by + 1, 38, 16, INK, 2))
    o.append(t(sx + 20, by + 13, "Wall", 11, "#fff", "b w7", "middle"))
    o.append(t(sx + 58, by + 13, "List", 11, INK, "b w6", "middle"))
    kh = 18 if bh > 120 else 0
    wh = bh - 24 - kh
    cols = max(8, int((ww - 30) // 17))
    cols -= cols % 4
    g = wall_grid(7, cols)
    s, _ = mini_wall(wx, by + 24, ww, wh, g, best=(1, 2))
    o.append(s)
    if kh:
        o.append(key_line(wx, by + bh - 13, 11, names=("Fast", "Medium", "Slow", "Dead"), best=ww > 300))
    return "".join(o)


def body_groups(bx, by, bw, bh):
    rows = [("4410281", "4410297", "Brake pads + disc, front – VW Golf", "14", "G / A", False),
            ("6900616", "7181839", "Timing belt kit + Alternator – Tucson", "7", "F / D", False),
            ("5315766", "8044172", "Air filter + Oil filter", "6", "C / A", False),
            ("2555849", "2555856", "Brake hose + Brake caliper – Corolla", "5", "E / E", True),
            ("3301877", "3301880", "Wiper blade set + Washer pump", "5", "B / B", True)]
    o = [t(bx, by + 10, fit("214 pick groups · 5 or more shared jobs · most first", 11, bw), 11, INK2)]
    y = by + 18
    rh = 36
    n = int((by + bh - y) // rh)
    rows = rows[:max(n, 0)]
    o.append(rect(bx, y, bw, len(rows) * rh, "#fff", 4, BORDER, 1))
    for i, (a, b, d, j, ai, same) in enumerate(rows):
        ry = y + i * rh
        if i:
            o.append(hline(bx + 1, ry, bw - 2))
        o.append(t(bx + 8, ry + 15, a, 12.5, INK, LB))
        o.append(icon("i-link", bx + 54, ry + 4, 13, INK))
        o.append(t(bx + 70, ry + 15, b, 12.5, INK, LB))
        o.append(t(bx + 8, ry + 30, fit(d, 11, bw - 120), 11, INK2))
        o.append(t(bx + bw - 8, ry + 15, f"{j} shared jobs", 11.5, INK, "b w6", "end"))
        st = f"aisles {ai} · {'same aisle' if same else 'apart'}"
        o.append(t(bx + bw - 8, ry + 30, st, 11, INK if same else INK2, "b w7" if same else "b w4", "end"))
    return "".join(o)


def body_best(bx, by, bw, bh):
    o = [t(bx, by + 13, "Mark", 11.5, INK, "b w7")]
    sx = bx + 36
    segs = ("Whole aisle", "Level", "Single location") if bw >= 300 else ("Aisle", "Level", "Single")
    for i, s in enumerate(segs):
        w = tw(s, 11, "b w7") + 16
        o.append(rect(sx, by, w, 19, INK if i == 1 else "#fff", 3, INK, 1))
        o.append(t(sx + w / 2, by + 13.5, s, 11, "#fff" if i == 1 else INK, "b w7", "middle"))
        sx += w + 5
    if sx + 110 < bx + bw:
        o.append(t(bx + bw, by + 13, "174 best · 7 empty", 11.5, INK, "b w7", "end"))
    ly = by + 28
    mw = bw if bw < 360 else bw - 142
    cols = max(8, int((mw - 30) // 16))
    cols -= cols % 4
    g = wall_grid(11, cols)
    s, _ = mini_wall(bx, ly, mw, bh - 28, g, best=(1, 2), frames={(0, 2), (1, 5)})
    o.append(s)
    if bw >= 360:
        mx = bx + mw + 12
        o.append(t(mx, ly + 12, "Marks (6)", 12, INK, "b w7"))
        marks = ["Level 1 in aisle A", "Level 2 in aisle A", "Level 1 in aisle B", "A-01-03-01", "A-01-03-02", "A-01-04-01"]
        for i, m in enumerate(marks):
            my = ly + 30 + i * 18
            if my > ly + bh - 34:
                break
            o.append(t(mx, my, fit(m, 11, 112), 11, INK, "lb w7" if "-" in m else "b w4"))
            o.append(icon("i-x", mx + 118, my - 10, 11, INK2))
    return "".join(o)


def body_recs(bx, by, bw, bh, crop=True):
    o = []
    # round chip + tabs
    o.append(rect(bx, by, 56, 20, "#fff", 3, INK, 1.2))
    o.append(rect(bx, by, 4, 20, INK, 1))
    o.append(t(bx + 31, by + 14, "Round 1", 11.5, INK, LB, "middle"))
    tabs = [("All", "19"), ("Rule 1", "9"), ("Rule 2", "6"), ("Rule 3", "4"), ("No space", "31")]
    tx = bx + 66
    for i, (a, n) in enumerate(tabs):
        w = tw(a, 11, "b w6") + tw(n, 11, LB) + 12
        if tx + w > bx + bw:
            break
        o.append(t(tx, by + 14, a, 11, INK, "b w7" if i == 0 else "b w5"))
        o.append(t(tx + tw(a, 11, "b w6") + 4, by + 14, n, 11, INK2, LB))
        if i == 0:
            o.append(rect(tx, by + 19, w - 8, 2, INK))
        tx += w + 4
    cw = 0
    if crop and bw >= 380:
        cw = min(150, bw * 0.34)
    lw = bw - cw - (10 if cw else 0)
    y = by + 28
    rh = 40
    rows = [("1", "F", "4410281", "Brake pads, front", "G-14-04-02", "A-02-01-01", "apply"),
            ("2", "F", "9723950", "Headlight bulb H7", "A-03-04-02", "A-05-01-03", "applied"),
            ("3", "F", "5315766", "Air filter – Audi A4", "C-05-02-01", "A-11-02-02", "outdated"),
            ("4", "F", "8044172", "Oil filter – Corolla", "A-12-04-02", "A-14-02-01", "apply"),
            ("5", "F", "2555849", "Brake hose – Corolla", "E-10-01-03", "A-17-01-02", "apply")]
    n = int((by + bh - y) // rh)
    rows = rows[:max(n, 0)]
    o.append(rect(bx, y, lw, len(rows) * rh, "#fff", 4, BORDER, 1))
    for i, (rk, c, pn, d, fr, to, st) in enumerate(rows):
        ry = y + i * rh
        if i:
            o.append(hline(bx + 1, ry, lw - 2))
        if i == 0:
            o.append(rect(bx + 1, ry + 1, lw - 2, rh - 1, TINT))
            o.append(rect(bx + 1, ry + 1, 3, rh - 1, ACCENT))
        if st == "outdated":
            o.append(rect(bx + 1, ry + 1, lw - 2, rh - 1, "url(#hatch)", extra=' opacity="0.6"'))
        fc = INK3 if st == "outdated" else INK
        o.append(t(bx + 9, ry + 18, f"#{rk}", 13, fc, LB))
        o.append(mini_bin(bx + 9, ry + 22, c, 14, 13))
        o.append(t(bx + 34, ry + 16, pn, 12.5, fc, LB))
        if lw >= 330:
            o.append(t(bx + 34, ry + 32, fit(d, 11, 118), 11, INK2))
        else:
            o.append(t(bx + 34, ry + 32, f"{fr}  →  {to}", 11.5, fc, LB))
        cx = bx + 160
        if lw >= 330:
            o.append(t(cx, ry + 16, fr, 11.5, fc, LB))
            o.append(t(cx + 62, ry + 16, "→", 11.5, fc))
            o.append(t(cx + 76, ry + 16, to, 11.5, fc, LB, extra=' text-decoration="line-through"' if st == "outdated" else ""))
            o.append(t(cx, ry + 32, "not best", 11, INK2))
            o.append(t(cx + 76, ry + 32, "no longer empty" if st == "outdated" else "best · aisle A", 11, INK2))
        ax = bx + lw - 8
        if lw < 330 and lw >= 230:
            if st == "apply":
                o.append(btn_right(ax, ry + 9, "Apply", h=22, size=11))
            elif st == "applied":
                o.append(icon("i-check", ax - 13, ry + 13, 13, INK))
            else:
                o.append(t(ax, ry + 24, "Outdated", 11, INK, "b w7", "end"))
        if st == "apply" and lw >= 330:
            o.append(btn_right(ax, ry + 8, "Apply", h=22, size=11))
        elif st == "applied" and lw >= 330:
            o.append(icon("i-check", ax - 74, ry + 10, 13, INK))
            o.append(t(ax, ry + 21, "Applied · 3", 11, INK, "b w7", "end"))
        elif st == "outdated" and lw >= 330:
            o.append(t(ax, ry + 21, "Outdated", 11, INK, "b w7", "end"))
    if cw:
        cx = bx + lw + 10
        o.append(t(cx, y + 11, "Detail · #1", 11.5, INK, "b w7"))
        g = [list("SM.D"), list("DFMS"), list("..SM"), list("MDS.")]
        g[0][2] = "F"
        s, _ = mini_wall(cx, y + 24, cw, min(104, bh - 64), g, best=(1,), labels=False, sec=4,
                         lifted=(0, 2), target=(3, 3))
        o.append(s)
        o.append(t(cx, y + 24 + min(104, bh - 64) + 15, fit("G-14-04-02 → A-02-01-01", 11, cw, LB), 11, INK, LB))
    return "".join(o)


def body_ba(bx, by, bw, bh):
    o = [t(bx, by + 10, fit("Import (before) vs planning copy (after) · 3 moves", 11, bw), 11, INK2)]
    wide = bw >= 340
    cols = [("Aisle", 10, None, "lb w7"), ("In", bw * 0.2, "end", "lb w6"), ("Out", bw * 0.32, "end", "lb w6"),
            ("Fast in best", bw * 0.62 if wide else bw * 0.66, "end", "lb w7")]
    if wide:
        cols.append(("Groups together", bw - 10, "end", "lb w6"))
    rows = [["A", "1", "0", "40 → 41", "19 → 19"], ["B", "1", "0", "22 → 23", "8 → 8"],
            ["C", "0", "1", "0 → 0", "6 → 6"], ["D", "0", "1", "0 → 0", "5 → 5"],
            ["All", "2", "2", "61 → 63", "52 → 52"]]
    if not wide:
        cols[3] = ("Fast in best", bw - 10, "end", "lb w7")
    s, H = table(bx, by + 18, bw, cols, rows, bh - 18, row_h=22, size=12)
    o.append(s)
    return "".join(o)


def a4_sheet(x, y, w, h, lines=3, rounds=1, size=10.5, ticks=0, title="Move list · Spring re-slot 2026"):
    """Black-and-white A4 move list at whatever size is given (codes in Barlow)."""
    o = [rect(x, y, w, h, "#fff", 0, "#000", 0.8)]
    px = x + 12
    iw = w - 24
    o.append(t(px, y + 20, fit(title, 13, iw, LB), 13, "#000", LB))
    o.append(t(px, y + 34, fit("Data as of 2026-09-30 · 2 rounds", size, iw), size, "#000"))
    o.append(t(px, y + 47, fit("Generated 2026-11-11 10:05", size, iw), size, "#000"))
    yy = y + 56
    data = [[("4410281", "G-14-04-02", "A-02-01-01"), ("9723950", "A-03-04-02", "A-05-01-03"),
             ("1180342", "C-12-02-03", "A-11-02-02"), ("6630112", "D-05-03-01", "B-01-01-03")],
            [("2290033", "A-02-01-03", "H-05-04-02"), ("1184520", "A-03-01-02", "H-05-04-03")]]
    k = 0
    for r in range(rounds):
        if yy + 28 > y + h - 8:
            break
        o.append(rect(px, yy, iw, 1.5, "#000"))
        o.append(rect(px, yy + 6, 54, 16, "none", 0, "#000", 1.3))
        o.append(t(px + 27, yy + 18, f"ROUND {r+1}", 11, "#000", LB, "middle"))
        if iw > 150:
            o.append(t(px + 62, yy + 18, fit("one walk", size, iw - 64), size, "#000"))
        yy += 28
        for i, (p, f, to) in enumerate(data[r][:lines]):
            if yy + 18 > y + h - 6:
                break
            o.append(rect(px, yy + 3, 10, 10, "none", 0, "#000", 1))
            if k < ticks:
                o.append(f'<path d="M{px+1} {yy+7} l3.5 5 l8 -11" fill="none" stroke="#1F3A8A" stroke-width="1.8" stroke-linecap="round"/>')
            o.append(t(px + 16, yy + 12, p, 11, "#000", LB))
            if iw > 150:
                o.append(t(px + 62, yy + 12, f, 11, "#000", LB))
                o.append(t(px + 62 + 58, yy + 12, "→", 10, "#000"))
                if iw > 190:
                    o.append(t(px + 62 + 72, yy + 12, to, 11, "#000", LB))
            o.append(rect(px, yy + 17, iw, 0.6, "#000", extra=' fill-opacity="0.4"'))
            yy += 20
            k += 1
        yy += 4
    return "".join(o)


def body_movelist(bx, by, bw, bh):
    o = [btn(bx, by, "Print", icon_name="i-print")[0], btn(bx + 78, by, "Back to Recommendations", "tertiary")[0]]
    sy = by + 32
    sh = bh - 32 + 30  # sheet runs off the bottom edge like a long page
    sw = min(bw - 8, 330)
    sx = bx + (bw - sw) / 2
    o.append(a4_sheet(sx, sy, sw, sh, lines=4, rounds=2))
    return "".join(o)


def body_settings(bx, by, bw, bh):
    o = []
    o.append(t(bx, by + 10, fit("Changed in the configuration file, not in the app.", 11, bw), 11, INK2))
    rows = [("Period", "2025-10-01 – 2026-09-30"), ("Fast-moving", "24 or more picks"),
            ("Medium-moving", "6–23 picks"), ("Slow-moving", "1–5 picks"), ("Dead stock", "0 picks"),
            ("Pick-group minimum", "5 shared jobs")]
    y = by + 18
    rh = 22
    n = int((by + bh - y) // rh)
    rows = rows[:max(n, 0)]
    o.append(rect(bx, y, bw, len(rows) * rh, "#fff", 4, BORDER, 1))
    for i, (a, b) in enumerate(rows):
        ry = y + i * rh
        if i:
            o.append(hline(bx + 1, ry, bw - 2))
        o.append(t(bx + 8, ry + 15, a, 11.5, INK, "b w6"))
        o.append(t(bx + bw - 8, ry + 15, b, 11.5, INK, LB, "end"))
    return "".join(o)


def body_login(bx, by, bw, bh, create=False):
    cw = min(bw, 220)
    cx = bx + (bw - cw) / 2
    ch = bh
    o = [rect(cx, by, cw, ch, "#fff", 6, BORDER, 1)]
    ix, iw = cx + 14, cw - 28
    o.append(t(ix, by + 24, "Create account" if create else "Log in", 17, INK, LB))
    y = by + 38
    fields = ["Username", "Password", "Repeat password"] if create else ["Username", "Password"]
    step = 37 if bh >= 176 else 34
    for f in fields:
        if y + step > by + ch - 26:
            break
        o.append(t(ix, y + 9, f, 11, INK, "b w6"))
        o.append(rect(ix, y + 13, iw, 20, "#fff", 3, INPUT_B, 1))
        if f != "Username":
            o.append(t(ix + iw - 6, y + 27, "Show", 11, INK, "b w6", "end", ' text-decoration="underline"'))
        y += step
    if y + 24 <= by + ch - 4:
        o.append(rect(ix, y, iw, 24, INK, 4))
        o.append(t(ix + iw / 2, y + 16, "Create account" if create else "Log in", 11.5, "#fff", "b w7", "middle"))
        y += 30
    if not create and y + 24 <= by + ch - 4:
        o.append(rect(ix, y, iw, 24, "#fff", 4, INPUT_B, 1))
        o.append(icon("i-play", ix + iw / 2 - 46, y + 5, 13, INK))
        o.append(t(ix + iw / 2 - 28, y + 16, "Demo version", 11.5, INK, "b w7"))
    return "".join(o)


def body_launcher(bx, by, bw, bh):
    """Graphite launcher overlay with code plates (full body)."""
    o = [rect(bx - 12, by - 12, bw + 24, bh + 24, "url(#louvre)")]
    rows = [["SAV", "NEW", "SET"], CODES[:4], CODES[4:]]
    ph = min(34, (bh - 10) / 3 - 6)
    for r, codes in enumerate(rows):
        ry = by + r * (ph + 8)
        o.append(rect(bx, ry - 3, bw, 3, "#454B52"))
        pw = (bw - 6 * 3) / 4
        for i, c in enumerate(codes):
            px = bx + i * (pw + 6)
            cur = c == "REC"
            o.append(rect(px, ry + 2, pw, ph, "#fff", 3, INK if cur else None, 2 if cur else 1))
            o.append(t(px + 6, ry + ph - 6, c, min(20, ph * 0.62), INK, LB))
    return "".join(o)


# ------------------------------------------------------------------ registry
def S(key, x, y, w, h, chrome=True, title_size=18, compact=False):
    """Draw a named screen into a box. chrome=False drops the toolbar (used when the map shows it once)."""
    cfg = {
        "login": (lambda a, b, c, d: body_login(a, b, c, d), "public", None, None, None),
        "create": (lambda a, b, c, d: body_login(a, b, c, d, True), "public", None, None, None),
        "saved": (body_saved, "app", None, "Saved plans", None),
        "new": (body_newplan, "app", None, "New Plan", None),
        "new_err": (lambda a, b, c, d: body_newplan(a, b, c, d, True), "app", None, "New Plan", None),
        "overview": (body_overview, "plan", 1, "Plan overview", "Data as of 2026-09-30 · uploaded 2026-10-02 · 12 months"),
        "parts": (body_parts, "plan", 2, "Parts", "1,545 parts · ranked by picks in the period"),
        "locations": (body_locations, "plan", 3, "Locations", None),
        "groups": (body_groups, "plan", 4, "Pick groups", None),
        "best": (body_best, "plan", 5, "Best locations", None),
        "recs": (body_recs, "plan", 6, "Recommendations", None),
        "ba": (body_ba, "plan", 7, "Before/after", None),
        "move": (body_movelist, "plan", 8, "Move list", None),
        "settings": (body_settings, "plan", None, "Settings", "Read-only · Spring re-slot 2026 · data as of 2026-09-30"),
    }
    body, kind, step, title, meta = cfg[key]
    if compact:
        body = COMPACT.get(key, body)
        if key in COMPACT:
            meta = None
    ch = kind if chrome else None
    pad = 10 if kind == "public" else 12
    return screen(x, y, w, h, body, chrome=ch, pad=pad, step=step, title=title, meta=meta, title_size=title_size)


EXTRA_DEFS = (f'<defs><marker id="ahv" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">'
              f'<path d="M1 1 9 5 1 9Z" fill="{ACCENT}"/></marker>'
              f'<marker id="ahi" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
              f'<path d="M1 1 9 5 1 9Z" fill="{INK}"/></marker>'
              f'<marker id="ahg" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
              f'<path d="M1 1 9 5 1 9Z" fill="#6B717A"/></marker></defs>')


# ------------------------------------------------------------------ overlays and extras
def backdrop(x, y, w, h, kind="wall"):
    """A dimmed page behind an overlay, so the card reads as 'opens on top'."""
    o = [rect(x, y, w, h, GROUND)]
    if kind == "wall":
        g = wall_grid(23, max(8, int(w // 16)))
        o.append(mini_wall(x + 6, y + 8, w - 12, h - 16, g, best=(1,), labels=False)[0])
    else:
        for i in range(int(h // 18)):
            o.append(rect(x + 8, y + 10 + i * 18, w - 16, 10, "#fff", 2))
    o.append(rect(x, y, w, h, INK, extra=' fill-opacity="0.38"'))
    return "".join(o)


def dialog(x, y, w, h):
    return f'<g filter="url(#pop)">{rect(x, y, w, h, "#fff", 6, BORDER, 1)}</g>'


def ov_partpanel(x, y, w, h):
    pw = min(w - 30, 220)
    px = x + w - pw
    o = [backdrop(x, y, w, h, "table"), rect(px, y, pw, h, "#fff"), rect(px, y, 1, h, BORDER)]
    ix = px + 12
    o.append(t(ix, y + 22, "4410281", 16, INK, LB))
    o.append(icon("i-x", px + pw - 22, y + 9, 13, INK))
    o.append(t(ix, y + 39, fit("Brake pads, front – VW Golf", 11.5, pw - 24), 11.5, INK))
    o.append(mini_bin(ix, y + 49, "F", 16, 16))
    o.append(t(ix + 22, y + 61, fit("Fast-moving · 61 picks", 11.5, pw - 40, "b w7"), 11.5, INK, "b w7"))
    lines = [("In", "G-14-04-02 · L4"), ("Partner", "4410297 · 14 jobs")]
    yy = y + 84
    for a, b in lines:
        if yy > y + h - 40:
            break
        o.append(t(ix, yy, a, 11, INK2))
        o.append(t(ix + 52, yy, fit(b, 11.5, pw - 70, LB), 11.5, INK, LB))
        yy += 18
    if yy + 22 <= y + h - 6:
        b1, w1 = btn(ix, yy - 4, "Keep in place", "secondary", h=22, size=11)
        o.append(b1)
        if w1 + 100 < pw:
            o.append(btn(ix + w1 + 6, yy - 4, "Manual move…", "tertiary", h=22, size=11)[0])
    return "".join(o)


def ov_manual(x, y, w, h):
    o = [backdrop(x, y, w, h, "table")]
    dw, dh = min(w - 24, 240), min(h - 20, 136)
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    o.append(dialog(dx, dy, dw, dh))
    ix, iw = dx + 12, dw - 24
    o.append(t(ix, dy + 22, "Manual move", 15, INK, LB))
    o.append(t(ix, dy + 40, fit("4410281 from G-14-04-02", 11, iw, "b w6"), 11, INK2, "b w6"))
    o.append(t(ix, dy + 58, "To location", 11, INK, "b w6"))
    o.append(rect(ix - 3, dy + 62, iw + 6, 28, "none", 5, INK, 1.6))
    o.append(rect(ix, dy + 65, iw, 22, "#fff", 3, INPUT_B, 1))
    o.append(t(ix + 6, dy + 80, "A-02-01-0", 12, INK, LB))
    o.append(rect(ix + 54, dy + 69, 1.2, 14, INK))
    if dh >= 120:
        o.append(btn_right(dx + dw - 12, dy + dh - 30, "Move", h=22, size=11))
        o.append(btn_right(dx + dw - 70, dy + dh - 30, "Cancel", "tertiary", h=22, size=11))
    return "".join(o)


def ov_drop(x, y, w, h):
    o = [backdrop(x, y, w, h, "wall")]
    dw, dh = min(w - 24, 250), min(h - 20, 112)
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    o.append(dialog(dx, dy, dw, dh))
    ix, iw = dx + 12, dw - 24
    o.append(t(ix, dy + 22, fit("A-02-01-02 is occupied", 15, iw, LB), 15, INK, LB))
    o.append(t(ix, dy + 40, fit("4410281 onto 5520114 · Oil filter", 11, iw), 11, INK2))
    o.append(rect(ix, dy + 50, iw, 24, TINT, 3, INK, 1.2))
    o.append(f'<circle cx="{ix+12}" cy="{dy+62}" r="5" fill="{INK}"/>')
    o.append(t(ix + 24, dy + 66, fit("Swap · A ↔ B", 11.5, iw - 30, "b w7"), 11.5, INK, "b w7"))
    o.append(rect(ix, dy + 80, iw, 24, "#fff", 3, BORDER, 1))
    o.append(f'<circle cx="{ix+12}" cy="{dy+92}" r="5" fill="none" stroke="{INK}" stroke-width="1.2"/>')
    o.append(t(ix + 24, dy + 96, "Put together", 11.5, INK, "b w6"))
    return "".join(o)


def ov_keycolour(x, y, w, h):
    o = [backdrop(x, y, w, h, "wall")]
    dw, dh = min(w - 20, 230), min(h - 16, 140)
    dx, dy = x + (w - dw) / 2, y + 8
    o.append(dialog(dx, dy, dw, dh))
    ix = dx + 12
    o.append(f'<use href="#g-slow" x="{ix}" y="{dy+11}" width="11" height="11"/>')
    o.append(t(ix + 16, dy + 21, "Slow-moving colour", 14, INK, LB))
    sw = ["#9CC3E6", "#4FB3E8", "#8F9BE0", "#7D87E8", "#417DDC", "#2E86C1", "#5C6BE0", "#3B6FD8"]
    for i, c in enumerate(sw):
        cx = ix + 10 + (i % 4) * 26
        cy = dy + 40 + (i // 4) * 24
        o.append(f'<circle cx="{cx}" cy="{cy}" r="9" fill="{c}"/>')
        if i == 4:
            o.append(f'<circle cx="{cx}" cy="{cy}" r="12" fill="none" stroke="{INK}" stroke-width="2"/>')
    o.append(rect(ix + 112, dy + 31, dw - 136, 20, "#fff", 3, INPUT_B, 1))
    o.append(t(ix + 118, dy + 45, "#417DDC", 11.5, INK, LB))
    if dh >= 108:
        o.append(btn(ix, dy + dh - 30, "Reset this colour", "tertiary", h=22, size=11)[0])
        o.append(btn_right(dx + dw - 12, dy + dh - 30, "Done", h=22, size=11))
    return "".join(o)


def ov_recdetail(x, y, w, h):
    o = [rect(x, y, w, h, GROUND)]
    o.append(t(x + 10, y + 18, "#1 · 4410281 Brake pads", 13, INK, LB))
    cw = (w - 30) / 2
    ch = h - 52
    g1 = [list("SM.D"), list("DFMS"), list("..SM"), list("MDS.")]
    g1[0][2] = "F"
    g2 = [list("MSDS"), list("S.MD"), list("DMSF"), list("FM.F")]
    s1, _ = mini_wall(x + 10, y + 28, cw, ch, g1, best=(), labels=False, lifted=(0, 2))
    s2, _ = mini_wall(x + 20 + cw, y + 28, cw, ch, g2, best=(1, 2), labels=False, target=(3, 2))
    o += [s1, s2]
    o.append(t(x + 10, y + h - 8, "G-14-04-02", 11.5, INK, LB))
    o.append(t(x + 20 + cw, y + h - 8, "→ A-02-01-01", 11.5, INK, LB))
    return "".join(o)


def ov_launcher(x, y, w, h):
    o = [rect(x, y, w, h, "url(#louvre)")]
    o.append(t(x + 10, y + 18, "Go to: type a code or a name", 11, ONDARK2))
    rows = [["SAV", "NEW", "SET"], CODES[:4], CODES[4:]]
    top = y + 28
    ph = min(34, (h - 36) / 3 - 7)
    pw = (w - 20 - 3 * 5) / 4
    for r, codes in enumerate(rows):
        ry = top + r * (ph + 7)
        o.append(rect(x + 6, ry, w - 12, 2.5, "#454B52"))
        for i, c in enumerate(codes):
            px = x + 10 + i * (pw + 5)
            cur = c == "REC"
            o.append(rect(px, ry + 4, pw, ph, "#fff", 3))
            if cur:
                o.append(rect(px - 1, ry + 3, pw + 2, ph + 2, "none", 3, INK, 2))
            o.append(t(px + 6, ry + 4 + ph * 0.72, c, min(19, ph * 0.6), INK, LB))
    return "".join(o)


def ov_usermenu(x, y, w, h):
    o = [rect(x, y, w, h, GROUND), f'<rect x="{x}" y="{y}" width="{w}" height="30" fill="url(#louvre)"/>']
    ax = x + w - 20
    o.append(f'<circle cx="{ax}" cy="{y+15}" r="12" fill="none" stroke="#fff" stroke-width="1.6"/>')
    o.append(f'<circle cx="{ax}" cy="{y+15}" r="9.5" fill="{ONDARK}"/>')
    o.append(t(ax, y + 19, "JS", 10, INK, LB, "middle"))
    mw = min(w - 20, 170)
    mx, my = x + w - mw - 8, y + 38
    o.append(dialog(mx, my, mw, 86))
    o.append(t(mx + 12, my + 19, "Logged in as", 11, INK3))
    o.append(t(mx + 12, my + 36, "justas", 14, INK, LB))
    o.append(hline(mx, my + 46, mw))
    o.append(rect(mx + 4, my + 52, mw - 8, 28, "#F3F2EE", 3))
    o.append(icon("i-arrow-r", mx + 12, my + 59, 14, INK))
    o.append(t(mx + 32, my + 70, "Log out", 12, INK, "b w7"))
    return "".join(o)


def ov_frontpage(x, y, w, h):
    o = [rect(x, y, w, h, GROUND), f'<rect x="{x}" y="{y}" width="{w}" height="26" fill="url(#louvre)"/>',
         f'<g transform="translate({x+6} {y+4}) scale(0.6)">{logo(0, 0)}</g>']
    o.append(rect(x + w - 50, y + 5, 42, 16, "none", 3, ONDARK, 1))
    o.append(t(x + w - 29, y + 17, "Log in", 10, "#fff", "b w6", "middle"))
    o.append(t(x + 10, y + 52, "Every move", 21, INK, LB))
    o.append(t(x + 10, y + 74, "comes with a reason.", 21, INK, LB))
    bx = x + 10
    for s, k in (("Log in", "primary"), ("Create account", "secondary"), ("Demo version", "tertiary")):
        if bx + tw(s, 11, "b w7") + 22 > x + w - 6:
            break
        b, bw2 = btn(bx, y + 86, s, k, h=20, size=11)
        o.append(b)
        bx += bw2 + 5
    return "".join(o)


def card(x, y, w, h, fn):
    """A framed overlay/extra card."""
    cid = uid("cc")
    return "".join([f'<clipPath id="{cid}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7"/></clipPath>',
                    f'<g clip-path="url(#{cid})">', fn(x, y, w, h), "</g>", rect(x, y, w, h, "none", 7, INK, 1.2)])


def paper(x, y, w, h, rot=-1.5, lines=4, rounds=2, ticks=2):
    """A loose printed A4 move list (not a screen)."""
    cx, cy = x + w / 2, y + h / 2
    return (f'<g filter="url(#pop)" transform="rotate({rot} {cx} {cy})">{rect(x, y, w, h, "#fff")}</g>'
            f'<g transform="rotate({rot} {cx} {cy})">{a4_sheet(x, y, w, h, lines, rounds, ticks=ticks)}</g>')



# ------------------------------------------------------------------ compact strips (sitemap rows)
def cbody_parts(bx, by, bw, bh):
    rh = 26
    rows = PARTS[:max(0, int(bh // rh))]
    o = [rect(bx, by, bw, len(rows) * rh, "#fff", 4, BORDER, 1)]
    for i, (rk, c, pn, d, pk) in enumerate(rows):
        ry = by + i * rh
        if i:
            o.append(hline(bx + 1, ry, bw - 2))
        o.append(t(bx + 8, ry + 18, f"#{rk}", 13, INK, LB))
        o.append(mini_bin(bx + 30, ry + 5, c, 17, 16))
        o.append(t(bx + 54, ry + 17.5, pn, 12.5, INK, LB))
        o.append(t(bx + 106, ry + 17.5, fit(d, 11.5, bw - 106 - 62), 11.5, INK))
        o.append(t(bx + bw - 8, ry + 17.5, f"{pk} picks", 11.5, INK2, "b w4", "end"))
    return "".join(o)


def _wall2(x, y, w, h, seed, frames=()):
    cols = max(8, int((w - 34) // 19))
    cols -= cols % 4
    g = wall_grid(seed, cols, levels=2)
    return mini_wall(x, y, w, h, g, best=(1, 2), frames=frames)[0]


def cbody_locations(bx, by, bw, bh):
    return _wall2(bx, by, bw, bh, 7)


def cbody_best(bx, by, bw, bh):
    return _wall2(bx, by, bw, bh, 11, frames={(0, 3), (0, 9)})


def cbody_recs(bx, by, bw, bh):
    o = []
    tx = bx
    for i, (a, n) in enumerate((("Round 1", ""), ("All", "19"), ("Rule 1", "9"), ("Rule 2", "6"), ("Rule 3", "4"), ("No space", "31"))):
        if i == 0:
            o.append(rect(bx, by - 2, 54, 18, "#fff", 3, INK, 1.2))
            o.append(t(bx + 27, by + 11, a, 11, INK, LB, "middle"))
            tx += 64
            continue
        o.append(t(tx, by + 11, a, 11, INK, "b w7" if i == 1 else "b w5"))
        o.append(t(tx + tw(a, 11, "b w6") + 3, by + 11, n, 11, INK2, LB))
        tx += tw(a, 11, "b w6") + tw(n, 11, LB) + 14
    y = by + 22
    rh = min(40, bh - 22)
    o.append(rect(bx, y, bw, rh, TINT, 4, BORDER, 1))
    o.append(rect(bx + 1, y + 1, 3, rh - 2, ACCENT))
    o.append(t(bx + 9, y + 17, "#1", 13, INK, LB))
    o.append(mini_bin(bx + 9, y + 21, "F", 14, 13))
    o.append(t(bx + 34, y + 16, "4410281", 12.5, INK, LB))
    o.append(t(bx + 34, y + 32, "G-14-04-02  →  A-02-01-01", 11.5, INK, LB))
    o.append(t(bx + 150, y + 16, "Brake pads, front", 11, INK2))
    o.append(btn_right(bx + bw - 8, y + (rh - 22) / 2, "Apply", h=22, size=11))
    return "".join(o)


def cbody_groups(bx, by, bw, bh):
    return body_groups(bx, by - 18, bw, bh + 18).split("</text>", 1)[1]


def cbody_ba(bx, by, bw, bh):
    return body_ba(bx, by - 18, bw, bh + 18).split("</text>", 1)[1]


def cbody_move(bx, by, bw, bh):
    o = [btn(bx, by, "Print", icon_name="i-print")[0]]
    o.append(t(bx, by + 44, "Back to", 11, INK2))
    o.append(t(bx, by + 58, "Recommendations", 11, INK2))
    sx, sw = bx + 112, bw - 112
    o.append(rect(sx, by - 2, sw, bh + 30, "#fff", 0, "#000", 0.8))
    px = sx + 10
    o.append(rect(px, by + 6, sw - 20, 1.5, "#000"))
    o.append(rect(px, by + 12, 54, 16, "none", 0, "#000", 1.3))
    o.append(t(px + 27, by + 24, "ROUND 1", 11, "#000", LB, "middle"))
    o.append(t(px + 62, by + 24, "one walk · from before to", 10.5, "#000"))
    for i, (p, f, to) in enumerate((("4410281", "G-14-04-02", "A-02-01-01"), ("9723950", "A-03-04-02", "A-05-01-03"))):
        yy = by + 34 + i * 20
        o.append(rect(px, yy + 3, 10, 10, "none", 0, "#000", 1))
        o.append(t(px + 16, yy + 12, p, 11, "#000", LB))
        o.append(t(px + 62, yy + 12, f, 11, "#000", LB))
        o.append(t(px + 120, yy + 12, "→", 10, "#000"))
        o.append(t(px + 134, yy + 12, to, 11, "#000", LB))
    return "".join(o)


COMPACT = {"recs": cbody_recs, "parts": cbody_parts, "locations": cbody_locations, "best": cbody_best,
           "groups": cbody_groups, "ba": cbody_ba, "move": cbody_move}
