#!/bin/bash
# Script to start the S-GTIN Frontend Application
# This will start the SAP UI5 frontend on http://localhost:8080

echo "🚀 Starting S-GTIN Frontend Application"
echo "======================================="

# Navigate to frontend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PATH="$(cd "$SCRIPT_DIR/../frontend" && pwd)"

echo "📁 Navigating to frontend directory..."
cd "$FRONTEND_PATH"

# Kill any existing servers on port 8080
echo "🧹 Cleaning up existing servers..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || echo "No existing servers on port 8080"

# Check if http-server is installed globally
if ! command -v http-server &> /dev/null; then
    echo "⚠️  http-server not found. Installing http-server..."
    npm install -g http-server
fi

echo ""
echo "🌐 Starting HTTP development server..."
echo "📍 Frontend will be available at: http://localhost:8080"
echo "🎨 UI5 Theme: SAP Horizon"
echo "🔧 CORS: Enabled for API calls"
echo "📱 Responsive UI: SAP Fiori design"
echo ""
echo "🚀 Opening browser automatically..."
echo "Press Ctrl+C to stop the server"
echo "================================="

# Start the HTTP server with proper configuration for UI5
# -c-1 disables caching to ensure latest files are served
# --cors enables CORS for API calls
# -o opens browser automatically
# -S enables silent mode for cleaner output
http-server . -p 8080 -c-1 --cors -o

echo ""
echo "🛑 Server stopped. Frontend is no longer available."
