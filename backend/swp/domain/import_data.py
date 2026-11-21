"""Kernel: the normalized import model shared by domain slices (FR-6, AD-4).

`import_` builds a NormalizedImport from three checked files; other slices (such as
`classify`) read the stored ImportData. The field order is the stored JSON order.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel

from swp.domain.values import Dec

TransactionType = Literal["move_to_repair", "issue_part", "return_to_stock", "receipt"]


class LocationData(BaseModel):
    walk_path: Dec
    aisle: str
    level: str
    section: str | None
    position: str | None


class InventoryLine(BaseModel):
    part: str
    location: str
    quantity: Dec


class TransactionLine(BaseModel):
    type: TransactionType
    part: str
    transaction_code: str
    date: date


class ImportData(BaseModel):
    schema_version: int = 1
    locations: dict[str, LocationData]
    inventory: list[InventoryLine]
    parts: dict[str, str]
    transactions: list[TransactionLine]


class NormalizedImport(BaseModel):
    data_as_of: date
    data: ImportData
