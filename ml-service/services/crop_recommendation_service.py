"""Crop recommendation service with ensemble model inference."""
import logging
from typing import List, Optional, Dict, Any
import numpy as np

from schemas import (
    CropRecommendationRequest, CropRecommendationResponse,
    CropRecommendation, SoilData, WeatherContext
)
from model_loader import get_model_loader
from config import settings

logger = logging.getLogger(__name__)

# Crop database with suitability parameters (used for fallback and enrichment)
CROP_DATABASE = {
    "rice": {
        "soil_types": ["clay", "loamy", "alluvial"],
        "ph_range": (5.5, 7.5),
        "water_requirement": "high",
        "season": ["kharif", "monsoon"],
        "npk_preference": {"n": "high", "p": "medium", "k": "medium"},
        "base_yield": 4500,
        "risks": ["drought", "flooding", "blast_disease"]
    },
    "wheat": {
        "soil_types": ["loamy", "clay", "black"],
        "ph_range": (6.0, 7.5),
        "water_requirement": "medium",
        "season": ["rabi", "winter"],
        "npk_preference": {"n": "high", "p": "medium", "k": "low"},
        "base_yield": 3500,
        "risks": ["rust", "heat_stress", "lodging"]
    },
    "maize": {
        "soil_types": ["loamy", "sandy", "alluvial"],
        "ph_range": (5.5, 7.5),
        "water_requirement": "medium",
        "season": ["kharif", "rabi"],
        "npk_preference": {"n": "high", "p": "medium", "k": "medium"},
        "base_yield": 5000,
        "risks": ["stem_borer", "drought", "fall_armyworm"]
    },
    "cotton": {
        "soil_types": ["black", "loamy", "alluvial"],
        "ph_range": (6.0, 8.0),
        "water_requirement": "medium",
        "season": ["kharif"],
        "npk_preference": {"n": "medium", "p": "high", "k": "high"},
        "base_yield": 500,
        "risks": ["bollworm", "whitefly", "water_stress"]
    },
    "sugarcane": {
        "soil_types": ["loamy", "clay", "alluvial"],
        "ph_range": (6.0, 8.0),
        "water_requirement": "high",
        "season": ["annual"],
        "npk_preference": {"n": "high", "p": "medium", "k": "high"},
        "base_yield": 70000,
        "risks": ["red_rot", "water_logging", "termites"]
    },
    "groundnut": {
        "soil_types": ["sandy", "loamy", "red"],
        "ph_range": (6.0, 7.0),
        "water_requirement": "low",
        "season": ["kharif", "rabi"],
        "npk_preference": {"n": "low", "p": "high", "k": "medium"},
        "base_yield": 1500,
        "risks": ["leaf_spot", "collar_rot", "drought"]
    },
    "soybean": {
        "soil_types": ["loamy", "clay", "black"],
        "ph_range": (6.0, 7.5),
        "water_requirement": "medium",
        "season": ["kharif"],
        "npk_preference": {"n": "low", "p": "high", "k": "medium"},
        "base_yield": 2000,
        "risks": ["rust", "pod_borer", "yellow_mosaic"]
    },
    "tomato": {
        "soil_types": ["loamy", "sandy", "red"],
        "ph_range": (6.0, 7.0),
        "water_requirement": "medium",
        "season": ["rabi", "summer"],
        "npk_preference": {"n": "medium", "p": "high", "k": "high"},
        "base_yield": 25000,
        "risks": ["blight", "fruit_borer", "wilting"]
    },
    "potato": {
        "soil_types": ["loamy", "sandy", "alluvial"],
        "ph_range": (5.5, 6.5),
        "water_requirement": "medium",
        "season": ["rabi"],
        "npk_preference": {"n": "high", "p": "high", "k": "high"},
        "base_yield": 20000,
        "risks": ["late_blight", "early_blight", "tuber_moth"]
    },
    "onion": {
        "soil_types": ["loamy", "sandy", "alluvial"],
        "ph_range": (6.0, 7.0),
        "water_requirement": "medium",
        "season": ["rabi", "kharif"],
        "npk_preference": {"n": "medium", "p": "medium", "k": "medium"},
        "base_yield": 15000,
        "risks": ["purple_blotch", "thrips", "storage_rot"]
    },
    "chickpea": {
        "soil_types": ["loamy", "clay", "black"],
        "ph_range": (6.0, 8.0),
        "water_requirement": "low",
        "season": ["rabi"],
        "npk_preference": {"n": "low", "p": "high", "k": "medium"},
        "base_yield": 1200,
        "risks": ["wilt", "pod_borer", "ascochyta_blight"]
    },
    "lentil": {
        "soil_types": ["loamy", "clay", "alluvial"],
        "ph_range": (6.0, 8.0),
        "water_requirement": "low",
        "season": ["rabi"],
        "npk_preference": {"n": "low", "p": "high", "k": "medium"},
        "base_yield": 1000,
        "risks": ["rust", "wilt", "aphids"]
    },
    "mustard": {
        "soil_types": ["loamy", "sandy", "alluvial"],
        "ph_range": (6.0, 7.5),
        "water_requirement": "low",
        "season": ["rabi"],
        "npk_preference": {"n": "medium", "p": "medium", "k": "low"},
        "base_yield": 1500,
        "risks": ["aphids", "white_rust", "alternaria_blight"]
    },
    "sunflower": {
        "soil_types": ["loamy", "clay", "black"],
        "ph_range": (6.0, 7.5),
        "water_requirement": "medium",
        "season": ["kharif", "rabi"],
        "npk_preference": {"n": "medium", "p": "high", "k": "medium"},
        "base_yield": 1800,
        "risks": ["head_rot", "rust", "alternaria"]
    },
    "millet": {
        "soil_types": ["sandy", "loamy", "red"],
        "ph_range": (5.5, 7.5),
        "water_requirement": "low",
        "season": ["kharif"],
        "npk_preference": {"n": "low", "p": "medium", "k": "low"},
        "base_yield": 1500,
        "risks": ["downy_mildew", "blast", "stem_borer"]
    }
}


