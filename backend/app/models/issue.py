"""Issue, InvestigationNote, and AnomalyResult ORM models."""
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dataset import Dataset, ProcessingJob


class Issue(Base):
    """A data quality issue detected during validation or anomaly detection."""

    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("processing_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    row_index: Mapped[Optional[int]] = mapped_column(nullable=True)
    column_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    detector: Mapped[str] = mapped_column(nullable=False)   # "rule_based" | "isolation_forest"
    rule_name: Mapped[str] = mapped_column(nullable=False)
    actual_value: Mapped[Optional[str]] = mapped_column(nullable=True)
    expected_condition: Mapped[str] = mapped_column(nullable=False)
    severity: Mapped[str] = mapped_column(nullable=False)   # "low"|"medium"|"high"|"critical"
    status: Mapped[str] = mapped_column(
        nullable=False, default="open", server_default=text("'open'")
    )
    explanation: Mapped[str] = mapped_column(nullable=False)
    suggested_action: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, default=datetime.utcnow, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        server_default=func.now(),
        onupdate=datetime.utcnow,
    )

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="issues")
    notes: Mapped[List["InvestigationNote"]] = relationship(
        "InvestigationNote", back_populates="issue", cascade="all, delete-orphan"
    )


class InvestigationNote(Base):
    """Analyst notes attached to an issue."""

    __tablename__ = "investigation_notes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author: Mapped[str] = mapped_column(nullable=False, default="analyst")
    content: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, default=datetime.utcnow, server_default=func.now()
    )

    # Relationships
    issue: Mapped["Issue"] = relationship("Issue", back_populates="notes")


class AnomalyResult(Base):
    """Per-row output of the IsolationForest anomaly detector."""

    __tablename__ = "anomaly_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[int] = mapped_column(
        ForeignKey("processing_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    row_index: Mapped[int] = mapped_column(nullable=False)
    anomaly_score: Mapped[float] = mapped_column(nullable=False)
    is_anomaly: Mapped[bool] = mapped_column(nullable=False)
    feature_contributions_json: Mapped[Optional[str]] = mapped_column(nullable=True)  # JSON

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="anomaly_results")
