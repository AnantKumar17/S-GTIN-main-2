# How to Start the Chatbot Service

## Prerequisites ✅
- [x] Dependencies are installed (node_modules copied)
- [x] Configuration file (.env) is set up with OpenRouter API key
- [x] All other services (SGTIN, PO, Inventory, POS) are running

## Option 1: Start Manually from VS Code Terminal

1. Open a new terminal in VS Code
2. Navigate to the chatbot service:
   ```bash
   cd services/chatbot-service
   ```
3. Start the service:
   ```bash
   node src/server.js
   ```

You should see:
```
🚀 Chatbot Service running on port 3005
📚 API Documentation: http://localhost:3005/api-docs
🏥 Health check: http://localhost:3005/health
🤖 AI Provider: OpenRouter (qwen/qwq-32b-preview)
🔐 Security: Authentication (API Key) + Rate Limiting ENABLED
🔑 API Key: dev-api-key-12345 (development default)
🧪 Test AI: http://localhost:3005/test-ai
```

## Option 2: Use the Start Script

```bash
bash readme_test_scripts_and_test_results/start_chatbot_service.sh
```

Note: This requires `node` to be in your PATH.

## Verify It's Running

Once started, test it:

```bash
# Health check
curl http://localhost:3005/health

# Test AI connection
curl http://localhost:3005/test-ai

# Ask a question
curl -X POST http://localhost:3005/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{"mandt":"100","question":"How many items are in stock?"}'
```

## Quick Test Questions

Once the service is running, try these:

### Question 1: How many items are currently in stock?
```bash
curl -X POST http://localhost:3005/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{"mandt":"100","question":"How many items are currently in stock?"}'
```

### Question 2: Which products don't have SGTINs yet?
```bash
curl -X POST http://localhost:3005/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{"mandt":"100","question":"Which products dont have SGTINs yet?"}'
```

### Question 3: Show me all items in Warehouse A
```bash
curl -X POST http://localhost:3005/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{"mandt":"100","question":"Show me all items in Warehouse A"}'
```

### Question 4: What is the status of PO 45000023?
```bash
curl -X POST http://localhost:3005/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{"mandt":"100","question":"What is the status of PO 45000023?"}'
```

## Troubleshooting

### If you get "node: command not found"
The node executable is not in your PATH for the current shell. Try:
1. Opening a new terminal in VS Code
2. Checking your node installation: `which node` or `node --version`
3. If using nvm: `nvm use` to activate node

### If port 3005 is already in use
```bash
# Find what's using the port
lsof -i :3005

# Kill it if needed
kill -9 <PID>
```

### If AI responses fail
- Verify your OpenRouter API key in `.env`
- Check `/tmp/chatbot.log` for errors
- Ensure other services are running (ports 3001-3004)
