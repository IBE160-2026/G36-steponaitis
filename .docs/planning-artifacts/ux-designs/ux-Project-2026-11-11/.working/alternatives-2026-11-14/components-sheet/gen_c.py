"""Alternative C: State matrix. Every interactive piece in every state, at real size: a controls x states
table, the colour popover in four states, toast and confirm variants, Settings wide and narrow.
Usage: python3 gen_c.py [out.svg]"""
import os, sys
from common import *

COLS = [("Default", False), ("Hover", True), ("Focus · keyboard", False), ("Pressed / open", True),
        ("Disabled", False), ("Error", False)]
CX0, CW = 296, 178


def cursor(x, y):
    return f'<use href="#i-cursor" x="{x}" y="{y}" width="18" height="18"/>'


def na(x, cy, note="—"):
    return t(x, cy + 4.5, note, 12, INK_DIS, "b w5")


def swatch(cx, cy, c="#5EB5E9", state="default"):
    o = f'<circle cx="{cx}" cy="{cy}" r="11" fill="{c}" stroke="#000" stroke-opacity="0.18" stroke-width="1"/>'
    if state == "hover":
        o += f'<circle cx="{cx}" cy="{cy}" r="14.5" fill="none" stroke="{INK_DIS}" stroke-width="1.5"/>' + cursor(cx + 6, cy + 4)
    if state in ("current", "focus-current"):
        o += f'<circle cx="{cx}" cy="{cy}" r="14.5" fill="none" stroke="{INK}" stroke-width="2"/>' + icon("i-check", cx - 7, cy - 7, 14, INK)
    if state in ("focus", "focus-current"):
        o += (f'<circle cx="{cx}" cy="{cy}" r="17.5" fill="none" stroke="#fff" stroke-width="2"/>'
              f'<circle cx="{cx}" cy="{cy}" r="19.5" fill="none" stroke="{INK}" stroke-width="2"/>')
    return o


def hexfield(x, y, val="#417DDC", state="default"):
    err = state == "error"
    bc = ERR if err else (INK if state == "hover" else INPUT_B)
    o = rect(x, y, 104, 32, "#fff", rx=6, stroke=bc, sw=1.5 if err else 1) + t(x + 11, y + 21, val, 13.5, INK, LB)
    if state == "focus":
        o += focus_paper(x, y, 104, 32, 6) + rect(round(x + 11 + tw(val, 13.5, LB) + 2, 1), y + 8, 1.5, 16, INK)
    if state == "hover":
        o += cursor(x + 80, y + 18)
    if err:
        o += icon("i-alert", x + 112, y + 8, 16, ERR)
    return o


def toast_end(x, y, state="default"):
    o = rect(x, y, 128, 44, INK, rx=6) + t(x + 14, y + 27, "…01-01", 13, "#fff", "b w5")
    ax = x + 128 - 16
    aw = tw("Undo", 13, "b w6")
    o += t(ax, y + 27, "Undo", 13, "#fff", "b w6", "end", ' text-decoration="underline"')
    if state == "hover":
        o += rect(round(ax - aw, 1), y + 30, round(aw, 1), 2, "#fff") + cursor(ax - 6, y + 26)
    if state == "focus":
        o += (rect(round(ax - aw - 5, 1), y + 10, round(aw + 10, 1), 24, rx=4, stroke="#141719", sw=2) +
              rect(round(ax - aw - 7, 1), y + 8, round(aw + 14, 1), 28, rx=5, stroke="#fff", sw=2))
    return o


def mini_tip(x, y, text):
    w = tw(text, 12, "b w5") + 20
    return (f'<g filter="url(#pop)">{rect(x, y, round(w, 1), 26, "#fff", rx=6, stroke=BORDER)}</g>' +
            f'<path d="M{x+18} {y+0.5} L{x+24} {y-6} L{x+30} {y+0.5}" fill="#fff" stroke="{BORDER}" stroke-width="1"/>'
            f'<rect x="{x+18.5}" y="{y}" width="11" height="1.5" fill="#fff"/>' + t(x + 10, y + 17.5, text, 12, INK, "b w5"))


