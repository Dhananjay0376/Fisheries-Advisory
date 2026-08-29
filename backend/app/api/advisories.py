from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.advisory import Advisory, Subscriber
from app.schemas.advisory import (
    AdvisoryCreate, AdvisoryResponse,
    SubscriberCreate, SubscriberResponse
)
from app.services.sms import sms_service

router = APIRouter()

# --- ADVISORY ENDPOINTS ---

@router.post("/advisories", response_model=AdvisoryResponse, status_code=status.HTTP_201_CREATED)
def create_advisory(advisory: AdvisoryCreate, db: Session = Depends(get_db)):
    db_advisory = Advisory(
        title=advisory.title,
        type=advisory.type,
        severity=advisory.severity,
        content_en=advisory.content_en,
        content_ta=advisory.content_ta,
        content_te=advisory.content_te,
        content_hi=advisory.content_hi,
        valid_until=advisory.valid_until
    )
    db.add(db_advisory)
    db.commit()
    db.refresh(db_advisory)
    return db_advisory

@router.get("/advisories", response_model=List[AdvisoryResponse])
def list_advisories(
    type: Optional[str] = None,
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Advisory)
    if type:
        query = query.filter(Advisory.type == type)
    if severity:
        query = query.filter(Advisory.severity == severity)
    
    # Return sorted by newest first
    return query.order_by(Advisory.created_at.desc()).offset(skip).limit(limit).all()

# --- SUBSCRIBER ENDPOINTS ---

@router.post("/subscribers", response_model=SubscriberResponse, status_code=status.HTTP_201_CREATED)
def subscribe(subscriber: SubscriberCreate, db: Session = Depends(get_db)):
    # Check if subscriber already exists
    existing = db.query(Subscriber).filter(Subscriber.phone_number == subscriber.phone_number).first()
    if existing:
        existing.is_active = True
        existing.preferred_language = subscriber.preferred_language
        existing.region = subscriber.region
        db.commit()
        db.refresh(existing)
        return existing
    
    db_sub = Subscriber(
        phone_number=subscriber.phone_number,
        preferred_language=subscriber.preferred_language,
        region=subscriber.region,
        is_active=True
    )
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

@router.get("/subscribers", response_model=List[SubscriberResponse])
def get_subscribers(db: Session = Depends(get_db)):
    return db.query(Subscriber).all()

# --- BROADCAST ALERT ENDPOINT ---

@router.post("/advisories/{advisory_id}/broadcast")
def broadcast_advisory(advisory_id: int, db: Session = Depends(get_db)):
    # Find advisory
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise HTTPException(status_code=404, detail="Advisory not found")
    
    # Find active subscribers
    subscribers = db.query(Subscriber).filter(Subscriber.is_active == True).all()
    if not subscribers:
        return {"message": "No active subscribers to broadcast to.", "sent_count": 0}
    
    sent_results = []
    for sub in subscribers:
        # Determine language content
        lang = sub.preferred_language.lower()
        msg_body = ""
        
        # Pick the correct language text, fallback to English
        if lang == "ta" and advisory.content_ta:
            msg_body = f"[{advisory.title}] {advisory.content_ta}"
        elif lang == "te" and advisory.content_te:
            msg_body = f"[{advisory.title}] {advisory.content_te}"
        elif lang == "hi" and advisory.content_hi:
            msg_body = f"[{advisory.title}] {advisory.content_hi}"
        else:
            msg_body = f"[{advisory.title}] {advisory.content_en}"
        
        # Dispatch SMS
        res = sms_service.send_sms(sub.phone_number, msg_body)
        sent_results.append(res)
        
    return {
        "message": f"Broadcast triggered for advisory #{advisory_id}",
        "sent_count": len(sent_results),
        "results": sent_results
    }
