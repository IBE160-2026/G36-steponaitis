"""Generate three landing-page mockups (Bin Wall style) for comparison."""
import os, sys

S = os.path.dirname(os.path.abspath(__file__))
DEFS = open(os.path.join(S, "defs.svgfrag")).read()

INK, INK2, INK3 = "#1B1E22", "#4A5058", "#6B717A"
GROUND, SURF, BORDER, HAIR, BAND = "#EEEDE8", "#FFFFFF", "#D6D4CD", "#E6E4DE", "#E4E2DB"
ONDARK, ONDARK2, ONDARK_NAV = "#E3E6E9", "#C9CED3", "#D5D9DD"
CLS = {"F": "#D85144", "M": "#F0B323", "S": "#417DDC", "D": "#8C939A"}
GLY = {"F": "g-fast", "M": "g-med", "S": "g-slow", "D": "g-dead"}
LBL = {"F": "FST", "M": "MED", "S": "SLW", "D": "DED"}
BEST, BEST_L, ACCENT = "#3DAE6B", "#267A4B", "#9466F0"
LB = "lb w7"


def t(x, y, s, size, fill=INK, cls="b w4", anchor=None, extra=""):
    a = f' text-anchor="{anchor}"' if anchor else ""
    return f'<text x="{x}" y="{y}" class="{cls}" font-size="{size}" fill="{fill}"{a}{extra}>{s}</text>'


def bin_(x, y, c, w=60, h=58, lifted=False):
    k = w / 60
    out = []
    if lifted:
        out.append('<g filter="url(#lift)">')
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{3*k:.1f}" fill="{CLS[c]}"/>')
    out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{6*k:.1f}" rx="{2*k:.1f}" fill="#000" fill-opacity="0.22"/>')
    out.append(f'<rect x="{x+5*k:.1f}" y="{y+h*0.28:.1f}" width="{w-10*k:.1f}" height="{26*k:.1f}" rx="1.5" fill="#fff"/>')
    if lifted:
        out.append("</g>")
    gy = y + h * 0.28 + 8 * k
    out.append(f'<use href="#{GLY[c]}" x="{x+9*k:.1f}" y="{gy:.1f}" width="{10*k:.1f}" height="{10*k:.1f}"/>')
    out.append(t(f"{x+22*k:.1f}", f"{gy+9.5*k:.1f}", LBL[c], f"{12*k:.1f}", cls=LB))
    return "".join(out)


def slot(x, y, w=60, h=58):
    k = w / 60
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="#141719"/>'
            f'<rect x="{x+w*0.28:.1f}" y="{y+3}" width="{w*0.44:.1f}" height="2.6" rx="1.3" fill="#3A4046"/>'
            f'<path d="M{x+3} {y+h-3} H{x+w-3}" stroke="#2C3136" stroke-width="1"/>')


def target(x, y, w=60, h=58):
    return (slot(x, y, w, h) +
            f'<rect x="{x-3}" y="{y-3}" width="{w+6}" height="{h+6}" rx="4" fill="none" stroke="{ACCENT}" stroke-width="3"/>'
            f'<use href="#i-plus" x="{x+w/2-9}" y="{y+h/2-9}" width="18" height="18" stroke="#fff" color="#fff"/>')


