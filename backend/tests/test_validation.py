"""Tests for the validation service (unit tests — no HTTP)."""
from __future__ import annotations

import pytest

from app.services.validation_service import validate_dataset


class TestValidationService:
    def test_missing_values_produces_issues(self, tmp_missing_csv_file):
        issues = validate_dataset(tmp_missing_csv_file, dataset_id=1, job_id=1, profile={})
        missing_issues = [i for i in issues if i.rule_name == "MissingValueCheck"]
        assert len(missing_issues) > 0

    def test_missing_severity_levels(self, tmp_missing_csv_file):
        """Missing value issues should have valid severity strings."""
        issues = validate_dataset(tmp_missing_csv_file, dataset_id=1, job_id=1, profile={})
        for issue in issues:
            if issue.rule_name == "MissingValueCheck":
                assert issue.severity in ("low", "medium", "high", "critical")

    def test_duplicate_rows_produces_issues(self, tmp_duplicate_csv_file):
        issues = validate_dataset(tmp_duplicate_csv_file, dataset_id=2, job_id=2, profile={})
        dup_issues = [i for i in issues if i.rule_name == "DuplicateRowCheck"]
        assert len(dup_issues) >= 1

    def test_duplicate_rows_severity_is_high(self, tmp_duplicate_csv_file):
        issues = validate_dataset(tmp_duplicate_csv_file, dataset_id=2, job_id=2, profile={})
        dup_issues = [i for i in issues if i.rule_name == "DuplicateRowCheck"]
        for issue in dup_issues:
            assert issue.severity == "high"

    def test_invalid_emails_detected(self, tmp_email_csv_file):
        issues = validate_dataset(tmp_email_csv_file, dataset_id=3, job_id=3, profile={})
        email_issues = [i for i in issues if i.rule_name == "EmailFormatCheck"]
        assert len(email_issues) >= 2  # "not-an-email" and "also@bad"

    def test_valid_emails_not_flagged(self, tmp_email_csv_file):
        issues = validate_dataset(tmp_email_csv_file, dataset_id=3, job_id=3, profile={})
        flagged_values = {i.actual_value for i in issues if i.rule_name == "EmailFormatCheck"}
        # These are valid and should NOT be flagged
        assert "valid@example.com" not in flagged_values
        assert "good@domain.co" not in flagged_values

    def test_negative_amounts_detected(self, tmp_negative_csv_file):
        issues = validate_dataset(tmp_negative_csv_file, dataset_id=4, job_id=4, profile={})
        neg_issues = [i for i in issues if i.rule_name == "NegativeValueCheck"]
        assert len(neg_issues) >= 2

    def test_negative_issues_have_high_severity(self, tmp_negative_csv_file):
        issues = validate_dataset(tmp_negative_csv_file, dataset_id=4, job_id=4, profile={})
        for issue in issues:
            if issue.rule_name == "NegativeValueCheck":
                assert issue.severity == "high"

    def test_all_issues_have_required_fields(self, tmp_missing_csv_file):
        issues = validate_dataset(tmp_missing_csv_file, dataset_id=5, job_id=5, profile={})
        for issue in issues:
            assert issue.dataset_id == 5
            assert issue.job_id == 5
            assert issue.detector == "rule_based"
            assert issue.rule_name
            assert issue.expected_condition
            assert issue.severity in ("low", "medium", "high", "critical")
            assert issue.status == "open"
            assert issue.explanation
            assert issue.suggested_action

    def test_clean_dataset_produces_no_issues(self, tmp_csv_file):
        """A clean, well-formed CSV should yield zero or very few issues."""
        issues = validate_dataset(tmp_csv_file, dataset_id=6, job_id=6, profile={})
        # There should be no missing-value, duplicate, or negative-amount issues
        critical_rules = {"MissingValueCheck", "DuplicateRowCheck", "NegativeValueCheck"}
        blocking_issues = [i for i in issues if i.rule_name in critical_rules]
        assert len(blocking_issues) == 0
