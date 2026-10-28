"""Data distribution drift detection using Kolmogorov-Smirnov test and Wasserstein distance."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from scipy.stats import ks_2samp, wasserstein_distance

logger = logging.getLogger(__name__)


def compute_dataset_drift(
    current_file_path: str,
    baseline_file_path: str,
    p_value_threshold: float = 0.05,
) -> Dict[str, Any]:
    """Compare distributions between current and baseline datasets.

    Parameters
    ----------
    current_file_path:
        Path to the evaluated dataset CSV.
    baseline_file_path:
        Path to the baseline/reference dataset CSV.
    p_value_threshold:
        Alpha significance level for the Kolmogorov-Smirnov test (default 0.05).

    Returns
    -------
    dict with overall drift metrics and per-feature drift analysis.
    """
    df_current = pd.read_csv(current_file_path, low_memory=False)
    df_baseline = pd.read_csv(baseline_file_path, low_memory=False)

    current_numeric = set(df_current.select_dtypes(include="number").columns)
    baseline_numeric = set(df_baseline.select_dtypes(include="number").columns)
    common_features = sorted(list(current_numeric.intersection(baseline_numeric)))

    # Filter out IDs
    common_features = [
        c for c in common_features
        if c.lower() not in ("id", "index", "row_index", "is_anomaly_label")
    ]

    if not common_features:
        return {
            "has_drift": False,
            "drift_share": 0.0,
            "drifted_features_count": 0,
            "total_features_evaluated": 0,
            "features": [],
            "message": "No common numeric features available to evaluate distribution drift.",
        }

    features_report: List[Dict[str, Any]] = []
    drifted_count = 0

    for col in common_features:
        s_curr = df_current[col].dropna().to_numpy(dtype=float)
        s_base = df_baseline[col].dropna().to_numpy(dtype=float)

        if len(s_curr) < 5 or len(s_base) < 5:
            continue

        ks_res = ks_2samp(s_curr, s_base)
        stat = float(ks_res.statistic)
        p_val = float(ks_res.pvalue)
        w_dist = float(wasserstein_distance(s_curr, s_base))

        is_drifted = bool(p_val < p_value_threshold and stat > 0.10)
        if is_drifted:
            drifted_count += 1

        features_report.append(
            {
                "column": col,
                "ks_statistic": round(stat, 4),
                "p_value": round(p_val, 6),
                "wasserstein_distance": round(w_dist, 4),
                "current_mean": round(float(np.mean(s_curr)), 3),
                "baseline_mean": round(float(np.mean(s_base)), 3),
                "is_drifted": is_drifted,
            }
        )

    drift_share = round(drifted_count / len(features_report), 4) if features_report else 0.0
    has_drift = drift_share >= 0.33  # Flag dataset-level drift if >= 33% of features drifted

    return {
        "has_drift": has_drift,
        "drift_share": drift_share,
        "drifted_features_count": drifted_count,
        "total_features_evaluated": len(features_report),
        "features": features_report,
    }
