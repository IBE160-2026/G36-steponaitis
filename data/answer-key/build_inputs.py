"""Build the input files of the answer-key test dataset (PRD §7.3).

Writes Locations.csv, Inventory.csv and transactions.csv next to this script.
The tables below are hand-made: every part, location, pick count and shared job
is chosen to hit one or more cases in README.md. The expected results are NOT
computed here; they are worked out by hand in README.md and expected.json.

Only the required columns (FR-3) plus Part Description, Section, Position, Unit
and Warehouse are written. The quantity columns of the Transactions file are
left out on purpose: they are optional, and the full demo data covers them.

Run from the project root:
    uv run python data/answer-key/build_inputs.py
"""

import csv
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(__file__).parent
WAREHOUSE = "NO"
VIRTUAL = "FLSKRS"

PERIOD_START = date(2025, 10, 1)   # first day that counts
PERIOD_END = date(2026, 9, 30)     # newest transaction date = data-as-of date
OUTSIDE = date(2025, 9, 30)        # same date one year earlier: does not count

# ---------------------------------------------------------------- locations
# Aisle A: 3 levels x 3 positions. B: 4 x 3. C and D: 3 x 3.
LEVELS = {"A": 3, "B": 4, "C": 3, "D": 3}

# ---------------------------------------------------------------- parts
# part: (description, unit, picks in the period, [(location, quantity), ...])
# Inventory rows are written in this order (4400 lists its B row first on
# purpose, 9300 has a duplicate row that must be merged).
PARTS = {
    "0100":       ("Wiper blade - Volvo V70", "PCS", 1, [("A-01-01-01", 4)]),
    "0500":       ("Fog light - Ford Focus", "PCS", 5, [("A-01-03-01", 2)]),
    "0600":       ("Brake disc, front - VW Golf", "PCS", 6, [("A-01-02-02", 6)]),
    "1008614-00": ("Oil filter - Toyota Corolla", "PCS", 26, [("A-01-01-03", 0)]),
    "10240":      ("Air filter - VW Golf", "PCS", 24, [("B-01-01-03", 10)]),
    "1100":       ("Brake pad set, front - VW Golf", "SET", 30, [("C-01-01-01", 12)]),
    "1200":       ("Spark plug - Ford Focus", "PCS", 25, [("A-01-02-01", 2), ("B-01-01-02", 8)]),
    "2300":       ("Brake pad set, rear - VW Golf", "SET", 23, [("C-01-01-03", 9)]),
    "2400":       ("Cabin filter - VW Golf", "PCS", 24, [("C-01-01-02", 7)]),
    "30400":      ("Shock absorber, front - Audi A4", "PCS", 10, [("D-01-01-03", 4)]),
    "3050":       ("Strut top mount - Audi A4", "PCS", 10, [("B-01-02-03", 4)]),
    "4400":       ("Radiator - Peugeot 308", "PCS", 0, [("B-01-01-01", 5), ("A-01-03-02", 5)]),
    "5000":       ("Engine oil 5W-30", "L", 40, [("A-01-02-03", 60)]),
    "6100":       ("Glow plug - BMW 320d", "PCS", 12, [("B-01-03-01", 8)]),
    "6200":       ("Fuel filter - BMW 320d", "PCS", 7, [("D-01-02-01", 5)]),
    "6600":       ("Headlight bulb H7 - Ford Focus", "PCS", 5, [("C-01-02-03", 10)]),
    "7000":       ("Headlight assembly - Ford Focus", "PCS", 15, [("A-01-03-03", 3)]),
    "8100":       ("Timing belt kit - Skoda Octavia", "KIT", 16, [("B-01-02-01", 3)]),
    "8200":       ("Water pump - Skoda Octavia", "PCS", 22, [("C-01-02-01", 4)]),
    "8300":       ("Serpentine belt - Skoda Octavia", "PCS", 18, [("D-01-01-01", 6)]),
    "8400":       ("Tie rod end - Opel Astra", "PCS", 7, [("C-01-02-02", 4)]),
    "8500":       ("Ball joint - Opel Astra", "PCS", 15, [("B-01-02-02", 6)]),
    "8600":       ("Control arm - Opel Astra", "PCS", 20, [("D-01-01-02", 5)]),
    "9000":       ("Catalytic converter - Volvo V70", "PCS", 0, [("A-01-01-02", 1)]),
    "9100":       ("Lambda sensor - Nissan Qashqai", "PCS", 9, [("D-01-02-02", 3)]),
    "9200":       ("Exhaust gasket - Nissan Qashqai", "PCS", 11, [("D-01-02-03", 8)]),
    "9300":       ("Door mirror glass - Mazda 3", "PCS", 0, [("B-01-03-02", 2), ("B-01-03-02", 3)]),
}

# Extra pick lines dated OUTSIDE the period (must not count).
OUTSIDE_PICKS = {"0500": 1, "2400": 1, "9000": 1}

# Pick dates pinned to the period boundaries (counted in the picks above).
PINNED_PICKS = {"0100": [PERIOD_START], "0500": [PERIOD_END]}

# A part in the Transactions file but not in the Inventory file: never
# classified, never in a pick group. Its picks are at an empty shelf location.
GHOST = ("9999", "Clutch kit - Mazda 3", 30, "B-01-04-03")

