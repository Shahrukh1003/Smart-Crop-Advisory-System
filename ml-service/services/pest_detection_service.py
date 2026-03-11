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

# Common crop pests and diseases with treatments (PlantVillage 38-class)
PEST_DATABASE = {
    # --- Apple ---
    "apple_apple_scab": {
        "severity_threshold": {"low": 0.3, "medium": 0.6},
        "treatments": [
            Treatment(name="Captan Fungicide", description="Apply captan at petal fall", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Myclobutanil", description="Systemic fungicide for scab", application_method="Foliar spray", frequency="Every 10-14 days"),
        ]
    },
    "apple_black_rot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Captan", description="Apply captan fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Remove Mummies", description="Remove mummified fruit and cankers", application_method="Manual removal", frequency="During dormant season"),
        ]
    },
    "apple_cedar_apple_rust": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Myclobutanil", description="Apply systemic fungicide", application_method="Foliar spray", frequency="Every 7-10 days during spring"),
            Treatment(name="Remove Juniper Hosts", description="Remove nearby juniper/cedar trees", application_method="Manual removal", frequency="Once"),
        ]
    },
    "apple_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Blueberry ---
    "blueberry_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Cherry ---
    "cherry_powdery_mildew": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Sulfur Fungicide", description="Apply sulfur-based fungicide", application_method="Dust or spray", frequency="Every 7-10 days"),
            Treatment(name="Neem Oil", description="Apply neem oil as organic alternative", application_method="Foliar spray", frequency="Every 7-14 days"),
        ]
    },
    "cherry_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Corn ---
    "corn_cercospora_leaf_spot_gray_leaf_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Azoxystrobin", description="Apply strobilurin fungicide", application_method="Foliar spray", frequency="At VT/R1 growth stage"),
            Treatment(name="Crop Rotation", description="Rotate with non-host crops", application_method="Cultural practice", frequency="Annually"),
        ]
    },
    "corn_common_rust": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Propiconazole", description="Triazole fungicide", application_method="Foliar spray", frequency="When pustules appear"),
            Treatment(name="Resistant Varieties", description="Plant rust-resistant hybrids", application_method="Cultural practice", frequency="At planting"),
        ]
    },
    "corn_northern_leaf_blight": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Mancozeb", description="Apply mancozeb fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Tillage", description="Bury crop residue to reduce inoculum", application_method="Cultural practice", frequency="Post-harvest"),
        ]
    },
    "corn_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Grape ---
    "grape_black_rot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Mancozeb", description="Apply mancozeb before bloom", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Myclobutanil", description="Apply systemic fungicide", application_method="Foliar spray", frequency="Every 10-14 days"),
        ]
    },
    "grape_esca_(black_measles)": {
        "severity_threshold": {"low": 0.2, "medium": 0.45},
        "treatments": [
            Treatment(name="Wound Protection", description="Apply wound sealant after pruning", application_method="Direct application", frequency="After every pruning cut"),
            Treatment(name="Sodium Arsenite", description="Trunk injection (where legal)", application_method="Injection", frequency="Once per season"),
        ]
    },
    "grape_leaf_blight_(isariopsis_leaf_spot)": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Fungicide", description="Apply copper-based fungicide", application_method="Foliar spray", frequency="Every 7-14 days"),
            Treatment(name="Remove Infected Leaves", description="Remove and destroy infected parts", application_method="Manual removal", frequency="Immediately"),
        ]
    },
    "grape_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Orange ---
    "orange_haunglongbing_(citrus_greening)": {
        "severity_threshold": {"low": 0.2, "medium": 0.4},
        "treatments": [
            Treatment(name="Psyllid Control", description="Apply imidacloprid for Asian citrus psyllid", application_method="Soil drench or foliar", frequency="Every 3-4 months"),
            Treatment(name="Remove Infected Trees", description="Remove and destroy infected trees to prevent spread", application_method="Manual removal", frequency="Immediately upon confirmation"),
        ]
    },
    # --- Peach ---
    "peach_bacterial_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Hydroxide", description="Apply copper-based bactericide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Oxytetracycline", description="Apply antibiotic spray", application_method="Foliar spray", frequency="Every 5-7 days during infection"),
        ]
    },
    "peach_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Pepper ---
    "pepper_bacterial_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Hydroxide", description="Apply copper-based bactericide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Acibenzolar-S-methyl", description="Apply plant defense activator", application_method="Foliar spray", frequency="Every 14 days"),
        ]
    },
    "pepper_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Potato ---
    "potato_early_blight": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Mancozeb", description="Apply mancozeb fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Chlorothalonil", description="Apply chlorothalonil fungicide", application_method="Foliar spray", frequency="Every 7-14 days"),
        ]
    },
    "potato_late_blight": {
        "severity_threshold": {"low": 0.2, "medium": 0.45},
        "treatments": [
            Treatment(name="Metalaxyl", description="Apply metalaxyl-based fungicide", application_method="Foliar spray", frequency="Every 7 days"),
            Treatment(name="Copper Oxychloride", description="Apply copper oxychloride", application_method="Foliar spray", frequency="Every 5-7 days during outbreak"),
        ]
    },
    "potato_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Raspberry, Soybean ---
    "raspberry_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    "soybean_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Squash ---
    "squash_powdery_mildew": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Sulfur Fungicide", description="Apply sulfur-based fungicide", application_method="Dust or spray", frequency="Every 7-10 days"),
            Treatment(name="Potassium Bicarbonate", description="Apply potassium bicarbonate solution", application_method="Foliar spray", frequency="Weekly"),
        ]
    },
    # --- Strawberry ---
    "strawberry_leaf_scorch": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Captan", description="Apply captan fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Remove Infected Leaves", description="Remove and destroy infected foliage", application_method="Manual removal", frequency="Regularly"),
        ]
    },
    "strawberry_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Tomato ---
    "tomato_bacterial_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Hydroxide", description="Apply copper-based bactericide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Streptomycin", description="Apply streptomycin sulfate solution", application_method="Foliar spray", frequency="Every 5-7 days"),
        ]
    },
    "tomato_early_blight": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Mancozeb", description="Apply mancozeb fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Chlorothalonil", description="Apply chlorothalonil fungicide", application_method="Foliar spray", frequency="Every 7-14 days"),
        ]
    },
    "tomato_late_blight": {
        "severity_threshold": {"low": 0.2, "medium": 0.45},
        "treatments": [
            Treatment(name="Metalaxyl", description="Apply metalaxyl-based fungicide", application_method="Foliar spray", frequency="Every 7 days"),
            Treatment(name="Remove Infected Plants", description="Remove and destroy infected plants immediately", application_method="Manual removal", frequency="Immediately"),
        ]
    },
    "tomato_leaf_mold": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Improve Ventilation", description="Increase air circulation in greenhouse", application_method="Cultural practice", frequency="Ongoing"),
            Treatment(name="Chlorothalonil", description="Apply chlorothalonil fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
        ]
    },
    "tomato_septoria_leaf_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Mancozeb", description="Apply mancozeb fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Remove Lower Leaves", description="Remove infected lower leaves", application_method="Manual removal", frequency="Regularly"),
        ]
    },
    "tomato_spider_mites_two_spotted_spider_mite": {
        "severity_threshold": {"low": 0.3, "medium": 0.6},
        "treatments": [
            Treatment(name="Neem Oil", description="Apply neem oil to control mites", application_method="Foliar spray", frequency="Every 5-7 days"),
            Treatment(name="Insecticidal Soap", description="Apply insecticidal soap", application_method="Direct spray", frequency="Every 3-5 days"),
        ]
    },
    "tomato_target_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Chlorothalonil", description="Apply chlorothalonil fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Azoxystrobin", description="Apply strobilurin fungicide", application_method="Foliar spray", frequency="Every 10-14 days"),
        ]
    },
    "tomato_tomato_yellow_leaf_curl_virus": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Imidacloprid", description="Control whitefly vectors with imidacloprid", application_method="Soil drench or foliar spray", frequency="Every 14-21 days"),
            Treatment(name="Remove Infected Plants", description="Remove and destroy infected plants", application_method="Manual removal", frequency="Immediately"),
        ]
    },
    "tomato_tomato_mosaic_virus": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Sanitize Tools", description="Disinfect tools with 10% bleach between plants", application_method="Preventive", frequency="Before each use"),
            Treatment(name="Remove Infected Plants", description="Remove and destroy infected plants", application_method="Manual removal", frequency="Immediately"),
        ]
    },
    "tomato_healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
    # --- Legacy labels (backward compatibility) ---
    "aphids": {
        "severity_threshold": {"low": 0.3, "medium": 0.6},
        "treatments": [
            Treatment(name="Neem Oil Spray", description="Apply neem oil solution", application_method="Foliar spray", frequency="Every 7-10 days"),
            Treatment(name="Insecticidal Soap", description="Use insecticidal soap", application_method="Direct spray", frequency="As needed"),
        ]
    },
    "leaf_blight": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Fungicide", description="Apply copper-based fungicide", application_method="Foliar spray", frequency="Every 7-14 days"),
        ]
    },
    "powdery_mildew": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Sulfur Fungicide", description="Apply sulfur-based fungicide", application_method="Dust or spray", frequency="Every 7-10 days"),
        ]
    },
    "stem_borer": {
        "severity_threshold": {"low": 0.2, "medium": 0.45},
        "treatments": [
            Treatment(name="Carbofuran Granules", description="Apply granules to soil", application_method="Soil application", frequency="At planting"),
        ]
    },
    "bacterial_spot": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Copper Hydroxide", description="Apply copper-based bactericide", application_method="Foliar spray", frequency="Every 7-10 days"),
        ]
    },
    "early_blight": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Mancozeb", description="Apply mancozeb fungicide", application_method="Foliar spray", frequency="Every 7-10 days"),
        ]
    },
    "late_blight": {
        "severity_threshold": {"low": 0.2, "medium": 0.45},
        "treatments": [
            Treatment(name="Metalaxyl", description="Apply metalaxyl-based fungicide", application_method="Foliar spray", frequency="Every 7 days"),
        ]
    },
    "leaf_curl": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Imidacloprid", description="Apply imidacloprid for vector control", application_method="Soil drench or foliar spray", frequency="Every 14-21 days"),
        ]
    },
    "mosaic_virus": {
        "severity_threshold": {"low": 0.3, "medium": 0.55},
        "treatments": [
            Treatment(name="Vector Control", description="Control aphids and whiteflies", application_method="Insecticide spray", frequency="Weekly"),
        ]
    },
    "rust": {
        "severity_threshold": {"low": 0.25, "medium": 0.5},
        "treatments": [
            Treatment(name="Propiconazole", description="Apply propiconazole fungicide", application_method="Foliar spray", frequency="Every 14 days"),
        ]
    },
    "healthy": {"severity_threshold": {"low": 1.0, "medium": 1.0}, "treatments": []},
}

