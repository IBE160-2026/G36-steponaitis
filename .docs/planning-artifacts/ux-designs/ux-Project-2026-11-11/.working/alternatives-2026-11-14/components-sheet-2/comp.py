"""Shared real-size components for the three sheet-2 alternatives (Bin Wall style).

Reuses ../../landing-redesign/defs.svgfrag (fonts, class glyphs, UI icons, louvre patterns,
overlay shadow) and the helper style of gen_landing.py / gen_login.py. Synthetic data only.
Every component returns an SVG string; most also return their height.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DEFS = open(os.path.join(HERE, "..", "..", "landing-redesign", "defs.svgfrag")).read()

EXTRA_DEFS = """
<symbol id="i-swap" viewBox="0 0 20 20"><g class="ic"><path d="M3.5 7h12.5M12.5 3.5 16 7l-3.5 3.5"/><path d="M16.5 13H4M7.5 9.5 4 13l3.5 3.5"/></g></symbol>
<symbol id="i-merge" viewBox="0 0 20 20"><g class="ic"><path d="M5 2.5v2.5c0 2.2 5 2.3 5 5M15 2.5v2.5c0 2.2-5 2.3-5 5"/><path d="M7.6 8.2 10 10.6l2.4-2.4"/><rect x="4" y="12" width="12" height="5.5" rx="1"/></g></symbol>
<symbol id="i-chev-u" viewBox="0 0 20 20"><g class="ic"><path d="M5.5 12 10 7.5 14.5 12"/></g></symbol>
<symbol id="i-cursor" viewBox="0 0 20 20"><path d="M4 2.5v13.2l3.4-3.1 2.3 5.1 2.3-1-2.3-5h4.6z" fill="#fff" stroke="#1B1E22" stroke-width="1.3" stroke-linejoin="round"/></symbol>
<pattern id="dimhatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#EEEDE8"/><rect width="1.2" height="6" fill="#DEDCD5"/></pattern>
"""
DEFS = DEFS.replace("</defs>", EXTRA_DEFS + "</defs>")

INK, INK2, INK3, INK_DIS = "#1B1E22", "#4A5058", "#6B717A", "#8A9097"
GROUND, SURF, SURF_DIS, BORDER, HAIR, BAND = "#EEEDE8", "#FFFFFF", "#F3F2EE", "#D6D4CD", "#E6E4DE", "#E4E2DB"
ROWQ, SEL_T, INPUT_B = "#FAFAF7", "#F3EFFD", "#8A9097"
ONDARK, ONDARK2, ONDARK_NAV, ONDARK_M = "#E3E6E9", "#C9CED3", "#D5D9DD", "#9AA1A8"
ERR, ERR_T = "#D33A2C", "#FBE6E3"
BEST, BEST_L, ACCENT = "#3DAE6B", "#267A4B", "#9466F0"
SLOT, SLAT, SLINE = "#141719", "#3A4046", "#2C3136"
CLS = {"F": "#D85144", "M": "#F0B323", "S": "#417DDC", "D": "#8C939A"}
GLY = {"F": "g-fast", "M": "g-med", "S": "g-slow", "D": "g-dead"}
LBL = {"F": "FST", "M": "MED", "S": "SLW", "D": "DED"}
NAME = {"F": "fast", "M": "medium", "S": "slow", "D": "dead stock"}
LB = "lb w7"
FB = "b w4"

# ---------------------------------------------------------------- text width (rough, for layout checks)
_NARROW = set("iljtfrI.,:;'|!·")
_WIDE = set("mwMW—")


def tw(s, size, font="b4"):
    """Approximate rendered width. font: b4/b5/b6/b7 = Figtree weight, lb = Barlow Semi Condensed bold."""
    w = 0.0
    for ch in s:
        if font == "lb":
            if ch in _NARROW:
                e = 0.22
            elif ch in _WIDE:
                e = 0.72
            elif ch.isdigit():
                e = 0.42
            elif ch == " ":
                e = 0.20
            elif ch in "-–":
                e = 0.30
            elif ch.isupper():
                e = 0.55
            else:
                e = 0.45
        else:
            if ch in _NARROW:
                e = 0.25
            elif ch in _WIDE:
                e = 0.82
            elif ch.isdigit():
                e = 0.57
            elif ch == " ":
                e = 0.26
            elif ch == "…":
                e = 0.85
            elif ch in "–→“”":
                e = 0.6
            elif ch.isupper():
                e = 0.65
            else:
                e = 0.53
        w += e
    mult = {"b4": 1.0, "b5": 1.02, "b6": 1.05, "b7": 1.08, "lb": 1.0}[font]
    return w * size * mult


def wrap(s, size, font, maxw):
    words, lines, cur = s.split(" "), [], ""
    for wd in words:
        cand = (cur + " " + wd).strip()
        if cur and tw(cand, size, font) > maxw:
            lines.append(cur)
            cur = wd
        else:
            cur = cand
    if cur:
        lines.append(cur)
    return lines


# ---------------------------------------------------------------- primitives
def t(x, y, s, size, fill=INK, cls=FB, anchor=None, extra=""):
    a = f' text-anchor="{anchor}"' if anchor else ""
    return f'<text x="{x}" y="{y}" class="{cls}" font-size="{size}" fill="{fill}"{a}{extra}>{s}</text>'


def runs(x, y, parts, anchor=None, extra=""):
    """One <text> with tspans so the browser spaces the runs. parts: (s, size, fill, cls)."""
    a = f' text-anchor="{anchor}"' if anchor else ""
    sp = "".join(f'<tspan class="{c}" font-size="{sz}" fill="{f}">{s}</tspan>' for s, sz, f, c in parts)
    return f'<text x="{x}" y="{y}"{a}{extra}>{sp}</text>'


def rect(x, y, w, h, rx=0, fill="none", stroke=None, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{s}{extra}/>'


def line(x1, y1, x2, y2, c=HAIR, sw=1, extra=""):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{c}" stroke-width="{sw}" fill="none"{extra}/>'


def icon(i, x, y, size=18, c=INK):
    return f'<use href="#{i}" x="{x}" y="{y}" width="{size}" height="{size}" stroke="{c}" color="{c}"/>'


def overlay(x, y, w, h, rx=6, stroke=BORDER):
    """Overlay surface with the one ambient overlay shadow (menus, popovers, dialogs)."""
    return f'<g filter="url(#pop)">{rect(x, y, w, h, rx, SURF, stroke, 1)}</g>'


def focus_ring(x, y, w, h, rx=6):
    """Fixed paper focus ring: 2px white gap, then a 2px ink ring."""
    return (rect(x - 2, y - 2, w + 4, h + 4, rx + 2, "none", "#fff", 2) +
            rect(x - 4, y - 4, w + 8, h + 8, rx + 4, "none", INK, 2))


def swatch(x, y, c):
    """16 x 18 miniature bin (legend / table swatch) with its glyph."""
    return (rect(x, y, 16, 18, 2, CLS[c]) + rect(x, y, 16, 3.5, 1.5, "#000", extra=' fill-opacity="0.22"') +
            rect(x + 2.5, y + 6, 11, 9, 1, "#fff") +
            f'<use href="#{GLY[c]}" x="{x+4.5}" y="{y+6.5}" width="7" height="7" stroke="none"/>')


def bigbin(x, y, c, w=48, h=46):
    k = w / 60
    return (rect(x, y, w, h, round(3 * k, 1), CLS[c]) +
            rect(x, y, w, round(6 * k, 1), round(2 * k, 1), "#000", extra=' fill-opacity="0.22"') +
            rect(round(x + 5 * k, 1), round(y + h * 0.3, 1), round(w - 10 * k, 1), round(24 * k, 1), 1.5, "#fff") +
            f'<use href="#{GLY[c]}" x="{x+9*k:.1f}" y="{y+h*0.3+7*k:.1f}" width="{10*k:.1f}" height="{10*k:.1f}"/>' +
            t(f"{x+22*k:.1f}", f"{y+h*0.3+16.5*k:.1f}", LBL[c], f"{12.5*k:.1f}", INK, LB))


def chip(x, y, code, h=24, size=13.5, best=False):
    """Location chip: white, 1px ink, radius 2, code in Barlow. Returns (svg, width)."""
    w = round(tw(code, size, "lb") + 20)
    o = rect(x, y, w, h, 2, SURF, INK, 1) + t(x + w / 2, y + h / 2 + size * 0.36, code, size, INK, LB, "middle")
    return o, w


def best_tag(x, y, on_light=True):
    fill, fg = (BEST_L, "#fff") if on_light else (BEST, INK)
    return rect(x, y, 36, 15, 2, fill) + t(x + 18, y + 11.3, "BEST", 11, fg, LB, "middle")


def pill(x, y, n):
    w = 22 if len(str(n)) < 2 else 28
    return rect(x, y, w, 18, 9, SURF, BORDER, 1) + t(x + w / 2, y + 13, n, 11.5, INK, LB, "middle")


def button(x, y, w, label, kind="secondary", ic=None, h=36, size=13, focus=False):
    """kind: primary | secondary | tertiary | disabled. Label centred with optional 16px icon."""
    if kind == "primary":
        o, fg = rect(x, y, w, h, 6, INK), "#fff"
    elif kind == "secondary":
        o, fg = rect(x, y, w, h, 6, SURF, INK, 1), INK
    elif kind == "tertiary":
        o, fg = rect(x, y, w, h, 6, SURF, BORDER, 1), INK
    else:
        o, fg = rect(x, y, w, h, 6, SURF_DIS, BORDER, 1), INK_DIS
    if focus:
        o = focus_ring(x, y, w, h) + o
    lw = tw(label, size, "b6")
    if ic:
        tot = 16 + 7 + lw
        sx = x + (w - tot) / 2
        o += icon(ic, round(sx, 1), y + h / 2 - 8, 16, fg)
        o += t(round(sx + 23, 1), y + h / 2 + size * 0.36, label, size, fg, "b w6")
    else:
        o += t(x + w / 2, y + h / 2 + size * 0.36, label, size, fg, "b w6", "middle")
    return o


def link(x, y, s, size=13, anchor=None):
    return t(x, y, s, size, INK, "b w6", anchor, ' text-decoration="underline"')


def radio(x, y, on):
    o = f'<circle cx="{x+8}" cy="{y+8}" r="7.5" fill="#fff" stroke="{INK}" stroke-width="1.5"/>'
    if on:
        o += f'<circle cx="{x+8}" cy="{y+8}" r="4" fill="{INK}"/>'
    return o


def checkbox(x, y, on):
    if on:
        return rect(x, y, 16, 16, 3, INK) + icon("i-check", x + 1, y + 1, 14, "#fff")
    return rect(x + .75, y + .75, 14.5, 14.5, 3, "#fff", INK, 1.5)


def switch(x, y, on):
    if on:
        return rect(x, y, 36, 20, 10, INK) + f'<circle cx="{x+26}" cy="{y+10}" r="7" fill="#fff"/>'
    return rect(x + .5, y + .5, 35, 19, 9.5, "#fff", INPUT_B, 1) + f'<circle cx="{x+10}" cy="{y+10}" r="6.5" fill="{INPUT_B}"/>'


def caret(x, y, h=18):
    return rect(x, y, 1.5, h, 0, INK)


def toast(x, y, w, ic, text, action=None):
    o = f'<g filter="url(#pop)">{rect(x, y, w, 44, 6, INK)}</g>'
    o += icon(ic, x + 14, y + 13, 18, ONDARK)
    o += t(x + 42, y + 27, text, 13, "#fff", "b w5")
    if action:
        o += t(x + w - 16, y + 27, action, 13, "#fff", "b w6", "end", ' text-decoration="underline"')
    return o


def pin(x, y, n, r=11):
    """Anatomy pin: ink disc with a white number."""
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{INK}"/>' +
            t(x, y + 4.5, n, 12.5, "#fff", LB, "middle"))


def step_disc(x, y, n, r=14):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{INK}"/>' + t(x, y + 5, n, 14, "#fff", LB, "middle")


def logo(x, y):
    lip = rect(x, y, 30, 3.5, 1.5, "#000", extra=' fill-opacity="0.22"')
    return ("<g>" + rect(x, y, 30, 30, 2, "#F0B323") + lip + rect(x + 3, y + 9, 24, 13, 1, "#fff") +
            f'<use href="#g-med" x="{x+10.5}" y="{y+11}" width="9" height="9"/></g>')


# ---------------------------------------------------------------- wall (real size: bin 27 x 29, pitch 30, level 40)
def wbin(x, y, c):
    return (rect(x, y, 27, 29, 2, CLS[c]) + rect(x, y, 27, 3.5, 1.5, "#000", extra=' fill-opacity="0.22"') +
            rect(x, y + 27.5, 27, 1.5, 0, "#000", extra=' fill-opacity="0.18"') +
            rect(x + 3, y + 9, 21, 13, 1, "#fff") +
            f'<use href="#{GLY[c]}" x="{x+9}" y="{y+11}" width="9" height="9"/>')


def wslot(x, y):
    return (rect(x, y, 27, 29, 2, SLOT) + rect(x + 7, y + 3, 13, 2.6, 1.3, SLAT) +
            line(x + 3, y + 26, x + 24, y + 26, SLINE, 1))


def wlifted(x, y, c, selected=True):
    """33 x 34 lifted bin with lift shadow; violet cased frame when selected."""
    o = '<g filter="url(#lift)">' + rect(x, y, 33, 34, 2, CLS[c]) + '</g>'
    o += rect(x, y, 33, 4, 1.5, "#000", extra=' fill-opacity="0.22"')
    o += rect(x + 4, y + 11, 25, 15, 1, "#fff")
    o += f'<use href="#{GLY[c]}" x="{x+11}" y="{y+13.5}" width="11" height="11"/>'
    if selected:
        o += rect(x - 3, y - 3, 39, 40, 5, "none", SLOT, 5) + rect(x - 3, y - 3, 39, 40, 5, "none", ACCENT, 2)
    return o


def wall(x, y, sections, grid, best_levels=(1, 2), per=4, aisle="G"):
    """grid rows from top level down; cells F M S D or '.' (empty) or 'v' (vacated by a lift).
    Returns (svg, w, h, cellxy) where cellxy(level, section_index, position_index) -> (x, y)."""
    levels = len(grid)
    lab, head, sec_w = 34, 24, per * 30 + 14
    W = lab + len(sections) * sec_w + 10
    H = head + levels * 40 + 8
    o = [rect(x, y, W, H, 6, "url(#louvre2)", "#1A1D20", 1)]

    def cxy(level, si, pi):
        li = levels - level
        return x + lab + si * sec_w + 9 + pi * 30, y + head + li * 40 + 3

    for si, name in enumerate(sections):
        sx = x + lab + si * sec_w
        o.append(t(sx + sec_w / 2 + 2, y + 16, name, 12, ONDARK2, "lb w6", "middle"))
        o.append(rect(sx, y + head - 2, 5, levels * 40 + 2, 0, "#454B52"))
    o.append(rect(x + lab + len(sections) * sec_w, y + head - 2, 5, levels * 40 + 2, 0, "#454B52"))
    for li, row in enumerate(grid):
        level = levels - li
        ly = y + head + li * 40
        best = level in best_levels
        if best:
            o.append(t(x + 10, ly + 15, f"L{level}", 13, ONDARK, LB))
            o.append(rect(x + 4, ly + 20, 27, 12, 2, BEST) + t(x + 17.5, ly + 29.5, "BEST", 9, INK, LB, "middle"))
        else:
            o.append(t(x + 10, ly + 21, f"L{level}", 13, ONDARK, LB))
        o.append(rect(x + lab, ly + 34, len(sections) * sec_w + 5, 4, 0, BEST if best else "#1F2326"))
        cells = row.replace(" ", "")
        for ci, c in enumerate(cells):
            si, pi = divmod(ci, per)
            bx, by = cxy(level, si, pi)
            if c == ".":
                o.append(wslot(bx, by))
            elif c == "v":
                o.append(wslot(bx, by))
                o.append(rect(bx - 1, by - 1, 29, 31, 3, "none", "#fff", 1.4, ' stroke-dasharray="2 2"'))
            else:
                o.append(wbin(bx, by, c))
    if best_levels:
        # BEST tag for the lowest best level, at the label column
        pass
    return "".join(o), W, H, cxy


def drop_target(x, y, occupied=True):
    """Selected move-target framing for the location under the pointer: cased violet frame + plus/swap chip."""
    o = rect(x - 3, y - 3, 33, 35, 3.5, "rgba(255,255,255,0.16)", SLOT, 5)
    o += rect(x - 3, y - 3, 33, 35, 3.5, "none", ACCENT, 2.2)
    if occupied:
        o += f'<circle cx="{x+27}" cy="{y-2}" r="9" fill="#fff" stroke="{SLOT}" stroke-width="1.5"/>'
        o += icon("i-swap", x + 20.5, y - 8.5, 13, INK)
    else:
        o += icon("i-plus", x + 7, y + 8, 13, "#fff")
    return o


# ---------------------------------------------------------------- part panel
PARTNERS = [
    ("F", "4410297", "Brake disc, front – VW Golf", "14 shared jobs · aisle A · apart"),
    ("M", "7181839", "Brake fluid DOT 4, 1 l", "7 shared jobs · aisle D · apart"),
    ("S", "4410305", "Wear sensor, brake pads – VW Golf", "5 shared jobs · aisle G · together"),
]


def part_panel(x, y, w=400, docked=False, kept=False, no_loc=False, rows=None):
    """Side panel, 400 wide. Returns (svg, h, anchors) - anchors: y of each anatomy feature."""
    P = 24
    H = 640
    o = []
    if docked:
        o.append(rect(x, y, w, H, 0, SURF))
        o.append(line(x + .5, y, x + .5, y + H, BORDER, 1))
    else:
        o.append(rect(x, y, w, H, 8, SURF, BORDER, 1))
    A = {}
    # header
    o.append(t(x + P, y + 46, "4410281", 22, INK, LB)); A["title"] = y + 38
    o.append(rect(x + w - P - 28, y + 22, 28, 28, 6, SURF, BORDER, 1))
    o.append(icon("i-x", x + w - P - 22, y + 28, 16, INK))
    o.append(t(x + P, y + 68, "Brake pads, front – VW Golf", 14, INK))
    # class block
    o.append(bigbin(x + P, y + 88, "F", 48, 46)); A["class"] = y + 111
    o.append(t(x + P + 64, y + 106, "Fast-moving", 14, INK, "b w6"))
    o.append(runs(x + P + 64, y + 125, [("61 picks", 12.5, INK, "b w6"), (" in the period · 24 or more is fast", 12.5, INK2, FB)]))
    o.append(t(x + P, y + 160, "Period 2025-10-01 – 2026-09-30 · data as of 2026-09-30", 11.5, INK3, "b w5"))
    o.append(line(x + P, y + 176, x + w - P, y + 176))
    # locations
    o.append(t(x + P, y + 203, "Locations and stock", 16, INK, LB))
    o.append(runs(x + w - P, y + 203, [("Total stock ", 12, INK2, FB), ("0" if no_loc else "16", 15, INK, LB)], "end"))
    A["locations"] = y + 236
    if no_loc:
        o.append(rect(x + P, y + 218, w - 2 * P, 52, 6, SURF_DIS))
        o.append(t(x + P + 14, y + 240, "No current location", 13, INK, "b w6"))
        o.append(t(x + P + 14, y + 258, "No stock above zero in any location.", 12, INK2))
        ly = y + 286
    else:
        for i, (code, lvl, cur, stock) in enumerate((("G-14-04-02", "level 4 · aisle G", True, "12"),
                                                     ("C-03-02-01", "level 2 · aisle C", False, "4"))):
            ry = y + 220 + i * 36
            c, cw = chip(x + P, ry, code)
            o.append(c)
            o.append(t(x + P + cw + 12, ry + 16.5, lvl, 12.5, INK2))
            if cur:
                o.append(t(x + P + cw + 112, ry + 16.5, "current", 11.5, INK, "b w6"))
            o.append(t(x + w - P, ry + 17.5, stock, 15, INK, LB, "end"))
            if i == 0:
                o.append(line(x + P, ry + 30, x + w - P, ry + 30))
        ly = y + 300
    o.append(line(x + P, ly - 8, x + w - P, ly - 8))
    # pick groups
    o.append(t(x + P, ly + 20, "Pick groups", 16, INK, LB))
    o.append(pill(x + P + 86, ly + 6, "3"))
    o.append(t(x + P, ly + 40, "Partners share 5 or more jobs with 4410281 in the period.", 12, INK2))
    A["groups"] = ly + 16
    for i, (c, pn, desc, meta) in enumerate(PARTNERS):
        ry = ly + 56 + i * 44
        o.append(swatch(x + P, ry + 2, c))
        o.append(runs(x + P + 28, ry + 14, [(pn, 13.5, INK, LB), ("  " + desc, 12.5, INK, FB)]))
        o.append(t(x + P + 28, ry + 31, meta, 11.5, INK2, "b w5"))
        o.append(icon("i-chev-r", x + w - P - 16, ry + 6, 16, INK3))
        if i == 0:
            A["partner"] = ry + 14
    ky = ly + 56 + 3 * 44 + 6
    o.append(line(x + P, ky, x + w - P, ky))
    # keep in place
    o.append(switch(x + P, ky + 18, kept)); A["keep"] = ky + 28
    o.append(t(x + P + 50, ky + 33, "Keep in place", 14, INK, "b w6"))
    if kept:
        o.append(icon("i-pin", x + P + 160, ky + 20, 16, INK))
        o.append(t(x + P + 180, ky + 33, "kept in place", 12.5, INK, "b w6"))
        o.append(t(x + P + 50, ky + 52, "No recommendation in later runs. Remove the mark", 12, INK2))
        o.append(t(x + P + 50, ky + 68, "here or in the Kept in place tab.", 12, INK2))
    else:
        o.append(t(x + P + 50, ky + 52, "Later runs and Apply all leave this part alone.", 12, INK2))
        o.append(t(x + P + 50, ky + 68, "A manual move is still possible.", 12, INK2))
    fy = ky + 88
    o.append(line(x + P, fy, x + w - P, fy))
    A["footer"] = fy + 34
    if no_loc:
        o.append(button(x + P, fy + 16, 148, "Manual move…", "disabled", "i-lift"))
        o.append(t(x + P + 160, fy + 30, "Disabled: this part has", 11.5, INK2, "b w5"))
        o.append(t(x + P + 160, fy + 45, "no current location.", 11.5, INK2, "b w5"))
    else:
        o.append(button(x + P, fy + 16, 148, "Manual move…", "secondary", "i-lift"))
        o.append(link(x + P + 166, fy + 38, "Show on the wall"))
    H2 = fy + 68 - y
    if H2 != H:
        o[0] = (rect(x, y, w, H2, 0, SURF) if docked else rect(x, y, w, H2, 8, SURF, BORDER, 1))
        if docked:
            o[1] = line(x + .5, y, x + .5, y + H2, BORDER, 1)
    return "".join(o), H2, A


# ---------------------------------------------------------------- manual move
TO_STATES = {
    # value, border, focus, feedback (icon, colour, text lines), confirm label, confirm kind, strip
    "empty": ("", "n", True, None, "Make manual move", "disabled", None),
    "typing": ("A-02-0", "n", True, None, "Make manual move", "disabled", None),
    "valid": ("A-02-01-01", "n", True, ("i-check", INK, ["Empty · best location · level 1, aisle A"]),
              "Make manual move", "primary", ("G-14-04-02", "A-02-01-01")),
    "from": ("G-14-04-02", "e", True, ("i-alert", ERR, ["This is the from-location. Choose another."]),
             "Make manual move", "disabled", None),
    "virtual": ("FLSKRS", "e", True, ("i-alert", ERR, ["FLSKRS is a virtual location, not a shelf."]),
                "Make manual move", "disabled", None),
    "adds": ("A-05-02-01", "n", True, ("i-info", INK2, ["Already holds 4410281: stock is added together."]),
             "Make manual move", "primary", ("G-14-04-02", "A-05-02-01")),
    "back": ("G-14-04-02", "n", True, ("i-undo", INK, ["This undoes move 4: 4410281 returns to G-14-04-02 and the move is removed."]),
             "Remove move", "primary", None),
}


def to_field(x, y, w, state, label=True, autocomplete=True, focus=None):
    """Label + to-location field + feedback. Returns (svg, h)."""
    val, border, f0, fb, _, _, _ = TO_STATES[state]
    focus = f0 if focus is None else focus
    o = []
    yy = y
    if label:
        o.append(t(x, y + 13, "To-location", 13.5, INK, "b w6"))
        yy = y + 22
    if focus:
        o.append(focus_ring(x, yy, w, 36))
    if border == "e":
        o.append(rect(x, yy, w, 36, 6, SURF, ERR, 1.5))
    else:
        o.append(rect(x, yy, w, 36, 6, SURF, INPUT_B, 1))
    if val:
        o.append(t(x + 12, yy + 23.5, val, 14.5, INK, LB))
        o.append(caret(x + 12 + tw(val, 14.5, "lb") + 4, yy + 9))
    else:
        o.append(caret(x + 12, yy + 9))
        o.append(t(x + 18, yy + 23, "Type a location code", 13, INK3))
    h = yy + 36 - y
    if fb:
        ic, col, lines = fb
        lines = [l2 for l1 in lines for l2 in wrap(l1, 12.5, "b5", w - 24)]
        o.append(icon(ic, x, yy + 46, 16, col))
        for i, s in enumerate(lines):
            o.append(t(x + 24, yy + 59 + i * 17, s, 12.5, INK, "b w5"))
        h = yy + 50 + 17 * len(lines) - y
    if state == "typing" and autocomplete:
        ly = yy + 42
        rows = [("A-02-01-01", "Empty · level 1", True, True),
                ("A-02-01-02", "Occupied · 1 part · level 1", True, False),
                ("A-02-02-01", "Empty · level 2", False, False),
                ("A-02-03-04", "Empty · level 3", False, False)]
        lw = w
        o.append(overlay(x, ly, lw, 8 + 28 * len(rows) + 30))
        for i, (code, meta, best, hl) in enumerate(rows):
            ry = ly + 4 + i * 28
            if hl:
                o.append(rect(x + 1, ry, lw - 2, 28, 0, SEL_T) + rect(x + 1, ry, 3, 28, 0, INK))
            # highlight the typed prefix
            o.append(runs(x + 14, ry + 18.5, [("A-02-0", 13.5, INK, LB), (code[6:], 13.5, INK2, "lb w6")]))
            o.append(t(x + 96, ry + 18.5, meta, 12, INK2))
            if best:
                o.append(best_tag(x + lw - 50, ry + 6.5))
        fy = ly + 4 + 28 * len(rows)
        o.append(line(x + 1, fy + 2, x + lw - 1, fy + 2))
        o.append(t(x + 14, fy + 21, "Arrow keys choose · Enter fills the field", 11.5, INK3, "b w5"))
        h = max(h, fy + 30 - y)
    return "".join(o), h


def mm_dialog(x, y, state="valid", w=440, shadow=True):
    """Manual move dialog. Returns (svg, h, anchors)."""
    P = 24
    val, border, focus, fb, clabel, ckind, strip = TO_STATES[state]
    A = {}
    body = []
    body.append(t(x + P, y + 42, "Manual move", 20, INK, LB)); A["title"] = y + 35
    body.append(rect(x + w - P - 28, y + 20, 28, 28, 6, SURF, BORDER, 1) + icon("i-x", x + w - P - 22, y + 26, 16, INK))
    body.append(swatch(x + P, y + 58, "F"))
    body.append(runs(x + P + 26, y + 72, [("4410281", 14, INK, LB), ("  Brake pads, front – VW Golf", 13, INK, FB)]))
    # from
    body.append(t(x + P, y + 108, "From-location", 13.5, INK, "b w6")); A["from"] = y + 130
    for i, (code, meta, on) in enumerate((("G-14-04-02", "stock 12 · current location", True),
                                          ("C-03-02-01", "stock 4", False))):
        ry = y + 118 + i * 28
        body.append(radio(x + P, ry + 3, on))
        body.append(runs(x + P + 26, ry + 16, [(code, 13.5, INK, LB), ("  " + meta, 12.5, INK2, FB)]))
    # to
    fy = y + 184
    f, fh = to_field(x + P, fy, w - 2 * P, state, autocomplete=False); A["to"] = fy + 40
    body.append(f)
    sy = fy + max(fh, 58) + 16
    # move strip: the move that will be made
    body.append(rect(x + P, sy, w - 2 * P, 52, 6, SURF_DIS)); A["strip"] = sy + 26
    if strip:
        fx = x + P + 14
        c1, w1 = chip(fx, sy + 8, strip[0], 22, 13)
        body.append(c1)
        body.append(icon("i-arrow-r", fx + w1 + 6, sy + 11, 16, INK))
        c2, w2 = chip(fx + w1 + 28, sy + 8, strip[1], 22, 13)
        body.append(c2)
        body.append(t(fx + w1 + w2 + 40, sy + 24, "Manual · round 1", 12, INK, "b w6"))
        body.append(t(fx, sy + 44, "All 12 at G-14-04-02 move; stock is never split.", 11.5, INK2, "b w5"))
    elif state == "back":
        body.append(t(x + P + 14, sy + 22, "Move 4 is removed, not reversed by a new move.", 12, INK, "b w6"))
        body.append(t(x + P + 14, sy + 40, "The round stays round 1.", 11.5, INK2, "b w5"))
    else:
        body.append(t(x + P + 14, sy + 22, "The move gets rule Manual and round 1.", 12, INK2, "b w5"))
        body.append(t(x + P + 14, sy + 40, "All stock at the from-location moves; it is never split.", 11.5, INK3, "b w5"))
    by = sy + 52 + 20
    cw = round(tw(clabel, 13, "b6") + 36)
    body.append(button(x + w - P - cw, by, cw, clabel, ckind)); A["buttons"] = by + 18
    body.append(button(x + w - P - cw - 8 - 84, by, 84, "Cancel", "tertiary"))
    H = by + 36 + P - y
    frame = (f'<g filter="url(#pop)">{rect(x, y, w, H, 8, SURF)}</g>' if shadow else rect(x, y, w, H, 8, SURF, BORDER, 1))
    return frame + "".join(body), H, A


# ---------------------------------------------------------------- recommendation row + other location
REC_DEFAULT = ("1", "4410281", "Brake pads, front", "G-14-04-02", "G-14-01-04", True)


def rec_row(x, y, w=760, open_=True, applied=False, plain=False, data=None):
    """Recommendation row. Selected by default; plain = unselected; applied = done."""
    n, part, desc, frm, to, best = data or REC_DEFAULT
    if applied and data is None:
        to = "A-07-01-01"
    o = []
    if applied or plain:
        o.append(rect(x, y, w, 58, 0, SURF) + line(x, y + 57.5, x + w, y + 57.5))
    else:
        o.append(rect(x, y, w, 58, 0, SEL_T) + rect(x + .75, y + .75, w - 1.5, 56.5, 0, "none", INK, 1.5) +
                 rect(x, y, 5, 58, 0, ACCENT))
    # marker
    if applied:
        o.append(f'<circle cx="{x+28}" cy="{y+29}" r="8.5" fill="{INK}"/>' + icon("i-check", x + 21, y + 22, 14, "#fff"))
    elif plain:
        o.append(f'<circle cx="{x+28}" cy="{y+29}" r="8.5" fill="#fff" stroke="{INK}" stroke-width="1.2"/>' +
                 t(x + 28, y + 33, n, 11.5, INK, LB, "middle"))
    else:
        o.append(f'<circle cx="{x+28}" cy="{y+29}" r="8.5" fill="#fff" stroke="{ACCENT}" stroke-width="2"/>' +
                 t(x + 28, y + 33, n, 11.5, INK, LB, "middle"))
    o.append(t(x + 48, y + 26, part, 14, INK, LB))
    o.append(t(x + 48, y + 43, desc, 12, INK2))
    c1, w1 = chip(x + 168, y + 17, frm)
    o.append(c1)
    o.append(icon("i-arrow-r", x + 168 + w1 + 6, y + 21, 16, INK))
    c2, w2 = chip(x + 168 + w1 + 28, y + 17, to)
    o.append(c2)
    if best:
        o.append(best_tag(x + 168 + w1 + w2 + 36, y + 21.5))
    rx = x + w - 16
    if applied:
        o.append(icon("i-check", rx - 196, y + 20, 18, INK))
        o.append(runs(rx - 174, y + 34, [("Applied", 13, INK, "b w6"), (" · move 3, round 1", 13, INK2, FB)]))
    else:
        o.append(link(rx, y + 33, "Keep in place", 12.5, "end"))
        ow = 128
        bx = rx - 92 - 12 - ow
        o.append(rect(bx, y + 15, ow, 28, 6, SURF, INK if open_ else BORDER, 1))
        o.append(t(bx + 12, y + 33.5, "Other location", 13, INK, "b w6"))
        o.append(icon("i-chev-u" if open_ else "i-chev-d", bx + ow - 24, y + 21, 16, INK))
        o.append(button(bx - 8 - 68, y + 15, 68, "Apply", "secondary" if plain else "primary", h=28))
    return "".join(o), (rx - 92 - 12 - 128)


OTHER = [("A-04-01-03", "level 1 · aisle A"), ("A-07-01-01", "level 1 · aisle A"),
         ("A-11-01-02", "level 1 · aisle A"), ("B-02-01-01", "level 1 · aisle B"),
         ("D-06-01-03", "level 1 · aisle D"), ("G-14-01-02", "level 1 · aisle G")]


def other_list(x, y, w=304, state="open", hl=1):
    """Listbox for Other location. state: open | filtered | empty. Returns (svg, h)."""
    o = []
    if state == "empty":
        H = 92
        o.append(overlay(x, y, w, H))
        o.append(t(x + 16, y + 30, "No other location fits rule 1 right now.", 13, INK, "b w6"))
        o.append(t(x + 16, y + 52, "Any other placement is a Manual move…", 12, INK2))
        o.append(t(x + 16, y + 70, "from the part panel.", 12, INK2))
        return "".join(o), H
    rows = OTHER if state == "open" else [r for r in OTHER if r[0].startswith("A-0")]
    H = 48 + 30 + 28 * len(rows) + 50
    o.append(overlay(x, y, w, H))
    # filter field
    fx, fy = x + 10, y + 10
    o.append(rect(fx, fy, w - 20, 30, 6, SURF, INPUT_B, 1))
    o.append(icon("i-search", fx + 9, fy + 7, 16, INK2))
    if state == "filtered":
        o.append(t(fx + 32, fy + 20, "A-0", 14, INK, LB) + caret(fx + 32 + tw("A-0", 14, "lb") + 2, fy + 7, 16))
    else:
        o.append(caret(fx + 32, fy + 7, 16) + t(fx + 38, fy + 20, "Type to filter", 12.5, INK3))
    o.append(t(x + 14, y + 64, "Empty best locations that fit rule 1", 11.5, INK2, "b w6"))
    for i, (code, meta) in enumerate(rows):
        ry = y + 74 + i * 28
        if i == hl:
            o.append(rect(x + 1, ry, w - 2, 28, 0, SEL_T) + rect(x + 1, ry, 3, 28, 0, INK))
        o.append(t(x + 14, ry + 18.5, code, 13.5, INK, LB))
        o.append(t(x + 104, ry + 18.5, meta, 12, INK2))
        o.append(best_tag(x + w - 50, ry + 6.5))
    fy2 = y + 74 + 28 * len(rows) + 6
    o.append(line(x + 1, fy2, x + w - 1, fy2))
    o.append(t(x + 14, fy2 + 19, "Enter or a click applies it: rule 1, round 1.", 11.5, INK2, "b w5"))
    o.append(t(x + 14, fy2 + 36, "Browsing applies nothing.", 11.5, INK2, "b w5"))
    return "".join(o), H


# ---------------------------------------------------------------- drop chooser (FR-51)
def drop_popover(x, y, variant="swap", w=344, pointer=("left", 40)):
    """variant: swap | several | warning | none. Returns (svg, h)."""
    P = 18
    rows = []
    o_body = []
    yy = y + P + 14
    o_body.append(t(x + P, yy, "G-14-01-03 is occupied", 15, INK, "b w7"))
    yy += 22
    o_body.append(t(x + P, yy, "You dropped 4410281 here. What should happen?", 12.5, INK2))
    yy += 18
    # the two parts
    def partrow(yy, c, pn, desc, meta, check=None):
        r = []
        cx = x + P
        if check is not None:
            r.append(checkbox(cx, yy + 4, check))
            cx += 26
        r.append(swatch(cx, yy + 3, c))
        r.append(runs(cx + 26, yy + 15, [(pn, 13.5, INK, LB), ("  " + desc, 12.5, INK, FB)]))
        r.append(t(cx + 26, yy + 31, meta, 11.5, INK2, "b w5"))
        return "".join(r)
    o_body.append(t(x + P, yy + 14, "MOVING", 11, INK3, LB, extra=' letter-spacing="1"'))
    yy += 22
    o_body.append(partrow(yy, "F", "4410281", "Brake pads, front", "fast · stock 12 · from G-14-04-02"))
    yy += 44
    if variant == "several":
        o_body.append(t(x + P, yy + 14, "MOVE BACK TO G-14-04-02 (SWAP ONLY)", 11, INK3, LB, extra=' letter-spacing="1"'))
        yy += 22
        o_body.append(partrow(yy, "S", "6630417", "Wiper blades – Octavia", "slow · stock 8", True))
        yy += 40
        o_body.append(partrow(yy, "D", "3301877", "Gasket set – Golf", "dead stock · stock 2", True))
        yy += 44
    else:
        o_body.append(t(x + P, yy + 14, "ALREADY HERE", 11, INK3, LB, extra=' letter-spacing="1"'))
        yy += 22
        meta = "slow · stock 8 · kept in place" if variant == "warning" else "slow · stock 8"
        o_body.append(partrow(yy, "S", "6630417", "Wiper blades – Octavia", meta))
        yy += 44
    if variant == "warning":
        o_body.append(icon("i-alert", x + P, yy + 2, 16, INK))
        o_body.append(t(x + P + 24, yy + 15, "6630417 is kept in place. Swap anyway?", 12.5, INK, "b w6"))
        yy += 28
    # outcome lines
    o_body.append(line(x + P, yy, x + w - P, yy))
    yy += 8
    outcomes = [("i-swap", "Swap", "6630417 goes to G-14-04-02."),
                ("i-merge", "Put together", "Both parts share G-14-01-03.")]
    for ic, nm, s in outcomes:
        o_body.append(icon(ic, x + P, yy + 5, 16, INK2))
        o_body.append(runs(x + P + 24, yy + 18, [(nm + ": ", 12, INK, "b w6"), (s, 12, INK2, FB)]))
        yy += 22
    yy += 10
    bh = 32
    if variant == "none":
        o_body.append(button(x + P, yy, 82, "Swap", "disabled", "i-swap", h=bh))
        o_body.append(button(x + P + 90, yy, 124, "Put together", "secondary", "i-merge", h=bh))
    else:
        o_body.append(button(x + P, yy, 82, "Swap", "secondary", "i-swap", h=bh))
        o_body.append(button(x + P + 90, yy, 124, "Put together", "secondary", "i-merge", h=bh))
    o_body.append(button(x + w - P - 72, yy, 72, "Cancel", "tertiary", h=bh))
    yy += bh
    if variant == "none":
        yy += 8
        o_body.append(t(x + P, yy + 12, "Swap: choose at least one part to move back.", 11.5, INK2, "b w5"))
        yy += 18
    H = yy + P - y
    side, py = pointer
    if side == "left":
        ptr = f'<path d="M{x+1} {y+py-9} L{x-9} {y+py} L{x+1} {y+py+9}Z" fill="#fff" stroke="{BORDER}" stroke-width="1"/>' + \
              rect(x, y + py - 10, 2, 20, 0, "#fff")
    elif side == "top":
        ptr = f'<path d="M{x+py-9} {y+1} L{x+py} {y-9} L{x+py+9} {y+1}Z" fill="#fff" stroke="{BORDER}" stroke-width="1"/>' + \
              rect(x + py - 10, y, 20, 2, 0, "#fff")
    else:
        ptr = ""
    frame = f'<g filter="url(#pop)">{rect(x, y, w, H, 6, SURF, BORDER, 1)}</g>' + ptr
    return frame + "".join(o_body), H


# ---------------------------------------------------------------- saved plans
PLANS = [
    ("Spring re-slot 2026", "round 1 · 18 moves", "2026-09-30", "2026-10-02", "2026-11-02 · justas", "Today 09:42 · kari"),
    ("Autumn re-slot", "round 2 · 24 moves", "2026-09-30", "2026-10-02", "2026-11-11 · kari", "Yesterday 16:05 · justas"),
    ("Aisle A trial", "round 0 · no moves", "2026-09-30", "2026-10-02", "2026-11-05 · justas", "2026-11-05 13:02 · justas"),
    ("Spring re-slot 2025", "round 3 · 41 moves", "2025-09-30", "2025-10-03", "2025-10-06 · justas", "2025-11-20 15:05 · kari"),
]
COLS_WIDE = [20, 300, 400, 500, 652]
COLS_NARROW = [20, 262, 356, 450, 590]
COL_NAMES = ["Name", "Data as of", "Uploaded", "Created", "Last edited"]


def plans_header(x, y, w, title_size=28):
    o = t(x, y + 26, "Saved plans", title_size, INK, LB)
    o += t(x + tw("Saved plans", title_size, "lb") + 18, y + 25, "Shared by everyone who logs in · saved automatically", 13, INK2)
    o += button(x + w - 128, y, 128, "New Plan", "primary", "i-plus")
    return o


def plans_table(x, y, w=880, hover=None, menu=None, rows=None):
    """Data table of saved plans. Returns (svg, h, menu_button_xy)."""
    rows = rows if rows is not None else PLANS
    C = COLS_WIDE if w >= 870 else COLS_NARROW
    o = [rect(x, y, w, 36 + 52 * len(rows), 8, SURF, BORDER, 1)]
    for name, cx in zip(COL_NAMES, C):
        o.append(t(x + cx, y + 23, name, 11.5, INK2, "b w6"))
    o.append(icon("i-chev-d", x + C[4] + tw("Last edited", 11.5, "b6") + 2, y + 13, 14, INK2))
    o.append(line(x + 1, y + 36, x + w - 1, y + 36, BORDER))
    mb = None
    for i, (nm, meta, asof, up, cr, ed) in enumerate(rows):
        ry = y + 36 + i * 52
        if i == hover or i == menu:
            o.append(rect(x + 1, ry, w - 2, 52, 0, ROWQ if i == hover else SEL_T))
            if i == menu:
                o.append(rect(x + 1, ry, 3, 52, 0, INK))
        o.append(t(x + 20, ry + 23, nm, 14, INK, "b w6"))
        o.append(t(x + 20, ry + 41, meta, 12, INK2))
        for s, cx in ((asof, C[1]), (up, C[2])):
            o.append(t(x + cx, ry + 31, s, 13.5, INK, "lb w6"))
        o.append(t(x + C[3], ry + 31, cr, 12.5, INK))
        o.append(t(x + C[4], ry + 31, ed, 12.5, INK))
        if i == hover or i == menu:
            bx, by = x + w - 48, ry + 12
            o.append(rect(bx, by, 28, 28, 6, SURF, INK if i == menu else BORDER, 1))
            o.append(icon("i-dots", bx + 4, by + 4, 20, INK))
            if i == menu:
                mb = (bx, by)
        if i < len(rows) - 1:
            o.append(line(x + 1, ry + 52, x + w - 1, ry + 52))
    return "".join(o), 36 + 52 * len(rows), mb


def row_menu(x, y, hl=3, w=240):
    """Row menu: Open, New Plan from this import, Delete... hl = index of highlighted row (3 = Delete)."""
    items = [("i-arrow-r", "Open"), ("i-upload", "New Plan from this import"), None, ("i-trash", "Delete…")]
    H = 8 + 32 * 3 + 9 + 8
    o = [overlay(x, y, w, H)]
    yy = y + 4
    for i, it in enumerate(items):
        if it is None:
            o.append(line(x + 1, yy + 4.5, x + w - 1, yy + 4.5))
            yy += 9
            continue
        ic, s = it
        if i == hl:
            o.append(rect(x + 1, yy, w - 2, 32, 0, SEL_T) + rect(x + 1, yy, 3, 32, 0, INK))
        o.append(icon(ic, x + 14, yy + 8, 16, INK2 if i != hl else INK))
        o.append(t(x + 40, yy + 21, s, 13, INK, "b w6" if i == hl else "b w5"))
        yy += 32
    return "".join(o), H


def delete_dialog(x, y, w=440, shadow=True):
    P = 24
    o = []
    o.append(t(x + P, y + 42, "Delete “Autumn re-slot”?", 20, INK, LB))
    body = wrap("The plan, its marks, moves and recommendations are deleted for everyone. There is no archive.",
                13.5, "b4", w - 2 * P)
    for i, s in enumerate(body):
        o.append(t(x + P, y + 72 + i * 20, s, 13.5, INK))
    yy = y + 72 + (len(body) - 1) * 20
    o.append(t(x + P, yy + 24, "The import stays: 1 other plan uses it.", 12.5, INK2))
    by = yy + 48
    o.append(button(x + w - P - 112, by, 112, "Delete plan", "primary"))
    o.append(button(x + w - P - 112 - 10 - 84, by, 84, "Cancel", "tertiary", focus=True))
    H = by + 36 + P - y
    frame = f'<g filter="url(#pop)">{rect(x, y, w, H, 8, SURF)}</g>' if shadow else rect(x, y, w, H, 8, SURF, BORDER, 1)
    return frame + "".join(o), H


def plans_empty(x, y, w=560):
    body = wrap("A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions.",
                13, "b4", w - 58 - 20)
    H = 112 + 18 * len(body)
    o = [rect(x, y, w, H, 8, SURF, BORDER, 1)]
    o.append(icon("i-file", x + 24, y + 26, 22, INK))
    o.append(t(x + 58, y + 43, "No plans yet.", 16, INK, LB))
    for i, s in enumerate(body):
        o.append(t(x + 58, y + 66 + i * 18, s, 13, INK))
    by = y + 66 + 18 * (len(body) - 1) + 16
    o.append(button(x + 58, by, 120, "New Plan", "primary", "i-plus", h=32))
    o.append(runs(x + 194, by + 21, [("Demo files: ", 12, INK2, FB), ("data/sample/", 12.5, INK, "lb w6")]))
    return "".join(o), H


# ---------------------------------------------------------------- app chrome
FLOW = ["Import", "Parts", "Best locations", "Locations", "Pick groups", "Recommendations", "Before/after", "Move list"]


def toolbar(x, y, w, plan=True, current=3, rx=8):
    """Graphite louvre toolbar at real height 64. current = index of the current flow step."""
    o = [f'<path d="M{x} {y+rx} a{rx} {rx} 0 0 1 {rx} -{rx} H{x+w-rx} a{rx} {rx} 0 0 1 {rx} {rx} V{y+64} H{x} Z" fill="url(#louvre)"/>',
         line(x, y + 64, x + w, y + 64, "#121416", 1), logo(x + 18, y + 17)]
    if plan:
        px = x + 62
        o.append(rect(px, y + 11, 196, 42, 3, SURF) + rect(px, y + 11, 6, 42, 0, INK))
        o.append(t(px + 16, y + 29, "Spring re-slot 2026", 15, INK, LB))
        o.append(t(px + 16, y + 45, "data as of 2026-09-30 · round 1", 11, INK2, "b w5"))
        fx = px + 212
        fw = w - (fx - x) - 70
        o.append(rect(fx, y + 13, fw, 38, 8, "#16191C", "#3A4046", 1))
        sx = fx + 6
        for i, s in enumerate(FLOW):
            lw = tw(s, 12.5, "b5") + 30
            if sx + lw > fx + fw - 6:
                break
            if i == current:
                o.append(rect(sx, y + 17, lw + 6, 30, 4, SURF))
                o.append(f'<circle cx="{sx+12}" cy="{y+32}" r="7" fill="{INK}"/>' + t(sx + 12, y + 36, str(i + 1), 10.5, "#fff", LB, "middle"))
                o.append(t(sx + 24, y + 36.5, s, 12.5, INK, "b w6"))
                sx += lw + 10
            else:
                done = i < current
                if done:
                    o.append(f'<circle cx="{sx+12}" cy="{y+32}" r="7" fill="{ONDARK_NAV}"/>' + icon("i-check", sx + 6, y + 26, 12, INK))
                else:
                    o.append(f'<circle cx="{sx+12}" cy="{y+32}" r="6.5" fill="none" stroke="{ONDARK_M}" stroke-width="1.2"/>' +
                             t(sx + 12, y + 36, str(i + 1), 10, ONDARK_NAV, LB, "middle"))
                o.append(t(sx + 24, y + 36.5, s, 12.5, ONDARK_NAV, "b w5"))
                sx += lw + 4
    else:
        o.append(t(x + 62, y + 39, "Smart Warehouse Planner", 18, "#fff", LB))
    # avatar
    ax = x + w - 34
    o.append(f'<circle cx="{ax}" cy="{y+32}" r="16" fill="{ONDARK}"/>' + t(ax, y + 37, "JS", 12.5, INK, LB, "middle"))
    return "".join(o)


def svg(title, desc, body, h=900, w=1440):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-labelledby="t d"><title id="t">{title}</title><desc id="d">{desc}</desc>\n{DEFS}\n'
            f'<rect x="0" y="0" width="{w}" height="{h}" fill="{GROUND}"/>\n{body}\n</svg>\n')