def cell(row, ci, x, cy):
    """Returns svg for a row/state cell; x = left of cell content, cy = row centre."""
    st = ["default", "hover", "focus", "pressed", "disabled", "error"][ci]
    if row == "key":
        if st == "disabled":
            return key_entry(x, cy, "E", "Empty (open slot)", False)[0] + t(x + 6, cy + 30, "Plain text, not a button", 11.5, INK3, "b w5")
        if st == "error":
            return na(x, cy)
        s, w = key_entry(x, cy, "S", "Slow-moving", True, "open" if st == "pressed" else st)
        if st == "hover":
            s += cursor(x + w - 30, cy + 2)
        if st == "pressed":
            s += t(x + 6, cy + 30, "Popover open above", 11.5, INK3, "b w5")
        return s
    if row == "swatch":
        m = {"default": "default", "hover": "hover", "focus": "focus", "pressed": "current"}
        if st in m:
            s = swatch(x + 22, cy, state=m[st])
            if st == "pressed":
                s += t(x + 48, cy + 4.5, "Current", 12, INK3, "b w5")
            return s
        return na(x, cy)
    if row == "hex":
        if st in ("pressed", "disabled"):
            return na(x, cy)
        if st == "error":
            return (hexfield(x, cy - 30, "#41DDC", "error") + t(x, cy + 19, "Enter a colour", 12, INK) +
                    t(x, cy + 33, "as #RRGGBB", 12, INK))
        return hexfield(x, cy - 16, "#417DDC", st)
    if row in ("primary", "secondary", "tertiary", "destructive"):
        lab, ic = {"primary": ("Done", None), "secondary": ("Apply all (15)", "i-check"),
                   "tertiary": ("Undo last move", "i-undo"), "destructive": ("Delete plan", None)}[row]
        if st == "error" or (row == "destructive" and st == "disabled"):
            return na(x, cy, "—" if st == "error" else "Never disabled")
        if st == "disabled":
            if row == "secondary":
                lab = "Apply all (0)"
            s, w = btn(x, cy - 18, lab, "tertiary" if row != "primary" else "primary", "disabled", icon_name=ic)
            if row == "tertiary":
                s += mini_tip(x, cy + 26, "No moves to undo")
            return s
        s, w = btn(x, cy - 18, lab, row, st, icon_name=ic)
        if st in ("hover", "pressed"):
            s += cursor(x + w - 22, cy + 2)
        return s
    if row == "link":
        if st in ("default", "hover", "focus"):
            s, w = btn(x, cy - 18, "Keep in place", "link", st, w=104)
            if st == "hover":
                s += cursor(x + 84, cy + 2)
            return s
        return na(x, cy)
    if row == "toast":
        if st in ("default", "hover", "focus"):
            return toast_end(x, cy - 22, st)
        return na(x, cy)
    return ""


ROWS = [("key", "Key entry", "Slow-moving; on paper", 66),
        ("swatch", "Preset swatch", "22px, 24px hit area", 58),
        ("hex", "Hex field", "104 × 32", 76),
        ("primary", "Primary button", "Done, Apply 15", 54),
        ("secondary", "Secondary button", "Apply all (n)", 54),
        ("tertiary", "Tertiary button", "Undo last move, Cancel", 82),
        ("link", "Link button", "Keep in place", 50),
        ("destructive", "Destructive button", "Delete plan; ink, never red", 54),
        ("toast", "Toast action", "On the ink strip", 60)]


