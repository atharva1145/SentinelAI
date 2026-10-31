"""Schemas for Custom Validation Rules."""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class CustomRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    column_name: str = Field(..., min_length=1, max_length=100)
    rule_type: str = Field(..., description="between, in_set, regex, not_null, min_length, max_length")
    parameters_json: str = Field(default="{}")
    severity: str = Field(default="high", description="low, medium, high, critical")
    is_active: bool = True
    dataset_id: Optional[int] = None


class CustomRuleCreate(CustomRuleBase):
    pass


class CustomRuleUpdate(BaseModel):
    name: Optional[str] = None
    parameters_json: Optional[str] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None


class CustomRuleRead(CustomRuleBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
