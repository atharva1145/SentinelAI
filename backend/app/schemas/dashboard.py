"""Dashboard Pydantic schemas."""
from __future__ import annotations

from datetime import date
from typing import List

from pydantic import BaseModel, ConfigDict


class SeverityCount(BaseModel):
    severity: str
    count: int


class DatasetSummary(BaseModel):
    """Lightweight dataset summary used in dashboard."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    status: str
    row_count: int | None = None


class DashboardStats(BaseModel):
    """Aggregated platform statistics."""

    total_datasets: int
    total_records: int
    total_issues: int
    total_anomalies: int
    severity_distribution: List[SeverityCount]
    recent_datasets: List[DatasetSummary]


class TrendPoint(BaseModel):
    """Issue count for a single day."""

    day: date
    count: int


class TrendResponse(BaseModel):
    issues_by_day: List[TrendPoint]
