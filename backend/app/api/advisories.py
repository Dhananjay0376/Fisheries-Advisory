from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from math import radians, cos, sin, asin, sqrt

from app.database import get_db
from app.models.advisory import Advisory, Subscriber, Region, BroadcastLog, User
from app.schemas.advisory import (
    AdvisoryCreate, AdvisoryResponse,
    SubscriberCreate, SubscriberResponse,
    RegionCreate, RegionResponse,
    BroadcastLogResponse
)
from app.services.sms import sms_service
from app.api.deps import get_current_user

router = APIRouter()

# --- GEOSPATIAL FILTERING UTILITY ---
def is_subscriber_in_advisory_zone(sub: Subscriber, advisory: Advisory, region_coords: dict) -> bool:
    """
    Checks if a subscriber is within the advisory's geo-radius.
    If no coordinates are specified on the advisory, returns True (global alert).
    If subscriber has no region, returns True (safety first, broadcast anyway).
    """
    if advisory.latitude is None or advisory.longitude is None:
        return True
    
    if not sub.region:
        return True
        
    sub_region_lower = sub.region.lower()
    matched_coord = None
    
    # Try to match the subscriber's region string against DB region names
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


# --- REGION CRUD ENDPOINTS ---

@router.get("/regions", response_model=List[RegionResponse], tags=["regions"])
def list_regions(db: Session = Depends(get_db)):
    """List all registered coastal regions and their coordinates."""
    return db.query(Region).all()

@router.post("/regions", response_model=RegionResponse, status_code=status.HTTP_201_CREATED, tags=["regions"])
def create_region(
    region: RegionCreate, 
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)  # Requires admin login JWT
):
    """Add a new coastal region. Requires Admin authentication."""
    existing = db.query(Region).filter(Region.name == region.name.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Region name already registered")
        
    db_region = Region(
        name=region.name.lower(),
        latitude=region.latitude,
        longitude=region.longitude
    )
    db.add(db_region)
    db.commit()
    db.refresh(db_region)
    return db_region

@router.delete("/regions/{region_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["regions"])
def delete_region(
    region_id: int, 
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    """Delete a coastal region. Requires Admin authentication."""
    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    db.delete(region)
    db.commit()


# --- ADVISORY ENDPOINTS ---

@router.post("/advisories", response_model=AdvisoryResponse, status_code=status.HTTP_201_CREATED, tags=["advisories"])
def create_advisory(
    advisory: AdvisoryCreate, 
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)  # Requires admin login JWT
):
    """Create a new safety or fishing zone advisory. Requires Admin authentication."""
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

@router.get("/advisories", response_model=List[AdvisoryResponse], tags=["advisories"])
def list_advisories(
    type: Optional[str] = None,
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Retrieve list of active safety and catch advisories. Open to public."""
    query = db.query(Advisory)
    if type:
        query = query.filter(Advisory.type == type)
    if severity:
        query = query.filter(Advisory.severity == severity)
    
    return query.order_by(Advisory.created_at.desc()).offset(skip).limit(limit).all()


# --- SUBSCRIBER ENDPOINTS ---

@router.post("/subscribers", response_model=SubscriberResponse, status_code=status.HTTP_201_CREATED, tags=["subscribers"])
def subscribe(subscriber: SubscriberCreate, db: Session = Depends(get_db)):
    """Register or re-enable a subscriber phone number for SMS notifications. Open to public."""
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

@router.get("/subscribers", response_model=List[SubscriberResponse], tags=["subscribers"])
def get_subscribers(db: Session = Depends(get_db)):
    """List all subscribers. Open to public for testing."""
    return db.query(Subscriber).all()


# --- BROADCAST ALERT ENDPOINT & LOGGING ---

@router.post("/advisories/{advisory_id}/broadcast", tags=["broadcasting"])
def broadcast_advisory(
    advisory_id: int, 
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)  # Requires admin login JWT
):
    """Broadcast an advisory to all subscribers in scope. Requires Admin authentication."""
    advisory = db.query(Advisory).filter(Advisory.id == advisory_id).first()
    if not advisory:
        raise HTTPException(status_code=404, detail="Advisory not found")
    
    subscribers = db.query(Subscriber).filter(Subscriber.is_active == True).all()
    if not subscribers:
        return {"message": "No active subscribers to broadcast to.", "sent_count": 0}
    
    # Pre-load regions coordinates dictionary from database to prevent N+1 query overhead
    db_regions = db.query(Region).all()
    region_coords = {r.name.lower(): (r.latitude, r.longitude) for r in db_regions}

    sent_results = []
    skipped_count = 0
    
    for sub in subscribers:
        # 1. Geographic Filter check
        if not is_subscriber_in_advisory_zone(sub, advisory, region_coords):
            skipped_count += 1
            # Record skipped log
            skipped_log = BroadcastLog(
                advisory_id=advisory.id,
                recipient_phone=sub.phone_number,
                status="skipped",
                error_message="Subscriber outside advisory region radius"
            )
            db.add(skipped_log)
            continue
            
        # 2. Pick Language translation
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
        
        # 3. Dispatch SMS
        res = sms_service.send_sms(sub.phone_number, msg_body)
        sent_results.append(res)
        
        # 4. Write Audit Log
        status_val = "success" if res.get("status") == "success" else "failed"
        err_msg = res.get("error") if status_val == "failed" else None
        
        log_entry = BroadcastLog(
            advisory_id=advisory.id,
            recipient_phone=sub.phone_number,
            status=status_val,
            error_message=err_msg
        )
        db.add(log_entry)
        
    db.commit()  # Commit all broadcast logs
        
    return {
        "message": f"Broadcast triggered for advisory #{advisory_id}",
        "total_subscribers_checked": len(subscribers),
        "sent_count": len(sent_results),
        "skipped_out_of_zone": skipped_count,
        "results": sent_results
    }

@router.get("/broadcast-logs", response_model=List[BroadcastLogResponse], tags=["broadcasting"])
def get_broadcast_logs(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)  # Requires admin login JWT
):
    """Retrieve audit history of alert broadcasts. Requires Admin authentication."""
    return db.query(BroadcastLog).order_by(BroadcastLog.sent_at.desc()).all()

from fastapi import Query as QueryParam
from app.services.ml import ml_service

@router.get("/predict-weather", tags=["machine_learning"])
def predict_weather(
    lat: float = QueryParam(..., description="GPS Latitude"),
    lon: float = QueryParam(..., description="GPS Longitude"),
    timestamp: str = QueryParam(None, description="ISO timestamp (optional, defaults to now)")
):
    """
    Predict weather conditions for a given GPS location and time using the TabPFN v2 model.
    Returns weather class, safety level, confidence score, and fishing advice.
    """
    result = ml_service.predict_weather(lat, lon, timestamp)
    return result

