"""Custom validation rules API routes."""
from __future__ import annotations

import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.custom_rule import CustomRule
from app.schemas.custom_rule import CustomRuleCreate, CustomRuleRead, CustomRuleUpdate

router = APIRouter()


@router.get("/custom-rules", response_model=List[CustomRuleRead])
def get_custom_rules(
    dataset_id: Optional[int] = Query(None, description="Optional dataset ID filter"),
    db: Session = Depends(get_db),
) -> List[CustomRule]:
    """Retrieve custom validation rules (dataset-specific and global rules)."""
    query = db.query(CustomRule)
    if dataset_id is not None:
        query = query.filter((CustomRule.dataset_id == dataset_id) | (CustomRule.dataset_id == None))
    return query.order_by(CustomRule.created_at.desc()).all()


@router.post("/custom-rules", response_model=CustomRuleRead, status_code=201)
def create_custom_rule(
    payload: CustomRuleCreate,
    db: Session = Depends(get_db),
) -> CustomRule:
    """Create a new custom validation rule."""
    # Validate rule_type
    allowed_types = {"between", "in_set", "regex", "not_null", "min_length", "max_length"}
    if payload.rule_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule_type '{payload.rule_type}'. Must be one of {allowed_types}.",
        )

    # Validate parameters_json is valid JSON
    try:
        if payload.parameters_json:
            json.loads(payload.parameters_json)
    except Exception:
        raise HTTPException(status_code=400, detail="parameters_json must be a valid JSON string.")

    rule = CustomRule(
        name=payload.name.strip(),
        column_name=payload.column_name.strip(),
        rule_type=payload.rule_type,
        parameters_json=payload.parameters_json or "{}",
        severity=payload.severity.lower(),
        is_active=payload.is_active,
        dataset_id=payload.dataset_id,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/custom-rules/{rule_id}")
def delete_custom_rule(
    rule_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Delete a custom validation rule."""
    rule = db.query(CustomRule).filter(CustomRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Custom rule not found.")
    db.delete(rule)
    db.commit()
    return {"success": True, "deleted_id": rule_id}


@router.patch("/custom-rules/{rule_id}", response_model=CustomRuleRead)
def update_custom_rule(
    rule_id: int,
    payload: CustomRuleUpdate,
    db: Session = Depends(get_db),
) -> CustomRule:
    """Update or toggle an existing custom rule."""
    rule = db.query(CustomRule).filter(CustomRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Custom rule not found.")

    if payload.name is not None:
        rule.name = payload.name.strip()
    if payload.parameters_json is not None:
        rule.parameters_json = payload.parameters_json
    if payload.severity is not None:
        rule.severity = payload.severity.lower()
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    db.commit()
    db.refresh(rule)
    return rule
