"""Dataset orchestration service — file save, DB record, profiling."""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.dataset import Dataset
from app.services.profiling_service import profile_dataset

logger = logging.getLogger(__name__)

_UNSAFE_CHARS = re.compile(r"[^\w\-.]")


def _safe_filename(original: str) -> str:
    """Return a collision-safe, sanitised filename."""
    stem = os.path.splitext(original)[0]
    stem = _UNSAFE_CHARS.sub("_", stem)[:50]
    return f"{uuid.uuid4().hex}_{stem}.csv"


def _validate_path(file_path: str) -> str:
    """Ensure file_path is inside UPLOAD_DIR (prevent path traversal)."""
    upload_dir = os.path.realpath(settings.UPLOAD_DIR)
    real_path = os.path.realpath(file_path)
    if not real_path.startswith(upload_dir):
        raise ValueError(f"Path traversal attempt detected: {file_path}")
    return real_path


def save_upload(
    file_content: bytes,
    original_filename: str,
    db: Session,
) -> Dataset:
    """Persist the uploaded file and create the Dataset DB record.

    Profiling is run synchronously here and the result is stored in
    ``Dataset.profile_json``.
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = _safe_filename(original_filename)
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    # Security check before writing
    _validate_path(file_path)

    with open(file_path, "wb") as f:
        f.write(file_content)

    file_size = len(file_content)

    # Create initial DB record
    dataset = Dataset(
        filename=filename,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        status="uploaded",
        uploaded_at=datetime.utcnow(),
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Run profiling
    dataset.status = "profiling"
    db.commit()

    try:
        profile: Dict[str, Any] = profile_dataset(file_path)
        dataset.row_count = profile["row_count"]
        dataset.column_count = profile["column_count"]
        dataset.profile_json = json.dumps(profile)
        dataset.status = "profiled"
        dataset.processed_at = datetime.utcnow()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Profiling failed for dataset_id=%d: %s", dataset.id, exc)
        dataset.status = "error"
        dataset.error_message = str(exc)

    db.commit()
    db.refresh(dataset)
    return dataset
