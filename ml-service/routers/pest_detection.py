"""Pest detection API router."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
import logging

from schemas import PestDetectionResponse, ErrorResponse
from services.pest_detection_service import get_pest_detection_service
from validation import validate_image_bytes, ValidationError
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
MAX_FILE_SIZE = settings.max_image_size_mb * 1024 * 1024  # Convert to bytes


def validate_image_file(file: UploadFile) -> None:
    """Validate uploaded image file metadata."""
    # Check file extension
    filename = file.filename or ""
    ext = '.' + filename.split('.')[-1].lower() if '.' in filename else ''
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_file_type",
                "message": f"File type '{ext}' is not allowed",
                "guidance": f"Please upload an image with one of these extensions: {', '.join(ALLOWED_EXTENSIONS)}"
            }
        )
    
    # Check content type
    content_type = file.content_type or ""
    if not content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_content_type",
                "message": f"Content type '{content_type}' is not an image",
                "guidance": "Please upload a valid image file (JPEG or PNG)"
            }
        )


@router.post(
    "/pest-detection/analyze",
    response_model=PestDetectionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        413: {"model": ErrorResponse, "description": "File too large"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def analyze_pest_detection(
    image: UploadFile = File(..., description="Crop image for pest detection (JPEG/PNG, max 10MB)"),
    crop_type: Optional[str] = Form(None, description="Type of crop (optional)")
):
    """
    Analyze a crop image for pest and disease detection.
    
    - **image**: Upload a JPEG or PNG image of the crop (max 10MB)
    - **crop_type**: Optional crop type for more accurate detection
    
    Returns detected pests/diseases with confidence scores, severity levels, and treatment recommendations.
    """
    # Validate image file metadata
    validate_image_file(image)
    
    # Read image content
    try:
        image_bytes = await image.read()
    except Exception as e:
        logger.error(f"Failed to read image: {e}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "read_error",
                "message": "Failed to read the uploaded image",
                "guidance": "Please ensure the file is not corrupted and try again"
            }
        )
    
    # Check file size
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail={
                "error": "file_too_large",
                "message": f"File size exceeds maximum allowed size of {settings.max_image_size_mb}MB",
                "guidance": f"Please upload an image smaller than {settings.max_image_size_mb}MB"
            }
        )
    
    # Validate image content
    is_valid, validation_error = validate_image_bytes(image_bytes)
    if not is_valid and validation_error:
        raise HTTPException(
            status_code=400,
            detail=validation_error.to_dict()
        )
    
    # Run pest detection
    try:
        service = get_pest_detection_service()
        result = await service.detect_pests(image_bytes, crop_type)
        return result
    except Exception as e:
        logger.error(f"Pest detection failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "detection_failed",
                "message": "An error occurred during pest detection",
                "guidance": "Please try again. If the problem persists, contact support."
            }
        )
