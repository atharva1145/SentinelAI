"""SentinelAI FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes import health, datasets, issues, dashboard

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info(
        "SentinelAI starting up | env=%s | upload_dir=%s",
        settings.ENVIRONMENT,
        settings.UPLOAD_DIR,
    )
    # Ensure upload directory exists
    import os
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    # Ensure database tables exist
    from app.db.base import Base
    from app.db.session import engine
    import app.models.dataset  # noqa: F401
    import app.models.issue  # noqa: F401
    import app.models.audit  # noqa: F401
    Base.metadata.create_all(bind=engine)
    yield
    logger.info("SentinelAI shutting down")


app = FastAPI(
    title="SentinelAI",
    description="Intelligent Data Quality & Anomaly Detection Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger.warning("HTTPException %s: %s | path=%s", exc.status_code, exc.detail, request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": f"HTTP_{exc.status_code}"},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "code": "INTERNAL_ERROR"},
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(health.router, tags=["health"])
app.include_router(datasets.router, prefix="/api", tags=["datasets"])
app.include_router(issues.router, prefix="/api", tags=["issues"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
