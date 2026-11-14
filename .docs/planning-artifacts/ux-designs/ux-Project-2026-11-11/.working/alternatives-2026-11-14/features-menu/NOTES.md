# Features menu: three alternatives (2026-11-14)

Replaces the dark "plates on a louvre wall" launcher in `mockups/features-menu.svg`. All three open over a real Recommendations page (step 6, round 1, 15 to apply), under the graphite toolbar with plan plate, the 8-step flow bar, the pressed launcher button and the avatar. The data is synthetic and matches `interface.svg`.

Regenerate: `python3 gen_a_palette.py`, `python3 gen_b_flowmap.py`, `python3 gen_c_workbench.py`. They share `fm_common.py`, which imports `defs.svgfrag` and the helpers from `../../landing-redesign/`.

What all three fix in the old mock: it listed only places, not actions (Undo last move, Manual move…, Print, Apply all, Run round 2 were missing). It also used the single-key "G then code" shortcut, which the spines forbid, still showed login as a stage-2 plate, and used violet on the plan plate edge. Each new menu has the Keyboard box from the spines, the stage-2 slots CAT and LBL, Saved plans / New Plan / Settings (read-only, called "Analysis settings" in the menus), and shows where the planner is in the flow.

## A. Command palette (`A-command-palette.svg`)

A search-first dialog in the centre. Opening it with Ctrl/⌘ K puts the cursor in the search field. One query ("move") finds actions, pages, how-to tips, parts, locations and plans together, in groups with codes and shortcuts. A strip under the field says where you are (plan · step 6 of 8 · round 1 · 15 to apply) with a small flow track. A preview pane explains what the highlighted item will do before you press Enter, for example which part Undo puts back and where. It is the fastest option for experienced users and works fully by keyboard. The trade-off: before you type, nothing shows the whole app at a glance, so a new planner has to know what to search for. The empty state (suggested next steps plus recent items) still needs its own mock.

## B. Flow map drawer (`B-flow-map-drawer.svg`)

The launcher button unfolds the flow bar into a white drawer. There is one column per step, on a track with "Done" checks, "You are here" at step 6, and steps 7–8 marked as outputs. Each column holds the step's code, its live counts and the actions you can take in that step. For example, Locations lists Open the wall, Open as list, Manual move… and a drag tip, and Recommendations lists Continue, Undo last move, Apply all, Run round 2 and Reset…. Plans, the stage-2 slots and every shortcut sit in a band below. It uses the same mental model as the flow bar, so it answers both "what can I do" and "where am I" in one look, and it still has a search field. The trade-off: eight narrow columns limit labels to about 18 characters, and the drawer is the tallest overlay, covering about 80% of the page.

## C. Workbench (`C-workbench.svg`)

A paper sheet of eight step tiles. Each tile previews its own screen in miniature: a class bar, a ranked roster, a bin wall, a pick-group pair, the green BEST rail, the open-recommendation count, before/after bars and a printed sheet. Each tile also shows its state (done / you are here / output), one key number and one action. A dark "Next up" card says in plain words what to do now and links to the next undecided recommendation. A Plans card lists the other saved plans with New Plan and Analysis settings. It is the most self-explanatory option and the most visual: the tiles show what each feature *is*, not only its name. The trade-off: it repeats much of Plan overview, it is the most work to build and keep in sync, and as a "menu" it is heavy. To jump somewhere you scan tiles instead of typing.

## Recommendation

**Choose B, the flow map drawer, as the launcher, and take A's search behaviour into it.** B is the clearest answer to the brief. It shows every feature and action, arranged in the flow order the planner already knows from the flow bar, so "where am I" and "what can I do next" are answered together. When the planner starts typing in B's search field, the columns should be replaced by A's grouped results and preview pane. Ctrl/⌘ K should then open the drawer with the cursor already in that field. That keeps one launcher, as the spines require (grid button and Ctrl/⌘ K open the same dialog), and keeps the speed of the palette. C's "Next up" card and tile previews are worth reusing in Plan overview, not in the menu.

Open points for the spines if B is chosen: column action lists per step (drafted here), whether "Tip: drag a bin" belongs in a menu at all, and the typed-search state of the drawer (A shows its content).
