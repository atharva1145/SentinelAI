"""Data Auto-Remediation and Repair Service."""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _sanitize_series_date(val: Any) -> Any:
    """Attempt to parse date strings and format to ISO-8601 YYYY-MM-DD."""
    if pd.isna(val) or val is None:
        return val
    s = str(val).strip()
    if not s or s.lower() in ("nan", "nat", "null"):
        return val
    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.notna(dt):
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    return val


def execute_remediation(
    df: pd.DataFrame,
    config: Dict[str, Any],
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Applies configured cleaning and remediation steps on a DataFrame.

    Returns the repaired DataFrame and a comprehensive audit remediation summary.
    """
    initial_rows = len(df)
    initial_cols = len(df.columns)
    audit_log: List[Dict[str, Any]] = []

    repaired_df = df.copy()

    # 1. Deduplication
    duplicates_removed = 0
    if config.get("deduplicate", True):
        dup_mask = repaired_df.duplicated(keep="first")
        duplicates_removed = int(dup_mask.sum())
        if duplicates_removed > 0:
            repaired_df = repaired_df[~dup_mask].copy().reset_index(drop=True)
            audit_log.append({
                "action": "Deduplication",
                "affected_count": duplicates_removed,
                "description": f"Removed {duplicates_removed} exact duplicate row(s), keeping first occurrences.",
            })

    # 2. String Whitespace Sanitization
    trimmed_cells = 0
    if config.get("clean_whitespace", True):
        for col in repaired_df.select_dtypes(include=["object", "string"]).columns:
            str_series = repaired_df[col].astype(str)
            needs_trim = (str_series != str_series.str.strip()) & repaired_df[col].notna()
            trim_count = int(needs_trim.sum())
            if trim_count > 0:
                repaired_df[col] = repaired_df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
                trimmed_cells += trim_count
                audit_log.append({
                    "action": "Whitespace Normalization",
                    "column": col,
                    "affected_count": trim_count,
                    "description": f"Stripped trailing and leading whitespace in column '{col}'.",
                })

    # 3. Missing Value Imputation
    imputed_cells = 0
    rows_dropped_missing = 0
    impute_cfg = config.get("impute_missing", {})
    if isinstance(impute_cfg, bool):
        impute_enabled = impute_cfg
        impute_strategy = "auto"
    else:
        impute_enabled = impute_cfg.get("enabled", True)
        impute_strategy = impute_cfg.get("strategy", "auto")

    if impute_enabled:
        if impute_strategy == "drop_rows":
            before_drop = len(repaired_df)
            repaired_df = repaired_df.dropna().reset_index(drop=True)
            rows_dropped_missing = before_drop - len(repaired_df)
            if rows_dropped_missing > 0:
                audit_log.append({
                    "action": "Drop Incomplete Records",
                    "affected_count": rows_dropped_missing,
                    "description": f"Dropped {rows_dropped_missing} row(s) containing missing values.",
                })
        else:
            for col in repaired_df.columns:
                null_count = int(repaired_df[col].isna().sum())
                if null_count == 0:
                    continue

                if pd.api.types.is_numeric_dtype(repaired_df[col]) and not pd.api.types.is_bool_dtype(repaired_df[col]):
                    median_val = float(repaired_df[col].median()) if not np.isnan(repaired_df[col].median()) else 0.0
                    repaired_df[col] = repaired_df[col].fillna(median_val)
                    imputed_cells += null_count
                    audit_log.append({
                        "action": "Median Imputation",
                        "column": col,
                        "affected_count": null_count,
                        "description": f"Imputed {null_count} missing numeric values in '{col}' with median ({median_val:.2f}).",
                    })
                else:
                    mode_series = repaired_df[col].dropna().mode()
                    mode_val = mode_series.iloc[0] if len(mode_series) > 0 else "Unknown"
                    repaired_df[col] = repaired_df[col].fillna(mode_val)
                    imputed_cells += null_count
                    audit_log.append({
                        "action": "Mode Imputation",
                        "column": col,
                        "affected_count": null_count,
                        "description": f"Imputed {null_count} missing categorical values in '{col}' with mode ('{mode_val}').",
                    })

    # 4. Out-of-Range & Negative Value Clamping
    clamped_values = 0
    if config.get("clamp_ranges", True):
        for col in repaired_df.columns:
            if not pd.api.types.is_numeric_dtype(repaired_df[col]) or pd.api.types.is_bool_dtype(repaired_df[col]):
                continue

            col_lower = col.lower()
            # Negative financial values
            if any(term in col_lower for term in ["amount", "price", "salary", "cost", "revenue", "fee"]):
                neg_mask = repaired_df[col] < 0
                neg_count = int(neg_mask.sum())
                if neg_count > 0:
                    repaired_df.loc[neg_mask, col] = 0.0
                    clamped_values += neg_count
                    audit_log.append({
                        "action": "Floor Clamping",
                        "column": col,
                        "affected_count": neg_count,
                        "description": f"Clamped {neg_count} invalid negative value(s) in '{col}' to 0.0.",
                    })

            # Percentage bounds [0, 100]
            if any(term in col_lower for term in ["pct", "percentage", "rate", "probability"]):
                out_mask = (repaired_df[col] < 0) | (repaired_df[col] > 100)
                out_count = int(out_mask.sum())
                if out_count > 0:
                    repaired_df[col] = repaired_df[col].clip(lower=0.0, upper=100.0)
                    clamped_values += out_count
                    audit_log.append({
                        "action": "Boundary Clamping",
                        "column": col,
                        "affected_count": out_count,
                        "description": f"Clamped {out_count} percentage value(s) in '{col}' to range [0.0, 100.0].",
                    })

    # 5. Date Format Standardization
    standardized_dates = 0
    if config.get("standardize_dates", True):
        date_candidates = [
            c for c in repaired_df.columns
            if any(t in c.lower() for t in ["date", "time", "created", "timestamp", "dob", "joined"])
            and not pd.api.types.is_numeric_dtype(repaired_df[c])
        ]
        for col in date_candidates:
            orig = repaired_df[col].copy()
            converted = repaired_df[col].apply(_sanitize_series_date)
            diff_count = int((orig != converted).sum())
            if diff_count > 0:
                repaired_df[col] = converted
                standardized_dates += diff_count
                audit_log.append({
                    "action": "Date ISO-8601 Standardization",
                    "column": col,
                    "affected_count": diff_count,
                    "description": f"Standardized {diff_count} date value(s) in '{col}' to uniform 'YYYY-MM-DD'.",
                })

    summary = {
        "initial_rows": initial_rows,
        "final_rows": len(repaired_df),
        "initial_columns": initial_cols,
        "final_columns": len(repaired_df.columns),
        "duplicates_removed": duplicates_removed,
        "imputed_cells": imputed_cells,
        "rows_dropped_missing": rows_dropped_missing,
        "clamped_values": clamped_values,
        "standardized_dates": standardized_dates,
        "trimmed_cells": trimmed_cells,
        "total_repairs": (
            duplicates_removed
            + imputed_cells
            + rows_dropped_missing
            + clamped_values
            + standardized_dates
            + trimmed_cells
        ),
        "audit_log": audit_log,
    }
    return repaired_df, summary
