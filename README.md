# Fisheries Advisory Delivery App

A multilingual, low-bandwidth alert application designed to deliver real-time fishing-zone and weather safety advisories to coastal and rural fishermen via SMS, offline-friendly mobile interface, and interactive channels.

## Project Structure

This project is organized into two primary subfolders:

- **[`backend/`](file:///d:/Fisheries%20Advisory/backend/)**: A Python FastAPI backend service that manages advisories, processes translations, registers subscribers, and broadcasts SMS/USSD alerts.
- **[`frontend/`](file:///d:/Fisheries%20Advisory/frontend/)**: A lightweight React Progressive Web App (PWA) built with Vite and Tailwind CSS. It is fully optimized for low-bandwidth connections, offline caching of advisories, and regional language translation toggles.

---

## Quick Start Setup

### Prerequisites
- [Python 3.10+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)
- [Git](https://git-scm.com/)

---

### 1. Backend Setup

Navigate to the `backend/` directory and configure the environment:

```bash
cd backend
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies:
pip install -r requirements.txt

# Copy config:
cp .env.example .env

# Run development server:
uvicorn app.main:app --reload
```

The backend server will run at [http://127.0.0.1:8000](http://127.0.0.1:8000). You can access interactive documentation at `/docs` (Swagger UI).

---

### 2. Frontend Setup

Navigate to the `frontend/` directory and configure the client:

```bash
cd frontend
npm install
npm run dev
```

The frontend client will run at [http://localhost:5173](http://localhost:5173).

For testing offline capabilities:
```bash
npm run build
npm run preview
```
This builds the production package and starts a preview server with fully operational service worker caching for offline testing.

---

## Architecture and Design Choices

### Offline First
Fishermen frequently enter regions with zero cellular connectivity.
- The React application registers a **Service Worker** to cache web app assets (HTML, CSS, JS, localized assets).
- Incoming advisories are saved to the browser's persistent database (`IndexedDB` / `LocalStorage`), so previously downloaded advisories remain fully readable while at sea.
- The UI registers connectivity state and shows clear connection status banners to notify users when they are offline.

### Multilingual Support
- The app utilizes language localization files (`en.json`, `ta.json`, etc.) to provide complete localized translation sets.
- Backend database schemas support keying advisory descriptions and safety messages in multiple regional languages.

### Low-Bandwidth Data Payloads
- API payloads are kept to a minimum (e.g. using IDs, UNIX timestamps, and compressed text).
- The web app design avoids heavy imagery and large libraries, loading fast even on 2G connections.
