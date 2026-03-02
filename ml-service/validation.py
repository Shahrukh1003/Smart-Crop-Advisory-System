"""Input validation utilities with descriptive error messages."""
from typing import Optional, List, Tuple
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)

# Valid image formats
VALID_IMAGE_FORMATS = {'JPEG', 'PNG', 'JPG'}
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MIN_IMAGE_DIMENSION = 32
MAX_IMAGE_DIMENSION = 4096


class ValidationError(Exception):
    """Custom validation error with guidance."""
    
    def __init__(self, error_code: str, message: str, guidance: str, field: Optional[str] = None):
        self.error_code = error_code
        self.message = message
        self.guidance = guidance
        self.field = field
        super().__init__(message)
    
    def to_dict(self):
        return {
            "error": self.error_code,
            "message": self.message,
            "guidance": self.guidance,
            "field": self.field
        }


def validate_image_bytes(image_bytes: bytes) -> Tuple[bool, Optional[ValidationError]]:
    """Validate image bytes for pest detection."""
    # Check if empty
    if not image_bytes or len(image_bytes) == 0:
        return False, ValidationError(
            error_code="empty_image",
            message="The uploaded image is empty",
            guidance="Please upload a valid image file (JPEG or PNG)",
            field="image"
        )
    
    # Check file size
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        size_mb = len(image_bytes) / (1024 * 1024)
        return False, ValidationError(
            error_code="image_too_large",
            message=f"Image size ({size_mb:.1f}MB) exceeds maximum allowed size (10MB)",
            guidance="Please compress the image or use a smaller resolution",
            field="image"
        )
    
    # Try to open and validate image
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        # Check format
        if image.format and image.format.upper() not in VALID_IMAGE_FORMATS:
            return False, ValidationError(
                error_code="invalid_image_format",
                message=f"Image format '{image.format}' is not supported",
                guidance=f"Please upload an image in one of these formats: {', '.join(VALID_IMAGE_FORMATS)}",
                field="image"
            )
        
        # Check dimensions
        width, height = image.size
        if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
            return False, ValidationError(
                error_code="image_too_small",
                message=f"Image dimensions ({width}x{height}) are too small",
                guidance=f"Please upload an image at least {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION} pixels",
                field="image"
            )
        
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            return False, ValidationError(
                error_code="image_too_large_dimensions",
                message=f"Image dimensions ({width}x{height}) exceed maximum allowed",
                guidance=f"Please upload an image no larger than {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION} pixels",
                field="image"
            )
        
        return True, None
        
    except Exception as e:
        logger.error(f"Image validation failed: {e}")
        return False, ValidationError(
            error_code="invalid_image",
            message="The uploaded file is not a valid image",
            guidance="Please ensure the file is a valid JPEG or PNG image and is not corrupted",
            field="image"
        )


def validate_soil_data(soil_type: str, ph: float, nitrogen: float, 
                       phosphorus: float, potassium: float) -> Tuple[bool, Optional[ValidationError]]:
    """Validate soil data for crop recommendations."""
    valid_soil_types = ['clay', 'sandy', 'loamy', 'silt', 'peat', 'chalk', 'black', 'red', 'alluvial']
    
    # Validate soil type
    if not soil_type or soil_type.lower() not in valid_soil_types:
        return False, ValidationError(
            error_code="invalid_soil_type",
            message=f"Soil type '{soil_type}' is not recognized",
            guidance=f"Please use one of these soil types: {', '.join(valid_soil_types)}",
            field="soil_data.type"
        )
    
    # Validate pH
    if ph < 0 or ph > 14:
        return False, ValidationError(
            error_code="invalid_ph",
            message=f"pH value {ph} is out of valid range",
            guidance="pH must be between 0 and 14. Typical agricultural soils have pH between 4 and 9",
            field="soil_data.ph"
        )
    
    # Validate NPK values
    if nitrogen < 0:
        return False, ValidationError(
            error_code="invalid_nitrogen",
            message="Nitrogen value cannot be negative",
            guidance="Please enter a positive value for nitrogen (kg/ha)",
            field="soil_data.nitrogen"
        )
    
    if phosphorus < 0:
        return False, ValidationError(
            error_code="invalid_phosphorus",
            message="Phosphorus value cannot be negative",
            guidance="Please enter a positive value for phosphorus (kg/ha)",
            field="soil_data.phosphorus"
        )
    
    if potassium < 0:
        return False, ValidationError(
            error_code="invalid_potassium",
            message="Potassium value cannot be negative",
            guidance="Please enter a positive value for potassium (kg/ha)",
            field="soil_data.potassium"
        )
    
    return True, None


def validate_location(latitude: float, longitude: float) -> Tuple[bool, Optional[ValidationError]]:
    """Validate geographic coordinates."""
    if latitude < -90 or latitude > 90:
        return False, ValidationError(
            error_code="invalid_latitude",
            message=f"Latitude {latitude} is out of valid range",
            guidance="Latitude must be between -90 and 90 degrees",
            field="location.latitude"
        )
    
    if longitude < -180 or longitude > 180:
        return False, ValidationError(
            error_code="invalid_longitude",
            message=f"Longitude {longitude} is out of valid range",
            guidance="Longitude must be between -180 and 180 degrees",
            field="location.longitude"
        )
    
    return True, None


# Fallback disclaimers
FALLBACK_DISCLAIMERS = {
    "pest_detection": "Using simplified detection based on image analysis. For accurate diagnosis, please consult an agricultural expert.",
    "crop_recommendation": "Using rule-based recommendations. For personalized advice, please consult a local agricultural extension officer."
}


def get_fallback_disclaimer(service_type: str) -> str:
    """Get the appropriate fallback disclaimer for a service."""
    return FALLBACK_DISCLAIMERS.get(service_type, "Using fallback mode. Results may be less accurate.")