class CropRecommendationService:
    """Service for generating crop recommendations."""
    
    def __init__(self):
        self.model_loader = get_model_loader()
        self._feature_cols = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
    
    def _extract_features(self, request: CropRecommendationRequest) -> np.ndarray:
        """Extract features from request for model inference, mapping to physical constraints."""
        soil = request.soil_data
        weather = request.weather_context or WeatherContext()
        
        # Enforce realistic constraints to prevent model hallucination on extreme outliers
        n = max(0.0, min(float(soil.nitrogen), 300.0))
        p = max(0.0, min(float(soil.phosphorus), 150.0))
        k = max(0.0, min(float(soil.potassium), 300.0))
        temp = max(-10.0, min(float(weather.temperature or 25.0), 60.0))
        hum = max(0.0, min(float(weather.humidity or 60.0), 100.0))
        ph = max(0.0, min(float(soil.ph), 14.0))
        rain = max(0.0, min(float(weather.rainfall or 100.0), 1000.0))
        
        features = [n, p, k, temp, hum, ph, rain]
        
        return np.array([features], dtype=np.float32)
    
    def _calculate_soil_suitability(self, crop_info: Dict, soil: SoilData) -> float:
        """Calculate soil suitability score for a crop."""
        score = 0.0
        
        # Soil type match (40 points)
        if soil.type.lower() in crop_info["soil_types"]:
            score += 40.0
        else:
            score += 10.0
        
        # pH suitability (30 points)
        ph_min, ph_max = crop_info["ph_range"]
        if ph_min <= soil.ph <= ph_max:
            score += 30.0
        elif abs(soil.ph - ph_min) <= 0.5 or abs(soil.ph - ph_max) <= 0.5:
            score += 15.0
        else:
            score += 5.0
        
        # NPK suitability (30 points)
        npk_score = 0.0
        npk_pref = crop_info["npk_preference"]
        
        if npk_pref["n"] == "high" and soil.nitrogen >= 200:
            npk_score += 10.0
        elif npk_pref["n"] == "medium" and 100 <= soil.nitrogen < 200:
            npk_score += 10.0
        elif npk_pref["n"] == "low" and soil.nitrogen < 100:
            npk_score += 10.0
        else:
            npk_score += 5.0
        
        if npk_pref["p"] == "high" and soil.phosphorus >= 50:
            npk_score += 10.0
        elif npk_pref["p"] == "medium" and 25 <= soil.phosphorus < 50:
            npk_score += 10.0
        else:
            npk_score += 5.0
        
        if npk_pref["k"] == "high" and soil.potassium >= 200:
            npk_score += 10.0
        elif npk_pref["k"] == "medium" and 100 <= soil.potassium < 200:
            npk_score += 10.0
        elif npk_pref["k"] == "low" and soil.potassium < 100:
            npk_score += 10.0
        else:
            npk_score += 5.0
        
        score += npk_score
        return score
    
    def _generate_reasoning(self, crop_name: str, crop_info: Dict, soil: SoilData, 
                           model_confidence: Optional[float] = None) -> List[str]:
        """Generate reasoning for crop recommendation."""
        reasoning = []
        
        if model_confidence:
            reasoning.append(f"ML model confidence: {model_confidence:.1%}")
        
        if soil.type.lower() in crop_info["soil_types"]:
            reasoning.append(f"{soil.type.capitalize()} soil is well-suited for {crop_name}")
        
        ph_min, ph_max = crop_info["ph_range"]
        if ph_min <= soil.ph <= ph_max:
            reasoning.append(f"Soil pH {soil.ph} is optimal (ideal: {ph_min}-{ph_max})")
        
        if soil.nitrogen >= 150:
            reasoning.append("Good nitrogen levels support healthy growth")
        
        if soil.phosphorus >= 40:
            reasoning.append("Adequate phosphorus for root development")
        
        return reasoning if reasoning else [f"{crop_name} can be grown in current conditions"]
    
    def _get_risks(self, crop_info: Dict, weather: Optional[WeatherContext]) -> List[str]:
        """Get relevant risks for the crop."""
        risks = []
        base_risks = crop_info.get("risks", [])
        
        if weather:
            if weather.rainfall and weather.rainfall < 50:
                if "drought" in base_risks:
                    risks.append("Low rainfall may cause drought stress")
            if weather.temperature and weather.temperature > 35:
                if "heat_stress" in base_risks:
                    risks.append("High temperatures may cause heat stress")
        
        for risk in base_risks[:2]:
            risk_text = risk.replace("_", " ").title()
            if risk_text not in [r.split()[0] for r in risks]:
                risks.append(f"Monitor for {risk_text}")
        
        return risks
    
    def _run_model_inference(self, features: np.ndarray) -> Optional[Dict[str, float]]:
        """Run inference using the loaded ensemble model."""
        model_data = self.model_loader.get_model("crop_recommendation")
        
        if model_data is not None:
            try:
                # Handle dictionary format from training
                if isinstance(model_data, dict):
                    model = model_data['model']
                    scaler = model_data['scaler']
                    crops = model_data.get('classes', [])
                    
                    # Scale features
                    features_scaled = scaler.transform(features)
                    
                    # Get probabilities
                    proba = model.predict_proba(features_scaled)
                    
                    if crops and len(proba[0]) == len(crops):
                        result = {crop: float(proba[0][i]) for i, crop in enumerate(crops)}
                        logger.info(f"Model predictions: {sorted(result.items(), key=lambda x: x[1], reverse=True)[:5]}")
                        return result
                
                # Handle object with predict_proba method
                elif hasattr(model_data, 'predict_proba'):
                    proba = model_data.predict_proba(features)
                    crops = model_data.get_all_crops() if hasattr(model_data, 'get_all_crops') else self.model_loader.get_crop_labels()
                    
                    if crops and len(proba[0]) == len(crops):
                        result = {crop: float(proba[0][i]) for i, crop in enumerate(crops)}
                        logger.info(f"Model predictions: {sorted(result.items(), key=lambda x: x[1], reverse=True)[:5]}")
                        return result
                
            except Exception as e:
                logger.error(f"Model inference failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
                return None
        return None
    
    def _run_fallback_recommendation(self, request: CropRecommendationRequest) -> List[CropRecommendation]:
        """Generate recommendations using rule-based approach."""
        recommendations = []
        
        for crop_name, crop_info in CROP_DATABASE.items():
            soil_score = self._calculate_soil_suitability(crop_info, request.soil_data)
            
            weather_adjustment = 0.0
            if request.weather_context:
                weather = request.weather_context
                water_req = crop_info["water_requirement"]
                
                if water_req == "high" and weather.rainfall and weather.rainfall >= 150:
                    weather_adjustment += 10.0
                elif water_req == "low" and weather.rainfall and weather.rainfall < 100:
                    weather_adjustment += 10.0
                elif water_req == "medium":
                    weather_adjustment += 5.0
            
            final_score = min(100.0, soil_score + weather_adjustment)
            base_yield = crop_info["base_yield"]
            yield_factor = final_score / 100.0
            expected_yield = base_yield * yield_factor * 0.9
            
            recommendation = CropRecommendation(
                crop_name=crop_name,
                variety="Standard",
                suitability_score=round(final_score, 2),
                expected_yield=round(expected_yield, 2),
                reasoning=self._generate_reasoning(crop_name, crop_info, request.soil_data),
                risks=self._get_risks(crop_info, request.weather_context)
            )
            recommendations.append(recommendation)
        
        recommendations.sort(key=lambda x: x.suitability_score, reverse=True)
        return recommendations[:5]
    
    def get_recommendations(self, request: CropRecommendationRequest) -> CropRecommendationResponse:
        """Generate crop recommendations based on input data."""
        model_info = self.model_loader.get_model_info("crop_recommendation")
        model_version = model_info.version if model_info else "fallback"
        is_fallback = False
        fallback_disclaimer = None
        
        # Try model inference first
        features = self._extract_features(request)
        model_predictions = self._run_model_inference(features)
        
        if model_predictions:
            recommendations = []
            for crop_name, prob in model_predictions.items():
                crop_info = CROP_DATABASE.get(crop_name, {
                    "soil_types": ["loamy"],
                    "ph_range": (6.0, 7.5),
                    "water_requirement": "medium",
                    "npk_preference": {"n": "medium", "p": "medium", "k": "medium"},
                    "base_yield": 2000,
                    "risks": []
                })
                
                soil_score = self._calculate_soil_suitability(crop_info, request.soil_data)
                # Combine model prediction with rule-based score
                final_score = min(100.0, (prob * 60) + (soil_score * 0.4))
                
                recommendation = CropRecommendation(
                    crop_name=crop_name,
                    variety="Standard",
                    suitability_score=round(final_score, 2),
                    expected_yield=round(crop_info["base_yield"] * (final_score / 100), 2),
                    reasoning=self._generate_reasoning(crop_name, crop_info, request.soil_data, prob),
                    risks=self._get_risks(crop_info, request.weather_context)
                )
                recommendations.append(recommendation)
            
            recommendations.sort(key=lambda x: x.suitability_score, reverse=True)
            recommendations = recommendations[:5]
            
            if model_info and model_info.metadata.get("trained_at"):
                model_version = f"trained-{model_info.version}"
        else:
            is_fallback = True
            fallback_disclaimer = "Using rule-based recommendations. Results may vary."
            model_version = "rule-based-1.0.0"
            recommendations = self._run_fallback_recommendation(request)
        
        return CropRecommendationResponse(
            recommendations=recommendations,
            model_version=model_version,
            is_fallback=is_fallback,
            fallback_disclaimer=fallback_disclaimer
        )


# Singleton instance
_crop_recommendation_service: Optional[CropRecommendationService] = None


def get_crop_recommendation_service() -> CropRecommendationService:
    """Get the crop recommendation service instance."""
    global _crop_recommendation_service
    if _crop_recommendation_service is None:
        _crop_recommendation_service = CropRecommendationService()
    return _crop_recommendation_service
