"""Alternative B - In the app: each component at real size on the screen it opens from.
The screen behind is faded; the component is crisp. Dialogs that would sit on a scrim are drawn
"exploded" beside their trigger with a dashed leader. Usage: python3 gen_B.py [out.svg]"""
import sys
from comp import *

FW = 1312  # frame width
X0 = 64


def fade(x, y, w, h, op=0.62):
    return rect(x, y, w, h, 0, GROUND, extra=f' fill-opacity="{op}"')


def frame(x, y, w, h, plan=True, current=3):
    """Screen frame: paper page with the real 64px graphite toolbar."""
    return (rect(x, y, w, h, 8, GROUND, BORDER, 1) + toolbar(x, y, w, plan=plan, current=current))


def step_head(x, y, n, title, caption):
    return (step_disc(x + 14, y - 26, n) + t(x + 38, y - 18, title, 24, INK, LB) +
            t(x + 60 + tw(title, 24, "lb") * 1.06, y - 19, caption, 13.5, INK2))


def leader(x1, y1, x2, y2, label=None, lx=None, ly=None, anchor=None, via=None):
    pts = [(x1, y1)] + (via or []) + [(x2, y2)]
    d = "M" + " L".join(f"{a} {b}" for a, b in pts)
    o = (f'<path d="{d}" stroke="{INK}" stroke-width="1.3" stroke-dasharray="4 3" '
         f'fill="none" marker-end="url(#ahk)"/>' + f'<circle cx="{x1}" cy="{y1}" r="3" fill="{INK}"/>')
    if label:
        o += t(lx, ly, label, 12.5, INK, "b w6", anchor)
    return o


def note(x, y, lines, w=None):
    o = []
    for i, s in enumerate(lines):
        o.append(t(x, y + i * 18, s, 12.5, INK2 if i else INK, "b w6" if i == 0 else FB))
    return "".join(o)


def caps(x, y, s, fill=INK3):
    return t(x, y, s, 11, fill, LB, extra=' letter-spacing="1"')


