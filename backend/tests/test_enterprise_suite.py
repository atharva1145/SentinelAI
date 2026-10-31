"""Tests for Enterprise Suite features:
1. Composite Quality Health Score (GET /api/datasets/{id}/health-score)
2. Autonomous Remediation & Repair Engine (POST /api/datasets/{id}/remediate)
3. No-Code Custom Rule Builder (CRUD /api/custom-rules & validation integration)
4. Executive Printable Audit Certificate (GET /api/datasets/{id}/audit-certificate)
"""
import json
import pytest
from fastapi.testclient import TestClient


class TestEnterpriseSuite:
    def test_health_score_endpoint(self, client: TestClient):
        """Verify Health Score calculation and grading."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        # Validate dataset first so issues are populated
        client.post(f"/api/datasets/{dataset_id}/validate")

        resp = client.get(f"/api/datasets/{dataset_id}/health-score")
        assert resp.status_code == 200
        data = resp.json()

        assert "overall_score" in data
        assert isinstance(data["overall_score"], (int, float))
        assert 0 <= data["overall_score"] <= 100
        assert data["grade"] in ["A", "B", "C", "D", "F"]
        assert "status_label" in data
        assert "dimensions" in data
        assert "completeness" in data["dimensions"]
        assert "validity" in data["dimensions"]
        assert "uniqueness" in data["dimensions"]
        assert "anomaly_free" in data["dimensions"]

    def test_remediation_preview_and_apply(self, client: TestClient):
        """Test Auto-Remediation preview diff and execution."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        config = {
            "deduplicate": True,
            "impute_missing": {"enabled": True, "strategy": "median_mode"},
            "clamp_ranges": True,
            "standardize_dates": True,
            "clean_whitespace": True,
        }

        # 1. Preview
        preview_resp = client.post(f"/api/datasets/{dataset_id}/remediate/preview", json=config)
        assert preview_resp.status_code == 200
        preview = preview_resp.json()
        assert "summary" in preview
        assert "sample_before" in preview
        assert "sample_after" in preview
        assert preview["summary"]["initial_rows"] > 0

        # 2. Apply & Register Clean Dataset
        apply_resp = client.post(f"/api/datasets/{dataset_id}/remediate?save_as_new_dataset=true", json=config)
        assert apply_resp.status_code == 200
        result = apply_resp.json()
        assert result["success"] is True
        assert result["new_dataset_id"] is not None
        assert "repaired_filename" in result
        assert "summary" in result
        assert result["summary"]["final_rows"] > 0

        # 3. Download Clean Stream
        dl_resp = client.get(f"/api/datasets/{dataset_id}/remediate/download")
        assert dl_resp.status_code == 200
        assert dl_resp.headers["content-type"].startswith("text/csv")
        assert len(dl_resp.text) > 0

    def test_custom_rules_crud_and_validation(self, client: TestClient):
        """Test Custom Rule creation, validation execution, and deletion."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        # 1. Create a range rule on 'amount'
        rule_payload = {
            "name": "Max Transaction Bound",
            "column_name": "amount",
            "rule_type": "between",
            "parameters_json": json.dumps({"min": 0, "max": 2000}),
            "severity": "critical",
            "is_active": True,
            "dataset_id": dataset_id,
        }
        create_resp = client.post("/api/custom-rules", json=rule_payload)
        assert create_resp.status_code == 201
        created_rule = create_resp.json()
        rule_id = created_rule["id"]
        assert created_rule["name"] == "Max Transaction Bound"

        # 2. List rules
        list_resp = client.get(f"/api/custom-rules?dataset_id={dataset_id}")
        assert list_resp.status_code == 200
        rules = list_resp.json()
        assert any(r["id"] == rule_id for r in rules)

        # 3. Run validation and verify custom rule issue is recorded
        val_resp = client.post(f"/api/datasets/{dataset_id}/validate")
        assert val_resp.status_code == 200

        issues_resp = client.get(f"/api/datasets/{dataset_id}/issues")
        assert issues_resp.status_code == 200
        issues = issues_resp.json()["items"]
        custom_issues = [i for i in issues if i.get("detector") == "custom_rule"]
        assert len(custom_issues) > 0

        # 4. Delete rule
        del_resp = client.delete(f"/api/custom-rules/{rule_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["success"] is True

    def test_audit_certificate_html(self, client: TestClient):
        """Test Executive Audit Certificate printable HTML generation."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        cert_resp = client.get(f"/api/datasets/{dataset_id}/audit-certificate")
        assert cert_resp.status_code == 200
        assert "text/html" in cert_resp.headers["content-type"]
        html = cert_resp.text
        assert "SentinelAI Platform" in html
        assert "SENTINEL-AUDIT" in html
        assert "Overall Health Score" in html
        assert "Print / Save as PDF" in html
