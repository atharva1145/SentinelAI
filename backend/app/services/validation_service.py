"""Validation service — rule-based data quality checks."""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd

from app.models.issue import Issue

logger = logging.getLogger(__name__)

MAX_ISSUES = 500
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def validate_dataset(
    file_path: str,
    dataset_id: int,
    job_id: int,
    profile: Dict[str, Any],
) -> List[Issue]:
    """Run all rule-based checks and return a (possibly truncated) list of Issue objects.

    Issues are *not* persisted here — the caller is responsible for saving them.
    """
    logger.info("Validating dataset_id=%d job_id=%d path=%s", dataset_id, job_id, file_path)
    df = pd.read_csv(file_path, low_memory=False)

    issues: List[Issue] = []

    _check_missing_values(df, dataset_id, job_id, issues)
    _check_duplicate_rows(df, dataset_id, job_id, issues)
    _check_date_formats(df, dataset_id, job_id, issues)
    _check_email_formats(df, dataset_id, job_id, issues)
    _check_negative_values(df, dataset_id, job_id, issues)
    _check_out_of_range(df, dataset_id, job_id, issues)
    _check_category_consistency(df, dataset_id, job_id, issues)

    if len(issues) > MAX_ISSUES:
        logger.warning(
            "Issue count %d exceeds limit %d — truncating for dataset_id=%d",
            len(issues),
            MAX_ISSUES,
            dataset_id,
        )
        issues = issues[:MAX_ISSUES]

    logger.info("Validation produced %d issues for dataset_id=%d", len(issues), dataset_id)
    return issues


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

def _make_issue(
    *,
    dataset_id: int,
    job_id: int,
    row_index: Optional[int],
    column_name: Optional[str],
    rule_name: str,
    actual_value: Optional[str],
    expected_condition: str,
    severity: str,
    explanation: str,
    suggested_action: str,
) -> Issue:
    return Issue(
        dataset_id=dataset_id,
        job_id=job_id,
        row_index=row_index,
        column_name=column_name,
        detector="rule_based",
        rule_name=rule_name,
        actual_value=actual_value,
        expected_condition=expected_condition,
        severity=severity,
        status="open",
        explanation=explanation,
        suggested_action=suggested_action,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


def _missing_severity(null_pct: float) -> str:
    if null_pct >= 50:
        return "critical"
    if null_pct >= 20:
        return "high"
    if null_pct >= 5:
        return "medium"
    return "low"


def _check_missing_values(
    df: pd.DataFrame, dataset_id: int, job_id: int, issues: List[Issue]
) -> None:
    for col in df.columns:
        null_mask = df[col].isna()
        null_count = int(null_mask.sum())
        if null_count == 0:
            continue
        null_pct = null_count / len(df) * 100
        severity = _missing_severity(null_pct)
        for idx in df.index[null_mask].tolist():
            issues.append(
                _make_issue(
                    dataset_id=dataset_id,
                    job_id=job_id,
                    row_index=int(idx),
                    column_name=col,
                    rule_name="MissingValueCheck",
                    actual_value=None,
                    expected_condition="Non-null value",
                    severity=severity,
                    explanation=(
                        f"Column '{col}' has {null_count} missing values "
                        f"({null_pct:.1f}% of rows)."
                    ),
                    suggested_action=(
                        "Investigate the data source. Consider imputation, "
                        "removal, or flagging records with missing values."
                    ),
                )
            )
            if len(issues) >= MAX_ISSUES:
                return


def _check_duplicate_rows(
    df: pd.DataFrame, dataset_id: int, job_id: int, issues: List[Issue]
) -> None:
    dup_mask = df.duplicated(keep="first")
    for idx in df.index[dup_mask].tolist():
        issues.append(
            _make_issue(
                dataset_id=dataset_id,
                job_id=job_id,
                row_index=int(idx),
                column_name=None,
                rule_name="DuplicateRowCheck",
                actual_value=f"Row {idx}",
                expected_condition="All rows should be unique",
                severity="high",
                explanation=f"Row {idx} is an exact duplicate of an earlier row.",
                suggested_action=(
                    "Remove or de-duplicate rows. Investigate upstream ETL "
                    "processes that may introduce duplicates."
                ),
            )
        )
        if len(issues) >= MAX_ISSUES:
            return


def _check_date_formats(
    df: pd.DataFrame, dataset_id: int, job_id: int, issues: List[Issue]
) -> None:
    date_cols = [
        c
        for c in df.columns
        if any(k in c.lower() for k in ("date", "time", "timestamp", "datetime"))
        or c.lower().endswith(("_at", "_dt"))
    ]
    for col in date_cols:
        for idx, val in df[col].items():
            if pd.isna(val):
                continue
            try:
                pd.to_datetime(val)
            except (ValueError, TypeError):
                issues.append(
                    _make_issue(
                        dataset_id=dataset_id,
                        job_id=job_id,
                        row_index=int(idx),  # type: ignore[arg-type]
                        column_name=col,
                        rule_name="DateFormatCheck",
                        actual_value=str(val),
                        expected_condition="Parseable date/time string",
                        severity="medium",
                        explanation=f"Value '{val}' in column '{col}' cannot be parsed as a date/time.",
                        suggested_action="Standardise date formats in the source system (e.g., ISO 8601).",
                    )
                )
            if len(issues) >= MAX_ISSUES:
                return


def _check_email_formats(
    df: pd.DataFrame, dataset_id: int, job_id: int, issues: List[Issue]
) -> None:
    email_cols = [c for c in df.columns if "email" in c.lower()]
    for col in email_cols:
        for idx, val in df[col].items():
            if pd.isna(val):
                continue
            if not EMAIL_RE.match(str(val).strip()):
                issues.append(
                    _make_issue(
                        dataset_id=dataset_id,
                        job_id=job_id,
                        row_index=int(idx),  # type: ignore[arg-type]
                        column_name=col,
                        rule_name="EmailFormatCheck",
                        actual_value=str(val),
                        expected_condition="Valid email address format",
                        severity="medium",
                        explanation=f"Value '{val}' in column '{col}' is not a valid email address.",
                        suggested_action="Validate email input at the point of capture.",
                    )
                )
            if len(issues) >= MAX_ISSUES:
                return


def _check_negative_values(
    df: pd.DataFrame, dataset_id: int, job_id: int, issues: List[Issue]
) -> None:
    keywords = ("amount", "price", "cost", "revenue", "salary")
    money_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in keywords)
        and pd.api.types.is_numeric_dtype(df[c])
    ]
    for col in money_cols:
        neg_mask = df[col] < 0
        for idx in df.index[neg_mask].tolist():
            issues.append(
                _make_issue(
                    dataset_id=dataset_id,
                    job_id=job_id,
                    row_index=int(idx),
                    column_name=col,
                    rule_name="NegativeValueCheck",
                    actual_value=str(df.at[idx, col]),
                    expected_condition="Value >= 0",
                    severity="high",
                    explanation=f"Column '{col}' contains a negative value ({df.at[idx, col]}).",
                    suggested_action="Review data entry process; negative monetary values are typically erroneous.",
                )
            )
            if len(issues) >= MAX_ISSUES:
                return


