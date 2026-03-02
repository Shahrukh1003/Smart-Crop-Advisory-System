"""
Property-based tests for pest detection service.

**Feature: project-finalization, Property 1: Pest detection returns valid predictions**
**Validates: Requirements 1.1**
"""
import io
import pytest
from hypothesis import given, strategies as st, settings as hyp_settings, HealthCheck
from PIL import Image
import numpy as np

from services.pest_detection_service import (
    PestDetectionService, 
    CLASS_LABELS,
    PEST_DATABASE
)
from schemas import Severity


def create_test_image(width: int, height: int, color: tuple) -> bytes:
    """Create a simple test image with given dimensions and color."""
    img = Image.new('RGB', (width, height), color)
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    return buffer.getvalue()


# Strategy for generating random valid images using simpler approach
@st.composite
def valid_image_bytes(draw):
    """Generate valid image bytes for testing."""
    # Generate small random dimensions
    width = draw(st.integers(min_value=50, max_value=150))
    height = draw(st.integers(min_value=50, max_value=150))
    
    # Generate random RGB color
    r = draw(st.integers(0, 255))
    g = draw(st.integers(0, 255))
    b = draw(st.integers(0, 255))
    
    return create_test_image(width, height, (r, g, b))


class TestPestDetectionProperties:
    """Property-based tests for pest detection."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test fixtures."""
        self.service = PestDetectionService()
    
    @given(image_data=valid_image_bytes())
    @hyp_settings(
        max_examples=100, 
        deadline=30000,
        suppress_health_check=[HealthCheck.large_base_example]
    )
    @pytest.mark.asyncio
    async def test_pest_detection_returns_valid_predictions(self, image_data: bytes):
        """
        **Feature: project-finalization, Property 1: Pest detection returns valid predictions**
        
        For any valid image input, the ML Service should return predictions with 
        confidence scores between 0 and 1, and severity levels from the valid set 
        (low, medium, high).
        """
        # Act
        result = await self.service.detect_pests(image_data)
        
        # Assert - Response structure is valid
        assert result.detection_id is not None
        assert len(result.detection_id) > 0
        assert result.processing_time_ms >= 0
        assert result.model_version is not None
        
        # Assert - All detections have valid confidence and severity
        for detection in result.detections:
            # Confidence must be between 0 and 1
            assert 0.0 <= detection.confidence <= 1.0, \
                f"Confidence {detection.confidence} is not in range [0, 1]"
            
            # Severity must be a valid enum value
            assert detection.severity in [Severity.LOW, Severity.MEDIUM, Severity.HIGH], \
                f"Severity {detection.severity} is not valid"
            
            # Pest/disease name should be non-empty
            assert len(detection.pest_or_disease) > 0, \
                "Pest/disease name should not be empty"
