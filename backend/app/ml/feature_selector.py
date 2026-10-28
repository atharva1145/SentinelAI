"""Feature selector utility (used by anomaly_detector internally)."""
from __future__ import annotations

from typing import List

import pandas as pd

_EXCLUDE_NAMES = frozenset({"id", "index"})


def select_numeric_features(df: pd.DataFrame, max_null_pct: float = 0.50) -> List[str]:
    """Return eligible numeric column names for ML processing.

    Excludes:
    - Columns named 'id' or 'index'
    - Columns with more than *max_null_pct* fraction of nulls
    - Columns with only 1 unique non-null value
    """
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    eligible: List[str] = []
    for col in numeric_cols:
        if col.lower() in _EXCLUDE_NAMES:
            continue
        if df[col].isna().mean() > max_null_pct:
            continue
        if df[col].nunique(dropna=True) <= 1:
            continue
        eligible.append(col)
    return eligible
