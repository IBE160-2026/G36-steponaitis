# Data

- `sample/` — anonymized Excel files used during the course. These are committed to the repo.
- `private/` — original company files. This folder is ignored by git and must never be committed.

## Demo adjustments

The anonymized files in `sample/` were adjusted:

- `add_demo_dates.py` adds a random `Transaction Date` column, since dates were removed from the demo export (fixed seed). Run from the project root: `uv run --with pandas --with openpyxl python data/add_demo_dates.py`
- Transaction lines for parts that are not in `inventory.xlsx` (no description or location) were removed.
