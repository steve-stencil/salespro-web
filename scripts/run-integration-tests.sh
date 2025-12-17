#!/bin/bash

# Integration Test Runner Script
# This script runs integration tests for the monorepo

set -e

echo "🚀 Starting Integration Tests..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first."
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ docker is not installed. Please install docker first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
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

# Run API integration tests
echo "🔧 Running API integration tests..."
cd apps/api
pnpm exec vitest run --config vitest.integration.config.ts
cd ../..

# Run Web integration tests
echo "🌐 Running Web integration tests..."
cd apps/web
pnpm test:integration
cd ../..

# Run Shared package tests (if any)
echo "📦 Running Shared package tests..."
cd packages/shared
pnpm test
cd ../..

# Clean up PostgreSQL test service
echo "🧹 Cleaning up PostgreSQL test service..."
docker compose stop postgres-test

echo "✅ All integration tests completed successfully!"
