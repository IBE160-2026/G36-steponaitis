"""Three alternative Locations (warehouse wall) screens, Bin Wall style.

Reuses defs.svgfrag and the text/logo/svg helpers of ../../landing-redesign/gen_landing.py.
Usage: python3 gen_warehouse.py [out_dir]   (default: this folder)

A  Aisle in focus   - aisle tabs, one full-width wall at a larger bin size, moves in a bottom drawer
B  Warehouse first  - zoom level 1: all nine aisles as wall cards, cross-aisle move drawn as one arc
C  Walk the aisle   - one continuous run at landing-page bin size, whole-aisle scrubber, inline move
                      callout with a move stepper, drag to swap in progress
Synthetic data only.
"""
import os
import random
import sys

S = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(S, "..", "..", "landing-redesign"))
from gen_landing import (t, logo, svg, INK, INK2, INK3, SURF, BORDER, HAIR, ONDARK, ONDARK2,  # noqa: E402
                         ONDARK_NAV, CLS, GLY, LBL, BEST, BEST_L, ACCENT, LB)

WALLC, SLOT, RIM, BEAM, UPRIGHT, SLAT = "#30353A", "#141719", "#8A9097", "#1F2326", "#454B52", "#3A4046"
TINT, TRACK, MUTED_D, INPUT_B = "#F3EFFD", "#16191C", "#9AA1A8", "#8A9097"

EXTRA_DEFS = """<defs>
<symbol id="i-palette" viewBox="0 0 20 20"><g class="ic"><path d="M10 3a7 7 0 0 0 0 14c1.3 0 1.7-.9 1.3-1.8-.4-1 .2-2 1.3-2H15a2.5 2.5 0 0 0 2.5-2.5C17.5 6.2 14.2 3 10 3z"/><circle cx="6.4" cy="9.2" r=".9"/><circle cx="8.8" cy="6.2" r=".9"/><circle cx="12.4" cy="6.4" r=".9"/></g></symbol>
<symbol id="i-swap" viewBox="0 0 20 20"><g class="ic"><path d="M3.5 7h12M12.5 4l3 3-3 3M16.5 13h-12M7.5 10l-3 3 3 3"/></g></symbol>
<symbol id="i-chev-l" viewBox="0 0 20 20"><g class="ic"><path d="M12 5.5 7.5 10 12 14.5"/></g></symbol>
<symbol id="i-chev-u" viewBox="0 0 20 20"><g class="ic"><path d="M5.5 12 10 7.5 14.5 12"/></g></symbol>
<symbol id="i-zoom" viewBox="0 0 20 20"><g class="ic"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3 17 17M6.3 8.5h4.4M8.5 6.3v4.4"/></g></symbol>
<marker id="ahv" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M1 1 9 5 1 9Z" fill="#9466F0" stroke="#141719" stroke-width="1"/></marker>
<linearGradient id="fadeR" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#30353A" stop-opacity="0"/><stop offset="1" stop-color="#30353A" stop-opacity="1"/></linearGradient>
<linearGradient id="fadeL" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#30353A" stop-opacity="1"/><stop offset="1" stop-color="#30353A" stop-opacity="0"/></linearGradient>
</defs>"""


def tw(s, size, face="b"):
    """Rough text width for layout (Figtree ~0.555em, Barlow Semi Condensed bold ~0.47em)."""
    return len(s) * size * (0.47 if face == "lb" else 0.555)


