#!/bin/bash
# Start chatbot service only (other services should already be running)

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting Chatbot Service..."
echo "=================================================="

# Set API key for development
export API_KEY="dev-api-key-12345"

# Start Chatbot Service (Port 3005)
cd "$PROJECT_ROOT/services/chatbot-service"
echo "Starting Chatbot Service on port 3005..."
node src/server.js > /tmp/chatbot.log 2>&1 &
CHATBOT_PID=$!
echo "  PID: $CHATBOT_PID"

# Wait for service to start
sleep 3

echo ""
echo "=================================================="
echo "✅ Chatbot Service started!"
echo "=================================================="
echo ""
echo "Service PID:"
echo "  Chatbot Service (3005): $CHATBOT_PID"
echo ""
echo "Security Configuration:"
echo "  🔑 API Key: dev-api-key-12345"
echo "  🤖 AI Provider: OpenRouter (Qwen Coder 480B)"
echo ""
echo "Logs located in: /tmp/chatbot.log"
echo ""
echo "Health check (no auth required):"
echo "  curl http://localhost:3005/health"
echo ""
echo "Test AI connection:"
echo "  curl http://localhost:3005/test-ai"
echo ""
echo "Ask a question:"
echo "  curl -X POST http://localhost:3005/api/chat/query \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-API-Key: dev-api-key-12345' \\"
echo "    -d '{\"mandt\":\"100\",\"question\":\"How many items are in stock?\"}'"
echo ""
