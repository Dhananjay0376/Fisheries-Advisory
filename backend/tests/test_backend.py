import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import settings

# Setup a clean in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Override FastAPI dependency injection for DB
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    # Setup database tables before each test
    Base.metadata.create_all(bind=engine)
    yield
    # Drop database tables after each test
    Base.metadata.drop_all(bind=engine)

def test_healthcheck():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_seed_dummy_data():
    # Trigger seeding
    response = client.post("/api/seed-dummy-data")
    assert response.status_code == 200
    assert "Dummy data seeded successfully" in response.json()["message"]
    
    # Try seeding again - should notice it already has data
    response_again = client.post("/api/seed-dummy-data")
    assert response_again.status_code == 200
    assert "Database already contains data" in response_again.json()["message"]

def test_advisories_api_key_security():
    advisory_payload = {
        "title": "Storm alert",
        "type": "weather",
        "severity": "high",
        "content_en": "High winds expected.",
        "latitude": 13.0,
        "longitude": 80.0,
        "radius_km": 50.0
    }
    
    # Post without api key header -> 403 Forbidden (since APIKeyHeader returns 403 when header is missing)
    # Wait, FastAPI APIKeyHeader returns 403 on missing key by default unless config is modified
    response_missing = client.post("/api/advisories", json=advisory_payload)
    assert response_missing.status_code == 403
    
    # Post with bad api key -> 401 Unauthorized
    response_bad = client.post(
        "/api/advisories", 
        json=advisory_payload,
        headers={"X-Admin-API-Key": "wrong-key"}
    )
    assert response_bad.status_code == 401
    assert "Invalid or missing Admin API Key" in response_bad.json()["detail"]

def test_create_and_get_advisory():
    advisory_payload = {
        "title": "Chennai Fishing Zone",
        "type": "fishing_zone",
        "severity": "low",
        "content_en": "Good fishing conditions.",
        "content_ta": "நல்ல மீன்பிடி சூழல்.",
        "latitude": 13.08,
        "longitude": 80.24,
        "radius_km": 25.0
    }
    
    response = client.post(
        "/api/advisories", 
        json=advisory_payload,
        headers={"X-Admin-API-Key": settings.ADMIN_API_KEY}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Chennai Fishing Zone"
    assert data["latitude"] == 13.08
    assert data["longitude"] == 80.24
    assert data["radius_km"] == 25.0
    assert "id" in data
    
    # Get advisories list
    response_get = client.get("/api/advisories")
    assert response_get.status_code == 200
    assert len(response_get.json()) == 1
    assert response_get.json()[0]["title"] == "Chennai Fishing Zone"

def test_subscriber_registration():
    sub_payload = {
        "phone_number": "+919876543210",
        "preferred_language": "ta",
        "region": "Chennai Coast"
    }
    
    # Register subscriber
    response = client.post("/api/subscribers", json=sub_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["phone_number"] == "+919876543210"
    assert data["preferred_language"] == "ta"
    assert data["region"] == "Chennai Coast"
    assert data["is_active"] is True
    
    # Fetch list
    response_list = client.get("/api/subscribers")
    assert response_list.status_code == 200
    assert len(response_list.json()) == 1

def test_broadcast_filtering():
    # 1. Register subscribers in different regions
    # Chennai matches coordinates ~13.08, 80.27
    # Vizag matches coordinates ~17.68, 83.21 (far from Chennai)
    client.post("/api/subscribers", json={"phone_number": "+910000000001", "preferred_language": "ta", "region": "Chennai Harbor"})
    client.post("/api/subscribers", json={"phone_number": "+910000000002", "preferred_language": "en", "region": "Vizag Port"})
    client.post("/api/subscribers", json={"phone_number": "+910000000003", "preferred_language": "hi", "region": "No Region Defined"})
    
    # 2. Create localized advisory centered in Chennai with 50km radius
    advisory_payload = {
        "title": "Chennai Storm Warning",
        "type": "weather",
        "severity": "high",
        "content_en": "Chennai local storm warning.",
        "latitude": 13.08,
        "longitude": 80.27,
        "radius_km": 50.0
    }
    
    create_resp = client.post(
        "/api/advisories", 
        json=advisory_payload,
        headers={"X-Admin-API-Key": settings.ADMIN_API_KEY}
    )
    advisory_id = create_resp.json()["id"]
    
    # 3. Trigger broadcast (requires Admin Key)
    response_broadcast = client.post(
        f"/api/advisories/{advisory_id}/broadcast",
        headers={"X-Admin-API-Key": settings.ADMIN_API_KEY}
    )
    
    assert response_broadcast.status_code == 200
    res_data = response_broadcast.json()
    
    # Assertions:
    # - Total active subscribers checked = 3
    # - Sent count = 2 (Chennai Harbor subscriber is in range, No Region Defined falls back to send)
    # - Skipped count = 1 (Vizag Port is ~600km away, hence out of the 50km radius)
    assert res_data["total_subscribers_checked"] == 3
    assert res_data["sent_count"] == 2
    assert res_data["skipped_out_of_zone"] == 1