def rect(x, y, w, h, fill="none", rx=0, stroke=None, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"{s}{extra}/>'


def icon(name, x, y, size=18, color=INK):
    return f'<use href="#{name}" x="{x:.1f}" y="{y:.1f}" width="{size}" height="{size}" stroke="{color}" color="{color}"/>'


# ------------------------------------------------------------------ bin system
def bin_(x, y, w, h, c, mini=False):
    """A bin in class colour with its white label window. c = F/M/S/D or two classes 'FM' (split label)."""
    main = c[0]
    o = [rect(x, y, w, h, CLS[main], 1.2 if mini else 2.5)]
    if mini:  # overview scale: body, lip and a small label window, no glyph
        o.append(rect(x, y, w, max(1.2, h * 0.16), "#000", 0.6, extra=' fill-opacity="0.22"'))
        o.append(rect(x + w * 0.2, y + h * 0.42, w * 0.6, h * 0.32, "#fff", 0.4))
        return "".join(o)
    lip = max(3, h * 0.1)
    o.append(rect(x, y, w, lip, "#000", 2, extra=' fill-opacity="0.22"'))
    o.append(f'<path d="M{x+2:.1f} {y+h-1.5:.1f} H{x+w-2:.1f}" stroke="#000" stroke-opacity="0.18" stroke-width="1.5"/>')
    pad = max(3.5, w * 0.11)
    wx, ww = x + pad, w - 2 * pad
    wh = max(13, h * 0.42)
    wy = y + lip + (h - lip - wh) / 2
    o.append(rect(wx, wy, ww, wh, "#fff", 1.5))
    if len(c) == 2:  # split label, one glyph per half
        g = min(wh - 4, 9)
        for i, cc in enumerate(c):
            hx = wx + ww * (0.25 + 0.5 * i)
            o.append(f'<use href="#{GLY[cc]}" x="{hx-g/2:.1f}" y="{wy+(wh-g)/2:.1f}" width="{g}" height="{g}"/>')
        o.append(f'<path d="M{wx+ww/2:.1f} {wy+2:.1f} V{wy+wh-2:.1f}" stroke="{INK}" stroke-width="1"/>')
        return "".join(o)
    if w >= 50:  # glyph + three-letter code
        g = 10
        o.append(f'<use href="#{GLY[main]}" x="{wx+5:.1f}" y="{wy+(wh-g)/2:.1f}" width="{g}" height="{g}"/>')
        o.append(t(f"{wx+18:.1f}", f"{wy+wh/2+4.3:.1f}", LBL[main], 12, INK, LB))
    else:
        g = min(wh - 4, 10)
        o.append(f'<use href="#{GLY[main]}" x="{wx+(ww-g)/2:.1f}" y="{wy+(wh-g)/2:.1f}" width="{g}" height="{g}"/>')
    return "".join(o)


def slot(x, y, w, h, mini=False):
    if mini:
        return rect(x, y, w, h, SLOT, 0.8)
    return (rect(x + 0.5, y + 0.5, w - 1, h - 1, SLOT, 2, RIM, 1) +
            rect(x + w * 0.28, y + 4, w * 0.44, 2.6, SLAT, 1.3) +
            f'<path d="M{x+3:.1f} {y+h-3.5:.1f} H{x+w-3:.1f}" stroke="#2C3136" stroke-width="1"/>')


def no_loc(x, y, w, h, mini=False):
    return rect(x, y, w, h, "url(#hatchD)", 0.8 if mini else 2)


def cased_frame(x, y, w, h, pad=3, rx=4, dashed=False):
    d = ' stroke-dasharray="5 3"' if dashed else ""
    return (f'<rect x="{x-pad:.1f}" y="{y-pad:.1f}" width="{w+2*pad:.1f}" height="{h+2*pad:.1f}" rx="{rx}" fill="none" stroke="{SLOT}" stroke-width="5"/>'
            f'<rect x="{x-pad:.1f}" y="{y-pad:.1f}" width="{w+2*pad:.1f}" height="{h+2*pad:.1f}" rx="{rx}" fill="none" stroke="{ACCENT}" stroke-width="2.2"{d}/>')


def left_behind(x, y, w, h):
    """The dashed white outline a lifted (or dragged) bin leaves in its slot."""
    return slot(x, y, w, h) + rect(x + 1, y + 1, w - 2, h - 2, "none", 2, "#fff", 1.5, ' stroke-dasharray="4 3"')


def lifted(x, y, w, h, c, selected=False, dx=None, dy=None):
    """Bin pulled out of its slot: 1.2x, offset up and left, lift shadow. Returns svg and the lifted box."""
    W, H = w * 1.2, h * 1.2
    lx = x - (w * 0.1 if dx is None else dx) - w * 0.1
    ly = y - (h * 0.42 if dy is None else dy) - h * 0.1
    o = [left_behind(x, y, w, h), '<g filter="url(#lift)">', bin_(lx, ly, W, H, c), "</g>"]
    if selected:
        o.append(cased_frame(lx, ly, W, H, 3, 4))
    return "".join(o), (lx, ly, W, H)


def target(x, y, w, h, selected=False, glyph="i-plus"):
    o = [slot(x, y, w, h)]
    if selected:
        o.append(cased_frame(x, y, w, h, 3, 4))
    else:
        o.append(rect(x - 2, y - 2, w + 4, h + 4, "none", 3, "#fff", 1.6, ' stroke-dasharray="4 3"'))
    s = min(18, w * 0.5)
    o.append(icon(glyph, x + w / 2 - s / 2, y + h / 2 - s / 2 + 1, s, "#fff"))
    return "".join(o)


def marker(cx, cy, kind, label="", r=9.5, on_wall=True):
    """Move marker chip. kind: rec / sel / man / app / out."""
    o = []
    if kind == "sel":
        if on_wall:
            o.append(f'<circle cx="{cx}" cy="{cy}" r="{r+2.6}" fill="{SLOT}"/>')
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="{ACCENT}" stroke-width="2.4"/>')
        o.append(t(cx, cy + r * 0.42, label, r * 1.25, INK, LB, "middle"))
    elif kind == "rec":
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="{INK}" stroke-width="1.5"/>')
        o.append(t(cx, cy + r * 0.42, label, r * 1.25, INK, LB, "middle"))
    elif kind == "out":
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="#8F969D" stroke-width="1.5" stroke-dasharray="3 2"/>')
        o.append(t(cx, cy + r * 0.42, label, r * 1.25, INK2, LB, "middle"))
    else:
        ring = ' stroke="#fff" stroke-width="1.5"' if on_wall else ""
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{INK}"{ring}/>')
        if kind == "man":
            o.append(t(cx, cy + r * 0.42, "M", r * 1.2, "#fff", LB, "middle"))
        else:
            s = r * 1.3
            o.append(icon("i-check", cx - s / 2, cy - s / 2, s, "#fff"))
    return "".join(o)


def arrow(d):
    return (f'<path d="{d}" fill="none" stroke="{SLOT}" stroke-width="7" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{ACCENT}" stroke-width="3.2" stroke-linecap="round" marker-end="url(#ahv)"/>')


# ------------------------------------------------------------------ data (synthetic)
POS = [(s, lv, p) for s in range(1, 20) for lv in range(1, 5) for p in range(1, 4)]


def pick(rnd, w):
    r, acc = rnd.random() * sum(w.values()), 0
    for k, v in w.items():
        acc += v
        if r <= acc:
            return k
    return k


LOW = {"F": 46, "M": 32, "S": 14, "D": 8}
HIGH = {"F": 13, "M": 25, "S": 37, "D": 25}


def aisle_a():
    """Aisle A, planning copy after round 1. 198 of 228 occupied; L1+L2 best (114) + 3 single marks;
    the only empty best locations are the three move targets."""
    rnd = random.Random(11)
    fixed = {(12, 4, 2): "F", (14, 2, 1): ".", (2, 1, 1): ".", (17, 1, 2): ".", (1, 4, 1): "D",
             (3, 4, 2): ".", (5, 1, 3): "F", (11, 2, 2): "M", (7, 1, 2): "FM", (1, 3, 1): "S", (1, 3, 2): "M",
             (16, 4, 3): "S", (15, 1, 2): "M", (13, 3, 2): "S", (10, 4, 1): "D"}
    upper = [q for q in POS if q[1] >= 3 and q not in fixed]
    empties = set(rnd.sample(upper, 26))
    g = {}
    for q in POS:
        if q in fixed:
            g[q] = fixed[q]
        elif q in empties:
            g[q] = "."
        else:
            g[q] = pick(rnd, LOW if q[1] <= 2 else HIGH)
    return g


AISLES = {  # letter: (occupied, locations, moves touching)
    "A": (198, 228, 7), "B": (194, 228, 4), "C": (187, 228, 3), "D": (180, 228, 3), "E": (176, 228, 2),
    "F": (184, 228, 2), "G": (171, 228, 2), "H": (179, 228, 5), "I": (115, 176, 1)}


def aisle_generic(letter):
    if letter == "A":
        return aisle_a()
    occ, n, _ = AISLES[letter]
    rnd = random.Random(ord(letter) * 7)
    real = POS[:n]
    fixed = {}
    if letter == "G":
        fixed = {(14, 4, 2): "F"}
    # empties: upper levels more likely; aisle B keeps 4 empty on its best level L1
    cand = [q for q in real if q not in fixed]
    weights = [(3.0 if q[1] >= 3 else 1.0) for q in cand]
    need = n - occ
    empties = set()
    if letter == "B":
        l1 = [q for q in cand if q[1] == 1]
        empties |= set(rnd.sample(l1, 4))
        cand = [q for q in cand if q[1] != 1]
        weights = [(3.0 if q[1] >= 3 else 1.0) for q in cand]
    while len(empties) < need:
        q = rnd.choices(cand, weights)[0]
        empties.add(q)
    g = {}
    for q in POS:
        if q not in real:
            g[q] = "X"
        elif q in fixed:
            g[q] = fixed[q]
        elif q in empties:
            g[q] = "."
        else:
            g[q] = pick(rnd, LOW if q[1] <= 2 else HIGH)
    return g


# ------------------------------------------------------------------ wall run
class Geo:
    def __init__(self, bw, bh, gap, U=6, m=5, lvl_p=46, label_w=60, head_h=30, beam=5, mini=False):
        self.bw, self.bh, self.gap, self.U, self.m = bw, bh, gap, U, m
        self.lvl_p, self.label_w, self.head_h, self.beam, self.mini = lvl_p, label_w, head_h, beam, mini
        self.sec_p = U + 2 * m + 3 * bw + 2 * gap


def run(x0, y0, secs, data, geo, best_levels=(), singles=(), skip=(), section_labels=True,
        level_labels=True, bg=True, extra_w=0, sec_left=False):
    """One run of sections (L4 on top). Returns (svg, pos dict, width, height).
    skip: positions drawn as plain slot-under-overlay (caller draws lifted/targets there)."""
    g = geo
    W = g.label_w + len(secs) * g.sec_p + g.U + 6 + extra_w
    H = g.head_h + 4 * g.lvl_p + 4
    o = []
    if bg:
        o.append(rect(x0, y0, W, H, "url(#louvre2)", 8 if not g.mini else 4))
    pos = {}
    top_air = (g.lvl_p - g.bh - g.beam) * 0.55
    run_w = len(secs) * g.sec_p + g.U
    for li, lvl in enumerate((4, 3, 2, 1)):
        ly = y0 + g.head_h + li * g.lvl_p
        by = ly + top_air
        beam_y = by + g.bh + (1 if g.mini else 3)
        o.append(rect(x0 + g.label_w, beam_y, run_w + extra_w, g.beam, BEST if lvl in best_levels else BEAM))
        if level_labels:
            n_single = sum(1 for q in singles if q[1] == lvl and q[0] in secs)
            is_best = lvl in best_levels or n_single
            ty = by + g.bh / 2 + (-1 if is_best else 5)
            o.append(t(x0 + 12, ty, f"L{lvl}", 15, ONDARK, LB))
            if is_best:
                lab = "BEST" if lvl in best_levels else f"BEST {n_single}"
                bw_ = 34 if lab == "BEST" else 44
                o.append(rect(x0 + 8, by + g.bh / 2 + 3, bw_, 16, BEST, 2))
                o.append(t(x0 + 8 + bw_ / 2, by + g.bh / 2 + 15, lab, 11, INK, LB, "middle"))
    for si, s in enumerate(secs):
        sx = x0 + g.label_w + si * g.sec_p
        o.append(rect(sx, y0 + g.head_h, g.U, 4 * g.lvl_p - 2, UPRIGHT))
        if section_labels:
            if sec_left:
                o.append(t(sx + g.U + g.m, y0 + g.head_h - 10, f"{s:02d}", 13, ONDARK2, "lb w6"))
            else:
                o.append(t(sx + g.U + (g.sec_p - g.U) / 2, y0 + g.head_h - 10, f"{s:02d}", 13, ONDARK2, "lb w6", "middle"))
        for li, lvl in enumerate((4, 3, 2, 1)):
            by = y0 + g.head_h + li * g.lvl_p + top_air
            for p in (1, 2, 3):
                bx = sx + g.U + g.m + (p - 1) * (g.bw + g.gap)
                q = (s, lvl, p)
                pos[q] = (bx, by)
                c = data.get(q, "X")
                if q in skip:
                    continue
                if c == "X":
                    o.append(no_loc(bx, by, g.bw, g.bh, g.mini))
                elif c == ".":
                    o.append(slot(bx, by, g.bw, g.bh, g.mini))
                else:
                    o.append(bin_(bx, by, g.bw, g.bh, c, g.mini))
                if q in singles and lvl not in best_levels:
                    o.append(rect(bx - 2.5, by - 2.5, g.bw + 5, g.bh + 5, "none", 3, BEST, 2))
    ex = x0 + g.label_w + len(secs) * g.sec_p
    o.append(rect(ex, y0 + g.head_h, g.U, 4 * g.lvl_p - 2, UPRIGHT))
    return "".join(o), pos, W, H


# ------------------------------------------------------------------ shell
STEPS = ["Overview", "Parts", "Locations", "Pick groups", "Best locations", "Recommendations", "Before/after", "Move list"]
STEP_X = [434, 526, 597, 696, 810, 945, 1087, 1208]  # disc centres, as in the interface mock


def toolbar(current=2):
    o = [rect(0, 0, 1440, 64, "url(#louvre)"), '<line x1="0" y1="63.5" x2="1440" y2="63.5" stroke="#121416" stroke-width="1"/>',
         logo(22, 17), t(62, 29, "Smart Warehouse", 15, "#fff", LB), t(62, 46, "Planner", 15, "#fff", LB)]
    # plan plate: white label, 6px ink bar, chevron
    o.append(rect(186, 11, 214, 42, "#fff", 3))
    o.append(rect(186, 11, 6, 42, INK))
    o.append(t(202, 29, "Spring re-slot 2026", 15, INK, LB))
    o.append(t(202, 45, "Data as of 2026-09-30 · round 1", 11.5, INK2, "b w5"))
    o.append(icon("i-chev-d", 376, 22, 16, INK2))
    o.append(rect(416, 13, 894, 38, TRACK, 7, SLAT, 1))
    done = {0, 1, 3, 4}
    for i, (name, cx) in enumerate(zip(STEPS, STEP_X)):
        if i == current:
            o.append(rect(cx - 13, 18, 30 + tw(name, 13) + 4, 28, "#fff", 4))
            o.append(f'<circle cx="{cx}" cy="32" r="7.5" fill="#fff" stroke="{INK}" stroke-width="1.4"/>')
            o.append(t(cx, 36, str(i + 1), 11, INK, LB, "middle"))
            o.append(t(cx + 13, 36.5, name, 13, INK, "b w7"))
        elif i in done:
            o.append(f'<circle cx="{cx}" cy="32" r="7" fill="{ONDARK_NAV}"/>')
            o.append(icon("i-check", cx - 5, 27, 10, INK))
            o.append(t(cx + 13, 36.5, name, 13, ONDARK_NAV, "b w5"))
        else:
            o.append(f'<circle cx="{cx}" cy="32" r="7" fill="none" stroke="{MUTED_D}" stroke-width="1.2"/>')
            o.append(t(cx, 36, str(i + 1), 11, MUTED_D, LB, "middle"))
            o.append(t(cx + 13, 36.5, name, 13, ONDARK_NAV, "b w5"))
    o.append(rect(1334, 14, 36, 36, TRACK, 6, SLAT, 1))
    o.append(icon("i-menu", 1343, 23, 18, "#E8EAEC"))
    o.append(f'<circle cx="1398" cy="32" r="17" fill="{ONDARK}"/>')
    o.append(t(1398, 37, "JS", 13, INK, LB, "middle"))
    return "".join(o)


def btn(x, y, w, label, kind="tertiary", ic=None, h=36, size=14):
    if kind == "primary":
        o, fg = rect(x, y, w, h, INK, 6), "#fff"
    elif kind == "secondary":
        o, fg = rect(x, y, w, h, "#fff", 6, INK, 1.2), INK
    else:
        o, fg = rect(x, y, w, h, "#fff", 6, BORDER, 1), INK
    if ic:
        tx = x + (w - (tw(label, size) + 26)) / 2
        o += icon(ic, tx, y + h / 2 - 9, 18, fg)
        o += t(tx + 26, y + h / 2 + size * 0.36, label, size, fg, "b w6")
    else:
        o += t(x + w / 2, y + h / 2 + size * 0.36, label, size, fg, "b w6", "middle")
    return o


def segmented(x, y, labels, sel=0, h=36, size=13.5, pad=16):
    ws = [tw(l, size) + 2 * pad for l in labels]
    o = [rect(x, y, sum(ws) + 6, h, "#fff", 6, BORDER, 1)]
    cx = x + 3
    for i, (l, w) in enumerate(zip(labels, ws)):
        if i == sel:
            o.append(rect(cx, y + 3, w, h - 6, INK, 4))
        o.append(t(cx + w / 2, y + h / 2 + size * 0.36, l, size, "#fff" if i == sel else INK, "b w6", "middle"))
        cx += w
    return "".join(o), sum(ws) + 6


def search(x, y, w, ph="Find a location code or part number"):
    return (rect(x, y, w, 36, "#fff", 6, INPUT_B, 1) + icon("i-search", x + 12, y + 9, 18, INK2) +
            t(x + 40, y + 23, ph, 13.5, INK3))


def mini_swatch(x, y, kind, w=18, h=20):
    """Key miniatures drawn on paper (class swatches get an ink outline)."""
    if kind in CLS or kind == "FM":
        return bin_(x, y, w, h, kind) + rect(x, y, w, h, "none", 2.5, INK, 1.2)
    if kind == "empty":
        return rect(x, y, w, h, SLOT, 2, RIM, 1)
    if kind == "best":
        return rect(x + 2, y + 2, w - 4, h - 4, SLOT, 1) + rect(x, y, w, h, "none", 3, BEST, 2.2)
    if kind == "sel":
        return rect(x + 3, y + 3, w - 6, h - 6, SLOT, 1) + cased_frame(x + 3, y + 3, w - 6, h - 6, 1.5, 3)
    return ""


KEY = [("F", "Fast-moving", True), ("M", "Medium-moving", True), ("S", "Slow-moving", True),
       ("D", "Dead stock", True), ("empty", "Empty (open slot)", False), ("best", "Best location", True),
       ("sel", "Selected", True), ("FM", "2 parts", False)]


def key_row(x, y, size=13.5, gap=18, hint=True, hover=None):
    o = [t(x, y + 15, "Key", 15, INK, LB)]
    cx = x + 42
    for kind, label, click in KEY:
        lw = tw(label, size) * 1.03
        w = 26 + lw + (24 if click else 0)
        if kind == hover:
            o.append(rect(cx - 6, y - 5, w + 12, 30, TINT, 4))
            tip = "Change colour"
            tw_ = tw(tip, 12.5) + 24
            tx_ = cx + w / 2 - tw_ / 2
            o.append(f'<g filter="url(#pop)">{rect(tx_, y - 42, tw_, 28, "#fff", 4, BORDER, 1)}</g>')
            o.append(t(cx + w / 2, y - 23, tip, 12.5, INK, "b w6", "middle"))
        o.append(mini_swatch(cx, y, kind))
        o.append(t(cx + 26, y + 15, label, size, INK, "b w5"))
        if click:
            o.append(icon("i-palette", cx + 26 + lw + 6, y + 2, 15, INK if kind == hover else INK3))
        cx += w + gap
    if hint:
        o.append(t(1408, y + 15, "Click an entry to change its colour", 12.5, INK3, anchor="end"))
    return "".join(o), cx


# ================================================================== A: aisle in focus
def make_a():
    o = [toolbar()]
    G = 32
    o.append(t(G, 124, "Locations", 40, INK, LB))
    o.append(t(G, 152, "Planning copy after round 1 · data as of 2026-09-30", 14, INK2))
    s, sw = segmented(0, 0, ["Planning copy", "Import"])
    o.append(search(1408 - 340, 104, 340))
    o.append(segmented(1408 - 340 - 16 - sw, 104, ["Planning copy", "Import"])[0])
    zs, zw = segmented(0, 0, ["One aisle", "Whole warehouse"])
    o.append(segmented(1408 - 340 - 16 - sw - 24 - zw, 104, ["One aisle", "Whole warehouse"], sel=0)[0])

    # aisle tabs
    ty, tw_, th, tg = 182, 116, 58, 8
    for i, (L, (occ, n, mv)) in enumerate(AISLES.items()):
        x = G + i * (tw_ + tg)
        sel = L == "A"
        o.append(rect(x, ty, tw_, th, "#fff" if sel else "none", 8, INK if sel else BORDER, 1.5 if sel else 1))
        o.append(rect(x + 12, ty + 13, 32, 32, "#fff", 3, INK, 1.4))
        o.append(t(x + 28, ty + 36, L, 20, INK, LB, "middle"))
        o.append(t(x + 54, ty + 27, f"{100*occ/n:.1f}%", 17, INK, LB))
        o.append(t(x + 54, ty + 45, f"{mv} moves" if mv > 1 else "1 move", 12.5, INK2))
    wx = G + 9 * (tw_ + tg) + 16
    o.append(rect(wx - 16, ty + 8, 1, th - 16, BORDER))
    o.append(t(wx, ty + 27, "79.2%", 17, INK, LB))
    o.append(t(wx + 48, ty + 27, "whole warehouse", 13.5, INK, "b w6"))
    o.append(t(wx, ty + 45, "1,584 of 2,000 · 416 empty · 174 best", 12.5, INK2))

    # aisle header
    hy = 286
    o.append(t(G, hy, "Aisle A", 28, INK, LB))
    o.append(t(G + 108, hy - 2, "198 of 228 locations · 30 empty · 117 best (3 empty) · Walk Path 0–2,270", 14, INK2))
    o.append(btn(1408 - 226, hy - 26, 226, "Edit best-location marks", ic="i-ribbon"))
    o.append(btn(1408 - 226 - 12 - 140, hy - 26, 140, "Open as list", ic="i-list"))

    # wall: two runs, larger bins (35 x 33) at full width
    data = aisle_a()
    geo = Geo(bw=35, bh=33, gap=5, U=6, m=5, lvl_p=46, label_w=60, head_h=30)
    wy = 312
    singles = {(1, 4, 1), (1, 3, 1), (1, 3, 2)}
    overlay = {(12, 4, 2), (14, 2, 1), (2, 1, 1), (17, 1, 2), (1, 4, 1)}
    W = 1376
    o.append(rect(G, wy, W, 2 * (geo.head_h + 4 * geo.lvl_p) + 14, "url(#louvre2)", 8))
    r1, p1, _, H1 = run(G, wy, list(range(1, 11)), data, geo, (1, 2), singles, overlay, bg=False)
    r2, p2, _, H2 = run(G, wy + H1, list(range(11, 20)), data, geo, (1, 2), singles, overlay, bg=False)
    o += [r1, r2]
    pos = {**p1, **p2}
    # end cap in the free tenth section of run 2
    ex = G + geo.label_w + 9 * geo.sec_p + geo.U + 14
    ey = wy + H1 + geo.head_h + 4
    o.append(rect(ex, ey, geo.sec_p - 28, 4 * geo.lvl_p - 14, "none", 4, "#5A6168", 1.2, ' stroke-dasharray="4 3"'))
    o.append(t(ex + (geo.sec_p - 28) / 2, ey + 66, "End of", 13, ONDARK2, "b w5", "middle"))
    o.append(t(ex + (geo.sec_p - 28) / 2, ey + 84, "aisle A", 13, ONDARK2, "b w5", "middle"))
    o.append(t(ex + (geo.sec_p - 28) / 2, ey + 116, "2,270", 15, ONDARK, LB, "middle"))
    o.append(icon("i-arrow-r", ex + (geo.sec_p - 28) / 2 - 9, ey + 126, 18, ONDARK2))

    bw, bh = geo.bw, geo.bh
    # non-selected moves: lifted bin 4 (to aisle H), targets 2 and 3 (from G and E)
    x, y = pos[(1, 4, 1)]
    svg4, box4 = lifted(x, y, bw, bh, "D", dy=8, dx=-2)
    o.append(svg4)
    o.append(rect(box4[0] - 2.5, box4[1] - 2.5, box4[2] + 5, box4[3] + 5, "none", 3, BEST, 2))
    o.append(marker(box4[0] + box4[2] + 4, box4[1] + 13, "rec", "4"))
    for q, n in (((2, 1, 1), "2"), ((17, 1, 2), "3")):
        x, y = pos[q]
        o.append(target(x, y, bw, bh))
        o.append(marker(x + bw + 1, y - 1, "rec", n))
    x, y = pos[(5, 1, 3)]
    o.append(marker(x + bw + 1, y - 1, "app"))
    x, y = pos[(11, 2, 2)]
    o.append(marker(x + bw + 1, y - 1, "man"))
    # selected move 1: A-12-04-02 -> A-14-02-01
    fx, fy = pos[(12, 4, 2)]
    txx, tyy = pos[(14, 2, 1)]
    svg1, b1 = lifted(fx, fy, bw, bh, "F", selected=True, dy=7)
    o.append(target(txx, tyy, bw, bh, selected=True))
    sx0, sy0 = b1[0] + b1[2] + 4, b1[1] + b1[3] * 0.4
    o.append(arrow(f"M{sx0:.1f} {sy0:.1f} C {sx0+90:.1f} {sy0-6:.1f}, {txx+bw/2+40:.1f} {tyy-70:.1f}, {txx+bw/2:.1f} {tyy-9:.1f}"))
    o.append(svg1)
    o.append(marker(b1[0] + b1[2] + 4, b1[1] + 13, "sel", "1"))
    o.append(marker(txx + bw + 4, tyy - 3, "sel", "1"))

    # key
    ky = wy + 2 * (geo.head_h + 4 * geo.lvl_p) + 14 + 22
    o.append(key_row(G, ky, hint=False)[0])

    # bottom drawer (collapsed to the selected move)
    dy = 818
    o.append(f'<path d="M{G} {900} V{dy+8} a8 8 0 0 1 8 -8 H{G+W-8} a8 8 0 0 1 8 8 V900 Z" fill="#fff" stroke="{BORDER}" stroke-width="1"/>')
    o.append(rect(720 - 20, dy + 6, 40, 4, BORDER, 2))
    o.append(icon("i-chev-u", G + 16, dy + 13, 18, INK))
    o.append(t(G + 42, dy + 28, "Moves touching aisle A", 18, INK, LB))
    o.append(t(G + 42 + tw("Moves touching aisle A", 18, "lb") + 14, dy + 28, "Round 1 · 7 moves · 4 to decide · numbers match the wall", 13.5, INK2))
    o.append(t(G + W - 16, dy + 28, "Show all 7", 14, INK, "b w7", "end", ' text-decoration="underline"'))
    ry = dy + 40
    o.append(rect(G + 1, ry, W - 2, 60, TINT))
    o.append(rect(G + 1, ry, 5, 60, ACCENT))
    o.append(marker(G + 30, ry + 22, "sel", "1", r=10, on_wall=False))
    o.append(t(G + 52, ry + 27, "Rule 1", 14, INK, LB))
    o.append(t(G + 112, ry + 27, "8044172", 16, INK, LB))
    o.append(t(G + 178, ry + 27, "Oil filter - Toyota Corolla", 15, INK, "b w6"))
    o.append(mini_swatch(G + 430, ry + 12, "F", 16, 18))
    o.append(t(G + 454, ry + 27, "Fast-moving · 33 picks", 13.5, INK2))
    o.append(t(G + 660, ry + 27, "A-12-04-02", 16, INK, LB))
    o.append(icon("i-arrow-r", G + 744, ry + 13, 18, INK))
    o.append(t(G + 770, ry + 27, "A-14-02-01", 16, INK, LB))
    o.append(rect(G + 854, ry + 14, 36, 16, BEST_L, 2))
    o.append(t(G + 872, ry + 26, "BEST", 11, "#fff", LB, "middle"))
    o.append(t(G + 898, ry + 27, "level 2", 13.5, INK2))
    o.append(btn(1004, ry + 8, 96, "Apply", "primary", h=32))
    o.append(btn(1112, ry + 8, 164, "Other location", "tertiary", h=32, ic="i-chev-d"))
    o.append(t(1392, ry + 29, "Keep in place", 14, INK, "b w7", "end", ' text-decoration="underline"'))
    return svg("Smart Warehouse Planner — Locations, alternative A: Aisle in focus",
               "Locations step with aisle tabs A to I, aisle A as one full-width bin wall at a larger bin size, the selected move lifted with its arrow, the Key, and the moves touching aisle A in a bottom drawer collapsed to the selected move.",
               EXTRA_DEFS + "\n".join(o), h=900)


# ================================================================== B: warehouse first
def make_b():
    o = [toolbar()]
    G, R = 72, 1368
    o.append(t(G, 124, "Locations", 40, INK, LB))
    o.append(t(G, 152, "Planning copy after round 1 · data as of 2026-09-30 · aisles in walk order A → I · click an aisle to open its wall", 14, INK2))
    seg, sw = segmented(0, 0, ["One aisle", "Whole warehouse"])
    o.append(rect(R - 36, 104, 36, 36, "#fff", 6, BORDER, 1) + icon("i-search", R - 27, 113, 18, INK))
    o.append(segmented(R - 36 - 12 - sw, 104, ["One aisle", "Whole warehouse"], sel=1)[0])

    # headline numbers
    sy = 188
    stats = [("79.2%", "occupied · 1,584 of 2,000 locations"), ("416", "empty locations"),
             ("174", "best locations · 7 of them empty"), ("19", "recommendations in round 1")]
    x = G
    for big, cap in stats:
        o.append(t(x, sy + 30, big, 38, INK, LB))
        o.append(t(x, sy + 54, cap, 13.5, INK2))
        x += max(tw(cap, 13.5), tw(big, 38, "lb")) + 48
    # selected move note (hover-note style, violet edge)
    nx, nw, nh = R - 330, 330, 82
    o.append(rect(nx, sy - 6, nw, nh, "#fff", 4, BORDER, 1))
    o.append(rect(nx, sy - 6, 5, nh, ACCENT))
    o.append(marker(nx + 28, sy + 15, "sel", "2", r=10, on_wall=False))
    o.append(t(nx + 46, sy + 20, "Move 2 · Rule 1 · cross-aisle", 13, INK2, "b w6"))
    o.append(t(nx + 18, sy + 44, "4410281", 16, INK, LB))
    o.append(t(nx + 82, sy + 44, "Brake pads, front - VW Golf", 14, INK, "b w6"))
    o.append(t(nx + 18, sy + 66, "G-14-04-02", 14, INK, LB))
    o.append(icon("i-arrow-r", nx + 94, sy + 54, 15, INK))
    o.append(t(nx + 116, sy + 66, "A-02-01-01", 14, INK, LB))
    o.append(rect(nx + 192, sy + 54, 34, 15, BEST_L, 2))
    o.append(t(nx + 209, sy + 65.5, "BEST", 10.5, "#fff", LB, "middle"))
    o.append(t(nx + nw - 14, sy + 66, "61 picks", 13, INK2, anchor="end"))

    # 3 x 3 aisle cards with mini walls
    gy, gap = 290, 18
    cw, ch = (R - G - 2 * gap) / 3, 168
    mw = cw - 28
    sec_p = (mw - 12 - 2) / 10
    geo = Geo(bw=(sec_p - 2 - 2.4 - 2.4) / 3, bh=8.5, gap=1.2, U=2, m=1.2, lvl_p=10.5, label_w=0, head_h=4, beam=1.3, mini=True)
    pos_all = {}
    for i, (L, (occ, n, mv)) in enumerate(AISLES.items()):
        col, row = i % 3, i // 3
        cx, cy = G + col * (cw + gap), gy + row * (ch + gap)
        hov = L == "G"
        o.append(rect(cx, cy, cw, ch, "#fff", 8, INK if hov else BORDER, 1.5 if hov else 1))
        o.append(rect(cx + 14, cy + 12, 30, 30, "#fff", 3, INK, 1.4))
        o.append(t(cx + 29, cy + 34, L, 19, INK, LB, "middle"))
        o.append(t(cx + 54, cy + 33, f"{100*occ/n:.1f}%", 20, INK, LB))
        o.append(t(cx + 112, cy + 32, f"{occ} of {n} · {n-occ} empty", 13, INK2))
        if hov:
            o.append(t(cx + cw - 14, cy + 32, "Open wall", 13.5, INK, "b w7", "end", ' text-decoration="underline"'))
        else:
            o.append(icon("i-lift", cx + cw - 14 - tw(f"{mv} moves", 13) - 22, cy + 18, 16, INK2))
            o.append(t(cx + cw - 14, cy + 32, f"{mv} moves" if mv > 1 else "1 move", 13, INK2, "b w5", "end"))
        data = aisle_generic(L)
        best = (1, 2) if L == "A" else ((1,) if L == "B" else ())
        singles = {(1, 4, 1), (1, 3, 1), (1, 3, 2)} if L == "A" else set()
        skip = {(14, 4, 2)} if L == "G" else ({(2, 1, 1)} if L == "A" else set())
        mx, my = cx + 14, cy + 52
        o.append(rect(mx, my, mw, 106, "url(#louvre2)", 4))
        r1, p1, _, H1 = run(mx + 6, my + 2, list(range(1, 11)), data, geo, best, singles, skip,
                            section_labels=False, level_labels=False, bg=False)
        r2, p2, _, _ = run(mx + 6, my + 2 + H1 + 2, list(range(11, 20)), data, geo, best, singles, skip,
                           section_labels=False, level_labels=False, bg=False)
        o += [r1, r2]
        pos_all[L] = {**p1, **p2}
    # selected cross-aisle move 2: G-14-04-02 -> A-02-01-01, the arc runs through the left margin
    bw, bh = geo.bw, geo.bh
    fx, fy = pos_all["G"][(14, 4, 2)]
    tx, ty = pos_all["A"][(2, 1, 1)]
    o.append(slot(tx, ty, bw, bh, True))
    o.append(cased_frame(tx, ty, bw, bh, 2, 2))
    o.append(rect(fx, fy, bw, bh, SLOT, 0.8) + rect(fx + 0.5, fy + 0.5, bw - 1, bh - 1, "none", 0.8, "#fff", 1, ' stroke-dasharray="2 1.5"'))
    LW, LH = bw * 1.9, bh * 2.0
    lx, ly = fx - 6, fy - LH - 2
    vx, rr = 40, 14
    y1, y2 = ly + LH / 2, ty + bh / 2
    d = (f"M{lx-3:.1f} {y1:.1f} H{vx+rr} Q{vx} {y1:.1f} {vx} {y1-rr:.1f} V{y2+rr:.1f} Q{vx} {y2:.1f} {vx+rr} {y2:.1f} H{tx-4:.1f}")
    o.append(arrow(d))
    o.append('<g filter="url(#lift)">' + bin_(lx, ly, LW, LH, "F") + "</g>")
    o.append(cased_frame(lx, ly, LW, LH, 2.5, 3))
    o.append(marker(lx + LW + 9, ly + 4, "sel", "2", r=8.5))
    o.append(marker(tx + bw + 9, ty - 6, "sel", "2", r=8.5))
    # key + zoom hint
    ky = gy + 3 * ch + 2 * gap + 24
    kr, kend = key_row(G, ky, hint=False, gap=18)
    o.append(kr)
    return svg("Smart Warehouse Planner — Locations, alternative B: Warehouse first",
               "Locations step opening on the whole warehouse: headline numbers, nine aisle cards in walk order each with its full bin wall at overview scale, the selected cross-aisle move drawn as one arc from aisle G to aisle A, and the Key.",
               EXTRA_DEFS + "\n".join(o), h=900)


# ================================================================== C: walk the aisle
def make_c():
    o = [toolbar()]
    G = 32
    W = 1376
    o.append(t(G, 104, "Locations", 14, INK2, "b w6"))
    o.append(t(G, 148, "Aisle A", 44, INK, LB))
    ax = G + 150
    o.append(rect(ax, 116, 36, 36, "#fff", 6, BORDER, 1) + icon("i-chev-l", ax + 9, 125, 18, "#B9BDC2"))
    o.append(rect(ax + 44, 116, 36, 36, "#fff", 6, BORDER, 1) + icon("i-chev-r", ax + 53, 125, 18, INK))
    o.append(btn(ax + 92, 116, 128, "All aisles", ic="i-chev-d"))
    o.append(t(ax + 240, 132, "86.8% occupied · 198 of 228 locations · 30 empty", 14, INK, "b w6"))
    o.append(t(ax + 240, 151, "117 best (3 empty) · next: Aisle B, 85.1%", 13.5, INK2))
    o.append(btn(1408 - 140, 116, 140, "Open as list", ic="i-list"))
    o.append(rect(1408 - 140 - 12 - 36, 116, 36, 36, "#fff", 6, BORDER, 1) + icon("i-search", 1408 - 140 - 12 - 27, 125, 18, INK))

    data = aisle_a()
    singles = {(1, 4, 1), (1, 3, 1), (1, 3, 2)}
    # whole-aisle scrubber (one continuous run of 19 sections)
    sy = 182
    o.append(t(G, sy + 4, "Whole aisle", 13, INK, "b w7"))
    o.append(t(G + 82, sy + 4, "Walk Path 0", 13, INK2))
    o.append(t(G + W, sy + 4, "2,270 · end of aisle A", 13, INK2, anchor="end"))
    msec = (W - 12 - 2.5) / 19
    mgeo = Geo(bw=(msec - 2.5 - 3 - 3) / 3, bh=8.5, gap=1.5, U=2.5, m=1.5, lvl_p=11.5, label_w=0, head_h=5, beam=1.5, mini=True)
    my = sy + 14
    o.append(rect(G, my, W, 56, "url(#louvre2)", 4))
    mr, mp, mW, _ = run(G + 6, my + 1, list(range(1, 20)), data, mgeo, (1, 2), singles, section_labels=False,
                        level_labels=False, bg=False)
    o.append(mr)
    # move ticks on the scrubber
    for q, kind, lab in (((1, 4, 1), "rec", "4"), ((2, 1, 1), "rec", "2"), ((5, 1, 3), "app", ""),
                         ((11, 2, 2), "man", ""), ((12, 4, 2), "sel", "1"), ((14, 2, 1), "sel", "1"), ((17, 1, 2), "rec", "3")):
        x, y = mp[q]
        o.append(marker(x + mgeo.bw / 2, my + 56 + 11, kind, lab, r=7.5, on_wall=False))
        o.append(f'<path d="M{x+mgeo.bw/2:.1f} {my+56:.1f} V{my+59.5:.1f}" stroke="{INK}" stroke-width="1"/>')
    # viewport window: sections 10-16 (+ part of 17)
    vx0 = mp[(10, 1, 1)][0] - mgeo.m - mgeo.U - 1
    vx1 = mp[(17, 1, 1)][0] + 10
    o.append(rect(vx0, my - 4, vx1 - vx0, 64, "none", 5, "#fff", 4.5))
    o.append(rect(vx0, my - 4, vx1 - vx0, 64, "none", 5, INK, 2))
    o.append(t((vx0 + vx1) / 2, sy + 4, "In view: sections 10–16", 13, INK, "b w6", "middle"))

    # the big run: sections 10-17, bins at landing-page scale (52 x 50, code visible)
    wy = 302
    geo = Geo(bw=52, bh=50, gap=4, U=6, m=6, lvl_p=74, label_w=64, head_h=34)
    secs = list(range(10, 18))
    overlay = {(12, 4, 2), (14, 2, 1), (16, 4, 3), (15, 1, 2), (17, 1, 2)}
    H = geo.head_h + 4 * geo.lvl_p + 8
    o.append(f'<clipPath id="wallclip"><rect x="{G}" y="{wy-40}" width="{W}" height="{H+60}" rx="8"/></clipPath>')
    o.append(rect(G, wy, W, H, "url(#louvre2)", 8))
    body, pos, _, _ = run(G, wy, secs, data, geo, (1, 2), singles, overlay, bg=False, sec_left=True)
    o.append(f'<g clip-path="url(#wallclip)">{body}')
    bw, bh = geo.bw, geo.bh
    x, y = pos[(17, 1, 2)]
    o.append(target(x, y, bw, bh))
    o.append(marker(x + bw + 2, y - 2, "rec", "3", r=10.5))
    x, y = pos[(11, 2, 2)]
    o.append(marker(x + bw + 2, y - 2, "man", r=10.5))
    o.append("</g>")
    # fades show the wall continues both ways
    o.append(rect(G + W - 70, wy, 70, H, "url(#fadeR)", 0))
    o.append(rect(G + W - 46, wy + H / 2 - 22, 36, 44, "#fff", 6, BORDER, 1) + icon("i-chev-r", G + W - 37, wy + H / 2 - 9, 18, INK))
    o.append(t(G + W - 28, wy + 22, "17 →", 13, ONDARK2, "lb w6", "middle"))

    # selected move 1: lifted from A-12-04-02 to A-14-02-01
    fx, fy = pos[(12, 4, 2)]
    txx, tyy = pos[(14, 2, 1)]
    o.append(target(txx, tyy, bw, bh, selected=True))
    svg1, b1 = lifted(fx, fy, bw, bh, "F", selected=True, dy=24)
    sx0, sy0 = b1[0] + b1[2] + 6, b1[1] + 22
    o.append(arrow(f"M{sx0:.1f} {sy0:.1f} C {sx0+170:.1f} {sy0-30:.1f}, {txx+bw/2+90:.1f} {tyy-150:.1f}, {txx+bw/2:.1f} {tyy-10:.1f}"))
    o.append(svg1)
    o.append(marker(b1[0] + b1[2] + 4, b1[1] + 2, "sel", "1", r=11))
    o.append(marker(txx + bw + 4, tyy - 4, "sel", "1", r=11))

    # drag in progress (FR-51): bin from A-16-04-03 held over occupied A-15-01-02
    dx_, dy_ = pos[(16, 4, 3)]
    o.append(left_behind(dx_, dy_, bw, bh))
    hx, hy = pos[(15, 1, 2)]
    o.append(bin_(hx, hy, bw, bh, "M"))
    o.append(cased_frame(hx, hy, bw, bh, 3, 4))
    # the dragged bin follows the pointer, a little above the location under it
    gx, gy = hx + 14, hy - 36
    o.append('<g filter="url(#lift)">' + bin_(gx, gy, bw * 1.2, bh * 1.2, "S") + "</g>")
    px, py = hx + bw * 0.62, hy + 10
    o.append(f'<path d="M{px} {py} l0 20 l5 -4.5 l4 8.5 l3.2 -1.5 l-4 -8.3 l6.6 -0.4 Z" fill="#fff" stroke="{INK}" stroke-width="1.3" stroke-linejoin="round"/>')
    # drop hint chip under the hovered location
    chip_w = tw("Swap or put together", 13) + 42
    cx_, cy_ = px + 20 + chip_w / 2, py + 14
    o.append(f'<g filter="url(#pop)">{rect(cx_ - chip_w/2, cy_, chip_w, 28, "#fff", 4)}</g>')
    o.append(icon("i-swap", cx_ - chip_w / 2 + 10, cy_ + 5, 18, INK))
    o.append(t(cx_ - chip_w / 2 + 34, cy_ + 19, "Swap or put together", 13, INK, "b w6"))

    # inline callout for the selected move, hung under the wall at its target
    cy = wy + H + 18
    cw, chh = 640, 184
    cxx = txx + bw / 2 - 240
    o.append(f'<path d="M{txx+bw/2:.1f} {wy+H-2:.1f} V{cy:.1f}" stroke="{ACCENT}" stroke-width="2"/>')
    o.append(rect(cxx, cy, cw, chh, "#fff", 4, BORDER, 1))
    o.append(rect(cxx, cy, 6, chh, ACCENT))
    o.append(marker(cxx + 34, cy + 28, "sel", "1", r=11, on_wall=False))
    o.append(t(cxx + 56, cy + 33, "Move 1 of 7 in aisle A · Rule 1 · round 1", 13.5, INK2, "b w6"))
    for i, (ic_, col) in enumerate((("i-chev-l", INK), ("i-chev-r", INK))):
        bx = cxx + cw - 92 + i * 42
        o.append(rect(bx, cy + 12, 34, 32, "#fff", 6, BORDER, 1) + icon(ic_, bx + 8, cy + 19, 18, col))
    o.append(t(cxx + 24, cy + 70, "8044172", 22, INK, LB))
    o.append(t(cxx + 112, cy + 70, "Oil filter - Toyota Corolla", 18, INK, "b w6"))
    o.append(t(cxx + 24, cy + 94, "Fast-moving: 33 picks in the period (24 or more)", 14, INK2))
    o.append(t(cxx + 24, cy + 118, "A-12-04-02", 16, INK, LB))
    o.append(t(cxx + 100, cy + 118, "not best", 13.5, INK2))
    o.append(icon("i-arrow-r", cxx + 162, cy + 104, 18, INK))
    o.append(t(cxx + 190, cy + 118, "A-14-02-01", 16, INK, LB))
    o.append(rect(cxx + 272, cy + 105, 36, 16, BEST_L, 2))
    o.append(t(cxx + 290, cy + 117, "BEST", 11, "#fff", LB, "middle"))
    o.append(t(cxx + 316, cy + 118, "level 2", 13.5, INK2))
    o.append(btn(cxx + 24, cy + 136, 96, "Apply", "primary", h=32))
    o.append(btn(cxx + 132, cy + 136, 164, "Other location", "tertiary", h=32, ic="i-chev-d"))
    o.append(t(cxx + 312, cy + 157, "Keep in place", 14, INK, "b w7", extra=' text-decoration="underline"'))
    o.append(t(cxx + cw - 20, cy + 157, "All 7 as a list", 14, INK, "b w7", "end", ' text-decoration="underline"'))
    # drag note (left of the callout)
    o.append(t(G, cy + 26, "Drag a bin to move it,", 13.5, INK2))
    o.append(t(G, cy + 44, "or drop it on another bin", 13.5, INK2))
    o.append(t(G, cy + 62, "to swap. Manual move…", 13.5, INK2))
    o.append(t(G, cy + 80, "does the same by keyboard.", 13.5, INK2))

    ky = 866
    o.append(key_row(G, ky, hint=False, hover="S")[0])
    return svg("Smart Warehouse Planner — Locations, alternative C: Walk the aisle",
               "Locations step showing aisle A as one continuous run at large bin size with a whole-aisle scrubber, the selected move lifted with an inline callout and a move stepper, a drag-to-swap in progress, and the Key.",
               EXTRA_DEFS + "\n".join(o), h=900)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else S
    os.makedirs(out, exist_ok=True)
    for name, fn in (("A-aisle-in-focus.svg", make_a), ("B-warehouse-first.svg", make_b), ("C-walk-the-aisle.svg", make_c)):
        open(os.path.join(out, name), "w").write(fn())
        print("wrote", name)
