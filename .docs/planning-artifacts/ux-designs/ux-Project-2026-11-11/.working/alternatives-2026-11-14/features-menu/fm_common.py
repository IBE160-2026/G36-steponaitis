"""Shared pieces for the three features-menu alternatives (Bin Wall style).

Reuses the defs (fonts, glyphs, icons, filters) and helpers of the liked front page and
login generators in ../../landing-redesign/. Synthetic demo data only.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LANDING = os.path.normpath(os.path.join(HERE, "..", "..", "landing-redesign"))
sys.path.insert(0, LANDING)

from gen_landing import (t, logo, svg, slot, INK, INK2, INK3, GROUND, SURF, BORDER, HAIR, BAND,  # noqa: E402,F401
                         ONDARK, ONDARK2, ONDARK_NAV, CLS, GLY, LBL, BEST, BEST_L, ACCENT, LB)

TINT = "#F3EFFD"          # selected-tint
INPUT_B = "#8A9097"       # input-border
MUTED_D = "#9AA1A8"       # on-dark-muted
FLOW_TRACK, FLOW_EDGE = "#16191C", "#3A4046"
PANEL = "#F7F6F2"         # quiet panel inside a white surface
STEPS = ["Overview", "Parts", "Locations", "Pick groups", "Best locations",
         "Recommendations", "Before/after", "Move list"]
CODES = ["OVR", "PRT", "LOC", "GRP", "BST", "REC", "B/A", "MOV"]


def tw(s, size, cls="b w4"):
    """Rough text width for layout checks."""
    if "lb" in cls:
        k = 0.47
    elif "w6" in cls or "w7" in cls:
        k = 0.57
    else:
        k = 0.53
    return len(s) * size * k


def icon(name, x, y, size=18, color=INK):
    return f'<use href="#{name}" x="{x}" y="{y}" width="{size}" height="{size}" stroke="{color}" color="{color}"/>'


def rect(x, y, w, h, fill, rx=0, stroke=None, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{s}{extra}/>'


def keycap(x, y, label, dark=False):
    """A keyboard key. Returns (svg, width)."""
    w = max(22, tw(label, 12, "lb w7") + 14)
    fill, fg, edge = ("#2F3439", "#fff", "#5A6168") if dark else ("#fff", INK, INPUT_B)
    o = (rect(x, y, w, 22, fill, 4, edge, 1) +
         f'<rect x="{x+1}" y="{y+19}" width="{w-2}" height="2" rx="1" fill="{edge}" fill-opacity="0.5"/>' +
         t(x + w / 2, y + 15.5, label, 12, fg, "lb w7", "middle"))
    return o, w


def keys(x, y, labels, dark=False, gap=4):
    o, cx = "", x
    for lab in labels:
        s, w = keycap(cx, y, lab, dark)
        o += s
        cx += w + gap
    return o, cx - gap - x


def code_tag(x, y, code, dark=False, anchor_end=False):
    """Launcher code (SAV, REC ...) in a small ruled box, like a bin label."""
    w = tw(code, 12.5, "lb w7") + 14
    if anchor_end:
        x = x - w
    c = "#fff" if dark else INK
    return (rect(x, y, w, 20, "none", 3, c, 1.2) + t(x + w / 2, y + 14.5, code, 12.5, c, "lb w7", "middle")), w


def swatch(x, y, c, s=26):
    """Bin in miniature: class colour + glyph in a white label window."""
    return (rect(x, y, s, s, CLS[c], 2.5) +
            rect(x, y, s, s * 0.14, "#000", 1.5, extra=' fill-opacity="0.22"') +
            rect(x + s * 0.14, y + s * 0.3, s * 0.72, s * 0.5, "#fff", 1.2) +
            f'<use href="#{GLY[c]}" x="{x + s*0.34:.1f}" y="{y + s*0.38:.1f}" width="{s*0.32:.1f}" height="{s*0.32:.1f}"/>')


def chip(x, y, code, w=None):
    """Location chip (white, ink outline, Barlow code)."""
    w = w or tw(code, 13.5, "lb w7") + 18
    return rect(x, y, w, 26, "#fff", 3, INK, 1) + t(x + 9, y + 18, code, 13.5, INK, "lb w7"), w


def step_disc(cx, cy, n, state, r=7, dark=True):
    """state: done | current | todo. dark = on the graphite flow track."""
    if state == "done":
        f = ONDARK_NAV if dark else INK
        g = INK if dark else "#fff"
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{f}"/>' +
                icon("i-check", cx - r * 0.72, cy - r * 0.72, r * 1.44, g))
    if state == "current":
        f = "none" if dark else INK
        s = INK
        fg = INK if dark else "#fff"
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{f}" stroke="{s}" stroke-width="1.2"/>' +
                t(cx, cy + r * 0.55, str(n), round(max(11, r * 1.55), 1), fg, LB, "middle"))
    c = MUTED_D if dark else INK3
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{"none" if dark else "#fff"}" stroke="{c}" stroke-width="1.2"/>' +
            t(cx, cy + r * 0.55, str(n), round(max(11, r * 1.55), 1), c if dark else INK2, LB, "middle"))


# ------------------------------------------------------------------ app toolbar
FLOW_X = [(434, 447), (526, 539), (597, 610), (696, 709), (810, 823), (945, 958), (1095, 1108), (1214, 1227)]


def toolbar(current=6, launcher_open=True):
    """Graphite toolbar: mark + name, plan plate, 8-step flow bar, launcher button, avatar."""
    o = ['<rect x="0" y="0" width="1440" height="64" fill="url(#louvre)"/>',
         '<line x1="0" y1="63.5" x2="1440" y2="63.5" stroke="#121416" stroke-width="1"/>',
         logo(22, 17),
         t(62, 29, "Smart Warehouse", 15, "#fff", LB), t(62, 46, "Planner", 15, "#fff", LB)]
    # plan plate (ink edge, per the spines)
    o.append(rect(186, 11, 214, 42, "#fff", 3))
    o.append(rect(186, 11, 6, 42, INK))
    o.append(t(202, 29, "Spring re-slot 2026", 15, INK, LB))
    o.append(t(202, 45, "Data as of 2026-09-30 · round 1", 11.5, INK2, "b w5"))
    o.append(icon("i-chev-d", 376, 22, 16, INK2))
    # flow bar
    o.append(rect(416, 13, 881, 38, FLOW_TRACK, 7, FLOW_EDGE, 1))
    for i, (cx, tx) in enumerate(FLOW_X):
        n = i + 1
        if n == current:
            w = tw(STEPS[i], 13, "b w6") + 38
            o.append(rect(cx - 14, 17, w, 30, "#fff", 5))
            o.append(step_disc(cx, 32, n, "current"))
            o.append(t(tx, 36.5, STEPS[i], 13, INK, "b w6"))
        else:
            o.append(step_disc(cx, 32, n, "done" if n < 6 else "todo"))
            o.append(t(tx, 36.5, STEPS[i], 13, ONDARK_NAV, "b w5"))
    # launcher button: pressed = white with ink icon
    if launcher_open:
        o.append(rect(1334, 14, 36, 36, "#fff", 6))
        o.append(icon("i-menu", 1343, 23, 18, INK))
    else:
        o.append(rect(1334, 14, 36, 36, FLOW_TRACK, 6, FLOW_EDGE, 1))
        o.append(icon("i-menu", 1343, 23, 18, "#E8EAEC"))
    # avatar (user menu)
    o.append(f'<circle cx="{1398}" cy="32" r="17" fill="{ONDARK}"/>')
    o.append(t(1398, 37, "JS", 13, INK, LB, "middle"))
    return "".join(o)


# ------------------------------------------------------------------ the page behind (Recommendations)
REC_ROWS = [
    ("#1", "F", "4410281", "Brake pads, front - VW Golf", "Fast-moving: 61 picks in the period (24 or more)", "G-14-04-02", "A-02-01-01", "open"),
    ("#2", "F", "9723950", "Headlight bulb H7 - Peugeot 308", "Fast-moving: 44 picks in the period (24 or more)", "A-03-04-02", "A-05-01-03", "applied"),
    ("#3", "F", "5315766", "Air filter - Audi A4", "Fast-moving: 37 picks in the period (24 or more)", "C-05-02-01", "A-11-02-02", "outdated"),
    ("#4", "F", "8044172", "Oil filter - Toyota Corolla", "Fast-moving: 33 picks in the period (24 or more)", "A-12-04-02", "A-14-02-01", "selected"),
    ("#5", "F", "2555849", "Brake hose - Toyota Corolla", "Fast-moving: 29 picks in the period (24 or more)", "E-10-01-03", "A-17-01-02", "open"),
    ("#6", "F", "1180342", "Spark plug set - VW Golf", "Fast-moving: 28 picks in the period (24 or more)", "F-02-03-01", "A-18-01-01", "open"),
    ("#7", "F", "6620913", "Cabin filter - Skoda Octavia", "Fast-moving: 27 picks in the period (24 or more)", "B-09-04-02", "A-19-01-03", "open"),
    ("#8", "F", "3390277", "Wiper blade set - Ford Focus", "Fast-moving: 26 picks in the period (24 or more)", "C-14-03-02", "A-19-02-01", "open"),
]


def rec_page():
    """A real Recommendations page (step 6) so the menu sits over the app."""
    o = [t(40, 124, "Recommendations", 30, INK, LB)]
    o.append(rect(262, 100, 96, 34, "#fff", 3, INK, 1.2) + rect(262, 100, 5, 34, INK))
    o.append(t(316, 123, "Round 1", 15, INK, LB, "middle"))
    o.append(t(380, 114, "Run 2026-11-11 09:42 by Justas · 19 recommendations · 31 no space", 14, INK, "b w6"))
    o.append(t(380, 133, "The next run starts round 2 and uses the planning copy as it is then.", 13, INK2))
    x = 1400
    for lab, kind, w in (("Run recommendations", "p", 178), ("Apply all (15)", "s", 128), ("Undo last move", "s", 136), ("Reset…", "s", 76)):
        x -= w
        if kind == "p":
            o.append(rect(x, 100, w, 36, INK, 6) + t(x + w / 2, 123, lab, 13.5, "#fff", "b w7", "middle"))
        else:
            o.append(rect(x, 100, w, 36, "#fff", 6, INK, 1) + t(x + w / 2, 123, lab, 13.5, INK, "b w6", "middle"))
        x -= 10
    # tabs
    tx = 40
    for lab, n in (("All", 19), ("Rule 1", 9), ("Rule 2", 6), ("Rule 3", 4), ("No space", 31), ("Kept in place", 3), ("Outdated", 1)):
        sel = lab == "All"
        o.append(t(tx, 180, lab, 15, INK if sel else INK2, "b w6" if sel else "b w5"))
        px = tx + tw(lab, 15, "b w6") + 8
        o.append(f'<rect x="{px}" y="167" width="26" height="18" rx="9" fill="{INK if sel else "#fff"}" stroke="{INK if sel else BORDER}"/>')
        o.append(t(px + 13, 180.5, str(n), 11.5, "#fff" if sel else INK, LB, "middle"))
        if sel:
            o.append(rect(tx - 4, 194, px + 30 - tx, 3, INK))
        tx = px + 48
    o.append(rect(24, 197, 1392, 1, BORDER))
    # rule band
    o.append(rect(24, 210, 1392, 40, BAND))
    o.append(rect(40, 220, 54, 20, INK, 3) + t(67, 234.5, "Rule 1", 12, "#fff", LB, "middle"))
    o.append(t(108, 235, "Fast-moving parts into best locations", 15, INK, "b w7"))
    y = 250
    for rank, c, pn, desc, why, frm, to, st in REC_ROWS:
        h = 78
        bg = TINT if st == "selected" else ("url(#hatch)" if st == "outdated" else "#fff")
        o.append(rect(24, y, 1392, h, bg))
        if st == "selected":
            o.append(rect(24, y, 5, h, ACCENT))
        o.append(rect(24, y + h - 1, 1392, 1, HAIR))
        o.append(t(48, y + 32, rank, 20, INK, LB))
        o.append(t(48, y + 50, "of 9", 11.5, INK2))
        o.append(swatch(96, y + 16, c, 30))
        o.append(t(144, y + 33, pn, 16, INK, LB))
        o.append(t(214, y + 33, desc, 15, INK, "b w6"))
        o.append(t(144, y + 55, why, 13, INK2))
        s1, w1 = chip(600, y + 18, frm, 112)
        s2, w2 = chip(752, y + 18, to, 112)
        o.append(s1 + t(724, y + 36, "→", 15, INK) + s2)
        o.append(t(600, y + 62, "not best", 12, INK2))
        o.append(t(752, y + 62, "no longer empty" if st == "outdated" else "best · level 1, aisle A", 12, INK2))
        if st == "applied":
            o.append(icon("i-check", 920, y + 20, 18, INK) + t(944, y + 34, "Applied · move 3, round 1", 14, INK, "b w7"))
            o.append(t(944, y + 54, "In the planning copy", 12.5, INK2))
        elif st == "outdated":
            o.append(icon("i-clock", 920, y + 20, 18, INK) + t(944, y + 34, "Outdated", 14, INK, "b w7"))
            o.append(t(944, y + 54, "A-11-02-02 was filled by a manual move.", 12.5, INK2))
        else:
            o.append(rect(920, y + 18, 84, 36, INK if st == "selected" else "#fff", 6, INK, 1))
            o.append(t(962, y + 41, "Apply", 14, "#fff" if st == "selected" else INK, "b w7", "middle"))
            o.append(rect(1014, y + 18, 132, 36, "#fff", 6, INK, 1) + t(1080, y + 41, "Other location ▾", 13.5, INK, "b w6", "middle"))
            o.append(t(1162, y + 41, "Keep in place", 13.5, INK, "b w6", extra=' text-decoration="underline"'))
        y += h
    return "".join(o)


def dim(y0=64, op=0.5):
    return rect(0, y0, 1440, 900 - y0, INK, extra=f' fill-opacity="{op}"')
