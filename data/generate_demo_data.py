"""Generate synthetic demo data in data/sample/.

Creates three Excel files:
- Locations.xlsx    2,000 shelf locations spread over 9 aisles (A-I).
- Inventory.xlsx    the parts on the shelves: about 1,650 occupied locations, each
                    with a car part, description and quantity.
- transactions.xlsx 20,000 transaction lines for the inventory parts.

Rules:
- Location code: <aisle>-<section>-<level>-<position>, e.g. A-01-02-03.
- Walk Path: 0 at the first location in aisle A, then 10 more for each next
  location in file order (A-01-01-01 = 0, A-01-01-02 = 10, ...).
- Aisles are 72-95% full; the other locations are empty and not in Inventory.xlsx.
- Most parts have one location; 80 parts are stored in two.
- Transaction types follow the real warehouse process:
  Move to Repair  pick from the shelf, one part per Transaction Code.
  Issue Part      the part is used, at the virtual location FLSKRS. All parts on
                  one job share its Transaction Code (basis for pick-together analysis).
  Return to Stock an unused part goes back to its shelf.
  Receipt         goods received to a shelf, Transaction Code 0.
- Some parts move often, some rarely, and about 15% never move (dead stock).
  Some part pairs are used together often, so pick-together analysis has a pattern.
- Dates: weekdays 2025-10-01 to 2026-09-30, 07:00-15:30. A job is picked in the
  morning and issued or returned later the same day.
- Shelf quantities are consistent: Initial Quantity + Transferred Quantity is the
  stock after the line, per part and location, and the last line ends at the
  quantity in Inventory.xlsx. On Issue Part lines, Initial Quantity is what was
  waiting at FLSKRS for that part (it arrives there through Move to Repair).
- Fixed seed, so running the script again gives the same files.

Run from the project root:
    uv run --with pandas --with openpyxl python data/generate_demo_data.py
"""

from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).parent / "sample"
SEED = 160
WAREHOUSE = "NO"
AISLES = list("ABCDEFGHI")
N_LOCATIONS = 2000
N_TRANSACTIONS = 20000
N_DOUBLE = 80                   # parts stored in two locations
VIRTUAL = "FLSKRS"              # where picked parts wait until issued or returned
START, END = "2025-10-01", "2026-09-30"

