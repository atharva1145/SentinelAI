"""Issues API routes."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.exceptions import IssueNotFoundError
from app.models.audit import AuditEvent
from app.models.issue import Issue, InvestigationNote
from app.schemas.issue import IssueRead, IssueUpdate, NoteRead

router = APIRouter()
logger = logging.getLogger(__name__)


def _issue_or_404(issue_id: int, db: Session) -> Issue:
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise IssueNotFoundError(issue_id)
    return issue


@router.get("/issues/{issue_id}", response_model=IssueRead)
def get_issue(issue_id: int, db: Session = Depends(get_db)) -> IssueRead:
    issue = _issue_or_404(issue_id, db)
    return IssueRead.model_validate(issue)


@router.patch("/issues/{issue_id}", response_model=IssueRead)
def update_issue(
    issue_id: int,
    payload: IssueUpdate,
    db: Session = Depends(get_db),
) -> IssueRead:
    """Update issue status and/or add an investigation note."""
    issue = _issue_or_404(issue_id, db)

    if payload.status is not None and payload.status != issue.status:
        old_status = issue.status
        issue.status = payload.status
        issue.updated_at = datetime.utcnow()

        audit = AuditEvent(
            entity_type="issue",
            entity_id=issue_id,
            action="status_changed",
            old_value=old_status,
            new_value=payload.status,
            actor="analyst",
            timestamp=datetime.utcnow(),
        )
        db.add(audit)
        logger.info(
            "Issue %d status changed: %s → %s", issue_id, old_status, payload.status
        )

    if payload.note:
        note = InvestigationNote(
            issue_id=issue_id,
            author="analyst",
            content=payload.note,
            created_at=datetime.utcnow(),
        )
        db.add(note)

        audit = AuditEvent(
            entity_type="issue",
            entity_id=issue_id,
            action="note_added",
            old_value=None,
            new_value=payload.note[:200],  # truncate for audit log
            actor="analyst",
            timestamp=datetime.utcnow(),
        )
        db.add(audit)
        logger.info("Note added to issue %d", issue_id)

    db.commit()
    db.refresh(issue)
    return IssueRead.model_validate(issue)


@router.get("/issues/{issue_id}/notes", response_model=List[NoteRead])
def get_issue_notes(issue_id: int, db: Session = Depends(get_db)) -> List[NoteRead]:
    _issue_or_404(issue_id, db)
    notes = (
        db.query(InvestigationNote)
        .filter(InvestigationNote.issue_id == issue_id)
        .order_by(InvestigationNote.created_at)
        .all()
    )
    return [NoteRead.model_validate(n) for n in notes]


@router.get("/issues/{issue_id}/audit")
def get_issue_audit(issue_id: int, db: Session = Depends(get_db)) -> list:
    _issue_or_404(issue_id, db)
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.entity_type == "issue", AuditEvent.entity_id == issue_id)
        .order_by(AuditEvent.timestamp)
        .all()
    )
    return [
        {
            "id": e.id,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "action": e.action,
            "old_value": e.old_value,
            "new_value": e.new_value,
            "actor": e.actor,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in events
    ]
