# =============================================================================
# Smart Crop Advisory System - ML Service Dockerfile
# =============================================================================
# Multi-stage build for optimized production image
# =============================================================================

FROM python:3.9-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first
COPY requirements.txt .

# Install heavy dependencies first for better caching and stability
RUN pip install --no-cache-dir --user --default-timeout=1000 --retries=10 tensorflow==2.16.1 tensorflow-datasets==4.10.0

# Install remaining dependencies from requirements.txt
RUN pip install --no-cache-dir --user --default-timeout=1000 --retries=10 -r requirements.txt

# =============================================================================
# Production Stage
# =============================================================================
FROM python:3.9-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY . .

# Create models directory with proper permissions
RUN mkdir -p /app/models && chmod 755 /app/models

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash mluser \
    && chown -R mluser:mluser /app

# Switch to non-root user (commented out for volume permissions)
# USER mluser

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SERVICE_HOST=0.0.0.0 \
    SERVICE_PORT=8000 \
    MODEL_DIR=/app/models

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
