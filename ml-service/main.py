"""Smart Crop Advisory ML Service - Main Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
import logging

from config import settings
from model_loader import initialize_models, get_model_loader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - loads models on startup."""
    logger.info("Starting ML Service...")
    model_info = initialize_models()
    logger.info(f"Models initialized: {model_info}")
    yield
    logger.info("Shutting down ML Service...")


app = FastAPI(
    title="Smart Crop Advisory ML Service",
    description="Machine Learning services for crop recommendations and pest detection",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    loader = get_model_loader()
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "smart-crop-advisory-ml-service",
        "models": loader.get_all_model_info()
    }


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Smart Crop Advisory ML Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "crop_recommendations": "/api/v1/crop-recommendations",
            "pest_detection": "/api/v1/pest-detection/analyze"
        }
    }


@app.get("/api/v1/models")
async def get_models():
    """Get information about loaded models."""
    loader = get_model_loader()
    return {
        "models": loader.get_all_model_info(),
        "model_directory": settings.model_dir
    }


# Import and include routers
from routers import pest_detection, crop_recommendations

app.include_router(pest_detection.router, prefix="/api/v1", tags=["Pest Detection"])
app.include_router(crop_recommendations.router, prefix="/api/v1", tags=["Crop Recommendations"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
