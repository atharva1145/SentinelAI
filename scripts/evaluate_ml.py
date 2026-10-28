"""
ML Anomaly Detector Evaluation Script

Evaluates IsolationForest performance against known labels in the synthetic dataset.

IMPORTANT CAVEATS:
- This evaluation is on SYNTHETIC data — real-world performance will differ
- Class imbalance (~5% anomalies) makes accuracy misleading; use F1/recall
- The model was not trained on these labels — this is unsupervised evaluation
- High precision/recall on synthetic data does NOT guarantee real-world performance
"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "synthetic"
LABELED_CSV = DATA_DIR / "transactions_labeled.csv"
RESULTS_JSON = DATA_DIR / "evaluation_results.json"

# Columns to drop before modeling
DROP_COLS = ["transaction_id", "customer_id", "email", "transaction_date", "is_anomaly_label"]
CATEGORICAL_COLS = ["merchant_category", "merchant_country"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_and_prepare(path: Path):
    """Load labeled CSV, extract labels, one-hot encode categoricals."""
    df = pd.read_csv(path)
    print(f"Loaded {len(df):,} rows from {path.name}")

    y_true = df["is_anomaly_label"].astype(int).values

    # Drop non-feature columns
    X = df.drop(columns=DROP_COLS, errors="ignore")

    # One-hot encode categorical columns (handle unknown categories safely)
    X = pd.get_dummies(X, columns=CATEGORICAL_COLS, drop_first=False)

    # Convert bool columns to int so sklearn doesn't complain
    bool_cols = X.select_dtypes(include="bool").columns
    X[bool_cols] = X[bool_cols].astype(int)

    print(f"Feature matrix: {X.shape[0]} rows × {X.shape[1]} features")
    print(f"Positive (anomaly) rate: {y_true.mean()*100:.2f}%\n")
    return X, y_true


def build_pipeline() -> Pipeline:
    """Mirror the production pipeline exactly."""
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("iso_forest", IsolationForest(
            contamination=0.05,
            random_state=42,
            n_estimators=100,
        )),
    ])


def evaluate(X: pd.DataFrame, y_true: np.ndarray, pipeline: Pipeline):
    """Fit pipeline and compute evaluation metrics."""
    # NOTE: IsolationForest is unsupervised — labels are NOT used here
    pipeline.fit(X)

    # Predictions: IsolationForest returns -1 (anomaly) or 1 (normal)
    raw_pred = pipeline.predict(X)
    y_pred = (raw_pred == -1).astype(int)

    # Anomaly scores (lower = more anomalous), negate for ROC AUC
    scores = -pipeline.decision_function(X)   # higher = more anomalous

    # Metrics
    cm = confusion_matrix(y_true, y_pred)
    report = classification_report(
        y_true, y_pred,
        target_names=["normal", "anomaly"],
        output_dict=True,
        zero_division=0,
    )
    roc_auc = roc_auc_score(y_true, scores)

    return cm, report, roc_auc, y_pred


def print_results(cm, report, roc_auc, y_true, y_pred):
    """Print a structured, honest results summary."""
    print("=" * 60)
    print("  SENTINELAI — ISOLATION FOREST EVALUATION RESULTS")
    print("=" * 60)

    tn, fp, fn, tp = cm.ravel()
    print(f"\nConfusion Matrix (rows=actual, cols=predicted):")
    print(f"              Predicted Normal  Predicted Anomaly")
    print(f"  Actual Normal      {tn:>6}            {fp:>6}")
    print(f"  Actual Anomaly     {fn:>6}            {tp:>6}")

    anomaly = report.get("anomaly", {})
    precision = anomaly.get("precision", 0.0)
    recall = anomaly.get("recall", 0.0)
    f1 = anomaly.get("f1-score", 0.0)
    support = anomaly.get("support", 0)

    print(f"\nAnomaly Class Metrics  (support = {int(support)}):")
    print(f"  Precision : {precision:.4f}  ({precision*100:.1f}% of flagged txns are real anomalies)")
    print(f"  Recall    : {recall:.4f}  ({recall*100:.1f}% of true anomalies are caught)")
    print(f"  F1-Score  : {f1:.4f}")
    print(f"  ROC AUC   : {roc_auc:.4f}")

    print(f"\nFull Classification Report:")
    print(classification_report(y_true, y_pred, target_names=["normal", "anomaly"], zero_division=0))

    print("\n" + "=" * 60)
    print("  EVALUATION NOTES")
    print("=" * 60)
    print(f"""
  - Dataset : synthetic with injected anomalies (not real transactions)
  - Model   : IsolationForest (unsupervised — labels NOT used in training)
  - Class imbalance: ~5% positive rate — accuracy is misleading
  - F1 score of {f1:.2f} means the model captures {f1*100:.0f}% of known anomaly patterns
  - This does not guarantee performance on real transaction data
  - ROC AUC of {roc_auc:.4f} measures ranking quality across thresholds
  - False positives (FP={fp}) will generate unnecessary alerts
  - False negatives (FN={fn}) are missed anomalies — the more costly error
""")


def save_results(cm, report, roc_auc, y_true, y_pred, path: Path):
    """Persist metrics to JSON."""
    tn, fp, fn, tp = cm.ravel()
    output = {
        "dataset": "synthetic/transactions_labeled.csv",
        "model": "IsolationForest(contamination=0.05, random_state=42)",
        "total_samples": int(len(y_true)),
        "positive_samples": int(y_true.sum()),
        "positive_rate_pct": round(float(y_true.mean() * 100), 4),
        "confusion_matrix": {
            "TN": int(tn), "FP": int(fp),
            "FN": int(fn), "TP": int(tp),
        },
        "anomaly_class_metrics": {
            "precision": round(float(report["anomaly"]["precision"]), 4),
            "recall":    round(float(report["anomaly"]["recall"]), 4),
            "f1_score":  round(float(report["anomaly"]["f1-score"]), 4),
            "support":   int(report["anomaly"]["support"]),
        },
        "roc_auc": round(float(roc_auc), 4),
        "caveats": [
            "Evaluation on synthetic data only",
            "Model is unsupervised — labels not used in training",
            "Class imbalance (~5%) makes accuracy misleading",
            "Synthetic performance does not predict real-world performance",
        ],
    }
    path.write_text(json.dumps(output, indent=2))
    print(f"Results saved -> {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not LABELED_CSV.exists():
        raise FileNotFoundError(
            f"Labeled dataset not found at {LABELED_CSV}.\n"
            "Run: python data/synthetic/generate_transactions.py first."
        )

    X, y_true = load_and_prepare(LABELED_CSV)
    pipeline = build_pipeline()

    print("Fitting IsolationForest pipeline (unsupervised)...")
    cm, report, roc_auc, y_pred = evaluate(X, y_true, pipeline)

    print_results(cm, report, roc_auc, y_true, y_pred)
    save_results(cm, report, roc_auc, y_true, y_pred, RESULTS_JSON)


if __name__ == "__main__":
    main()
