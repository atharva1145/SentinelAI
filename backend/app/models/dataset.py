"""Dataset and ProcessingJob ORM models."""
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.issue import Issue, AnomalyResult


class Dataset(Base):
    """Represents an uploaded CSV dataset."""

    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(nullable=False)          # safe server-side name
    original_filename: Mapped[str] = mapped_column(nullable=False)
    file_path: Mapped[str] = mapped_column(nullable=False)
    file_size: Mapped[int] = mapped_column(nullable=False)
    row_count: Mapped[Optional[int]] = mapped_column(nullable=True)
    column_count: Mapped[Optional[int]] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(
        nullable=False,
        default="uploaded",
        server_default=text("'uploaded'"),
    )
    error_message: Mapped[Optional[str]] = mapped_column(nullable=True)
    profile_json: Mapped[Optional[str]] = mapped_column(nullable=True)  # JSON string
    uploaded_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        server_default=func.now(),
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Relationships
    issues: Mapped[List["Issue"]] = relationship(
        "Issue", back_populates="dataset", cascade="all, delete-orphan"
    )
    anomaly_results: Mapped[List["AnomalyResult"]] = relationship(
        "AnomalyResult", back_populates="dataset", cascade="all, delete-orphan"
    )
    processing_jobs: Mapped[List["ProcessingJob"]] = relationship(
        "ProcessingJob", back_populates="dataset", cascade="all, delete-orphan"
    )


class ProcessingJob(Base):
    """Tracks async processing tasks for a dataset."""

    __tablename__ = "processing_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_type: Mapped[str] = mapped_column(nullable=False)   # "validate" | "detect_anomalies"
    status: Mapped[str] = mapped_column(nullable=False, default="pending")
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(nullable=True)
    result_summary_json: Mapped[Optional[str]] = mapped_column(nullable=True)

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="processing_jobs")
