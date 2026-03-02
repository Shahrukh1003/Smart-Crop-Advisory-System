-- Smart Crop Advisory System Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    language VARCHAR(5) NOT NULL CHECK (language IN ('kn', 'hi', 'ta', 'te', 'en')),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    district VARCHAR(100),
    state VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'farmer' CHECK (role IN ('farmer', 'extension_officer', 'admin'))
);

-- Land parcels table
CREATE TABLE land_parcels (
    parcel_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    area DECIMAL(10, 2) NOT NULL,
    soil_type VARCHAR(50),
    irrigation_type VARCHAR(20) CHECK (irrigation_type IN ('rainfed', 'drip', 'sprinkler', 'flood')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Soil test results table
CREATE TABLE soil_test_results (
    test_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES land_parcels(parcel_id) ON DELETE CASCADE,
    nitrogen DECIMAL(10, 2),
    phosphorus DECIMAL(10, 2),
    potassium DECIMAL(10, 2),
    ph DECIMAL(4, 2),
    organic_matter DECIMAL(5, 2),
    test_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crop history table
CREATE TABLE crop_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES land_parcels(parcel_id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    sowing_date DATE NOT NULL,
    harvest_date DATE,
    yield DECIMAL(10, 2),
    revenue DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Input costs table
CREATE TABLE input_costs (
    cost_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_id UUID NOT NULL REFERENCES crop_history(history_id) ON DELETE CASCADE,
    seeds DECIMAL(10, 2) DEFAULT 0,
    fertilizers DECIMAL(10, 2) DEFAULT 0,
    pesticides DECIMAL(10, 2) DEFAULT 0,
    labor DECIMAL(10, 2) DEFAULT 0,
    irrigation DECIMAL(10, 2) DEFAULT 0
);

-- Farming activities table
CREATE TABLE farming_activities (
    activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_id UUID NOT NULL REFERENCES crop_history(history_id) ON DELETE CASCADE,
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('sowing', 'irrigation', 'fertilization', 'pesticide', 'weeding', 'harvest')),
    activity_date DATE NOT NULL,
    description TEXT,
    cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crop recommendations table
CREATE TABLE crop_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES land_parcels(parcel_id) ON DELETE CASCADE,
    season VARCHAR(10) CHECK (season IN ('kharif', 'rabi', 'zaid')),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommended crops table
CREATE TABLE recommended_crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_id UUID NOT NULL REFERENCES crop_recommendations(recommendation_id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    suitability_score INTEGER CHECK (suitability_score >= 0 AND suitability_score <= 100),
    expected_yield DECIMAL(10, 2),
    estimated_input_cost DECIMAL(12, 2),
    estimated_revenue DECIMAL(12, 2),
    reasoning TEXT[],
    risks TEXT[]
);

-- Pest detection results table
CREATE TABLE pest_detections (
    detection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Detected pests table
CREATE TABLE detected_pests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detection_id UUID NOT NULL REFERENCES pest_detections(detection_id) ON DELETE CASCADE,
    pest_or_disease VARCHAR(100) NOT NULL,
    confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
    severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high')),
    affected_crop VARCHAR(100)
);

-- Treatments table
CREATE TABLE treatments (
    treatment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detected_pest_id UUID NOT NULL REFERENCES detected_pests(id) ON DELETE CASCADE,
    type VARCHAR(10) CHECK (type IN ('organic', 'chemical')),
    name VARCHAR(100) NOT NULL,
    dosage VARCHAR(100),
    application_method VARCHAR(200),
    cost DECIMAL(10, 2),
    effectiveness INTEGER CHECK (effectiveness >= 0 AND effectiveness <= 100)
);

-- Weather data table
CREATE TABLE weather_data (
    weather_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    rainfall DECIMAL(6, 2),
    wind_speed DECIMAL(5, 2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weather forecasts table
CREATE TABLE weather_forecasts (
    forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weather_id UUID NOT NULL REFERENCES weather_data(weather_id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    min_temp DECIMAL(5, 2),
    max_temp DECIMAL(5, 2),
    rainfall DECIMAL(6, 2),
    humidity DECIMAL(5, 2)
);

-- Market prices table
CREATE TABLE market_prices (
    price_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commodity VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    market_name VARCHAR(200) NOT NULL,
    district VARCHAR(100) NOT NULL,
    min_price DECIMAL(10, 2),
    max_price DECIMAL(10, 2),
    modal_price DECIMAL(10, 2),
    unit VARCHAR(20),
    price_date DATE NOT NULL,
    trend VARCHAR(10) CHECK (trend IN ('rising', 'falling', 'stable')),
    price_change DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broadcasts table
CREATE TABLE broadcasts (
    broadcast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    audio_url VARCHAR(500),
    image_url VARCHAR(500),
    language VARCHAR(5) NOT NULL,
    target_region JSONB NOT NULL,
    priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broadcast deliveries table
CREATE TABLE broadcast_deliveries (
    delivery_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id UUID NOT NULL REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    delivery_status VARCHAR(20) CHECK (delivery_status IN ('sent', 'delivered', 'read')),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP
);

-- Analytics events table
CREATE TABLE analytics_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    feature VARCHAR(100) NOT NULL,
    session_id UUID NOT NULL,
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback table
CREATE TABLE feedback (
    feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync queue table
CREATE TABLE sync_queue (
    queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    operation VARCHAR(10) CHECK (operation IN ('create', 'update', 'delete')),
    entity_type VARCHAR(50) NOT NULL,
    entity_data JSONB NOT NULL,
    sync_status VARCHAR(20) CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_land_parcels_user ON land_parcels(user_id);
CREATE INDEX idx_crop_history_user ON crop_history(user_id);
CREATE INDEX idx_crop_history_parcel ON crop_history(parcel_id);
CREATE INDEX idx_farming_activities_history ON farming_activities(history_id);
CREATE INDEX idx_pest_detections_user ON pest_detections(user_id);
CREATE INDEX idx_market_prices_commodity ON market_prices(commodity, price_date);
CREATE INDEX idx_broadcasts_created ON broadcasts(created_at);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, event_timestamp);
CREATE INDEX idx_sync_queue_user_status ON sync_queue(user_id, sync_status);
