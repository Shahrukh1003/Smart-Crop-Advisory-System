# Smart Crop Advisory System

A production-ready, multilingual, AI-based mobile application designed to empower small and marginal farmers in India with personalized, real-time agricultural guidance. Built with modern technologies and comprehensive property-based testing for correctness guarantees.

## Project Status

✅ **Production Ready** - All core features implemented and tested
- Backend API: Running on port 3000
- ML Service: Running on port 8000
- Mobile App: Expo SDK 54 with React Native 0.81.5
- Database: PostgreSQL with Redis caching
- All 29 correctness properties implemented and validated

## Project Structure

```
smart-crop-advisory/
├── mobile/                    # Expo SDK 54 React Native app
├── backend/                   # NestJS backend with full API
├── ml-service/                # Python FastAPI ML inference
├── database/                  # PostgreSQL schemas
├── infrastructure/            # AWS CloudFormation templates
├── .kiro/specs/               # Feature specifications & design docs
└── docker-compose.yml         # Complete development environment
```

## Features

- 🌾 **Crop Recommendations** - ML-powered suggestions based on soil, weather, location
- 🧪 **Soil Analysis** - Health assessment and fertilizer guidance
- 🌤️ **Weather Integration** - Real-time OpenWeatherMap data with alerts
- 🐛 **Pest Detection** - MobileNetV2 image analysis for disease identification
- 💰 **Market Prices** - Real-time Agmarknet integration with MSP comparison
- 🎤 **Voice Interface** - Google Cloud Speech-to-Text/TTS (5 languages)
- 📱 **Offline-First** - Full offline support with sync queue
- 📊 **Activity Logging** - Digital farming records with timestamps
- 🔐 **Security** - AES-256 encryption, JWT auth, rate limiting
- 🔔 **Push Notifications** - Firebase Cloud Messaging integration

## Tech Stack

### Mobile App (Expo SDK 54)
- **Framework**: Expo 54.0.0 with React Native 0.81.5
- **Language**: TypeScript 5.9.2
- **State Management**: Zustand 4.4.7
- **Navigation**: React Navigation 6.5.11
- **Storage**: Expo SecureStore, AsyncStorage, SQLite
- **Testing**: Jest 29.7.0 with fast-check 3.15.0 (property-based)
- **UI**: Expo Vector Icons, custom components

### Backend (NestJS)
- **Framework**: NestJS 10 with TypeScript 5.9.2
- **Database**: PostgreSQL 14 with Prisma ORM
- **Cache**: Redis 7 for session & data caching
- **Authentication**: JWT with Passport.js
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI at `/api/docs`
- **Testing**: Jest with fast-check (29 property-based tests)
- **Security**: Helmet, rate limiting, input sanitization, encryption

### ML Services (FastAPI)
- **Framework**: FastAPI with Python 3.9+
- **ML Models**: TensorFlow Lite (pest detection), scikit-learn (crop recommendations)
- **Image Processing**: Pillow, OpenCV
- **Voice**: Google Cloud Speech-to-Text/Text-to-Speech APIs
- **Testing**: Hypothesis property-based testing
- **Validation**: Pydantic schemas with comprehensive validation

## Quick Start

### Prerequisites

- **Node.js** 18+ with npm
- **Python** 3.9+
- **Docker** & **Docker Compose** (recommended)
- **PostgreSQL** 14+ (or use Docker)
- **Redis** 7+ (or use Docker)

### Installation & Running

**Option 1: Docker Compose (Recommended)**

```bash
# Clone and setup
git clone <repository-url>
cd smart-crop-advisory

# Copy environment template
cp backend/.env.example backend/.env

# Start all services
docker-compose up -d

# Services will be available at:
# - Backend API: http://localhost:3000
# - ML Service: http://localhost:8000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Swagger Docs: http://localhost:3000/api/docs
```

**Option 2: Manual Setup**

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev
# Runs on http://localhost:3000

# Terminal 2: ML Service
cd ml-service
pip install -r requirements.txt
python -m uvicorn main:app --reload
# Runs on http://localhost:8000

