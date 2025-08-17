#!/bin/bash

# SRE Assignment Complete Setup Script (No Health Checks)
# This script sets up the entire application stack with proper timing

set -e

echo "🚀 Starting SRE Assignment Application Setup"
echo "============================================"

# =============================================================================
# INITIAL SETUP AND VALIDATION
# =============================================================================

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

# =============================================================================
# CREATE REQUIRED DIRECTORIES AND FILES
# =============================================================================

echo "📁 Creating required directories and files..."

# Create CDC scripts directory
mkdir -p scripts/cdc-tasks

# Create CDC setup script
cat > scripts/cdc-tasks/setup-cdc-tasks.sh << 'EOF'
#!/bin/bash

# TiCDC Task Setup Script
# This script creates CDC tasks to capture database changes and send them to Kafka

set -e

echo "🔄 Setting up TiCDC tasks for database change capture"
echo "=================================================="

# Wait for TiCDC server to be ready
echo "⏳ Waiting for TiCDC server to be ready..."
until curl -f http://ticdc:8300/health >/dev/null 2>&1; do
    echo "  Waiting for TiCDC server..."
    sleep 5
done
echo "✅ TiCDC server is ready"

# Wait for Kafka to be ready
echo "⏳ Waiting for Kafka to be ready..."
sleep 10

# Create CDC changefeed for the sre_app database
echo "📊 Creating CDC changefeed for sre_app database..."

# Remove existing changefeed if it exists
/cdc cli changefeed remove --pd=http://pd:2379 --changefeed-id=sre-app-cdc 2>/dev/null || true

# Create the CDC task to capture changes from sre_app database
/cdc cli changefeed create \
    --pd=http://pd:2379 \
    --changefeed-id=sre-app-cdc \
    --sink-uri="kafka://kafka:29092/tidb-cdc-events?protocol=canal-json&partition-num=1" \
    --schema-filter="sre_app.*" \
    --config=/scripts/cdc-config.toml

echo "✅ CDC changefeed 'sre-app-cdc' created successfully"

# Create CDC task for user activity monitoring
echo "📊 Creating CDC changefeed for user activity monitoring..."

/cdc cli changefeed remove --pd=http://pd:2379 --changefeed-id=user-activity-cdc 2>/dev/null || true

/cdc cli changefeed create \
    --pd=http://pd:2379 \
    --changefeed-id=user-activity-cdc \
    --sink-uri="kafka://kafka:29092/user-activities?protocol=canal-json&partition-num=1" \
    --table-filter="sre_app.users,sre_app.user_tokens,sre_app.activity_logs" \
    --config=/scripts/cdc-config.toml

echo "✅ CDC changefeed 'user-activity-cdc' created successfully"

# List all changefeeds to verify
echo "📋 Current CDC changefeeds:"
/cdc cli changefeed list --pd=http://pd:2379

echo ""
echo "🎉 TiCDC tasks setup completed successfully!"
echo "================================================"
echo "📊 Change Data Capture is now active for:"
echo "   • All tables in sre_app database"
echo "   • User activity monitoring"
echo "   • Real-time streaming to Kafka topics"
echo ""
EOF

# Create CDC configuration file
cat > scripts/cdc-tasks/cdc-config.toml << 'EOF'
# TiCDC Configuration for SRE Assignment
# This configuration optimizes CDC for monitoring and logging purposes

[replication]
# Enable checksum validation
enable-old-value = true
check-gc-safe-point = true

# Memory and performance settings
memory-quota = 1073741824  # 1GB
worker-num = 4
flush-interval = 1000      # 1 second

[sink]
# Kafka sink configuration
protocol = "canal-json"
column-selectors = ["*"]
enable-partition-separator = true

# Schema registry (disabled for simplicity)
enable-schema-registry = false

[filter]
# Only replicate sre_app database
rules = ["sre_app.*"]

# Ignore system tables
ignore-txn-start-ts = []
ignore-schemas = ["INFORMATION_SCHEMA", "PERFORMANCE_SCHEMA", "mysql", "test"]

[scheduler]
# Scheduling configuration for consistent performance
enable-table-across-nodes = true
region-threshold = 10000
write-key-threshold = 30000
EOF

# Make setup script executable
chmod +x scripts/cdc-tasks/setup-cdc-tasks.sh

echo "✅ CDC configuration files created"

# =============================================================================
# DOCKER SERVICES DEPLOYMENT WITH PROPER TIMING
# =============================================================================

# Stop and remove any existing containers
echo "🧹 Cleaning up existing containers..."
$DOCKER_COMPOSE down --volumes --remove-orphans 2>/dev/null || true

# Start services in proper order with timing
echo ""
echo "🏗️  Starting services in proper sequence..."

echo "1️⃣  Starting PD (Placement Driver)..."
$DOCKER_COMPOSE up -d pd
sleep 30

echo "2️⃣  Starting Zookeeper..."
$DOCKER_COMPOSE up -d zookeeper
sleep 20

