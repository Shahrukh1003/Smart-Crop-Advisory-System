"""
Property-based tests for crop recommendation service.

**Feature: project-finalization, Property 2: Crop recommendations are properly scored**
**Validates: Requirements 1.2**
"""
import pytest
from hypothesis import given, strategies as st, settings as hyp_settings, HealthCheck

from services.crop_recommendation_service import (
    CropRecommendationService,
    CROP_DATABASE
)
from schemas import (
    CropRecommendationRequest, Location, SoilData, WeatherContext
)


# Valid soil types
VALID_SOIL_TYPES = ['clay', 'sandy', 'loamy', 'silt', 'peat', 'chalk', 'black', 'red', 'alluvial']


# Strategy for generating valid locations (India coordinates)
@st.composite
def valid_location(draw):
    """Generate valid location within India."""
    return Location(
        latitude=draw(st.floats(min_value=8.0, max_value=37.0)),
        longitude=draw(st.floats(min_value=68.0, max_value=97.0))
    )


# Strategy for generating valid soil data
@st.composite
def valid_soil_data(draw):
    """Generate valid soil data."""
    return SoilData(
        type=draw(st.sampled_from(VALID_SOIL_TYPES)),
        ph=draw(st.floats(min_value=4.0, max_value=9.0)),
        nitrogen=draw(st.floats(min_value=0.0, max_value=500.0)),
        phosphorus=draw(st.floats(min_value=0.0, max_value=200.0)),
        potassium=draw(st.floats(min_value=0.0, max_value=500.0))
    )


# Strategy for generating optional weather context
@st.composite
def optional_weather_context(draw):
    """Generate optional weather context."""
    if draw(st.booleans()):
        return WeatherContext(
            temperature=draw(st.floats(min_value=10.0, max_value=45.0)),
            humidity=draw(st.floats(min_value=20.0, max_value=100.0)),
            rainfall=draw(st.floats(min_value=0.0, max_value=500.0)),
            season=draw(st.sampled_from(['kharif', 'rabi', 'summer', 'monsoon', None]))
        )
    return None


# Strategy for generating valid crop recommendation requests
@st.composite
def valid_crop_recommendation_request(draw):
    """Generate valid crop recommendation request."""
    return CropRecommendationRequest(
        location=draw(valid_location()),
        soil_data=draw(valid_soil_data()),
        weather_context=draw(optional_weather_context()),
        crop_history=[]
    )


class TestCropRecommendationProperties:
    """Property-based tests for crop recommendations."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test fixtures."""
        self.service = CropRecommendationService()
    
    @given(request=valid_crop_recommendation_request())
    @hyp_settings(
        max_examples=100,
        deadline=30000,
        suppress_health_check=[HealthCheck.large_base_example]
    )
    def test_crop_recommendations_are_properly_scored(self, request: CropRecommendationRequest):
        """
        **Feature: project-finalization, Property 2: Crop recommendations are properly scored**
        
        For any valid soil and location input, the crop recommendations should have 
        suitability scores between 0 and 100, sorted in descending order.
        """
        # Act
        result = self.service.get_recommendations(request)
        
        # Assert - Response has recommendations
        assert result.recommendations is not None
        assert len(result.recommendations) > 0, "Should return at least one recommendation"
        assert len(result.recommendations) <= 5, "Should return at most 5 recommendations"
        
        # Assert - All scores are in valid range [0, 100]
        for rec in result.recommendations:
            assert 0.0 <= rec.suitability_score <= 100.0, \
                f"Score {rec.suitability_score} is not in range [0, 100]"
        
        # Assert - Recommendations are sorted by score descending
        scores = [rec.suitability_score for rec in result.recommendations]
        assert scores == sorted(scores, reverse=True), \
            f"Recommendations not sorted by score: {scores}"
        
        # Assert - Each recommendation has required fields
        for rec in result.recommendations:
            assert rec.crop_name is not None and len(rec.crop_name) > 0
            assert rec.reasoning is not None
            assert rec.risks is not None
        
        # Assert - Model version is present
        assert result.model_version is not None
