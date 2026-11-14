"""Log in / Create account mockup sheet (Bin Wall style). Usage: gen_login.py <out.svg>"""
import sys
from gen_landing import (t, logo, svg, INK, INK2, INK3, SURF, BORDER, HAIR, ONDARK, LB)

ERR, ERR_T, INPUT_B = "#D33A2C", "#FBE6E3", "#8A9097"


def frame(x, y, w, h, label):
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#EEEDE8" stroke="{BORDER}" stroke-width="1"/>',
         f'<path d="M{x} {y+8} a8 8 0 0 1 8 -8 H{x+w-8} a8 8 0 0 1 8 8 V{y+56} H{x} Z" fill="url(#louvre)"/>',
         logo(x + 18, y + 13),
         t(x + 58, y + 35, "Smart Warehouse Planner", 18, "#fff", LB)]
    o.insert(0, t(x, y - 14, label, 16, INK, LB))
    return "".join(o)


def card(x, y, w, h):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{SURF}" stroke="{BORDER}" stroke-width="1"/>'


def label(x, y, s):
    return t(x, y - 5, s, 13.5, INK, "b w6")


def field(x, y, w, value="", dots=0, focus=False, error=False, show=False, caret=False):
    o = []
    if focus:  # paper focus ring: ink ring with white gap
        o.append(f'<rect x="{x-4}" y="{y-4}" width="{w+8}" height="48" rx="9" fill="none" stroke="{INK}" stroke-width="2"/>')
    stroke, sw = (ERR, 1.5) if error else (INPUT_B, 1)
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="40" rx="6" fill="#fff" stroke="{stroke}" stroke-width="{sw}"/>')
    if value:
        o.append(t(x + 12, y + 26, value, 15, INK))
    if dots:
        for i in range(dots):
            o.append(f'<circle cx="{x+17+i*12}" cy="{y+20}" r="4" fill="{INK}"/>')
    if caret:
        cx = x + 12 + (len(value) * 8.2 if value else 0) + (dots * 12 if dots else 0)
        o.append(f'<rect x="{cx}" y="{y+10}" width="1.5" height="20" fill="{INK}"/>')
    if show:
        o.append(t(x + w - 14, y + 26, "Show", 13.5, INK, "b w6", "end", ' text-decoration="underline"'))
    return "".join(o)


def err_line(x, y, s):
    return (f'<use href="#i-alert" x="{x}" y="{y-13}" width="16" height="16" stroke="{ERR}" color="{ERR}"/>' +
            t(x + 22, y, s, 13, INK, "b w5"))


def btn(x, y, w, s, kind="primary", icon=None):
    if kind == "primary":
        o = f'<rect x="{x}" y="{y}" width="{w}" height="44" rx="6" fill="{INK}"/>'
        fg = "#fff"
    else:
        o = f'<rect x="{x}" y="{y}" width="{w}" height="44" rx="6" fill="#fff" stroke="{BORDER if kind=="tertiary" else INK}" stroke-width="1.2"/>'
        fg = INK
    if icon:
        tw = len(s) * 8.4 + 26
        sx = x + (w - tw) / 2
        o += f'<use href="#{icon}" x="{sx}" y="{y+13}" width="18" height="18" stroke="{fg}" color="{fg}"/>'
        o += t(sx + 26, y + 28, s, 15.5, fg, "b w7")
    else:
        o += t(x + w / 2, y + 28, s, 15.5, fg, "b w7", "middle")
    return o


def link_line(x, y, pre, link, anchor_mid=None):
    # one centred text run so the browser spaces "pre" and the link
    return (f'<text x="{anchor_mid}" y="{y}" class="b w4" font-size="13.5" fill="{INK2}" text-anchor="middle">{pre}'
            f'<tspan class="b w7" fill="{INK}" text-decoration="underline">{link}</tspan></text>')