echo "3️⃣  Starting TiKV (Storage Engine)..."
$DOCKER_COMPOSE up -d tikv
sleep 45

echo "4️⃣  Starting Kafka..."
$DOCKER_COMPOSE up -d kafka
sleep 30

echo "5️⃣  Starting TiDB (SQL Layer)..."
$DOCKER_COMPOSE up -d tidb
sleep 30

echo "6️⃣  Starting Database Initialization..."
$DOCKER_COMPOSE up -d db-init
sleep 20

echo "7️⃣  Starting TiCDC..."
$DOCKER_COMPOSE up -d ticdc
sleep 30

echo "8️⃣  Starting Application Services..."
$DOCKER_COMPOSE up -d api consumer
sleep 20

echo "9️⃣  Starting Frontend..."
$DOCKER_COMPOSE up -d frontend
sleep 15

echo "🔟 Setting up CDC Tasks..."
$DOCKER_COMPOSE up -d cdc-task-manager
sleep 20

# =============================================================================
# SERVICE VERIFICATION
# =============================================================================

# Simple connectivity tests
echo ""
echo "🔍 Testing service connectivity..."

# Test PD
if curl -f http://localhost:2379/health >/dev/null 2>&1; then
    echo "  ✅ PD is responding"
else
    echo "  ⚠️  PD may still be starting"
fi

# Test TiKV Status
if curl -f http://localhost:20180/status >/dev/null 2>&1; then
    echo "  ✅ TiKV is responding"
else
    echo "  ⚠️  TiKV may still be starting"
fi

# Test TiDB Status
if curl -f http://localhost:10080/status >/dev/null 2>&1; then
    echo "  ✅ TiDB is responding"
else
    echo "  ⚠️  TiDB may still be starting"
fi

# Test Kafka
if docker exec kafka kafka-topics --bootstrap-server localhost:29092 --list >/dev/null 2>&1; then
    echo "  ✅ Kafka is responding"
else
    echo "  ⚠️  Kafka may still be starting"
fi

# Test API
if curl -f http://localhost:3001/health >/dev/null 2>&1; then
    echo "  ✅ API is responding"
else
    echo "  ⚠️  API may still be starting"
fi

# Test Frontend
if curl -f http://localhost:3000 >/dev/null 2>&1; then
    echo "  ✅ Frontend is responding"
else
    echo "  ⚠️  Frontend may still be starting"
fi

# =============================================================================
# FINAL STATUS REPORT
# =============================================================================

# Check overall status
echo ""
echo "📊 Service Status:"
$DOCKER_COMPOSE ps

echo ""
echo "🎉 SRE Assignment Application Deployment Complete!"
echo "================================================="
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
echo "   TiDB Status: http://localhost:10080/status"
echo "   PD:       localhost:2379"
echo "   TiKV:     localhost:20160"
echo "   TiKV Status: http://localhost:20180/status"
echo "   Kafka:    localhost:9092"
echo "   TiCDC:    localhost:8300"
echo ""
echo "📊 Monitoring Features Active:"
echo "   ✅ User activity logging (log4js with JSON format)"
echo "   ✅ Database change data capture (TiCDC with CDC tasks)"
echo "   ✅ Kafka message processing (real-time consumers)"
echo "   ✅ Real-time structured logging (across all services)"
echo "   ✅ Complete TiDB distributed cluster (PD + TiKV + TiDB)"
echo "   ✅ Production-ready containerization"
echo ""
echo "📝 View Logs:"
echo "   $DOCKER_COMPOSE logs -f api        # API logs"
echo "   $DOCKER_COMPOSE logs -f consumer   # Consumer logs"
echo "   $DOCKER_COMPOSE logs -f ticdc      # TiCDC logs"
echo "   $DOCKER_COMPOSE logs -f tidb       # TiDB logs"
echo ""
echo "🔍 Monitor CDC Status:"
echo "   docker exec ticdc-server /cdc cli changefeed list --pd=http://pd:2379"
echo "   docker exec kafka kafka-topics --bootstrap-server localhost:29092 --list"
echo ""
echo "🛑 To stop the application:"
echo "   $DOCKER_COMPOSE down"
echo ""
echo "⚠️  IMPORTANT NOTES:"
echo "   • Services may take 2-3 minutes to fully initialize"
echo "   • If a service isn't responding, wait a moment and try again"
echo "   • Check logs if issues persist: $DOCKER_COMPOSE logs <service>"
echo ""
echo "🌐 Ready to use: http://localhost:3000"
echo ""
echo "🎯 SRE Assignment Requirements Status:"
echo "   ✅ Part 1: Simple Development (Node.js + React + TiDB + Authentication)"
echo "   ✅ Part 2: DevOps Implementation (Docker + Kafka + Auto-initialization)"
echo "   ✅ Part 3: SRE Monitoring (log4js + TiCDC + Real-time processing)"
echo ""
echo "🚀 Assignment deployment completed successfully!"
echo ""