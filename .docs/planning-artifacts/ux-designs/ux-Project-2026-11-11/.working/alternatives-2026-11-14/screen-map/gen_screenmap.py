"""Three screen-map alternatives (Bin Wall style). Usage: python3 gen_screenmap.py [out_dir]

A  journey storyboard  - the screens in the order the planner meets them, on one track
B  flow-bar map        - the 8 steps hang off an enlarged flow bar; the rest sits around it
C  sitemap             - five places left to right, with what opens on top and what leaves on paper

Thumbnails are drawn by screens.py at fixed type sizes (11px minimum), never scaled down.
"""
import os, sys
from screens import *  # noqa: F401,F403
from screens import (t, rect, tw, fit, icon, S, card, paper, toolbar, tag, uid, EXTRA_DEFS, svg,
                     ov_partpanel, ov_manual, ov_drop, ov_keycolour, ov_recdetail, ov_launcher,
                     ov_usermenu, ov_frontpage, STEPS, CODES, INK, INK2, INK3, GROUND, BORDER, HAIR,
                     ONDARK, ONDARK_NAV, ACCENT, LB, TRACK, TRACK_E, MUTED_D)

RAIL = "#454B52"
LINE = "#5E646B"


def eyebrow(x, y, s):
    return t(x, y, s, 13.5, INK2, LB, extra=' letter-spacing="1.6"')


