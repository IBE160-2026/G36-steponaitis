"""Alternative B: In context. Each component at real size on the screen that opens it; the app behind
is faded, the component and what it changes stay at full strength. Usage: python3 gen_b.py [out.svg]"""
import os, sys
from common import *

FADE = 0.32
_clip = [0]


def frame_open(x, y, w, h):
    _clip[0] += 1
    cid = f"fr{_clip[0]}"
    return (f'<clipPath id="{cid}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/></clipPath>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{GROUND}"/>'
            f'<g clip-path="url(#{cid})">')


def frame_close(x, y, w, h):
    return f'</g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" stroke="{INK3}" stroke-width="1"/>'


def faded(s):
    return f'<g opacity="{FADE}">{s}</g>'


def note_tag(x, y, text, tx=None, ty=None, anchor="start"):
    """Ink tag with white text; optional leader to (tx, ty)."""
    w = tw(text, 12, "b w6") + 20
    x0 = x - w if anchor == "end" else x
    o = ""
    if tx is not None:
        sx = x0 + w / 2 if ty is None else (x0 if tx < x0 else x0 + w)
        sx = min(max(tx, x0 + 10), x0 + w - 10) if abs(ty - y) > 30 else (x0 if tx < x0 else x0 + w)
        sy = y + 12 if abs(ty - y) <= 30 else (y + 24 if ty > y else y)
        o += (f'<path d="M{sx:.1f} {sy} L{tx} {ty}" stroke="{INK}" stroke-width="1.2"/>'
              f'<circle cx="{tx}" cy="{ty}" r="3" fill="{INK}" stroke="#fff" stroke-width="1.2"/>')
    o += rect(round(x0, 1), y, round(w, 1), 24, INK, rx=4) + t(round(x0 + 10, 1), y + 16.5, text, 12, "#fff", "b w6")
    return o


def beats(x, y, items, colw=432):
    o = []
    for i, (a, b) in enumerate(items):
        bx = x + i * colw
        o.append(f'<circle cx="{bx+14}" cy="{y+10}" r="14" fill="{INK}"/>' + t(bx + 14, y + 15, str(i + 1), 14, "#fff", LB, "middle"))
        o.append(t(bx + 40, y + 9, a, 15, INK, "b w7"))
        o.append(t(bx + 40, y + 29, b, 13, INK2))
    return "".join(o)


def caption(x, y, a, b):
    return rect(x, y - 6, 3, 40, INK) + t(x + 16, y + 9, a, 15, INK, "b w7") + t(x + 16, y + 29, b, 13, INK2)


def loc_chip(x, y, code, best=False):
    w = tw(code, 13.5, LB) + 16 + (12 if best else 0)
    s = rect(x, y, round(w, 1), 24, "#fff", rx=2, stroke=INK) + t(x + 8, y + 17, code, 13.5, INK, LB)
    if best:
        s += icon("i-ribbon", round(x + w - 17, 1), y + 5, 13, INK)
    return s, w


def rec_row(x, y, w, rank, c, part, desc, frm, to, applied=False):
    o = [rect(x, y, w, 58, "#fff"), rect(x, y + 58, w, 1, HAIR)]
    o.append(t(x + 14, y + 27, f"#{rank}", 20, INK, LB) + t(x + 14, y + 44, "of 9", 11.5, INK2, "b w5"))
    o.append(bin_rt(x + 58, y + 14, c, w=26, h=30))
    o.append(t(x + 96, y + 26, part, 16, INK, LB) + t(x + 96, y + 44, desc, 12.5, INK2))
    cx = x + 222
    s, cw = loc_chip(cx, y + 17, frm)
    o.append(s + icon("i-arrow-r", round(cx + cw + 6, 1), y + 21, 16, INK))
    s, cw2 = loc_chip(round(cx + cw + 28, 1), y + 17, to, best=True)
    o.append(s)
    ax = cx + cw + 28 + cw2 + 18
    if applied:
        o.append(icon("i-check", round(ax, 1), y + 13, 16, INK) + t(round(ax + 22, 1), y + 26, "Applied · move 16", 12.5, INK, "b w6"))
        o.append(t(round(ax + 22, 1), y + 43, "Round 1, planning copy", 12, INK2))
    else:
        o.append(btn(round(ax, 1), y + 11, "Apply", "secondary", w=62)[0])
        o.append(btn(round(ax + 66, 1), y + 11, "Keep in place", "link", w=100)[0])
    return "".join(o)


