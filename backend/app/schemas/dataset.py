"""Dataset Pydantic schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ColumnProfile(BaseModel):
    """Profile statistics for a single column."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    dtype: str
    null_count: int
    null_pct: float
    unique_count: int
    unique_pct: float
    sample_values: List[Any] = Field(default_factory=list)
    # Numeric only
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    std: Optional[float] = None
    median: Optional[float] = None
    q25: Optional[float] = None
    q75: Optional[float] = None
    # String only
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    avg_length: Optional[float] = None
    # Distributions
    histogram: List[Dict[str, Any]] = Field(default_factory=list)
    top_categories: List[Dict[str, Any]] = Field(default_factory=list)


class DatasetProfile(BaseModel):
    """Complete profile of an uploaded dataset."""

    model_config = ConfigDict(from_attributes=True)

    row_count: int
    column_count: int
    duplicate_row_count: int
    memory_usage_bytes: int
    quality_score: Optional[float] = None
    completeness_score: Optional[float] = None
    uniqueness_score: Optional[float] = None
    columns: List[ColumnProfile]
    preview: List[Dict[str, Any]] = Field(default_factory=list)


class DatasetCreate(BaseModel):
    """Internal schema used when creating a dataset record."""

    filename: str
    original_filename: str
    file_path: str
    file_size: int


class DatasetListItem(BaseModel):
    """Lightweight dataset entry for list views."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    original_filename: str
    file_size: int
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    status: str
    uploaded_at: datetime
    processed_at: Optional[datetime] = None


class DatasetRead(DatasetListItem):
    """Full dataset details, including the profile."""

    file_path: str
    error_message: Optional[str] = None
    profile: Optional[DatasetProfile] = None
