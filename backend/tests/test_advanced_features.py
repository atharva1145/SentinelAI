"""
Tests for advanced features:
1. 1-Click Demo Dataset Ingestion (POST /api/datasets/demo)
2. Multi-Model Anomaly Detection Suite (LOF, OneClassSVM, Ensemble)
3. Kolmogorov-Smirnov Statistical Drift Detection (GET /api/datasets/{id}/drift)
4. SHAP Feature Attribution integration
"""
import pytest
from fastapi.testclient import TestClient


class TestAdvancedFeatures:
    def test_demo_dataset_ingestion(self, client: TestClient):
        """Verify 1-click synthetic demo dataset is loaded and profiled."""
        response = client.post("/api/datasets/demo")
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["original_filename"] == "demo_transactions.csv"
        assert data["row_count"] > 0
        assert data["column_count"] > 0
        assert data["status"] == "profiled"
        assert "profile" in data
        assert len(data["profile"]["columns"]) > 0

    def test_multi_model_anomaly_detection_lof(self, client: TestClient):
        """Test Local Outlier Factor detector."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        response = client.post(
            f"/api/datasets/{dataset_id}/detect-anomalies?algorithm=local_outlier_factor&contamination=0.05"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["anomaly_count"] >= 0
        assert data["algorithm"] == "local_outlier_factor"

        # Verify anomalies query endpoint
        anom_resp = client.get(f"/api/datasets/{dataset_id}/anomalies")
        assert anom_resp.status_code == 200
        assert "items" in anom_resp.json()

    def test_multi_model_anomaly_detection_ocsvm(self, client: TestClient):
        """Test One-Class SVM detector."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        response = client.post(
            f"/api/datasets/{dataset_id}/detect-anomalies?algorithm=one_class_svm&contamination=0.05"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["anomaly_count"] >= 0
        assert data["algorithm"] == "one_class_svm"

    def test_multi_model_anomaly_detection_ensemble(self, client: TestClient):
        """Test Ensemble detector."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        response = client.post(
            f"/api/datasets/{dataset_id}/detect-anomalies?algorithm=ensemble&contamination=0.05"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["anomaly_count"] >= 0
        assert data["algorithm"] == "ensemble"

    def test_ks_drift_detection(self, client: TestClient):
        """Test Kolmogorov-Smirnov statistical distribution drift endpoint."""
        demo_resp = client.post("/api/datasets/demo")
        dataset_id = demo_resp.json()["id"]

        response = client.get(f"/api/datasets/{dataset_id}/drift")
        assert response.status_code == 200
        data = response.json()
        assert "dataset_id" in data
        assert data["dataset_id"] == dataset_id
        assert "has_drift" in data
        assert isinstance(data["has_drift"], bool)
        assert "features" in data
        assert len(data["features"]) > 0
        for feat in data["features"]:
            assert "column" in feat
            assert "ks_statistic" in feat
            assert "p_value" in feat
            assert "wasserstein_distance" in feat
            assert "is_drifted" in feat
