"""Model loading infrastructure for ML service."""
import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"


class ModelInfo:
    """Information about a loaded model."""
    
    def __init__(self, name: str, version: str, loaded_at: datetime):
        self.name = name
        self.version = version
        self.loaded_at = loaded_at
        self.model = None
        self.metadata = {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "loaded_at": self.loaded_at.isoformat(),
            "is_loaded": self.model is not None,
            "metadata": self.metadata
        }


class ModelLoader:
    """Handles loading and managing ML models."""
    
    def __init__(self, model_dir: str = None):
        self.model_dir = Path(model_dir) if model_dir else MODELS_DIR
        self._models: Dict[str, ModelInfo] = {}
        self._pest_labels: Dict[int, str] = {}
        self._crop_labels: List[str] = []
        self._ensure_model_dir()
    
    def _ensure_model_dir(self):
        """Ensure the model directory exists."""
        if not self.model_dir.exists():
            self.model_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created model directory: {self.model_dir}")
    
    def load_pest_detection_model(self, version: str = "1.0.0") -> Optional[Any]:
        """Load the pest detection model (sklearn or TensorFlow)."""
        model_name = "pest_detection"
        pkl_path = self.model_dir / "pest_detection_model.pkl"
        h5_path = self.model_dir / "pest_detection_model.h5"
        labels_path = self.model_dir / "pest_detection_labels.json"
        metrics_path = self.model_dir / "pest_detection_metrics.json"
        
        model_info = ModelInfo(model_name, version, datetime.utcnow())
        
        # Try sklearn model first (pkl format)
        if pkl_path.exists():
            try:
                import joblib
                model = joblib.load(pkl_path)
                
                # Check if this .pkl is a wrapper pointing to a Keras (.h5) model
                if isinstance(model, dict) and model.get('model_type') == 'keras':
                    h5_model_path = self.model_dir / "pest_detection_model.h5"
                    if h5_model_path.exists():
                        try:
                            import tensorflow as tf
                            keras_model = tf.keras.models.load_model(str(h5_model_path))
                            model_info.model = keras_model
                            logger.info(f"✅ Loaded pest detection model (Keras via wrapper) from {h5_model_path}")
                        except Exception as e:
                            logger.warning(f"⚠️ Failed to load Keras model from wrapper: {e}")
                            model_info.model = None
                    else:
                        logger.warning(f"⚠️ Keras wrapper found but .h5 file missing")
                        model_info.model = None
                    
                    # Load class info from wrapper
                    if 'classes' in model:
                        self._pest_labels = {i: name for i, name in enumerate(model['classes'])}
                        model_info.metadata["num_classes"] = len(model['classes'])
                        model_info.metadata["classes"] = model['classes']
                        model_info.metadata["image_size"] = model.get('image_size', (224, 224))
                        model_info.metadata["model_type"] = model.get('feature_extractor', "MobileNetV2_TransferLearning")
                        logger.info(f"  Loaded {len(self._pest_labels)} pest classes from Keras wrapper")
                else:
                    # Standard sklearn model
                    model_info.model = model
                    logger.info(f"✅ Loaded pest detection model (sklearn) from {pkl_path}")
                    
                    if isinstance(model, dict) and 'classes' in model:
                        self._pest_labels = {i: name for i, name in enumerate(model['classes'])}
                        model_info.metadata["num_classes"] = len(model['classes'])
                        model_info.metadata["classes"] = model['classes']
                        model_info.metadata["model_type"] = model.get('feature_extractor', 'sklearn')
                        logger.info(f"  Loaded {len(self._pest_labels)} pest classes")
                
            except Exception as e:
                logger.warning(f"⚠️ Failed to load pest detection model: {e}")
                model_info.model = None
        
        # Try TensorFlow model if sklearn not found
        elif h5_path.exists():
            try:
                import tensorflow as tf
                model = tf.keras.models.load_model(str(h5_path))
                model_info.model = model
                logger.info(f"✅ Loaded pest detection model (TensorFlow) from {h5_path}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to load TensorFlow pest detection model: {e}")
                model_info.model = None
        else:
            logger.info(f"ℹ️ Pest detection model not found, using fallback")
            model_info.model = None
        
        # Load labels from JSON if not loaded from model
        if labels_path.exists() and not self._pest_labels:
            try:
                with open(labels_path, 'r') as f:
                    labels_data = json.load(f)
                    self._pest_labels = {int(k): v for k, v in labels_data.get("index_to_class", {}).items()}
                    model_info.metadata["num_classes"] = labels_data.get("num_classes", 0)
                    model_info.metadata["classes"] = list(self._pest_labels.values())
                    logger.info(f"  Loaded {len(self._pest_labels)} pest classes from labels file")
            except Exception as e:
                logger.warning(f"Failed to load labels: {e}")
        
        # Load metrics
        if metrics_path.exists():
            try:
                with open(metrics_path, 'r') as f:
                    metrics_data = json.load(f)
                    model_info.metadata["test_accuracy"] = metrics_data.get("test_metrics", {}).get("accuracy", 0)
                    model_info.metadata["trained_at"] = metrics_data.get("trained_at", "")
            except Exception as e:
                logger.warning(f"Failed to load metrics: {e}")
        
        self._models[model_name] = model_info
        return model_info.model

    
    def load_crop_recommendation_model(self, version: str = "1.0.0") -> Optional[Any]:
        """Load the crop recommendation ensemble model."""
        model_name = "crop_recommendation"
        model_path = self.model_dir / "crop_recommendation_model.pkl"
        metadata_path = self.model_dir / "crop_recommendation_metadata.json"
        
        model_info = ModelInfo(model_name, version, datetime.utcnow())
        
        if model_path.exists():
            try:
                import joblib
                model = joblib.load(model_path)
                model_info.model = model
                logger.info(f"✅ Loaded crop recommendation model from {model_path}")
                
                # Get classes from model if available
                if isinstance(model, dict) and 'classes' in model:
                    self._crop_labels = model['classes']
                    model_info.metadata["num_classes"] = len(model['classes'])
                    model_info.metadata["classes"] = model['classes']
                    logger.info(f"  Loaded {len(self._crop_labels)} crop classes from model")
                
                # Load additional metadata
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                        if not self._crop_labels:
                            self._crop_labels = metadata.get("classes", [])
                            model_info.metadata["num_classes"] = metadata.get("num_classes", 0)
                            model_info.metadata["classes"] = self._crop_labels
                        model_info.metadata["test_accuracy"] = metadata.get("metrics", {}).get("test_accuracy", 0)
                        model_info.metadata["feature_columns"] = metadata.get("feature_columns", [])
                        model_info.metadata["trained_at"] = metadata.get("trained_at", "")
                
            except Exception as e:
                logger.warning(f"⚠️ Failed to load crop recommendation model: {e}")
                model_info.model = None
        else:
            logger.info(f"ℹ️ Crop recommendation model not found at {model_path}, using fallback")
            model_info.model = None
        
        self._models[model_name] = model_info
        return model_info.model
    
    def get_model(self, name: str) -> Optional[Any]:
        """Get a loaded model by name."""
        model_info = self._models.get(name)
        return model_info.model if model_info else None
    
    def get_model_info(self, name: str) -> Optional[ModelInfo]:
        """Get model info by name."""
        return self._models.get(name)
    
    def get_all_model_info(self) -> Dict[str, Dict[str, Any]]:
        """Get info for all models."""
        return {name: info.to_dict() for name, info in self._models.items()}
    
    def is_model_loaded(self, name: str) -> bool:
        """Check if a model is loaded."""
        model_info = self._models.get(name)
        return model_info is not None and model_info.model is not None
    
    def get_pest_label(self, index: int) -> str:
        """Get pest class name from index."""
        return self._pest_labels.get(index, f"unknown_{index}")
    
    def get_pest_labels(self) -> Dict[int, str]:
        """Get all pest labels."""
        return self._pest_labels
    
    def get_crop_labels(self) -> List[str]:
        """Get all crop labels."""
        return self._crop_labels


# Global model loader instance
_model_loader: Optional[ModelLoader] = None


def get_model_loader() -> ModelLoader:
    """Get the global model loader instance."""
    global _model_loader
    if _model_loader is None:
        from config import settings
        _model_loader = ModelLoader(settings.model_dir)
    return _model_loader


def initialize_models():
    """Initialize all models on startup."""
    from config import settings
    loader = get_model_loader()
    
    logger.info("Initializing ML models...")
    logger.info(f"Model directory: {loader.model_dir}")
    
    loader.load_pest_detection_model(settings.pest_detection_model_version)
    loader.load_crop_recommendation_model(settings.crop_recommendation_model_version)
    
    logger.info("Model initialization complete")
    
    return loader.get_all_model_info()
