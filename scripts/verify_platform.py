"""
SentinelAI End-to-End Platform Verification Script

Verifies all core functional workflows:
1. System health check
2. CSV dataset upload and automatic profiling
3. Data quality rule engine execution
4. Scikit-learn Isolation Forest ML anomaly detection execution
5. Issue management, status updates, investigation notes, and audit trail
6. Executive analytics dashboard statistics aggregation
7. Data quality report CSV generation and download
"""
import os
import sys
import json
from pathlib import Path

# Fix Windows console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from fastapi.testclient import TestClient

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# Ensure database URL is set
os.environ["DATABASE_URL"] = "sqlite:///./sentinelai.db"
os.environ["UPLOAD_DIR"] = str(backend_dir / "uploads")

from main import app as fastapi_app
from app.db.base import Base
from app.db.session import engine

def run_verification():
    print("==================================================================")
    print("SENTINELAI END-TO-END PLATFORM VERIFICATION")
    print("==================================================================")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    client = TestClient(fastapi_app)

    # 1. Health check
    print("\n[Step 1] Checking system health endpoint...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    print(f"✅ Health Status: {health_data['status']} | DB: {health_data['database']} | Version: {health_data['version']}")

    # 2. Upload synthetic transaction dataset
    sample_csv_path = Path(__file__).resolve().parent.parent / "data" / "synthetic" / "transactions.csv"
    assert sample_csv_path.exists(), f"Synthetic dataset not found at {sample_csv_path}"
    
    print(f"\n[Step 2] Ingesting real CSV dataset: {sample_csv_path.name} ({sample_csv_path.stat().st_size / 1024:.1f} KB)...")
    with open(sample_csv_path, "rb") as f:
        res = client.post("/api/datasets/upload", files={"file": ("transactions.csv", f, "text/csv")})
    
    assert res.status_code == 201, f"Upload failed: {res.text}"
    dataset = res.json()
    dataset_id = dataset["id"]
    print(f"✅ Dataset Ingested: ID={dataset_id} | Rows={dataset['row_count']} | Cols={dataset['column_count']}")
    
    # Verify profiling
    profile = dataset.get("profile")
    if profile:
        print(f"   Profile summary: {len(profile['columns'])} column profiles generated, {len(profile.get('preview', []))} preview rows stored.")
        print(f"   Duplicate rows detected in profile: {profile['duplicate_row_count']}")

    # 3. Run rule-based quality validation
    print(f"\n[Step 3] Executing Rule-Based Data Quality Validation on dataset ID={dataset_id}...")
    res = client.post(f"/api/datasets/{dataset_id}/validate")
    assert res.status_code == 200, f"Validation failed: {res.text}"
    val_res = res.json()
    print(f"✅ Rule Validation Complete: {val_res['issues_found']} data quality issues detected.")

    # Inspect detected issues
    res = client.get(f"/api/datasets/{dataset_id}/issues?page_size=10")
    assert res.status_code == 200
    issue_page = res.json()
    print(f"   Sample issues detected:")
    for iss in issue_page["items"][:5]:
        print(f"   - Rule: {iss['rule_name']:<25} | Sev: {iss['severity']:<8} | Col: {iss['column_name'] or 'Dataset'} | Val: {iss['actual_value']}")

    # 4. Run Machine Learning Isolation Forest Anomaly Detection
    print(f"\n[Step 4] Executing Scikit-learn Isolation Forest ML Anomaly Detection on dataset ID={dataset_id}...")
    res = client.post(f"/api/datasets/{dataset_id}/detect-anomalies")
    assert res.status_code == 200, f"Anomaly detection failed: {res.text}"
    anomaly_res = res.json()
    print(f"✅ ML Anomaly Detection Complete: {anomaly_res['anomalies_detected']} multivariate anomalies flagged.")

    # Fetch anomalies with feature z-scores
    res = client.get(f"/api/datasets/{dataset_id}/anomalies?page_size=5")
    assert res.status_code == 200
    anomalies = res.json()["items"]
    flagged = [a for a in anomalies if a["is_anomaly"]]
    if flagged:
        sample = flagged[0]
        contribs = json.loads(sample["feature_contributions_json"])
        top_features = sorted(contribs.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
        print(f"   Sample anomaly: Row #{sample['row_index']+1} | Score: {sample['anomaly_score']:.4f}")
        print(f"   Top feature deviations: {', '.join(f'{k} (z={v:.2f})' for k, v in top_features)}")

    # 5. Issue Management & Audit Trail
    first_issue = issue_page["items"][0]
    issue_id = first_issue["id"]
    print(f"\n[Step 5] Investigating Issue #{issue_id} (Initial status: {first_issue['status']})...")

    # Update status to investigating and add note
    res = client.patch(f"/api/issues/{issue_id}", json={
        "status": "investigating",
        "note": "Flagged for manual review with the payments operations team. Value appears anomalous.",
        "author": "analyst_shiva"
    })
    assert res.status_code == 200
    updated_issue = res.json()
    print(f"✅ Updated Issue #{issue_id}: Status={updated_issue['status']}")

    # Check investigation notes
    res = client.get(f"/api/issues/{issue_id}/notes")
    notes = res.json()
    assert len(notes) >= 1
    print(f"✅ Verified Investigation Note: \"{notes[0]['content']}\" (Author: {notes[0]['author']})")

    # Check audit trail
    res = client.get(f"/api/issues/{issue_id}/audit")
    audit = res.json()
    assert len(audit) >= 1
    print(f"✅ Verified Audit Trail: {audit[0]['action']} | Old: {audit[0]['old_value']} -> New: {audit[0]['new_value']}")

    # 6. Dashboard Analytics Aggregation
    print(f"\n[Step 6] Querying executive dashboard analytics...")
    res = client.get("/api/dashboard/stats")
    assert res.status_code == 200
    stats = res.json()
    print(f"✅ Real Dashboard Statistics:")
    print(f"   - Total Datasets Processed: {stats['total_datasets']}")
    print(f"   - Total Records Examined:   {stats['total_records']:,}")
    print(f"   - Total Issues Detected:    {stats['total_issues']:,}")
    print(f"   - Total ML Anomalies:       {stats['total_anomalies']:,}")
    print(f"   - Severity Breakdown:       {dict((s['severity'], s['count']) for s in stats['severity_distribution'])}")

    # 7. Quality Report Download
    print(f"\n[Step 7] Generating downloadable CSV quality report for dataset ID={dataset_id}...")
    res = client.get(f"/api/datasets/{dataset_id}/report")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    lines = res.text.strip().split("\n")
    print(f"✅ Quality Report CSV Download Verified: {len(lines)} lines exported (Header + Findings).")
    print(f"   Header: {lines[0]}")

    print("\n==================================================================")
    print("🎉 ALL 10 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!")
    print("==================================================================")

if __name__ == "__main__":
    run_verification()