# Default class labels (used when model labels not available)
DEFAULT_CLASS_LABELS = list(PEST_DATABASE.keys())


class PestDetectionService:
    """Service for pest and disease detection from crop images."""
    
    def __init__(self):
        self.model_loader = get_model_loader()
        self._target_size = None  # Set dynamically from model
        self._class_labels = None
    
    @property
    def target_size(self) -> tuple:
        """Get target image size from model config or use default."""
        if self._target_size is None:
            model_info = self.model_loader.get_model_info("pest_detection")
            
            # Try to get size from model metadata first
            if model_info and "image_size" in model_info.metadata:
                self._target_size = tuple(model_info.metadata["image_size"])
            
            # If not in metadata, try to extract from Keras model directly
            if self._target_size is None and model_info and model_info.model is not None:
                try:
                    # Keras models have input_shape property
                    shape = model_info.model.input_shape
                    # Handle case where input_shape is a list (nested models)
                    if isinstance(shape, list): shape = shape[0]
                    # MobileNet usually has (None, height, width, 3)
                    if len(shape) == 4:
                        self._target_size = (shape[1], shape[2])
                except Exception as e:
                    logger.warning(f"Could not extract input shape from model: {e}")
            
            # Final fallback to standard size
            if self._target_size is None:
                self._target_size = (224, 224)
                
            logger.info(f"Target image size determined: {self._target_size}")
        return self._target_size
    
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
        """Preprocess image for model inference with error handling."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize to target size
            target = self.target_size
            if not isinstance(target, tuple) or len(target) != 2:
                logger.warning(f"Invalid target size {target}, falling back to (224, 224)")
                target = (224, 224)
                
            image = image.resize(target, Image.Resampling.LANCZOS)
            
            # Convert to numpy array 
            # Note: The active Keras model expects MobileNetV2 style [-1, 1] normalization
            img_array = np.array(image, dtype=np.float32)
            img_array = (img_array / 127.5) - 1.0  # Scale to [-1, 1]
            
            # Add batch dimension
            img_array = np.expand_dims(img_array, axis=0)
            
            return img_array
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            raise ValueError(f"Invalid image format or corrupted data: {e}")
    
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
                    
                    # Sklearn model features expect [0, 1] normalization
                    # Convert [-1, 1] back to [0, 1]
                    normalized_image = (preprocessed_image + 1.0) / 2.0
                    
                    # Extract features for sklearn model
                    features = self._extract_sklearn_features(normalized_image)
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
                    # Using calling syntax with training=False is much faster than .predict() for single images
                    predictions = model_data(preprocessed_image, training=False)
                    predictions = predictions.numpy() if hasattr(predictions, 'numpy') else np.array(predictions)
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
                import traceback
                logger.error(traceback.format_exc())
                return []
        return []
    
    def _run_fallback_detection(self, preprocessed_image: np.ndarray) -> List[Tuple[str, float]]:
        """Fallback detection using simple image analysis."""
        # Convert [-1, 1] back to [0, 1]
        img = (preprocessed_image[0] + 1.0) / 2.0
        
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
        
        try:
            # Preprocess image
            preprocessed = self.preprocess_image(image_bytes)
            
            # Try model inference first
            model_info = self.model_loader.get_model_info("pest_detection")
            model_version = model_info.version if model_info else "fallback"
            is_fallback = False
            fallback_disclaimer = None
            
            predictions = self._run_model_inference(preprocessed)
            
        except ValueError as e:
            # Return a clear error response if preprocessing fails
            processing_time = (time.time() - start_time) * 1000
            error_det = PestDetection(
                pest_or_disease="Error: Invalid Image",
                confidence=1.0,
                severity=Severity.LOW,
                treatments=[Treatment(name="Upload Error", description=str(e), application_method="System", frequency="N/A")]
            )
            return PestDetectionResponse(
                detection_id=detection_id,
                detections=[error_det],
                processing_time_ms=round(processing_time, 2),
                model_version="error",
                is_fallback=True,
                fallback_disclaimer="Image preprocessing failed."
            )
        
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
