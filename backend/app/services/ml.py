"""
Weather Prediction ML Service using TabPFN v2 Tiny model.

This model is an in-context learner that uses historical weather data
as context to predict weather conditions for new GPS locations.

Input features (per data point):
  - latitude, longitude (GPS coordinates)
  - day_of_year_sin, day_of_year_cos (seasonality encoding)
  - hour_sin, hour_cos (time-of-day encoding)
  - month (1-12)

Output (classification):
  - Weather condition class (Clear, Cloudy, Rainy, Stormy, etc.)

The model uses in-context learning: we provide historical weather observations
as "training context" and new GPS+time as "query" to get predictions.
"""

import os
import io
import math
import json
import logging
from datetime import datetime

logger = logging.getLogger("ml_service")
logger.setLevel(logging.INFO)

# Optional imports - fallback to mock if dependencies are missing
try:
    import torch
    import numpy as np
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("torch/numpy not installed. Running in MOCK ML mode.")


# Weather condition classes for fishermen
WEATHER_CLASSES = {
    0: "Clear Skies",
    1: "Partly Cloudy",
    2: "Overcast",
    3: "Light Rain",
    4: "Heavy Rain",
    5: "Thunderstorm",
    6: "Cyclonic / Storm",
    7: "Foggy / Low Visibility",
    8: "High Winds",
    9: "Extreme Weather"
}

# Safety level mapping for each weather class
SAFETY_LEVELS = {
    0: {"level": "safe",    "color": "green",  "advice": "Good conditions for fishing. Enjoy your trip!"},
    1: {"level": "safe",    "color": "green",  "advice": "Mostly safe. Keep an eye on weather changes."},
    2: {"level": "caution", "color": "yellow", "advice": "Overcast skies. Be prepared for potential rain."},
    3: {"level": "caution", "color": "yellow", "advice": "Light rain expected. Wear waterproof gear."},
    4: {"level": "warning", "color": "orange", "advice": "Heavy rain incoming. Consider returning to shore."},
    5: {"level": "danger",  "color": "red",    "advice": "Thunderstorm warning! Return to port immediately."},
    6: {"level": "danger",  "color": "red",    "advice": "CYCLONE ALERT! Do NOT venture out. Seek shelter."},
    7: {"level": "caution", "color": "yellow", "advice": "Low visibility. Use navigation aids and stay cautious."},
    8: {"level": "warning", "color": "orange", "advice": "High winds detected. Small boats should stay ashore."},
    9: {"level": "danger",  "color": "red",    "advice": "EXTREME WEATHER! Stay on land. Follow local authorities."},
}

# Historical weather context data for Indian coastal regions
# This serves as the "training set" for the in-context learning model
COASTAL_WEATHER_CONTEXT = [
    # [lat, lon, day_sin, day_cos, hour_sin, hour_cos, month] -> class
    # Mumbai coast - monsoon patterns
    {"lat": 19.08, "lon": 72.88, "month": 6, "class": 4},  # Heavy Rain (monsoon)
    {"lat": 19.08, "lon": 72.88, "month": 1, "class": 0},  # Clear (winter)
    {"lat": 19.08, "lon": 72.88, "month": 7, "class": 5},  # Thunderstorm
    {"lat": 19.08, "lon": 72.88, "month": 11, "class": 1}, # Partly Cloudy
    # Chennai coast
    {"lat": 13.08, "lon": 80.27, "month": 10, "class": 4}, # Heavy Rain (NE monsoon)
    {"lat": 13.08, "lon": 80.27, "month": 3, "class": 0},  # Clear
    {"lat": 13.08, "lon": 80.27, "month": 11, "class": 5}, # Thunderstorm
    {"lat": 13.08, "lon": 80.27, "month": 5, "class": 8},  # High Winds
    # Kochi coast
    {"lat": 9.97, "lon": 76.27, "month": 6, "class": 4},   # Heavy Rain
    {"lat": 9.97, "lon": 76.27, "month": 2, "class": 0},   # Clear
    {"lat": 9.97, "lon": 76.27, "month": 7, "class": 3},   # Light Rain
    {"lat": 9.97, "lon": 76.27, "month": 12, "class": 1},  # Partly Cloudy
    # Visakhapatnam coast
    {"lat": 17.69, "lon": 83.22, "month": 10, "class": 6}, # Cyclonic (cyclone season)
    {"lat": 17.69, "lon": 83.22, "month": 4, "class": 0},  # Clear
    {"lat": 17.69, "lon": 83.22, "month": 8, "class": 3},  # Light Rain
    {"lat": 17.69, "lon": 83.22, "month": 11, "class": 5}, # Thunderstorm
    # Goa coast
    {"lat": 15.50, "lon": 73.83, "month": 6, "class": 4},  # Heavy Rain
    {"lat": 15.50, "lon": 73.83, "month": 12, "class": 0}, # Clear
    {"lat": 15.50, "lon": 73.83, "month": 7, "class": 5},  # Thunderstorm
    {"lat": 15.50, "lon": 73.83, "month": 3, "class": 1},  # Partly Cloudy
    # Kolkata coast
    {"lat": 22.57, "lon": 88.36, "month": 5, "class": 5},  # Thunderstorm (nor'wester)
    {"lat": 22.57, "lon": 88.36, "month": 10, "class": 6}, # Cyclonic
    {"lat": 22.57, "lon": 88.36, "month": 1, "class": 7},  # Foggy
    {"lat": 22.57, "lon": 88.36, "month": 3, "class": 0},  # Clear
    # Tuticorin coast
    {"lat": 8.76, "lon": 78.13, "month": 11, "class": 4},  # Heavy Rain
    {"lat": 8.76, "lon": 78.13, "month": 2, "class": 0},   # Clear
    {"lat": 8.76, "lon": 78.13, "month": 6, "class": 8},   # High Winds
    {"lat": 8.76, "lon": 78.13, "month": 4, "class": 1},   # Partly Cloudy
    # Mangalore coast
    {"lat": 12.87, "lon": 74.88, "month": 7, "class": 4},  # Heavy Rain
    {"lat": 12.87, "lon": 74.88, "month": 1, "class": 0},  # Clear
    {"lat": 12.87, "lon": 74.88, "month": 9, "class": 3},  # Light Rain
    {"lat": 12.87, "lon": 74.88, "month": 5, "class": 2},  # Overcast
]