def login_card(x, y):
    w, pad = 380, 32
    ix, iw = x + pad, w - 2 * pad
    mid = x + w / 2
    o = [card(x, y, w, 470)]
    o.append(t(ix, y + 50, "Log in", 28, INK, LB))
    o.append(t(ix, y + 76, "Plans are shared by everyone who logs in.", 13.5, INK2))
    o.append(label(ix, y + 112, "Username"))
    o.append(field(ix, y + 120, iw, focus=True, caret=True))
    o.append(label(ix, y + 190, "Password"))
    o.append(field(ix, y + 198, iw, show=True))
    o.append(btn(ix, y + 262, iw, "Log in"))
    o.append(link_line(ix, y + 336, "No account? ", "Create account", mid))
    o.append(f'<rect x="{ix}" y="{y+366}" width="{iw}" height="1" fill="{HAIR}"/>')
    o.append(f'<rect x="{mid-18}" y="{y+358}" width="36" height="16" fill="#fff"/>')
    o.append(t(mid, y + 371, "or", 12.5, INK3, anchor="middle"))
    o.append(btn(ix, y + 386, iw, "Demo version", "tertiary", "i-play"))
    o.append(t(mid, y + 452, "Public demo only: opens the app as the demo account.", 12, INK3, anchor="middle"))
    return "".join(o)


def create_card(x, y):
    w, pad = 380, 32
    ix, iw = x + pad, w - 2 * pad
    mid = x + w / 2
    o = [card(x, y, w, 470)]
    o.append(t(ix, y + 50, "Create account", 28, INK, LB))
    o.append(t(ix, y + 76, "No email needed. There is no password reset,", 13.5, INK2))
    o.append(t(ix, y + 95, "so keep your password somewhere safe.", 13.5, INK2))
    o.append(label(ix, y + 130, "Username"))
    o.append(field(ix, y + 138, iw, value="kari"))
    o.append(t(ix, y + 196, "Letters and numbers. Must not be taken.", 12.5, INK3))
    o.append(label(ix, y + 228, "Password"))
    o.append(field(ix, y + 236, iw, dots=8, show=True))
    o.append(label(ix, y + 302, "Repeat password"))
    o.append(field(ix, y + 310, iw, dots=8, focus=True, caret=True))
    o.append(btn(ix, y + 374, iw, "Create account"))
    o.append(link_line(ix, y + 446, "Already have an account? ", "Log in", mid))
    return "".join(o)