PART_TYPES = [
    ("Oil filter", "PCS"), ("Air filter", "PCS"), ("Cabin filter", "PCS"),
    ("Fuel filter", "PCS"), ("Brake pad set, front", "SET"), ("Brake pad set, rear", "SET"),
    ("Brake disc, front", "PCS"), ("Brake disc, rear", "PCS"), ("Brake caliper", "PCS"),
    ("Spark plug", "PCS"), ("Glow plug", "PCS"), ("Ignition coil", "PCS"),
    ("Wiper blade", "PCS"), ("Headlight bulb H7", "PCS"), ("Tail light assembly", "PCS"),
    ("Timing belt kit", "KIT"), ("Serpentine belt", "PCS"), ("Water pump", "PCS"),
    ("Thermostat", "PCS"), ("Radiator", "PCS"), ("Radiator hose", "PCS"),
    ("Shock absorber, front", "PCS"), ("Shock absorber, rear", "PCS"), ("Coil spring", "PCS"),
    ("Control arm", "PCS"), ("Ball joint", "PCS"), ("Tie rod end", "PCS"),
    ("Stabilizer link", "PCS"), ("Wheel bearing", "PCS"), ("CV joint kit", "KIT"),
    ("Clutch kit", "KIT"), ("Starter motor", "PCS"), ("Alternator", "PCS"),
    ("Parking sensor", "PCS"), ("Lambda sensor", "PCS"), ("ABS sensor", "PCS"),
    ("Exhaust gasket", "PCS"), ("Muffler", "PCS"), ("Engine mount", "PCS"),
    ("Door mirror glass", "PCS"), ("Engine oil 5W-30", "L"), ("Coolant", "L"),
    ("Door seal", "PCS"), ("Wheel bolt", "PCS"), ("Valve cover gasket", "PCS"),
    ("Brake hose", "PCS"), ("Handbrake cable", "PCS"), ("Brake wear sensor", "PCS"),
    ("Turbocharger", "PCS"), ("Intercooler hose", "PCS"), ("EGR valve", "PCS"),
    ("Fuel pump", "PCS"), ("Fuel injector", "PCS"), ("Throttle body", "PCS"),
    ("Crankshaft sensor", "PCS"), ("Camshaft sensor", "PCS"), ("Oil pressure switch", "PCS"),
    ("Head gasket", "PCS"), ("Oil sump gasket", "PCS"), ("Drain plug washer", "PCS"),
    ("Expansion tank", "PCS"), ("Radiator fan", "PCS"), ("Heater blower motor", "PCS"),
    ("AC compressor", "PCS"), ("AC condenser", "PCS"), ("Drive shaft", "PCS"),
    ("Strut top mount", "PCS"), ("Steering rack boot", "KIT"), ("Power steering pump", "PCS"),
    ("Clutch slave cylinder", "PCS"), ("Gearbox mount", "PCS"), ("Window regulator", "PCS"),
    ("Door lock actuator", "PCS"), ("Tailgate gas strut", "PCS"), ("Fog light", "PCS"),
    ("Headlight assembly", "PCS"), ("Front bumper", "PCS"), ("Number plate light", "PCS"),
    ("Washer pump", "PCS"), ("Horn", "PCS"), ("Fuse kit", "KIT"),
    ("Catalytic converter", "PCS"), ("DPF filter", "PCS"), ("Exhaust clamp", "PCS"),
    ("Wheel hub", "PCS"), ("Wheel nut cap", "SET"), ("Transmission oil", "L"),
]
VEHICLES = [
    "Volvo XC60", "Volvo V60", "Volvo XC90", "VW Golf", "VW Passat", "VW Tiguan",
    "Toyota Corolla", "Toyota RAV4", "Ford Focus", "Ford Transit", "BMW 320d",
    "Audi A4", "Skoda Octavia", "Opel Astra", "Renault Megane", "Mercedes Sprinter",
    "Peugeot 308", "Hyundai Tucson", "Kia Ceed", "Mazda CX-5",
]
ENGINES = ["1.6 Petrol", "2.0 Petrol", "2.0 Diesel"]
# Part types that are often used on the same job.
PAIRS = [
    ("Oil filter", "Engine oil 5W-30"), ("Air filter", "Cabin filter"),
    ("Brake pad set, front", "Brake disc, front"), ("Brake pad set, rear", "Brake disc, rear"),
    ("Timing belt kit", "Water pump"), ("Thermostat", "Coolant"),
    ("Control arm", "Ball joint"), ("Shock absorber, front", "Coil spring"),
    ("Brake pad set, front", "Brake wear sensor"), ("Oil filter", "Drain plug washer"),
    ("Shock absorber, front", "Strut top mount"), ("Radiator", "Expansion tank"),
]


