"""Generate synthetic demo data in data/sample/.

Creates three Excel files:
- Locations.xlsx    2,000 shelf locations spread over 9 aisles (A-I).
- Inventory.xlsx    every location with one random car part, description and quantity.
- transactions.xlsx 20,000 random transaction lines for the inventory parts, with descriptions.

Rules:
- Location code: <aisle>-<section>-<level>-<position>, e.g. A-01-02-03.
- Some parts move often, some rarely, and about 15% never move (dead stock).
- Several lines can share one Transaction Code (parts picked together). Some part
  pairs are picked together often, so pick-together analysis has a pattern to find.
- Dates: weekdays 2025-10-01 to 2026-09-30, 07:00-15:30. All lines on one
  Transaction Code share the same date.
- Quantities are consistent: Initial Quantity + Transferred Quantity is the stock
  after the line, and the last line per part ends at the quantity in Inventory.xlsx.
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
    return pd.DataFrame(rows)


def make_inventory(rng, locations):
    combos = [(t, u, f"{v} {e}") for t, u in PART_TYPES for v in VEHICLES for e in ENGINES]
    picked = rng.choice(len(combos), size=len(locations), replace=False)
    part_numbers = rng.choice(np.arange(1_000_000, 9_999_999), size=len(locations), replace=False)
    rows = []
    for loc, idx, pn in zip(locations["Location"], picked, part_numbers):
        part_type, unit, vehicle = combos[idx]
        qty = 0 if rng.random() < 0.08 else int(rng.integers(1, 41 if unit != "L" else 201))
        rows.append({
            "Part": str(pn), "Part Description": f"{part_type} - {vehicle}",
            "Part Type": part_type, "Vehicle": vehicle,
            "Quantity": qty, "Unit": unit, "Location": loc, "Warehouse": WAREHOUSE,
        })
    return pd.DataFrame(rows)


def make_transactions(rng, inventory):
    n_parts = len(inventory)
    # Popularity: a few fast movers, many slow movers, ~15% never move.
    weights = rng.pareto(1.2, n_parts) + 0.05
    weights[rng.random(n_parts) < 0.15] = 0
    weights /= weights.sum()

    by_key = {(r["Part Type"], r["Vehicle"]): i for i, r in inventory.iterrows()}
    pair_idx = [
        (by_key[(a, v)], by_key[(b, v)])
        for a, b in PAIRS for v in inventory["Vehicle"].unique()
        if (a, v) in by_key and (b, v) in by_key and weights[by_key[(a, v)]] > 0
    ]

    workdays = pd.bdate_range(START, END)
    lines, code = [], 4_100_000
    while len(lines) < N_TRANSACTIONS:
        code += int(rng.integers(1, 4))
        ts = rng.choice(workdays) + pd.Timedelta(minutes=int(rng.integers(7 * 60, 15 * 60 + 30)))
        roll = rng.random()
        if roll < 0.12:                       # receipt of goods: one part, stock goes up
            parts, sign = [int(rng.choice(n_parts, p=weights))], 1
        elif roll < 0.30 and pair_idx:        # parts often used together
            parts, sign = list(pair_idx[rng.integers(len(pair_idx))]), -1
        else:                                 # picks: 1-4 parts on one code
            size = rng.choice([1, 2, 3, 4], p=[0.55, 0.25, 0.13, 0.07])
            parts, sign = list(rng.choice(n_parts, size=size, replace=False, p=weights)), -1
        for i in parts:
            unit = inventory.at[i, "Unit"]
            if sign > 0:
                qty = int(rng.integers(5, 51)) if unit != "L" else int(rng.integers(20, 201))
            else:
                qty = int(rng.choice([1, 1, 1, 2, 2, 4])) if unit != "L" else int(rng.integers(4, 9))
            lines.append({"i": i, "ts": ts, "code": code, "delta": sign * qty})
    tx = pd.DataFrame(lines[:N_TRANSACTIONS]).sort_values(["ts", "code"]).reset_index(drop=True)

    # Walk each part backwards from today's stock, so quantities add up.
    initial = np.zeros(len(tx), dtype=int)
    for i, idx in tx.groupby("i").groups.items():
        stock = int(inventory.at[i, "Quantity"])
        for row in reversed(idx):
            delta = tx.at[row, "delta"]
            if stock - delta < 0:             # receipt bigger than stock after it
                delta = stock if stock > 0 else -1  # shrink it, or make it a pick
                tx.at[row, "delta"] = delta
            stock -= delta
            initial[row] = stock
    tx["initial"] = initial

    return pd.DataFrame({
        "Part": inventory.loc[tx["i"], "Part"].values,
        "Part Description": inventory.loc[tx["i"], "Part Description"].values,
        "Location": inventory.loc[tx["i"], "Location"].values,
        "Transferred Quantity": tx["delta"].values,
        "Initial Quantity": tx["initial"].values,
        "Transaction Code": tx["code"].values,
        "Date": tx["ts"].values,
    })


def main():
    rng = np.random.default_rng(SEED)
    locations = make_locations()
    inventory = make_inventory(rng, locations)
    transactions = make_transactions(rng, inventory)

    OUT.mkdir(exist_ok=True)
    locations.to_excel(OUT / "Locations.xlsx", index=False)
    inventory.drop(columns=["Part Type", "Vehicle"]).to_excel(OUT / "Inventory.xlsx", index=False)
    transactions.to_excel(OUT / "transactions.xlsx", index=False)
    print(f"Locations: {len(locations)}, Inventory: {len(inventory)}, Transactions: {len(transactions)}")


if __name__ == "__main__":
    main()
