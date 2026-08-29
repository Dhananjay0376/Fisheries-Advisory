import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import settings
from app.models import Advisory, Subscriber, Region, BroadcastLog, User

from sqlalchemy.pool import StaticPool

# Setup a clean in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
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
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def get_auth_headers(username="testadmin", password="password123"):
    # 1. Register admin first (requires static X-Admin-API-Key)
    client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
        headers={"X-Admin-API-Key": settings.ADMIN_API_KEY}
    )
    # 2. Login to get token
    response = client.post(
        "/api/auth/token",
        data={"username": username, "password": password}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_healthcheck():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_seed_dummy_data():
    response = client.post("/api/seed-dummy-data")
    assert response.status_code == 200
    assert "Database seeded successfully" in response.json()["message"]

def test_admin_registration_security():
    # Attempt registration without X-Admin-API-Key header -> 403
    response_missing = client.post(
        "/api/auth/register",
        json={"username": "admin", "password": "password"}
    )
    assert response_missing.status_code in [401, 403]

    # Attempt with wrong X-Admin-API-Key -> 401
    response_wrong = client.post(
        "/api/auth/register",
        json={"username": "admin", "password": "password"},
        headers={"X-Admin-API-Key": "wrong-key"}
    )
    assert response_wrong.status_code == 401

    # Valid key -> 201
    response_valid = client.post(
        "/api/auth/register",
        json={"username": "admin", "password": "password"},
        headers={"X-Admin-API-Key": settings.ADMIN_API_KEY}
    )
    assert response_valid.status_code == 201
    assert response_valid.json()["username"] == "admin"

def test_admin_login():
    # Register user
    client.post(
        "/api/auth/register",
        json={"username": "user1", "password": "password123"},
        headers={"X-Admin-API-Key": settings.ADMIN_API_KEY}
    )
    
    # Login with correct credentials
    resp = client.post(
        "/api/auth/token",
        data={"username": "user1", "password": "password123"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    
    # Login with bad credentials -> 401
    resp_bad = client.post(
        "/api/auth/token",
        data={"username": "user1", "password": "badpassword"}
    )
    assert resp_bad.status_code == 401

def test_protected_routes():
    # Attempting to post an advisory without JWT -> 401
    advisory_payload = {
        "title": "Chennai Storm Alert",
        "type": "weather",
        "severity": "high",
        "content_en": "Deep storm heading coastal."
    }
    
    resp = client.post("/api/advisories", json=advisory_payload)
    assert resp.status_code == 401

def test_regions_crud():
    headers = get_auth_headers()
    
    # Create region
    region_payload = {
        "name": "chennai",
        "latitude": 13.0827,
        "longitude": 80.2707
    }
    resp = client.post("/api/regions", json=region_payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["name"] == "chennai"
    
    # Get regions list
    resp_get = client.get("/api/regions")
    assert resp_get.status_code == 200
    assert len(resp_get.json()) == 1
    assert resp_get.json()[0]["name"] == "chennai"

def test_dynamic_broadcast_filtering():
    headers = get_auth_headers()
    
    # 1. Seed Region DB
    client.post("/api/regions", json={"name": "chennai", "latitude": 13.0827, "longitude": 80.2707}, headers=headers)
    client.post("/api/regions", json={"name": "vizag", "latitude": 17.6868, "longitude": 83.2185}, headers=headers)
    
    # 2. Add Subscribers
    client.post("/api/subscribers", json={"phone_number": "+919999999991", "preferred_language": "ta", "region": "Chennai Harbor"})
    client.post("/api/subscribers", json={"phone_number": "+919999999992", "preferred_language": "en", "region": "Vizag Port"})
    client.post("/api/subscribers", json={"phone_number": "+919999999993", "preferred_language": "en", "region": "Mumbai Dock"}) # no coordinate match
    
    # 3. Create Advisory (Chennai center, 30km radius)
    advisory_payload = {
        "title": "Chennai Storm Alert",
        "type": "weather",
        "severity": "high",
        "content_en": "Storm approaching Chennai.",
        "latitude": 13.08,
        "longitude": 80.27,
        "radius_km": 30.0
    }
    
    create_resp = client.post("/api/advisories", json=advisory_payload, headers=headers)
    advisory_id = create_resp.json()["id"]
    
    # 4. Trigger broadcast
    broadcast_resp = client.post(f"/api/advisories/{advisory_id}/broadcast", headers=headers)
    assert broadcast_resp.status_code == 200
    
    res = broadcast_resp.json()
    assert res["total_subscribers_checked"] == 3
    
    # - Sent count = 1 (Chennai Harbor subscriber is in range)
    # - Skipped count = 2 (Vizag is out of range, Mumbai Dock has no coordinate mapping and string match is absent)
    assert res["sent_count"] == 1
    assert res["skipped_out_of_zone"] == 2
    
    # Check broadcast audit logs
    logs_resp = client.get("/api/broadcast-logs", headers=headers)
    assert logs_resp.status_code == 200
    assert len(logs_resp.json()) == 3  # Logs were written for all recipients (1 success/failed, 2 skipped)
