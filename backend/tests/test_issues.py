"""Tests for the issues API endpoints."""
from __future__ import annotations

import io
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.models.issue import Issue
from app.models.audit import AuditEvent


def _seed_issue(db: Session, dataset_id: int = 1) -> Issue:
    """Helper: insert a Dataset + Issue row directly into the test DB."""
    ds = Dataset(
        filename="seed.csv",
        original_filename="seed.csv",
        file_path="/tmp/seed.csv",
        file_size=100,
        status="profiled",
        uploaded_at=datetime.utcnow(),
    )
    db.add(ds)
    db.flush()

    issue = Issue(
        dataset_id=ds.id,
        row_index=0,
        column_name="name",
        detector="rule_based",
        rule_name="MissingValueCheck",
        actual_value=None,
        expected_condition="Non-null value",
        severity="medium",
        status="open",
        explanation="Column 'name' is missing.",
        suggested_action="Fill in missing values.",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(issue)
    db.flush()
    return issue


class TestIssuesAPI:
    def test_get_issue_returns_200(self, client, db):
        issue = _seed_issue(db)
        resp = client.get(f"/api/issues/{issue.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == issue.id
        assert data["severity"] == "medium"

    def test_get_nonexistent_issue_returns_404(self, client):
        resp = client.get("/api/issues/999999")
        assert resp.status_code == 404

    def test_patch_issue_updates_status(self, client, db):
        issue = _seed_issue(db)
        resp = client.patch(
            f"/api/issues/{issue.id}",
            json={"status": "investigating"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "investigating"

    def test_patch_issue_invalid_status_rejected(self, client, db):
        issue = _seed_issue(db)
        resp = client.patch(
            f"/api/issues/{issue.id}",
            json={"status": "invalid_status"},
        )
        assert resp.status_code == 422

    def test_patch_with_note_creates_investigation_note(self, client, db):
        issue = _seed_issue(db)
        resp = client.patch(
            f"/api/issues/{issue.id}",
            json={"note": "Investigating this further."},
        )
        assert resp.status_code == 200, resp.text
        # Verify via notes endpoint
        notes_resp = client.get(f"/api/issues/{issue.id}/notes")
        assert notes_resp.status_code == 200
        notes = notes_resp.json()
        assert len(notes) >= 1
        assert any("Investigating this further." in n["content"] for n in notes)

    def test_status_change_creates_audit_event(self, client, db):
        issue = _seed_issue(db)
        client.patch(
            f"/api/issues/{issue.id}",
            json={"status": "resolved"},
        )
        audit_resp = client.get(f"/api/issues/{issue.id}/audit")
        assert audit_resp.status_code == 200
        events = audit_resp.json()
        status_events = [e for e in events if e["action"] == "status_changed"]
        assert len(status_events) >= 1
        assert status_events[0]["new_value"] == "resolved"
        assert status_events[0]["old_value"] == "open"

    def test_get_notes_empty_list(self, client, db):
        issue = _seed_issue(db)
        resp = client.get(f"/api/issues/{issue.id}/notes")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_audit_returns_list(self, client, db):
        issue = _seed_issue(db)
        resp = client.get(f"/api/issues/{issue.id}/audit")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_patch_both_status_and_note(self, client, db):
        issue = _seed_issue(db)
        resp = client.patch(
            f"/api/issues/{issue.id}",
            json={"status": "ignored", "note": "Not a real issue."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ignored"
        # Two audit events: status_changed + note_added
        audit_resp = client.get(f"/api/issues/{issue.id}/audit")
        events = audit_resp.json()
        actions = {e["action"] for e in events}
        assert "status_changed" in actions
        assert "note_added" in actions
