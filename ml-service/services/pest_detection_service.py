"""Pest detection service with image preprocessing and inference."""
import io
import uuid
import time
import logging
import numpy as np
from PIL import Image
from typing import List, Optional, Tuple

from schemas import (
    PestDetection, PestDetectionResponse, Severity, 
    Treatment, BoundingBox
)
from model_loader import get_model_loader
from config import settings

logger = logging.getLogger(__name__)

# Common crop pests and diseases with treatments
PEST_DATABASE = {
    "aphids": {
        "severity_threshold": {"low": 0.3, "medium": 0.6},
        "treatments": [
            Treatment(name="Neem Oil Spray", description="Apply neem oil solution to affected areas", 
                     application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Insecticidal Soap", description="Use insecticidal soap for immediate control",
                     application_method="Direct spray on insects", frequency="As needed")
        ]
    },
    "leaf_blight": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Fungicide", description="Apply copper-based fungicide",
                     application_method="Foliar spray", frequency="Every 7-14 days"),
            Treatment(name="Remove Infected Leaves", description="Remove and destroy infected plant parts",
                     application_method="Manual removal", frequency="Immediately upon detection")
        ]
    },
    "powdery_mildew": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Sulfur Fungicide", description="Apply sulfur-based fungicide",
                     application_method="Dust or spray", frequency="Every 7-10 days"),
            Treatment(name="Baking Soda Solution", description="Mix 1 tbsp baking soda per gallon of water",
                     application_method="Foliar spray", frequency="Weekly")
        ]
    },
    "stem_borer": {
        "severity_threshold": {"low": 0.2, "medium": 0.45},
        "treatments": [
            Treatment(name="Carbofuran Granules", description="Apply granules to soil around plant base",
                     application_method="Soil application", frequency="At planting and 30 days after"),
            Treatment(name="Trichogramma Release", description="Release egg parasitoids for biological control",
                     application_method="Field release", frequency="2-3 releases per season")
        ]
    },
    "bacterial_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Hydroxide", description="Apply copper-based bactericide",
                     application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Streptomycin", description="Apply streptomycin sulfate solution",
                     application_method="Foliar spray", frequency="Every 5-7 days during infection")
        ]
    },
    "early_blight": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Mancozeb", description="Apply mancozeb fungicide",
                     application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Chlorothalonil", description="Apply chlorothalonil fungicide",
                     application_method="Foliar spray", frequency="Every 7-14 days")
        ]
    },
    "late_blight": {
        "severity_threshold": {"low": 0.2, "medium": 0.45},
        "treatments": [
            Treatment(name="Metalaxyl", description="Apply metalaxyl-based fungicide",
                     application_method="Foliar spray", frequency="Every 7 days"),
            Treatment(name="Copper Oxychloride", description="Apply copper oxychloride",
                     application_method="Foliar spray", frequency="Every 5-7 days during outbreak")
        ]
    },
    "leaf_curl": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Imidacloprid", description="Apply imidacloprid for vector control",
                     application_method="Soil drench or foliar spray", frequency="Every 14-21 days"),
            Treatment(name="Remove Infected Plants", description="Remove and destroy severely infected plants",
                     application_method="Manual removal", frequency="As needed")
        ]
    },
    "mosaic_virus": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Vector Control", description="Control aphids and whiteflies that spread virus",
                     application_method="Insecticide spray", frequency="Weekly during infestation"),
            Treatment(name="Remove Infected Plants", description="Remove and destroy infected plants",
                     application_method="Manual removal", frequency="Immediately upon detection")
        ]
    },
    "rust": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Propiconazole", description="Apply propiconazole fungicide",
                     application_method="Foliar spray", frequency="Every 14 days"),
            Treatment(name="Tebuconazole", description="Apply tebuconazole fungicide",
                     application_method="Foliar spray", frequency="Every 14-21 days")
        ]
    },
    "healthy": {
        "severity_threshold": {"low": 1.0, "medium": 1.0},
        "treatments": []
    }
}