def wall(x0, y0, grid, best_levels=(1, 2), bw=60, bh=58, per_section=4, title=None, highlight=None,
         sections=None, width=None):
    """grid: list of rows from top level to L1; cells F/M/S/D/. (empty) /T (target)."""
    levels = len(grid)
    cols = len(grid[0])
    nsec = (cols + per_section - 1) // per_section
    pitch = bw + 4
    sec_w = per_section * pitch + 10
    lab = 48
    head = 34
    lvl_h = bh + 22
    W = width or (lab + nsec * sec_w + 16)
    H = head + levels * lvl_h + 14
    o = [f'<rect x="{x0}" y="{y0}" width="{W}" height="{H}" rx="8" fill="url(#louvre2)"/>']
    for si in range(nsec):
        sx = x0 + lab + si * sec_w
        name = (sections[si] if sections else f"Section {si+1:02d}")
        o.append(t(sx + sec_w / 2, y0 + 23, name, 13, ONDARK2, "lb w6", "middle"))
        o.append(f'<rect x="{sx-6}" y="{y0+head}" width="6" height="{levels*lvl_h}" fill="#454B52"/>')
    o.append(f'<rect x="{x0+lab+nsec*sec_w-6}" y="{y0+head}" width="6" height="{levels*lvl_h}" fill="#454B52"/>')
    for li, row in enumerate(grid):
        lvl = levels - li
        ly = y0 + head + li * lvl_h
        by = ly + 8
        beam_y = by + bh + 6
        best = lvl in best_levels
        o.append(t(x0 + 12, by + bh / 2 - (2 if best else -5), f"L{lvl}", 15, ONDARK, LB))
        if best:
            o.append(f'<rect x="{x0+6}" y="{by+bh/2+6}" width="32" height="16" rx="2" fill="{BEST}"/>')
            o.append(t(x0 + 22, by + bh / 2 + 18, "BEST", 11, INK, LB, "middle"))
        o.append(f'<rect x="{x0+lab-6}" y="{beam_y}" width="{nsec*sec_w}" height="6" fill="{BEST if best else "#1F2326"}"/>')
        for ci, c in enumerate(row):
            si, cj = divmod(ci, per_section)
            bx = x0 + lab + si * sec_w + 6 + cj * pitch
            if c == ".":
                o.append(slot(bx, by, bw, bh))
            elif c == "T":
                o.append(target(bx, by, bw, bh))
            else:
                o.append(bin_(bx, by, c, bw, bh))
            if highlight and (li, ci) in highlight:
                o.append(f'<rect x="{bx-3}" y="{by-3}" width="{bw+6}" height="{bh+6}" rx="4" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>')
    return "".join(o), W, H


def cell_xy(x0, y0, li, ci, bw=60, bh=58, per_section=4):
    pitch = bw + 4
    sec_w = per_section * pitch + 10
    si, cj = divmod(ci, per_section)
    return x0 + 48 + si * sec_w + 6 + cj * pitch, y0 + 34 + li * (bh + 22) + 8


def logo(x=24, y=17):
    return (f'<g><rect x="{x}" y="{y}" width="30" height="30" rx="2" fill="#F0B323"/>'
            f'<rect x="{x}" y="{y}" width="30" height="3.5" rx="1.5" fill="#000" fill-opacity="0.22"/>'
            f'<rect x="{x+3}" y="{y+9}" width="24" height="13" rx="1" fill="#fff"/>'
            f'<use href="#g-med" x="{x+10.5}" y="{y+11}" width="9" height="9"/></g>')


def header(links=("How it works",)):
    o = ['<rect x="0" y="0" width="1440" height="64" fill="url(#louvre)"/>', logo(),
         t(64, 39, "Smart Warehouse Planner", 19, "#fff", LB)]
    x = 1210 - 120 * (len(links) - 1)
    for l in links:
        o.append(t(x, 38, l, 14, ONDARK, "b w5"))
        x += 120
    o.append(f'<rect x="1312" y="14" width="104" height="36" rx="6" fill="none" stroke="{ONDARK}" stroke-width="1.5"/>')
    o.append(f'<use href="#i-person" x="1328" y="23" width="18" height="18" stroke="#fff" color="#fff"/>')
    o.append(t(1352, 38, "Log in", 15, "#fff", "b w6"))
    return "".join(o)


def btn_primary(x, y, label="Log in", w=150, dark=True):
    bg, fg = (INK, "#fff") if dark else ("#fff", INK)
    return (f'<rect x="{x}" y="{y}" width="{w}" height="52" rx="8" fill="{bg}"/>' +
            t(x + 24, y + 32, label, 17, fg, "b w7") +
            f'<use href="#i-arrow-r" x="{x+w-40}" y="{y+17}" width="18" height="18" stroke="{fg}" color="{fg}"/>')


def btn_secondary(x, y, label="Create account", w=170, dark=False):
    c = "#fff" if dark else INK
    return (f'<rect x="{x}" y="{y}" width="{w}" height="52" rx="8" fill="none" stroke="{c}" stroke-width="1.5"/>' +
            t(x + w / 2, y + 32, label, 16, c, "b w6", "middle"))


