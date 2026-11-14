"""Shared real-size component builders for the three components-sheet-1 alternatives.

Reuses the landing/login defs (fonts, glyphs, icons, filters) from ../../landing-redesign/defs.svgfrag
and the same helper style as gen_landing.py / gen_login.py. Tokens follow DESIGN.md.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DEFS = open(os.path.join(HERE, "..", "..", "landing-redesign", "defs.svgfrag")).read()

# --- tokens (DESIGN.md) -------------------------------------------------------------
INK, INK2, INK3, INK_DIS = "#1B1E22", "#4A5058", "#6B717A", "#8A9097"
GROUND, SURF, SURF_DIS, BAND, ROWQ = "#EEEDE8", "#FFFFFF", "#F3F2EE", "#E4E2DB", "#FAFAF7"
BORDER, INPUT_B, HAIR, SEL_TINT = "#D6D4CD", "#8A9097", "#E6E4DE", "#F3EFFD"
SHELL, WALL, SLOT, ONDARK, ONDARK2, ONDARK_M = "#262A2E", "#30353A", "#141719", "#E3E6E9", "#C9CED3", "#9AA1A8"
ACCENT, BEST, BEST_L, ERR, ERR_T = "#9466F0", "#3DAE6B", "#267A4B", "#D33A2C", "#FBE6E3"
CLS = {"F": "#D85144", "M": "#F0B323", "S": "#417DDC", "D": "#8C939A"}
GLY = {"F": "g-fast", "M": "g-med", "S": "g-slow", "D": "g-dead"}
NAME = {"F": "Fast-moving", "M": "Medium-moving", "S": "Slow-moving", "D": "Dead stock"}
LB = "lb w7"
PRESETS = {
    "F": "#DFB19A #DF9AA5 #E58C61 #DF7267 #D37382 #E4586E #DB6024 #D85144".split(),
    "M": "#F7F083 #FAED0F #EBB98E #F0B323 #C7BE23 #FBA255 #D26304 #8B8419".split(),
    "S": "#98C6E1 #5EB5E9 #98A3E1 #8A99EF #4C9AE6 #378CBE #677AEA #417DDC".split(),
    "D": "#B8BFC1 #B3B5BD #A4A8AD #949C9E #8C939A #848890 #798386 #7C808D".split(),
    "B": "#9AE0A5 #A3D6C4 #73D483 #53CAA0 #3CC353 #3DAE6B #459B7D #309C42".split(),
    "X": "#A280E5 #B45AF7 #9466F0 #7267E0 #6658EF #9516F3 #9034D5 #5747F6".split(),
}

EXTRA_DEFS = """
<symbol id="i-palette" viewBox="0 0 20 20"><g class="ic"><path d="M10 3a7 7 0 0 0 0 14c1.3 0 1.7-.9 1.2-1.8-.5-1 .1-2.2 1.3-2.2H15a2.5 2.5 0 0 0 2.5-2.5C17.5 6.2 14.1 3 10 3z"/></g><circle cx="6.4" cy="9.2" r="1.1" fill="currentColor"/><circle cx="8.6" cy="6.2" r="1.1" fill="currentColor"/><circle cx="12.3" cy="6.4" r="1.1" fill="currentColor"/></symbol>
<symbol id="i-cursor" viewBox="0 0 20 20"><path d="M4 2.5v13.2l3.4-3.2 2.3 5.3 2.3-1-2.3-5.2h4.7z" fill="#fff" stroke="#1B1E22" stroke-width="1.3" stroke-linejoin="round"/></symbol>
<symbol id="i-swatchbtn" viewBox="0 0 20 20"><g class="ic"><path d="M13.5 3.5l3 3-8 8H5.5v-3z"/></g></symbol>
<linearGradient id="fadeR" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#EEEDE8" stop-opacity="0"/><stop offset="1" stop-color="#EEEDE8" stop-opacity="1"/></linearGradient>
<linearGradient id="fadeB" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#EEEDE8" stop-opacity="0"/><stop offset="1" stop-color="#EEEDE8" stop-opacity="1"/></linearGradient>
"""


def t(x, y, s, size, fill=INK, cls="b w4", anchor=None, extra=""):
    a = f' text-anchor="{anchor}"' if anchor else ""
    return f'<text x="{x}" y="{y}" class="{cls}" font-size="{size}" fill="{fill}"{a}{extra}>{s}</text>'


_F = {"b w4": .52, "b w5": .535, "b w6": .55, "b w7": .57, "lb w7": .47, "lb w6": .45, "lb w5": .44}


def tw(s, size, cls="b w4"):
    """Rough text width (good enough for layout; checked visually)."""
    n = 0.0
    for ch in s:
        if ch in "il.,:;'|!·": n += .5
        elif ch in "mwMW": n += 1.45
        elif ch == " ": n += .55
        elif ch.isupper(): n += 1.18
        else: n += 1
    return n * size * _F.get(cls, .53)


def icon(name, x, y, size=18, color=INK):
    return f'<use href="#{name}" x="{x}" y="{y}" width="{size}" height="{size}" stroke="{color}" color="{color}"/>'


def rect(x, y, w, h, fill="none", rx=0, stroke=None, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{s}{extra}/>'


def svg(title, desc, body, h=900):
    defs = DEFS.replace("</defs>", EXTRA_DEFS + "</defs>")
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 {h}" width="1440" height="{h}" role="img" '
            f'aria-labelledby="t d"><title id="t">{title}</title><desc id="d">{desc}</desc>\n{defs}\n'
            f'<rect x="0" y="0" width="1440" height="{h}" fill="{GROUND}"/>\n{body}\n</svg>\n')


# --- focus rings ---------------------------------------------------------------------
def focus_paper(x, y, w, h, r=6):
    """2px white gap, then 2px ink ring (DESIGN focus-ring.on-paper)."""
    return (rect(x - 1, y - 1, w + 2, h + 2, rx=r + 1, stroke="#fff", sw=2) +
            rect(x - 3, y - 3, w + 6, h + 6, rx=r + 3, stroke=INK, sw=2))


def focus_graphite(x, y, w, h, r=2):
    return (rect(x - 1, y - 1, w + 2, h + 2, rx=r + 1, stroke="#141719", sw=2) +
            rect(x - 3, y - 3, w + 6, h + 6, rx=r + 3, stroke="#fff", sw=2))


# --- bins and wall at real size ------------------------------------------------------
def bin_rt(x, y, c, col=None, w=27, h=29, split=None):
    k = w / 27
    o = [rect(x, y, w, h, col or CLS[c], rx=2),
         rect(x, y, w, round(3.5 * k, 2), "#000", rx=1.5, extra=' fill-opacity="0.22"'),
         f'<path d="M{x+1.5*k:.2f} {y+h-3*k:.2f} H{x+w-1.5*k:.2f}" stroke="#000" stroke-opacity="0.18" stroke-width="{1.5*k:.2f}"/>']
    wx, wy, ww, wh = x + 3 * k, y + 8.7 * k, w - 6 * k, 13 * k
    o.append(rect(round(wx, 2), round(wy, 2), round(ww, 2), round(wh, 2), "#fff", rx=1))
    g = 9 * k
    if split:  # two parts: split label window, one glyph per half
        a, b = split
        o.append(f'<use href="#{GLY[a]}" x="{wx+ww/4-g*.4:.2f}" y="{wy+(wh-g*.8)/2:.2f}" width="{g*.8:.2f}" height="{g*.8:.2f}"/>')
        o.append(f'<path d="M{wx+ww/2:.2f} {wy+1:.2f} V{wy+wh-1:.2f}" stroke="{INK}" stroke-width="{max(.6, .8*k):.2f}"/>')
        o.append(f'<use href="#{GLY[b]}" x="{wx+3*ww/4-g*.4:.2f}" y="{wy+(wh-g*.8)/2:.2f}" width="{g*.8:.2f}" height="{g*.8:.2f}"/>')
    else:
        o.append(f'<use href="#{GLY[c]}" x="{x+(w-g)/2:.2f}" y="{wy+2*k:.2f}" width="{g:.2f}" height="{g:.2f}"/>')
    return "".join(o)


def slot_rt(x, y, w=27, h=29):
    return (rect(x, y, w, h, SLOT, rx=2) +
            rect(round(x + w * .28, 2), y + 3 * w / 27, round(w * .44, 2), round(2.6 * w / 27, 2), "#3A4046", rx=1.3) +
            f'<path d="M{x+3*w/27:.2f} {y+h-3*w/27:.2f} H{x+w-3*w/27:.2f}" stroke="#2C3136" stroke-width="1"/>')


def wall_rt(x0, y0, grid, best_levels=(1, 2), first_section=1, colors=None, label_col=True):
    """Real-size wall (bin 27x29, slot pitch 30, level pitch 40, section pitch 96).
    grid: rows from top level to L1, 3 chars per section: F M S D . (empty)."""
    colors = colors or {}
    levels = len(grid)
    nsec = len(grid[0]) // 3
    W = 60 + nsec * 96 + 17
    H = 27 + levels * 40 + 8
    o = [rect(x0, y0, W, H, "url(#louvre2)", rx=6), rect(x0, y0, W, H, rx=6, stroke="#1A1D20")]
    if label_col:
        o.append(t(x0 + 12, y0 + 16, "Section", 11, ONDARK_M, "lb w6"))
    for si in range(nsec):
        sx = x0 + 60 + si * 96
        o.append(t(sx + 50, y0 + 16, f"{first_section+si:02d}", 12, ONDARK2, "lb w6", "middle"))
        o.append(rect(sx, y0 + 22, 5, levels * 40 + 2, "#454B52"))
    o.append(rect(x0 + 60 + nsec * 96, y0 + 22, 5, levels * 40 + 2, "#454B52"))
    cells = {}
    for li, row in enumerate(grid):
        lvl = levels - li
        by = y0 + 27 + li * 40
        best = lvl in best_levels
        o.append(t(x0 + 12, by + 12, f"L{lvl}", 13, ONDARK, LB))
        if best:
            o.append(rect(x0 + 12, by + 17, 40, 15, BEST, rx=2) + t(x0 + 32, by + 28.5, "BEST", 11, INK, LB, "middle"))
        o.append(rect(x0 + 60, by + 31, nsec * 96 + 5, 4, BEST if best else "#1F2326"))
        for ci, c in enumerate(row):
            si, j = divmod(ci, 3)
            bx = x0 + 60 + si * 96 + 8 + j * 30
            cells[(li, ci)] = (bx, by)
            o.append(slot_rt(bx, by) if c == "." else bin_rt(bx, by, c, colors.get(c)))
    return "".join(o), W, H, cells


# --- Key (legend) ---------------------------------------------------------------------
KEY_ENTRIES = [("F", "Fast-moving", True), ("M", "Medium-moving", True), ("S", "Slow-moving", True),
               ("D", "Dead stock", True), ("E", "Empty (open slot)", False), ("B", "Best location", True),
               ("X", "Selected", True), ("2", "2 parts", False)]


def key_swatch(x, y, c, colors=None):
    colors = colors or {}
    if c in CLS:
        return bin_rt(x, y, c, colors.get(c), 16, 18)
    if c == "E":
        return slot_rt(x, y, 16, 18)
    if c == "B":
        g = colors.get("B", BEST)
        return slot_rt(x, y, 16, 18) + rect(x - 1, y - 1, 18, 20, rx=2.5, stroke=g, sw=2)
    if c == "X":
        a = colors.get("X", ACCENT)
        return (slot_rt(x, y, 16, 18) + rect(x - 2.5, y - 2.5, 21, 23, rx=3.5, stroke=SLOT, sw=1.2) +
                rect(x - 1, y - 1, 18, 20, rx=2.5, stroke=a, sw=2))
    if c == "2":
        return bin_rt(x, y, "F", colors.get("F"), 16, 18, split=("F", "S"))
    return ""


def key_entry_w(label, editable, state):
    w = 6 + 16 + 7 + tw(label, 12, "b w5") + 6
    if editable and state in ("hover", "open"):
        w += 18
    return w


def key_entry(x, y, c, label, editable, state="default", colors=None):
    """y = vertical centre of the entry. Returns (svg, width)."""
    w = key_entry_w(label, editable, state)
    o = []
    if editable and state in ("hover", "open"):
        o.append(rect(x, y - 13, w, 26, SEL_TINT, rx=4))
    o.append(key_swatch(x + 6, y - 9, c, colors))
    o.append(t(x + 29, y + 4.5, label, 12, INK, "b w5"))
    if editable and state in ("hover", "open"):
        o.append(icon("i-palette", x + w - 20, y - 7, 14, INK2))
    if state == "focus":
        o.append(focus_paper(x, y - 13, w, 26, 4))
    return "".join(o), w


def key_bar(x, y, states=None, colors=None, gap=8, label=True):
    """Full Key. y = vertical centre. Returns (svg, width, {code: (x, w)})."""
    states = states or {}
    o, pos = [], {}
    cx = x
    if label:
        o.append(t(x, y + 4.5, "Key", 13, INK, LB))
        cx += 34
    for c, lab, ed in KEY_ENTRIES:
        s, w = key_entry(cx, y, c, lab, ed, states.get(c, "default"), colors)
        o.append(s)
        pos[c] = (cx, w)
        cx += w + gap
    return "".join(o), cx - gap - x, pos


# --- buttons ---------------------------------------------------------------------------
def btn_w(label, icon_name=None, size=13):
    return round(tw(label, size, "b w6") + 32 + (24 if icon_name else 0))


def btn(x, y, label, kind="primary", state="default", w=None, icon_name=None, h=36, size=13):
    """kinds: primary secondary tertiary link destructive. states: default hover focus pressed disabled."""
    w = w or btn_w(label, icon_name, size)
    o = []
    if kind == "link":
        fg = INK_DIS if state == "disabled" else INK
        tx = x + (w - tw(label, size, "b w6")) / 2
        o.append(t(x + w / 2, y + h / 2 + size * .36, label, size, fg, "b w6", "middle"))
        lw = tw(label, size, "b w6")
        o.append(rect(round(x + (w - lw) / 2, 1), y + h / 2 + size * .36 + 2.5, round(lw, 1), 2 if state == "hover" else 1, fg))
        if state == "focus":
            o.append(focus_paper(x, y + 4, w, h - 8, 4))
        return "".join(o), w
    if state == "disabled":
        bg, fg, st = SURF_DIS, INK_DIS, BORDER
    elif kind in ("primary", "destructive"):
        bg, fg, st = {"hover": "#363C42", "pressed": "#000000"}.get(state, INK), "#fff", None
    else:
        bg = {"hover": GROUND, "pressed": BAND}.get(state, SURF)
        fg, st = INK, (INK if kind == "secondary" else BORDER)
    o.append(rect(x, y, w, h, bg, rx=6, stroke=st, sw=1))
    if icon_name:
        ix = x + 14
        o.append(icon(icon_name, ix, y + (h - 16) / 2, 16, fg))
        o.append(t(ix + 23, y + h / 2 + size * .36, label, size, fg, "b w6"))
    else:
        o.append(t(x + w / 2, y + h / 2 + size * .36, label, size, fg, "b w6", "middle"))
    if state == "focus":
        o.append(focus_paper(x, y, w, h, 6))
    return "".join(o), w


# --- colour popover --------------------------------------------------------------------
def colour_popover(x, y, entry="S", current="#378CBE", hexval=None, warning=None, hex_error=False,
                   storage_note=False, pointer_x=None, focus=None, shadow=True):
    """Real-size Key colour popover, 264px wide. Returns (svg, height).
    warning: list of text lines for the pale-red check box. focus: 'preset' | 'hex' | 'done' | None."""
    W = 264
    presets = PRESETS[entry]
    default = {"F": CLS["F"], "M": CLS["M"], "S": CLS["S"], "D": CLS["D"], "B": BEST, "X": ACCENT}[entry]
    hexval = hexval or current
    o = []
    body = []
    # title: name + fixed glyph + "colour"
    name = {"B": "Best location", "X": "Selected"}.get(entry, NAME.get(entry, ""))
    nx = x + 16
    body.append(t(nx, y + 30, name, 16, INK, LB))
    gx = nx + tw(name, 16, LB) + 6
    if entry in GLY:
        body.append(f'<use href="#{GLY[entry]}" x="{gx:.1f}" y="{y+19.5}" width="11" height="11"/>')
        gx += 17
    elif entry == "B":  # fixed cue: the BEST tag
        body.append(rect(round(gx, 1), y + 18, 34, 15, current if not hex_error else BEST, rx=2) +
                    t(round(gx + 17, 1), y + 29.5, "BEST", 11, INK, LB, "middle"))
        gx += 40
    elif entry == "X":  # fixed cue: the cased selection frame
        body.append(rect(round(gx + 1, 1), y + 18, 13, 14, SLOT, rx=2) +
                    rect(round(gx, 1), y + 17, 15, 16, rx=3, stroke=current, sw=2))
        gx += 21
    body.append(t(round(gx, 1), y + 30, "colour", 16, INK, LB))
    # presets: 2 rows of 4, 22px swatches on a 30px pitch
    for i, c in enumerate(presets):
        r, k = divmod(i, 4)
        cx, cy = x + 28 + k * 30, y + 58 + r * 30
        body.append(f'<circle cx="{cx}" cy="{cy}" r="11" fill="{c}" stroke="#000" stroke-opacity="0.18" stroke-width="1"/>')
        if c.upper() == current.upper():
            body.append(f'<circle cx="{cx}" cy="{cy}" r="14.5" fill="none" stroke="{INK}" stroke-width="2"/>')
            light = sum(int(c[j:j+2], 16) for j in (1, 3, 5)) > 520
            body.append(icon("i-check", cx - 7, cy - 7, 14, INK if light else "#fff"))
            if focus == "preset":
                body.append(f'<circle cx="{cx}" cy="{cy}" r="17.5" fill="none" stroke="#fff" stroke-width="2"/>'
                            f'<circle cx="{cx}" cy="{cy}" r="19.5" fill="none" stroke="{INK}" stroke-width="2"/>')
    # Default chip
    body.append(rect(x + 152, y + 42, 96, 62, ROWQ, rx=4, stroke=HAIR))
    body.append(t(x + 162, y + 61, "Default", 11.5, INK2, "b w5"))
    body.append(rect(x + 162, y + 72, 16, 16, default, rx=3, stroke="#000", sw=1, extra=' stroke-opacity="0.18"'))
    body.append(t(x + 184, y + 85, default, 13.5, INK2, LB))
    cy = y + 120
    if warning:
        hh = 16 + 16 * len(warning)
        body.append(rect(x + 16, cy, 232, hh, ERR_T, rx=4))
        body.append(icon("i-alert", x + 23, cy + 8, 16, ERR))
        for i, line in enumerate(warning):
            body.append(t(x + 45, cy + 21 + 16 * i, line, 12, INK))
        cy += hh + 12
    # hex row
    body.append(t(x + 16, cy + 21, "Hex", 13, INK, "b w6"))
    body.append(rect(x + 50, cy, 104, 32, "#fff", rx=6, stroke=ERR if hex_error else INPUT_B, sw=1.5 if hex_error else 1))
    body.append(t(x + 61, cy + 21, hexval, 13.5, INK, LB))
    if focus == "hex":
        body.append(focus_paper(x + 50, cy, 104, 32, 6))
        body.append(rect(round(x + 61 + tw(hexval, 13.5, LB) + 2, 1), cy + 8, 1.5, 16, INK))
    body.append(rect(x + 162, cy, 32, 32, "#fff", rx=6, stroke=BORDER))
    body.append(rect(x + 167, cy + 5, 22, 22, current if not hex_error else "#fff", rx=3, stroke="#000", sw=1,
                     extra=' stroke-opacity="0.18"'))
    if hex_error:
        body.append(f'<path d="M{x+169} {cy+25} L{x+187} {cy+7}" stroke="{INK3}" stroke-width="1.2"/>')
    body.append(t(x + 202, cy + 21, "Picker", 12, INK2, "b w5"))
    cy += 32
    if hex_error:
        body.append(icon("i-alert", x + 16, cy + 8, 16, ERR))
        body.append(t(x + 38, cy + 21, "Enter a colour as #RRGGBB", 12, INK))
        cy += 26
    if storage_note:
        body.append(icon("i-info", x + 16, cy + 9, 15, INK2))
        body.append(t(x + 37, cy + 21, "Colours can’t be kept in this browser;", 12, INK2))
        body.append(t(x + 37, cy + 37, "changes last until you close this tab.", 12, INK2))
        cy += 40
    cy += 16
    rs, rw = btn(x + 16, cy, "Reset this colour", "tertiary")
    body.append(rs)
    ds, dw = btn(x + W - 16 - 66, cy, "Done", "primary", "focus" if focus == "done" else "default", w=66)
    body.append(ds)
    cy += 36 + 16
    H = cy - y
    frame = rect(x, y, W, H, "#fff", rx=6, stroke=BORDER)
    if shadow:
        o.append(f'<g filter="url(#pop)">{frame}</g>')
    else:
        o.append(frame)
    if pointer_x is not None:
        px = pointer_x
        o.append(f'<path d="M{px-9} {y+H-0.5} L{px} {y+H+9} L{px+9} {y+H-0.5}" fill="#fff" stroke="{BORDER}" stroke-width="1"/>'
                 f'<rect x="{px-8.5}" y="{y+H-2}" width="17" height="2.2" fill="#fff"/>')
    o.extend(body)
    return "".join(o), H


# --- toast -----------------------------------------------------------------------------
def toast(x, y, icon_name, lines, action=None, w=None, action_focus=False, shadow=True):
    """Ink strip, up to 560 wide, 44 min high; lines = list of strings (1 or 2)."""
    tw_ = max(tw(s, 13, "b w5") for s in lines)
    aw = tw(action, 13, "b w6") if action else 0
    w = w or min(560, round(14 + 18 + 12 + tw_ + (28 + aw if action else 0) + 16))
    h = 44 if len(lines) == 1 else 44 + 18 * (len(lines) - 1)
    o = []
    r = rect(x, y, w, h, INK, rx=6)
    o.append(f'<g filter="url(#pop)">{r}</g>' if shadow else r)
    o.append(icon(icon_name, x + 14, y + 13, 18, ONDARK))
    for i, s in enumerate(lines):
        o.append(t(x + 44, y + 27 + 18 * i, s, 13, "#fff", "b w5"))
    if action:
        ax = x + w - 16
        o.append(t(ax, y + 27, action, 13, "#fff", "b w6", "end", ' text-decoration="underline"'))
        if action_focus:
            o.append(rect(round(ax - aw - 5, 1), y + 10, round(aw + 10, 1), 24, rx=4, stroke="#141719", sw=2) +
                     rect(round(ax - aw - 7, 1), y + 8, round(aw + 14, 1), 28, rx=5, stroke="#fff", sw=2))
    return "".join(o), w, h


# --- confirm popover and dialog ---------------------------------------------------------
def confirm_popover(x, y, question, body_lines, cancel="Cancel", ok="Apply 15", pointer_x=None, focus="ok", w=352):
    """Popover under its trigger (pointer up). rounded.lg, 1px border, body-strong question."""
    H = 50 + 18 * len(body_lines) + 52
    o = [f'<g filter="url(#pop)">{rect(x, y, w, H, "#fff", rx=6, stroke=BORDER)}</g>']
    if pointer_x is not None:
        px = pointer_x
        o.append(f'<path d="M{px-9} {y+0.5} L{px} {y-9} L{px+9} {y+0.5}" fill="#fff" stroke="{BORDER}" stroke-width="1"/>'
                 f'<rect x="{px-8.5}" y="{y}" width="17" height="2" fill="#fff"/>')
    o.append(t(x + 18, y + 32, question, 14, INK, "b w6"))
    for i, s in enumerate(body_lines):
        o.append(t(x + 18, y + 54 + 18 * i, s, 13, INK2))
    by = y + H - 52
    okw = btn_w(ok)
    cw = btn_w(cancel)
    o.append(btn(x + w - 18 - okw, by, ok, "primary", "focus" if focus == "ok" else "default", w=okw)[0])
    o.append(btn(x + w - 18 - okw - 10 - cw, by, cancel, "tertiary", "focus" if focus == "cancel" else "default", w=cw)[0])
    return "".join(o), H


def dialog(x, y, title, body_lines, ok="Delete plan", w=456, cancel_focus=True):
    """Modal dialog: rounded.xl, 20px Barlow title, Cancel first with default focus, destructive in ink."""
    H = 64 + 20 * len(body_lines) + 24 + 36 + 24
    o = [f'<g filter="url(#pop)">{rect(x, y, w, H, "#fff", rx=8)}</g>']
    o.append(t(x + 24, y + 42, title, 20, INK, LB))
    for i, s in enumerate(body_lines):
        o.append(t(x + 24, y + 72 + 20 * i, s, 13, INK2))
    by = y + H - 24 - 36
    okw = btn_w(ok)
    cw = btn_w("Cancel")
    o.append(btn(x + w - 24 - okw, by, ok, "destructive", w=okw)[0])
    o.append(btn(x + w - 24 - okw - 12 - cw, by, "Cancel", "tertiary", "focus" if cancel_focus else "default", w=cw)[0])
    return "".join(o), H


# --- Settings (read-only analysis settings, FR-18) --------------------------------------
def class_scale(x, y, w, colors=None):
    """Movement class limits as one ruler: picks in the period, low to high."""
    colors = colors or {}
    segs = [("D", "0", "Dead stock"), ("S", "1–5", "Slow-moving"), ("M", "6–23", "Medium-moving"),
            ("F", "24 or more", "Fast-moving")]
    sw = w / 4
    o = [rect(x, y + 42, w, 2, INK)]
    for i, (c, rng, name) in enumerate(segs):
        sx = x + i * sw
        o.append(rect(round(sx, 1), y + 37, 1.5, 12, INK))
        o.append(bin_rt(round(sx + 8, 1), y, c, colors.get(c)))
        o.append(t(round(sx + 42, 1), y + 20, rng, 15.5, INK, LB))
        o.append(t(round(sx + 8, 1), y + 66, name, 12, INK2, "b w5"))
    o.append(rect(x + w - 1.5, y + 37, 1.5, 12, INK))
    return "".join(o)


def settings_page(x, y, w=640, title=True, narrow=False, lab=172):
    """Read-only Settings page body at real size. Returns (svg, height)."""
    o = []
    cy = y
    if title:
        o.append(t(x, cy + 28, "Settings", 28, INK, LB))
        o.append(t(x, cy + 54, "Spring re-slot 2026 · data as of 2026-09-30", 13, INK2))
        lw = 104
        o.append(rect(x + w - lw, cy + 6, lw, 26, "#fff", rx=13, stroke=INK, sw=1.2))
        o.append(icon("i-lock", x + w - lw + 10, cy + 10, 16, INK))
        o.append(t(x + w - lw + 32, cy + 23.5, "Read-only", 12, INK, "b w6"))
        cy += 78
    rows = 3
    card_top = cy
    o_card = []
    pad = 20
    lab_w = 0 if narrow else lab
    vx = x + pad + lab_w
    vw = w - 2 * pad - lab_w
    o_card.append(t(x + pad, cy + 32, "Analysis settings", 16, INK, LB))
    o_card.append(t(x + pad, cy + 54, "This plan was computed with these values.", 13, INK2))
    cy += 74

    def row_label(yy, s):
        o_card.append(rect(x + pad, yy, w - 2 * pad, 1, HAIR))
        o_card.append(t(x + pad, yy + 30, s, 13, INK, "b w6"))

    # Period
    row_label(cy, "Period")
    py = cy + (52 if narrow else 30)
    o_card.append(t(vx, py, "2025-10-01 – 2026-09-30", 16, INK, LB))
    o_card.append(t(vx, py + 20, "12 months up to the data-as-of date", 12, INK2))
    cy += 92 if narrow else 72
    # class limits
    row_label(cy, "Movement class limits")
    sy = cy + (48 if narrow else 22)
    if narrow:
        segs = [("F", "Fast-moving", "24 or more picks"), ("M", "Medium-moving", "6–23 picks"),
                ("S", "Slow-moving", "1–5 picks"), ("D", "Dead stock", "0 picks")]
        half = (w - 2 * pad) / 2
        for i, (c, n, r) in enumerate(segs):
            yy = sy + (i // 2) * 42
            xx = vx + (i % 2) * half
            o_card.append(bin_rt(round(xx, 1), yy, c))
            o_card.append(t(round(xx + 36, 1), yy + 13, n, 13, INK, "b w6"))
            o_card.append(t(round(xx + 36, 1), yy + 29, r, 12, INK2))
        cy += 48 + 2 * 42 + 14
    else:
        o_card.append(class_scale(vx, sy, vw))
        o_card.append(t(vx + vw, sy + 86, "picks in the period →", 11.5, INK3, "b w5", "end"))
        cy += 124
    # pick-group minimum
    row_label(cy, "Pick-group minimum")
    py = cy + (52 if narrow else 30)
    o_card.append(t(vx, py, "5 shared jobs", 16, INK, LB))
    o_card.append(t(vx, py + 20, "Two parts that share 5 or more jobs in the", 12, INK2))
    o_card.append(t(vx, py + 36, "period form a pick group.", 12, INK2))
    cy += 110 if narrow else 88
    # footer band
    fh = 58 if not narrow else 92
    o_card.append(rect(x + 1, cy, w - 2, fh - 1, ROWQ))
    o_card.append(rect(x + 1, cy, w - 2, 1, HAIR))
    o_card.append(icon("i-info", x + pad, cy + 14, 16, INK2))
    if narrow:
        lines = ["Changed in the configuration file, not in", "the app. New plans use the current file;",
                 "this plan keeps these values."]
    else:
        lines = ["Changed in the configuration file, not in the app. New plans use the",
                 "current file; this plan keeps the values it was computed with."]
    for i, s in enumerate(lines):
        o_card.append(t(x + pad + 24, cy + 26 + 18 * i, s, 12.5, INK2))
    cy += fh
    card = rect(x, card_top, w, cy - card_top, "#fff", rx=8, stroke=BORDER)
    return "".join(o) + card + "".join(o_card), cy - y


# --- annotation helpers ----------------------------------------------------------------
def pin(x, y, n, fill=INK, fg="#fff"):
    return (f'<circle cx="{x}" cy="{y}" r="10" fill="{fill}" stroke="#fff" stroke-width="1.5"/>' +
            t(x, y + 4.3, str(n), 12, fg, LB, "middle"))


def leader(x1, y1, x2, y2, color=INK):
    return (f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{color}" stroke-width="1"/>'
            f'<circle cx="{x2}" cy="{y2}" r="2.2" fill="{color}"/>')


def dim_h(x1, x2, y, label, color="#B0462F", above=True):
    """Dimension line with end ticks and a label (spec-sheet red-brown, not a UI colour)."""
    ly = y - 6 if above else y + 15
    lw = tw(label, 11.5, "lb w6") + 8
    mx = (x1 + x2) / 2
    return (f'<path d="M{x1} {y} H{x2} M{x1} {y-5} V{y+5} M{x2} {y-5} V{y+5}" stroke="{color}" stroke-width="1"/>' +
            rect(round(mx - lw / 2, 1), ly - 11, round(lw, 1), 14, GROUND) +
            t(mx, ly, label, 11.5, color, "lb w6", "middle"))


def dim_v(x, y1, y2, label, color="#B0462F", left=False):
    lx = x - 7 if left else x + 7
    return (f'<path d="M{x} {y1} V{y2} M{x-5} {y1} H{x+5} M{x-5} {y2} H{x+5}" stroke="{color}" stroke-width="1"/>' +
            t(lx, (y1 + y2) / 2 + 4, label, 11.5, color, "lb w6", "end" if left else None))


def sheet_header(kicker, title, lead, right=None, y=0):
    o = [t(72, y + 64, kicker, 13, INK2, LB, extra=' letter-spacing="1.6"'),
         t(72, y + 120, title, 56, INK, LB)]
    for i, s in enumerate(lead):
        o.append(t(72, y + 156 + 26 * i, s, 17, INK2))
    if right:
        for i, s in enumerate(right):
            o.append(t(1368, y + 64 + 20 * i, s, 12.5, INK3, "b w5", "end"))
    return "".join(o)


def section_title(x, y, num, title, note=None):
    o = [t(x, y, num, 26, INK3, LB), t(x + 40, y, title, 26, INK, LB)]
    if note:
        o.append(t(x + 40 + tw(title, 26, LB) + 14, y, note, 13.5, INK2))
    return "".join(o)


def toolbar_strip(x, y, w, plan="Spring re-slot 2026", step="Locations"):
    """Graphite toolbar at real height (64), simplified: mark, name, plan plate, flow track."""
    o = [rect(x, y, w, 64, "url(#louvre)"), rect(x, y + 63, w, 1, "#121416")]
    lx = x + 22
    o.append(f'<g><rect x="{lx}" y="{y+17}" width="30" height="30" rx="2" fill="#F0B323"/>'
             f'<rect x="{lx}" y="{y+17}" width="30" height="3.5" rx="1.5" fill="#000" fill-opacity="0.22"/>'
             f'<rect x="{lx+3}" y="{y+26}" width="24" height="13" rx="1" fill="#fff"/>'
             f'<use href="#g-med" x="{lx+10.5}" y="{y+28}" width="9" height="9"/></g>')
    o.append(t(x + 62, y + 29, "Smart Warehouse", 15, "#fff", LB))
    o.append(t(x + 62, y + 46, "Planner", 15, "#fff", LB))
    o.append(rect(x + 186, y + 11, 214, 42, "#fff", rx=3) + rect(x + 186, y + 11, 6, 42, INK))
    o.append(t(x + 202, y + 29, plan, 15, INK, LB))
    o.append(t(x + 202, y + 45, "Data as of 2026-09-30 · round 1", 11.5, INK2, "b w5"))
    o.append(icon("i-chev-d", x + 376, y + 22, 16, INK2))
    fw = w - 416 - 70
    if fw > 120:
        o.append(rect(x + 416, y + 13, fw, 38, "#16191C", rx=7, stroke="#3A4046"))
        steps = ["Overview", "Parts", "Locations", "Pick groups", "Best locations", "Recommendations", "Before/after", "Move list"]
        sx = x + 428
        for i, s in enumerate(steps):
            sw_ = 26 + tw(s, 13, "b w5") + 14
            if sx + sw_ > x + 416 + fw - 8:
                break
            if s == step:
                o.append(rect(round(sx - 6, 1), y + 17, round(sw_, 1), 30, "#fff", rx=4))
                o.append(f'<circle cx="{sx+6}" cy="{y+32}" r="7" fill="none" stroke="{INK}" stroke-width="1.2"/>')
                o.append(t(sx + 6, y + 36, str(i + 1), 11, INK, LB, "middle"))
                o.append(t(sx + 19, y + 36.5, s, 13, INK, "b w6"))
            else:
                o.append(f'<circle cx="{sx+6}" cy="{y+32}" r="7" fill="#D5D9DD"/>')
                o.append(icon("i-check", sx + 1, y + 27, 10, INK))
                o.append(t(sx + 19, y + 36.5, s, 13, "#D5D9DD", "b w5"))
            sx += sw_ + 6
    o.append(rect(x + w - 52, y + 14, 36, 36, "#16191C", rx=6, stroke="#3A4046"))
    o.append(icon("i-menu", x + w - 43, y + 23, 18, "#E8EAEC"))
    return "".join(o)