def arrow(pts, color=LINE, dashed=False, w=1.6, marker="ahg", r=8):
    """Orthogonal polyline with rounded corners and an arrowhead."""
    d = f"M{pts[0][0]} {pts[0][1]}"
    for i in range(1, len(pts) - 1):
        (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
        dx0, dy0 = (x1 > x0) - (x1 < x0), (y1 > y0) - (y1 < y0)
        dx1, dy1 = (x2 > x1) - (x2 < x1), (y2 > y1) - (y2 < y1)
        rr = min(r, abs(x1 - x0 + y1 - y0) / 2, abs(x2 - x1 + y2 - y1) / 2)
        d += f" L{x1 - dx0*rr} {y1 - dy0*rr} Q{x1} {y1} {x1 + dx1*rr} {y1 + dy1*rr}"
    d += f" L{pts[-1][0]} {pts[-1][1]}"
    da = ' stroke-dasharray="5 4"' if dashed else ""
    m = f' marker-end="url(#{marker})"' if marker else ""
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{da}{m}/>'


def label_on(x, y, s, size=12, anchor="start", cls="b w6", fill=INK, bg=GROUND):
    w = tw(s, size, cls) + 10
    bx = x - 5 if anchor == "start" else (x - w / 2 if anchor == "middle" else x - w + 5)
    return rect(bx, y - size - 1, w, size + 7, bg, 3) + t(x, y, s, size, fill, cls, anchor)


def code_chip(x, y, s, anchor="end"):
    w = tw(s, 12.5, LB) + 14
    bx = x - w if anchor == "end" else x
    return rect(bx, y, w, 22, "#fff", 3, INK, 1.2) + t(bx + w / 2, y + 15.5, s, 12.5, INK, LB, "middle"), w


# =========================================================================== A
A_ITEMS = [
    ("login", "Log in", None, "Username and password. Demo version skips it.", "Log in", "saved-plans list"),
    ("saved", "Saved plans", "SAV", "The start page: every plan, last edited first.", "New Plan", "or open a plan (UJ-3)"),
    ("new", "New Plan", "NEW", "Name the plan and choose the three exports.", "Import passes", "Plan overview"),
    ("overview", "Plan overview", "OVR · 1", "What was imported, counted by movement class.", "Flow bar", "Parts"),
    ("parts", "Parts", "PRT · 2", "Every part ranked by picks. Keep one in place.", "Flow bar", "Locations"),
    ("locations", "Locations", "LOC · 3", "Aisle cards and the open aisle as a bin wall.", "Flow bar", "Pick groups"),
    ("groups", "Pick groups", "GRP · 4", "Parts picked together, and whether they share an aisle.", "Flow bar", "Best locations"),
    ("best", "Best locations", "BST · 5", "Mark a whole aisle, a level or single locations.", "Flow bar", "Recommendations"),
    ("recs", "Recommendations", "REC · 6", "Run, then Apply, Other location or Keep in place.", "Flow bar", "Before/after"),
    ("ba", "Before/after", "B/A · 7", "Aisle by aisle: moves in, moves out, fast in best.", "Flow bar", "Move list"),
    ("move", "Move list", "MOV · 8", "A black-and-white paper preview, then Print.", "Print", "the colleague"),
    ("paper", "On paper", None, "The colleague ticks each line, round by round.", None, "No app needed for the walk (UJ-2)"),
]


def make_a():
    W = 1440
    o = [EXTRA_DEFS]
    o.append(eyebrow(56, 62, "SCREEN MAP · A · IN JOURNEY ORDER"))
    o.append(t(56, 118, "One plan, start to finish.", 54, INK, LB))
    o.append(t(56, 156, "The screens in the order the planner meets them while building a plan (UJ-1),", 17, INK))
    o.append(t(56, 180, "ending with the paper a colleague carries through the warehouse (UJ-2).", 17, INK))
    # toolbar legend (right)
    lx, ly, lw = 900, 70, 484
    o.append(t(lx, ly - 12, "Every plan screen keeps this toolbar", 13, INK, "b w7"))
    o.append(rect(lx - 1, ly - 1, lw + 2, 32, "none", 2, INK, 1))
    o.append(toolbar(lx, ly, lw, step=6))
    # leader labels, staggered so they never collide
    marks = [(lx + 93, 0, "Plan plate"), (lx + 300, 0, "Flow bar · 8 steps, any order"),
             (lx + lw - 42, 1, "Launcher (Ctrl/Cmd+K)"), (lx + lw - 18, 2, "User menu · Log out")]
    for px, lvl, s in marks:
        yy = ly + 46 + lvl * 17
        o.append(rect(px - 0.6, ly + 31, 1.2, yy - ly - 41, INK))
        anchor = "middle" if lvl == 0 else "end"
        tx = px if lvl == 0 else px + 6
        o.append(t(tx, yy, s, 12, INK2, "b w5", anchor))

    # grid
    x0, G, cw = 56, 49, 410
    th, y0, pitch = 228, 236, 352
    cols = [x0 + c * (cw + G) for c in range(3)]
    for r in range(4):
        ty = y0 + r * pitch
        # rail across the row
        last = r == 3
        xs, xe = (40 if r else 56), (cols[2] + cw - 60 if last else 1400)
        o.append(rect(xs, ty - 3, xe - xs, 6, RAIL, 3))
        if not last:
            ry = ty + 30 + th + 54
            o.append(arrow([(1400, ty), (1408, ty), (1408, ry), (40, ry), (32, ry), (32, ty + pitch), (40, ty + pitch)],
                           RAIL, w=6, marker=None, r=14))
            o.append(f'<path d="M722 {ry-7} l-11 7 11 7z" fill="{RAIL}"/>')
        for c in range(3):
            i = r * 3 + c
            key, title, code, line1, trig, nxt = A_ITEMS[i]
            cx = cols[c]
            # gutter chevron
            if c < 2:
                gx = cx + cw + G / 2
                o.append(f'<path d="M{gx-5} {ty-9} l10 9 -10 9" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
            # station + title plate
            o.append(f'<circle cx="{cx+22}" cy="{ty}" r="21" fill="{INK}" stroke="{GROUND}" stroke-width="4"/>')
            o.append(t(cx + 22, ty + 7, str(i + 1), 19, "#fff", LB, "middle"))
            tw_ = tw(title, 22, LB)
            o.append(rect(cx + 42, ty - 15, tw_ + 22, 30, GROUND))
            o.append(t(cx + 54, ty + 8, title, 22, INK, LB))
            if code:
                chip, w = code_chip(cx + cw, ty - 11, code)
                o.append(rect(cx + cw - w - 6, ty - 13, w + 6, 26, GROUND))
                o.append(chip)
            by = ty + 30
            if key == "paper":
                o.append(paper(cx + 40, by + 4, cw - 80, th - 2, rot=-1.4, lines=4, rounds=2, ticks=3))
            else:
                o.append(S(key, cx, by, cw, th))
            # captions
            o.append(t(cx, by + th + 24, line1, 14, INK, "b w6"))
            if trig:
                o.append(t(cx, by + th + 44, "Next:", 13, INK2))
                o.append(t(cx + 40, by + th + 44, trig, 13, INK, "b w7"))
                o.append(t(cx + 44 + tw(trig, 13, "b w7"), by + th + 44, f"→ {nxt}", 13, INK2))
            else:
                o.append(t(cx, by + th + 44, nxt, 13, INK2))
    # end cap
    ey = y0 + 3 * pitch
    o.append(rect(cols[2] + cw - 66, ey - 9, 6, 18, RAIL, 2))

    # side doors
    sy = y0 + 3 * pitch + 30 + th + 104
    o.append(rect(56, sy - 46, 1328, 1, BORDER))
    o.append(t(56, sy, "Side doors", 28, INK, LB))
    o.append(t(200, sy - 1, "Off the path, one click away when needed.", 15, INK2))
    doors = [("Create account", "From Log in · no email, no reset", lambda x, y, w, h: S("create", x, y, w, h, chrome=False)),
             ("Import stopped", "New Plan, when a file fails", lambda x, y, w, h: S("new_err", x, y, w, h, chrome=False)),
             ("Settings", "Launcher SET or Overview · read-only", lambda x, y, w, h: S("settings", x, y, w, h, chrome=False)),
             ("Launcher", "Grid button or Ctrl/Cmd+K", ov_launcher),
             ("User menu", "Avatar · Log out → Log in", ov_usermenu)]
    dw, dg, dh = 248, 22, 246
    for i, (a, b, fn) in enumerate(doors):
        dx = 56 + i * (dw + dg)
        dy = sy + 48
        o.append(t(dx, dy - 22, a, 17, INK, LB))
        o.append(t(dx, dy - 6, b, 12.5, INK2))
        o.append(card(dx, dy, dw, dh, fn) if fn in (ov_launcher, ov_usermenu) else fn(dx, dy, dw, dh))
    H = sy + 48 + dh + 56
    return svg("Smart Warehouse Planner — Screen map A: journey order",
               "Screen map alternative A: twelve frames on one track in the order the planner meets them, from Log in to the printed move list, plus five side doors.",
               "\n".join(o), h=int(H))


# =========================================================================== B
def flow_pill(x, y, n, name, state):
    """One flow-bar step at real size. state: done / current / todo. Returns (svg, width)."""
    nw = tw(name, 14, "b w6")
    w = nw + 40
    o = []
    if state == "current":
        o.append(rect(x, y, w, 34, "#fff", 4))
        o.append(f'<circle cx="{x+16}" cy="{y+17}" r="9" fill="none" stroke="{INK}" stroke-width="1.6"/>')
        o.append(t(x + 16, y + 21.5, str(n), 12, INK, LB, "middle"))
        o.append(t(x + 32, y + 22, name, 14, INK, "b w7"))
    elif state == "done":
        o.append(f'<circle cx="{x+16}" cy="{y+17}" r="9" fill="{ONDARK_NAV}"/>')
        o.append(f'<path d="M{x+11.5} {y+17.4} l3.2 3.2 5.8 -6.2" fill="none" stroke="{INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')
        o.append(t(x + 32, y + 22, name, 14, ONDARK_NAV, "b w6"))
    else:
        o.append(f'<circle cx="{x+16}" cy="{y+17}" r="9" fill="none" stroke="{MUTED_D}" stroke-width="1.4"/>')
        o.append(t(x + 16, y + 21.5, str(n), 12, MUTED_D, LB, "middle"))
        o.append(t(x + 32, y + 22, name, 14, MUTED_D, "b w6"))
    return "".join(o), w


def make_b():
    o = [EXTRA_DEFS]
    o.append(eyebrow(48, 62, "SCREEN MAP · B · BUILT AROUND THE FLOW BAR"))
    o.append(t(48, 118, "Eight steps, one bar.", 54, INK, LB))
    o.append(t(48, 156, "Inside a plan the bar never changes. Any step opens at any time;", 17, INK))
    o.append(t(48, 180, "the check marks only report what is done. Everything else sits around it.", 17, INK))
    # how to read the bar (header right)
    hx, hy = 960, 78
    o.append(t(hx, hy - 12, "How to read a step", 13, INK, "b w7"))
    o.append(rect(hx, hy, 432, 52, TRACK, 8, TRACK_E, 1))
    xx = hx + 10
    for name, st in (("Done", "done"), ("You are here", "current"), ("Not reached", "todo")):
        s, w = flow_pill(xx, hy + 9, 6, name, st)
        o.append(s)
        xx += w + 22
    o.append(t(hx, hy + 76, "Every step stays clickable; nothing is locked.", 12.5, INK2))

    # ---- lane: before a plan is open
    ly, lh = 262, 222
    o.append(eyebrow(48, ly - 30, "BEFORE A PLAN IS OPEN"))
    for key, x, w in (("login", 48, 236), ("saved", 324, 372), ("new", 736, 372)):
        o.append(S(key, x, ly, w, lh))
    o.append(arrow([(286, ly + 98), (322, ly + 98)], INK, marker="ahi"))
    o.append(label_on(304, ly - 8, "Log in", 12, "middle"))
    o.append(arrow([(698, ly + 98), (734, ly + 98)], INK, marker="ahi"))
    o.append(label_on(716, ly - 8, "New Plan", 12, "middle"))
    o.append(t(48, ly + lh + 19, "Create account, Demo version: on Log in", 12, INK2))
    o.append(eyebrow(1148, ly - 30, "FROM ANY PAGE"))
    o.append(card(1148, ly, 244, 150, ov_launcher))
    o.append(t(1148, ly + 172, "Launcher · grid button or", 12.5, INK2))
    o.append(t(1148, ly + 189, "Ctrl/Cmd+K: every screen by code", 12.5, INK2))

    # ---- geometry
    by, bh = 756, 52
    px0, pw = 48, 222
    cols_x0 = px0 + pw + 14
    colw = (1392 - cols_x0) / 4
    tw_ = colw - 14
    ut, uh = 522, 196
    lt = by + bh + 40
    # plan plate
    o.append(rect(px0, by + 4, pw, 44, "#fff", 3))
    o.append(rect(px0, by + 4, 6, 44, INK, 2))
    o.append(t(px0 + 16, by + 23, "Spring re-slot 2026", 16, INK, LB))
    o.append(t(px0 + 16, by + 40, "Data as of 2026-09-30 · round 1", 11.5, INK2))
    o.append(icon("i-chev-d", px0 + pw - 24, by + 17, 16, INK))
    # the track, steps at natural width spread evenly
    tx0, tx1 = cols_x0 - 6, 1392
    o.append(rect(tx0, by, tx1 - tx0, bh, TRACK, 8, TRACK_E, 1))
    states = ["done"] * 5 + ["current", "todo", "todo"]
    widths = [tw(n, 14, "b w7" if st == "current" else "b w6") + 40 for n, st in zip(STEPS, states)]
    gap = (tx1 - tx0 - 16 - sum(widths)) / 7
    xx = tx0 + 8
    centers = []
    for i in range(8):
        s, w = flow_pill(xx, by + 9, i + 1, STEPS[i], states[i])
        o.append(s)
        centers.append(xx + w / 2)
        xx += w + gap

    # ---- step thumbs (zigzag: odd above, even below) with stems
    keys = ["overview", "parts", "locations", "groups", "best", "recs", "ba", "move"]
    for i, k in enumerate(keys):
        c, half = divmod(i, 2)
        x = cols_x0 + c * colw
        pc = centers[i]
        sx = min(max(pc, x + 26), x + tw_ - 26)
        if half == 0:
            o.append(S(k, x, ut, tw_, uh, chrome=False))
            ey = ut + uh
            pts = [(pc, by + 2), (pc, by - 18), (sx, by - 18), (sx, ey)] if abs(pc - sx) > 1 else [(pc, by + 2), (pc, ey)]
        else:
            o.append(S(k, x, lt, tw_, uh, chrome=False))
            ey = lt
            pts = [(pc, by + bh - 2), (pc, by + bh + 18), (sx, by + bh + 18), (sx, ey)] if abs(pc - sx) > 1 else [(pc, by + bh - 2), (pc, ey)]
        o.append(arrow(pts, INK, w=2, marker=None, r=6))
        o.append(f'<circle cx="{sx}" cy="{ey}" r="4.5" fill="{INK}"/>')
        chip, _ = code_chip(x + tw_ - 8, (ut if half == 0 else lt) + 9, CODES[i])
        o.append(chip)

    # ---- arrows from the lane into the plan
    o.append(arrow([(380, ly + lh), (380, 520), (110, 520), (110, by + 2)], INK, marker="ahi"))
    o.append(t(124, 566, "Open a plan", 14, INK, "b w7"))
    o.append(t(124, 584, "back where you", 12.5, INK2))
    o.append(t(124, 600, "left it (UJ-3)", 12.5, INK2))
    o.append(arrow([(922, ly + lh), (922, 503), (460, 503), (460, ut - 2)], INK, marker="ahi"))
    o.append(label_on(690, 497, "Import passes → step 1", 12.5, "middle"))
    o.append(t(124, 680, "Plate menu:", 12.5, INK, "b w7"))
    o.append(t(124, 697, "switch plan, All saved", 12.5, INK2))
    o.append(t(124, 714, "plans, New Plan from", 12.5, INK2))
    o.append(t(124, 731, "this import", 12.5, INK2))

    # ---- below the plate: Settings
    o.append(t(px0, lt + 10, "Not a step", 16, INK, LB))
    o.append(t(px0 + 82, lt + 10, "SET in the launcher", 12, INK2))
    o.append(S("settings", px0, lt + 22, pw, uh - 22, chrome=False, title_size=16))

    # ---- bottom: leaving the plan
    bt = lt + uh + 64
    o.append(rect(48, bt - 30, 1344, 1, BORDER))
    o.append(eyebrow(48, bt + 4, "LEAVING THE PLAN"))
    o.append(card(48, bt + 20, 236, 140, ov_usermenu))
    o.append(t(304, bt + 46, "User menu", 18, INK, LB))
    o.append(t(304, bt + 68, "The avatar at the bar’s right end.", 13, INK2))
    o.append(t(304, bt + 86, "Log out returns to Log in", 13, INK2))
    o.append(t(304, bt + 104, "(public demo: the front page).", 13, INK2))
    mx = cols_x0 + 3 * colw
    o.append(arrow([(mx + tw_ - 40, lt + uh), (mx + tw_ - 40, bt + 92), (mx - 6, bt + 92)], INK, marker="ahi"))
    o.append(paper(mx - 256, bt + 14, 236, 170, rot=-1.5, lines=3, rounds=1, ticks=2))
    o.append(t(mx - 560, bt + 46, "Printed", 18, INK, LB))
    o.append(t(mx - 560, bt + 68, "Black and white, one walk per round.", 13, INK2))
    o.append(t(mx - 560, bt + 86, "The colleague needs no app (UJ-2).", 13, INK2))
    H = bt + 206
    return svg("Smart Warehouse Planner — Screen map B: flow bar",
               "Screen map alternative B: an enlarged flow bar with the eight step screens hanging above and below it, the screens before a plan is open, the launcher, Settings, the user menu and the printed move list.",
               "\n".join(o), h=int(H))


# =========================================================================== C
def cap(x, y, name, sub=None, w=None):
    o = t(x, y, name, 15, INK, LB)
    if sub:
        o += t(x, y + 16, fit(sub, 12, w or 400), 12, INK2)
    return o


def make_c():
    o = [EXTRA_DEFS]
    o.append(eyebrow(40, 62, "SCREEN MAP · C · SITEMAP"))
    o.append(t(40, 118, "Where every screen lives.", 54, INK, LB))
    o.append(t(40, 156, "Five places, left to right: outside the app, your plans, inside a plan,", 17, INK))
    o.append(t(40, 180, "what opens on top of a page, and what leaves on paper.", 17, INK))
    C0, C1, C2, C3, C4 = 40, 262, 524, 980, 1252
    W0, W1, W2, W3, W4 = 190, 230, 424, 240, 148
    hy = 236
    for x, w, a, b in ((C0, W0, "Outside", "Public pages"), (C1, W1, "Your plans", "After login"),
                       (C2, W2, "Inside a plan", "The flow bar’s 8 steps"), (C3, W3, "Opens on top", "Panels, dialogs, menus"),
                       (C4, W4, "On paper", "Leaves the app")):
        o.append(rect(x, hy - 30, w, 4, INK))
        o.append(t(x, hy, a, 22, INK, LB))
        o.append(t(x, hy + 20, b, 12.5, INK2))
    top = hy + 56
    # ---------- c2: toolbar + 8 rows + settings
    tb_y = top + 26
    o.append(cap(C2 + 36, top + 14, "Toolbar on every plan page"))
    o.append(rect(C2 + 35, tb_y - 1, W2 - 34, 32, "none", 2, INK, 1))
    o.append(toolbar(C2 + 36, tb_y, W2 - 36, step=6))
    r0 = tb_y + 58
    pitch, ch = 140, 122
    rail_x = C2 + 14
    o.append(rect(rail_x - 12, r0 - 14, 24, 7 * pitch + ch / 2 + 22, TRACK, 6, TRACK_E, 1))
    keys = ["overview", "parts", "locations", "groups", "best", "recs", "ba", "move"]
    rows_y = []
    for i, k in enumerate(keys):
        y = r0 + i * pitch
        rows_y.append(y)
        o.append(f'<circle cx="{rail_x}" cy="{y+ch/2}" r="10" fill="#fff"/>')
        o.append(t(rail_x, y + ch / 2 + 4.5, str(i + 1), 13, INK, LB, "middle"))
        o.append(f'<path d="M{rail_x+10} {y+ch/2} H{C2+36}" stroke="{TRACK}" stroke-width="2"/>')
        o.append(S(k, C2 + 36, y, W2 - 36, ch, chrome=False, title_size=15, compact=True))
        chip, _ = code_chip(C2 + W2 - 8, y + 8, CODES[i])
        o.append(chip)
    sy = r0 + 8 * pitch + 20
    o.append(cap(C2 + 36, sy - 10, "Not a step", None))
    o.append(t(C2 + 36 + 80, sy - 10, "SET in the launcher, or the link on the overview", 12, INK2))
    o.append(S("settings", C2 + 36, sy, W2 - 36, 150, chrome=False, title_size=15))
    chip, _ = code_chip(C2 + W2 - 8, sy + 8, "SET")
    o.append(chip)
    # ---------- c0 outside
    fy = top + 26
    o.append(cap(C0, top + 14, "Front page", None))
    o.append(t(C0 + 78, top + 14, "public demo only", 12, INK2))
    o.append(card(C0, fy, W0, 120, ov_frontpage))
    ly = fy + 120 + 56
    o.append(cap(C0, ly - 12, "Log in"))
    o.append(S("login", C0, ly, W0, 196, chrome=False))
    cy = ly + 196 + 56
    o.append(cap(C0, cy - 12, "Create account"))
    o.append(S("create", C0, cy, W0, 230, chrome=False))
    o.append(t(C0, cy + 248, "No email, no password reset.", 12, INK2))
    o.append(arrow([(C0 + W0 - 30, fy + 120), (C0 + W0 - 30, ly - 2)], INK, marker="ahi"))
    o.append(arrow([(C0 + W0 - 30, ly + 196), (C0 + W0 - 30, cy - 2)], LINE, marker="ahg"))
    o.append(arrow([(C0 + W0 - 56, cy), (C0 + W0 - 56, ly + 196 + 2)], LINE, marker="ahg"))
    # ---------- c1 your plans
    sv = top + 26
    o.append(cap(C1, top + 14, "Saved plans · SAV"))
    o.append(S("saved", C1, sv, W1, 210))
    o.append(t(C1, sv + 228, "Open a plan → its toolbar", 12, INK2))
    np_y = sv + 210 + 70
    o.append(cap(C1, np_y - 12, "New Plan · NEW"))
    o.append(S("new", C1, np_y, W1, 246))
    o.append(t(C1, np_y + 264, "Import passes → step 1", 12, INK2))
    um_y = np_y + 246 + 70
    o.append(cap(C1, um_y - 12, "User menu"))
    o.append(t(C1 + 78, um_y - 12, "avatar, every page", 12, INK2))
    o.append(card(C1, um_y, W1, 136, ov_usermenu))
    o.append(t(C1, um_y + 154, "Log out → Log in", 12, INK2))
    # edges
    g01 = C0 + W0 + 16
    o.append(arrow([(C0 + W0, ly + 110), (g01, ly + 110), (g01, sv + 105), (C1 - 2, sv + 105)], INK, marker="ahi"))
    o.append(arrow([(C1 + W1 - 30, sv + 210), (C1 + W1 - 30, np_y - 2)], INK, marker="ahi"))
    g12 = C1 + W1 + 16
    o.append(arrow([(C1 + W1, sv + 50), (g12, sv + 50), (g12, tb_y + 15), (C2 + 33, tb_y + 15)], INK, marker="ahi"))
    o.append(arrow([(C1 + W1, np_y + 105), (g12, np_y + 105), (g12, rows_y[0] + ch / 2), (rail_x - 14, rows_y[0] + ch / 2)],
                   INK, marker="ahi"))
    o.append(arrow([(C1, um_y + 100), (g01, um_y + 100), (g01, ly + 160), (C0 + W0 + 2, ly + 160)], LINE, dashed=True, marker="ahg"))
    # ---------- c3 overlays: stacked, aligned with their parent row when there is room
    items = [("Launcher", "Ctrl/Cmd+K", ov_launcher, 150, "tb"),
             ("Part panel", "row, tooltip or rec", ov_partpanel, 124, 1),
             ("Drop dialog", "drag a bin · FR-51", ov_drop, 124, 2),
             ("Key colour", "click a Key entry", ov_keycolour, 132, 2),
             ("Manual move", "from the part panel", ov_manual, 124, "pp"),
             ("Recommendation detail", "", ov_recdetail, 136, 5)]
    prev_end = top
    placed = {}
    k = 0
    for name, sub, fn, hgt, parent in items:
        if parent == "tb":
            want = tb_y + 15 - 40
        elif parent == "pp":
            want = 0
        else:
            want = rows_y[parent] + ch / 2 - hgt / 2
        y = max(want, prev_end + 30)
        o.append(cap(C3, y - 10, name))
        if sub:
            o.append(t(C3 + tw(name, 15, LB) + 8, y - 10, sub, 12, INK2))
        o.append(card(C3, y, W3, hgt, fn))
        placed[name] = (y, hgt)
        prev_end = y + hgt
        tyc = y + hgt / 2
        if parent == "tb":
            o.append(arrow([(C2 + W2, tb_y + 15), (C2 + W2 + 14, tb_y + 15), (C2 + W2 + 14, tyc), (C3 - 2, tyc)], INK, marker="ahi"))
        elif parent == "pp":
            py, ph = placed["Part panel"]
            ex = C3 + W3 + 14
            o.append(arrow([(C3 + W3, py + ph / 2), (ex, py + ph / 2), (ex, tyc), (C3 + W3 + 2, tyc)], LINE, marker="ahg"))
        else:
            syc = rows_y[parent] + ch / 2
            ex = C2 + W2 + 10 + 6 * (k % 3)
            k += 1
            if abs(syc - tyc) < 1:
                o.append(arrow([(C2 + W2, syc), (C3 - 2, tyc)], INK, marker="ahi"))
            else:
                o.append(arrow([(C2 + W2, syc), (ex, syc), (ex, tyc), (C3 - 2, tyc)], INK, marker="ahi"))
    # ---------- c4 paper
    my = rows_y[7] + ch / 2
    o.append(arrow([(C2 + W2, my), (C4 - 4, my)], INK, marker="ahi"))
    o.append(label_on(C3 + 20, my - 8, "Print, from the browser", 12))
    o.append(paper(C4 + 4, my - 96, W4 - 8, 196, rot=-1.5, lines=4, rounds=2, ticks=2))
    o.append(cap(C4, my + 128, "Move list, A4"))
    o.append(t(C4, my + 146, "The colleague’s walk:", 12, INK2))
    o.append(t(C4, my + 162, "one round at a time,", 12, INK2))
    o.append(t(C4, my + 178, "a tick box per line.", 12, INK2))
    H = max(sy + 150, prev_end, my + 190) + 48
    return svg("Smart Warehouse Planner — Screen map C: sitemap",
               "Screen map alternative C: a sitemap in five places (outside, your plans, inside a plan, opens on top, on paper) with every screen, overlay and the printed move list, and the links between them.",
               "\n".join(o), h=int(H))


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    for name, fn in (("A-journey-storyboard.svg", make_a), ("B-flow-bar-map.svg", make_b), ("C-sitemap.svg", make_c)):
        open(os.path.join(out, name), "w").write(fn())
        print("wrote", name)
