# Screen map: three alternatives (2026-11-14)

Replaces the idea behind `mockups/screen-map.svg`. That mock was a grid of six cropped screens: they were cut off at the right edge, nothing showed how they connect, and Overview, Pick groups, Recommendations, Move list, Settings and Log in were missing. All three options below show every screen in the EXPERIENCE.md IA table. Thumbnails are simplified, so each one shows only what makes that screen recognisable, and they are drawn at a fixed type size of 11px or more instead of being shrunk. The data is synthetic: plan "Spring re-slot 2026", codes like G-14-04-02.

Generator: `python3 gen_screenmap.py` (it imports `screens.py`, which reuses `../../landing-redesign/gen_landing.py` and `defs.svgfrag`).

## A — Journey storyboard (`A-journey-storyboard.svg`, 1440 × 2004)

The screens appear in the order the planner meets them in UJ-1: twelve numbered frames on one graphite track, from Log in to the paper in the colleague's hands (UJ-2). Each frame has a one-line caption and a "Next:" line that names the click leading on. A strip at the bottom holds the side doors: Create account, import error, Settings, Launcher and User menu. A legend in the header explains the shared toolbar. A has the largest, most readable thumbnails and tells the story best. On the other hand, it is the tallest sheet, and the single track suggests a wizard, which the flow bar is not ("navigation, not a wizard").

## B — Flow-bar map (`B-flow-bar-map.svg`, 1440 × 1314)

The flow bar itself is the map. The plan plate and the 8 steps are drawn at real size across the middle, and each step's screen hangs off its own pill, alternating above and below. Around the bar sit the screens before a plan is open (Log in → Saved plans → New Plan, with "Open a plan" and "Import passes" arrows into the plan), the Launcher "from any page", Settings as "not a step", and a "leaving the plan" row with the User menu and the printed move list. B teaches the navigation model directly: the bar is always there, any step opens at any time, and a key at the top explains the pill states (done, you are here, not reached). Its thumbnails are smaller than in A, and the reading order zig-zags, although the stems keep it clear.

## C — Sitemap (`C-sitemap.svg`, 1440 × 1714)

C shows where every screen lives, in five columns: Outside (front page, Log in, Create account), Your plans (Saved plans, New Plan, User menu), Inside a plan (the 8 steps as strips on a vertical flow rail, plus Settings), Opens on top (Launcher, Part panel, Drop dialog FR-51, Key colour, Manual move, Recommendation detail) and On paper (the A4 move list). Arrows link each overlay to the page it opens from. C is the most complete option and the only one that maps the panels and dialogs. Its step rows are cropped to each screen's signature strip, so they say less about a whole page.

## Recommendation

**B.** It is the most compact of the three and still readable. It covers every IA surface, and it is the only option that shows how the app is actually navigated: one constant bar, with steps in any order. A is the better presentation piece for a walkthrough of UJ-1. If the team wants the overlays mapped too, C's "Opens on top" column could be added to B as a sixth band later.