def _check_out_of_range(
    df: pd.DataFrame, dataset_id: int, job_id: int, issues: List[Issue]
) -> None:
    pct_keywords = ("pct", "percent", "rate")
    pct_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in pct_keywords)
        and pd.api.types.is_numeric_dtype(df[c])
    ]
    for col in pct_cols:
        oor_mask = (df[col] < 0) | (df[col] > 100)
        for idx in df.index[oor_mask].tolist():
            issues.append(
                _make_issue(
                    dataset_id=dataset_id,
                    job_id=job_id,
                    row_index=int(idx),
                    column_name=col,
                    rule_name="OutOfRangeCheck",
                    actual_value=str(df.at[idx, col]),
                    expected_condition="Value in [0, 100]",
                    severity="medium",
                    explanation=f"Column '{col}' has value {df.at[idx, col]} outside [0, 100].",
                    suggested_action="Verify the scale/units of the percentage column.",
                )
            )
            if len(issues) >= MAX_ISSUES:
                return


def _check_category_consistency(
    df: pd.DataFrame, dataset_id: int, job_id: int, issues: List[Issue]
) -> None:
    if len(df) < 100:
        return
    object_cols = df.select_dtypes(include="object").columns.tolist()
    for col in object_cols:
        non_null = df[col].dropna()
        if non_null.nunique() > 20:
            continue
        value_counts = non_null.value_counts()
        rare_values = value_counts[value_counts == 1].index.tolist()
        for val in rare_values:
            idx_list = df.index[df[col] == val].tolist()
            for idx in idx_list:
                issues.append(
                    _make_issue(
                        dataset_id=dataset_id,
                        job_id=job_id,
                        row_index=int(idx),
                        column_name=col,
                        rule_name="CategoryConsistencyCheck",
                        actual_value=str(val),
                        expected_condition="Value appears more than once (not a likely typo)",
                        severity="low",
                        explanation=(
                            f"Value '{val}' in column '{col}' appears only once "
                            "among a low-cardinality categorical field — possible typo."
                        ),
                        suggested_action="Review the value against the expected category list and correct if needed.",
                    )
                )
                if len(issues) >= MAX_ISSUES:
                    return