def make():
    o = []
    o.append(t(48, 50, "Log in and Create account", 28, INK, LB))
    o.append(t(48, 76, "Core, milestone 2 · FR-39, FR-40, FR-50 · real size · after login the saved-plans list opens (FR-8)", 14, INK2))
    fw, fh, fy = 656, 600, 124
    for i, (lab, fn) in enumerate((("Log in", login_card), ("Create account", create_card))):
        fx = 48 + i * (fw + 32)
        o.append(frame(fx, fy, fw, fh, lab))
        o.append(fn(fx + (fw - 380) / 2, fy + 90))
    # states row
    sy = fy + fh + 64
    pw = 432
    # (a) wrong details
    ax = 48
    o.append(t(ax, sy - 14, "Wrong username or password", 16, INK, LB))
    o.append(card(ax, sy, pw, 214))
    o.append(f'<rect x="{ax+24}" y="{sy+22}" width="{pw-48}" height="58" rx="6" fill="{ERR_T}" stroke="{ERR}" stroke-width="1"/>')
    o.append(f'<use href="#i-alert" x="{ax+38}" y="{sy+33}" width="18" height="18" stroke="{ERR}" color="{ERR}"/>')
    o.append(t(ax + 66, sy + 46, "Wrong username or password.", 14, INK, "b w7"))
    o.append(t(ax + 66, sy + 66, "Check both and try again.", 13, INK))
    o.append(label(ax + 24, sy + 108, "Username"))
    o.append(field(ax + 24, sy + 116, 180, value="justas"))
    o.append(label(ax + 228, sy + 108, "Password"))
    o.append(field(ax + 228, sy + 116, 180, focus=True, caret=True))
    o.append(t(ax + 24, sy + 186, "Never says which one was wrong. Username kept,", 12.5, INK3))
    o.append(t(ax + 24, sy + 203, "password cleared and focused. role=\"alert\".", 12.5, INK3))
    # (b) create account errors
    bx = 48 + pw + 24
    o.append(t(bx, sy - 14, "Create account: field errors", 16, INK, LB))
    o.append(card(bx, sy, pw, 214))
    o.append(label(bx + 24, sy + 32, "Username"))
    o.append(field(bx + 24, sy + 40, pw - 48, value="demo", error=True))
    o.append(err_line(bx + 24, sy + 102, "That username is taken. Try another."))
    o.append(label(bx + 24, sy + 136, "Repeat password"))
    o.append(field(bx + 24, sy + 144, 180, dots=6, error=True))
    o.append(err_line(bx + 220, sy + 169, "The passwords don’t match."))
    o.append(t(bx + 24, sy + 203, "Checked on submit; focus moves to the first error.", 12.5, INK3))
    # (c) user menu
    cx = 48 + 2 * (pw + 24)
    o.append(t(cx, sy - 14, "User menu and Log out", 16, INK, LB))
    o.append(card(cx, sy, pw, 214))
    o.append(f'<rect x="{cx}" y="{sy}" width="{pw}" height="56" rx="8" fill="url(#louvre)"/>')
    o.append(f'<rect x="{cx}" y="{sy+40}" width="{pw}" height="16" fill="url(#louvre)"/>')
    o.append(f'<rect x="{cx+pw-104}" y="{sy+10}" width="36" height="36" rx="6" fill="#16191C" stroke="#3A4046" stroke-width="1"/>')
    o.append(f'<use href="#i-menu" x="{cx+pw-95}" y="{sy+19}" width="18" height="18" stroke="#E8EAEC" color="#E8EAEC"/>')
    ax2, ay2 = cx + pw - 42, sy + 28
    o.append(f'<circle cx="{ax2}" cy="{ay2}" r="20" fill="none" stroke="#fff" stroke-width="2"/>')
    o.append(f'<circle cx="{ax2}" cy="{ay2}" r="16" fill="{ONDARK}"/>')
    o.append(t(ax2, ay2 + 5, "JS", 13, INK, LB, "middle"))
    mx, my, mw = cx + pw - 236, sy + 64, 220
    o.append(f'<g filter="url(#pop)"><rect x="{mx}" y="{my}" width="{mw}" height="126" rx="6" fill="#fff" stroke="{BORDER}" stroke-width="1"/></g>')
    o.append(t(mx + 16, my + 26, "Logged in as", 12.5, INK3))
    o.append(t(mx + 16, my + 48, "justas", 16, INK, LB))
    o.append(f'<rect x="{mx}" y="{my+64}" width="{mw}" height="1" fill="{HAIR}"/>')
    o.append(f'<rect x="{mx+6}" y="{my+72}" width="{mw-12}" height="44" rx="4" fill="#F3F2EE"/>')
    o.append(f'<use href="#i-arrow-r" x="{mx+16}" y="{my+85}" width="18" height="18" stroke="{INK}" color="{INK}"/>')
    o.append(t(mx + 44, my + 99, "Log out", 15, INK, "b w7"))
    o.append(t(cx + 20, sy + 84, "Opens from the avatar", 13, INK2))
    o.append(t(cx + 20, sy + 102, "at the toolbar’s right end.", 13, INK2))
    o.append(t(cx + 20, sy + 132, "Demo version shows", 13, INK2))
    o.append(t(cx + 20, sy + 150, "“demo” here.", 13, INK2))
    o.append(t(cx + 20, sy + 180, "Log out returns to", 13, INK2))
    o.append(t(cx + 20, sy + 198, "Log in (or the front page).", 13, INK2))
    return svg("Smart Warehouse Planner — Log in and Create account",
               "Mockup sheet: Log in page with Demo version, Create account page, the wrong-details error, Create account field errors, and the toolbar user menu with Log out.",
               "\n".join(o), h=sy + 214 + 40)


if __name__ == "__main__":
    open(sys.argv[1], "w").write(make())
    print("wrote", sys.argv[1])
