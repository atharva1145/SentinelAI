"""Report generation service."""
from __future__ import annotations

import csv
import io
import logging
from typing import List

from sqlalchemy.orm import Session

from app.models.issue import Issue

logger = logging.getLogger(__name__)

REPORT_COLUMNS = [
    "id",
    "dataset_id",
    "row_index",
    "column_name",
    "detector",
    "rule_name",
    "actual_value",
    "expected_condition",
    "severity",
    "status",
    "explanation",
    "suggested_action",
    "created_at",
]


def generate_report_csv(dataset_id: int, db: Session) -> str:
    """Query all issues for *dataset_id* and return them as a CSV string."""
    logger.info("Generating CSV report for dataset_id=%d", dataset_id)
    issues: List[Issue] = (
        db.query(Issue)
        .filter(Issue.dataset_id == dataset_id)
        .order_by(Issue.id)
        .all()
    )

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=REPORT_COLUMNS, extrasaction="ignore")
    writer.writeheader()

    for issue in issues:
        writer.writerow(
            {
                "id": issue.id,
                "dataset_id": issue.dataset_id,
                "row_index": issue.row_index,
                "column_name": issue.column_name,
                "detector": issue.detector,
                "rule_name": issue.rule_name,
                "actual_value": issue.actual_value,
                "expected_condition": issue.expected_condition,
                "severity": issue.severity,
                "status": issue.status,
                "explanation": issue.explanation,
                "suggested_action": issue.suggested_action,
                "created_at": issue.created_at.isoformat() if issue.created_at else "",
            }
        )

    csv_content = output.getvalue()
    logger.info("Report CSV generated: %d rows for dataset_id=%d", len(issues), dataset_id)
    return csv_content


def generate_clean_dataset_csv(dataset_id: int, file_path: str, db: Session) -> str:
    """Generate CSV with clean records (excluding rows with critical/high issues or ML anomalies)."""
    import pandas as pd
    from app.models.issue import Issue, AnomalyResult

    df = pd.read_csv(file_path, low_memory=False)

    bad_issue_rows = set(
        r[0]
        for r in db.query(Issue.row_index)
        .filter(Issue.dataset_id == dataset_id, Issue.row_index.isnot(None), Issue.severity.in_(["high", "critical"]))
        .all()
    )
    anomaly_rows = set(
        r[0]
        for r in db.query(AnomalyResult.row_index)
        .filter(AnomalyResult.dataset_id == dataset_id, AnomalyResult.is_anomaly.is_(True))
        .all()
    )
    exclude_rows = bad_issue_rows.union(anomaly_rows)

    clean_df = df.drop(index=[idx for idx in exclude_rows if idx in df.index], errors="ignore")
    logger.info("Clean dataset CSV generated: %d clean rows (dropped %d) for dataset_id=%d", len(clean_df), len(exclude_rows), dataset_id)
    return clean_df.to_csv(index=False)


def generate_quarantine_dataset_csv(dataset_id: int, file_path: str, db: Session) -> str:
    """Generate CSV with only quarantined records and combined audit reason explanations."""
    import pandas as pd
    from app.models.issue import Issue, AnomalyResult

    df = pd.read_csv(file_path, low_memory=False)

    issues = (
        db.query(Issue.row_index, Issue.rule_name, Issue.severity, Issue.explanation)
        .filter(Issue.dataset_id == dataset_id, Issue.row_index.isnot(None))
        .all()
    )
    anomalies = (
        db.query(AnomalyResult.row_index, AnomalyResult.anomaly_score)
        .filter(AnomalyResult.dataset_id == dataset_id, AnomalyResult.is_anomaly.is_(True))
        .all()
    )

    reasons: dict[int, list[str]] = {}
    for r_idx, rule, sev, exp in issues:
        if sev in ("high", "critical"):
            reasons.setdefault(r_idx, []).append(f"[{sev.upper()}] {rule}: {exp}")
    for r_idx, score in anomalies:
        reasons.setdefault(r_idx, []).append(f"[ML ANOMALY] Score: {score:.3f}")

    flagged_indices = [idx for idx in reasons if idx in df.index]
    if not flagged_indices:
        return "row_index,quarantine_reason\n"

    quarantine_df = df.loc[flagged_indices].copy()
    quarantine_df["quarantine_reason"] = [
        " | ".join(reasons.get(idx, [])) for idx in flagged_indices
    ]
    logger.info("Quarantine CSV generated: %d flagged rows for dataset_id=%d", len(quarantine_df), dataset_id)
    return quarantine_df.to_csv(index=False)
