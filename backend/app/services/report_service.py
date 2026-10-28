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
