"""Alternative A - Specimen sheet: every component at real size with numbered anatomy pins and a legend.
Usage: python3 gen_A.py [out.svg]"""
import sys
from comp import *

PIN_LEADER = INK3


def sec(x, y, num, title, lines):
    o = [rect(x, y, 34, 30, 3, SURF, INK, 1.2), rect(x, y, 5, 30, 0, INK),
         t(x + 20, y + 21, num, 14, INK, LB, "middle"),
         t(x + 48, y + 25, title, 30, INK, LB)]
    for i, s in enumerate(lines):
        o.append(t(x, y + 56 + i * 19, s, 13.5, INK2))
    return "".join(o)


def legend_inline(x, y, items, maxw, start=1):
    """Numbered legend that flows left to right and wraps: pin + label."""
    o = []
    cx, cy = x, y
    for i, s in enumerate(items):
        iw = 24 + tw(s, 12.5, "b5") + 30
        if cx > x and cx + iw > x + maxw:
            cx, cy = x, cy + 24
        o.append(pin(cx + 9, cy, str(i + start), 9))
        o.append(t(cx + 24, cy + 4.5, s, 12.5, INK, "b w5"))
        cx += iw
    return "".join(o)


def dim_h(x1, x2, y, label):
    mid = (x1 + x2) / 2
    lw = tw(label, 12, "lb") + 12
    return (line(x1, y, x2, y, INK3, 1) + line(x1, y - 5, x1, y + 5, INK3, 1) + line(x2, y - 5, x2, y + 5, INK3, 1) +
            rect(mid - lw / 2, y - 8, lw, 16, 0, GROUND) + t(mid, y + 4.5, label, 12, INK3, "lb w6", "middle"))


def caps(x, y, s):
    return t(x, y, s, 11, INK3, LB, extra=' letter-spacing="1"')