def make_locations():
    rows = []
    per_aisle = np.full(len(AISLES), N_LOCATIONS // len(AISLES))
    per_aisle[: N_LOCATIONS % len(AISLES)] += 1
    for aisle, count in zip(AISLES, per_aisle):
        # 19 sections x 4 levels x 3 positions = 228 slots per aisle, filled in order.
        slots = [(s, lv, p) for s in range(1, 20) for lv in range(1, 5) for p in range(1, 4)]
        for s, lv, p in slots[:count]:
            rows.append({
                "Location": f"{aisle}-{s:02d}-{lv:02d}-{p:02d}",
                "Aisle": aisle, "Section": s, "Level": lv, "Position": p,
                "Warehouse": WAREHOUSE,
            })
    locations = pd.DataFrame(rows)
    # Walk path: the order of the walk through the warehouse, from the first
    # location in aisle A (0) and 10 more for each next location.
    locations.insert(1, "Walk Path", np.arange(len(locations)) * 10)
    return locations


def make_inventory(rng, locations):
    # Each aisle is only partly filled, and the fill rate differs per aisle.
    fill = dict(zip(AISLES, rng.uniform(0.72, 0.95, len(AISLES))))
    is_used = rng.random(len(locations)) < locations["Aisle"].map(fill).values
    used = locations.loc[is_used, "Location"].tolist()
    n_parts = len(used) - N_DOUBLE

    combos = [(t, u, f"{v} {e}") for t, u in PART_TYPES for v in VEHICLES for e in ENGINES]
    picked = rng.choice(len(combos), size=n_parts, replace=False)
    part_numbers = rng.choice(np.arange(1_000_000, 9_999_999), size=n_parts, replace=False)
    parts = pd.DataFrame([
        {"Part": str(pn), "Part Description": f"{combos[c][0]} - {combos[c][2]}",
         "Part Type": combos[c][0], "Vehicle": combos[c][2], "Unit": combos[c][1]}
        for c, pn in zip(picked, part_numbers)
    ])

    # One location per part, plus a second location for some parts.
    owner = np.concatenate([np.arange(n_parts), rng.choice(n_parts, N_DOUBLE, replace=False)])
    rows = pd.DataFrame({"part": owner, "Location": np.array(used)[rng.permutation(len(used))]})
    return parts, rows


def make_transactions(rng, parts, rows):
    """Simulate the warehouse process forward in time.

    A job picks parts from the shelf (Move to Repair, to the virtual location
    FLSKRS). Later the same day each part is consumed (Issue Part, at FLSKRS) or,
    if not used, partly or fully sent back (Return to Stock, to the shelf).
    When a shelf runs short, goods are received first (Receipt).
    """
    n = len(parts)
    # Popularity: a few fast movers, many slow movers, ~15% never move.
    weights = rng.pareto(1.2, n) + 0.05
    weights[rng.random(n) < 0.15] = 0
    weights /= weights.sum()

    by_key = {(r["Part Type"], r["Vehicle"]): i for i, r in parts.iterrows()}
    pair_idx = [
        (by_key[(a, v)], by_key[(b, v)])
        for a, b in PAIRS for v in parts["Vehicle"].unique()
        if (a, v) in by_key and (b, v) in by_key and weights[by_key[(a, v)]] > 0
    ]
    liquid = (parts["Unit"] == "L").values
    rows_of = rows.groupby("part").groups
    start = np.where(liquid[rows["part"]], rng.integers(0, 201, len(rows)), rng.integers(0, 41, len(rows)))

    # A pool of jobs in random date order; the first K are used.
    workdays = pd.bdate_range(START, END)
    pool = []
    for _ in range(12000):
        t = rng.choice(workdays) + pd.Timedelta(minutes=int(rng.integers(7 * 60, 12 * 60)))
        if rng.random() < 0.2 and pair_idx:
            job_parts = list(pair_idx[rng.integers(len(pair_idx))])
        else:
            size = rng.choice([1, 2, 3, 4], p=[0.45, 0.3, 0.15, 0.1])
            job_parts = list(rng.choice(n, size=size, replace=False, p=weights))
        items = []
        for i in job_parts:
            q = int(rng.integers(4, 9)) if liquid[i] else int(rng.choice([1, 1, 1, 2, 2, 4]))
            r = 0
            if rng.random() < 0.1:                       # not all of it was used
                r = q if (q == 1 or rng.random() < 0.6) else int(rng.integers(1, q))
            back = min(t + pd.Timedelta(minutes=int(rng.integers(30, 240))), t.normalize() + pd.Timedelta(hours=15.5))
            items.append((int(i), q, r, back))
        pool.append((t, items))

    def simulate(k):
        sim = np.random.default_rng(SEED + 1)
        events = []                                      # (time, order, kind, job, part, qty)
        for j, (t, items) in enumerate(pool[:k]):
            for i, q, r, back in items:
                events.append((t, len(events), "pick", j, i, q))
                if q - r > 0:
                    events.append((back, len(events), "issue", j, i, q - r))
                if r > 0:
                    events.append((back, len(events), "return", j, i, r))
        events.sort(key=lambda e: (e[0], e[1]))

        stock, virtual = start.copy(), np.zeros(n, dtype=int)
        picked_from, job_code, lines = {}, {}, []
        code, last = 4_100_000, events[0][0]

        def next_code():
            nonlocal code
            code += int(sim.integers(1, 4))
            return code

        for t, _, kind, j, i, q in events:
            if kind == "pick":
                row = max(rows_of[i], key=lambda x: stock[x])
                if stock[row] < q:                       # shelf too low: receive goods first
                    batch = q - stock[row] + int(sim.integers(20, 201) if liquid[i] else sim.integers(5, 41))
                    rt = max(last, t.normalize() + pd.Timedelta(hours=7), t - pd.Timedelta(minutes=int(sim.integers(5, 120))))
                    lines.append(("Receipt", row, batch, stock[row], 0, rt))
                    stock[row] += batch
                lines.append(("Move to Repair", row, -q, stock[row], next_code(), t))
                stock[row] -= q
                virtual[i] += q
                picked_from[(j, i)] = row
                job_code.setdefault(j, next_code())
            elif kind == "issue":
                lines.append(("Issue Part", -1 - i, -q, virtual[i], job_code[j], t))
                virtual[i] -= q
            else:
                row = picked_from[(j, i)]
                lines.append(("Return to Stock", row, q, stock[row], next_code(), t))
                stock[row] += q
                virtual[i] -= q
            last = t
        return lines

    # Smallest K that gives at least N_TRANSACTIONS lines, so dates cover the whole year.
    lo, hi = 1, len(pool)
    while lo < hi:
        mid = (lo + hi) // 2
        if len(simulate(mid)) >= N_TRANSACTIONS:
            hi = mid
        else:
            lo = mid + 1
    tx = pd.DataFrame(simulate(lo)[:N_TRANSACTIONS], columns=["type", "row", "delta", "initial", "code", "ts"])

    # Today's stock per shelf location = start stock + all shelf movements.
    shelf = tx[tx["row"] >= 0]
    quantity = start + np.bincount(shelf["row"], weights=shelf["delta"], minlength=len(rows)).astype(int)

    part = np.where(tx["row"] >= 0, rows["part"].values[tx["row"].clip(lower=0)], -1 - tx["row"])
    transactions = pd.DataFrame({
        "Transaction Type": tx["type"],
        "Part": parts["Part"].values[part],
        "Part Description": parts["Part Description"].values[part],
        "Location": np.where(tx["row"] >= 0, rows["Location"].values[tx["row"].clip(lower=0)], VIRTUAL),
        "Transferred Quantity": tx["delta"],
        "Initial Quantity": tx["initial"],
        "Transaction Code": tx["code"],
        "Date": tx["ts"],
    })
    return transactions, quantity


def main():
    rng = np.random.default_rng(SEED)
    locations = make_locations()
    parts, rows = make_inventory(rng, locations)
    transactions, quantity = make_transactions(rng, parts, rows)

    inventory = pd.DataFrame({
        "Part": parts["Part"].values[rows["part"]],
        "Part Description": parts["Part Description"].values[rows["part"]],
        "Quantity": quantity,
        "Unit": parts["Unit"].values[rows["part"]],
        "Location": rows["Location"],
        "Warehouse": WAREHOUSE,
    }).sort_values("Location")

    OUT.mkdir(exist_ok=True)
    locations.to_excel(OUT / "Locations.xlsx", index=False)
    inventory.to_excel(OUT / "Inventory.xlsx", index=False)
    transactions.to_excel(OUT / "transactions.xlsx", index=False)
    print(f"Locations: {len(locations)}, Inventory: {len(inventory)} rows / {len(parts)} parts, "
          f"Transactions: {len(transactions)}")


if __name__ == "__main__":
    main()
