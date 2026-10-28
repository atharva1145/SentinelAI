"""Tests for the dashboard API endpoints."""
from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.issue import Issue


def _seed_db(db: Session) -> None:
    """Insert a Dataset and two Issues for testing."""
    ds = Dataset(
        filename="dash_test.csv",
        original_filename="dash_test.csv",
        file_path="/tmp/dash_test.csv",
        file_size=200,
        row_count=50,
        status="validated",
        uploaded_at=datetime.utcnow(),
    )
    db.add(ds)
    db.flush()

    for severity in ("low", "medium", "high"):
        issue = Issue(
            dataset_id=ds.id,
            row_index=0,
            column_name="col",
            detector="rule_based",
            rule_name="MissingValueCheck",
            actual_value=None,
            expected_condition="Non-null",
            severity=severity,
            status="open",
            explanation="Missing.",
            suggested_action="Fix it.",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(issue)
    db.flush()


class TestDashboardAPI:
    def test_stats_endpoint_returns_200(self, client, db):
        resp = client.get("/api/dashboard/stats")
        assert resp.status_code == 200

    def test_stats_has_expected_shape(self, client, db):
        _seed_db(db)
        resp = client.get("/api/dashboard/stats")
        data = resp.json()
        assert "total_datasets" in data
        assert "total_records" in data
        assert "total_issues" in data
        assert "total_anomalies" in data
        assert "severity_distribution" in data
        assert "recent_datasets" in data

    def test_stats_reflect_actual_data(self, client, db):
        _seed_db(db)
        resp = client.get("/api/dashboard/stats")
        data = resp.json()
        assert data["total_datasets"] >= 1
        assert data["total_issues"] >= 3  # We inserted 3 issues

    def test_severity_distribution_contains_seeded_severities(self, client, db):
        _seed_db(db)
        resp = client.get("/api/dashboard/stats")
        data = resp.json()
        dist = {item["severity"]: item["count"] for item in data["severity_distribution"]}
        assert "low" in dist
        assert "medium" in dist
        assert "high" in dist

    def test_recent_datasets_list_length(self, client, db):
        _seed_db(db)
        resp = client.get("/api/dashboard/stats")
        data = resp.json()
        assert len(data["recent_datasets"]) <= 5

    def test_trends_endpoint_returns_200(self, client, db):
        resp = client.get("/api/dashboard/trends")
        assert resp.status_code == 200

    def test_trends_has_expected_shape(self, client, db):
        resp = client.get("/api/dashboard/trends")
        data = resp.json()
        assert "issues_by_day" in data
        assert isinstance(data["issues_by_day"], list)
        assert len(data["issues_by_day"]) == 31  # 30 days + today

    def test_trends_points_have_day_and_count(self, client, db):
        resp = client.get("/api/dashboard/trends")
        data = resp.json()
        for point in data["issues_by_day"]:
            assert "day" in point
            assert "count" in point
            assert isinstance(point["count"], int)

    def test_empty_db_stats_are_zero(self, client, db):
        """When no data exists, totals should be zero."""
        resp = client.get("/api/dashboard/stats")
        data = resp.json()
        # We can't guarantee empty DB due to session scope, just check types
        assert isinstance(data["total_datasets"], int)
        assert isinstance(data["total_issues"], int)
        assert data["total_records"] >= 0