def make():
    o = []
    # ------------------------------------------------------------ header
    o.append(t(64, 74, "COMPONENTS · SHEET 2 OF 2", 13, INK2, LB, extra=' letter-spacing="1.6"'))
    o.append(t(64, 132, "Parts, moves and plans", 58, INK, LB))
    o.append(t(64, 172, "The part panel, two ways to move a part by hand, the Other location list and the saved plans.", 18, INK2))
    o.append(t(64, 198, "Real size, synthetic data. Pins name the parts of each component; DESIGN.md and EXPERIENCE.md win on any conflict.", 14, INK3))
    bx, by, bw = 1056, 52, 320
    rows = [("PLAN", "Spring re-slot 2026"), ("DATA AS OF", "2026-09-30 · round 1"),
            ("SCALE", "1 : 1, real UI size"), ("DRAWN", "2026-11-14 · sheet 2 of 2")]
    o.append(rect(bx, by, bw, 30 * len(rows), 3, SURF, INK, 1.2))
    for i, (k, v) in enumerate(rows):
        ry = by + i * 30
        if i:
            o.append(line(bx + 1, ry, bx + bw - 1, ry, BORDER))
        o.append(t(bx + 14, ry + 19.5, k, 11, INK3, LB, extra=' letter-spacing="1.2"'))
        o.append(t(bx + 108, ry + 20.5, v, 14.5, INK, LB))
    o.append(rect(64, 228, 1312, 2, 0, INK))

    # ------------------------------------------------------------ 01 part panel
    y0 = 268
    o.append(sec(64, y0, "01", "Part panel", ["Side panel over Parts and Locations.",
                                               "Opens from search, a roster row, the tooltip",
                                               "or a recommendation. Esc closes it."]))
    px, py = 456, y0 + 104
    o.append(dim_h(px, px + 400, py - 18, "400"))
    pp, ph, A = part_panel(px, py)
    o.append(pp)
    legend = [("title", "Part number and description", "section-title 22 · body 14"),
              ("class", "Movement class", "the bin itself: colour, glyph, name, picks"),
              ("locations", "Locations and stock", "location chips · stock right-aligned"),
              ("groups", "Pick groups", "count pill · partners share 5 or more jobs"),
              ("partner", "Partner row", "swatch, part number, why · opens that part"),
              ("keep", "Keep in place", "switch, sets the mark at once (FR-32)"),
              ("footer", "Actions", "Manual move… opens the dialog (02)")]
    for i, (k, nm, tok) in enumerate(legend):
        ay = A[k]
        o.append(t(404, ay + 1, nm, 14, INK, "b w6", "end"))
        o.append(t(404, ay + 19, tok, 12, INK3, "b w4", "end"))
        o.append(line(412, ay - 4, px - 26, ay - 4, PIN_LEADER, 1, ' stroke-dasharray="2 3"'))
        o.append(pin(px - 14, ay - 4, str(i + 1)))
    left_end = py + ph

    # ------------------------------------------------------------ 02 manual move
    mx = 920
    o.append(sec(mx, y0, "02", "Manual move", ["Checks the to-location while you type (FR-33)."]))
    o.append(legend_inline(mx, y0 + 86, ["Part and from-location", "To-location field",
                                         "The move it will make", "Cancel first, one primary"], 456))
    dy = y0 + 134
    dlg, dh, DA = mm_dialog(mx, dy, "valid")
    o.append(dlg)
    for i, k in enumerate(("from", "to", "strip", "buttons")):
        o.append(pin(mx + 440 + 16, DA[k], str(i + 1), 9))
        o.append(line(mx + 440, DA[k], mx + 440 + 7, DA[k], INK3, 1))
    sy = dy + dh + 44
    o.append(t(mx, sy, "What the to-location field says", 18, INK, LB))
    o.append(t(mx, sy + 20, "Red boundary, warning triangle and a sentence; never colour alone.", 12.5, INK2))
    states = [("from", "From-location typed"), ("virtual", "Virtual location typed"),
              ("adds", "Already holds the part"), ("back", "Back to where it started")]
    for i, (st, cap) in enumerate(states):
        cx = mx + (i % 2) * 236
        cy = sy + 48 + (i // 2) * 116
        o.append(caps(cx, cy, cap.upper()))
        f, fh = to_field(cx, cy + 10, 216, st, label=False, focus=False)
        o.append(f)
    right_end = sy + 48 + 116 + 104

    # ------------------------------------------------------------ 03 drop chooser
    y1 = max(left_end, right_end) + 76
    o.append(rect(64, y1 - 38, 1312, 1, 0, BORDER))
    o.append(sec(64, y1, "03", "Swap or put together", ["Dropping a dragged bin on an occupied location asks first (FR-51)."]))
    o.append(legend_inline(64, y1 + 86, ["Lifted bin, its slot dashed", "Target framed, swap icon",
                                         "Both parts, named", "What each choice does", "Neither is the default"], 700))
    wy = y1 + 160
    wsvg, ww, wh, cxy = wall(64, wy, ["Section 13", "Section 14"],
                             ["MS.D Dv.S", "F.MS FMS.", "S.MF SM.F", "M.DS MDS."])
    o.append(wsvg)
    tx, ty = cxy(1, 1, 2)
    o.append(drop_target(tx, ty, occupied=True))
    lx, ly = tx - 4, ty - 38
    o.append(wlifted(lx, ly, "F"))
    o.append(icon("i-cursor", lx + 22, ly + 22, 20))
    vx, vy = cxy(4, 1, 1)
    o.append(line(vx + 13.5, wy - 7, vx + 13.5, vy - 2, INK3, 1))
    o.append(pin(vx + 13.5, wy - 16, "1", 9))
    o.append(line(tx + 13.5, ty + 33, tx + 13.5, wy + wh + 7, INK3, 1))
    o.append(pin(tx + 13.5, wy + wh + 16, "2", 9))
    popx, popy = 64 + ww + 22, wy - 8
    pop, poph = drop_popover(popx, popy, "swap", pointer=("left", ty + 14 - popy))
    o.append(pop)
    o.append(pin(popx + 344 + 16, popy + 110, "3", 9))
    o.append(pin(popx + 344 + 16, popy + 214, "4", 9))
    o.append(pin(popx + 344 + 16, popy + poph - 34, "5", 9))
    ny = wy + wh + 54
    o.append(t(64, ny, "Hover shows the result first:", 12.5, INK, "b w6"))
    o.append(t(64, ny + 18, "a plus on an empty slot (“Move here”),", 12.5, INK2))
    o.append(t(64, ny + 36, "the swap icon on an occupied one.", 12.5, INK2))
    o.append(t(64, ny + 54, "Empty slot and one part: no dialog.", 12.5, INK2))
    drop_end = max(popy + poph, ny + 54)

    # ------------------------------------------------------------ 04 other location
    ox = 820
    o.append(sec(ox, y1, "04", "Other location", ["Another location the rule allows, in code order (FR-31)."]))
    o.append(legend_inline(ox, y1 + 86, ["Trigger on the selected row", "Filter, then the list",
                                         "Tint and ink bar", "Enter or click applies"], 556))
    ry = wy + 4
    rw = 760
    rx0 = 1376 - rw
    o.append(f'<clipPath id="rowclip"><rect x="{ox}" y="{ry-2}" width="{1376-ox}" height="62"/></clipPath>')
    rr, trig_x = rec_row(rx0, ry, rw, open_=True)
    o.append(f'<g clip-path="url(#rowclip)">{rr}</g>')
    o.append(f'<linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="{GROUND}"/>'
             f'<stop offset="1" stop-color="{GROUND}" stop-opacity="0"/></linearGradient>')
    o.append(rect(ox, ry - 2, 56, 62, 0, "url(#fadeL)"))
    o.append(pin(trig_x + 64, ry - 14, "1", 9))
    lw = 304
    lx0 = trig_x + 128 - lw
    ol, olh = other_list(lx0, ry + 50, lw, "open", hl=1)
    o.append(ol)
    o.append(pin(lx0 - 16, ry + 50 + 25, "2", 9))
    o.append(pin(lx0 - 16, ry + 50 + 74 + 28 + 14, "3", 9))
    o.append(pin(lx0 - 16, ry + 50 + olh - 26, "4", 9))
    ey = ry + 50 + olh + 40
    o.append(caps(ox, ey + 4, "EMPTY LIST"))
    el, elh = other_list(lx0, ey, lw, "empty")
    o.append(el)
    o.append(t(ox, ey + 26, "Says why, and", 12.5, INK2))
    o.append(t(ox, ey + 44, "where to go instead.", 12.5, INK2))
    other_end = ey + elh

    # ------------------------------------------------------------ 05 saved plans
    y2 = max(drop_end, other_end) + 80
    o.append(rect(64, y2 - 38, 1312, 1, 0, BORDER))
    o.append(sec(64, y2, "05", "Saved plans", ["The start page after login (FR-8), most recently edited first. A row opens the plan as it was left."]))
    o.append(legend_inline(64, y2 + 86, ["One primary: New Plan", "Name, round and moves", "Row menu button",
                                         "Open · New Plan from this import · Delete…", "Cancel has the focus"], 1312))
    tw_ = 840
    hy = y2 + 136
    o.append(plans_header(64, hy, tw_))
    o.append(pin(64 + tw_ + 18, hy + 18, "1", 9))
    ty0 = hy + 60
    tb, th, mb = plans_table(64, ty0, tw_, hover=0, menu=1)
    o.append(tb)
    o.append(pin(64 - 22, ty0 + 36 + 26, "2", 9))
    o.append(pin(mb[0] + 28 + 20, mb[1] + 14, "3", 9))
    menu_x, menu_y = mb[0] + 28 - 240, mb[1] + 34
    rm, rmh = row_menu(menu_x, menu_y, hl=3)
    o.append(rm)
    o.append(pin(menu_x + 240 + 20, menu_y + rmh - 24, "4", 9))
    ey2 = ty0 + th + 30
    o.append(caps(64, ey2, "NO PLANS YET"))
    o.append(rect(64, ey2 + 12, tw_, 60, 8, SURF, BORDER, 1))
    o.append(icon("i-file", 84, ey2 + 31, 20, INK))
    o.append(runs(116, ey2 + 46, [("No plans yet.", 14, INK, "b w6"),
                                  (" A plan starts from the three files the warehouse exports: Locations, Inventory and Transactions.", 13, INK2, FB)]))
    sx, sw_ = 936, 440
    sh = 232
    o.append(rect(sx, hy, sw_, sh, 8, INK, extra=' fill-opacity="0.45"'))
    dd, ddh = delete_dialog(sx + 16, hy + 16, sw_ - 32)
    o.append(dd)
    o.append(pin(sx + 16 + (sw_ - 32) - 24 - 112 - 10 - 42, hy + 16 + ddh + 14, "5", 9))
    o.append(t(sx, hy + sh + 28, "Over an ink scrim at 45%. The button names the loss and is", 12.5, INK2))
    o.append(t(sx, hy + sh + 46, "never red: red is a class colour on the wall.", 12.5, INK2))
    end = max(ey2 + 72, hy + sh + 46)
    H = end + 64
    return svg("Smart Warehouse Planner: components sheet 2, alternative A (specimen sheet)",
               "Part panel, Manual move dialog with to-location states, Swap or put together drop dialog, Other location list "
               "and Saved plans with row menu, Delete dialog and empty state; real size with numbered anatomy pins. Synthetic data.",
               "\n".join(o), h=round(H))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "A-specimen-sheet.svg"
    open(out, "w").write(make())
    print("wrote", out)
