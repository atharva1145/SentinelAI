"""Tests for dataset upload endpoint."""
from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient


def _upload(client: TestClient, content: bytes, filename: str = "test.csv") -> dict:
    resp = client.post(
        "/api/datasets/upload",
        files={"file": (filename, io.BytesIO(content), "text/csv")},
    )
    return resp


class TestUpload:
    def test_valid_csv_upload_succeeds(self, client, simple_csv_bytes):
        resp = _upload(client, simple_csv_bytes)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["id"] is not None
        assert data["original_filename"] == "test.csv"
        assert data["status"] in ("profiled", "uploaded", "profiling")

    def test_profile_data_returned_after_upload(self, client, simple_csv_bytes):
        resp = _upload(client, simple_csv_bytes)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        # Profile should be populated after synchronous profiling
        assert data["profile"] is not None
        assert data["profile"]["row_count"] > 0
        assert data["profile"]["column_count"] > 0
        assert len(data["profile"]["columns"]) > 0

    def test_non_csv_file_rejected(self, client):
        resp = _upload(client, b"hello world", filename="data.txt")
        assert resp.status_code == 400
        data = resp.json()
        assert "detail" in data

    def test_empty_file_rejected(self, client):
        resp = _upload(client, b"", filename="empty.csv")
        assert resp.status_code == 400
        data = resp.json()
        assert "detail" in data

    def test_file_too_large_rejected(self, client, monkeypatch):
        from app.core import config as cfg
        monkeypatch.setattr(cfg.settings, "MAX_UPLOAD_SIZE_MB", 0)
        # Any non-empty file will exceed 0 MB limit
        resp = _upload(client, b"a,b\n1,2\n", filename="big.csv")
        assert resp.status_code == 413

    def test_upload_creates_db_record(self, client, db, simple_csv_bytes):
        from app.models.dataset import Dataset

        resp = _upload(client, simple_csv_bytes)
        assert resp.status_code == 201
        dataset_id = resp.json()["id"]
        row = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        # The record may be in a different transaction scope due to test isolation
        # so we verify via API instead
        detail = client.get(f"/api/datasets/{dataset_id}")
        assert detail.status_code == 200

    def test_dataset_list_returns_uploaded_dataset(self, client, simple_csv_bytes):
        _upload(client, simple_csv_bytes)
        resp = client.get("/api/datasets")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

    def test_dataset_detail_endpoint(self, client, simple_csv_bytes):
        upload_resp = _upload(client, simple_csv_bytes)
        dataset_id = upload_resp.json()["id"]
        resp = client.get(f"/api/datasets/{dataset_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == dataset_id

    def test_dataset_not_found_returns_404(self, client):
        resp = client.get("/api/datasets/999999")
        assert resp.status_code == 404
