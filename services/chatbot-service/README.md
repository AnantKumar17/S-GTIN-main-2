# Chatbot Service - SGTIN Lifecycle Management System

Intelligent Q&A chatbot service powered by OpenRouter AI that provides natural language querying capabilities for the SGTIN Lifecycle Management System.

## Features

- **Natural Language Processing**: Ask questions in plain English about your inventory, purchase orders, SGTINs, and more
- **Context-Aware Conversations**: Maintains conversation history for follow-up questions
- **RAG (Retrieval-Augmented Generation)**: Fetches relevant data from all microservices before generating responses
- **Multi-Service Integration**: Queries SGTIN, PO, Inventory, and POS services to provide comprehensive answers
- **OpenRouter AI Integration**: Uses Qwen Coder 480B model via OpenRouter.ai (free tier)

## Architecture

### Components

1. **OpenRouter Client** (`src/utils/openRouterClient.js`)
   - Handles communication with OpenRouter AI API
   - Supports chat completions with customizable parameters
   - Includes streaming support for future enhancements

2. **Query Analyzer** (`src/utils/queryAnalyzer.js`)
   - Extracts entities (PO numbers, GTINs, SGTINs, locations, etc.)
   - Determines query intent (inventory, purchase orders, sales, etc.)
   - Fetches relevant data from appropriate microservices
   - Builds context for AI to generate accurate responses

3. **Chatbot Controller** (`src/controllers/chatbotController.js`)
   - Processes user questions
   - Manages conversation state
   - Stores conversation history in database
   - Generates AI-powered responses

4. **Routes** (`src/routes/chat.js`)
   - POST `/api/chat/query` - Ask questions
   - GET `/api/chat/suggested-queries` - Get example queries
   - GET `/api/chat/history` - Retrieve conversation history

## Configuration

### Environment Variables

Create a `.env` file in the `services/chatbot-service` directory:

```env
PORT=3005
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sgtin_db
DB_USER=I528623
DB_PASSWORD=

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=qwen/qwq-32b-preview
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Internal Service URLs
SGTIN_SERVICE_URL=http://localhost:3001
PO_SERVICE_URL=http://localhost:3002
INVENTORY_SERVICE_URL=http://localhost:3003
POS_SERVICE_URL=http://localhost:3004

# API Key for internal service calls
API_KEY=dev-api-key-12345
```

### OpenRouter Setup

1. Sign up at https://openrouter.ai
2. Get your API key from the dashboard
3. The Qwen Coder 480B model is free tier (no credits required)
4. Update `OPENROUTER_API_KEY` in `.env`

## Installation

```bash
cd services/chatbot-service
npm install
```

## Running the Service

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The service will run on **http://localhost:3005**

## API Endpoints

### 1. Health Check
```bash
GET /health

Response:
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

### 2. Test AI Connection
```bash
GET /test-ai

Response:
{
  "success": true,
  "message": "OpenRouter AI is working",
  "response": "AI is working",
  "model": "qwen/qwq-32b-preview"
}
```

### 3. Ask a Question
```bash
POST /api/chat/query
Headers:
  Content-Type: application/json
  X-API-Key: dev-api-key-12345

Body:
{
  "mandt": "100",
  "question": "What is the status of purchase orders?",
  "conversationId": "optional-conversation-id"
}

Response:
{
  "success": true,
  "answer": "Based on the current data, there are X purchase orders...",
  "data": {
    "type": "PO_STATUS",
    "results": [...]
  },
  "conversationId": "uuid",
  "timestamp": "2026-01-22T11:20:00.000Z"
}
```

### 4. Get Suggested Queries
```bash
GET /api/chat/suggested-queries?mandt=100
Headers:
  X-API-Key: dev-api-key-12345

Response:
{
  "success": true,
  "queries": [
    {
      "category": "PURCHASE_ORDERS",
      "question": "What is the status of purchase orders?",
      "description": "Get overview of all purchase orders and their statuses"
    },
    ...
  ]
}
```

### 5. Get Conversation History
```bash
GET /api/chat/history?mandt=100&conversationId=uuid
Headers:
  X-API-Key: dev-api-key-12345