def svg(title, desc, body, h=900):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 {h}" width="1440" height="{h}" role="img" '
            f'aria-labelledby="t d"><title id="t">{title}</title><desc id="d">{desc}</desc>\n{DEFS}\n'
            f'<rect x="0" y="0" width="1440" height="{h}" fill="{GROUND}"/>\n{body}\n</svg>\n')


# ---------------------------------------------------------------- A: before / after
def make_a():
    today = [
        list("FMF.SFDM"),
        list("SFDMF.SF"),
        list("DS.MDSFD"),
        list("SDSM.DMS"),
    ]
    after = [r[:] for r in today]
    moves = 0
    best_rows = [3, 2]  # L1, L2 (row indices)
    for li in (0, 1):
        for ci, c in enumerate(after[li]):
            if c != "F":
                continue
            done = False
            for want in (".", "D", "S"):
                for bl in best_rows:
                    for cj, d in enumerate(after[bl]):
                        if d == want:
                            after[bl][cj], after[li][ci] = "F", d
                            moves += 1 if want == "." else 2
                            done = True
                            break
                    if done: break
                if done: break
    o = [header()]
    o.append(t(72, 150, "Fast movers belong", 60, INK, LB))
    o.append(t(72, 212, "in your best locations.", 60, INK, LB))
    o.append(t(780, 120, "Upload the three files your warehouse already", 19, INK))
    o.append(t(780, 146, "exports. Get a move list that puts the busiest", 19, INK))
    o.append(t(780, 172, "parts where they are easiest to pick.", 19, INK))
    o.append(btn_primary(780, 196, "Log in", 140))
    o.append(btn_secondary(936, 196, "Create account", 172))
    # walls
    bw, bh = 58, 52
    y0 = 300
    wa, W, H = wall(72, y0, today, bw=bw, bh=bh, sections=("Section 01", "Section 02"))
    wb, W2, H2 = wall(1440 - 72 - W, y0, after, bw=bw, bh=bh, sections=("Section 01", "Section 02"))
    o.append(t(72, y0 - 14, "TODAY", 14, INK2, LB, extra=' letter-spacing="1.5"'))
    o.append(t(126, y0 - 14, "Aisle G as it stands", 14, INK2, "b w5"))
    o.append(t(1440 - 72 - W, y0 - 14, "AFTER THE PLAN", 14, BEST_L, LB, extra=' letter-spacing="1.5"'))
    o.append(t(1440 - 72 - W + 128, y0 - 14, "Fast movers on L1 and L2", 14, INK2, "b w5"))
    o.append(wa)
    o.append(wb)
    # middle arrow
    mx = 72 + W + (1440 - 144 - 2 * W) / 2
    my = y0 + H / 2
    o.append(f'<circle cx="{mx}" cy="{my}" r="30" fill="{INK}"/>')
    o.append(f'<use href="#i-arrow-r" x="{mx-13}" y="{my-13}" width="26" height="26" stroke="#fff" color="#fff"/>')
    o.append(t(mx, my + 56, f"{moves} moves", 16, INK, LB, "middle"))
    o.append(t(mx, my + 76, "2 rounds", 13, INK2, "b w5", "middle"))
    # three short steps
    sy = y0 + H + 52
    o.append(f'<rect x="72" y="{sy-30}" width="1296" height="1" fill="{BORDER}"/>')
    steps = [("i-upload", "Upload three exports", "Parts, locations and picks"),
             ("i-ribbon", "Mark your best locations", "An aisle, a level or one slot"),
             ("i-print", "Print the move list", "One walk per round, tick as you go")]
    for i, (ic, a, b) in enumerate(steps):
        x = 72 + i * 440
        o.append(f'<circle cx="{x+18}" cy="{sy+14}" r="18" fill="{INK}"/>')
        o.append(t(x + 18, sy + 19, str(i + 1), 15, "#fff", LB, "middle"))
        o.append(t(x + 50, sy + 10, a, 17, INK, "b w7"))
        o.append(t(x + 50, sy + 32, b, 14, INK2))
    return svg("Smart Warehouse Planner — Landing A: Before and after",
               "Landing page example A: headline, Log in and Create account, the same aisle shown today and after the plan, and three short steps.",
               "\n".join(o), h=800)


