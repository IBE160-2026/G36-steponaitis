"""Declarative rows for the tables created by migration 0001 (AD-4, AD-9).

JSON columns hold `model_dump(mode="json")` of the domain models; they are upcast
through `swp.domain.state_migrations` on read (see `swp.store.plans`).
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, Date, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from swp.store.types import UtcDateTime


class Base(DeclarativeBase):
    pass


class ImportRow(Base):
    __tablename__ = "imports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    uploaded_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    data_as_of: Mapped[date] = mapped_column(Date, nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class PlanRow(Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    import_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("imports.id", ondelete="RESTRICT", name="fk_plans_import_id_imports"),
        nullable=False,
    )
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    last_edited_by: Mapped[str] = mapped_column(String, nullable=False)
    last_edited_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    analysis: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
