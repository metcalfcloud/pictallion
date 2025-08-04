"""
Base Model Classes

Provides common base classes and utilities for all SQLModel models.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlmodel import Field, SQLModel


class TimestampMixin(SQLModel):
    """Mixin for models that need created_at and updated_at timestamps."""

    created_at: datetime = Field(
        default_factory=datetime.utcnow, sa_column_kwargs={"server_default": func.now()}
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class UUIDMixin(SQLModel):
    """Mixin for models that use UUID primary keys."""

    id: str = Field(
        primary_key=True, sa_column_kwargs={"server_default": func.gen_random_uuid()}
    )
