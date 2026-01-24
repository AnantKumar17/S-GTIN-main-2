const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes  
const chatRoutes = require('./routes/chat');

// Mount routes
app.use('/api/chat', chatRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'chatbot-service',
    version: '3.0.0-simplified',
    features: {
      llm_first: 'active',
      github_models_api: process.env.GITHUB_TOKEN ? 'configured' : 'not_configured',
      model: process.env.MODEL_NAME || 'openai/gpt-4o'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(port, () => {
  console.log(`🤖 Simplified LLM-First Chatbot Service v3.0 running on port ${port}`);
  console.log(`📡 API available at http://localhost:${port}/api/chat/query`);
  console.log(`🔧 Health check at http://localhost:${port}/health`);
  console.log(`🧠 LLM Model: ${process.env.MODEL_NAME || 'openai/gpt-4o'}`);
  console.log(`🔄 Architecture: LLM-first with SQL generation`);
  
  if (process.env.GITHUB_TOKEN) {
    console.log(`✅ GitHub Models API: Configured`);
  } else {
    console.log(`⚠️  GitHub Models API: Token not configured`);
  }
});

module.exports = app;