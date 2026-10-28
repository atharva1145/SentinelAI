"""ML anomaly detection suite supporting IsolationForest, LocalOutlierFactor, OneClassSVM, and Ensembles.

Feature contributions are computed both as:
1. Empirical z-scores: how far each feature deviates from the column mean in units of std.
2. Game-theoretic TreeSHAP values: marginal contributions to isolation forest decision paths.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.svm import OneClassSVM
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Columns to always exclude from feature selection
_EXCLUDE_NAMES = frozenset({"id", "index", "target", "label", "is_anomaly_label"})


def detect_anomalies(
    file_path: str,
    dataset_id: int,
    job_id: int,
    algorithm: str = "isolation_forest",
    contamination: float = 0.05,
) -> List[Dict[str, Any]]:
    """Run anomaly detection pipeline on numeric features and return per-row results.

    Parameters
    ----------
    file_path:
        Absolute path to the CSV file.
    dataset_id:
        ID of the parent Dataset record.
    job_id:
        ID of the ProcessingJob record.
    algorithm:
        One of 'isolation_forest', 'local_outlier_factor', 'one_class_svm', or 'ensemble'.
    contamination:
        Expected proportion of outliers (default: 0.05).

    Returns
    -------
    list of dicts, one per row:
        dataset_id, job_id, row_index, anomaly_score, is_anomaly, feature_contributions_json
    """
    logger.info(
        "Running anomaly detection: dataset_id=%d job_id=%d algorithm=%s contamination=%.3f path=%s",
        dataset_id,
        job_id,
        algorithm,
        contamination,
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
    # Preprocessing
    # -----------------------------------------------------------------------
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()

    X_imputed = imputer.fit_transform(X)
    X_scaled = scaler.fit_transform(X_imputed)

    # -----------------------------------------------------------------------
    # Model Selection & Inference
    # -----------------------------------------------------------------------
    algo = algorithm.lower().strip()
    if algo == "local_outlier_factor":
        model = LocalOutlierFactor(n_neighbors=20, contamination=contamination, novelty=True)
        model.fit(X_scaled)
        predictions = model.predict(X_scaled)
        raw_scores = model.score_samples(X_scaled)
    elif algo == "one_class_svm":
        model = OneClassSVM(nu=contamination, kernel="rbf", gamma="scale")
        model.fit(X_scaled)
        predictions = model.predict(X_scaled)
        raw_scores = model.decision_function(X_scaled)
    elif algo == "ensemble":
        # Ensemble: Isolation Forest + Local Outlier Factor
        if_model = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
        lof_model = LocalOutlierFactor(n_neighbors=20, contamination=contamination, novelty=True)
        if_model.fit(X_scaled)
        lof_model.fit(X_scaled)

        pred_if = if_model.predict(X_scaled)
        pred_lof = lof_model.predict(X_scaled)
        scores_if = if_model.score_samples(X_scaled)
        scores_lof = lof_model.score_samples(X_scaled)

        # Flag if either model detects or consensus
        predictions = np.where((pred_if == -1) | (pred_lof == -1), -1, 1)
        raw_scores = (scores_if + scores_lof) / 2.0
        model = if_model
    else:
        # Default: Isolation Forest
        model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100,
        )
        model.fit(X_scaled)
        raw_scores = model.score_samples(X_scaled)
        predictions = model.predict(X_scaled)

    # -----------------------------------------------------------------------
    # Game-Theoretic TreeSHAP Interpretability
    # -----------------------------------------------------------------------
    shap_matrix = None
    if isinstance(model, IsolationForest):
        try:
            import shap
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_scaled)
            if isinstance(shap_values, np.ndarray):
                shap_matrix = shap_values
            elif isinstance(shap_values, list) and len(shap_values) > 0:
                shap_matrix = shap_values[0]
        except Exception as exc:
            logger.debug("TreeSHAP computation skipped or unsupported: %s", exc)

    # -----------------------------------------------------------------------
    # Format per-row results with feature deviations & SHAP
    # -----------------------------------------------------------------------
    results: List[Dict[str, Any]] = []
    for i in range(len(df)):
        contributions: Dict[str, Any] = {
            col: round(float(X_scaled[i, j]), 4)
            for j, col in enumerate(eligible)
        }
        if shap_matrix is not None and i < len(shap_matrix):
            contributions["_shap"] = {
                col: round(float(shap_matrix[i, j]), 4)
                for j, col in enumerate(eligible)
            }

        score = float(-raw_scores[i])
        results.append(
            {
                "dataset_id": dataset_id,
                "job_id": job_id,
                "row_index": i,
                "anomaly_score": round(score, 6),  # higher = more anomalous
                "is_anomaly": bool(predictions[i] == -1),
                "feature_contributions_json": json.dumps(contributions),
            }
        )

    anomaly_count = sum(1 for r in results if r["is_anomaly"])
    logger.info(
        "Anomaly detection complete [%s]: %d/%d rows flagged for dataset_id=%d",
        algo,
        anomaly_count,
        len(df),
        dataset_id,
    )
    return results
