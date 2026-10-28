"""Dataset profiling service — pure computation, no DB access."""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def profile_dataset(file_path: str) -> Dict[str, Any]:
    """Load a CSV and compute comprehensive column-level statistics.

    Returns a dict suitable for JSON serialisation and storage in
    ``Dataset.profile_json``.
    """
    logger.info("Profiling dataset: %s", file_path)
    df = pd.read_csv(file_path, low_memory=False)

    row_count, column_count = df.shape
    duplicate_row_count = int(df.duplicated().sum())
    memory_usage_bytes = int(df.memory_usage(deep=True).sum())

    columns: List[Dict[str, Any]] = []
    for col in df.columns:
        series = df[col]
        null_count = int(series.isna().sum())
        null_pct = round(null_count / row_count * 100, 4) if row_count else 0.0
        non_null = series.dropna()
        unique_count = int(non_null.nunique())
        unique_pct = round(unique_count / row_count * 100, 4) if row_count else 0.0
        sample_values = [
            _safe_json(v) for v in non_null.head(5).tolist()
        ]

        col_info: Dict[str, Any] = {
            "name": col,
            "dtype": str(series.dtype),
            "null_count": null_count,
            "null_pct": null_pct,
            "unique_count": unique_count,
            "unique_pct": unique_pct,
            "sample_values": sample_values,
        }

        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            col_info.update(
                {
                    "min": _safe_float(non_null.min()) if len(non_null) else None,
                    "max": _safe_float(non_null.max()) if len(non_null) else None,
                    "mean": _safe_float(non_null.mean()) if len(non_null) else None,
                    "std": _safe_float(non_null.std()) if len(non_null) > 1 else None,
                    "median": _safe_float(non_null.median()) if len(non_null) else None,
                    "q25": _safe_float(non_null.quantile(0.25)) if len(non_null) else None,
                    "q75": _safe_float(non_null.quantile(0.75)) if len(non_null) else None,
                }
            )
        else:
            str_lengths = non_null.astype(str).str.len()
            col_info.update(
                {
                    "min_length": int(str_lengths.min()) if len(str_lengths) else None,
                    "max_length": int(str_lengths.max()) if len(str_lengths) else None,
                    "avg_length": round(float(str_lengths.mean()), 4) if len(str_lengths) else None,
                }
            )

        columns.append(col_info)

    preview: List[Dict[str, Any]] = [
        {col: _safe_json(v) for col, v in row.items()}
        for row in df.head(100).to_dict(orient="records")
    ]

    result = {
        "row_count": row_count,
        "column_count": column_count,
        "duplicate_row_count": duplicate_row_count,
        "memory_usage_bytes": memory_usage_bytes,
        "columns": columns,
        "preview": preview,
    }
    logger.info(
        "Profiling complete: rows=%d cols=%d duplicates=%d",
        row_count,
        column_count,
        duplicate_row_count,
    )
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any) -> float | None:
    """Convert numpy scalar to Python float, handling NaN/Inf."""
    if val is None:
        return None
    try:
        f = float(val)
        return None if (np.isnan(f) or np.isinf(f)) else round(f, 6)
    except (TypeError, ValueError):
        return None


def _safe_json(val: Any) -> Any:
    """Make a value JSON-serialisable."""
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        f = float(val)
        return None if (np.isnan(f) or np.isinf(f)) else f
    if isinstance(val, np.bool_):
        return bool(val)
    if pd.isna(val) if not isinstance(val, (list, dict)) else False:
        return None
    return val
