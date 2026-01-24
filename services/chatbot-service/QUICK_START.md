# Chatbot Service - Quick Start Guide

Get the chatbot service up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- All other services running (SGTIN, PO, Inventory, POS)
- PostgreSQL database set up
- OpenRouter API key (free at https://openrouter.ai)

## Step 1: Get OpenRouter API Key

1. Go to https://openrouter.ai
2. Sign up for a free account
3. Navigate to "Keys" section
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

## Step 2: Install Dependencies

```bash
cd services/chatbot-service
npm install
```

## Step 3: Configure Environment

The `.env` file is already created with your API key:

```env
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=qwen/qwq-32b-preview
```

**Note**: The model `qwen/qwq-32b-preview` is free tier on OpenRouter!

## Step 4: Start the Service

```bash
npm run dev
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

## Step 5: Test the Service

### Test 1: Health Check
```bash
curl http://localhost:3005/health
```

Expected response:
```json
{
  "status": "OK",
  "service": "Chatbot Service",
  "port": 3005,
  "ai": {
    "provider": "OpenRouter",
    "model": "qwen/qwq-32b-preview",
    "status": "Configured"
  }
}
```

### Test 2: Verify AI Connection
```bash
curl http://localhost:3005/test-ai
```

Expected response:
```json
{
  "success": true,
  "message": "OpenRouter AI is working",
  "response": "AI is working",
  "model": "qwen/qwq-32b-preview"
}
```

### Test 3: Ask a Question
```bash
curl -X POST http://localhost:3005/api/chat/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "mandt": "100",
    "question": "How many items are currently in stock?"
  }'
```

Expected response:
```json
{
  "success": true,
  "answer": "Based on the current inventory data, there are X items in stock...",
  "data": {
    "type": "INVENTORY_COUNT",
    "results": [...]
  },
  "conversationId": "uuid-here",
  "timestamp": "2026-01-22T11:20:00.000Z"
}
```

## Step 6: Run Comprehensive Tests

```bash
chmod +x test_chatbot.sh
./test_chatbot.sh
```

This will run 12+ test scenarios and verify all functionality.

## Common Questions to Try

Copy and paste these into your API calls:

1. **Inventory Status**
   ```
   What is the current inventory status?
   ```

2. **Purchase Orders**
   ```
   Show me all purchase orders
   ```

3. **Specific PO (replace with actual PO ID)**
   ```
   What is the status of PO 45000023?
   ```

4. **Location Query**
   ```
   Which items are in the warehouse?
   ```

5. **Count Query**
   ```
   How many items are currently in stock?
   ```

6. **Missing SGTINs**
   ```
   Which products don't have SGTINs yet?
   ```

7. **Counterfeit Detection**
   ```
   Show me recent counterfeit detection attempts
   ```

8. **Brand Query**
   ```
   Show me all items from ChocoDreams brand
   ```

## Troubleshooting

### Issue: "OpenRouter API failed"

**Solution**: 
- Verify your API key in `.env`
- Check https://openrouter.ai/keys to ensure key is active
- Ensure model name is exactly: `qwen/qwq-32b-preview`

### Issue: "Failed to fetch purchase order data"

**Solution**:
- Ensure PO service is running on port 3002
- Check `http://localhost:3002/health`
- Verify API_KEY matches in both services

### Issue: No data returned

**Solution**:
- Ensure database has data (run seed script)
- Check if other services are running
- Verify database connection in `.env`

### Issue: Service won't start

**Solution**:
- Check if port 3005 is already in use: `lsof -i :3005`
- Verify Node.js is installed: `node --version`
- Check for errors in console output

## Next Steps

1. ✅ Service is running
2. ✅ AI connection verified
3. ✅ Test queries working
4. 🔄 Integrate with frontend UI
5. 🔄 Customize system prompt if needed
6. 🔄 Add more query patterns

## Frontend Integration Example

```javascript
// In your UI5 controller or React component
async function askChatbot(question) {
  const response = await fetch('http://localhost:3005/api/chat/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'dev-api-key-12345'
    },
    body: JSON.stringify({
      mandt: '100',
      question: question,
      conversationId: this.conversationId // Store for follow-ups
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Display answer in UI
    console.log(data.answer);
    
    // Store conversation ID for follow-up questions
    this.conversationId = data.conversationId;
    
    // Access structured data if needed
    console.log(data.data);
  }
}
```

## API Documentation

Full interactive API docs available at:
**http://localhost:3005/api-docs**

## Support

- Check `README.md` for detailed documentation
- Review test script for more examples
- Examine logs for debugging information

## Success! 🎉

Your chatbot service is now ready to answer questions about your SGTIN Lifecycle Management System!

Try asking:
- "What's the status of my inventory?"
- "Show me all purchase orders"
- "How many items are in stock?"
- "Which products need SGTINs?"
