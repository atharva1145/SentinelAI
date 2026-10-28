# SentinelAI — Synthetic Transaction Dataset

> [!NOTE]
> This dataset is **synthetic** and generated for development, testing, and offline evaluation purposes only. It does **not** represent real financial transactions.

---

## Overview

| Property | Value |
|---|---|
| Total rows | ~2,010 (2,000 base + 10 injected duplicates) |
| Anomaly rows | 100 (~5%) |
| Normal rows | ~1,910 (~95%) |
| Generator script | [`generate_transactions.py`](./generate_transactions.py) |
| Random seed | `42` (fully reproducible) |

---

## Files

| File | Description |
|---|---|
| `transactions_labeled.csv` | Full dataset **with** `is_anomaly_label` column — for offline evaluation only |
| `transactions.csv` | Clean dataset **without** labels — simulates production input |
| `generate_transactions.py` | Reproducible generation script |
| `evaluation_results.json` | Output of the ML evaluation script |

---

## Column Descriptions

| Column | Type | Description |
|---|---|---|
| `transaction_id` | string | Unique ID: `TXN_XXXXXX` |
| `customer_id` | string | Customer reference: `CUST_XXXX` (1–500) |
| `amount` | float | Transaction amount in USD. May be `NaN` (5% missing) or `-999.99` (invalid) |
| `merchant_category` | string | One of: `retail`, `grocery`, `travel`, `dining`, `electronics`, `healthcare`, or `UNKNOWN` (invalid) |
| `transaction_date` | string | Date in `YYYY-MM-DD` format (2023) |
| `hour_of_day` | int | Hour the transaction occurred (0–23) |
| `customer_age` | int | Customer age in years. May be `NaN` (3% missing) or outside 18–80 (anomaly) |
| `account_tenure_days` | int | Days since account opened (30–3,650) |
| `is_weekend` | bool | Whether the transaction occurred on a weekend |
| `num_transactions_today` | int | Number of transactions the customer made on this date |
| `merchant_country` | string | One of: `US`, `UK`, `CA`, `DE`, `FR`, `AU` |
| `email` | string | Customer email. May be malformed (`not-an-email`, `invalid@`) |
| `is_anomaly_label` | bool | **Ground truth label — FOR EVALUATION ONLY. Do NOT use as a model input feature.** |

---

## Anomaly Injection Logic

Four distinct anomaly patterns were injected, each with a clear real-world analog:

### Type 1 — Extreme Amount (40 rows)
- **Pattern**: Transactions with amounts drawn from `Lognormal(μ=8.5, σ=0.5)` ≈ $4,900–$20,000+
- **Real-world analog**: Large unauthorized transfers, account takeover

### Type 2 — Unusual Hour + High Amount (20 rows)
- **Pattern**: `hour_of_day ∈ {1, 2, 3, 4}` AND `amount > $5,000`
- **Real-world analog**: Late-night high-value transactions inconsistent with customer behavior

### Type 3 — Velocity Anomaly (20 rows)
- **Pattern**: `num_transactions_today > 15` AND `amount > $1,000`
- **Real-world analog**: Card testing, rapid repeated purchases

### Type 4 — Age Inconsistency (20 rows)
- **Pattern**: `customer_age < 18` OR `customer_age > 100`
- **Real-world analog**: Data entry errors, synthetic identity fraud

---

## Injected Data Quality Issues

These issues are **independent** of anomaly labels — they simulate real-world data quality problems:

| Issue | Quantity | Description |
|---|---|---|
| Missing `amount` | ~5% of rows | Simulates failed amount capture |
| Missing `customer_age` | ~3% of rows | Simulates missing KYC data |
| Malformed `email` | ~2% of rows | `"not-an-email"` or `"invalid@"` |
| Exact duplicate rows | 10 rows | Simulates ETL de-duplication failures |
| Invalid `merchant_category` | 5 rows | `"UNKNOWN"` — not in allowed enum |
| Invalid negative `amount` | 3 rows | `-999.99` — sentinel for system errors |

---

## How to Regenerate the Dataset

```powershell
# From the project root
python data/synthetic/generate_transactions.py
```

Expected output:
```
Generated 2010 rows
Anomaly rows: 100 (4.98%)
Missing amount values: 100 (4.97%)
Duplicate rows (both copies): 20
```

> [!IMPORTANT]
> The generator uses `random_state=42` throughout. Do **not** change seeds between runs if you need reproducible evaluation benchmarks.

---

## Evaluation Methodology

The evaluation script (`scripts/evaluate_ml.py`) runs an **IsolationForest** pipeline against this dataset:

```
SimpleImputer(strategy="median")
  → StandardScaler()
    → IsolationForest(contamination=0.05, random_state=42)
```

### Steps
1. Load `transactions_labeled.csv`
2. Extract `y_true = df['is_anomaly_label']`
3. Drop non-feature columns: `transaction_id`, `email`, `transaction_date`, `is_anomaly_label`
4. One-hot encode `merchant_category` and `merchant_country`
5. Fit the pipeline **without labels** (unsupervised)
6. Compute predictions, confusion matrix, classification report, and ROC AUC

### Key Metrics to Focus On

> [!WARNING]
> **Do not use accuracy as a primary metric.** With ~5% positive rate, a model that flags nothing achieves 95% accuracy — that is useless.

| Metric | Why It Matters |
|---|---|
| **Recall (anomaly)** | What fraction of true anomalies are caught? Missed anomalies are the costly error. |
| **Precision (anomaly)** | What fraction of flagged transactions are real anomalies? Low precision = alert fatigue. |
| **F1-Score** | Harmonic mean of precision and recall — the single best summary metric for imbalanced classes. |
| **ROC AUC** | Ranking quality across all possible thresholds. Threshold-independent. |

---

## Why Synthetic Performance ≠ Real-World Performance

> [!CAUTION]
> Strong metrics on this synthetic dataset should **not** be interpreted as evidence that SentinelAI will perform equally well on real transaction data.

1. **Anomaly patterns are explicit and simple** — In production, anomalies are far more subtle and diverse.
2. **No concept drift** — Real transaction distributions shift over time; this dataset is static.
3. **No adversarial behavior** — Fraudsters actively adapt to evade detection.
4. **Synthetic normals are too clean** — Real normal transactions contain noise that blurs the decision boundary.
5. **IsolationForest is unsupervised** — It finds statistical outliers, which may not correlate with fraud labels in production.
6. **No temporal structure** — Production systems must handle time-based dependencies.

---

## Running the Evaluation

```powershell
python scripts/evaluate_ml.py
```

Results are saved to `data/synthetic/evaluation_results.json`.
