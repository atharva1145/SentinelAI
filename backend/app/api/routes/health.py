"""Health check endpoint."""
import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import SessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
def health_check() -> dict:
    """Return service health, version, and DB connectivity status."""
    db_status = "connected"
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Health check DB error: %s", exc)
        db_status = "error"

    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": db_status,
    }
