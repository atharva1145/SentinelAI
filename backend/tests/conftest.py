"""Shared test fixtures and configuration."""
from __future__ import annotations

import io
import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# -----------------------------------------------------------------------
# Override DATABASE_URL *before* any app module is imported so that
# app/db/session.py and app/core/config.py pick up SQLite.
# -----------------------------------------------------------------------
os.environ["DATABASE_URL"] = "sqlite:///./test_sentinel.db"

from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from main import app  # noqa: E402

# -----------------------------------------------------------------------
# Engine & session factory pointing at a fresh SQLite file
# -----------------------------------------------------------------------
TEST_DB_URL = "sqlite:///./test_sentinel.db"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def _create_tables() -> None:
    # Import all models so they are registered on Base.metadata
    import app.models.dataset  # noqa: F401
    import app.models.issue  # noqa: F401
    import app.models.audit  # noqa: F401

    Base.metadata.create_all(bind=engine)


def _drop_tables() -> None:
    Base.metadata.drop_all(bind=engine)


# -----------------------------------------------------------------------
# Session-scoped setup / teardown
# -----------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once for the test session."""
    _create_tables()
    yield
    _drop_tables()
    engine.dispose()
    # Clean up the SQLite file
    if os.path.exists("./test_sentinel.db"):
        try:
            os.remove("./test_sentinel.db")
        except OSError:
            pass


# -----------------------------------------------------------------------
# Function-scoped DB session (rolls back after each test)
# -----------------------------------------------------------------------

@pytest.fixture()
def db() -> Session:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


# -----------------------------------------------------------------------
# TestClient with overridden DB dependency
# -----------------------------------------------------------------------

@pytest.fixture()
def client(db: Session) -> TestClient:
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# -----------------------------------------------------------------------
# Sample CSV fixtures
# -----------------------------------------------------------------------

SIMPLE_CSV = """id,name,email,amount,signup_date,category
1,Alice,alice@example.com,100.0,2024-01-01,A
2,Bob,bob@example.com,200.0,2024-01-02,B
3,Charlie,charlie@example.com,300.0,2024-01-03,A
4,Dave,dave@example.com,400.0,2024-01-04,B
5,Eve,eve@example.com,500.0,2024-01-05,A
"""

MISSING_VALUES_CSV = """id,name,email,amount
1,Alice,alice@example.com,100.0
2,,bob@example.com,200.0
3,Charlie,,300.0
4,Dave,dave@example.com,
5,,eve_bad_email,
"""

DUPLICATE_ROWS_CSV = """id,name,amount
1,Alice,100
2,Bob,200
1,Alice,100
3,Charlie,300
"""

INVALID_EMAIL_CSV = """id,email,amount
1,valid@example.com,100
2,not-an-email,200
3,also@bad,300
4,good@domain.co,400
"""

NEGATIVE_AMOUNT_CSV = """id,name,amount,price
1,Alice,100.0,50.0
2,Bob,-50.0,200.0
3,Charlie,300.0,-10.0
"""

NUMERIC_CSV_TEMPLATE = """a,b,c
{rows}
"""


def _make_numeric_csv(n_rows: int = 100, inject_anomaly: bool = True) -> str:
    """Generate a numeric CSV for anomaly detection tests."""
    import random
    random.seed(42)
    lines = []
    for i in range(n_rows):
        a = random.gauss(50, 5)
        b = random.gauss(100, 10)
        c = random.gauss(200, 20)
        lines.append(f"{a:.2f},{b:.2f},{c:.2f}")
    if inject_anomaly:
        # Inject obvious outliers at the end
        lines.append("999.99,999.99,999.99")
        lines.append("-999.99,-999.99,-999.99")
    return "a,b,c\n" + "\n".join(lines) + "\n"


@pytest.fixture()
def simple_csv_bytes() -> bytes:
    return SIMPLE_CSV.encode()


@pytest.fixture()
def missing_values_csv_bytes() -> bytes:
    return MISSING_VALUES_CSV.encode()


@pytest.fixture()
def duplicate_rows_csv_bytes() -> bytes:
    return DUPLICATE_ROWS_CSV.encode()


@pytest.fixture()
def invalid_email_csv_bytes() -> bytes:
    return INVALID_EMAIL_CSV.encode()


@pytest.fixture()
def negative_amount_csv_bytes() -> bytes:
    return NEGATIVE_AMOUNT_CSV.encode()


@pytest.fixture()
def numeric_csv_with_anomalies_bytes() -> bytes:
    return _make_numeric_csv(n_rows=100, inject_anomaly=True).encode()


@pytest.fixture()
def numeric_csv_no_anomalies_bytes() -> bytes:
    return _make_numeric_csv(n_rows=50, inject_anomaly=False).encode()


@pytest.fixture()
def tmp_csv_file(tmp_path):
    """Write SIMPLE_CSV to a temp file and return its path."""
    p = tmp_path / "sample.csv"
    p.write_text(SIMPLE_CSV)
    return str(p)


@pytest.fixture()
def tmp_missing_csv_file(tmp_path):
    p = tmp_path / "missing.csv"
    p.write_text(MISSING_VALUES_CSV)
    return str(p)


@pytest.fixture()
def tmp_duplicate_csv_file(tmp_path):
    p = tmp_path / "dup.csv"
    p.write_text(DUPLICATE_ROWS_CSV)
    return str(p)


@pytest.fixture()
def tmp_email_csv_file(tmp_path):
    p = tmp_path / "emails.csv"
    p.write_text(INVALID_EMAIL_CSV)
    return str(p)


@pytest.fixture()
def tmp_negative_csv_file(tmp_path):
    p = tmp_path / "negatives.csv"
    p.write_text(NEGATIVE_AMOUNT_CSV)
    return str(p)


@pytest.fixture()
def tmp_numeric_csv_file(tmp_path):
    p = tmp_path / "numeric.csv"
    p.write_text(_make_numeric_csv(n_rows=100, inject_anomaly=True))
    return str(p)


@pytest.fixture()
def tmp_small_numeric_csv_file(tmp_path):
    """CSV with >= 10 rows but only one numeric column — should trigger ValueError."""
    p = tmp_path / "single_col.csv"
    p.write_text("name,score\n" + "\n".join(f"Person{i},{i}" for i in range(20)) + "\n")
    return str(p)
