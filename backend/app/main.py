from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.config import settings
from app.database import engine, Base, get_db
from app.models import Advisory, Subscriber
from app.api import advisories_router

# Auto-create SQLite database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Multilingual low-bandwidth fishing advisory gateway.",
    version="1.0.0"
)

# CORS configuration to allow local React frontend client queries
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach API endpoints
app.include_router(advisories_router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "docs_url": "/docs"
    }

@app.post("/api/seed-dummy-data")
def seed_dummy_data(db: Session = Depends(get_db)):
    """Convenience endpoint to seed the database with initial advisory & subscriber data."""
    # Check if empty
    if db.query(Advisory).count() > 0:
        return {"message": "Database already contains data."}
    
    # 1. Add some subscribers
    dummy_subs = [
        Subscriber(phone_number="+919876543210", preferred_language="ta", region="Chennai Coast"),
        Subscriber(phone_number="+919876543211", preferred_language="te", region="Vizag Port"),
        Subscriber(phone_number="+919876543212", preferred_language="en", region="Kochi Harbour")
    ]
    db.add_all(dummy_subs)
    
    # 2. Add some advisories
    dummy_advisories = [
        Advisory(
            title="Cyclonic Storm Warning",
            type="weather",
            severity="high",
            content_en="Deep depression in Bay of Bengal. Wind speed reaching 65 km/h. Fishermen advised not to venture into deep sea.",
            content_ta="வங்காள விரிகுடாவில் ஆழ்ந்த காற்றழுத்த தாழ்வு பகுதி. காற்றின் வேகம் 65 கிமீ/மணி. மீனவர்கள் கடலுக்குள் செல்ல வேண்டாம் என்று அறிவுறுத்தப்படுகிறார்கள்.",
            content_te="బంగాళాఖాతంలో తీవ్ర వాయుగుండం. గాలి వేగం గంటకు 65 కి.మీ. మత్స్యకారులు సముద్రంలోకి వెళ్లవద్దని సలహా ఇచ్చారు.",
            content_hi="बंगाल की खाड़ी में गहरा दबाव। हवा की गति 65 किमी/घंटा तक पहुंच रही है। मछुआरों को गहरे समुद्र में न जाने की सलाह दी जाती है।",
            latitude=14.0,
            longitude=81.0,
            radius_km=300.0,
            valid_until=datetime.utcnow() + timedelta(days=2)
        ),
        Advisory(
            title="Potential Fishing Zone (PFZ)",
            type="fishing_zone",
            severity="low",
            content_en="High chlorophyll concentration and favorable SST detected 25km Off-shore Chennai. Good tuna catch expected.",
            content_ta="சென்னை கடற்கரையில் இருந்து 25 கிமீ தொலைவில் அதிக குளோரோபில் செறிவு மற்றும் சாதகமான கடல் வெப்பநிலை கண்டறியப்பட்டுள்ளது. நல்ல சூரை மீன் பிடிப்பு எதிர்பார்க்கப்படுகிறது.",
            content_te="చెన్నై తీరానికి 25 కిమీ దూరంలో అధిక క్లోరోఫిల్ మరియు అనుకూలమైన సముద్ర ఉష్ణోగ్రత కనుగొనబడింది. మంచి ట్యూనా లభ్యత అవకాశం ఉంది.",
            content_hi="चेन्नई तट से 25 किमी दूर उच्च क्लोरोफिल और अनुकूल समुद्री तापमान देखा गया है। अच्छी टूना मछली मिलने की संभावना है।",
            latitude=13.2,
            longitude=80.4,
            radius_km=40.0,
            valid_until=datetime.utcnow() + timedelta(days=1)
        ),
        Advisory(
            title="High Wave Alert",
            type="safety",
            severity="medium",
            content_en="Swell waves of height 2.5 - 3.1 meters predicted along Kerala coast. Marine police requests cautious sailing.",
            content_ta="கேரள கடற்கரையில் 2.5 - 3.1 மீட்டர் உயரமுள்ள அலைகள் கணிக்கப்பட்டுள்ளது. கடல்சார் காவல்துறையினர் எச்சரிக்கையுடன் செல்ல கேட்டுக்கொள்கிறார்கள்.",
            content_te="కేరళ తీరంలో 2.5 - 3.1 మీటర్ల ఎత్తులో అలల హెచ్చరిక. మత్స్యకారులు జాగ్రత్త వహించాలని కోరారు.",
            content_hi="केरल तट पर 2.5 - 3.1 मीटर ऊंची लहरों की भविष्यवाणी। समुद्री पुलिस ने सावधानी बरतने का अनुरोध किया है।",
            latitude=10.0,
            longitude=76.0,
            radius_km=150.0,
            valid_until=datetime.utcnow() + timedelta(hours=18)
        )
    ]
    db.add_all(dummy_advisories)
    
    db.commit()
    return {"message": "Dummy data seeded successfully", "subscribers": len(dummy_subs), "advisories": len(dummy_advisories)}
