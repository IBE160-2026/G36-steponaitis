"""Alternative C - Storybook board: one labelled card per component state, at real size.
Each card has the component name, a state chip, the component on a dotted canvas and a footer
line naming where it opens. Slices (dashed cut edges) show only the part that changes.
Usage: python3 gen_C.py [out.svg]"""
import sys
from comp import *

DOTS = ('<pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse">'
        '<rect width="12" height="12" fill="#EEEDE8"/><circle cx="6" cy="6" r="0.9" fill="#D3D1C9"/></pattern>')

CHIP_ICON = {"ERROR": ("i-alert", ERR), "WARNING": ("i-alert", INK), "NOTE": ("i-info", INK),
             "EMPTY": ("i-file", INK), "CONFIRM": ("i-trash", INK), "OPEN": ("i-chev-d", INK),
             "DISABLED": ("i-lock", INK), "ON": ("i-pin", INK), "TYPING": ("i-search", INK),
             "READY": ("i-check", INK), "DEFAULT": None, "MENU OPEN": ("i-dots", INK), "HOVER": ("i-cursor", None)}

_cid = [0]


def clip(content, x, y, w, h):
    _cid[0] += 1
    c = f"cl{_cid[0]}"
    return f'<clipPath id="{c}"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath><g clip-path="url(#{c})">{content}</g>'


def cut(x, y, w):
    """Dashed cut edge: this is a slice of a larger component."""
    return line(x - 6, y, x + w + 6, y, INK3, 1, ' stroke-dasharray="5 4"')


def chip_state(xr, y, s):
    """State chip, right-aligned at xr. Outline only: colour stays reserved for the wall."""
    ic = CHIP_ICON.get(s)
    tw_ = tw(s, 11, "lb") * 1.25 + 4
    w = tw_ + 20 + (16 if ic else 0)
    x = xr - w
    o = rect(x, y, w, 22, 11, SURF, INK, 1)
    tx = x + 10
    if ic:
        if ic[0] == "i-cursor":
            o += f'<use href="#i-cursor" x="{x+6}" y="{y+3}" width="15" height="15"/>'
        else:
            o += icon(ic[0], x + 7, y + 3.5, 15, ic[1])
        tx += 15
    o += t(tx, y + 15.5, s, 11, INK, LB, extra=' letter-spacing="1"')
    return o


def story(x, y, w, name, state, footer, ch, draw, pad=16):
    """Card: header (name + state chip), dotted canvas of height ch, footer. Returns (svg, total_h)."""
    H = 44 + ch + 2 * pad + 34
    o = [rect(x, y, w, H, 8, SURF, BORDER, 1)]
    o.append(t(x + 16, y + 29, name, 17, INK, LB))
    o.append(chip_state(x + w - 14, y + 11, state))
    cy = y + 44
    o.append(rect(x + 1, cy, w - 2, ch + 2 * pad, 0, "url(#dots)"))
    o.append(line(x + 1, cy, x + w - 1, cy, BORDER))
    o.append(line(x + 1, cy + ch + 2 * pad, x + w - 1, cy + ch + 2 * pad, BORDER))
    o.append(draw(x + pad, cy + pad))
    o.append(t(x + 16, y + H - 12, footer, 11.5, INK3, "b w5"))
    return "".join(o), H


class Col:
    def __init__(self, x, w, y):
        self.x, self.w, self.y, self.o = x, w, y, []

    def add(self, name, state, footer, ch, draw, pad=16):
        s, h = story(self.x, self.y, self.w, name, state, footer, ch, draw, pad)
        self.o.append(s)
        self.y += h + 20


