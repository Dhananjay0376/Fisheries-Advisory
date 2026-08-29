from app.database import Base
from app.models.advisory import Advisory, Subscriber

# Expose models for SQLAlchemy imports / migrations
__all__ = ["Base", "Advisory", "Subscriber"]
