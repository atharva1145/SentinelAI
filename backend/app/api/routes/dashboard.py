"""Dashboard API routes."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.dataset import Dataset
from app.models.issue import Issue, AnomalyResult
from app.schemas.dashboard import (
    DashboardStats,
    DatasetSummary,
    SeverityCount,
    TrendPoint,
    TrendResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)) -> DashboardStats:
    """Return aggregated platform statistics."""
    total_datasets = db.query(Dataset).count()

    # Sum row_count across all datasets (handle NULL)
    total_records_result = db.query(func.sum(Dataset.row_count)).scalar()
    total_records = int(total_records_result) if total_records_result else 0

    total_issues = db.query(Issue).count()
    total_anomalies = db.query(AnomalyResult).filter(AnomalyResult.is_anomaly.is_(True)).count()

    severity_rows = (
        db.query(Issue.severity, func.count(Issue.id))
        .group_by(Issue.severity)
        .all()
    )
    severity_distribution: List[SeverityCount] = [
        SeverityCount(severity=row[0], count=row[1]) for row in severity_rows
    ]

    recent_datasets = (
        db.query(Dataset)
        .order_by(Dataset.uploaded_at.desc())
        .limit(5)
        .all()
    )
    recent_summaries = [DatasetSummary.model_validate(d) for d in recent_datasets]

    return DashboardStats(
        total_datasets=total_datasets,
        total_records=total_records,
        total_issues=total_issues,
        total_anomalies=total_anomalies,
        severity_distribution=severity_distribution,
        recent_datasets=recent_summaries,
    )


@router.get("/dashboard/trends", response_model=TrendResponse)
def get_dashboard_trends(db: Session = Depends(get_db)) -> TrendResponse:
    """Return daily issue counts for the last 30 days."""
    cutoff = datetime.utcnow() - timedelta(days=30)

    # Fetch all issues created in window
    issues = (
        db.query(Issue.created_at)
        .filter(Issue.created_at >= cutoff)
        .all()
    )

    # Aggregate in Python (works for both SQLite and Postgres)
    counts: dict[date, int] = {}
    for (created_at,) in issues:
        d = created_at.date() if isinstance(created_at, datetime) else created_at
        counts[d] = counts.get(d, 0) + 1

    # Fill in zeros for missing days
    today = datetime.utcnow().date()
    points: List[TrendPoint] = []
    for offset in range(30, -1, -1):
        day = today - timedelta(days=offset)
        points.append(TrendPoint(day=day, count=counts.get(day, 0)))

    return TrendResponse(issues_by_day=points)
