"""AuditEvent ORM model."""
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditEvent(Base):
    """Immutable log of state-changing actions on issues and datasets."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    entity_type: Mapped[str] = mapped_column(nullable=False)   # "issue" | "dataset"
    entity_id: Mapped[int] = mapped_column(nullable=False, index=True)
    action: Mapped[str] = mapped_column(nullable=False)        # "status_changed"|"note_added"|"created"
    old_value: Mapped[Optional[str]] = mapped_column(nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(nullable=True)
    actor: Mapped[str] = mapped_column(nullable=False, default="system")  # "system"|"analyst"
    timestamp: Mapped[datetime] = mapped_column(
        nullable=False, default=datetime.utcnow, server_default=func.now(), index=True
    )
