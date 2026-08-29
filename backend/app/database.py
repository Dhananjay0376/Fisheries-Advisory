from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.engine import make_url
from app.config import settings

# Normalize database URL (SQLAlchemy requires 'postgresql://' instead of 'postgres://')
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# For SQLite databases, we need to allow multithreading access
connect_args = {}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)

elif db_url.startswith("postgresql"):
    # Parse the URL to extract components safely
    parsed = make_url(db_url)

    # Vercel serverless runs in IPv4-only environments.
    # Supabase Session Pooler (aws-0-*.pooler.supabase.com) uses IPv4 - use that host.
    # The pooler requires username in format: postgres.<project-ref>
    # We pass connect_args explicitly to avoid psycopg2 URL parsing truncating the username.
    connect_args = {
        "sslmode": "require",
        "gssencmode": "disable",
        # Explicitly pass the full username so psycopg2 doesn't truncate at the dot
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.host,
        "port": parsed.port or 5432,
        "dbname": parsed.database,
    }

    # Use a plain DSN string instead of URL to avoid psycopg2 username parsing issues
    engine = create_engine(
        "postgresql+psycopg2://",
        creator=lambda: __import__("psycopg2").connect(**connect_args),
        pool_pre_ping=True,
        pool_size=1,
        max_overflow=0,
    )

else:
    engine = create_engine(db_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency injection helper to yield database session and close afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
