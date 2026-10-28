"""
Synthetic Transaction Dataset Generator for SentinelAI

Generates a realistic transaction dataset containing:
- Normal transactions (majority class)
- Anomalous transactions (minority class ~5%)
- Data quality issues (missing values, duplicates, invalid values)

Uses random_state=42 for reproducibility.
IMPORTANT: The 'is_anomaly_label' column is for OFFLINE EVALUATION ONLY.
Do NOT include it as a model input feature.
"""

import numpy as np
import pandas as pd
from pathlib import Path

RNG = np.random.default_rng(42)
TOTAL_ROWS = 2000
N_ANOMALIES = 100
N_NORMAL = TOTAL_ROWS - N_ANOMALIES

MERCHANT_CATEGORIES = ["retail", "grocery", "travel", "dining", "electronics", "healthcare"]
MERCHANT_COUNTRIES = ["US", "UK", "CA", "DE", "FR", "AU"]

OUTPUT_DIR = Path(__file__).parent
LABELED_CSV = OUTPUT_DIR / "transactions_labeled.csv"
CLEAN_CSV = OUTPUT_DIR / "transactions.csv"


def make_dates(n: int, seed_offset: int = 0) -> list[str]:
    """Return n random dates in 2023 as YYYY-MM-DD strings."""
    base = pd.Timestamp("2023-01-01")
    rng_local = np.random.default_rng(42 + seed_offset)
    days = rng_local.integers(0, 365, size=n)
    return [(base + pd.Timedelta(days=int(d))).strftime("%Y-%m-%d") for d in days]


def make_emails(n: int, cust_ids: list[str]) -> list[str]:
    """Generate plausible email addresses from customer IDs."""
    domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "company.org"]
    rng_local = np.random.default_rng(99)
    dom = rng_local.choice(domains, size=n)
    return [f"{cid.lower()}@{d}" for cid, d in zip(cust_ids, dom)]


def generate_normal_rows(n: int) -> pd.DataFrame:
    """Generate n normal transaction rows."""
    rng_local = np.random.default_rng(42)

    customer_ids = [f"CUST_{rng_local.integers(1, 501):04d}" for _ in range(n)]
    dates = make_dates(n, seed_offset=0)
    hours = rng_local.integers(6, 23, size=n)  # Normal hours: 6am–11pm
    amounts = np.exp(rng_local.normal(loc=4.5, scale=1.0, size=n))  # Lognormal
    weekdays = [pd.Timestamp(d).day_of_week >= 5 for d in dates]

    df = pd.DataFrame({
        "transaction_id": [f"TXN_{i:06d}" for i in range(n)],
        "customer_id": customer_ids,
        "amount": amounts.round(2),
        "merchant_category": rng_local.choice(MERCHANT_CATEGORIES, size=n),
        "transaction_date": dates,
        "hour_of_day": hours,
        "customer_age": rng_local.integers(18, 81, size=n),
        "account_tenure_days": rng_local.integers(30, 3651, size=n),
        "is_weekend": weekdays,
        "num_transactions_today": rng_local.integers(1, 11, size=n),  # 1–10 for normal
        "merchant_country": rng_local.choice(MERCHANT_COUNTRIES, size=n),
        "email": make_emails(n, customer_ids),
        "is_anomaly_label": False,
    })
    return df