def make():
    o = []
    # ------------------------------------------------------------ header
    o.append(caps(64, 74, "COMPONENTS · SHEET 2 OF 2 · IN CONTEXT", INK2))
    o.append(t(64, 132, "Parts, moves and plans, where they open", 58, INK, LB))
    o.append(t(64, 172, "Each component at real size on the screen it opens from. The screen behind is faded; the component is not.", 18, INK2))
    o.append(t(64, 198, "Dialogs that open over an ink scrim are drawn beside their trigger, with a dashed line from the control that opens them.", 14, INK3))
    # ------------------------------------------------------------ 1 saved plans
    y = 290
    o.append(step_head(X0, y, "1", "Saved plans", "The start page after login (FR-8). Row menu, Delete… and the first-visit state."))
    H1 = 540
    o.append(frame(X0, y, FW, H1, plan=False))
    top = y + 64
    px = X0 + 40
    o.append(plans_header(px, top + 32, 812))
    tb, th, mb = plans_table(px, top + 92, 812, menu=1)
    o.append(tb)
    menu_x, menu_y = mb[0] + 28 - 240, mb[1] + 34
    rm, rmh = row_menu(menu_x, menu_y, hl=3)
    o.append(rm)
    # exploded delete dialog
    dx, dw = X0 + FW - 40 - 412, 412
    dd, ddh = delete_dialog(dx, top + 32, dw)
    o.append(dd)
    o.append(leader(menu_x + 240, menu_y + rmh - 26, dx - 6, top + 32 + 100))
    o.append(note(dx, top + 32 + ddh + 30, ["Opens over an ink scrim at 45%.",
                                            "Cancel has the focus; Delete plan names the loss."]))
    ey = top + 32 + ddh + 84
    o.append(caps(dx, ey, "WHEN THERE ARE NO PLANS YET"))
    pe, peh = plans_empty(dx, ey + 12, dw)
    o.append(pe)

    # ------------------------------------------------------------ 2 locations wall
    y = y + H1 + 104
    o.append(step_head(X0, y, "2", "Locations wall", "Part panel docked on the right; a bin dropped on an occupied location; Manual move…"))
    H2 = 980
    o.append(frame(X0, y, FW, H2, plan=True, current=3))
    top = y + 64
    cx = X0
    cw = FW - 400
    # context: page header, aisle plates, wall, key (faded afterwards)
    ctx = []
    ctx.append(t(cx + 24, top + 46, "Locations", 28, INK, LB))
    ctx.append(t(cx + 24 + tw("Locations", 28, "lb") + 16, top + 45, "Aisle G · 48 locations, 39 occupied · data as of 2026-09-30", 12.5, INK2))
    sx = cx + cw - 24 - 232
    ctx.append(rect(sx, top + 20, 232, 34, 6, SURF, BORDER, 1) + rect(sx + 3, top + 23, 122, 28, 4, INK))
    ctx.append(t(sx + 64, top + 41.5, "Planning copy", 13, "#fff", "b w6", "middle") + t(sx + 178, top + 41.5, "Import", 13, INK, "b w5", "middle"))
    for i, L in enumerate("ABCDEFGH"):
        ax = cx + 24 + i * 40
        sel = L == "G"
        ctx.append(rect(ax, top + 74, 30, 30, 2, SEL_T if sel else SURF, INK, 1.5 if sel else 1))
        ctx.append(t(ax + 15, top + 95, L, 16, INK, LB, "middle"))
    wy = top + 128
    wsvg, ww, wh, cxy = wall(cx + 24, wy, ["Section 12", "Section 13", "Section 14"],
                             ["SM.F MS.D Dv.S", "F.DM F.MS FMS.", "MS.D S.MF SM.F", ".FMS M.DS MDS."])
    ctx.append(wsvg)
    ky = wy + wh + 30
    kx = cx + 24
    for c, nm in (("F", "Fast-moving"), ("M", "Medium-moving"), ("S", "Slow-moving"), ("D", "Dead stock")):
        ctx.append(swatch(kx, ky - 13, c) + t(kx + 22, ky, nm, 12, INK, "b w5"))
        kx += 22 + tw(nm, 12, "b5") + 18
    o.append("".join(ctx))
    o.append(fade(cx + 1, top + 1, cw - 1, H2 - 65))
    # crisp: the drag and the drop dialog
    tx, ty = cxy(1, 2, 2)
    o.append(wbin(tx, ty, "S"))
    o.append(drop_target(tx, ty, occupied=True))
    o.append(wlifted(tx - 4, ty - 38, "F"))
    o.append(icon("i-cursor", tx + 18, ty - 16, 20))
    vx, vy = cxy(4, 2, 1)
    o.append(rect(vx - 1, vy - 1, 29, 31, 3, "none", "#fff", 1.4, ' stroke-dasharray="2 2"'))
    popx = cx + 24 + ww + 24
    popy = ty + 14 - 70
    pop, poph = drop_popover(popx, popy, "swap", pointer=("left", 70))
    o.append(pop)
    # crisp: part panel docked
    ppx = X0 + FW - 400
    o.append(rect(ppx, top, 399, H2 - 65, 0, SURF) + line(ppx + .5, top, ppx + .5, y + H2 - 1, BORDER))
    pp, ph, A = part_panel(ppx, top, docked=True)
    o.append(pp)
    # crisp: manual move dialog, exploded out of the part panel button
    mx, my = cx + 24, ky + 40
    dlg, dh, DA = mm_dialog(mx, my, "from")
    o.append(dlg)
    by = A["footer"]
    ly_ = popy + poph + 20
    o.append(leader(ppx + 20, by, mx + 440 + 8, ly_, via=[(popx + 344 + 26, by), (popx + 344 + 26, ly_)]))
    # field states under the drop dialog
    fx = popx
    fy = popy + poph + 52
    o.append(t(fx, fy, "The same field also says", 16, INK, LB))
    for i, (st, cap) in enumerate((("virtual", "VIRTUAL LOCATION"), ("adds", "ALREADY HOLDS THE PART"),
                                    ("back", "BACK TO WHERE IT STARTED"))):
        sy = fy + 28 + i * 90
        o.append(caps(fx, sy, cap))
        f, fh = to_field(fx, sy + 10, 344, st, label=False, focus=False)
        o.append(f)

    # ------------------------------------------------------------ 3 recommendations
    y = y + H2 + 104
    o.append(step_head(X0, y, "3", "Recommendations", "Other location on the selected row (FR-31): another location that rule allows."))
    H3 = 580
    o.append(frame(X0, y, FW, H3, plan=True, current=5))
    top = y + 64
    cx = X0
    ctx = []
    ctx.append(t(cx + 24, top + 46, "Recommendations", 28, INK, LB))
    rcx = cx + 24 + tw("Recommendations", 28, "lb") + 18
    ctx.append(rect(rcx, top + 24, 92, 28, 3, SURF, INK, 1.2) + rect(rcx, top + 24, 5, 28, 0, INK) + t(rcx + 50, top + 43, "ROUND 1", 14, INK, LB, "middle"))
    ctx.append(button(cx + FW - 24 - 200, top + 20, 200, "Run recommendations", "primary"))
    tabs = ["Rule 1 · 6", "Rule 2 · 4", "Rule 3 · 5", "No space · 2", "Kept in place · 1", "Outdated · 0"]
    tx_ = cx + 24
    for i, s in enumerate(tabs):
        ctx.append(t(tx_, top + 92, s, 13.5, INK if i == 0 else INK2, "b w6" if i == 0 else "b w5"))
        if i == 0:
            ctx.append(rect(tx_, top + 101, tw(s, 13.5, "b6"), 3, 0, INK))
        tx_ += tw(s, 13.5, "b6") + 32
    ctx.append(line(cx + 24, top + 104, cx + 24 + 820, top + 104, BORDER))
    rows = [("2", "8044172", "Oil filter – Corolla", "A-12-04-02", "A-14-02-01", True),
            ("3", "9723950", "Spark plug set", "A-03-04-02", "A-05-01-03", True),
            ("4", "5520114", "Cabin filter", "C-03-03-01", "A-02-01-02", True),
            ("5", "6612040", "Wiper motor", "D-11-04-01", "A-04-01-02", True)]
    rx_, ry_ = cx + 24, top + 116
    for i, d in enumerate(rows):
        r, _ = rec_row(rx_, ry_ + 58 * (i + 1), 820, open_=False, plain=True, data=d)
        ctx.append(r)
    # detail panel (context)
    dpx = cx + 24 + 820 + 24
    dpw = FW - (dpx - cx) - 24
    ctx.append(rect(dpx, top + 116, dpw, 360, 8, SURF, BORDER, 1))
    ctx.append(t(dpx + 20, top + 146, "Move 1 · Rule 1", 18, INK, LB))
    ctx.append(t(dpx + 20, top + 168, "61 picks (24 or more) · sits on L4, not best", 12.5, INK2))
    for i in range(3):
        ctx.append(rect(dpx + 20, top + 194 + i * 24, dpw - 40 - (i % 3) * 70, 10, 2, BAND))
    o.append("".join(ctx))
    o.append(fade(cx + 1, top + 1, FW - 2, H3 - 65))
    rr, trig = rec_row(rx_, ry_, 820, open_=True)
    o.append(rr)
    lw = 304
    lx0 = trig + 128 - lw
    ol, olh = other_list(lx0, ry_ + 50, lw, "open", hl=1)
    o.append(ol)
    # exploded empty list
    ex = dpx + 20
    ey = top + 300
    o.append(caps(ex, ey - 14, "WHEN NOTHING FITS"))
    el, elh = other_list(ex, ey, dpw - 40, "empty")
    o.append(el)
    nl = ["Browsing applies nothing."] + wrap("Typing and arrows move the highlight; Enter or a click applies it with the rule and round kept.", 12.5, "b4", dpw - 40)
    o.append(note(ex, ey + elh + 30, nl))
    H = y + H3 + 64
    return svg("Smart Warehouse Planner: components sheet 2, alternative B (in context)",
               "Saved plans with row menu, Delete dialog and empty state; the Locations wall with the part panel docked, "
               "a drop on an occupied location (Swap or Put together) and the Manual move dialog with to-location errors; "
               "Recommendations with the Other location list. Real size on faded app screens. Synthetic data.",
               "\n".join(o), h=round(H))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "B-in-context.svg"
    open(out, "w").write(make())
    print("wrote", out)
