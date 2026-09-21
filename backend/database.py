from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Use a separate in-memory SQLite database during tests so the real bills.db
# is never touched by the test suite.
_ENV = os.getenv("ENV", "development")
if _ENV == "test":
    DATABASE_URL = "sqlite:///file::memory:?uri=true&cache=shared"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "uri": True},
    )
else:
    DATABASE_URL = f"sqlite:///{BASE_DIR / 'bills.db'}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
