"""ML anomaly detection using IsolationForest.

Feature contributions are computed as per-feature z-scores, which indicate
how far each feature value deviates from the column mean in units of standard
deviation. These are NOT SHAP values or model-level explanations; they are
simple statistical deviations that help explain *why* a record appears unusual.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Columns to always exclude from feature selection
_EXCLUDE_NAMES = frozenset({"id", "index"})


def detect_anomalies(
    file_path: str,
    dataset_id: int,
    job_id: int,
) -> List[Dict[str, Any]]:
    """Run IsolationForest on numeric features and return per-row results.

    Parameters
    ----------
    file_path:
        Absolute path to the CSV file.
    dataset_id:
        ID of the parent Dataset record (included in results for FK linkage).
    job_id:
        ID of the ProcessingJob record (included in results for FK linkage).

    Returns
    -------
    list of dicts, one per row, with keys:
        dataset_id, job_id, row_index, anomaly_score, is_anomaly,
        feature_contributions_json
    """
    logger.info(
        "Running anomaly detection: dataset_id=%d job_id=%d path=%s",
        dataset_id,
        job_id,
        file_path,
    )
    df = pd.read_csv(file_path, low_memory=False)

    if len(df) < 10:
        raise ValueError(
            f"Dataset has only {len(df)} rows; at least 10 are required for anomaly detection."
        )

    # -----------------------------------------------------------------------
    # Feature selection
    # -----------------------------------------------------------------------
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    eligible: List[str] = []
    for col in numeric_cols:
        if col.lower() in _EXCLUDE_NAMES:
            continue
        null_pct = df[col].isna().mean()
        if null_pct > 0.50:
            logger.debug("Skipping column '%s': %.1f%% nulls", col, null_pct * 100)
            continue
        if df[col].nunique(dropna=True) <= 1:
            logger.debug("Skipping column '%s': only 1 unique value", col)
            continue
        eligible.append(col)

    if len(eligible) < 2:
        raise ValueError(
            f"Anomaly detection requires at least 2 eligible numeric columns; "
            f"found {len(eligible)}: {eligible}. "
            "Ensure the dataset has numeric columns with sufficient variance and < 50% nulls."
        )

    logger.info("Eligible features (%d): %s", len(eligible), eligible)
    X = df[eligible].to_numpy(dtype=float)

    # -----------------------------------------------------------------------
    # Build & fit pipeline
    # -----------------------------------------------------------------------
    pipe = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("iforest", IsolationForest(
                contamination=0.05,
                random_state=42,
                n_estimators=100,
            )),
        ]
    )
    pipe.fit(X)
    raw_scores: np.ndarray = pipe.named_steps["iforest"].score_samples(
        pipe.named_steps["scaler"].transform(
            pipe.named_steps["imputer"].transform(X)
        )
    )
    predictions: np.ndarray = pipe.predict(X)

    # -----------------------------------------------------------------------
    # Feature contributions — z-scores from the scaled (imputed) data
    # -----------------------------------------------------------------------
    X_imputed: np.ndarray = pipe.named_steps["imputer"].transform(X)
    X_scaled: np.ndarray = pipe.named_steps["scaler"].transform(X_imputed)
    # X_scaled already IS the z-score matrix (StandardScaler output)

    results: List[Dict[str, Any]] = []
    for i in range(len(df)):
        contributions = {
            col: round(float(X_scaled[i, j]), 4)
            for j, col in enumerate(eligible)
        }
        results.append(
            {
                "dataset_id": dataset_id,
                "job_id": job_id,
                "row_index": i,
                "anomaly_score": round(float(-raw_scores[i]), 6),  # higher = more anomalous
                "is_anomaly": bool(predictions[i] == -1),
                "feature_contributions_json": json.dumps(contributions),
            }
        )

    anomaly_count = sum(1 for r in results if r["is_anomaly"])
    logger.info(
        "Anomaly detection complete: %d/%d rows flagged for dataset_id=%d",
        anomaly_count,
        len(df),
        dataset_id,
    )
    return results
