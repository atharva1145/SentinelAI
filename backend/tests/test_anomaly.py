"""Tests for the anomaly detection ML module."""
from __future__ import annotations

import pytest

from app.ml.anomaly_detector import detect_anomalies


class TestAnomalyDetector:
    def test_anomalies_detected_in_injected_outliers(self, tmp_numeric_csv_file):
        results = detect_anomalies(tmp_numeric_csv_file, dataset_id=1, job_id=1)
        assert len(results) > 0
        anomalies = [r for r in results if r["is_anomaly"]]
        assert len(anomalies) > 0, "Expected at least one anomaly in dataset with injected outliers"

    def test_result_fields_present(self, tmp_numeric_csv_file):
        results = detect_anomalies(tmp_numeric_csv_file, dataset_id=1, job_id=1)
        for r in results:
            assert "dataset_id" in r
            assert "job_id" in r
            assert "row_index" in r
            assert "anomaly_score" in r
            assert "is_anomaly" in r
            assert "feature_contributions_json" in r

    def test_dataset_id_and_job_id_propagated(self, tmp_numeric_csv_file):
        results = detect_anomalies(tmp_numeric_csv_file, dataset_id=42, job_id=99)
        for r in results:
            assert r["dataset_id"] == 42
            assert r["job_id"] == 99

    def test_anomaly_score_is_positive_float(self, tmp_numeric_csv_file):
        results = detect_anomalies(tmp_numeric_csv_file, dataset_id=1, job_id=1)
        for r in results:
            assert isinstance(r["anomaly_score"], float)
            assert r["anomaly_score"] >= 0

    def test_feature_contributions_returned_for_anomalies(self, tmp_numeric_csv_file):
        import json
        results = detect_anomalies(tmp_numeric_csv_file, dataset_id=1, job_id=1)
        for r in results:
            if r["is_anomaly"]:
                contribs = json.loads(r["feature_contributions_json"])
                assert isinstance(contribs, dict)
                assert len(contribs) > 0

    def test_insufficient_columns_raises_value_error(self, tmp_small_numeric_csv_file):
        with pytest.raises(ValueError, match="eligible numeric columns"):
            detect_anomalies(tmp_small_numeric_csv_file, dataset_id=1, job_id=1)

    def test_too_few_rows_raises_value_error(self, tmp_path):
        """A CSV with fewer than 10 rows should raise ValueError."""
        p = tmp_path / "tiny.csv"
        p.write_text("a,b\n1,2\n3,4\n5,6\n")
        with pytest.raises(ValueError, match="at least 10"):
            detect_anomalies(str(p), dataset_id=1, job_id=1)

    def test_result_count_matches_row_count(self, tmp_numeric_csv_file):
        import pandas as pd
        df = pd.read_csv(tmp_numeric_csv_file)
        results = detect_anomalies(tmp_numeric_csv_file, dataset_id=1, job_id=1)
        assert len(results) == len(df)
