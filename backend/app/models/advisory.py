from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey
from app.database import Base

class Advisory(Base):
    __tablename__ = "advisories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False, default="general")  # weather, fishing_zone, safety, general
    severity = Column(String(20), nullable=False, default="medium")  # low, medium, high
    
    # Geospatial boundaries for targeted alerts
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_km = Column(Float, nullable=True)
    
    # Multilingual fields to minimize payload queries
    content_en = Column(Text, nullable=False)
    content_ta = Column(Text, nullable=True)  # Tamil
    content_te = Column(Text, nullable=True)  # Telugu
    content_hi = Column(Text, nullable=True)  # Hindi
    
    created_at = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    email = Column(String(100), unique=True, index=True, nullable=True)
    preferred_language = Column(String(10), nullable=False, default="en")
    region = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)


class BroadcastLog(Base):
    __tablename__ = "broadcast_logs"

    id = Column(Integer, primary_key=True, index=True)
    advisory_id = Column(Integer, ForeignKey("advisories.id", ondelete="CASCADE"), nullable=False)
    recipient_phone = Column(String(20), nullable=True)
    recipient_email = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False)  # success, failed, skipped
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