# Pick groups: (part, part, shared jobs in the period).
SHARED_JOBS = [
    ("8100", "8200", 10),
    ("8500", "8600", 9),
    ("2400", "5000", 8),
    ("1008614-00", "2300", 7),
    ("8100", "8300", 6),
    ("8400", "8500", 6),
    ("9100", "9200", 6),
    ("0600", "2300", 5),
    ("30400", "3050", 5),
    ("6600", "7000", 5),
    ("6100", "6200", 4),       # one short: NOT a pick group
    ("6100", "9999", 6),       # 9999 is not in the Inventory file: NOT a pick group
]


def locations():
    rows, walk = [], 0
    for aisle, levels in LEVELS.items():
        for level in range(1, levels + 1):
            for pos in range(1, 4):
                rows.append({
                    "Location": f"{aisle}-01-{level:02d}-{pos:02d}",
                    "Walk Path": walk, "Aisle": aisle, "Section": 1,
                    "Level": level, "Position": pos, "Warehouse": WAREHOUSE,
                })
                walk += 10
    return rows


def inventory():
    rows = []
    for part, (desc, unit, _, stock) in PARTS.items():
        for loc, qty in stock:
            rows.append({"Part": part, "Part Description": desc, "Quantity": qty,
                         "Unit": unit, "Location": loc, "Warehouse": WAREHOUSE})
    return rows


def spread(n, first=date(2025, 10, 6), last=date(2026, 9, 25)):
    """n weekday dates spread evenly inside the period, away from its edges."""
    if n == 0:
        return []
    span = (last - first).days
    out = []
    for i in range(n):
        d = first + timedelta(days=round(span * i / max(n - 1, 1)))
        while d.weekday() >= 5:
            d += timedelta(days=1)
        out.append(d)
    return out


def transactions():
    lines = []
    code = 5_000_000

    def nxt():
        nonlocal code
        code += 1
        return code

    def add(kind, part, desc, loc, tcode, day, hour):
        lines.append({"Transaction Type": kind, "Part": part, "Part Description": desc,
                      "Location": loc, "Transaction Code": tcode,
                      "Date": datetime(day.year, day.month, day.day, hour, 0)})

    # Picks (Move to Repair), one code per line, from the part's first location
    # that has stock (1008614-00 has none, so its only location).
    for part, (desc, _, picks, stock) in PARTS.items():
        shelf = next((l for l, q in stock if q > 0), stock[0][0])
        pinned = PINNED_PICKS.get(part, [])
        for day in pinned + spread(picks - len(pinned)):
            add("Move to Repair", part, desc, shelf, nxt(), day, 8)
        for _ in range(OUTSIDE_PICKS.get(part, 0)):
            add("Move to Repair", part, desc, shelf, nxt(), OUTSIDE, 9)
    gpart, gdesc, gpicks, gloc = GHOST
    for day in spread(gpicks):
        add("Move to Repair", gpart, gdesc, gloc, nxt(), day, 8)

    # Jobs (Issue Part at the virtual location), one code per job.
    desc_of = {p: v[0] for p, v in PARTS.items()} | {gpart: gdesc}
    for a, b, n in SHARED_JOBS:
        for day in spread(n, date(2025, 10, 8), date(2026, 9, 22)):
            job = nxt()
            add("Issue Part", a, desc_of[a], VIRTUAL, job, day, 13)
            add("Issue Part", b, desc_of[b], VIRTUAL, job, day, 13)

    # Traps for the 6100-6200 pair (each would make it 5 shared jobs if counted):
    # 6100 appears twice on one shared job (counts once) ...
    first_job = next(l for l in lines if l["Transaction Type"] == "Issue Part" and l["Part"] == "6100")
    add("Issue Part", "6100", desc_of["6100"], VIRTUAL, first_job["Transaction Code"],
        first_job["Date"].date(), 14)
    # ... both parts on Issue Part lines with transaction code 0 ...
    add("Issue Part", "6100", desc_of["6100"], VIRTUAL, 0, date(2026, 3, 2), 13)
    add("Issue Part", "6200", desc_of["6200"], VIRTUAL, 0, date(2026, 3, 2), 13)
    # ... and a shared job dated one year before the newest date.
    job = nxt()
    add("Issue Part", "6100", desc_of["6100"], VIRTUAL, job, OUTSIDE, 13)
    add("Issue Part", "6200", desc_of["6200"], VIRTUAL, job, OUTSIDE, 13)

    # Lines that are never picks: Receipt (code 0) and Return to Stock.
    add("Receipt", "9000", desc_of["9000"], "A-01-01-02", 0, date(2026, 2, 2), 10)
    add("Return to Stock", "9000", desc_of["9000"], "A-01-01-02", nxt(), date(2026, 2, 3), 15)
    add("Receipt", "9300", desc_of["9300"], "B-01-03-02", 0, date(2026, 5, 4), 10)

    lines.sort(key=lambda l: (l["Date"], l["Transaction Code"]))
    for l in lines:
        l["Date"] = l["Date"].strftime("%Y-%m-%d %H:%M")
    return lines


def write(name, rows):
    with open(OUT / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    write("Locations.csv", locations())
    write("Inventory.csv", inventory())
    tx = transactions()
    assert max(l["Date"] for l in tx).startswith(PERIOD_END.isoformat())
    write("transactions.csv", tx)
    print("Wrote Locations.csv, Inventory.csv, transactions.csv to", OUT)