Response:
{
  "success": true,
  "conversationId": "uuid",
  "messages": [
    {
      "role": "user",
      "content": "How many items are in stock?",
      "timestamp": "2026-01-22T11:20:00.000Z"
    },
    {
      "role": "assistant",
      "content": "There are currently 150 items in stock...",
      "timestamp": "2026-01-22T11:20:05.000Z"
    }
  ]
}
```

## Example Questions

### Purchase Orders
- "What is the status of purchase orders?"
- "Show me all open purchase orders"
- "What is the status of PO 45000023?"
- "Which purchase orders are partially received?"

### Inventory
- "How many items are currently in stock?"
- "Show inventory in warehouse locations"
- "Which items are in Warehouse A?"
- "What's the location of SGTIN 01040123456789012110000000001?"

### Products & SGTINs
- "Which products don't have SGTINs yet?"
- "Show me all items from ChocoDreams brand"
- "List all items with batch number XYZ"
- "Trace the lifecycle of SGTIN 01040123456789012110000000001"

### Sales & Counterfeit
- "Show me recent counterfeit detection attempts"
- "How many counterfeit items were detected today?"
- "List all fraud detection logs"

### Complex Queries
- "Show me all items that are in stock in the warehouse and tell me which suppliers they came from"
- "What's the status of items from the latest purchase order?"
- "How many items have been received but not yet sold?"

## Testing

Run the comprehensive test suite:

```bash
chmod +x test_chatbot.sh
./test_chatbot.sh
```

The test script will:
1. Verify service is running
2. Test OpenRouter AI connection
3. Run 12+ different query scenarios
4. Test conversation context and history
5. Provide detailed results

## Query Intent Types

The system recognizes these intents:

- **PO_STATUS**: Purchase order status queries
- **PO_LIST**: List all purchase orders
- **INVENTORY_STATUS**: Inventory status and counts
- **INVENTORY_LOCATION**: Location-based queries
- **MISSING_SGTINS**: Products without serialized items
- **SGTIN_TRACE**: SGTIN lifecycle tracking
- **COUNTERFEIT**: Fraud detection logs
- **BRAND_QUERY**: Brand-specific queries
- **STATISTICS**: Overall statistics and summaries

## Data Context Building

For each query, the system:

1. **Extracts Entities**: Identifies PO numbers, GTINs, locations, statuses, brands
2. **Determines Intent**: Classifies the type of query
3. **Fetches Data**: Calls relevant microservice APIs
4. **Builds Context**: Structures data for AI consumption
5. **Generates Response**: AI creates natural language answer
6. **Returns Result**: Sends answer + structured data to frontend

## Conversation Management

- **In-Memory Storage**: Active conversations stored in memory for quick access
- **Database Persistence**: Conversations saved to PostgreSQL for history
- **Context Window**: Last 10 messages included for context
- **Conversation ID**: UUID-based identification for tracking

## Error Handling

The service handles:
- OpenRouter API failures (with clear error messages)
- Microservice unavailability (graceful degradation)
- Invalid queries (helpful error responses)
- Rate limiting (via shared middleware)
- Database connection issues (in-memory fallback)

## Performance Considerations

- **Timeout**: 60-second timeout for OpenRouter API calls
- **Rate Limiting**: Lenient rate limiter applied (via shared middleware)
- **Caching**: Consider implementing Redis for conversation cache
- **Token Limits**: Max 1500 tokens per response (configurable)

## Security

- **API Key Authentication**: Required for all chat endpoints
- **Rate Limiting**: Prevents abuse
- **Input Validation**: Sanitizes user input
- **Internal Service Auth**: Uses API key for microservice calls

## Integration with Frontend

The frontend can integrate using these steps:

```javascript
// Example: Ask a question
const response = await fetch('http://localhost:3005/api/chat/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'dev-api-key-12345'
  },
  body: JSON.stringify({
    mandt: '100',
    question: 'How many items are in stock?',
    conversationId: conversationId // optional, for follow-ups
  })
});

const data = await response.json();
console.log(data.answer); // AI-generated response
console.log(data.data); // Structured data
console.log(data.conversationId); // For follow-up questions
```

## Troubleshooting

### OpenRouter API Key Not Working
- Verify key is correct in `.env`
- Check https://openrouter.ai/keys for key status
- Ensure model name is exact: `qwen/qwq-32b-preview`

### Service Not Connecting to Other Microservices
- Verify all services are running (ports 3001-3004)
- Check service URLs in `.env`
- Verify API_KEY matches across services

### Database Connection Issues
- Check PostgreSQL is running
- Verify database credentials in `.env`
- Ensure `chat_conversations` and `chat_messages` tables exist

### AI Responses Are Inaccurate
- Check if relevant data is being fetched (check logs)
- Verify microservice APIs are returning correct data
- Adjust system prompt if needed

## API Documentation

Interactive API documentation available at:
**http://localhost:3005/api-docs**

## Future Enhancements

- [ ] Streaming responses for real-time updates
- [ ] Redis caching for conversations
- [ ] Multi-language support
- [ ] Voice input/output
- [ ] Advanced analytics and insights
- [ ] Export conversation history
- [ ] Custom AI model fine-tuning
- [ ] Integration with SAP systems

## License

ISC

## Support

For issues or questions, contact the development team or check the main project README.
