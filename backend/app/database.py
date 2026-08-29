from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Normalize database URL (SQLAlchemy requires 'postgresql://' instead of 'postgres://')
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# For SQLite databases, we need to allow multithreading access
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif db_url.startswith("postgresql"):
    # Vercel serverless functions run in IPv4-only environments.
    # Supabase's direct DB host resolves to IPv6 which Vercel cannot reach.
    # Adding gssencmode=disable + sslmode=require forces a plain IPv4 TLS connection.
    # Also use Supabase's session pooler port via the URL if provided; otherwise append params.
    if "?" not in db_url:
        db_url = db_url + "?sslmode=require&gssencmode=disable"
    else:
        # Ensure these params are appended without duplication
        if "gssencmode" not in db_url:
            db_url = db_url + "&gssencmode=disable"
        if "sslmode" not in db_url:
            db_url = db_url + "&sslmode=require"

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,  # Detect stale connections and reconnect automatically
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency injection helper to yield database session and close afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
