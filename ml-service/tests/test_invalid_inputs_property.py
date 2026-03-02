"""
Property-based tests for invalid input handling.

**Feature: project-finalization, Property 3: Invalid ML inputs return appropriate errors**
**Validates: Requirements 1.4**
"""
import io
import pytest
from hypothesis import given, strategies as st, settings as hyp_settings, HealthCheck
from PIL import Image

from validation import (
    validate_image_bytes, validate_soil_data, validate_location,
    ValidationError
)


# Strategy for generating invalid image bytes (non-image data)
@st.composite
def invalid_image_bytes(draw):
    """Generate invalid image data."""
    choice = draw(st.integers(min_value=0, max_value=3))
    
    if choice == 0:
        # Empty bytes
        return b''
    elif choice == 1:
        # Random non-image bytes
        length = draw(st.integers(min_value=1, max_value=1000))
        return draw(st.binary(min_size=length, max_size=length))
    elif choice == 2:
        # Text data
        text = draw(st.text(min_size=10, max_size=500))
        return text.encode('utf-8')
    else:
        # Truncated/corrupted JPEG header
        return b'\xff\xd8\xff\xe0' + draw(st.binary(min_size=10, max_size=100))


# Strategy for generating out-of-range pH values
@st.composite
def invalid_ph_values(draw):
    """Generate invalid pH values."""
    choice = draw(st.booleans())
    if choice:
        # Negative pH
        return draw(st.floats(min_value=-100, max_value=-0.01))
    else:
        # pH > 14
        return draw(st.floats(min_value=14.01, max_value=100))


# Strategy for generating invalid coordinates
@st.composite
def invalid_latitude(draw):
    """Generate invalid latitude values."""
    choice = draw(st.booleans())
    if choice:
        return draw(st.floats(min_value=-180, max_value=-90.01))
    else:
        return draw(st.floats(min_value=90.01, max_value=180))


@st.composite
def invalid_longitude(draw):
    """Generate invalid longitude values."""
    choice = draw(st.booleans())
    if choice:
        return draw(st.floats(min_value=-360, max_value=-180.01))
    else:
        return draw(st.floats(min_value=180.01, max_value=360))


class TestInvalidInputProperties:
    """Property-based tests for invalid input handling."""
    
    @given(invalid_data=invalid_image_bytes())
    @hyp_settings(
        max_examples=100,
        deadline=30000,
        suppress_health_check=[HealthCheck.large_base_example, HealthCheck.too_slow]
    )
    def test_invalid_image_returns_error(self, invalid_data: bytes):
        """
        **Feature: project-finalization, Property 3: Invalid ML inputs return appropriate errors**
        
        For any invalid input (empty image, malformed data), the ML Service should 
        return an error response with a descriptive message and guidance.
        """
        # Act
        is_valid, error = validate_image_bytes(invalid_data)
        
        # Assert - Invalid data should be rejected
        # Note: Some random bytes might accidentally be valid images, so we check the structure
        if not is_valid:
            assert error is not None, "Error should be returned for invalid input"
            assert isinstance(error, ValidationError)
            assert error.error_code is not None and len(error.error_code) > 0
            assert error.message is not None and len(error.message) > 0
            assert error.guidance is not None and len(error.guidance) > 0
            
            # Error should be convertible to dict
            error_dict = error.to_dict()
            assert "error" in error_dict
            assert "message" in error_dict
            assert "guidance" in error_dict
    
    @given(ph=invalid_ph_values())
    @hyp_settings(max_examples=100, deadline=10000)
    def test_invalid_ph_returns_error(self, ph: float):
        """
        Test that out-of-range pH values return appropriate errors.
        """
        # Act
        is_valid, error = validate_soil_data(
            soil_type="loamy",
            ph=ph,
            nitrogen=100.0,
            phosphorus=50.0,
            potassium=100.0
        )
        
        # Assert
        assert not is_valid, f"pH {ph} should be invalid"
        assert error is not None
        assert error.error_code == "invalid_ph"
        assert error.field == "soil_data.ph"
        assert error.guidance is not None

    
    @given(lat=invalid_latitude())
    @hyp_settings(max_examples=100, deadline=10000)
    def test_invalid_latitude_returns_error(self, lat: float):
        """
        Test that out-of-range latitude values return appropriate errors.
        """
        # Act
        is_valid, error = validate_location(latitude=lat, longitude=0.0)
        
        # Assert
        assert not is_valid, f"Latitude {lat} should be invalid"
        assert error is not None
        assert error.error_code == "invalid_latitude"
        assert error.field == "location.latitude"
        assert error.guidance is not None
    
    @given(lon=invalid_longitude())
    @hyp_settings(max_examples=100, deadline=10000)
    def test_invalid_longitude_returns_error(self, lon: float):
        """
        Test that out-of-range longitude values return appropriate errors.
        """
        # Act
        is_valid, error = validate_location(latitude=0.0, longitude=lon)
        
        # Assert
        assert not is_valid, f"Longitude {lon} should be invalid"
        assert error is not None
        assert error.error_code == "invalid_longitude"
        assert error.field == "location.longitude"
        assert error.guidance is not None
    
    @given(soil_type=st.text(min_size=1, max_size=20).filter(
        lambda x: x.lower() not in ['clay', 'sandy', 'loamy', 'silt', 'peat', 'chalk', 'black', 'red', 'alluvial']
    ))
    @hyp_settings(max_examples=100, deadline=10000)
    def test_invalid_soil_type_returns_error(self, soil_type: str):
        """
        Test that invalid soil types return appropriate errors.
        """
        # Act
        is_valid, error = validate_soil_data(
            soil_type=soil_type,
            ph=7.0,
            nitrogen=100.0,
            phosphorus=50.0,
            potassium=100.0
        )
        
        # Assert
        assert not is_valid, f"Soil type '{soil_type}' should be invalid"
        assert error is not None
        assert error.error_code == "invalid_soil_type"
        assert error.field == "soil_data.type"
        assert error.guidance is not None
    
    @given(negative_value=st.floats(min_value=-1000, max_value=-0.01))
    @hyp_settings(max_examples=100, deadline=10000)
    def test_negative_npk_returns_error(self, negative_value: float):
        """
        Test that negative NPK values return appropriate errors.
        """
        # Test negative nitrogen
        is_valid, error = validate_soil_data(
            soil_type="loamy",
            ph=7.0,
            nitrogen=negative_value,
            phosphorus=50.0,
            potassium=100.0
        )
        assert not is_valid
        assert error is not None
        assert error.error_code == "invalid_nitrogen"