def encode_time_features(month, hour=12):
    """Encode cyclical time features using sin/cos."""
    day_of_year = (month - 1) * 30 + 15  # approximate mid-month
    day_sin = math.sin(2 * math.pi * day_of_year / 365)
    day_cos = math.cos(2 * math.pi * day_of_year / 365)
    hour_sin = math.sin(2 * math.pi * hour / 24)
    hour_cos = math.cos(2 * math.pi * hour / 24)
    return day_sin, day_cos, hour_sin, hour_cos


def build_feature_vector(lat, lon, month, hour=12):
    """Build a normalized feature vector for the model."""
    day_sin, day_cos, hour_sin, hour_cos = encode_time_features(month, hour)
    return [
        lat / 90.0,       # normalize latitude
        lon / 180.0,      # normalize longitude
        day_sin,
        day_cos,
        hour_sin,
        hour_cos,
        month / 12.0      # normalize month
    ]


class MLModelService:
    def __init__(self):
        self.model = None
        self.use_mock = not TORCH_AVAILABLE
        self.device = None
        self.context_x = None
        self.context_y = None

    def load_model(self):
        if self.use_mock:
            logger.info("ML Service initialized in MOCK mode (torch not installed).")
            self._prepare_context_data()
            return

        model_path = os.path.join(os.path.dirname(__file__), "..", "ml", "v11_06_tiny_final.pt")

        if not os.path.exists(model_path):
            logger.warning(f"Model weights not found at {model_path}. Using MOCK predictions.")
            self.use_mock = True
            self._prepare_context_data()
            return

        try:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            
            # Load checkpoint
            ckpt = torch.load(model_path, map_location=self.device, weights_only=False)
            self.model_cfg = ckpt.get('cfg', {})
            self.model_state = ckpt.get('model', {})
            self.model_step = ckpt.get('step', 0)

            logger.info(f"TabPFN v2 Tiny model checkpoint loaded (step={self.model_step}, device={self.device})")
            logger.info(f"Config: d_model={self.model_cfg.get('d_model')}, "
                        f"max_features={self.model_cfg.get('max_features')}, "
                        f"max_classes={self.model_cfg.get('max_classes')}")

            # Try loading with tabpfn library if available
            try:
                from tabpfn import TabPFNClassifier
                self.classifier = TabPFNClassifier(
                    model_path=model_path,
                    device=str(self.device),
                    n_estimators='auto',
                    ignore_pretraining_limits=True
                )
                self.use_mock = False
                logger.info("TabPFN classifier initialized with tabpfn library.")
            except (ImportError, Exception) as e:
                logger.warning(f"tabpfn library not available or incompatible ({e}). Using heuristic fallback.")
                self.use_mock = True

            self._prepare_context_data()

        except Exception as e:
            logger.error(f"Error loading model: {e}. Falling back to MOCK mode.")
            self.use_mock = True
            self._prepare_context_data()

    def _prepare_context_data(self):
        """Prepare the historical weather context data for predictions."""
        self.context_data = COASTAL_WEATHER_CONTEXT

        if TORCH_AVAILABLE:
            features = []
            labels = []
            for entry in COASTAL_WEATHER_CONTEXT:
                feat = build_feature_vector(entry["lat"], entry["lon"], entry["month"])
                features.append(feat)
                labels.append(entry["class"])

            self.context_x = np.array(features, dtype=np.float32)
            self.context_y = np.array(labels, dtype=np.int64)

    def predict_weather(self, latitude: float, longitude: float, timestamp: str = None) -> dict:
        """
        Predict weather conditions for a given GPS location and time.
        
        Args:
            latitude: GPS latitude
            longitude: GPS longitude
            timestamp: ISO format timestamp (optional, defaults to current time)
        
        Returns:
            Dictionary with weather prediction, safety level, and confidence
        """
        # Parse timestamp
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except ValueError:
                dt = datetime.now()
        else:
            dt = datetime.now()

        month = dt.month
        hour = dt.hour

        # Build query features
        query_features = build_feature_vector(latitude, longitude, month, hour)

        if not self.use_mock and hasattr(self, 'classifier'):
            try:
                query_x = np.array([query_features], dtype=np.float32)
                pred_proba = self.classifier.predict_proba(query_x)
                pred_class = int(np.argmax(pred_proba[0]))
                confidence = float(np.max(pred_proba[0]))
                mode = "production"
            except Exception as e:
                logger.error(f"TabPFN inference error: {e}. Falling back to heuristic.")
                pred_class, confidence = self._heuristic_predict(latitude, longitude, month, hour)
                mode = "heuristic"
        else:
            pred_class, confidence = self._heuristic_predict(latitude, longitude, month, hour)
            mode = "heuristic"

        weather_label = WEATHER_CLASSES.get(pred_class, "Unknown")
        safety = SAFETY_LEVELS.get(pred_class, SAFETY_LEVELS[0])

        return {
            "prediction": {
                "class_index": pred_class,
                "weather": weather_label,
                "confidence": round(confidence, 3),
            },
            "safety": {
                "level": safety["level"],
                "color": safety["color"],
                "advice": safety["advice"],
            },
            "input": {
                "latitude": latitude,
                "longitude": longitude,
                "month": month,
                "hour": hour,
                "timestamp": dt.isoformat(),
            },
            "mode": mode,
            "model_info": {
                "name": "TabPFN v2 Tiny (Weather Predictor)",
                "step": getattr(self, 'model_step', 0),
                "classes": WEATHER_CLASSES,
            }
        }

    def _heuristic_predict(self, lat, lon, month, hour):
        """
        Smart heuristic prediction based on Indian coastal weather patterns.
        Uses nearest-neighbor matching against historical context data.
        """
        best_class = 0
        best_dist = float('inf')

        for entry in self.context_data:
            # Weighted distance: location matters more than time
            dist = (
                3.0 * ((lat - entry["lat"]) ** 2 + (lon - entry["lon"]) ** 2) +
                1.0 * ((month - entry["month"]) ** 2)
            )
            if dist < best_dist:
                best_dist = dist
                best_class = entry["class"]

        # Confidence based on distance (closer = higher confidence)
        confidence = max(0.45, min(0.95, 1.0 / (1.0 + best_dist * 0.1)))

        # Seasonal adjustments for Indian coastal regions
        # June-September: Southwest monsoon
        if 6 <= month <= 9 and 8 <= lat <= 23 and 72 <= lon <= 88:
            if best_class in (0, 1):
                best_class = 3  # Bump to at least Light Rain during monsoon
                confidence = max(confidence, 0.7)

        # October-November: Cyclone season on east coast
        if month in (10, 11) and lat < 20 and lon > 78:
            if best_class in (0, 1, 2):
                best_class = 4  # Heavy Rain likely
                confidence = max(confidence, 0.65)

        # Night hours: fog more likely in winter
        if (hour < 6 or hour > 22) and month in (11, 12, 1, 2):
            if best_class == 0:
                best_class = 7  # Foggy
                confidence = 0.55

        return best_class, confidence


ml_service = MLModelService()
