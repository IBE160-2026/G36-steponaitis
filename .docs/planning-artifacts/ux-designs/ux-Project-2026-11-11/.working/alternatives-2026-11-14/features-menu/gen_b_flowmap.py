"""B: Flow map drawer. The flow bar unfolds into a map: one column per step, its state and its actions."""
import os
from fm_common import *  # noqa: F401,F403

X0, GAP = 24, 8
CW = (1392 - 7 * GAP) / 8          # column width
DY0, DY1 = 64, 760                  # drawer top / bottom
TRACK_Y = 214

# (state lines, actions[(icon, label, keys-or-None)])
COLS = [
    (("1,545 parts", "2,000 locations"),
     [("i-grid", "Open overview", None), ("i-sliders", "Analysis settings", None)]),
    (("142 fast-moving", "636 dead stock"),
     [("i-search", "Find a part", None), ("i-stack", "Filter by class", None), ("i-pin", "Keep in place…", None)]),
    (("79.2% occupied", "416 empty"),
     [("i-wall", "Open the wall", None), ("i-list", "Open as list", None), ("i-lift", "Manual move…", None),
      ("i-info", "Tip: drag a bin", "tip")]),
    (("214 pick groups", "5 or more shared jobs"),
     [("i-link", "Open pick groups", None), ("i-compare", "Different aisles", None)]),
    (("174 best · 7 empty", "6 marks"),
     [("i-ribbon", "Mark whole aisle", None), ("i-ribbon", "Mark a level", None), ("i-ribbon", "Mark one location", None)]),
    (("Round 1 · 15 to apply", "1 outdated · 31 no space"),
     [("i-check", "Continue round 1", None), ("i-undo", "Undo last move", None), ("i-stack", "Apply all (15)…", None),
      ("i-play", "Run round 2", None), ("i-x", "Reset…", None)]),
    (("Moves in and out", "per aisle and total"),
     [("i-compare", "Open the table", None)]),
    (("3 moves · 1 round", "A4, black and white"),
     [("i-file", "Open print view", None), ("i-print", "Print move list", None)]),
]


def col_x(i):
    return X0 + i * (CW + GAP)


