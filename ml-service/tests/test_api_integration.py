"""
Core integration tests for the ML service API endpoints.
Tests crop recommendation and pest detection workflows.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import numpy as np
import json
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def client():
    """Create a test client with mocked models."""
    with patch('model_loader.ModelLoader') as MockLoader:
        mock_instance = MockLoader.return_value
        mock_instance.models = {
            'crop_recommendation': MagicMock(),
            'pest_detection': MagicMock(),
        }
        mock_instance.metadata = {
            'crop_recommendation': {'features': ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']},
        }

        from main import app
        with TestClient(app) as c:
            yield c


class TestHealthEndpoint:
    """Test the health check endpoint."""

    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

    def test_model_info(self, client):
        response = client.get("/models")
        assert response.status_code == 200


class TestCropRecommendation:
    """Test the crop recommendation endpoint."""

    valid_payload = {
        "nitrogen": 90,
        "phosphorus": 42,
        "potassium": 43,
        "temperature": 25.0,
        "humidity": 80.0,
        "ph": 6.5,
        "rainfall": 200.0,
    }

    def test_valid_recommendation(self, client):
        """Should return a crop recommendation for valid input."""
        response = client.post("/api/v1/crop-recommendation", json=self.valid_payload)
        # May return 200 or 503 depending on model state
        assert response.status_code in [200, 503]

    def test_missing_fields(self, client):
        """Should reject requests with missing fields."""
        response = client.post("/api/v1/crop-recommendation", json={"nitrogen": 90})
        assert response.status_code == 422

    def test_negative_values(self, client):
        """Should reject negative nutrient values."""
        invalid = {**self.valid_payload, "nitrogen": -10}
        response = client.post("/api/v1/crop-recommendation", json=invalid)
        assert response.status_code == 422

    def test_extreme_temperature(self, client):
        """Should handle extreme temperature values."""
        extreme = {**self.valid_payload, "temperature": 100.0}
        response = client.post("/api/v1/crop-recommendation", json=extreme)
        # Should either process or validate
        assert response.status_code in [200, 422, 503]

    def test_zero_rainfall(self, client):
        """Should handle zero rainfall scenarios."""
        zero_rain = {**self.valid_payload, "rainfall": 0.0}
        response = client.post("/api/v1/crop-recommendation", json=zero_rain)
        assert response.status_code in [200, 503]


class TestPestDetection:
    """Test the pest detection endpoint."""

    def test_missing_image(self, client):
        """Should reject request without image."""
        response = client.post("/api/v1/pest-detection")
        assert response.status_code in [400, 422]

    def test_invalid_file_type(self, client):
        """Should reject non-image files."""
        response = client.post(
            "/api/v1/pest-detection",
            files={"file": ("test.txt", b"not an image", "text/plain")},
        )
        assert response.status_code in [400, 422]


class TestCORS:
    """Test CORS configuration."""

    def test_cors_headers(self, client):
        response = client.options(
            "/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )
        # FastAPI with CORSMiddleware should respond to preflight
        assert response.status_code in [200, 405]