# Terminal 3: Mobile App
cd mobile
npm install
npx expo start --tunnel
# Scan QR code with Expo Go (Android) or Camera (iOS)
```

## API Documentation

- **Swagger UI**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health
- **ML Health**: http://localhost:8000/health

## Testing

### Run All Tests

```bash
# Backend tests (Jest + fast-check)
cd backend
npm test

# Mobile tests (Jest + fast-check)
cd mobile
npm test

# ML Service tests (Hypothesis)
cd ml-service
pytest
```

### Property-Based Testing

The project includes 29 correctness properties validated through property-based testing:

- **ML Service**: Pest detection, crop recommendations, error handling
- **Weather**: Data completeness, cache TTL, alert generation
- **Market**: Distance filtering, transportation costs, MSP comparison
- **Voice**: Language matching, multilingual intent recognition
- **Notifications**: Device registration, delivery tracking
- **Offline**: Cache access, sync processing, image queuing
- **Security**: Rate limiting, encryption, JWT validation, input sanitization
- **UX**: Error localization, session persistence

Run property tests:
```bash
cd backend && npm test -- --testPathPattern=property
cd mobile && npm test -- --testPathPattern=property
cd ml-service && pytest tests/
```

## Documentation

- **Requirements**: [.kiro/specs/project-finalization/requirements.md](.kiro/specs/project-finalization/requirements.md)
- **Design**: [.kiro/specs/project-finalization/design.md](.kiro/specs/project-finalization/design.md)
- **Implementation Tasks**: [.kiro/specs/project-finalization/tasks.md](.kiro/specs/project-finalization/tasks.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Quick Start**: [QUICK_START.md](QUICK_START.md)

## Environment Configuration

### Required API Keys

| Service | Purpose | Get Key From |
|---------|---------|--------------|
| OpenWeatherMap | Weather data | https://openweathermap.org/api |
| data.gov.in | Market prices (Agmarknet) | https://data.gov.in/ |
| Google Cloud | Voice services (STT/TTS) | https://console.cloud.google.com/ |
| Firebase | Push notifications | https://console.firebase.google.com/ |

See [backend/.env.example](backend/.env.example) for all configuration options.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Smart Crop Advisory                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Mobile App  │    │  Backend API │    │  ML Service  │   │
│  │ (Expo SDK54) │───▶│  (NestJS)    │───▶│  (FastAPI)   │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │                                 │
│         ┌───────────────────┼───────────────────┐            │
│         │                   │                   │            │
│         ▼                   ▼                   ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ PostgreSQL  │    │    Redis    │    │  External   │     │
│  │  (Database) │    │   (Cache)   │    │   APIs      │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Performance Metrics

- **API Response Time**: 95th percentile < 500ms
- **ML Inference**: < 10 seconds for pest detection
- **App Launch**: < 3 seconds on mid-range devices
- **Sync Completion**: < 2 minutes for 100 queued items
- **Cache Hit Rate**: > 80% for frequently accessed data

## Security Features

- ✅ AES-256 encryption for sensitive data at rest
- ✅ TLS 1.3 for all API communications
- ✅ JWT token validation with signature verification
- ✅ Rate limiting (100 requests/minute per user)
- ✅ Input sanitization (SQL injection & XSS prevention)
- ✅ File upload validation (type, size, magic bytes)
- ✅ Secure password hashing with bcrypt
- ✅ CORS configuration for production domains

## Troubleshooting

### Port Already in Use
```bash
# Kill process using port 8081 (mobile)
lsof -ti:8081 | xargs kill -9

# Kill process using port 3000 (backend)
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Reset database
docker-compose exec postgres psql -U postgres -d smart_crop_advisory -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### ML Service Not Responding
```bash
# Check ML service logs
docker-compose logs ml-service

# Verify models are loaded
curl http://localhost:8000/health
```

See [TROUBLESHOOTING.md](mobile/TROUBLESHOOTING.md) for more help.

## Contributing

This is a KSCST Student Project Programme submission. For questions or contributions, please contact the project team.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Karnataka State Council for Science and Technology (KSCST)
- Department of Higher Education, Government of Karnataka
- Agricultural universities and research institutions for data support
- OpenWeatherMap, data.gov.in, Google Cloud, and Firebase for API services
