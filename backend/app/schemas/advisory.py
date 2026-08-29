from pydantic import BaseModel, Field
from typing import Optional
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
    phone_number: str = Field(..., description="Phone number with country code", examples=["+919876543210"])
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