def make():
    o = [DOTS]
    # ------------------------------------------------------------ header
    o.append(t(64, 74, "COMPONENTS · SHEET 2 OF 2 · STATES", 13, INK2, LB, extra=' letter-spacing="1.6"'))
    o.append(t(64, 132, "Every state, one card each", 58, INK, LB))
    o.append(t(64, 172, "Part panel, Manual move, Swap or put together, Other location and Saved plans, card by card.", 18, INK2))
    o.append(t(64, 198, "Real size on a dotted canvas. A dashed edge means the card shows only the slice that changes.", 14, INK3))
    # chip legend (right)
    lx = 1376
    for s in ("ERROR", "WARNING", "NOTE", "OPEN", "DEFAULT"):
        o.append(chip_state(lx, 64, s))
        lx -= tw(s, 11, "lb") * 1.25 + 4 + 20 + (16 if CHIP_ICON.get(s) else 0) + 10
    o.append(t(1376, 108, "State chips are outlined in ink; only the error", 12.5, INK2, anchor="end"))
    o.append(t(1376, 126, "triangle is red, as in the field itself.", 12.5, INK2, anchor="end"))
    o.append(rect(64, 228, 1312, 2, 0, INK))

    y0 = 260
    c1 = Col(64, 472, y0)
    c2 = Col(560, 432, y0)
    c3 = Col(1016, 360, y0)

    # ------------------------------------------------------------ column 1: manual move
    c1.add("Manual move", "READY", "From the part panel, a location tooltip or a list row · FR-33", 421,
           lambda x, y: mm_dialog(x, y, "valid")[0])
    c1.add("To-location", "TYPING", "Autocomplete over the Locations file · arrow keys move, Enter fills", to_field(0, 0, 440, "typing")[1],
           lambda x, y: to_field(x, y, 440, "typing")[0])
    c1.add("To-location", "ERROR", "The from-location is refused, with the reason", to_field(0, 0, 440, "from", label=False, focus=False)[1],
           lambda x, y: to_field(x, y, 440, "from", label=False, focus=False)[0])
    c1.add("To-location", "NOTE", "Target already holds the part: stock is added together", to_field(0, 0, 440, "adds", label=False, focus=False)[1],
           lambda x, y: to_field(x, y, 440, "adds", label=False, focus=False)[0])

    def back(x, y):
        f, fh = to_field(x, y, 440, "back", label=False, focus=False)
        return (f + button(x + 440 - 112, y + fh + 16, 112, "Remove move", "primary") +
                button(x + 440 - 112 - 8 - 84, y + fh + 16, 84, "Cancel", "tertiary"))
    c1.add("To-location", "NOTE", "Back to where it started: the button reads Remove move",
           to_field(0, 0, 440, "back", label=False, focus=False)[1] + 52, back)

    # ------------------------------------------------------------ column 2: part panel
    c2.add("Part panel", "DEFAULT", "Search, a roster row, the tooltip or a recommendation · Esc closes", 650,
           lambda x, y: part_panel(x, y)[0])
    _, _, A0 = part_panel(0, 0, kept=True)
    ky = A0["keep"] - 28

    def kept(x, y):
        p, _, _ = part_panel(x, y - ky + 6, kept=True)
        return clip(p, x - 2, y, 404, 92) + cut(x, y, 400) + cut(x, y + 92, 400)
    c2.add("Part panel · keep in place", "ON", "Sets the mark at once (FR-32); a manual move stays possible", 92, kept)
    _, _, A1 = part_panel(0, 0, no_loc=True)
    fy1 = A1["footer"] - 34

    def noloc(x, y):
        p, _, _ = part_panel(x, y - 180, no_loc=True)
        p2, _, _ = part_panel(x, y + 104 - fy1, no_loc=True)
        return (clip(p, x - 2, y, 404, 100) + cut(x, y, 400) + cut(x, y + 100, 400) +
                clip(p2, x - 2, y + 104, 404, 68) + cut(x, y + 104, 400) + cut(x, y + 172, 400))
    c2.add("Part panel · no stock", "DISABLED", "No current location: no recommendation, Manual move… disabled", 172, noloc)

    # ------------------------------------------------------------ column 3: drop, other location
    def drop(x, y):
        wsvg, ww, wh, cxy = wall(x + 64, y, ["Section 14"], ["Dv.S", "FMS.", "SM.F", "MDS."])
        tx, ty = cxy(1, 0, 2)
        s = wsvg + drop_target(tx, ty, True) + wlifted(tx - 4, ty - 38, "F") + icon("i-cursor", tx + 18, ty - 16, 20)
        pop, ph = drop_popover(x - 4, y + wh + 22, "swap", w=336, pointer=("top", tx + 13.5 - (x - 4)))
        return s + pop
    c3.add("Drop on an occupied bin", "OPEN", "Mouse only; Manual move… is the keyboard path · FR-51", 192 + 22 + 324, drop)
    _, phw = drop_popover(0, 0, "warning", w=336, pointer=("none", 0))

    def warn(x, y):
        pop, ph = drop_popover(x - 4, y - 136, "warning", w=336, pointer=("none", 0))
        return clip(pop, x - 30, y, 400, ph - 136 + 12) + cut(x - 4, y, 336)
    c3.add("Drop · part kept in place", "WARNING", "Not an error: Swap stays enabled, the mark stays", phw - 136, warn)

    def other(x, y):
        bx = x + 328 - 128
        s = (rect(bx, y, 128, 28, 6, SURF, INK, 1) + t(bx + 12, y + 18.5, "Other location", 13, INK, "b w6") +
             icon("i-chev-u", bx + 104, y + 6, 16, INK))
        ol, olh = other_list(x + 328 - 304, y + 36, 304, "open", hl=1)
        return s + ol
    c3.add("Other location", "OPEN", "From the selected recommendation row · FR-31", 36 + 296, other)
    c3.add("Other location", "EMPTY", "Says why, and where to go instead", 92,
           lambda x, y: other_list(x, y, 328, "empty")[0])
    c2.add("To-location", "ERROR", "A virtual location is not a shelf", to_field(0, 0, 400, "virtual", label=False, focus=False)[1],
           lambda x, y: to_field(x, y, 400, "virtual", label=False, focus=False)[0])

    for c in (c1, c2, c3):
        o.extend(c.o)

    # ------------------------------------------------------------ saved plans band
    yb = max(c1.y, c2.y, c3.y) + 24
    o.append(t(64, yb + 6, "Saved plans", 30, INK, LB))
    o.append(t(64 + tw("Saved plans", 30, "lb") * 1.06 + 18, yb + 5, "The start page after login (FR-8). One card per state of the list and its row.", 14, INK2))
    yb += 32
    L = Col(64, 872, yb)
    R = Col(960, 416, yb)

    def plans(x, y):
        s = plans_header(x, y, 840)
        tb, th, mb = plans_table(x, y + 56, 840, hover=0, menu=1)
        rm, _ = row_menu(mb[0] + 28 - 240, mb[1] + 34, hl=3)
        return s + tb + rm
    L.add("Saved plans", "MENU OPEN", "Most recently edited first · the row menu holds Open, New Plan from this import and Delete…", 56 + 244, plans)

    def hover(x, y):
        tb, th, mb = plans_table(x, y - 36 - 52 * 2, 840, hover=2)
        return clip(tb, x - 2, y, 844, 52) + cut(x, y, 840) + cut(x, y + 52, 840)
    L.add("Saved plans row", "HOVER", "A click opens the plan as it was left (FR-9); the menu button shows on hover and focus", 52, hover)

    _, dh = delete_dialog(0, 0, 352)

    def delete(x, y):
        return rect(x, y, 384, dh + 32, 8, INK, extra=' fill-opacity="0.45"') + delete_dialog(x + 16, y + 16, 352)[0]
    R.add("Delete plan", "CONFIRM", "Cancel has the focus; the button names the loss, never red · FR-12", dh + 32, delete)
    _, eh = plans_empty(0, 0, 384)
    R.add("Saved plans", "EMPTY", "First visit: the README names data/sample/", eh,
          lambda x, y: plans_empty(x, y, 384)[0])
    o.extend(L.o + R.o)
    H = max(L.y, R.y) + 44
    return svg("Smart Warehouse Planner: components sheet 2, alternative C (storybook board)",
               "One card per state: Manual move ready, typing, errors and notes; part panel default, kept in place and no stock; "
               "Swap or put together drop, kept-in-place warning; Other location open and empty; Saved plans with row menu, hover, "
               "Delete confirm and empty state. Real size, synthetic data.",
               "\n".join(o), h=round(H))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "C-storybook-states.svg"
    open(out, "w").write(make())
    print("wrote", out)
