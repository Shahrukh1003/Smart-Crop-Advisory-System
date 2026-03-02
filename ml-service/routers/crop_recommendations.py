"""Crop recommendations API router."""
from fastapi import APIRouter, HTTPException
import logging

from schemas import (
    CropRecommendationRequest, CropRecommendationResponse, ErrorResponse
)
from services.crop_recommendation_service import get_crop_recommendation_service
from validation import validate_soil_data, validate_location, ValidationError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/crop-recommendations",
    response_model=CropRecommendationResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def get_crop_recommendations(request: CropRecommendationRequest):
    """
    Get crop recommendations based on location, soil data, and weather context.
    
    - **location**: Geographic coordinates (latitude, longitude)
    - **soil_data**: Soil analysis data (type, pH, NPK values)
    - **weather_context**: Optional weather information
    - **crop_history**: Optional list of previously grown crops
    
    Returns ranked crop recommendations with suitability scores, expected yields,
    reasoning, and risk factors.
    """
    # Validate location
    is_valid, loc_error = validate_location(
        request.location.latitude, 
        request.location.longitude
    )
    if not is_valid and loc_error:
        raise HTTPException(status_code=400, detail=loc_error.to_dict())
    
    # Validate soil data
    is_valid, soil_error = validate_soil_data(
        request.soil_data.type,
        request.soil_data.ph,
        request.soil_data.nitrogen,
        request.soil_data.phosphorus,
        request.soil_data.potassium
    )
    if not is_valid and soil_error:
        raise HTTPException(status_code=400, detail=soil_error.to_dict())
    
    try:
        service = get_crop_recommendation_service()
        result = service.get_recommendations(request)
        return result
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=e.to_dict())
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "validation_error",
                "message": str(e),
                "guidance": "Please check your input values and try again"
            }
        )
    except Exception as e:
        logger.error(f"Crop recommendation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "recommendation_failed",
                "message": "An error occurred while generating recommendations",
                "guidance": "Please try again. If the problem persists, contact support."
            }
        )
