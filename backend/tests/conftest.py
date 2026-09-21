"""
conftest.py — shared pytest fixtures for Duewell backend tests.

Runs Base.metadata.create_all before the test suite starts so the
in-memory SQLite database has all tables available.
"""
import os

import pytest

# Must be set before importing anything from main or database
os.environ["ENV"] = "test"
os.environ.setdefault("JWT_SECRET", "test_secret_key_for_pytest_only_32c")


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all SQLAlchemy tables in the shared in-memory DB once per session."""
    from database import Base, engine  # noqa: F401 — imported for side effects
    Base.metadata.create_all(bind=engine)
    yield
    # Tables are dropped automatically when the in-memory DB process ends
