#!/bin/bash

# Docker Test Environment Script
# Starts the test environment for integration testing

set -e

echo "🚀 Starting Test Environment..."

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ docker is not installed. Please install docker first."
    exit 1
fi

# Start test services
echo "🐳 Starting test services..."
docker compose -f docker-compose.test.yml up -d

echo "✅ Test environment is ready!"
echo "📝 Services available:"
echo "  - Test PostgreSQL: localhost:5433"
echo "  - Test API: localhost:4001"
echo ""
echo "🛑 To stop: docker compose -f docker-compose.test.yml down"
