"""Pydantic schemas for API requests and responses."""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from enum import Enum


class Severity(str, Enum):
    """Severity levels for pest/disease detection."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class BoundingBox(BaseModel):
    """Bounding box for detected pest/disease."""
    x: float = Field(..., ge=0, description="X coordinate")
    y: float = Field(..., ge=0, description="Y coordinate")
    width: float = Field(..., gt=0, description="Width")
    height: float = Field(..., gt=0, description="Height")


class Treatment(BaseModel):
    """Treatment recommendation for detected pest/disease."""
    name: str
    description: str
    application_method: Optional[str] = None
    frequency: Optional[str] = None


class PestDetection(BaseModel):
    """Single pest/disease detection result."""
    pest_or_disease: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    severity: Severity
    bounding_box: Optional[BoundingBox] = None
    treatments: List[Treatment] = []


class PestDetectionResponse(BaseModel):
    """Response for pest detection endpoint."""
    detection_id: str
    detections: List[PestDetection]
    processing_time_ms: float
    model_version: str
    is_fallback: bool = False
    fallback_disclaimer: Optional[str] = None


class Location(BaseModel):
    """Geographic location."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class SoilData(BaseModel):
    """Soil analysis data."""
    type: str = Field(..., min_length=1)
    ph: float = Field(..., ge=0, le=14)
    nitrogen: float = Field(..., ge=0)
    phosphorus: float = Field(..., ge=0)
    potassium: float = Field(..., ge=0)
    
    @field_validator('type')
    @classmethod
    def validate_soil_type(cls, v):
        valid_types = ['clay', 'sandy', 'loamy', 'silt', 'peat', 'chalk', 'black', 'red', 'alluvial']
        if v.lower() not in valid_types:
            raise ValueError(f"Soil type must be one of: {', '.join(valid_types)}")
        return v.lower()


class WeatherContext(BaseModel):
    """Weather context for recommendations."""
    temperature: Optional[float] = None
    humidity: Optional[float] = Field(None, ge=0, le=100)
    rainfall: Optional[float] = Field(None, ge=0)
    season: Optional[str] = None


class CropHistory(BaseModel):
    """Previous crop history."""
    crop_name: str
    year: int
    yield_kg_per_hectare: Optional[float] = None


class CropRecommendationRequest(BaseModel):
    """Request for crop recommendations."""
    location: Location
    soil_data: SoilData
    weather_context: Optional[WeatherContext] = None
    crop_history: Optional[List[CropHistory]] = []


class CropRecommendation(BaseModel):
    """Single crop recommendation."""
    crop_name: str
    variety: Optional[str] = None
    suitability_score: float = Field(..., ge=0, le=100)
    expected_yield: Optional[float] = None
    reasoning: List[str] = []
    risks: List[str] = []


class CropRecommendationResponse(BaseModel):
    """Response for crop recommendation endpoint."""
    recommendations: List[CropRecommendation]
    model_version: str
    is_fallback: bool = False
    fallback_disclaimer: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response with guidance."""
    error: str
    message: str
    guidance: Optional[str] = None
    field: Optional[str] = None
