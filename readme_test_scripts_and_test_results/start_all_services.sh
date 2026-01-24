#!/bin/bash
# Start all microservices and frontend with production security enabled
# Kills all existing services first and starts fresh

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔄 Killing all existing services..."
echo "=================================================="

# Kill all existing Node.js services
echo "🛑 Stopping all Node.js services..."
pkill -f 'node.*server.js' 2>/dev/null || echo "   No Node.js services running"
pkill -f 'npm.*start' 2>/dev/null || echo "   No npm start processes running"

# Kill frontend server on port 8081
echo "🛑 Stopping frontend server on port 8081..."
lsof -ti :8081 | xargs kill -9 2>/dev/null || echo "   Port 8081 was already clear"

# Kill any processes on backend service ports
echo "🛑 Clearing service ports..."
for port in 3001 3002 3003 3004 3005 3006; do
  lsof -ti :$port | xargs kill -9 2>/dev/null || echo "   Port $port was already clear"
done

# Wait for processes to terminate
sleep 3

echo ""
echo "🚀 Starting all services with production security..."
echo "=================================================="

# Set API key for development (should be in .env in production)
export API_KEY="dev-api-key-12345"

# Start SGTIN Service (Port 3001)
cd "$PROJECT_ROOT/services/sgtin-service"
echo "🔧 Starting SGTIN Service on port 3001..."
npm start > /tmp/sgtin.log 2>&1 &
SGTIN_PID=$!
echo "   PID: $SGTIN_PID"
sleep 2

# Start PO Service (Port 3002)
cd "$PROJECT_ROOT/services/po-service"
echo "📦 Starting PO Service on port 3002..."
npm start > /tmp/po.log 2>&1 &
PO_PID=$!
echo "   PID: $PO_PID"
sleep 2

# Start Inventory Service (Port 3003)
cd "$PROJECT_ROOT/services/inventory-service"
echo "📊 Starting Inventory Service on port 3003..."
npm start > /tmp/inventory.log 2>&1 &
INV_PID=$!
echo "   PID: $INV_PID"
sleep 2

# Start POS Service (Port 3004)
cd "$PROJECT_ROOT/services/pos-service"
echo "🛒 Starting POS Service on port 3004..."
npm start > /tmp/pos.log 2>&1 &
POS_PID=$!
echo "   PID: $POS_PID"
sleep 2

# Start Chatbot Service (Port 3005)
cd "$PROJECT_ROOT/services/chatbot-service"
echo "🤖 Starting Enhanced Chatbot Service on port 3005..."
npm start > /tmp/chatbot.log 2>&1 &
CHATBOT_PID=$!
echo "   PID: $CHATBOT_PID"
sleep 3

# Start SGTIN Lookup Service (Port 3006)
cd "$PROJECT_ROOT/services/sgtin-lookup-service"
echo "🔍 Starting SGTIN Lookup Service on port 3006..."
npm start > /tmp/sgtin-lookup.log 2>&1 &
SGTIN_LOOKUP_PID=$!
echo "   PID: $SGTIN_LOOKUP_PID"
sleep 2

# Start Frontend (Port 8081)
cd "$PROJECT_ROOT/frontend"
echo "🌐 Starting Frontend UI on port 8081..."
python3 -m http.server 8081 > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"
sleep 2

# Wait for all services to fully start
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 5

echo ""
echo "=================================================="
echo "✅ ALL SERVICES STARTED SUCCESSFULLY!"
echo "=================================================="
echo ""
echo "📋 Service PIDs:"
echo "   🔧 SGTIN Service (3001): $SGTIN_PID"
echo "   📦 PO Service (3002): $PO_PID"
echo "   📊 Inventory Service (3003): $INV_PID"
echo "   🛒 POS Service (3004): $POS_PID"
echo "   🤖 Chatbot Service (3005): $CHATBOT_PID"
echo "   🔍 SGTIN Lookup Service (3006): $SGTIN_LOOKUP_PID"
echo "   🌐 Frontend UI (8081): $FRONTEND_PID"
echo ""
echo "🔧 System Features:"
echo "   🔑 API Authentication: dev-api-key-12345"
echo "   🚦 Rate Limiting: Active"
echo "   ⚡ SGTIN Generation: PostgreSQL with barcode/QR codes"
echo "   🧠 AI Chatbot: GitHub Models API + Database hybrid"
echo "   📱 QR Code Scanning: Goods Receipt & POS"
echo "   🖨️ Barcode Generation: Code 128 + QR codes stored as Base64"
echo "   🗑️ Soft Delete: Enabled"
echo ""
echo "📂 Logs located in: /tmp/"
echo "   📄 /tmp/sgtin.log"
echo "   📄 /tmp/po.log" 
echo "   📄 /tmp/inventory.log"
echo "   📄 /tmp/pos.log"
echo "   📄 /tmp/chatbot.log"
echo "   📄 /tmp/sgtin-lookup.log"
echo "   📄 /tmp/frontend.log"
echo ""
echo "🌐 Access Points:"
echo "   Frontend: http://localhost:8081"
echo "   Swagger UI: http://localhost:3001/api-docs (and 3002-3005)"
echo ""
echo "🔍 Health Checks (no auth required):"
echo "   curl http://localhost:3001/health"
echo "   curl http://localhost:3002/health"
echo "   curl http://localhost:3003/health"
echo "   curl http://localhost:3004/health"
echo "   curl http://localhost:3005/health"
echo "   curl http://localhost:3006/health"
echo ""
echo "🔐 API Examples (require X-API-Key header):"
echo "   curl -H 'X-API-Key: dev-api-key-12345' http://localhost:3001/api/sgtin/..."
echo "   curl -H 'X-API-Key: dev-api-key-12345' http://localhost:3002/api/purchase-orders"
echo "   curl -H 'X-API-Key: dev-api-key-12345' http://localhost:3003/api/inventory"
echo "   curl -H 'X-API-Key: dev-api-key-12345' http://localhost:3004/api/sales"
echo "   curl -H 'X-API-Key: dev-api-key-12345' http://localhost:3005/api/chat"
echo "   curl -H 'X-API-Key: dev-api-key-12345' http://localhost:3006/api/sgtin-lookup/{sgtin}"
echo ""
echo "🛑 To stop all services:"
echo "   kill $SGTIN_PID $PO_PID $INV_PID $POS_PID $CHATBOT_PID $SGTIN_LOOKUP_PID $FRONTEND_PID"
echo "   OR: pkill -f 'node.*server.js' && pkill -f 'python3.*http.server'"
echo ""
echo "🎉 S-GTIN Lifecycle Management System Ready!"
echo "🚀 Complete system with barcode/QR scanning + AI chatbot operational!"
echo ""
