"""Issue-related Pydantic schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


VALID_STATUSES = Literal["open", "investigating", "resolved", "ignored"]
VALID_SEVERITIES = Literal["low", "medium", "high", "critical"]
VALID_DETECTORS = Literal["rule_based", "isolation_forest"]


class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    author: str = Field(default="analyst", max_length=100)


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    issue_id: int
    author: str
    content: str
    created_at: datetime


class IssueRead(BaseModel):
    """Full issue details."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    job_id: Optional[int] = None
    row_index: Optional[int] = None
    column_name: Optional[str] = None
    detector: str
    rule_name: str
    actual_value: Optional[str] = None
    expected_condition: str
    severity: str
    status: str
    explanation: str
    suggested_action: str
    created_at: datetime
    updated_at: datetime
    notes: List[NoteRead] = Field(default_factory=list)


class IssueUpdate(BaseModel):
    """Payload for PATCH /api/issues/{id}."""

    status: Optional[VALID_STATUSES] = None
    note: Optional[str] = Field(default=None, min_length=1, max_length=5000)


class IssueFilter(BaseModel):
    """Query filters for listing issues."""

    severity: Optional[VALID_SEVERITIES] = None
    column_name: Optional[str] = None
    detector: Optional[VALID_DETECTORS] = None
    status: Optional[VALID_STATUSES] = None


class AnomalyResultRead(BaseModel):
    """ML anomaly result for a single row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    job_id: int
    row_index: int
    anomaly_score: float
    is_anomaly: bool
    feature_contributions: Optional[Dict[str, Any]] = None