def make():
    o = []
    o.append(sheet_header("COMPONENTS · SHEET 1 OF 2 · IN CONTEXT", "Colours and feedback",
                          ["Each component at real size, on the screen where it opens. The app behind it is faded;",
                           "what the component changes stays at full strength."],
                          ["Smart Warehouse Planner · Bin Wall", "Synthetic demo data", "DESIGN.md and EXPERIENCE.md win on conflict"]))

    # ------------------------------------------------------------------ 01 Key colour popover on the wall
    y = 286
    o.append(section_title(72, y, "01", "Change a colour from the Key", "Locations · FR-42 · the only place a colour changes"))
    fx, fy, fw = 72, y + 28, 1296
    import random
    rnd = random.Random(14)
    grid = ["".join(rnd.choices("FMSD.", weights=(22, 25, 27, 12, 14))[0] for _ in range(36)) for _ in range(4)]
    wall_y = fy + 64 + 78
    preview = "#5EB5E9"
    ws, WW, WH, cells = wall_rt(fx + 24, wall_y, grid, colors={"S": preview})
    key_cy = wall_y + WH + 30
    fh = key_cy + 34 - fy
    o.append(frame_open(fx, fy, fw, fh))
    app = [toolbar_strip(fx, fy, fw, step="Locations")]
    app.append(rect(fx + 24, fy + 64 + 18, 46, 46, "#fff", rx=3, stroke=INK, sw=1.5) + rect(fx + 24, fy + 64 + 18, 46, 7, INK))
    app.append(t(fx + 47, fy + 64 + 56, "A", 28, INK, LB, "middle"))
    app.append(t(fx + 84, fy + 64 + 38, "Aisle A", 22, INK, LB))
    app.append(t(fx + 84, fy + 64 + 60, "86.8% occupied · 198 of 228 locations · 30 empty · 117 best locations (3 empty) · Walk Path 0–2,270", 13, INK2, "b w5"))
    o.append(faded("".join(app)))
    o.append(ws)
    kb, kw, kpos = key_bar(fx + 24, key_cy, {"S": "open"}, colors={"S": preview})
    o.append(kb)
    sx, sw_ = kpos["S"]
    pcx = sx + sw_ / 2
    pop, ph = colour_popover(round(pcx - 110), 0, "S", preview, pointer_x=pcx)
    pop_y = key_cy - 13 - 2 - 9 - ph
    pop, ph = colour_popover(round(pcx - 110), pop_y, "S", preview, pointer_x=pcx, focus="preset")
    o.append(pop)
    o.append(frame_close(fx, fy, fw, fh))
    # annotations
    sc = max(ci for ci in range(36) if grid[0][ci] == "S")
    bx, by = cells[(0, sc)]
    o.append(note_tag(fx + fw - 24, fy + 64 + 30 + 2, "Slow-moving bins preview shade 2 of 8 live", bx + 13, by + 4, anchor="end"))
    px0 = round(pcx - 110)
    o.append(note_tag(fx + 24 + kw + 40, key_cy - 12, "Not buttons: Empty, 2 parts", fx + 24 + kw + 4, key_cy))
    o.append(beats(72, fy + fh + 38, [
        ("Click Slow-moving in the Key", "Or Enter / Space on it. The popover opens above."),
        ("Try shades on the real wall", "Arrow keys preview each preset live behind it."),
        ("Done keeps it, Esc puts it back", "A click outside keeps it. Focus returns to the Key."),
    ]))
    y = fy + fh + 38 + 60

    # warnings strip
    o.append(t(72, y + 18, "When a check fails", 16, INK, LB))
    o.append(t(72, y + 38, "The line appears under the presets; the colour can be kept.", 12.5, INK2))
    frags = [["Slow-moving on the wall: 1.8:1,", "on an open slot: 2.6:1.", "3:1 or more recommended."],
             ["Slow-moving and Selection look", "alike (ΔE 12). Bins and the", "selection frame may be hard", "to tell apart."]]
    for i, lines in enumerate(frags):
        xx = 480 + i * 296
        hh = 16 + 16 * len(lines)
        o.append(rect(xx, y - 8, 232, hh, ERR_T, rx=4) + icon("i-alert", xx + 7, y, 16, ERR))
        for j, ln in enumerate(lines):
            o.append(t(xx + 29, y + 13 + 16 * j, ln, 12, INK))
    xx = 480 + 2 * 296
    o.append(t(xx, y + 13, "Hex", 13, INK, "b w6") + rect(xx + 34, y - 8, 104, 32, "#fff", rx=6, stroke=ERR, sw=1.5) +
             t(xx + 45, y + 13, "#41DDC", 13.5, INK, LB) + icon("i-alert", xx, y + 34, 16, ERR) +
             t(xx + 22, y + 47, "Enter a colour as #RRGGBB", 12, INK))
    y += 80 + 60

    # ------------------------------------------------------------------ 02 Apply all popover  |  03 Delete dialog
    o.append(section_title(72, y, "02", "Apply all asks first", "Recommendations"))
    o.append(section_title(736, y, "03", "Delete asks in a dialog", "Saved plans"))
    fy = y + 28
    fh = 316
    # 02
    fx, fw = 72, 632
    o.append(frame_open(fx, fy, fw, fh))
    app = [t(fx + 24, fy + 44, "Recommendations", 28, INK, LB)]
    app.append(rect(fx + 248, fy + 22, 82, 28, "#fff", rx=3, stroke=INK, sw=1.2) + rect(fx + 248, fy + 22, 5, 28, INK) +
               t(fx + 262, fy + 41, "Round 1", 14, INK, LB))
    rbw = btn_w("Run recommendations")
    app.append(btn(fx + 24, fy + 66, "Run recommendations", "primary", w=rbw)[0])
    ax = fx + 24 + rbw + 10
    aw = btn_w("Apply all (15)", "i-check")
    uw = btn_w("Undo last move", "i-undo")
    app.append(btn(ax + aw + 10, fy + 66, "Undo last move", "tertiary", icon_name="i-undo", w=uw)[0])
    app.append(btn(ax + aw + 10 + uw + 10, fy + 66, "Reset…", "tertiary")[0])
    app.append(t(fx + 24, fy + 138, "All 19", 13.5, INK, "b w6") + rect(fx + 24, fy + 146, 44, 3, INK) +
               t(fx + 88, fy + 138, "Rule 1  9", 13.5, INK2, "b w5") + t(fx + 168, fy + 138, "Rule 2  6", 13.5, INK2, "b w5") +
               t(fx + 248, fy + 138, "No space  31", 13.5, INK2, "b w5"))
    app.append(rect(fx, fy + 158, fw, 34, BAND) + rect(fx + 14, fy + 165, 52, 20, INK, rx=3) +
               t(fx + 40, fy + 179, "Rule 1", 12, "#fff", LB, "middle") + t(fx + 78, fy + 180, "Fast-moving parts into best locations", 13, INK, "b w7"))
    app.append(rec_row(fx, fy + 192, fw, 1, "F", "4410281", "Brake pads, front", "G-14-04-02", "A-02-01-01"))
    app.append(rec_row(fx, fy + 251, fw, 2, "F", "5520114", "Oil filter", "C-03-03-01", "A-02-01-02"))
    o.append(faded("".join(app)))
    o.append(btn(ax, fy + 66, "Apply all (15)", "secondary", "pressed", icon_name="i-check", w=aw)[0])
    cp, ch = confirm_popover(ax - 20, fy + 66 + 36 + 12, "Apply 15 recommendations from round 1?",
                             ["Undo reverses them one move at a time."], pointer_x=ax + 30)
    o.append(cp)
    o.append(frame_close(fx, fy, fw, fh))
    # 03
    fx = 736
    o.append(frame_open(fx, fy, fw, fh))
    app = [t(fx + 24, fy + 44, "Saved plans", 28, INK, LB)]
    app.append(btn(fx + fw - 24 - 120, fy + 20, "New Plan", "primary", icon_name="i-plus", w=120)[0])
    app.append(rect(fx + 24, fy + 70, fw - 48, 30, BAND))
    for name, dx in (("Plan", 12), ("Data as of", 230), ("Round", 350), ("Changed", 430)):
        app.append(t(fx + 24 + dx, fy + 90, name, 11.5, INK2, "b w6"))
    for i, (pl, d, r, ch_) in enumerate((("Spring re-slot 2026", "2026-09-30", "1", "Today 10:05"),
                                          ("Autumn re-slot", "2026-03-31", "3", "2026-04-12"),
                                          ("Test import March", "2026-03-31", "0", "2026-04-02"))):
        ry = fy + 100 + i * 52
        app.append(rect(fx + 24, ry, fw - 48, 52, "#fff") + rect(fx + 24, ry + 52, fw - 48, 1, HAIR))
        app.append(t(fx + 36, ry + 32, pl, 16, INK, LB) + t(fx + 254, ry + 32, d, 13.5, INK, LB) +
                   t(fx + 374, ry + 32, r, 13.5, INK, LB) + t(fx + 454, ry + 32, ch_, 13, INK2))
        app.append(icon("i-dots", fx + fw - 58, ry + 17, 18, INK))
    o.append(faded("".join(app)))
    o.append(rect(fx, fy, fw, fh, INK, extra=' fill-opacity="0.45"'))
    dlg, dh = dialog(fx + (fw - 456) / 2, fy + 0, "Delete “Autumn re-slot”?",
                     ["The plan, its marks, moves and recommendations are deleted", "for everyone. There is no archive."])
    dlg, dh = dialog(fx + (fw - 456) / 2, fy + (fh - 180) / 2, "Delete “Autumn re-slot”?",
                     ["The plan, its marks, moves and recommendations are deleted", "for everyone. There is no archive."])
    o.append(dlg)
    o.append(frame_close(fx, fy, fw, fh))
    by = fy + fh + 36
    o.append(caption(72, by, "Cancel, then the action", "Apply 15 is primary; the trigger stays pressed while it is open."))
    o.append(caption(736, by, "Cancel has the focus", "Delete plan is ink, never red. Behind it: ink scrim at 45%."))
    y = by + 60 + 70

    # ------------------------------------------------------------------ 04 Toasts | 05 Settings
    o.append(section_title(72, y, "04", "Toasts say what happened", "bottom-left, 24px in"))
    o.append(section_title(736, y, "05", "Settings is read-only", "launcher SET · FR-18"))
    fy = y + 28
    # Settings frame first (sets the row height)
    fx = 736
    sp_probe, sph = settings_page(0, 0, 584, lab=150)
    fh5 = 64 + 28 + sph + 28
    o.append(frame_open(fx, fy, fw, fh5))
    o.append(faded(toolbar_strip(fx, fy, fw + 400, step=None)))
    sp, sph = settings_page(fx + 24, fy + 64 + 28, 584, lab=150)
    o.append(sp)
    o.append(frame_close(fx, fy, fw, fh5))
    o.append(note_tag(fx + fw - 24, fy + fh5 + 18, "Colours are not settings: they change only from the Key (01)", anchor="end"))
    # toast frame
    fx = 72
    fh4 = 360
    o.append(frame_open(fx, fy, fw, fh4))
    app = [rect(fx, fy, fw, 34, BAND) + rect(fx + 14, fy + 7, 52, 20, INK, rx=3) +
           t(fx + 40, fy + 21, "Rule 1", 12, "#fff", LB, "middle") + t(fx + 78, fy + 22, "Fast-moving parts into best locations", 13, INK, "b w7")]
    app.append(rec_row(fx, fy + 93, fw, 2, "F", "5520114", "Oil filter", "C-03-03-01", "A-02-01-02"))
    app.append(rec_row(fx, fy + 152, fw, 3, "F", "3301877", "Wiper blade set", "B-07-04-03", "A-03-02-01"))
    app.append(rec_row(fx, fy + 211, fw, 4, "F", "6612040", "Air filter", "D-11-04-01", "A-03-02-02"))
    o.append(faded("".join(app)))
    o.append(rec_row(fx, fy + 34, fw, 1, "F", "4410281", "Brake pads, front", "G-14-04-02", "A-02-01-01", applied=True))
    ts, tw1, th1 = toast(fx + 24, fy + fh4 - 24 - 44, "i-check", ["Applied · move 16, round 1 · 4410281 G-14-04-02 → A-02-01-01"], "Undo")
    o.append(ts)
    o.append(f'<path d="M{fx} {fy+fh4-24} h24 M{fx+24} {fy+fh4} v-24" stroke="#B0462F" stroke-width="1" stroke-dasharray="2 2"/>')
    o.append(frame_close(fx, fy, fw, fh4))
    vy = fy + fh4 + 34
    o.append(t(72, vy, "Undo only when Undo last move would reverse exactly this move. Other toasts:", 13, INK2))
    vy += 16
    for ic, lines, act, cap in (("i-clock", ["Best-location marks changed · 3 recommendations are now outdated"], "View", "Marks changed: View, never Undo"),
                                ("i-check", ["Plan reset. 18 moves removed; marks kept. The next run is round 1."], None, "No action"),
                                ("i-pin", ["4410281 is kept in place. Remove the mark from the part", "or the Kept in place tab."], None, "Long text wraps")):
        s, w_, h_ = toast(72, vy, ic, lines, act)
        o.append(s)
        vy += h_ + 14
    left_end = vy
    right_end = fy + fh5 + 50
    y = max(left_end, right_end) + 60

    # ------------------------------------------------------------------ 06 buttons used above
    o.append(section_title(72, y, "06", "Buttons used above", "36px · radius 6 · 13px / 600 · one primary per surface"))
    y += 36
    items = [("primary", "Done", None, "Primary", "Done, Apply 15"),
             ("secondary", "Apply all (15)", "i-check", "Secondary", "Apply all, Apply"),
             ("tertiary", "Reset this colour", None, "Tertiary", "Cancel, Undo last move"),
             ("link", "Keep in place", None, "Link", "Keep in place"),
             ("destructive", "Delete plan", None, "Destructive", "Ink, never red"),
             ("disabled", "Undo last move", "i-undo", "Disabled", "Reason on hover, focus")]
    bx = 72
    for kind, lab, ic, name, used in items:
        if kind == "disabled":
            s, w_ = btn(bx, y + 12, lab, "tertiary", "disabled", icon_name=ic)
        else:
            s, w_ = btn(bx, y + 12, lab, kind, icon_name=ic)
        o.append(s)
        o.append(t(bx, y + 72, name, 13, INK, "b w6"))
        o.append(t(bx, y + 90, used, 12, INK2))
        bx += max(w_, tw(used, 12)) + 44
    s, w_ = btn(bx, y + 12, "Cancel", "tertiary", "focus")
    o.append(s + t(bx, y + 72, "Focus", 13, INK, "b w6") + t(bx, y + 90, "Fixed ring, any button", 12, INK2))
    H = y + 130
    return svg("Smart Warehouse Planner — Components sheet 1, alternative B: In context",
               "Components at real size on the faded screens where they open: the Key colour popover over a live-previewing aisle wall, the Apply all confirm popover on Recommendations, the Delete plan dialog over Saved plans, an Undo toast after Apply, the read-only Settings page, and the buttons used. Synthetic data.",
               "\n".join(o), h=round(H))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "B-in-context.svg")
    open(out, "w").write(make())
    print("wrote", out)
