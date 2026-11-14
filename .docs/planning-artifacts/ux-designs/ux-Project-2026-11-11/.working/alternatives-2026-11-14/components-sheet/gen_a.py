"""Alternative A: Spec sheet. Real-size components on paper with numbered anatomy pins,
measurement lines and a short parts list beside each. Usage: python3 gen_a.py [out.svg]"""
import os, sys
from common import *

DIM = "#B0462F"  # sheet-only annotation colour (not a UI token)


def parts_list(x, y, items, w=360, gap=40):
    o = []
    for i, (n, head, line) in enumerate(items):
        yy = y + i * gap
        o.append(pin(x + 10, yy - 4, n))
        o.append(t(x + 30, yy, head, 13.5, INK, "b w6"))
        if line:
            o.append(t(x + 30, yy + 17, line, 12.5, INK2))
    return "".join(o)


def slice_card(x, y, w, h, inner):
    """A slice of the popover: white with torn (dashed) top and bottom edges."""
    return (rect(x, y, w, h, "#fff") +
            f'<path d="M{x} {y} V{y+h} M{x+w} {y} V{y+h}" stroke="{BORDER}" stroke-width="1"/>'
            f'<path d="M{x} {y} H{x+w} M{x} {y+h} H{x+w}" stroke="{INK3}" stroke-width="1" stroke-dasharray="3 3"/>' + inner)


