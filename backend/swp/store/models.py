"""Declarative rows for the tables created by migrations 0001 to 0005 (AD-4, AD-9, AD-10,
AD-18).

JSON columns hold `model_dump(mode="json")` of the domain models; they are upcast
through `swp.domain.state_migrations` on read (see `swp.store.plans`).
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, Date, ForeignKey, Integer, String, UniqueConstraint, Uuid
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


class UserRow(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("username_key", name="uq_users_username_key"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    username: Mapped[str] = mapped_column(String, nullable=False)
    username_key: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)


class LoginAttemptRow(Base):
    __tablename__ = "login_attempts"

    username_key: Mapped[str] = mapped_column(String, primary_key=True)
    failures: Mapped[int] = mapped_column(Integer, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)


class KeywordRuleRow(Base):
    """A global keyword rule (FR-43): not part of any plan's `state`."""

    __tablename__ = "keyword_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    keyword: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)


class AisleCategoryRow(Base):
    """One category on one aisle (FR-45): global, keyed by the exact Aisle text of imports."""

    __tablename__ = "aisle_categories"

    aisle: Mapped[str] = mapped_column(String, primary_key=True)
    category: Mapped[str] = mapped_column(String, primary_key=True)