def make():
    o = []
    o.append(sheet_header("COMPONENTS · SHEET 1 OF 2 · STATES", "Colours and feedback",
                          ["Every interactive piece in every state it can be in, at real size.",
                           "Read across for states, down for components. “—” means the state does not exist."],
                          ["Smart Warehouse Planner · Bin Wall", "Synthetic demo data", "DESIGN.md and EXPERIENCE.md win on conflict"]))

    # ---------------------------------------------------------------- 01 matrix
    y = 290
    o.append(section_title(72, y, "01", "Controls × states"))
    hy = y + 44
    o.append(rect(72, hy, 1296, 36, BAND, rx=4))
    o.append(t(88, hy + 23, "Component", 12.5, INK2, "b w6"))
    for i, (name, prop) in enumerate(COLS):
        cx = CX0 + i * CW
        o.append(t(cx + 8, hy + 23, name, 12.5, INK, "b w6"))
        if prop:
            o.append(rect(round(cx + 14 + tw(name, 12.5, "b w6"), 1), hy + 10, 62, 17, "#fff", rx=8.5, stroke=INK3, sw=1) +
                     t(round(cx + 45 + tw(name, 12.5, "b w6"), 1), hy + 22.5, "proposed", 10.5, INK2, "b w6", "middle"))
    ry = hy + 36
    for key, name, sub, h in ROWS:
        o.append(rect(72, ry + h, 1296, 1, HAIR))
        cy = ry + h / 2 if key not in ("tertiary", "key") else ry + 28
        o.append(t(88, cy - 2, name, 14, INK, "b w6"))
        o.append(t(88, cy + 16, sub, 12, INK2))
        for ci in range(6):
            o.append(cell(key, ci, CX0 + ci * CW + 8, cy))
        ry += h
    for i in range(7):
        o.append(rect(CX0 + i * CW - 0.5, hy + 36, 1, ry - hy - 36, HAIR))
    o.append(t(72, ry + 28, "Proposed: hover and pressed colours are not in DESIGN.md yet (primary hover #363C42, pressed #000; outlined hover = ground, pressed = band).", 12.5, INK2))
    o.append(t(72, ry + 46, "Focus is the fixed ring everywhere: white gap + ink ring on paper, dark + white on the ink toast. Disabled stays focusable and says why.", 12.5, INK2))
    y = ry + 104

    # ---------------------------------------------------------------- 02 popover states
    o.append(section_title(72, y, "02", "Colour popover × states", "264 wide · opens above its Key entry · checks show only when one fails"))
    py = y + 86
    specs = [
        ("Open, nothing to warn", "Focus starts on the current shade", dict(entry="F", current=CLS["F"], focus="preset")),
        ("Contrast below 3:1", "Dead stock typed as #555B61", dict(entry="D", current="#555B61",
                                                                    warning=["Dead stock on the wall: 1.8:1,", "on an open slot: 2.6:1.", "3:1 or more recommended."])),
        ("Too alike (ΔE below 20)", "Slow-moving typed as #7F6FE8", dict(entry="S", current="#7F6FE8",
                                                                       warning=["Slow-moving and Selection look", "alike (ΔE 12). Bins and the",
                                                                                "selection frame may be hard", "to tell apart."])),
        ("Invalid hex", "Best location, typing", dict(entry="B", current=BEST, hexval="#3DAE6", hex_error=True, focus="hex")),
    ]
    maxh = 0
    for i, (cap, sub, kw) in enumerate(specs):
        px = 72 + i * 344
        o.append(t(px, y + 46, cap, 14, INK, "b w7"))
        o.append(t(px, y + 66, sub, 12.5, INK2))
        s, h = colour_popover(px, py, pointer_x=px + 132, **kw)
        o.append(s)
        maxh = max(maxh, h)
    y = py + maxh + 64

    # ---------------------------------------------------------------- 03 toasts | 04 confirm
    o.append(section_title(72, y, "03", "Toast variants"))
    o.append(section_title(744, y, "04", "Confirm variants"))
    ty = y + 40
    for cap, ic, lines, act, foc in (
            ("Applied a move: Undo", "i-check", ["Applied · move 16, round 1 · 4410281 G-14-04-02 → A-02-01-01"], "Undo", False),
            ("Marks changed: View, never Undo", "i-clock", ["Best-location marks changed · 3 recommendations are now outdated"], "View", False),
            ("No action", "i-check", ["Combined into one move: G-14-04-02 → A-02-01-01 (Manual)."], None, False),
            ("Long text wraps", "i-pin", ["4410281 is kept in place. Remove the mark from the part", "or the Kept in place tab."], None, False)):
        o.append(t(72, ty + 14, cap, 12.5, INK2, "b w5"))
        s, w_, h_ = toast(72, ty + 24, ic, lines, act, action_focus=foc)
        o.append(s)
        ty += 24 + h_ + 26
    left_end = ty
    # confirm
    cx = 744
    cy = y + 40
    o.append(t(cx, cy + 14, "Popover · Apply all (15)", 12.5, INK2, "b w5"))
    bw = btn_w("Apply all (15)", "i-check")
    o.append(btn(cx, cy + 26, "Apply all (15)", "secondary", "pressed", icon_name="i-check")[0])
    cp, ch = confirm_popover(cx, cy + 26 + 48, "Apply 15 recommendations from round 1?",
                             ["Undo reverses them one move at a time."], pointer_x=cx + 40)
    o.append(cp)
    dy = cy + 26 + 48 + ch + 28
    o.append(t(cx, dy, "Dialog · Delete… · Cancel has the focus", 12.5, INK2, "b w5"))
    sw, sh = 624, 216
    o.append(rect(cx, dy + 12, sw, sh, "url(#louvre2)", rx=6) + rect(cx, dy + 12, sw, sh, INK, rx=6, extra=' fill-opacity="0.45"'))
    dlg, dh = dialog(cx + 84, dy + 12 + (sh - 180) / 2, "Delete “Autumn re-slot”?",
                     ["The plan, its marks, moves and recommendations are deleted", "for everyone. There is no archive."])
    o.append(dlg)
    right_end = dy + 12 + sh + 20
    y = max(left_end, right_end) + 70

    # ---------------------------------------------------------------- 05 settings wide / narrow
    o.append(section_title(72, y, "05", "Settings × width", "read-only, FR-18 · no inputs, so its only states are layout"))
    o.append(t(72, y + 46, "1024px and wider", 14, INK, "b w7"))
    o.append(t(72, y + 66, "Label column and value column", 12.5, INK2))
    sp, sph = settings_page(72, y + 96, 640)
    o.append(sp)
    nx = 760
    o.append(t(nx, y + 46, "Below 1024px", 14, INK, "b w7"))
    o.append(t(nx, y + 66, "One column; nothing scrolls sideways", 12.5, INK2))
    sp2, sph2 = settings_page(nx, y + 96, 340, narrow=True)
    o.append(f'<clipPath id="narrowclip"><rect x="{nx-6}" y="{y+90}" width="352" height="{sph+6}"/></clipPath>')
    o.append(f'<g clip-path="url(#narrowclip)">{sp2}</g>')
    o.append(rect(nx - 6, y + 96 + sph - 90, 352, 90, "url(#fadeB)"))
    o.append(t(nx, y + 96 + sph + 4, "… continues: pick-group minimum, configuration note", 12.5, INK3, "b w5"))
    sph2 = sph
    # notes in the right column
    nx2, ny = 1148, y + 46
    o.append(t(nx2, ny, "Not on this page", 14, INK, "b w7"))
    notes = [("Colours.", ["They change only from", "the Key under a wall (02)."]),
             ("Inputs, Save or reset.", ["Values come from the", "configuration file."]),
             ("Today’s file values.", ["It shows what this plan", "was computed with."])]
    yy = ny + 30
    for head, lines in notes:
        o.append(rect(nx2, yy - 13, 3, 18 + 18 * len(lines), INK))
        o.append(t(nx2 + 14, yy, head, 13, INK, "b w6"))
        for j, ln in enumerate(lines):
            o.append(t(nx2 + 14, yy + 18 + 18 * j, ln, 12.5, INK2))
        yy += 26 + 18 * len(lines) + 16
    H = max(y + 96 + sph, y + 96 + sph2) + 64
    return svg("Smart Warehouse Planner — Components sheet 1, alternative C: State matrix",
               "State matrix of the Key entry, preset swatch, hex field, all button kinds and the toast action across default, hover, focus, pressed, disabled and error; the colour popover in four states; toast and confirm variants; Settings at wide and narrow widths. Real size, synthetic data.",
               "\n".join(o), h=round(H))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "C-state-matrix.svg")
    open(out, "w").write(make())
    print("wrote", out)
