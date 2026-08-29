from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# --- ADVISORY SCHEMAS ---

class AdvisoryBase(BaseModel):
    title: str = Field(..., max_length=100, examples=["High Wave Warning"])
    type: str = Field("general", description="weather, fishing_zone, safety, general", examples=["weather"])
    severity: str = Field("medium", description="low, medium, high", examples=["high"])
    content_en: str = Field(..., description="English content")
    content_ta: Optional[str] = Field(None, description="Tamil translation")
    content_te: Optional[str] = Field(None, description="Telugu translation")
    content_hi: Optional[str] = Field(None, description="Hindi translation")
    latitude: Optional[float] = Field(None, description="Latitude coordinates", examples=[12.9716])
    longitude: Optional[float] = Field(None, description="Longitude coordinates", examples=[80.2408])
    radius_km: Optional[float] = Field(None, description="Advisory coverage radius in kilometers", examples=[50.0])
    valid_until: Optional[datetime] = None

class AdvisoryCreate(AdvisoryBase):
    pass

class AdvisoryResponse(AdvisoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- SUBSCRIBER SCHEMAS ---

class SubscriberBase(BaseModel):
    phone_number: Optional[str] = Field(None, description="Phone number with country code", examples=["+919876543210"])
    email: Optional[str] = Field(None, description="Email address of the subscriber", examples=["fisherman@example.com"])
    preferred_language: str = Field("en", description="ISO code (en, ta, te, hi)", examples=["ta"])
    region: Optional[str] = Field(None, examples=["Chennai Coastal"])

class SubscriberCreate(SubscriberBase):
    pass

class SubscriberResponse(SubscriberBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- BROADCAST ALERTS SCHEMAS ---
class AlertBroadcastRequest(BaseModel):
    advisory_id: int

# --- REGION SCHEMAS ---
class RegionBase(BaseModel):
    name: str = Field(..., description="Unique lowercase identifier for the region", examples=["chennai"])
    latitude: float = Field(..., description="Latitude coordinate", examples=[13.0827])
    longitude: float = Field(..., description="Longitude coordinate", examples=[80.2707])

class RegionCreate(RegionBase):
    pass

class RegionResponse(RegionBase):
    id: int

    class Config:
        from_attributes = True

# --- USER & JWT SCHEMAS ---
class UserCreate(BaseModel):
    username: str = Field(..., max_length=50, examples=["admin"])
    password: str = Field(..., min_length=6, examples=["supersecret"])

class UserResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- BROADCAST AUDIT LOG SCHEMAS ---
class BroadcastLogResponse(BaseModel):
    id: int
    advisory_id: int
    recipient_phone: Optional[str] = None
    recipient_email: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True
