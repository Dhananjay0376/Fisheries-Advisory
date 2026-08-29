# Fisheries Advisory Frontend Web Client

A React Progressive Web App (PWA) build using **Vite**, **Tailwind CSS**, and **Lucide React Icons**.
Designed specifically to accommodate rural/coastal fishermen by addressing the constraints of low bandwidth, poor cellular service, and regional language barriers.

---

## Technical Highlights

1. **Offline Capability & Local Caching**:
   - **Service Workers**: Registered automatically to download and cache core app assets (`index.html`, CSS, JavaScript, locales, and icons). Once loaded, the app can load completely without internet.
   - **NetworkFirst Strategy**: When retrieving advisories from the API, the app tries to fetch updated content. If offline or the connection fails, it falls back instantly to local browser cache stored inside `localStorage`.
   - **Dynamic Network Indicators**: Real-time listeners notify the fisherman with an alert banner if they are offline.

2. **Multilingual Dictionary (Locales)**:
   - Includes support for translating interface elements dynamically into **English (`en`)**, **Tamil (`ta`)**, and **Hindi (`hi`)** without page reloads.
   - Intelligently displays content returned by the advisory API in the selected regional language if translations exist on the server, falling back safely to English description otherwise.

3. **Ultra-lightweight Payload & Mobile Optimizations**:
   - Max-width design scaled specifically for compact smartphone views (resembling a mobile application).
   - Minimal dependencies to keep initial bundle size small, resolving quickly on slow 2G connections.

---

## Local Setup

### 1. Install Node Modules
```bash
npm install
```

### 2. Start Development Client
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) to view in browser.

### 3. Build & Test PWA Offline Capability
To test service worker cache behaviors locally, you should perform a production build:
```bash
# Build the project
npm run build

# Preview build locally
npm run preview
```
Open the provided preview URL (usually `http://localhost:4173`).
In Chrome DevTools, navigate to the **Application** tab -> **Service Workers** -> Check **Offline** mode, then refresh the browser. The application should load completely and retrieve stored advisories from cache.
