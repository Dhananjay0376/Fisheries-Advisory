# Fisheries Advisory Backend API

Built with **Python** and **FastAPI** using **SQLAlchemy** for database operations. It provides endpoints for creating safety/fishing advisories, storing regional translations, managing subscriber phone numbers, and distributing alerts via SMS gateway.

---

## Folder Organization

```
backend/
├── app/
│   ├── api/            # API routing handlers
│   │   └── advisories.py
│   ├── models/         # SQLAlchemy database schemas
│   │   └── advisory.py
│   ├── schemas/        # Pydantic typing and validation schemas
│   │   └── advisory.py
│   ├── services/       # Third-party service integrations (SMS, etc.)
│   │   └── sms.py
│   ├── config.py       # Configuration and Environment variable settings
│   ├── database.py     # SQLAlchemy DB connection & session factory
│   └── main.py         # App entry and initialization
├── requirements.txt    # Production & Development requirements
└── .env.example        # Environment variables configuration guide
```

---

## Local Setup

### 1. Create and Activate Virtual Environment
```bash
python -m venv venv

# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Environment Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Inside `.env`, configure your database URL and Twilio SMS parameters (or use default mock triggers).

### 4. Run Server
```bash
uvicorn app.main:app --reload
```
The server will run on [http://127.0.0.1:8000](http://127.0.0.1:8000).
Interactive Swagger docs are auto-generated and accessible at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 5. Seeding Initial Advisories
To populate dummy data for testing (e.g. for the frontend team to retrieve right away), execute a POST request to:
`http://127.0.0.1:8000/api/seed-dummy-data` (or click "Try it out" in Swagger Docs).

---

## SMS Integration Details
By default, if `TWILIO_ACCOUNT_SID` remains the default template value `ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`, the server enters **Mock Mode**.
- SMS actions do not query Twilio; they are instead logged directly to the FastAPI server logs.
- You can inspect console outputs to see simulated SMS dispatches.
- To switch to production SMS, replace the keys in `.env` with active Twilio details.
