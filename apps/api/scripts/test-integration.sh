#!/bin/bash

# Integration Test Script for API
# This script starts PostgreSQL test service and runs integration tests

set -e

echo "🚀 Starting API Integration Tests..."

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ docker is not installed. Please install docker first."
    exit 1
fi

# Start PostgreSQL test service
echo "🐳 Starting PostgreSQL test service..."
docker compose up -d postgres-test

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres-test pg_isready -U postgres -d salespro_test > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready!"

# Optional: Use Docker health check if available
if docker compose ps postgres-test | grep -q "healthy"; then
    echo "✅ PostgreSQL health check passed!"
fi

# Run integration tests
echo "🔧 Running integration tests..."
vitest run --config vitest.integration.config.ts

# Clean up PostgreSQL test service
echo "🧹 Cleaning up PostgreSQL test service..."
docker compose stop postgres-test

echo "✅ Integration tests completed!"