# ---------------------------------------------------------------- B: follow one part
def make_b():
    o = [header()]
    o.append(t(72, 160, "Every move", 66, INK, LB))
    o.append(t(72, 230, "comes with a reason.", 66, INK, LB))
    o.append(t(72, 282, "Smart Warehouse Planner reads your warehouse exports and", 19, INK))
    o.append(t(72, 308, "suggests which parts to move where. You decide each one.", 19, INK))
    o.append(btn_primary(72, 336, "Log in", 140))
    o.append(btn_secondary(228, 336, "Create account", 172))
    # Demo version: tertiary button (white, border outline) with a play glyph
    o.append(f'<rect x="416" y="336" width="178" height="52" rx="8" fill="#fff" stroke="#8A9097" stroke-width="1"/>')
    o.append(f'<use href="#i-play" x="436" y="353" width="18" height="18" stroke="{INK}" color="{INK}"/>')
    o.append(t(462, 368, "Demo version", 16, INK, "b w6"))
    o.append(t(72, 418, "Demo version skips the login and opens the app with a demo account.", 14, INK2))
    # small hero wall on right with lifted bin
    grid = [list("D..S"), list("FM.S"), list("SMDF"), list("MD.T")]
    grid[0][1] = "."
    wx, wy = 800, 96
    w, W, H = wall(wx, wy, grid, bw=60, bh=54, per_section=4, sections=("Aisle G · Section 14",))
    o.append(w)
    # lifted fast bin above L4 slot col 1
    lx, ly = cell_xy(wx, wy, 0, 1, 60, 54)
    tx, ty = cell_xy(wx, wy, 3, 3, 60, 54)
    o.append(f'<rect x="{lx}" y="{ly}" width="60" height="54" rx="2" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 3"/>')
    o.append(f'<path d="M{lx+70} {ly+20} C {lx+200} {ly+40}, {tx+120} {ty-40}, {tx+30} {ty-8}" fill="none" stroke="{ACCENT}" stroke-width="4" stroke-linecap="round"/>')
    o.append(f'<path d="M{tx+22} {ty-20} L{tx+30} {ty-6} L{tx+44} {ty-14}" fill="none" stroke="{ACCENT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>')
    o.append(bin_(lx + 14, ly - 18, "F", 66, 60, lifted=True))
    # reason card
    cx, cy = wx + W + 24, wy + 40
    o.append(f'<g filter="url(#pop)"><rect x="{cx}" y="{cy}" width="222" height="150" rx="6" fill="#fff"/></g>')
    o.append(f'<rect x="{cx}" y="{cy}" width="6" height="150" fill="{ACCENT}"/>')
    o.append(t(cx + 20, cy + 26, "RULE 1 · MOVE 1", 12, INK2, LB, extra=' letter-spacing="1"'))
    o.append(t(cx + 20, cy + 50, "4410281", 18, INK, LB))
    o.append(t(cx + 20, cy + 70, "Brake pads, front", 13.5, INK, "b w6"))
    o.append(t(cx + 20, cy + 94, "61 picks in 12 months", 13, INK2))
    o.append(t(cx + 20, cy + 112, "sits on L4, not best", 13, INK2))
    o.append(t(cx + 20, cy + 136, "→ G-14-01-04, best location", 13, BEST_L, "b w7"))
    # story strip
    sy = 520
    o.append(t(72, sy - 34, "One part, start to finish", 26, INK, LB))
    o.append(f'<rect x="72" y="{sy}" width="1296" height="6" rx="2" fill="#454B52"/>')
    panels = [
        ("In your export", "The row you already have"),
        ("Classified fast", "24 picks or more is fast"),
        ("You decide", "Apply it, or keep in place"),
        ("On the move list", "Printed, one walk per round"),
    ]
    pw, gap = 306, 24
    for i, (a, b) in enumerate(panels):
        px = 72 + i * (pw + gap)
        py = sy + 28
        o.append(f'<rect x="{px+20}" y="{sy-4}" width="10" height="16" rx="2" fill="#1A1D20"/>')
        o.append(f'<rect x="{px+pw-30}" y="{sy-4}" width="10" height="16" rx="2" fill="#1A1D20"/>')
        o.append(f'<rect x="{px}" y="{py}" width="{pw}" height="290" rx="6" fill="#fff" stroke="{INK}" stroke-width="1.2"/>')
        o.append(f'<circle cx="{px+30}" cy="{py+32}" r="15" fill="{INK}"/>')
        o.append(t(px + 30, py + 37, str(i + 1), 14, "#fff", LB, "middle"))
        o.append(t(px + 56, py + 30, a, 17, INK, "b w7"))
        o.append(t(px + 56, py + 49, b, 13, INK2))
        o.append(f'<rect x="{px+20}" y="{py+68}" width="{pw-40}" height="1" fill="{HAIR}"/>')
        if i < 3:
            o.append(f'<use href="#i-chev-r" x="{px+pw+2}" y="{py+136}" width="20" height="20" stroke="{INK}" color="{INK}"/>')
        ix, iy = px + 20, py + 86
        if i == 0:
            cols = [("Part", 0), ("Location", 86), ("Picks", 196)]
            o.append(f'<rect x="{ix}" y="{iy}" width="{pw-40}" height="28" fill="{BAND}"/>')
            for name, dx in cols:
                o.append(t(ix + 10 + dx, iy + 19, name, 12.5, INK2, "b w6"))
            rows = [("3301877", "B-07-04-03", "9", False), ("4410281", "G-14-04-02", "61", True),
                    ("5520114", "C-03-03-01", "33", False), ("6612040", "D-11-04-01", "2", False)]
            for r, (p, l, n, hl) in enumerate(rows):
                ry = iy + 28 + r * 36
                if hl:
                    o.append(f'<rect x="{ix}" y="{ry}" width="{pw-40}" height="36" fill="#F3EFFD"/>')
                    o.append(f'<rect x="{ix}" y="{ry}" width="4" height="36" fill="{ACCENT}"/>')
                o.append(f'<rect x="{ix}" y="{ry+36}" width="{pw-40}" height="1" fill="{HAIR}"/>')
                fc = INK if hl else INK3
                o.append(t(ix + 10, ry + 23, p, 14, fc, LB))
                o.append(t(ix + 96, ry + 23, l, 14, fc, LB))
                o.append(t(ix + 206, ry + 23, n, 14, fc, LB))
        elif i == 1:
            o.append(bin_(px + pw / 2 - 60, iy + 10, "F", 120, 112))
            o.append(t(px + pw / 2, iy + 160, "61", 30, INK, LB, "middle"))
            o.append(t(px + pw / 2, iy + 182, "picks in the last 12 months", 13, INK2, anchor="middle"))
        elif i == 2:
            o.append(t(ix, iy + 22, "4410281 · Brake pads, front", 14, INK, "b w7"))
            o.append(t(ix, iy + 46, "G-14-04-02", 15, INK, LB))
            o.append(f'<use href="#i-arrow-r" x="{ix+84}" y="{iy+33}" width="16" height="16" stroke="{INK}" color="{INK}"/>')
            o.append(t(ix + 108, iy + 46, "G-14-01-04", 15, INK, LB))
            o.append(f'<rect x="{ix+192}" y="{iy+33}" width="36" height="16" rx="2" fill="{BEST_L}"/>')
            o.append(t(ix + 210, iy + 45, "BEST", 11, "#fff", LB, "middle"))
            o.append(f'<rect x="{ix}" y="{iy+76}" width="122" height="44" rx="6" fill="{INK}"/>')
            o.append(f'<use href="#i-check" x="{ix+16}" y="{iy+89}" width="18" height="18" stroke="#fff" color="#fff"/>')
            o.append(t(ix + 40, iy + 104, "Apply", 15, "#fff", "b w7"))
            o.append(f'<rect x="{ix+134}" y="{iy+76}" width="132" height="44" rx="6" fill="#fff" stroke="{INK}" stroke-width="1.2"/>')
            o.append(t(ix + 200, iy + 104, "Keep in place", 15, INK, "b w6", "middle"))
            o.append(t(ix, iy + 152, "Nothing changes until you apply it.", 13, INK2))
        else:
            o.append(f'<rect x="{ix}" y="{iy}" width="{pw-40}" height="176" fill="#fff" stroke="#000" stroke-width="1"/>')
            o.append(t(ix + 12, iy + 22, "Move list · Spring re-slot 2026", 12, "#000", "b w7"))
            o.append(f'<rect x="{ix+12}" y="{iy+34}" width="{pw-64}" height="1.5" fill="#000"/>')
            o.append(f'<rect x="{ix+12}" y="{iy+44}" width="62" height="20" fill="none" stroke="#000" stroke-width="1.5"/>')
            o.append(t(ix + 43, iy + 59, "ROUND 1", 12, "#000", LB, "middle"))
            o.append(t(ix + 84, iy + 59, "one walk", 11, "#000"))
            lines = [("4410281", "G-14-04-02", "G-14-01-04", True), ("5520114", "C-03-03-01", "A-02-01-02", False),
                     ("3301877", "B-07-04-03", "A-03-02-01", False)]
            for r, (p, f, to, hl) in enumerate(lines):
                ly2 = iy + 76 + r * 32
                o.append(f'<rect x="{ix+12}" y="{ly2+6}" width="14" height="14" fill="none" stroke="#000" stroke-width="1.2"/>')
                if hl:
                    o.append(f'<path d="M{ix+13} {ly2+12} l4 6 l10 -14" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round"/>')
                o.append(t(ix + 34, ly2 + 18, p, 12.5, "#000", LB))
                o.append(t(ix + 92, ly2 + 18, f, 12.5, "#000", LB))
                o.append(t(ix + 160, ly2 + 18, "→", 12, "#000"))
                o.append(t(ix + 174, ly2 + 18, to, 12.5, "#000", LB))
                o.append(f'<rect x="{ix+12}" y="{ly2+28}" width="{pw-64}" height="1" fill="#000" fill-opacity="0.35"/>')
    return svg("Smart Warehouse Planner — Demo front page (Bin Wall)",
               "Front page of the public demo deployment: what the tool does, Log in, Create account and Demo version, a bin wall with one bin lifted to a best location with its reason, and four panels following part 4410281 from its export row to the printed move list.",
               "\n".join(o), h=900)


