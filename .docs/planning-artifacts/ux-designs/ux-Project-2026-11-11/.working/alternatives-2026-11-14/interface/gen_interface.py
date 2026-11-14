"""Recommendations workspace: three layout alternatives (Bin Wall style).

Usage: python3 gen_interface.py [out_dir]   (default: this folder)
Reuses the shared defs (fonts, glyphs, icons, filters) and helpers of the
landing/login generators in ../../landing-redesign/.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True  # keep the landing-redesign folder clean
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "..", "landing-redesign")))
from gen_landing import (t, bin_, slot, logo, svg, INK, INK2, INK3, SURF, BORDER, HAIR, BAND,  # noqa: E402
                         ONDARK, ONDARK2, ONDARK_NAV, CLS, GLY, LBL, BEST, BEST_L, ACCENT, LB)

SLOT_DARK, TINT, OUTD, MUTED_D, TRACK = "#141719", "#F3EFFD", "#8C939A", "#9AA1A8", "#16191C"
NAMES = {"F": "Fast-moving", "M": "Medium-moving", "S": "Slow-moving", "D": "Dead stock"}


# ------------------------------------------------------------------ data (synthetic)
# Numbers run 1-19 across the three rules, so a wall marker is never ambiguous.
RULES = {1: ("Fast-moving parts into best locations", "Most picks first · best locations in location-code order"),
         2: ("Slow-moving parts and dead stock out of best locations", "Fewest picks first · other locations in code order"),
         3: ("Part moved into its partner's aisle", "Most shared jobs first · the part with fewer picks moves")}
# n, rule, part, description, class, picks, from, to, to-best, state
RECS = [
    (1, 1, "4410281", "Brake pads, front – VW Golf", "F", 61, "G-14-04-02", "G-14-01-04", True, "open"),
    (2, 1, "9723950", "Headlight bulb H7 – Peugeot 308", "F", 44, "A-03-04-02", "A-05-01-03", True, "applied"),
    (3, 1, "5315766", "Air filter – Audi A4", "F", 37, "C-05-02-01", "A-11-02-02", True, "outdated"),
    (4, 1, "8044172", "Oil filter – Toyota Corolla", "F", 33, "G-13-03-02", "G-14-02-03", True, "open"),
    (5, 1, "2555849", "Brake hose – Toyota Corolla", "F", 29, "G-15-04-01", "G-15-01-03", True, "open"),
    (6, 1, "1180342", "Wiper blade set – Ford Focus", "F", 27, "E-10-03-03", "A-17-01-02", True, "open"),
    (7, 1, "6630112", "Spark plug set – Skoda Octavia", "F", 26, "D-05-03-01", "A-17-01-03", True, "kept"),
    (8, 1, "2290033", "Fuel filter – VW Passat", "F", 25, "B-08-04-02", "A-18-02-01", True, "open"),
    (9, 1, "7781205", "Brake disc, rear – Volvo V60", "F", 24, "F-06-03-02", "A-18-02-02", True, "open"),
    (10, 2, "3632446", "Catalytic converter – BMW 320d", "D", 0, "G-13-01-01", "H-11-04-03", False, "open"),
    (11, 2, "3298226", "Tail light assembly – Toyota RAV4", "S", 2, "B-07-01-02", "H-12-03-01", False, "open"),
    (12, 2, "9032116", "Door seal – Opel Astra", "S", 1, "A-02-01-03", "H-06-04-01", False, "applied"),
    (13, 2, "5507718", "Mirror glass, left – Kia Ceed", "S", 3, "A-04-02-02", "H-07-03-02", False, "open"),
    (14, 2, "8812009", "Sunroof seal – Mazda 6", "D", 0, "A-06-01-01", "I-02-04-01", False, "kept"),
    (15, 2, "4471230", "Horn – Renault Clio", "S", 4, "A-09-02-04", "H-08-04-02", False, "open"),
    (16, 3, "6900616", "Timing belt kit – Hyundai Tucson", "M", 14, "F-08-03-01", "D-03-02-02", False, "open"),
    (17, 3, "3120458", "Water pump – Hyundai Tucson", "M", 11, "E-04-04-03", "D-03-03-01", False, "open"),
    (18, 3, "7719904", "Coolant hose – Kia Sportage", "M", 9, "C-11-02-02", "F-05-04-01", False, "kept"),
    (19, 3, "2203385", "Drive belt – Nissan Qashqai", "M", 7, "B-02-03-04", "E-09-04-02", False, "open"),
]
COUNTS = {"open": 13, "applied": 2, "kept": 3, "outdated": 1}
APPLIED_MOVE = {2: 3, 12: 2}  # rec n -> move number in the planning copy

# Aisle G, sections 13-15 (and 16 for the wide wall). Rows top (L4) to L1.
#  F/M/S/D bin · . empty · o vacated (bin lifted out) · t pending target · T selected target
WALL_G = ["DS.MSoSDoM.S",
          "MoSD.SDMS.DS",
          "FMFMMFtFFMMF",
          "oFMFFMMTMFtF"]
WALL_G16 = ["SD.M", "DMS.", "MFM.", "FMSF"]
LIFTS = [  # (rec n, level-row index, column index, class)
    (1, 0, 5, "F"), (4, 1, 1, "F"), (5, 0, 8, "F"), (10, 3, 0, "D")]


def tw(s, size, cond=False, bold=False):
    """Rough text width estimate for layout checks."""
    k = (0.47 if bold else 0.45) if cond else (0.58 if bold else 0.54)
    return len(s) * size * k


# ------------------------------------------------------------------ primitives
def rect(x, y, w, h, fill="none", rx=0, stroke=None, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{s}{extra}/>'


def icon(name, x, y, size=18, color=INK):
    return f'<use href="#{name}" x="{x}" y="{y}" width="{size}" height="{size}" stroke="{color}" color="{color}"/>'


def eyebrow(x, y, s, fill=INK2, anchor=None):
    return t(x, y, s, 12.5, fill, LB, anchor, ' letter-spacing="1.2"')


def best_tag(x, y, on_dark=False, s="BEST"):
    w = 38 if s == "BEST" else 30 + len(s) * 6
    return (rect(x, y, w, 18, BEST if on_dark else BEST_L, 2) +
            t(x + w / 2, y + 13.5, s, 11.5, INK if on_dark else "#fff", LB, "middle"))


def swatch(x, y, c, w=26, h=28):
    """Small class bin: colour + glyph in a white window (no text label)."""
    return (rect(x, y, w, h, CLS[c], 2) + rect(x, y, w, 3.5, "#000", 1.5, extra=' fill-opacity="0.22"') +
            rect(x + 4, y + h * 0.36, w - 8, h * 0.44, "#fff", 1) +
            f'<use href="#{GLY[c]}" x="{x + w/2 - 5}" y="{y + h*0.36 + h*0.22 - 5}" width="10" height="10"/>')


def marker(cx, cy, n, kind="rec", r=10.5):
    """Numbered move marker: rec (white, ink ring) / sel (white, violet ring) / applied / outdated."""
    if kind == "applied":
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{INK}" stroke="#fff" stroke-width="1.2"/>' +
                icon("i-check", cx - r * 0.7, cy - r * 0.7, r * 1.4, "#fff"))
    ring, sw = {"rec": (INK, 1.4), "sel": (ACCENT, 2.6), "outdated": (OUTD, 1.4)}[kind]
    dash = ' stroke-dasharray="2.5 2"' if kind == "outdated" else ""
    fs = r * 1.2 if n < 10 else r * 1.05
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="{ring}" stroke-width="{sw}"{dash}/>' +
            t(cx, cy + fs * 0.36, str(n), round(fs, 1), INK3 if kind == "outdated" else INK, LB, "middle"))


def btn(x, y, w, label, kind="primary", ic=None, h=40, size=14):
    if kind == "primary":
        o, fg = rect(x, y, w, h, INK, 6), "#fff"
    elif kind == "secondary":
        o, fg = rect(x, y, w, h, "#fff", 6, INK, 1.2), INK
    else:  # tertiary
        o, fg = rect(x, y, w, h, "#fff", 6, "#8A9097", 1), INK
    if ic:
        tx = x + (w - (tw(label, size, bold=True) + 26)) / 2
        o += icon(ic, tx, y + h / 2 - 9, 18, fg) + t(tx + 26, y + h / 2 + size * 0.36, label, size, fg, "b w7")
    else:
        o += t(x + w / 2, y + h / 2 + size * 0.36, label, size, fg, "b w7", "middle")
    return o


def link(x, y, s, size=14, anchor=None, fill=INK):
    return t(x, y, s, size, fill, "b w6", anchor, ' text-decoration="underline"')


def kbd(x, y, s):
    w = tw(s, 11, bold=True) + 10
    return (rect(x, y - 13, w, 18, "#fff", 3, BORDER, 1) + t(x + w / 2, y, s, 11, INK2, "b w6", "middle"), w)


def round_chip(x, y, label="Round 1"):
    return (rect(x, y, 86, 30, "#fff", 3, INK, 1.2) + rect(x, y, 5, 30, INK, 1.5) +
            t(x + 47, y + 21, label, 16, INK, LB, "middle"))


def code_pair(x, y, a, b, size=15, best=True, fill=INK):
    """FROM → TO in condensed codes; returns svg and end x."""
    o = t(x, y, a, size, fill, LB)
    ax = x + tw(a, size, True, True) + 8
    o += icon("i-arrow-r", ax, y - size * 0.72, size * 0.95, fill)
    bx = ax + size * 0.95 + 8
    o += t(bx, y, b, size, fill, LB)
    ex = bx + tw(b, size, True, True)
    return o, ex


# ------------------------------------------------------------------ toolbar
STEPS = ["Overview", "Parts", "Locations", "Pick groups", "Best locations", "Recommendations", "Before/after", "Move list"]


def toolbar(current=6, done=(1, 2, 3, 4, 5)):
    o = [rect(0, 0, 1440, 64, "url(#louvre)"), logo(20, 17),
         t(60, 30, "Smart Warehouse", 14.5, "#fff", LB), t(60, 47, "Planner", 14.5, "#fff", LB)]
    # plan plate
    px, py, pw = 172, 11, 214
    o.append(rect(px, py, pw, 42, "#fff", 3))
    o.append(rect(px, py, 6, 42, INK, 1.5))
    o.append(t(px + 18, py + 19, "Spring re-slot 2026", 16, INK, LB))
    o.append(t(px + 18, py + 35, "Data as of 2026-09-30 · round 1", 11.5, INK2, "b w5"))
    o.append(icon("i-chev-d", px + pw - 26, py + 12, 18, INK))
    # flow track
    fx, fw = 400, 928
    o.append(rect(fx, 12, fw, 40, TRACK, 8))
    size = 13
    widths = [31 + len(s) * size * (0.6 if i + 1 == current else 0.52) + 12 for i, s in enumerate(STEPS)]
    gap = (fw - 12 - sum(widths)) / (len(STEPS) - 1)
    x = fx + 6
    for i, (s, w) in enumerate(zip(STEPS, widths)):
        n = i + 1
        cy = 32
        if n == current:
            o.append(rect(x, 17, w, 30, "#fff", 4))
            o.append(f'<circle cx="{x+16}" cy="{cy}" r="8.5" fill="#fff" stroke="{INK}" stroke-width="1.4"/>')
            o.append(t(x + 16, cy + 4, str(n), 11, INK, LB, "middle"))
            o.append(t(x + 31, cy + 4.5, s, size, INK, "b w7"))
        elif n in done:
            o.append(f'<circle cx="{x+16}" cy="{cy}" r="8.5" fill="{ONDARK_NAV}"/>')
            o.append(icon("i-check", x + 9.5, cy - 6.5, 13, INK))
            o.append(t(x + 31, cy + 4.5, s, size, ONDARK_NAV, "b w5"))
        else:
            o.append(f'<circle cx="{x+16}" cy="{cy}" r="8" fill="none" stroke="{MUTED_D}" stroke-width="1.2"/>')
            o.append(t(x + 16, cy + 4, str(n), 11, MUTED_D, LB, "middle"))
            o.append(t(x + 31, cy + 4.5, s, size, MUTED_D, "b w5"))
        x += w + gap
    # launcher + avatar
    o.append(rect(1340, 14, 36, 36, TRACK, 6, "#3A4046", 1))
    o.append(icon("i-menu", 1349, 23, 18, "#E8EAEC"))
    o.append(f'<circle cx="{1404}" cy="32" r="18" fill="none" stroke="#fff" stroke-width="1.6"/>')
    o.append(f'<circle cx="{1404}" cy="32" r="14.5" fill="{ONDARK}"/>')
    o.append(t(1404, 36.5, "JS", 12.5, INK, LB, "middle"))
    return "".join(o)


def page_header(y=88, meta=True, buttons=True, run_primary=False):
    o = [t(40, y + 34, "Recommendations", 36, INK, LB), round_chip(318, y + 11)]
    if meta:
        o.append(t(420, y + 23, "Run 2026-11-11 09:42 by Justas · 19 recommendations · 31 no space", 13, INK2, "b w5"))
        o.append(t(420, y + 41, "The next run starts round 2 and uses the planning copy as it is then.", 13, INK3))
    if buttons:
        o.append(rect(1360, y + 6, 40, 40, "#fff", 6, "#8A9097", 1))
        o.append(icon("i-dots", 1371, y + 17, 18, INK))
        o.append(btn(1150, y + 6, 198, "Run recommendations", "primary" if run_primary else "secondary", "i-play"))
        o.append(btn(1014, y + 6, 124, "Apply all (13)", "secondary"))
        o.append(btn(866, y + 6, 136, "Undo last move", "tertiary", "i-undo"))
    return "".join(o)


# ------------------------------------------------------------------ wall
def wall(x0, y0, rows, sections, bw=48, bh=50, best_levels=(1, 2), per=4, lifts=(), selected=1,
         arrow=True, note=None):
    nsec = len(sections)
    pitch = bw + 4
    sec_w = per * pitch + 10
    lab, head = 48, 38
    lvl_h = bh + 22
    levels = len(rows)
    W = lab + nsec * sec_w + 16
    H = head + levels * lvl_h + 14
    k = bw / 60

    def cell(li, ci):
        si, cj = divmod(ci, per)
        return x0 + lab + si * sec_w + 6 + cj * pitch, y0 + head + li * lvl_h + 8

    o = [rect(x0, y0, W, H, "url(#louvre2)", 8)]
    for si, name in enumerate(sections):
        sx = x0 + lab + si * sec_w
        o.append(t(sx + sec_w / 2, y0 + 23, name, 13, ONDARK2, "lb w6", "middle"))
        o.append(rect(sx - 6, y0 + head, 6, levels * lvl_h, "#454B52"))
    o.append(rect(x0 + lab + nsec * sec_w - 6, y0 + head, 6, levels * lvl_h, "#454B52"))
    for li, row in enumerate(rows):
        lvl = levels - li
        by = y0 + head + li * lvl_h + 8
        best = lvl in best_levels
        o.append(t(x0 + 12, by + bh / 2 - (2 if best else -5), f"L{lvl}", 15, ONDARK, LB))
        if best:
            o.append(best_tag(x0 + 5, by + bh / 2 + 5, on_dark=True))
        o.append(rect(x0 + lab - 6, by + bh + 6, nsec * sec_w, 6, BEST if best else "#1F2326"))
        for ci, c in enumerate(row):
            bx, _ = cell(li, ci)
            if c == ".":
                o.append(slot(bx, by, bw, bh))
            elif c == "o":
                o.append(slot(bx, by, bw, bh))
                o.append(rect(bx + 1, by + 1, bw - 2, bh - 2, "none", 3, "#fff", 1.4, ' stroke-dasharray="3 2.5"'))
            elif c in "tT":
                o.append(slot(bx, by, bw, bh))
                if c == "T":
                    o.append(rect(bx, by, bw, bh, "#fff", 3, extra=' fill-opacity="0.16"'))
                    o.append(rect(bx - 3.5, by - 3.5, bw + 7, bh + 7, "none", 4, SLOT_DARK, 5.2))
                    o.append(rect(bx - 3.5, by - 3.5, bw + 7, bh + 7, "none", 4, ACCENT, 2.4))
                else:
                    o.append(rect(bx + 1, by + 1, bw - 2, bh - 2, "none", 3, "#fff", 1.6, ' stroke-dasharray="3 2.5"'))
                o.append(icon("i-plus", bx + bw / 2 - 8, by + bh / 2 - 8, 16, "#fff"))
            else:
                o.append(bin_(bx, by, c, bw, bh))
    # lifted bins, selected last so it sits on top
    sel_geo = None
    for n, li, ci, c in sorted(lifts, key=lambda z: z[0] == selected):
        bx, by = cell(li, ci)
        lw, lh = bw * 1.12, bh * 1.12
        lx, ly = bx + bw * 0.16, by - bh * 0.24
        if n == selected:
            o.append(rect(lx - 3.5, ly - 3.5, lw + 7, lh + 7, SLOT_DARK, 5))
            o.append(bin_(lx, ly, c, lw, lh, lifted=True))
            o.append(rect(lx - 2.5, ly - 2.5, lw + 5, lh + 5, "none", 4, ACCENT, 2.4))
            sel_geo = (lx, ly, lw, lh)
        else:
            o.append(bin_(lx, ly, c, lw, lh, lifted=True))
        o.append(marker(lx - 1, ly - 1, n, "sel" if n == selected else "rec", 11 if bw >= 46 else 10))
    if arrow and sel_geo:
        lx, ly, lw, lh = sel_geo
        ti = next((li, row.index("T")) for li, row in enumerate(rows) if "T" in row)
        tx, ty = cell(*ti)
        sx, sy = lx + lw + 4, ly + lh * 0.55
        ex, ey = tx + bw / 2 + 8, ty - 9
        d = f"M{sx:.1f} {sy:.1f} C {sx+bw*1.3:.1f} {sy+10:.1f}, {ex+bw*0.9:.1f} {ey-bh*1.2:.1f}, {ex:.1f} {ey:.1f}"
        o.append(f'<path d="{d}" fill="none" stroke="{SLOT_DARK}" stroke-width="7" stroke-linecap="round"/>')
        o.append(f'<path d="{d}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-linecap="round"/>')
        head_d = f"M{ex-9:.1f} {ey-9:.1f} L{ex:.1f} {ey+1:.1f} L{ex+11:.1f} {ey-6:.1f}"
        o.append(f'<path d="{head_d}" fill="none" stroke="{SLOT_DARK}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>')
        o.append(f'<path d="{head_d}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')
    if note and sel_geo:
        nx, ny, l1, l2 = note
        o.append(f'<g filter="url(#pop)">{rect(nx, ny, 250, 54, "#fff", 4)}</g>')
        o.append(rect(nx, ny, 6, 54, ACCENT, 2))
        o.append(t(nx + 18, ny + 22, l1, 13, INK, "b w7"))
        o.append(t(nx + 18, ny + 41, l2, 12.5, INK2, "b w5"))
    return "".join(o), W, H, cell


def key_row(x, y, size=12.5, gap=20):
    o, cx = [], x
    for c in "FMSD":
        o.append(swatch(cx, y - 13, c, 16, 18))
        lab = NAMES[c]
        o.append(t(cx + 22, y, lab, size, INK2, "b w5"))
        cx += 22 + tw(lab, size) + gap
    o.append(rect(cx, y - 13, 16, 18, SLOT_DARK, 2))
    o.append(t(cx + 22, y, "Empty", size, INK2, "b w5"))
    cx += 22 + tw("Empty", size) + gap
    o.append(rect(cx, y - 7, 22, 6, BEST, 1))
    o.append(t(cx + 28, y, "Best location", size, INK2, "b w5"))
    cx += 28 + tw("Best location", size) + gap
    o.append(rect(cx + 1, y - 12, 16, 16, "none", 3, ACCENT, 2.4))
    o.append(t(cx + 24, y, "Selected", size, INK2, "b w5"))
    return "".join(o)


# ------------------------------------------------------------------ A: review queue
def make_a():
    o = [toolbar(), page_header()]
    # queue strip: one disc per recommendation, grouped by rule
    qy = 186
    o.append(eyebrow(40, qy - 30, "ROUND 1 · REVIEW ONE AT A TIME"))
    x = 40
    for r in (1, 2, 3):
        o.append(rect(x, qy - 10, 52, 22, INK, 3))
        o.append(t(x + 26, qy + 6, f"Rule {r}", 12.5, "#fff", LB, "middle"))
        x += 64
        for rec in [z for z in RECS if z[1] == r]:
            n, st = rec[0], rec[9]
            cx = x + 13
            if n == 1:
                o.append(f'<circle cx="{cx}" cy="{qy+1}" r="16.5" fill="none" stroke="{ACCENT}" stroke-width="2.6"/>')
                o.append(f'<path d="M{cx-6} {qy+26} L{cx} {qy+20} L{cx+6} {qy+26}Z" fill="{ACCENT}"/>')
            if st == "applied":
                o.append(marker(cx, qy + 1, n, "applied", 12.5))
            elif st == "outdated":
                o.append(marker(cx, qy + 1, n, "outdated", 12.5))
            elif st == "kept":
                o.append(f'<circle cx="{cx}" cy="{qy+1}" r="12.5" fill="{BAND}" stroke="{INK3}" stroke-width="1.2"/>')
                o.append(icon("i-pin", cx - 8, qy - 7, 16, INK))
            else:
                o.append(marker(cx, qy + 1, n, "rec", 12.5))
            x += 32
        x += 22
    # state counts, right side
    sx = 1400
    items = [("outdated", "Outdated", 1), ("kept", "Kept in place", 3), ("applied", "Applied", 2), ("open", "Open", 13)]
    for kind, lab, n in items:
        w = 26 + tw(lab, 13, bold=True) + 8 + tw(str(n), 18, True, True)
        sx -= w
        if kind == "applied":
            o.append(marker(sx + 9, qy + 1, 0, "applied", 9))
        elif kind == "outdated":
            o.append(f'<circle cx="{sx+9}" cy="{qy+1}" r="9" fill="#fff" stroke="{OUTD}" stroke-width="1.4" stroke-dasharray="2.5 2"/>')
        elif kind == "kept":
            o.append(f'<circle cx="{sx+9}" cy="{qy+1}" r="9" fill="{BAND}" stroke="{INK3}" stroke-width="1.2"/>')
            o.append(icon("i-pin", sx + 3, qy - 5, 12, INK))
        else:
            o.append(f'<circle cx="{sx+9}" cy="{qy+1}" r="9" fill="#fff" stroke="{INK}" stroke-width="1.4"/>')
        o.append(f'<text x="{sx+26}" y="{qy+6}" class="b w6" font-size="13" fill="{INK2}">{lab} '
                 f'<tspan class="lb w7" font-size="18" fill="{INK}">{n}</tspan></text>')
        sx -= 22
    o.append(link(1400, qy - 30, "No space · 31 parts", 12.5, "end", INK2))

    # main card
    cx0, cy0, cw, ch = 40, 238, 1360, 568
    o.append(rect(cx0, cy0, cw, ch, "#fff", 8, BORDER, 1))
    L = 80
    o.append(eyebrow(L, cy0 + 44, "#1 OF 19 · RULE 1 · FAST-MOVING PARTS INTO BEST LOCATIONS"))
    o.append(bin_(L, cy0 + 64, "F", 58, 56))
    o.append(t(L + 76, cy0 + 99, "4410281", 42, INK, LB))
    o.append(t(L + 76, cy0 + 122, "Brake pads, front – VW Golf", 17, INK, "b w6"))
    # big move line
    my = cy0 + 186
    s, ex = code_pair(L, my, "G-14-04-02", "G-14-01-04", 32)
    o.append(s)
    o.append(best_tag(ex + 10, my - 18))
    o.append(t(L, my + 24, "Now · level 4, not best", 13, INK2, "b w5"))
    o.append(t(L + tw("G-14-04-02", 32, True, True) + 8 + 30 + 8, my + 24, "To · level 1, best location", 13, INK2, "b w5"))
    o.append(rect(L, my + 46, 520, 1, HAIR))
    # why: three fact tiles
    o.append(t(L, my + 82, "Why this move", 20, INK, LB))
    ty = my + 98
    facts = [("61", "picks in the period", "Fast-moving is 24 or more"),
             ("L4", "where it sits now", "Not a best location"),
             ("L1", "where it goes", "First empty best location")]
    for i, (big, a, b) in enumerate(facts):
        fx = L + i * 176
        o.append(rect(fx, ty, 164, 108, "#F6F5F1", 6))
        o.append(t(fx + 16, ty + 46, big, 36, INK, LB))
        if i == 0:
            o.append(swatch(fx + 120, ty + 18, "F", 26, 28))
        if i == 2:
            o.append(best_tag(fx + 110, ty + 22))
        o.append(t(fx + 16, ty + 74, a, 13.5, INK, "b w6"))
        o.append(t(fx + 16, ty + 93, b, 12.5, INK2))
    o.append(icon("i-link", L, ty + 128, 18, INK2))
    o.append(t(L + 26, ty + 142, "Its partner 4410297 already sits in aisle G (G-15-02-01).", 13.5, INK2))
    # actions
    ay = cy0 + 470
    o.append(btn(L, ay, 128, "Apply", "primary", "i-check", 46, 15.5))
    o.append(btn(L + 140, ay, 164, "Other location ▾", "tertiary", None, 46, 14.5))
    o.append(link(L + 324, ay + 28, "Keep in place", 14.5))
    o.append(link(L + 438, ay + 28, "Manual move…", 14.5))
    kx, ky = L, ay + 76
    for k, lab in (("Alt+A", "apply"), ("Alt+O", "other location"), ("Alt+K", "keep in place")):
        s2, w = kbd(kx, ky, k)
        o.append(s2)
        o.append(t(kx + w + 6, ky, lab, 12.5, INK3))
        kx += w + 12 + tw(lab, 12.5) + 14
    # right: wall excerpt
    R = 642
    o.append(eyebrow(R, cy0 + 44, "AISLE G · SECTIONS 13–15 · MOVES TOUCHING THIS AISLE: 4"))
    o.append(link(1366, cy0 + 44, "Show on the Locations wall", 13, "end"))
    w, W, H, _ = wall(R, cy0 + 62, WALL_G, ("Section 13", "Section 14", "Section 15"), 48, 50, lifts=LIFTS)
    o.append(w)
    o.append(key_row(R, cy0 + 62 + H + 30, 12))
    # effect if applied
    ey = cy0 + 62 + H + 62
    o.append(rect(R, ey - 4, W, 1, HAIR))
    o.append(eyebrow(R, ey + 24, "IF APPLIED"))
    for i, (lab, a, b) in enumerate((("Fast-moving in best locations, aisle G", "41", "42"),
                                     ("Moves in the planning copy", "3", "4"))):
        ex0 = R + 120 + i * 330
        o.append(t(ex0, ey + 24, lab, 13, INK2, "b w5"))
        o.append(t(ex0, ey + 52, f"{a}  →  {b}", 22, INK, LB))
    # prev / next
    ny = cy0 + ch + 22
    o.append(rect(40, ny, 132, 42, "#ECEBE6", 6, BORDER, 1) + t(106, ny + 26, "Previous", 14, "#80868E", "b w7", "middle"))
    o.append(t(186, ny + 26, "None before #1", 13, INK3))
    o.append(t(1400 - 230, ny + 26, "Next open: #4 8044172 Oil filter", 13.5, INK2, "b w5", "end"))
    o.append(btn(1400 - 214, ny, 214, "Next recommendation", "secondary", "i-arrow-r", 42))
    return svg("Smart Warehouse Planner — Recommendations A: Review queue",
               "Recommendations workspace, alternative A: one recommendation at a time. A queue strip shows every recommendation of round 1 as a numbered disc by rule and state; the open card shows the part, the move, three facts that explain why, Apply / Other location / Keep in place / Manual move, and aisle G with the bin lifted to its best location.",
               "\n".join(o))


# ------------------------------------------------------------------ B: list + detail
def make_b():
    o = [toolbar(), page_header()]
    # left: list panel
    lx, ly, lw, lh = 40, 168, 640, 708
    o.append(rect(lx, ly, lw, lh, "#fff", 8, BORDER, 1))
    # state tabs
    tabs = [("Open", 13, True), ("Applied", 2, False), ("Kept in place", 3, False), ("Outdated", 1, False), ("No space", 31, False)]
    tx = lx + 20
    for lab, n, sel in tabs:
        o.append(t(tx, ly + 34, lab, 14, INK if sel else INK2, "b w7" if sel else "b w5"))
        pw = 18 + (8 if n > 9 else 0)
        px = tx + tw(lab, 14, bold=sel) + 6
        o.append(rect(px, ly + 21, pw, 18, INK if sel else "#fff", 9, None if sel else BORDER, 1))
        o.append(t(px + pw / 2, ly + 34.5, str(n), 12, "#fff" if sel else INK, LB, "middle"))
        if sel:
            o.append(rect(tx, ly + 49, px + pw - tx, 3, INK))
        tx = px + pw + 22
    o.append(rect(lx, ly + 52, lw, 1, HAIR))
    # column heads
    hy = ly + 76
    for s, x0, anc in (("#", lx + 30, "middle"), ("Part", lx + 92, None), ("From → to", lx + 336, None), ("Picks", lx + lw - 20, "end")):
        o.append(t(x0, hy, s, 11.5, INK3, "b w6", anc))
    o.append(f'<clipPath id="listclip"><rect x="{lx}" y="{hy+8}" width="{lw}" height="{ly+lh-hy-9}" rx="8"/></clipPath>')
    o.append('<g clip-path="url(#listclip)">')
    y = hy + 8
    for r in (1, 2, 3):
        rows = [z for z in RECS if z[1] == r and z[9] == "open"]
        o.append(rect(lx, y, lw, 30, BAND))
        o.append(rect(lx + 16, y + 6, 46, 18, INK, 3))
        o.append(t(lx + 39, y + 19.5, f"Rule {r}", 12, "#fff", LB, "middle"))
        o.append(t(lx + 72, y + 20, RULES[r][0], 13, INK, "b w7"))
        y += 30
        for n, _, part, desc, c, picks, fr, to, best, st in rows:
            sel = n == 1
            rh = 56
            if sel:
                o.append(rect(lx + 1, y, lw - 2, rh, TINT))
                o.append(rect(lx + 1, y, 5, rh, ACCENT))
            o.append(rect(lx, y + rh, lw, 1, HAIR))
            o.append(marker(lx + 30, y + rh / 2, n, "sel" if sel else "rec", 11))
            o.append(swatch(lx + 54, y + 14, c, 24, 27))
            o.append(t(lx + 92, y + 25, part, 16, INK, LB))
            o.append(t(lx + 92, y + 44, desc, 12.5, INK2))
            s, ex = code_pair(lx + 336, y + 33, fr, to, 15)
            o.append(s)
            if best:
                o.append(best_tag(ex + 6, y + 20))
            o.append(t(lx + lw - 20, y + 35, str(picks), 20, INK, LB, "end"))
            y += rh
            if y > ly + lh:
                break
    o.append('</g>')
    o.append('<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>')
    o.append(rect(lx + 1, ly + lh - 46, lw - 2, 45, "url(#fade)", 8))
    # right: detail panel
    dx, dy, dw, dh = 696, 168, 704, 708
    o.append(rect(dx, dy, dw, dh, "#fff", 8, BORDER, 1))
    o.append(rect(dx, dy, 5, dh, ACCENT, 2))
    P = dx + 32
    o.append(eyebrow(P, dy + 38, "SELECTED · #1 · RULE 1"))
    o.append(link(dx + dw - 28, dy + 38, "Show on the Locations wall", 13, "end"))
    o.append(swatch(P, dy + 56, "F", 34, 38))
    o.append(t(P + 48, dy + 86, "4410281", 32, INK, LB))
    o.append(t(P + 48 + tw("4410281", 32, True, True) + 14, dy + 86, "Brake pads, front – VW Golf", 18, INK, "b w6"))
    # reason as a sentence, with numbers in bold
    o.append(f'<text x="{P}" y="{dy+134}" class="b w4" font-size="19" fill="{INK}">'
             f'<tspan class="b w7">61 picks</tspan> in the period, so it is fast-moving (24 or more).</text>')
    o.append(f'<text x="{P}" y="{dy+162}" class="b w4" font-size="19" fill="{INK}">'
             f'It sits on <tspan class="b w7">level 4</tspan>, not a best location. Rule 1 lifts it</text>')
    o.append(f'<text x="{P}" y="{dy+190}" class="b w4" font-size="19" fill="{INK}">'
             f'to the first empty best location, <tspan class="lb w7">G-14-01-04</tspan>.</text>')
    w, W, H, _ = wall(dx + 24, dy + 214, WALL_G, ("Section 13", "Section 14", "Section 15"), 44, 46, lifts=LIFTS)
    o.append(w)
    o.append(key_row(dx + 24, dy + 214 + H + 26, 11, 12))
    # move line + effect
    my = dy + 214 + H + 74
    s, ex = code_pair(P, my, "G-14-04-02", "G-14-01-04", 24)
    o.append(s)
    o.append(best_tag(ex + 10, my - 15))
    o.append(t(P + 400, my - 6, "If applied: fast-moving in best locations,", 12.5, INK2, "b w5"))
    o.append(t(P + 400, my + 12, "aisle G  41 → 42 · this becomes move 4", 12.5, INK2, "b w5"))
    # action bar
    ay = dy + dh - 72
    o.append(rect(dx + 5, ay - 4, dw - 5, 1, HAIR))
    o.append(btn(P, ay + 14, 132, "Apply", "primary", "i-check", 44, 15))
    o.append(btn(P + 144, ay + 14, 168, "Other location ▾", "tertiary", None, 44))
    o.append(link(P + 336, ay + 41, "Keep in place", 14))
    o.append(link(P + 456, ay + 41, "Manual move…", 14))
    o.append(kbd(dx + dw - 70, ay + 41, "Alt+A")[0])
    return svg("Smart Warehouse Planner — Recommendations B: List and detail",
               "Recommendations workspace, alternative B: a compact list on the left filtered by state (Open 13, Applied 2, Kept in place 3, Outdated 1, No space 31) and grouped by rule; the selected recommendation on the right with its reason as a sentence, aisle G with the lifted bin and arrow, and the actions in a bar at the bottom.",
               "\n".join(o))


# ------------------------------------------------------------------ C: wall first
def make_c():
    o = [toolbar(), page_header()]
    # aisle switcher
    ay = 168
    o.append(t(40, ay + 26, "Aisle", 15, INK, "b w7"))
    counts = {"A": 9, "B": 3, "C": 2, "D": 3, "E": 3, "F": 3, "G": 4, "H": 5, "I": 1}
    x = 92
    for a, n in counts.items():
        cur = a == "G"
        o.append(rect(x, ay, 44, 38, INK if cur else "#fff", 4, None if cur else BORDER, 1))
        o.append(t(x + 22, ay + 26, a, 20, "#fff" if cur else INK, LB, "middle"))
        o.append(f'<circle cx="{x+42}" cy="{ay+2}" r="9" fill="#fff" stroke="{INK}" stroke-width="1.2"/>')
        o.append(t(x + 42, ay + 6, str(n), 10.5, INK, LB, "middle"))
        x += 54
    o.append(t(x + 10, ay + 18, "Moves touching each aisle", 12.5, INK3))
    o.append(t(x + 10, ay + 34, "(leaving or arriving)", 12.5, INK3))
    # big wall
    rows = [a + b for a, b in zip(WALL_G, WALL_G16)]
    w, W, H, cell = wall(40, 222, rows, ("Section 13", "Section 14", "Section 15", "Section 16"), 52, 58, lifts=LIFTS)
    o.append(w)
    # hover note for the selected move: right of its arrow (over section 15, level 3),
    # never over the from-bin or the target
    nx, ny = 568, 348
    o.append(f'<g filter="url(#pop)">{rect(nx, ny, 222, 54, "#fff", 4)}</g>')
    o.append(rect(nx, ny, 6, 54, ACCENT, 2))
    o.append(t(nx + 18, ny + 22, "#1 · Rule 1 · 4410281", 13, INK, "b w7"))
    o.append(t(nx + 18, ny + 42, "61 picks · L4 → L1", 12.5, INK2, "b w5"))
    o.append(best_tag(nx + 134, ny + 29))
    o.append(key_row(40, 222 + H + 26, 12, 18))
    # selected detail strip under the wall
    sy = 222 + H + 50
    sw, sh = W, 876 - sy
    o.append(rect(40, sy, sw, sh, "#fff", 8, BORDER, 1))
    o.append(rect(40, sy, 5, sh, ACCENT, 2))
    P = 72
    o.append(eyebrow(P, sy + 36, "SELECTED · #1 OF 19 · RULE 1 · FAST-MOVING PARTS INTO BEST LOCATIONS"))
    o.append(t(P, sy + 76, "4410281", 32, INK, LB))
    o.append(t(P + tw("4410281", 32, True, True) + 14, sy + 76, "Brake pads, front – VW Golf", 18, INK, "b w6"))
    s, ex = code_pair(P, sy + 120, "G-14-04-02", "G-14-01-04", 24)
    o.append(s)
    o.append(best_tag(ex + 10, sy + 105))
    o.append(f'<text x="{P}" y="{sy+160}" class="b w4" font-size="15" fill="{INK}"><tspan class="b w7">61 picks</tspan> in the period: fast-moving (24 or more). Now on level 4, not best.</text>')
    o.append(f'<text x="{P}" y="{sy+182}" class="b w4" font-size="15" fill="{INK2}">G-14-01-04 is the first empty best location in location-code order.</text>')
    # actions column
    AX = 40 + sw - 268
    o.append(rect(AX - 24, sy + 20, 1, sh - 40, HAIR))
    o.append(btn(AX, sy + 30, 236, "Apply", "primary", "i-check", 46, 15.5))
    o.append(btn(AX, sy + 86, 236, "Other location ▾", "tertiary", None, 40))
    o.append(link(AX, sy + 154, "Keep in place", 14))
    o.append(link(AX + 236, sy + 154, "Manual move…", 14, "end"))
    o.append(t(AX, sy + 186, "Nothing changes until you apply.", 12.5, INK3))
    # right rail
    ry = 168
    rx = 40 + W + 20
    rw = 1400 - rx
    o.append(rect(rx, ry, rw, 876 - ry, "#fff", 8, BORDER, 1))
    RP = rx + 20
    o.append(eyebrow(RP, ry + 32, "ROUND 1 · 19 RECOMMENDATIONS"))
    tiles = [("Open", 13), ("Applied", 2), ("Kept in place", 3), ("Outdated", 1)]
    tw_ = (rw - 40 - 8) / 2
    for i, (lab, n) in enumerate(tiles):
        tx, ty = RP + (i % 2) * (tw_ + 8), ry + 46 + (i // 2) * 62
        o.append(rect(tx, ty, tw_, 54, "#F6F5F1" if i else INK, 6))
        fg = "#fff" if i == 0 else INK
        o.append(t(tx + 14, ty + 36, str(n), 28, fg, LB))
        o.append(t(tx + 14 + tw(str(n), 28, True, True) + 10, ty + 33, lab, 13, "#fff" if i == 0 else INK2, "b w6"))
    hy = ry + 196
    o.append(t(RP, hy, "Open in aisle G", 17, INK, LB))
    o.append(t(rx + rw - 20, hy, "4", 17, INK2, LB, "end"))
    cy = hy + 14
    for n in (1, 4, 5, 10):
        rec = RECS[n - 1]
        _, rule, part, desc, c, picks, fr, to, best, st = rec
        sel = n == 1
        chh = 66
        if sel:
            o.append(rect(rx + 1, cy, rw - 2, chh, TINT))
            o.append(rect(rx + 1, cy, 5, chh, ACCENT))
        o.append(rect(rx, cy + chh, rw, 1, HAIR))
        o.append(marker(RP + 10, cy + 22, n, "sel" if sel else "rec", 11))
        o.append(swatch(RP + 30, cy + 9, c, 22, 25))
        o.append(t(RP + 62, cy + 27, part, 16, INK, LB))
        o.append(t(rx + rw - 20, cy + 27, f"{picks} picks", 12.5, INK2, "b w6", "end"))
        s, ex = code_pair(RP + 62, cy + 52, fr, to, 14)
        o.append(s)
        if best:
            o.append(best_tag(ex + 6, cy + 39))
        else:
            o.append(t(ex + 8, cy + 52, "leaves G", 12, INK3))
        cy += chh
    oy = cy + 34
    o.append(t(RP, oy, "Other aisles", 17, INK, LB))
    for i, (a, s) in enumerate((("A", "9 moves · 7 arriving"), ("H", "5 moves · all arriving"), ("D", "3 moves · pick groups"),
                                ("", "No space · 31 parts"))):
        ry2 = oy + 14 + i * 40
        o.append(rect(rx, ry2 + 40, rw, 1, HAIR))
        if a:
            o.append(rect(RP, ry2 + 8, 26, 26, INK, 3))
            o.append(t(RP + 13, ry2 + 27, a, 16, "#fff", LB, "middle"))
        else:
            o.append(rect(RP, ry2 + 8, 26, 26, "url(#hatchD)", 3))
        o.append(t(RP + 38, ry2 + 26, s, 13.5, INK, "b w5"))
        o.append(icon("i-chev-r", rx + rw - 36, ry2 + 12, 18, INK))
    return svg("Smart Warehouse Planner — Recommendations C: Wall first",
               "Recommendations workspace, alternative C: the open aisle's bin wall is the main picture with every move touching the aisle lifted and numbered; the selected move draws its arrow and note. Under the wall the selected move with its reason and actions; on the right a rail with counts per state and the moves of this aisle, then the other aisles.",
               "\n".join(o))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else HERE
    os.makedirs(out, exist_ok=True)
    for name, fn in (("A-review-queue.svg", make_a), ("B-list-detail.svg", make_b), ("C-wall-first.svg", make_c)):
        open(os.path.join(out, name), "w").write(fn())
        print("wrote", name)
