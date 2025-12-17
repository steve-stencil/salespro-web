#!/bin/bash

# Docker Development Environment Script
# Starts the development environment with hot reloading

set -e

echo "🚀 Starting Development Environment..."

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ docker is not installed. Please install docker first."
    exit 1
fi

# Start development services
echo "🐳 Starting development services..."
docker compose -f docker-compose.dev.yml up -d

echo "✅ Development environment is ready!"
echo "📝 Services available:"
echo "  - API: http://localhost:4000"
echo "  - Web: http://localhost:5173"
echo "  - PostgreSQL: localhost:5432"
echo ""
echo "🛑 To stop: docker compose -f docker-compose.dev.yml down"