# ---------------------------------------------------------------- C: paper first
def make_c():
    o = []
    # dark hero band with a faint wall behind
    o.append('<rect x="0" y="0" width="1440" height="600" fill="url(#louvre2)"/>')
    g = [list("FMS.DFSMFD.S"), list("SD.FMSDFS.MF"), list("MFSDF.MSDFMS"), list("DS.MSFDM.SFD")]
    w, W, H = wall(560, 110, g, bw=56, bh=52, per_section=4)
    o.append(f'<g opacity="0.32">{w}</g>')
    o.append('<rect x="0" y="0" width="760" height="600" fill="#30353A" fill-opacity="0.82"/>')
    o.append(header())
    o.append(t(72, 176, "Hand your team", 66, "#fff", LB))
    o.append(t(72, 246, "a list, not a", 66, "#fff", LB))
    o.append(t(72, 316, "spreadsheet.", 66, "#fff", LB))
    o.append(t(72, 370, "Upload your warehouse exports, check the suggested", 19, ONDARK))
    o.append(t(72, 396, "moves, and print a move list your colleagues can", 19, ONDARK))
    o.append(t(72, 422, "carry out without you.", 19, ONDARK))
    o.append(btn_primary(72, 454, "Log in", 140, dark=False))
    o.append(btn_secondary(228, 454, "Create account", 172, dark=True))
    # A4 sheet
    sx, sy, sw, sh = 820, 108, 520, 600
    o.append(f'<g filter="url(#pop)" transform="rotate(-1.6 {sx+sw/2} {sy+sh/2})"><rect x="{sx}" y="{sy}" width="{sw}" height="{sh}" fill="#fff"/></g>')
    o.append(f'<g transform="rotate(-1.6 {sx+sw/2} {sy+sh/2})">')
    px = sx + 32
    o.append(t(px, sy + 46, "Move list · Spring re-slot 2026", 20, "#000", LB))
    o.append(t(px, sy + 70, "Data as of 2026-09-30 · 2 rounds", 12.5, "#000"))
    o.append(t(px, sy + 88, "Generated 2026-11-11 10:05 · Smart Warehouse Planner", 12.5, "#000"))
    cols = [("", 0), ("Rnd", 26), ("Part", 60), ("Description", 126), ("From", 266), ("To", 360)]
    y = sy + 116
    o.append(f'<rect x="{px}" y="{y}" width="{sw-64}" height="2" fill="#000"/>')
    for name, dx in cols:
        o.append(t(px + dx, y + 20, name, 11.5, "#000", "b w7"))
    y += 30
    data = {1: [("4410281", "Brake pads, front", "G-14-04-02", "A-02-01-01", 1),
                ("5520114", "Oil filter", "C-03-03-01", "A-02-01-02", 1),
                ("3301877", "Wiper blade set", "B-07-04-03", "A-03-02-01", 1),
                ("6612040", "Air filter", "D-11-04-01", "A-03-02-02", 0),
                ("7781205", "Brake disc, rear", "F-06-03-02", "A-03-01-01", 0)],
            2: [("2290033", "Spark plug", "A-02-01-03", "H-05-04-02", 0),
                ("1184520", "Fuel pump", "A-03-01-02", "H-05-04-03", 0),
                ("9032116", "Door seal", "A-03-02-03", "H-06-04-01", 0)]}
    for rnd, rows in data.items():
        o.append(f'<rect x="{px}" y="{y}" width="{sw-64}" height="2" fill="#000"/>')
        o.append(f'<rect x="{px}" y="{y+10}" width="78" height="24" fill="none" stroke="#000" stroke-width="1.5"/>')
        o.append(t(px + 39, y + 27, f"ROUND {rnd}", 14, "#000", LB, "middle"))
        o.append(t(px + 92, y + 27, "one walk · from-location before to-location", 11.5, "#000"))
        y += 44
        for p, d, f, to, done in rows:
            o.append(f'<rect x="{px}" y="{y+5}" width="15" height="15" fill="none" stroke="#000" stroke-width="1.2"/>')
            if done:
                o.append(f'<path d="M{px+1} {y+11} l5 7 l12 -17" fill="none" stroke="#1F3A8A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>')
            o.append(t(px + 26, y + 17, str(rnd), 13, "#000", LB))
            o.append(t(px + 60, y + 17, p, 13, "#000", LB))
            o.append(t(px + 126, y + 17, d, 12, "#000"))
            o.append(t(px + 266, y + 17, f, 13, "#000", LB))
            o.append(t(px + 360, y + 17, to, 13, "#000", LB))
            o.append(f'<rect x="{px}" y="{y+28}" width="{sw-64}" height="1" fill="#000" fill-opacity="0.3"/>')
            y += 34
        y += 6
    o.append(t(px, sy + sh - 26, "Lines follow Walk Path; an emptied location always comes before a move into it.", 10.5, "#000"))
    o.append("</g>")
    # three points on paper
    py = 680
    pts = [("F", "Fast parts go first", "The busiest parts move", "to your best locations."),
           ("M", "You stay in charge", "Every suggestion has a reason.", "Apply it or keep in place."),
           ("S", "One walk per round", "Lines follow the walk path,", "with a tick box per move.")]
    for i, (c, a, b1, b2) in enumerate(pts):
        x = 72 + i * 240
        o.append(bin_(x, py, c, 48, 44))
        o.append(t(x, py + 78, a, 17, INK, "b w7"))
        o.append(t(x, py + 100, b1, 13.5, INK2))
        o.append(t(x, py + 118, b2, 13.5, INK2))
    return svg("Smart Warehouse Planner — Landing C: Paper first",
               "Landing page example C: graphite hero with a faint bin wall, headline, Log in and Create account, a printed A4 move list as the main picture, and three short points.",
               "\n".join(o), h=900)


if __name__ == "__main__":
  OUT = sys.argv[1]
  os.makedirs(OUT, exist_ok=True)
  for name, fn in (("A-before-after.svg", make_a), ("B-follow-one-part.svg", make_b), ("C-paper-first.svg", make_c)):
      open(os.path.join(OUT, name), "w").write(fn())
      print("wrote", name)