# Default class labels (used when model labels not available)
DEFAULT_CLASS_LABELS = list(PEST_DATABASE.keys())


class PestDetectionService:
    """Service for pest and disease detection from crop images."""
    
    def __init__(self):
        self.model_loader = get_model_loader()
        self.target_size = (224, 224)  # MobileNetV2 input size
        self._class_labels = None
    
    @property
    def class_labels(self) -> List[str]:
        """Get class labels from model or use defaults."""
        if self._class_labels is None:
            labels = self.model_loader.get_pest_labels()
            if labels:
                self._class_labels = [labels[i] for i in sorted(labels.keys())]
            else:
                self._class_labels = DEFAULT_CLASS_LABELS
        return self._class_labels
    
    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        """Preprocess image for model inference."""
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize to target size
        image = image.resize(self.target_size, Image.Resampling.LANCZOS)
        
        # Convert to numpy array and normalize
        img_array = np.array(image, dtype=np.float32)
        img_array = img_array / 255.0  # Normalize to [0, 1]
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    
    def _get_severity(self, confidence: float, pest_type: str) -> Severity:
        """Determine severity based on confidence and pest type."""
        thresholds = PEST_DATABASE.get(pest_type, {}).get(
            "severity_threshold", {"low": 0.3, "medium": 0.6}
        )
        
        if confidence < thresholds["low"]:
            return Severity.LOW
        elif confidence < thresholds["medium"]:
            return Severity.MEDIUM
        else:
            return Severity.HIGH
    
    def _get_treatments(self, pest_type: str) -> List[Treatment]:
        """Get treatments for a pest type."""
        return PEST_DATABASE.get(pest_type, {}).get("treatments", [])
    
    def _extract_sklearn_features(self, preprocessed_image: np.ndarray) -> np.ndarray:
        """Extract features for sklearn model."""
        img = preprocessed_image[0]  # Remove batch dimension
        
        features = []
        
        # Color histogram features (per channel)
        for c in range(3):
            channel = img[:, :, c]
            hist, _ = np.histogram(channel, bins=16, range=(0, 1))
            features.extend(hist / (hist.sum() + 1e-6))
        
        # Statistical features per channel
        for c in range(3):
            channel = img[:, :, c]
            features.extend([
                np.mean(channel),
                np.std(channel),
                np.min(channel),
                np.max(channel),
                np.median(channel)
            ])
        
        # Texture features
        gray = np.mean(img, axis=2)
        gx = np.gradient(gray, axis=0)
        gy = np.gradient(gray, axis=1)
        features.extend([
            np.mean(np.abs(gx)),
            np.mean(np.abs(gy)),
            np.std(gx),
            np.std(gy)
        ])
        
        # Color ratios
        r, g, b = img[:, :, 0], img[:, :, 1], img[:, :, 2]
        total = r + g + b + 1e-6
        features.extend([
            np.mean(r / total),
            np.mean(g / total),
            np.mean(b / total),
        ])
        
        return np.array([features])
    
    def _run_model_inference(self, preprocessed_image: np.ndarray) -> List[Tuple[str, float]]:
        """Run inference using the loaded model."""
        model_data = self.model_loader.get_model("pest_detection")
        
        if model_data is not None:
            try:
                # Handle sklearn model (dictionary format)
                if isinstance(model_data, dict):
                    model = model_data['model']
                    scaler = model_data['scaler']
                    classes = model_data.get('classes', [])
                    
                    # Extract features for sklearn model
                    features = self._extract_sklearn_features(preprocessed_image)
                    features_scaled = scaler.transform(features)
                    
                    # Get probabilities
                    proba = model.predict_proba(features_scaled)
                    
                    # Get top predictions
                    top_indices = np.argsort(proba[0])[::-1][:5]
                    results = []
                    
                    for idx in top_indices:
                        confidence = float(proba[0][idx])
                        if confidence >= settings.pest_detection_confidence_threshold:
                            label = classes[idx] if idx < len(classes) else f"class_{idx}"
                            results.append((label, confidence))
                    
                    logger.info(f"Model inference results: {results}")
                    return results
                
                # Handle TensorFlow/Keras model
                else:
                    predictions = model_data.predict(preprocessed_image, verbose=0)
                    top_indices = np.argsort(predictions[0])[::-1][:5]
                    results = []
                    
                    for idx in top_indices:
                        confidence = float(predictions[0][idx])
                        if confidence >= settings.pest_detection_confidence_threshold:
                            label = self.model_loader.get_pest_label(idx)
                            if label.startswith("unknown_") and idx < len(self.class_labels):
                                label = self.class_labels[idx]
                            results.append((label, confidence))
                    
                    logger.info(f"Model inference results: {results}")
                    return results
                
            except Exception as e:
                logger.error(f"Model inference failed: {e}")
                return []
        return []
    
    def _run_fallback_detection(self, preprocessed_image: np.ndarray) -> List[Tuple[str, float]]:
        """Fallback detection using simple image analysis."""
        img = preprocessed_image[0]  # Remove batch dimension
        
        # Calculate mean color values
        mean_colors = np.mean(img, axis=(0, 1))
        green_ratio = mean_colors[1] / (np.sum(mean_colors) + 1e-6)
        brown_ratio = (mean_colors[0] + mean_colors[1] * 0.5) / (np.sum(mean_colors) + 1e-6)
        
        # Calculate color variance (indicates disease spots)
        color_variance = np.var(img)
        
        # Simple rule-based detection
        if green_ratio > 0.4 and color_variance < 0.02:
            return [("healthy", 0.75)]
        elif brown_ratio > 0.4:
            return [("leaf_blight", 0.55), ("early_blight", 0.35)]
        elif green_ratio < 0.25:
            return [("late_blight", 0.50), ("bacterial_spot", 0.35)]
        elif color_variance > 0.03:
            return [("mosaic_virus", 0.45), ("rust", 0.35)]
        else:
            return [("aphids", 0.45), ("powdery_mildew", 0.35)]
    
    async def detect_pests(
        self, 
        image_bytes: bytes, 
        crop_type: Optional[str] = None
    ) -> PestDetectionResponse:
        """Detect pests and diseases in a crop image."""
        start_time = time.time()
        detection_id = str(uuid.uuid4())
        
        # Preprocess image
        preprocessed = self.preprocess_image(image_bytes)
        
        # Try model inference first
        model_info = self.model_loader.get_model_info("pest_detection")
        model_version = model_info.version if model_info else "fallback"
        is_fallback = False
        fallback_disclaimer = None
        
        predictions = self._run_model_inference(preprocessed)
        
        if not predictions:
            # Fall back to rule-based detection
            is_fallback = True
            fallback_disclaimer = "Using simplified detection. Results may be less accurate."
            predictions = self._run_fallback_detection(preprocessed)
            model_version = "rule-based-1.0.0"
        else:
            # Update version from model metadata
            if model_info and model_info.metadata.get("trained_at"):
                model_version = f"trained-{model_info.version}"
        
        # Build detection results
        detections = []
        for pest_type, confidence in predictions:
            if pest_type == "healthy":
                continue  # Don't report healthy as a detection
            
            detection = PestDetection(
                pest_or_disease=pest_type,
                confidence=round(confidence, 4),
                severity=self._get_severity(confidence, pest_type),
                treatments=self._get_treatments(pest_type)
            )
            detections.append(detection)
        
        processing_time = (time.time() - start_time) * 1000
        
        return PestDetectionResponse(
            detection_id=detection_id,
            detections=detections,
            processing_time_ms=round(processing_time, 2),
            model_version=model_version,
            is_fallback=is_fallback,
            fallback_disclaimer=fallback_disclaimer
        )


# Singleton instance
_pest_detection_service: Optional[PestDetectionService] = None


def get_pest_detection_service() -> PestDetectionService:
    """Get the pest detection service instance."""
    global _pest_detection_service
    if _pest_detection_service is None:
        _pest_detection_service = PestDetectionService()
    return _pest_detection_service
