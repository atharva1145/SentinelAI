"""Data Quality Health Score calculation service."""
from __future__ import annotations

import json
from typing import Any, Dict
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.issue import Issue, AnomalyResult


def calculate_dataset_health_score(dataset: Dataset, db: Session) -> Dict[str, Any]:
    """Computes a composite Data Quality Health Score (0-100) and letter grade."""
    row_count = dataset.row_count or 1
    col_count = dataset.column_count or 1

    # 1. Completeness & Uniqueness from profile
    total_nulls = 0
    duplicate_count = 0
    if dataset.profile_json:
        try:
            profile = json.loads(dataset.profile_json)
            duplicate_count = int(profile.get("duplicate_row_count", 0))
            for col in profile.get("columns", []):
                total_nulls += int(col.get("null_count", 0))
        except Exception:
            pass

    total_cells = max(1, row_count * col_count)
    null_ratio = min(1.0, total_nulls / total_cells)
    completeness_score = max(0.0, min(100.0, (1.0 - null_ratio) * 100.0))

    dup_ratio = min(1.0, duplicate_count / max(1, row_count))
    uniqueness_score = max(0.0, min(100.0, (1.0 - dup_ratio) * 100.0))

    # 2. Validity from issues
    issues = db.query(Issue).filter(Issue.dataset_id == dataset.id).all()
    # Weight issues by severity
    issue_penalty = 0.0
    for issue in issues:
        sev = (issue.severity or "medium").lower()
        if sev == "critical":
            issue_penalty += 2.5
        elif sev == "high":
            issue_penalty += 1.0
        elif sev == "medium":
            issue_penalty += 0.4
        else:
            issue_penalty += 0.1

    # Normalized validity score relative to row count
    validity_ratio = min(1.0, issue_penalty / max(10, row_count * 0.5))
    validity_score = max(0.0, min(100.0, (1.0 - validity_ratio) * 100.0))

    # 3. Anomaly-free score
    anomaly_count = db.query(AnomalyResult).filter(AnomalyResult.dataset_id == dataset.id).count()
    anomaly_ratio = min(1.0, anomaly_count / max(1, row_count))
    anomaly_free_score = max(0.0, min(100.0, (1.0 - anomaly_ratio * 3.0) * 100.0))

    # 4. Composite weighted score
    overall_score = round(
        0.35 * completeness_score
        + 0.35 * validity_score
        + 0.15 * uniqueness_score
        + 0.15 * anomaly_free_score,
        1,
    )

    # 5. Letter grade and assessment
    if overall_score >= 90:
        grade = "A"
        status_label = "Production Ready"
        color = "#10b981"
    elif overall_score >= 80:
        grade = "B"
        status_label = "Good Quality"
        color = "#3b82f6"
    elif overall_score >= 70:
        grade = "C"
        status_label = "Acceptable with Warnings"
        color = "#f59e0b"
    elif overall_score >= 60:
        grade = "D"
        status_label = "Needs Remediation"
        color = "#f97316"
    else:
        grade = "F"
        status_label = "Critical Risk / Quarantined"
        color = "#ef4444"

    return {
        "dataset_id": dataset.id,
        "filename": dataset.original_filename,
        "overall_score": overall_score,
        "grade": grade,
        "status_label": status_label,
        "color": color,
        "dimensions": {
            "completeness": round(completeness_score, 1),
            "validity": round(validity_score, 1),
            "uniqueness": round(uniqueness_score, 1),
            "anomaly_free": round(anomaly_free_score, 1),
        },
        "metrics": {
            "total_rows": row_count,
            "total_columns": col_count,
            "total_issues": len(issues),
            "critical_issues": sum(1 for i in issues if (i.severity or "").lower() == "critical"),
            "high_issues": sum(1 for i in issues if (i.severity or "").lower() == "high"),
            "total_anomalies": anomaly_count,
            "duplicate_rows": duplicate_count,
            "total_null_cells": total_nulls,
        },
    }
