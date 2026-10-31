"""Custom validation rule model."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class CustomRule(Base):
    """User-defined custom data quality rule."""

    __tablename__ = "custom_rules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    dataset_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    column_name: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'between', 'in_set', 'regex', 'not_null', 'min_length', 'max_length'
    parameters_json: Mapped[str] = mapped_column(String, nullable=False, default="{}")
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default="high"
    )  # 'low', 'medium', 'high', 'critical'
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, default=datetime.utcnow, server_default=func.now()
    )
