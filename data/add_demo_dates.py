"""Add random demo dates to data/sample/transactions.xlsx.

The anonymized demo data has no dates (they were removed from the original
export). This script adds a "Transaction Date" column so the app can be built
and tested with time-based analysis. The dates are random and carry no real
meaning.

Rules:
- Period: 2025-10-01 to 2026-09-30, weekdays only, 07:00-15:30.
- All lines with the same Transaction No get the same date and time.
- Lines with Transaction No 0 (receiving/putaway) get their own random date.
- Fixed seed, so running the script again gives the same dates.

Run from the project root:
    uv run --with pandas --with openpyxl python data/add_demo_dates.py
"""

from pathlib import Path

import numpy as np
import pandas as pd

FILE = Path(__file__).parent / "sample" / "transactions.xlsx"
START, END = "2025-10-01", "2026-09-30"
SEED = 160


def random_timestamps(rng, n, workdays):
    days = rng.choice(workdays, size=n)
    minutes = rng.integers(7 * 60, 15 * 60 + 30, size=n)
    seconds = rng.integers(0, 60, size=n)
    return (
        pd.to_datetime(days)
        + pd.to_timedelta(minutes, unit="m")
        + pd.to_timedelta(seconds, unit="s")
    )


def main():
    df = pd.read_excel(FILE)
    df = df.drop(columns=["Transaction Date"], errors="ignore")

    rng = np.random.default_rng(SEED)
    workdays = pd.bdate_range(START, END).values

    numbered = df["Transaction No"] != 0
    txn_nos = np.sort(df.loc[numbered, "Transaction No"].unique())
    by_txn = pd.Series(random_timestamps(rng, len(txn_nos), workdays), index=txn_nos)

    dates = pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns]")
    dates[numbered] = df.loc[numbered, "Transaction No"].map(by_txn).values
    dates[~numbered] = random_timestamps(rng, (~numbered).sum(), workdays)

    df["Transaction Date"] = dates
    df.to_excel(FILE, index=False)
    print(f"Added dates to {len(df)} rows: {dates.min()} to {dates.max()}")


if __name__ == "__main__":
    main()
