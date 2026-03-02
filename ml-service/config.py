"""Configuration settings for the ML service."""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Model paths
    model_dir: str = os.path.join(os.path.dirname(__file__), "models")
    pest_detection_model_path: Optional[str] = None
    crop_recommendation_model_path: Optional[str] = None
    
    # Model versions
    pest_detection_model_version: str = "1.0.0"
    crop_recommendation_model_version: str = "1.0.0"
    
    # Inference settings
    pest_detection_confidence_threshold: float = 0.5
    max_image_size_mb: int = 10
    
    # Fallback settings
    use_fallback_on_model_failure: bool = True
    
    class Config:
        env_file = ".env"
        env_prefix = "ML_"


settings = Settings()
