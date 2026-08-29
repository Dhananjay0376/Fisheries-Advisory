from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from math import radians, cos, sin, asin, sqrt

from app.database import get_db
from app.models.advisory import Advisory, Subscriber
from app.schemas.advisory import (
    AdvisoryCreate, AdvisoryResponse,
    SubscriberCreate, SubscriberResponse
)
from app.services.sms import sms_service
from app.config import settings

router = APIRouter()

# --- ADMIN API KEY SECURITY ---
api_key_header = APIKeyHeader(name="X-Admin-API-Key", auto_error=True)

def verify_admin_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Admin API Key"
        )
    return api_key


# --- GEOSPATIAL FILTERING UTILITY ---
def is_subscriber_in_advisory_zone(sub: Subscriber, advisory: Advisory) -> bool:
    """
    Checks if a subscriber is within the advisory's geo-radius.
    If no coordinates are specified on the advisory, returns True (global alert).
    If subscriber has no region, returns True (safety first, broadcast anyway).
    """
    if advisory.latitude is None or advisory.longitude is None:
        return True
    
    if not sub.region:
        return True
        
    # Basic mapping of common regional keywords to coordinates
    region_coords = {
        "chennai": (13.0827, 80.2707),
        "vizag": (17.6868, 83.2185),
        "kochi": (9.9312, 76.2673),
        "kerala": (10.8505, 76.2711),
        "mumbai": (19.0760, 72.8777)
    }
    
    sub_region_lower = sub.region.lower()
    matched_coord = None
    for r_name, coords in region_coords.items():
        if r_name in sub_region_lower:
            matched_coord = coords
            break
            
    if not matched_coord:
        # Fallback to string matching: is the region name listed in the advisory content?
        return (
            sub_region_lower in advisory.title.lower() or 
            sub_region_lower in advisory.content_en.lower()
        )
        
    def haversine(lon1, lat1, lon2, lat2):
        # Convert decimal degrees to radians 
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        # Haversine formula 
        dlon = lon2 - lon1 
        dlat = lat2 - lat1 
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a)) 
        r = 6371  # Radius of earth in kilometers
        return c * r

    distance = haversine(matched_coord[1], matched_coord[0], advisory.longitude, advisory.latitude)
    max_radius = advisory.radius_km if advisory.radius_km is not None else 50.0
    return distance <= max_radius


# --- ADVISORY ENDPOINTS ---

@router.post("/advisories", response_model=AdvisoryResponse, status_code=status.HTTP_201_CREATED)
def create_advisory(
    advisory: AdvisoryCreate, 
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key)
):
    db_advisory = Advisory(
        title=advisory.title,
        type=advisory.type,
        severity=advisory.severity,
        content_en=advisory.content_en,
        content_ta=advisory.content_ta,
        content_te=advisory.content_te,
        content_hi=advisory.content_hi,
        latitude=advisory.latitude,
        longitude=advisory.longitude,
        radius_km=advisory.radius_km,
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
    
    return query.order_by(Advisory.created_at.desc()).offset(skip).limit(limit).all()

# --- SUBSCRIBER ENDPOINTS ---

@router.post("/subscribers", response_model=SubscriberResponse, status_code=status.HTTP_201_CREATED)
def subscribe(subscriber: SubscriberCreate, db: Session = Depends(get_db)):
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
def broadcast_advisory(
    advisory_id: int, 
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin_key)
):
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise HTTPException(status_code=404, detail="Advisory not found")
    
    subscribers = db.query(Subscriber).filter(Subscriber.is_active == True).all()
    if not subscribers:
        return {"message": "No active subscribers to broadcast to.", "sent_count": 0}
    
    sent_results = []
    skipped_count = 0
    
    for sub in subscribers:
        # Check if the subscriber falls within the advisory region
        if not is_subscriber_in_advisory_zone(sub, advisory):
            skipped_count += 1
            continue
            
        lang = sub.preferred_language.lower()
        msg_body = ""
        
        if lang == "ta" and advisory.content_ta:
            msg_body = f"[{advisory.title}] {advisory.content_ta}"
        elif lang == "te" and advisory.content_te:
            msg_body = f"[{advisory.title}] {advisory.content_te}"
        elif lang == "hi" and advisory.content_hi:
            msg_body = f"[{advisory.title}] {advisory.content_hi}"
        else:
            msg_body = f"[{advisory.title}] {advisory.content_en}"
        
        res = sms_service.send_sms(sub.phone_number, msg_body)
        sent_results.append(res)
        
    return {
        "message": f"Broadcast triggered for advisory #{advisory_id}",
        "total_subscribers_checked": len(subscribers),
        "sent_count": len(sent_results),
        "skipped_out_of_zone": skipped_count,
        "results": sent_results
    }
