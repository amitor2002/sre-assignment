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