def make():
    o = []
    o.append(sheet_header("COMPONENTS · SHEET 1 OF 2 · SPEC", "Colours and feedback",
                          ["Key colour popover, read-only Settings, toasts, confirm popover and dialog, and the buttons they use.",
                           "Drawn at real size. Numbered pins name the parts; red-brown lines give sizes in CSS px."],
                          ["Smart Warehouse Planner · Bin Wall", "Synthetic demo data", "DESIGN.md and EXPERIENCE.md win on conflict"]))
    o.append(rect(72, 236, 1296, 1, BORDER))

    # ------------------------------------------------------------------ 01 Key + colour popover
    y = 296
    o.append(section_title(72, y, "01", "Key and colour popover", "FR-42 · the only place a colour changes"))
    # Key bar first (to know where Slow-moving sits)
    pre_svg, pre_h = colour_popover(0, 0, "S", "#4C9AE6")
    pop_y = y + 58
    key_cy = pop_y + pre_h + 9 + 2 + 13
    kb, kw, kpos = key_bar(72, key_cy, {"S": "open"})
    sx, sw_ = kpos["S"]
    pcx = sx + sw_ / 2
    px = round(pcx - 132)
    pop, ph = colour_popover(px, pop_y, "S", "#4C9AE6", pointer_x=pcx)
    o.append(dim_h(px, px + 264, pop_y - 14, "264"))
    o.append(pop)
    o.append(kb)
    # pins left / right of the popover
    hex_y = pop_y + 120 + 16
    btn_y = pop_y + ph - 52 + 18
    L = px - 34
    R = px + 264 + 34
    for n, yy, tx in ((1, pop_y + 25, px + 12), (2, pop_y + 58, px + 13), (3, pop_y + 88, px + 12),
                      (5, hex_y, px + 12), (7, btn_y, px + 12)):
        o.append(leader(L + 10, yy, tx, yy) + pin(L, yy, n))
    for n, yy, tx in ((4, pop_y + 73, px + 250), (6, hex_y, px + 252), (8, btn_y, px + 252)):
        o.append(leader(R - 10, yy, tx, yy) + pin(R, yy, n))
    o.append(leader(R - 10, pop_y + ph + 6, pcx + 7, pop_y + ph + 4) + pin(R, pop_y + ph + 6, 9))
    o.append(dim_v(L - 24, pop_y, pop_y + ph, f"{ph}", left=True))
    # Key caption
    o.append(t(72, key_cy + 34, "The Key sits under every wall. Six entries are buttons; Empty and 2 parts are plain text.", 12.5, INK2))
    # Key entry states: vertical list right of the popover
    ex = 650
    o.append(t(ex, y + 52, "Key entry states", 16, INK, LB))
    for i, (st, cap) in enumerate((("default", "Default"), ("hover", "Hover: tint, palette icon"),
                                   ("focus", "Focus: the fixed ring"), ("open", "Open: aria-expanded"))):
        ry = y + 92 + i * 44
        o.append(t(ex, ry + 4.5, cap, 12.5, INK2, "b w5"))
        o.append(key_entry(ex + 168, ry, "S", "Slow-moving", True, st)[0])
    sy = key_cy
    # parts list: three columns under the Key
    py = key_cy + 78
    cols = [[(1, "Title with the fixed glyph", "Names the entry, never a colour"),
             (2, "Eight presets of this hue", "22px on a 30px pitch; arrows preview live"),
             (3, "Current colour", "2px ink ring and a check")],
            [(4, "Default chip", "Default swatch and its hex"),
             (5, "Hex field", "104px; the guaranteed keyboard path"),
             (6, "Picker button", "Opens the browser’s own colour picker")],
            [(7, "Reset this colour", "Tertiary; this entry only, no reset-all"),
             (8, "Done", "Keeps the pick. Esc restores the old colour"),
             (9, "Pointer", "Above the Key entry; flips to stay in view")]]
    for ci, items in enumerate(cols):
        o.append(parts_list(72 + ci * 336, py, items, gap=42))
    sy = py + 3 * 42 - 70

    # checks column
    cx = 1104
    o.append(t(cx, y + 52, "Checks", 16, INK, LB))
    o.append(t(cx, y + 72, "Shown under the presets only when", 12.5, INK2))
    o.append(t(cx, y + 89, "one fails. The planner can keep it.", 12.5, INK2))
    cy = y + 112

    def warn_box(xx, yy, lines):
        hh = 16 + 16 * len(lines)
        s = rect(xx + 16, yy, 232, hh, ERR_T, rx=4) + icon("i-alert", xx + 23, yy + 8, 16, ERR)
        for i, ln in enumerate(lines):
            s += t(xx + 45, yy + 21 + 16 * i, ln, 12, INK)
        return s, hh

    for cap, lines in (("Contrast below 3:1", ["Slow-moving on the wall: 1.8:1,", "on an open slot: 2.6:1.",
                                               "3:1 or more recommended."]),
                       ("Too alike (ΔE below 20)", ["Slow-moving and Selection look", "alike (ΔE 12). Bins and the",
                                                    "selection frame may be hard", "to tell apart."])):
        o.append(t(cx, cy, cap, 12.5, INK, "b w6"))
        wb, hh = warn_box(cx, cy + 22, lines)
        o.append(slice_card(cx, cy + 10, 264, hh + 24, wb))
        cy += hh + 24 + 34
    # invalid hex
    o.append(t(cx, cy, "Invalid hex", 12.5, INK, "b w6"))
    inner = (t(cx + 16, cy + 43, "Hex", 13, INK, "b w6") +
             rect(cx + 50, cy + 22, 104, 32, "#fff", rx=6, stroke=ERR, sw=1.5) + t(cx + 61, cy + 43, "#41DDC", 13.5, INK, LB) +
             icon("i-alert", cx + 16, cy + 62, 16, ERR) + t(cx + 38, cy + 75, "Enter a colour as #RRGGBB", 12, INK))
    o.append(slice_card(cx, cy + 10, 264, 80, inner))
    cy += 80 + 34
    o.append(t(cx, cy, "Browser storage blocked", 12.5, INK, "b w6"))
    inner = (icon("i-info", cx + 16, cy + 21, 15, INK2) +
             t(cx + 37, cy + 33, "Colours can’t be kept in this browser;", 12, INK2) +
             t(cx + 37, cy + 49, "changes last until you close this tab.", 12, INK2))
    o.append(slice_card(cx, cy + 10, 264, 52, inner))
    cy += 52 + 10

    s1_end = max(cy, sy + 80)

    # ------------------------------------------------------------------ 02 Toasts (left) / 03 Confirm (right)
    y = s1_end + 70
    o.append(rect(72, y - 50, 1296, 1, BORDER))
    o.append(section_title(72, y, "02", "Toast"))
    ty = y + 66
    ts, twid, th = toast(72, ty, "i-check", ["Applied · move 16, round 1 · 4410281 G-14-04-02 → A-02-01-01"], "Undo")
    o.append(ts)
    # pins above
    for n, xx in ((1, 72 + 23), (2, 72 + 160), (3, 72 + twid - 30)):
        o.append(leader(xx, ty - 22, xx, ty + 8, INK) + pin(xx, ty - 30, n))
    o.append(dim_v(72 + twid + 12, ty, ty + 44, "44"))
    o.append(dim_h(72, 72 + 560, ty + 70, "560 max · 24 from the bottom-left corner", above=True))
    o.append(rect(72 + 560, ty - 4, 1, 52, DIM, extra=' stroke-dasharray="2 2"'))
    o.append(parts_list(72, ty + 112, [
        (1, "Icon, 18px on-dark", "Check for a move, clock for outdated, pin for keep in place"),
        (2, "One sentence, 13px / 500 white", "Names what happened, with codes"),
        (3, "At most one action, underlined", "Undo only when Undo last move would reverse exactly this"),
    ], gap=40))
    vy = ty + 250
    o.append(t(72, vy, "Variants", 16, INK, LB))
    vy += 18
    for cap, ic, lines, act in (
            ("Marks changed: never Undo, View opens the Outdated tab", "i-clock",
             ["Best-location marks changed · 3 recommendations are now outdated"], "View"),
            ("No action", "i-check", ["Plan reset. 18 moves removed; marks kept. The next run is round 1."], None),
            ("Two lines when the text is long", "i-pin",
             ["4410281 is kept in place. Remove the mark from the part", "or the Kept in place tab."], None)):
        o.append(t(72, vy + 14, cap, 12.5, INK2, "b w5"))
        s, w_, h_ = toast(72, vy + 24, ic, lines, act)
        o.append(s)
        vy += 24 + h_ + 22
    left_end = vy

    # 03 Confirm (right column)
    rx = 744
    o.append(section_title(rx, y, "03", "Confirm popover and dialog"))
    by = y + 48
    bw = btn_w("Apply all (15)", "i-check")
    o.append(btn(rx, by, "Apply all (15)", "secondary", "pressed", icon_name="i-check")[0])
    o.append(t(rx + bw + 16, by + 23, "Secondary trigger, pressed while the popover is open", 12.5, INK3))
    cp, ch = confirm_popover(rx, by + 48, "Apply 15 recommendations from round 1?",
                             ["Undo reverses them one move at a time."], pointer_x=rx + 40)
    o.append(cp)
    RR = rx + 352 + 34
    for n, yy, tx in ((1, by + 48 + 28, rx + 340), (2, by + 48 + ch - 34, rx + 352 - 15)):
        o.append(leader(RR - 10, yy, tx, yy) + pin(RR, yy, n))
    o.append(parts_list(RR + 28, by + 48 + 28, [
        (1, "Question in body-strong", "14px / 600; the count and round"),
        (2, "Cancel, then the action", "1px border, a pointer"),
    ], gap=44))
    # dialog over scrim
    dy = by + 48 + ch + 46
    o.append(t(rx, dy, "Dialog over the scrim", 12.5, INK2, "b w5"))
    sw = 624
    sh = 236
    o.append(rect(rx, dy + 12, sw, sh, "url(#louvre2)", rx=6))
    o.append(rect(rx, dy + 12, sw, sh, INK, rx=6, extra=' fill-opacity="0.45"'))
    dlg, dh = dialog(rx + 48, dy + 12 + (sh - 180) / 2 - 2, "Delete “Autumn re-slot”?",
                     ["The plan, its marks, moves and recommendations are deleted", "for everyone. There is no archive."])
    o.append(dlg)
    d_x, d_y = rx + 48, dy + 12 + (sh - 180) / 2 - 2
    o.append(dim_h(d_x, d_x + 456, dy + 12 + sh + 18, "456 · radius 8 · padding 24", above=False))
    for n, xx, yy, tx, ty2 in ((1, rx + sw - 24, d_y + 36, d_x + 456 - 30, d_y + 36),):
        pass
    o.append(pin(d_x - 24, d_y + 36, 3) + leader(d_x - 14, d_y + 36, d_x + 16, d_y + 36))
    o.append(pin(d_x + 456 + 24, d_y + dh - 42, 4) + leader(d_x + 456 + 14, d_y + dh - 42, d_x + 456 - 20, d_y + dh - 42))
    o.append(parts_list(rx, dy + sh + 68, [
        (3, "Title, 20px Barlow bold", "Names the plan in quotes"),
        (4, "Cancel has the default focus; Delete plan is ink", "Destructive is never red: red is a class colour on the wall"),
    ], gap=44))
    right_end = dy + sh + 68 + 44 + 20

    # ------------------------------------------------------------------ 04 Settings (left) / 05 Buttons (right)
    y = max(left_end, right_end) + 64
    o.append(rect(72, y - 50, 1296, 1, BORDER))
    o.append(section_title(72, y, "04", "Settings", "read-only, FR-18"))
    sp, sph = settings_page(72, y + 36, 624)
    o.append(sp)
    # pins on settings (left margin)
    o.append(pin(72 + 624 - 112, y + 36 + 19, 1))
    o.append(pin(50, y + 36 + 78 + 74 + 72 + 40, 2) + leader(60, y + 36 + 78 + 74 + 72 + 40, 74, y + 36 + 78 + 74 + 72 + 40))
    o.append(pin(50, y + 36 + sph - 30, 3) + leader(60, y + 36 + sph - 30, 74, y + 36 + sph - 30))
    o.append(parts_list(72, y + 36 + sph + 40, [
        (1, "Read-only tag", "No inputs anywhere on the page"),
        (2, "Class limits as one ruler", "Each class drawn as its bin, low to high")], gap=42))
    o.append(parts_list(380, y + 36 + sph + 40, [
        (3, "Where values change", "The config file; each plan keeps its own"),
        ("!", "Colours are not settings", "They change only from the Key (01)")], gap=42))
    left_end = y + 36 + sph + 40 + 84

    bx = 760
    o.append(section_title(bx, y, "05", "Buttons", "36px high · radius 6 · 13px / 600"))
    rows = [("primary", "Run recommendations", None, "Primary", "Ink fill. One per surface."),
            ("secondary", "Apply all (15)", "i-check", "Secondary", "1px ink outline. Repeatable commits."),
            ("tertiary", "Undo last move", "i-undo", "Tertiary", "1px border outline. Reversible, navigational."),
            ("link", "Keep in place", None, "Link", "Underlined ink. Low-commitment verbs."),
            ("destructive", "Delete plan", None, "Destructive", "Looks like primary; label names the loss."),
            ("disabled", "Undo last move", "i-undo", "Disabled", "Pale fill, grey text; still focusable.")]
    ry = y + 40
    for kind, lab, ic, name, note in rows:
        o.append(t(bx, ry + 23, name, 13, INK, "b w6"))
        if kind == "disabled":
            s, w_ = btn(bx + 110, ry, lab, "tertiary", "disabled", icon_name=ic)
        else:
            s, w_ = btn(bx + 110, ry, lab, kind, icon_name=ic)
        o.append(s)
        o.append(t(bx + 330, ry + 23, note, 12.5, INK2))
        o.append(rect(bx, ry + 48, 608, 1, HAIR))
        ry += 56
    o.append(dim_v(bx + 110 - 12, y + 40, y + 76, "36", left=True))
    # focus ring detail x3
    fy = ry + 34
    o.append(t(bx, fy, "Focus ring, ×3 detail", 16, INK, LB))
    o.append(t(bx, fy + 20, "Fixed. Never follows a changed Key colour.", 12.5, INK2))
    # paper
    gx, gy = bx, fy + 44
    o.append(t(gx, gy + 12, "On paper", 12.5, INK, "b w6"))
    z = 3
    ex, ey = gx + 24, gy + 34
    o.append(rect(ex - 4 * z, ey - 4 * z, 150 + 8 * z, 54 + 8 * z, INK, rx=(6 + 4) * z / 2))
    o.append(rect(ex - 2 * z, ey - 2 * z, 150 + 4 * z, 54 + 4 * z, "#fff", rx=(6 + 2) * z / 2))
    o.append(rect(ex, ey, 150, 54, "#fff", rx=9, stroke=BORDER, sw=1.5))
    o.append(t(ex + 75, ey + 34, "Cancel", 19, INK, "b w6", "middle"))
    o.append(t(ex + 150 + 30, ey + 10, "2 white gap", 12, DIM, "lb w6"))
    o.append(t(ex + 150 + 30, ey + 26, "2 ink ring", 12, DIM, "lb w6"))
    # graphite
    gx2 = bx + 320
    o.append(t(gx2, gy + 12, "On graphite", 12.5, INK, "b w6"))
    o.append(rect(gx2, gy + 22, 270, 82, "url(#louvre2)", rx=6))
    ex2, ey2 = gx2 + 40, gy + 38
    o.append(rect(ex2 - 4 * z / 1.5, ey2 - 4 * z / 1.5, 54 + 8 * z / 1.5, 58 + 8 * z / 1.5, "#fff", rx=8))
    o.append(rect(ex2 - 2 * z / 1.5, ey2 - 2 * z / 1.5, 54 + 4 * z / 1.5, 58 + 4 * z / 1.5, SLOT, rx=6))
    o.append(bin_rt(ex2, ey2, "F", w=54, h=58))
    o.append(t(ex2 + 90, ey2 + 22, "2 dark inner", 12, "#fff", "lb w6"))
    o.append(t(ex2 + 90, ey2 + 38, "2 white outer", 12, "#fff", "lb w6"))
    right_end = gy + 120

    H = max(left_end, right_end) + 56
    return svg("Smart Warehouse Planner — Components sheet 1, alternative A: Spec sheet",
               "Spec sheet of the Key colour popover with numbered parts, measurements and its checks; Key entry states; toast anatomy and variants; Apply all confirm popover and Delete plan dialog; read-only Settings with class limits drawn as a ruler; buttons and the fixed focus ring. Real size, synthetic data.",
               "\n".join(o), h=round(H))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "A-spec-sheet.svg")
    open(out, "w").write(make())
    print("wrote", out)