def make():
    o = [rec_page(), toolbar(current=6, launcher_open=True), dim(64, 0.55)]
    # drawer
    o.append(f'<g filter="url(#pop)">{rect(0, DY0, 1440, DY1 - DY0, "#fff")}</g>')
    o.append(rect(0, DY1 - 1, 1440, 1, BORDER))
    # pointer from the launcher button
    o.append(f'<path d="M1342 64 L1352 56 L1362 64Z" fill="#fff"/>')
    # ---- head
    o.append(t(X0 + 12, 104, "ALL FEATURES · IN FLOW ORDER", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    o.append(f'<text x="{X0+12}" y="138" class="lb w7" font-size="32" fill="{INK}">Spring re-slot 2026'
             f'<tspan class="b w4" font-size="14" fill="{INK2}" dx="16">Data as of 2026-09-30 · uploaded 2026-10-02 · round 1 · saved automatically</tspan></text>')
    # search
    sx, sw_ = 1036, 380
    o.append(rect(sx, 96, sw_, 44, "#fff", 6, INPUT_B, 1))
    o.append(icon("i-search", sx + 14, 108, 20, INK))
    o.append(t(sx + 44, 124, "Go to: type a code or a name", 14, INK3))
    k, kw = keys(0, 0, ["Ctrl", "K"])
    k, _ = keys(sx + sw_ - 12 - kw, 107, ["Ctrl", "K"])
    o.append(k)
    # ---- track
    o.append(rect(X0, 170, 1392, 1, HAIR))
    xs = [col_x(i) + 26 for i in range(8)]
    o.append(f'<path d="M{xs[0]} {TRACK_Y} H{xs[5]}" stroke="{INK}" stroke-width="3"/>')
    o.append(f'<path d="M{xs[5]} {TRACK_Y} H{xs[7]}" stroke="{INK3}" stroke-width="2" stroke-dasharray="5 5"/>')
    for i in range(8):
        x = col_x(i)
        cur = i == 5
        if cur:
            # "You are here": ink frame around the whole column + tag
            o.append(rect(x - 2, 182, CW + 4, 556 - 182, "none", 8, INK, 2))
        st = "done" if i < 5 else ("current" if cur else "todo")
        r = 15 if cur else 12
        o.append(f'<circle cx="{xs[i]}" cy="{TRACK_Y}" r="{r+4}" fill="#fff"/>')
        o.append(step_disc(xs[i], TRACK_Y, i + 1, st, r=r, dark=False))
        if cur:
            tx = xs[i] + 26
            o.append(rect(tx, TRACK_Y - 12, 92, 24, "#fff", 3, INK, 1.5))
            o.append(t(tx + 46, TRACK_Y + 5, "You are here", 12.5, INK, "b w7", "middle"))
        elif i < 5:
            o.append(rect(xs[i] + 16, TRACK_Y - 10, 44, 20, "#fff"))
            o.append(t(xs[i] + 22, TRACK_Y + 5, "Done", 12.5, INK2, "b w6"))
        else:
            o.append(rect(xs[i] + 16, TRACK_Y - 10, 56, 20, "#fff"))
            o.append(t(xs[i] + 22, TRACK_Y + 5, "Output", 12.5, INK3, "b w6"))
        # code, name, state
        cx = x + 14
        o.append(t(cx, 262, f"{CODES[i]}  ·  STEP {i+1}", 12.5, INK3, "lb w7", extra=' letter-spacing="1"'))
        name = STEPS[i]
        size = 22 if tw(name, 22, "lb w7") < CW - 24 else 20
        o.append(t(cx, 290, name, size, INK, LB))
        s1, s2 = COLS[i][0]
        o.append(t(cx, 314, s1, 13, INK if cur else INK2, "b w7" if cur else "b w5"))
        o.append(t(cx, 333, s2, 13, INK2))
        o.append(rect(cx, 352, CW - 28, 1, HAIR))
        # actions
        ay = 362
        for j, (ic, lab, ks) in enumerate(COLS[i][1]):
            first = j == 0
            if first:
                o.append(rect(cx - 6, ay, CW - 16, 34, INK if cur else PANEL, 5))
            fg = "#fff" if (first and cur) else INK
            if ks == "tip":
                o.append(icon(ic, cx + 2, ay + 8, 18, INK2))
                o.append(t(cx + 28, ay + 22, lab, 13, INK2, "b w5"))
                o.append(t(cx + 28, ay + 40, "to move or swap it", 13, INK2, "b w5"))
                ay += 38
                continue
            o.append(icon(ic, cx + 2, ay + 8, 18, fg))
            o.append(t(cx + 28, ay + 22, lab, 13.5, fg, "b w6"))
            if ks:
                k, kw = keys(0, 0, ks)
                k, _ = keys(cx + CW - 26 - kw, ay + 6, ks)
                o.append(k)
            ay += 38
        assert tw(COLS[i][1][0][1], 13.5, "b w6") + 28 < CW, COLS[i][1][0][1]
    # ---- bottom band: plans, stage 2, keyboard
    by = 576
    o.append(rect(X0, by - 8, 1392, 1, HAIR))
    o.append(t(X0 + 12, by + 22, "PLANS", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    items = [("SAV", "Saved plans", "4 plans, shared by all users"),
             ("NEW", "New Plan", "Three files or a saved import"),
             ("NEW", "New Plan from this import", "Same files, new name"),
             ("SET", "Settings", "Analysis settings · read-only")]
    for k_, (code, name, sub) in enumerate(items):
        ix = X0 + 12 + (k_ % 2) * 300
        iy = by + 38 + (k_ // 2) * 62
        o.append(rect(ix, iy, 286, 52, PANEL, 6, BORDER, 1))
        tg, w = code_tag(ix + 12, iy + 16, code)
        o.append(tg)
        o.append(t(ix + 22 + w, iy + 23, name, 14, INK, "b w7"))
        o.append(t(ix + 22 + w, iy + 41, sub, 12.5, INK2))
    # stage 2
    s2x = X0 + 636
    o.append(t(s2x, by + 22, "COMING IN STAGE 2", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    for k_, (code, name) in enumerate((("CAT", "Category check"), ("LBL", "Location labels"))):
        iy = by + 38 + k_ * 62
        o.append(rect(s2x, iy, 250, 52, "#fff", 6, INPUT_B, 1.2, ' stroke-dasharray="5 4"'))
        o.append(icon("i-lock", s2x + 12, iy + 17, 18, INK3))
        o.append(t(s2x + 38, iy + 32, code, 15, INK3, LB))
        o.append(t(s2x + 76, iy + 32, name, 14, INK2, "b w6"))
    # keyboard
    kx = X0 + 922
    o.append(t(kx, by + 22, "KEYBOARD", 12, INK3, "lb w7", extra=' letter-spacing="1.3"'))
    rows = [(["Ctrl", "K"], "Open this menu"), (["Ctrl", "/"], "Search the page"),
            (["Alt", "A"], "Apply"), (["Alt", "O"], "Other location"),
            (["Alt", "K"], "Keep in place"), (["Esc"], "Close")]
    for k_, (ks, lab) in enumerate(rows):
        cx = kx + (k_ % 2) * 236
        cy = by + 40 + (k_ // 2) * 36
        k, w = keys(cx, cy, ks)
        o.append(k + t(cx + w + 10, cy + 16, lab, 13, INK))
    o.append(t(kx, by + 160, "Alt keys work on the selected recommendation. ⌘ and ⌥ on a Mac.", 12, INK3))
    return svg("Smart Warehouse Planner — Features menu B: Flow map drawer",
               "Alternative B for the features menu: the flow bar unfolds into a white drawer over the dimmed Recommendations page. "
               "One column per flow step on a track with done checks and You are here at step 6, each with its code, state counts and actions; "
               "below are plans and settings, the stage-2 slots and every keyboard shortcut.",
               "\n".join(o))


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "B-flow-map-drawer.svg")
    open(out, "w", encoding="utf-8").write(make())
    print("wrote", out)
