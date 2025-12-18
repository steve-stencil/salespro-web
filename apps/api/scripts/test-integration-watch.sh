#!/bin/bash

# Integration Test Watch Script for API
# This script starts PostgreSQL test service and runs integration tests in watch mode

set -e

echo "🚀 Starting API Integration Tests in Watch Mode..."

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ docker is not installed. Please install docker first."
    exit 1
fi

# Start PostgreSQL test service
echo "🐳 Starting PostgreSQL test service..."
docker compose -f docker-compose.test.yml up -d postgres-test

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres -d salespro_test > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready!"

# Run integration tests in watch mode
echo "🔧 Running integration tests in watch mode..."
echo "💡 Press Ctrl+C to stop watching and clean up PostgreSQL service"
vitest --config vitest.integration.config.ts

# Clean up PostgreSQL test service when watch mode is stopped
echo "🧹 Cleaning up PostgreSQL test service..."
docker compose -f docker-compose.test.yml down

echo "✅ Integration tests watch mode completed!"