def generate_anomaly_rows(start_idx: int) -> pd.DataFrame:
    """Generate anomaly rows with four distinct anomaly patterns."""
    rng_local = np.random.default_rng(123)
    all_rows = []
    idx = start_idx

    # --- Type 1: Extreme amount (40 rows) ---
    n1 = 40
    customer_ids1 = [f"CUST_{rng_local.integers(1, 501):04d}" for _ in range(n1)]
    dates1 = make_dates(n1, seed_offset=10)
    hours1 = rng_local.integers(6, 23, size=n1)
    amounts1 = np.exp(rng_local.normal(loc=8.5, scale=0.5, size=n1)).round(2)
    for i in range(n1):
        all_rows.append({
            "transaction_id": f"TXN_{idx:06d}",
            "customer_id": customer_ids1[i],
            "amount": amounts1[i],
            "merchant_category": rng_local.choice(MERCHANT_CATEGORIES),
            "transaction_date": dates1[i],
            "hour_of_day": int(hours1[i]),
            "customer_age": int(rng_local.integers(18, 81)),
            "account_tenure_days": int(rng_local.integers(30, 3651)),
            "is_weekend": pd.Timestamp(dates1[i]).day_of_week >= 5,
            "num_transactions_today": int(rng_local.integers(1, 11)),
            "merchant_country": rng_local.choice(MERCHANT_COUNTRIES),
            "email": f"{customer_ids1[i].lower()}@gmail.com",
            "is_anomaly_label": True,
        })
        idx += 1

    # --- Type 2: Unusual hour + high amount (20 rows) ---
    n2 = 20
    customer_ids2 = [f"CUST_{rng_local.integers(1, 501):04d}" for _ in range(n2)]
    dates2 = make_dates(n2, seed_offset=20)
    unusual_hours = rng_local.integers(1, 5, size=n2)   # Hours 1–4 AM
    amounts2 = rng_local.uniform(5000, 15000, size=n2).round(2)
    for i in range(n2):
        all_rows.append({
            "transaction_id": f"TXN_{idx:06d}",
            "customer_id": customer_ids2[i],
            "amount": amounts2[i],
            "merchant_category": rng_local.choice(MERCHANT_CATEGORIES),
            "transaction_date": dates2[i],
            "hour_of_day": int(unusual_hours[i]),
            "customer_age": int(rng_local.integers(18, 81)),
            "account_tenure_days": int(rng_local.integers(30, 3651)),
            "is_weekend": pd.Timestamp(dates2[i]).day_of_week >= 5,
            "num_transactions_today": int(rng_local.integers(1, 11)),
            "merchant_country": rng_local.choice(MERCHANT_COUNTRIES),
            "email": f"{customer_ids2[i].lower()}@yahoo.com",
            "is_anomaly_label": True,
        })
        idx += 1

    # --- Type 3: Velocity anomaly (20 rows) ---
    n3 = 20
    customer_ids3 = [f"CUST_{rng_local.integers(1, 501):04d}" for _ in range(n3)]
    dates3 = make_dates(n3, seed_offset=30)
    high_velocity = rng_local.integers(16, 21, size=n3)   # >15 transactions today
    amounts3 = rng_local.uniform(1000, 5000, size=n3).round(2)
    for i in range(n3):
        all_rows.append({
            "transaction_id": f"TXN_{idx:06d}",
            "customer_id": customer_ids3[i],
            "amount": amounts3[i],
            "merchant_category": rng_local.choice(MERCHANT_CATEGORIES),
            "transaction_date": dates3[i],
            "hour_of_day": int(rng_local.integers(6, 23)),
            "customer_age": int(rng_local.integers(18, 81)),
            "account_tenure_days": int(rng_local.integers(30, 3651)),
            "is_weekend": pd.Timestamp(dates3[i]).day_of_week >= 5,
            "num_transactions_today": int(high_velocity[i]),
            "merchant_country": rng_local.choice(MERCHANT_COUNTRIES),
            "email": f"{customer_ids3[i].lower()}@outlook.com",
            "is_anomaly_label": True,
        })
        idx += 1

    # --- Type 4: Age inconsistency (20 rows) ---
    n4 = 20
    customer_ids4 = [f"CUST_{rng_local.integers(1, 501):04d}" for _ in range(n4)]
    dates4 = make_dates(n4, seed_offset=40)
    # Half under 18, half over 100
    invalid_ages = list(rng_local.integers(5, 18, size=n4 // 2)) + \
                   list(rng_local.integers(101, 121, size=n4 // 2))
    amounts4 = np.exp(rng_local.normal(loc=4.5, scale=1.0, size=n4)).round(2)
    for i in range(n4):
        all_rows.append({
            "transaction_id": f"TXN_{idx:06d}",
            "customer_id": customer_ids4[i],
            "amount": amounts4[i],
            "merchant_category": rng_local.choice(MERCHANT_CATEGORIES),
            "transaction_date": dates4[i],
            "hour_of_day": int(rng_local.integers(6, 23)),
            "customer_age": int(invalid_ages[i]),
            "account_tenure_days": int(rng_local.integers(30, 3651)),
            "is_weekend": pd.Timestamp(dates4[i]).day_of_week >= 5,
            "num_transactions_today": int(rng_local.integers(1, 11)),
            "merchant_country": rng_local.choice(MERCHANT_COUNTRIES),
            "email": f"{customer_ids4[i].lower()}@hotmail.com",
            "is_anomaly_label": True,
        })
        idx += 1

    return pd.DataFrame(all_rows)


def inject_data_quality_issues(df: pd.DataFrame) -> pd.DataFrame:
    """Inject realistic data quality issues (separate from anomaly labels)."""
    rng_local = np.random.default_rng(77)
    n = len(df)

    # 5% of amount → NaN
    amount_nan_idx = rng_local.choice(n, size=int(n * 0.05), replace=False)
    df.loc[amount_nan_idx, "amount"] = np.nan

    # 3% of customer_age → NaN
    age_nan_idx = rng_local.choice(n, size=int(n * 0.03), replace=False)
    df.loc[age_nan_idx, "customer_age"] = np.nan

    # 2% of email → malformed
    email_bad_idx = rng_local.choice(n, size=int(n * 0.02), replace=False)
    bad_emails = rng_local.choice(["not-an-email", "invalid@"], size=len(email_bad_idx))
    df.loc[email_bad_idx, "email"] = bad_emails

    # 10 exact duplicate rows (append copies of random rows)
    dup_idx = rng_local.choice(n, size=10, replace=False)
    duplicates = df.iloc[dup_idx].copy()
    df = pd.concat([df, duplicates], ignore_index=True)

    # 5 rows with invalid merchant_category
    cat_bad_idx = rng_local.choice(len(df), size=5, replace=False)
    df.loc[cat_bad_idx, "merchant_category"] = "UNKNOWN"

    # 3 rows with invalid negative amount
    neg_idx = rng_local.choice(len(df), size=3, replace=False)
    df.loc[neg_idx, "amount"] = -999.99

    return df


def main():
    print("Generating synthetic transaction dataset...")

    # Build base dataframes
    normal_df = generate_normal_rows(N_NORMAL)
    anomaly_df = generate_anomaly_rows(start_idx=N_NORMAL)

    df = pd.concat([normal_df, anomaly_df], ignore_index=True)

    # Shuffle rows
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    # Re-assign sequential transaction IDs after shuffle
    df["transaction_id"] = [f"TXN_{i:06d}" for i in range(len(df))]

    # Inject data quality issues
    df = inject_data_quality_issues(df)

    # --- Save labeled CSV (with is_anomaly_label) ---
    df.to_csv(LABELED_CSV, index=False)

    # --- Save clean CSV (without is_anomaly_label) ---
    clean_df = df.drop(columns=["is_anomaly_label"])
    clean_df.to_csv(CLEAN_CSV, index=False)

    # --- Print summary ---
    total = len(df)
    n_anomalies = df["is_anomaly_label"].sum()
    missing_amount = df["amount"].isna().sum()
    # Count exact duplicates (excluding the label col)
    dup_count = df.duplicated(keep=False).sum()

    print(f"\nGenerated {total} rows")
    print(f"Anomaly rows: {int(n_anomalies)} ({n_anomalies / total * 100:.2f}%)")
    print(f"Missing amount values: {int(missing_amount)} ({missing_amount / total * 100:.2f}%)")
    print(f"Duplicate rows (both copies): {dup_count}")
    print(f"\nSaved labeled dataset -> {LABELED_CSV}")
    print(f"Saved clean dataset   -> {CLEAN_CSV}")


if __name__ == "__main__":
    main()
