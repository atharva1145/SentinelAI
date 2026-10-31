"""Dataset API routes."""
from __future__ import annotations

import json
import logging
import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.exceptions import (
    DatasetNotFoundError,
    EmptyFileError,
    FileTooLargeError,
    InvalidFileTypeError,
    AnomalyDetectionError,
)
from app.models.dataset import Dataset, ProcessingJob
from app.models.issue import Issue, AnomalyResult
from app.models.audit import AuditEvent
from app.schemas.common import PaginatedResponse
from app.schemas.dataset import DatasetRead, DatasetListItem, DatasetProfile
from app.schemas.issue import IssueRead, AnomalyResultRead
from app.services.dataset_service import save_upload
from app.services.validation_service import validate_dataset
from app.services.report_service import (
    generate_report_csv,
    generate_clean_dataset_csv,
    generate_quarantine_dataset_csv,
)
from app.ml.anomaly_detector import detect_anomalies

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dataset_or_404(dataset_id: int, db: Session) -> Dataset:
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise DatasetNotFoundError(dataset_id)
    return dataset


def _build_dataset_read(dataset: Dataset) -> DatasetRead:
    """Deserialise profile_json and attach it to the schema."""
    profile_data = None
    if dataset.profile_json:
        try:
            profile_data = DatasetProfile(**json.loads(dataset.profile_json))
        except Exception:  # noqa: BLE001
            pass

    return DatasetRead(
        id=dataset.id,
        filename=dataset.filename,
        original_filename=dataset.original_filename,
        file_path=dataset.file_path,
        file_size=dataset.file_size,
        row_count=dataset.row_count,
        column_count=dataset.column_count,
        status=dataset.status,
        error_message=dataset.error_message,
        uploaded_at=dataset.uploaded_at,
        processed_at=dataset.processed_at,
        profile=profile_data,
    )


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/datasets/upload", response_model=DatasetRead, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DatasetRead:
    """Accept a CSV upload, persist it, and immediately profile it."""
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise InvalidFileTypeError(file.filename or "unknown")

    content = await file.read()

    # Validate size
    if len(content) == 0:
        raise EmptyFileError()

    if len(content) > settings.max_upload_size_bytes:
        raise FileTooLargeError(settings.MAX_UPLOAD_SIZE_MB)

    logger.info("Uploading file: %s (%d bytes)", file.filename, len(content))

    dataset: Dataset = await run_in_threadpool(
        save_upload, content, file.filename, db
    )
    return _build_dataset_read(dataset)


# ---------------------------------------------------------------------------
# Load Demo Dataset (1-Click)
# ---------------------------------------------------------------------------

@router.post("/datasets/demo", response_model=DatasetRead, status_code=201)
async def load_demo_dataset(db: Session = Depends(get_db)) -> DatasetRead:
    """Load the built-in synthetic transaction demo dataset with 1 click."""
    from pathlib import Path
    from fastapi import HTTPException

    # Search for the synthetic transactions file
    candidate_paths = [
        Path(__file__).resolve().parents[4] / "data" / "synthetic" / "transactions.csv",
        Path("data/synthetic/transactions.csv"),
        Path("../data/synthetic/transactions.csv"),
    ]
    demo_file = None
    for p in candidate_paths:
        if p.exists():
            demo_file = p
            break

    if not demo_file:
        raise HTTPException(status_code=404, detail="Synthetic demo dataset not found on server.")

    with open(demo_file, "rb") as f:
        content = f.read()

    dataset: Dataset = await run_in_threadpool(
        save_upload, content, "demo_transactions.csv", db
    )
    return _build_dataset_read(dataset)


# ---------------------------------------------------------------------------
# List datasets
# ---------------------------------------------------------------------------

