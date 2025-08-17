#!/bin/bash

# SRE Assignment Startup Script (Fixed)
# This script starts the entire application stack

set -e

echo "🚀 Starting SRE Assignment Application"
echo "======================================"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker compose is available (try both commands)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Neither docker-compose nor docker compose is available. Please install Docker Compose."
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"

# Stop and remove any existing containers
echo "🧹 Cleaning up existing containers..."
$DOCKER_COMPOSE down --volumes --remove-orphans 2>/dev/null || true

# Build and start all services
echo "🏗️  Building and starting services..."
$DOCKER_COMPOSE up --build -d

# Function to wait for a service with timeout
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local timeout=${3:-300}  # Default 5 minutes
    local count=0
    
    echo "Waiting for $service_name..."
    while [ $count -lt $timeout ]; do
        if eval $check_command &> /dev/null; then
            echo "  ✅ $service_name is ready"
            return 0
        fi
        echo "  ⏳ Waiting for $service_name... ($count/$timeout)"
        sleep 5
        count=$((count + 5))
    done
    
    echo "  ⚠️  $service_name took too long to start, but continuing..."
    return 1
}

# Wait for services with proper health checks
echo ""
echo "🔍 Checking service health..."

# Wait for TiDB
wait_for_service "TiDB" "docker exec tidb-server mysqladmin ping -h 127.0.0.1 -P 4000 --silent" 120

# Wait for Kafka
wait_for_service "Kafka" "docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092" 60

# Wait for API
wait_for_service "API" "curl -f http://localhost:3001/health" 60

# Check Frontend (it should be ready if API is ready)
if curl -f http://localhost:3000 &> /dev/null; then
    echo "  ✅ Frontend is ready"
else
    echo "  ⚠️  Frontend may still be starting..."
fi

# Check overall status
echo ""
echo "📊 Service Status:"
$DOCKER_COMPOSE ps

echo ""
echo "🎉 SRE Assignment Application is now running!"
echo "============================================="
echo ""
echo "📱 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:3001"
echo "   API Health: http://localhost:3001/health"
echo ""
echo "🔐 Default Login Credentials:"
echo "   Email:    admin@sre-assignment.local"
echo "   Password: admin123"
echo ""
echo "🔧 Infrastructure Components:"
echo "   TiDB:     localhost:4000"
echo "   Kafka:    localhost:9092"
echo "   TiCDC:    localhost:8300"
echo ""
echo "📊 Monitoring Features Active:"
echo "   ✅ User activity logging (log4js)"
echo "   ✅ Database change data capture (TiCDC)"
echo "   ✅ Kafka message processing"
echo "   ✅ Real-time structured logging"
echo ""
echo "📝 View Logs:"
echo "   $DOCKER_COMPOSE logs -f api      # API logs"
echo "   $DOCKER_COMPOSE logs -f consumer # Consumer logs"
echo "   $DOCKER_COMPOSE logs -f ticdc    # TiCDC logs"
echo ""
echo "🛑 To stop the application:"
echo "   $DOCKER_COMPOSE down"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "   Please change the default password immediately!"
echo ""

# Final check
echo "🔍 Final connectivity test..."
if curl -f http://localhost:3000 &> /dev/null && curl -f http://localhost:3001/health &> /dev/null; then
    echo "✅ All services are accessible!"
    echo ""
    echo "🌐 Ready to use: http://localhost:3000"
else
    echo "⚠️  Some services may still be starting. Please wait a moment and check manually."
    echo "   Frontend: http://localhost:3000"
    echo "   API: http://localhost:3001/health"
fi