@router.get("/datasets", response_model=PaginatedResponse[DatasetListItem])
def list_datasets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedResponse[DatasetListItem]:
    total = db.query(Dataset).count()
    offset = (page - 1) * page_size
    rows = (
        db.query(Dataset)
        .order_by(Dataset.uploaded_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    items = [DatasetListItem.model_validate(d) for d in rows]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


# ---------------------------------------------------------------------------
# Dataset detail
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}", response_model=DatasetRead)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)) -> DatasetRead:
    dataset = _dataset_or_404(dataset_id, db)
    return _build_dataset_read(dataset)


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------

@router.post("/datasets/{dataset_id}/validate")
async def run_validation(
    dataset_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Trigger rule-based validation for a dataset."""
    dataset = _dataset_or_404(dataset_id, db)

    profile_dict = {}
    if dataset.profile_json:
        try:
            profile_dict = json.loads(dataset.profile_json)
        except Exception:
            pass

    job = ProcessingJob(
        dataset_id=dataset_id,
        job_type="validate",
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    dataset.status = "validating"
    db.commit()

    try:
        from app.models.custom_rule import CustomRule
        custom_rules = (
            db.query(CustomRule)
            .filter(
                (CustomRule.dataset_id == dataset_id) | (CustomRule.dataset_id == None),
                CustomRule.is_active == True,
            )
            .all()
        )

        issues = await run_in_threadpool(
            validate_dataset, dataset.file_path, dataset_id, job.id, profile_dict, custom_rules
        )

        for issue in issues:
            db.add(issue)

        db.commit()

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.result_summary_json = json.dumps({"issue_count": len(issues)})
        dataset.status = "validated"
        db.commit()

        logger.info(
            "Validation complete for dataset_id=%d: %d issues", dataset_id, len(issues)
        )
        return {
            "job_id": job.id,
            "status": "completed",
            "issue_count": len(issues),
            "issues_found": len(issues),
            "message": f"Validation complete: {len(issues)} issues found",
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("Validation failed for dataset_id=%d: %s", dataset_id, exc)
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = datetime.utcnow()
        dataset.status = "error"
        dataset.error_message = str(exc)
        db.commit()
        raise


# ---------------------------------------------------------------------------
# Detect anomalies
# ---------------------------------------------------------------------------

@router.post("/datasets/{dataset_id}/detect-anomalies")
async def run_anomaly_detection(
    dataset_id: int,
    algorithm: str = Query(default="isolation_forest"),
    contamination: float = Query(default=0.05, ge=0.01, le=0.50),
    db: Session = Depends(get_db),
) -> dict:
    """Trigger anomaly detection suite (IsolationForest, LOF, OneClassSVM, Ensemble)."""
    dataset = _dataset_or_404(dataset_id, db)

    job = ProcessingJob(
        dataset_id=dataset_id,
        job_type="detect_anomalies",
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    dataset.status = "detecting"
    db.commit()

    try:
        results = await run_in_threadpool(
            detect_anomalies, dataset.file_path, dataset_id, job.id, algorithm, contamination
        )

        anomaly_count = 0
        for r in results:
            ar = AnomalyResult(
                dataset_id=r["dataset_id"],
                job_id=r["job_id"],
                row_index=r["row_index"],
                anomaly_score=r["anomaly_score"],
                is_anomaly=r["is_anomaly"],
                feature_contributions_json=r["feature_contributions_json"],
            )
            db.add(ar)
            if r["is_anomaly"]:
                anomaly_count += 1
                # Also create an Issue for anomalous rows
                issue = Issue(
                    dataset_id=dataset_id,
                    job_id=job.id,
                    row_index=r["row_index"],
                    column_name=None,
                    detector="isolation_forest",
                    rule_name="IsolationForestAnomaly",
                    actual_value=f"score={r['anomaly_score']:.4f}",
                    expected_condition="Anomaly score below contamination threshold (0.05)",
                    severity="high",
                    status="open",
                    explanation=(
                        f"Row {r['row_index']} was flagged as an anomaly by IsolationForest "
                        f"with score {r['anomaly_score']:.4f}. "
                        "Feature z-scores (not SHAP values): "
                        + r["feature_contributions_json"]
                    ),
                    suggested_action=(
                        "Inspect the flagged row against the feature z-scores to identify "
                        "which features deviate most from the norm."
                    ),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(issue)

        db.commit()

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.result_summary_json = json.dumps(
            {"total_rows": len(results), "anomaly_count": anomaly_count}
        )
        dataset.status = "completed"
        db.commit()

        logger.info(
            "Anomaly detection complete for dataset_id=%d: %d/%d anomalies",
            dataset_id,
            anomaly_count,
            len(results),
        )
        return {
            "job_id": job.id,
            "status": "completed",
            "algorithm": algorithm,
            "contamination": contamination,
            "total_rows": len(results),
            "anomaly_count": anomaly_count,
            "anomalies_detected": anomaly_count,
            "message": f"Anomaly detection complete: {anomaly_count} anomalies detected",
        }

    except ValueError as exc:
        logger.warning("Anomaly detection ValueError dataset_id=%d: %s", dataset_id, exc)
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = datetime.utcnow()
        dataset.status = "error"
        dataset.error_message = str(exc)
        db.commit()
        raise AnomalyDetectionError(str(exc))

    except Exception as exc:  # noqa: BLE001
        logger.exception("Anomaly detection failed dataset_id=%d: %s", dataset_id, exc)
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = datetime.utcnow()
        dataset.status = "error"
        dataset.error_message = str(exc)
        db.commit()
        raise


# ---------------------------------------------------------------------------
# Issues for a dataset
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}/issues", response_model=PaginatedResponse[IssueRead])
def list_dataset_issues(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    severity: Optional[str] = Query(default=None),
    column_name: Optional[str] = Query(default=None),
    detector: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> PaginatedResponse[IssueRead]:
    _dataset_or_404(dataset_id, db)

    q = db.query(Issue).filter(Issue.dataset_id == dataset_id)
    if severity:
        q = q.filter(Issue.severity == severity)
    if column_name:
        q = q.filter(Issue.column_name == column_name)
    if detector:
        q = q.filter(Issue.detector == detector)
    if status:
        q = q.filter(Issue.status == status)

    total = q.count()
    offset = (page - 1) * page_size
    rows = q.order_by(Issue.created_at.desc()).offset(offset).limit(page_size).all()

    items = [IssueRead.model_validate(i) for i in rows]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


# ---------------------------------------------------------------------------
# Report download
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}/report")
def download_report(dataset_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    """Return all issues for a dataset as a downloadable CSV file."""
    _dataset_or_404(dataset_id, db)
    csv_content = generate_report_csv(dataset_id, db)

    import io
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="report_{dataset_id}.csv"'},
    )


@router.get("/datasets/{dataset_id}/export-clean")
def download_clean_dataset(dataset_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    """Return only verified clean records, stripping high/critical issues and ML anomalies."""
    dataset = _dataset_or_404(dataset_id, db)
    clean_csv = generate_clean_dataset_csv(dataset_id, dataset.file_path, db)

    import io
    filename = f"clean_{dataset.original_filename}"
    return StreamingResponse(
        io.StringIO(clean_csv),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/datasets/{dataset_id}/export-quarantine")
def download_quarantine_dataset(dataset_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    """Return quarantined records with reason codes for investigation."""
    dataset = _dataset_or_404(dataset_id, db)
    quarantine_csv = generate_quarantine_dataset_csv(dataset_id, dataset.file_path, db)

    import io
    filename = f"quarantine_{dataset.original_filename}"
    return StreamingResponse(
        io.StringIO(quarantine_csv),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Anomaly results for a dataset
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}/anomalies", response_model=PaginatedResponse[AnomalyResultRead])
def list_anomalies(
    dataset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AnomalyResultRead]:
    _dataset_or_404(dataset_id, db)

    q = db.query(AnomalyResult).filter(AnomalyResult.dataset_id == dataset_id)
    total = q.count()
    offset = (page - 1) * page_size
    rows = q.order_by(AnomalyResult.id).offset(offset).limit(page_size).all()

    items = []
    for ar in rows:
        contrib = None
        if ar.feature_contributions_json:
            try:
                contrib = json.loads(ar.feature_contributions_json)
            except Exception:
                pass
        items.append(
            AnomalyResultRead(
                id=ar.id,
                dataset_id=ar.dataset_id,
                job_id=ar.job_id,
                row_index=ar.row_index,
                anomaly_score=ar.anomaly_score,
                is_anomaly=ar.is_anomaly,
                feature_contributions=contrib,
            )
        )

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


# ---------------------------------------------------------------------------
# Data Distribution Drift Detection
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}/drift")
async def get_dataset_drift(
    dataset_id: int,
    baseline_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Evaluate statistical distribution drift using two-sample Kolmogorov-Smirnov tests."""
    from app.services.drift_service import compute_dataset_drift

    current_dataset = _dataset_or_404(dataset_id, db)

    if baseline_id is not None:
        baseline_dataset = _dataset_or_404(baseline_id, db)
    else:
        # Compare against the earliest dataset
        baseline_dataset = (
            db.query(Dataset)
            .filter(Dataset.id != dataset_id)
            .order_by(Dataset.uploaded_at.asc())
            .first()
        )
        if not baseline_dataset:
            baseline_dataset = current_dataset

    report = await run_in_threadpool(
        compute_dataset_drift,
        current_dataset.file_path,
        baseline_dataset.file_path,
    )
    report["dataset_id"] = current_dataset.id
    report["current_dataset_id"] = current_dataset.id
    report["current_filename"] = current_dataset.original_filename
    report["baseline_dataset_id"] = baseline_dataset.id
    report["baseline_filename"] = baseline_dataset.original_filename
    return report


# ---------------------------------------------------------------------------
# Data Quality Health Score
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}/health-score")
def get_dataset_health_score(
    dataset_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Computes composite Data Quality Health Score (0-100) and letter grade."""
    from app.services.health_score_service import calculate_dataset_health_score

    dataset = _dataset_or_404(dataset_id, db)
    return calculate_dataset_health_score(dataset, db)


# ---------------------------------------------------------------------------
# Data Auto-Remediation & Repair Engine
# ---------------------------------------------------------------------------

@router.post("/datasets/{dataset_id}/remediate/preview")
async def preview_dataset_remediation(
    dataset_id: int,
    config: Optional[dict] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Simulates remediation without saving changes and returns a preview diff."""
    import pandas as pd
    from app.services.remediation_service import execute_remediation

    dataset = _dataset_or_404(dataset_id, db)
    cfg = config or {}

    df = await run_in_threadpool(pd.read_csv, dataset.file_path, low_memory=False)
    repaired_df, summary = await run_in_threadpool(execute_remediation, df, cfg)

    # Return summary + sample rows before & after
    sample_before = df.head(5).fillna("").to_dict(orient="records")
    sample_after = repaired_df.head(5).fillna("").to_dict(orient="records")

    return {
        "dataset_id": dataset.id,
        "filename": dataset.original_filename,
        "summary": summary,
        "sample_before": sample_before,
        "sample_after": sample_after,
    }


@router.post("/datasets/{dataset_id}/remediate")
async def apply_dataset_remediation(
    dataset_id: int,
    config: Optional[dict] = None,
    save_as_new_dataset: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> dict:
    """Applies remediation, saves the cleaned dataset, and optionally registers it as a clean version."""
    import os
    import uuid
    import pandas as pd
    from app.services.remediation_service import execute_remediation
    from app.services.profiling_service import profile_dataset

    dataset = _dataset_or_404(dataset_id, db)
    cfg = config or {}

    df = await run_in_threadpool(pd.read_csv, dataset.file_path, low_memory=False)
    repaired_df, summary = await run_in_threadpool(execute_remediation, df, cfg)

    # Generate new repaired file in upload dir
    clean_filename = f"repaired_{uuid.uuid4().hex[:12]}_{dataset.filename}"
    clean_path = os.path.join(settings.UPLOAD_DIR, clean_filename)

    await run_in_threadpool(repaired_df.to_csv, clean_path, index=False)
    clean_size = os.path.getsize(clean_path)

    new_dataset_id = None
    if save_as_new_dataset:
        clean_profile = await run_in_threadpool(profile_dataset, clean_path)
        new_ds = Dataset(
            filename=clean_filename,
            original_filename=f"Cleaned_{dataset.original_filename}",
            file_path=clean_path,
            file_size=clean_size,
            row_count=len(repaired_df),
            column_count=len(repaired_df.columns),
            status="profiled",
            profile_json=json.dumps(clean_profile),
            uploaded_at=datetime.utcnow(),
            processed_at=datetime.utcnow(),
        )
        db.add(new_ds)
        db.commit()
        db.refresh(new_ds)
        new_dataset_id = new_ds.id

    return {
        "success": True,
        "original_dataset_id": dataset.id,
        "new_dataset_id": new_dataset_id,
        "repaired_filename": clean_filename,
        "summary": summary,
        "download_url": f"/api/datasets/{dataset.id}/remediate/download",
    }


@router.get("/datasets/{dataset_id}/remediate/download")
async def download_remediated_dataset(
    dataset_id: int,
    config: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Direct streaming CSV download of the remediated dataset."""
    import io
    import pandas as pd
    from app.services.remediation_service import execute_remediation

    dataset = _dataset_or_404(dataset_id, db)
    cfg = {}
    if config:
        try:
            cfg = json.loads(config)
        except Exception:
            cfg = {}

    df = await run_in_threadpool(pd.read_csv, dataset.file_path, low_memory=False)
    repaired_df, _ = await run_in_threadpool(execute_remediation, df, cfg)

    stream = io.StringIO()
    repaired_df.to_csv(stream, index=False)
    stream.seek(0)

    download_name = f"repaired_{dataset.original_filename}"
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )


# ---------------------------------------------------------------------------
# Executive PDF / Printable Audit Certificate
# ---------------------------------------------------------------------------

@router.get("/datasets/{dataset_id}/audit-certificate")
def get_audit_certificate(
    dataset_id: int,
    db: Session = Depends(get_db),
):
    """Generates an executive, print/PDF-ready HTML Quality Audit Certificate."""
    from fastapi.responses import HTMLResponse
    from app.services.health_score_service import calculate_dataset_health_score
    from app.services.certificate_service import generate_audit_certificate_html

    dataset = _dataset_or_404(dataset_id, db)
    health_data = calculate_dataset_health_score(dataset, db)
    issues = db.query(Issue).filter(Issue.dataset_id == dataset.id).all()
    anomalies = db.query(AnomalyResult).filter(AnomalyResult.dataset_id == dataset.id).all()

    html_content = generate_audit_certificate_html(dataset, health_data, issues, anomalies)
    return HTMLResponse(content=html_content, status_code=200)

