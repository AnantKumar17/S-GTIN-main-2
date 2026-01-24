const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const OpenAI = require('openai');
const axios = require('axios');
const { plan, isOutOfDomain } = require('./utils/queryPlanner');
const { executePlans, summarize } = require('./utils/dbExecutor');
const { sanitizeResponse, ENHANCED_SYSTEM_PROMPT } = require('./utils/systemKnowledge');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3005;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sgtin_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// GitHub Models OpenAI client
const openaiClient = new OpenAI({
  baseURL: process.env.GITHUB_MODEL_ENDPOINT || 'https://models.github.ai/inference',
  apiKey: process.env.GITHUB_TOKEN
});

// Service URLs configuration
const services = {
  sgtin: process.env.SGTIN_SERVICE_URL || 'http://localhost:3001',
  po: process.env.PO_SERVICE_URL || 'http://localhost:3002', 
  inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
  pos: process.env.POS_SERVICE_URL || 'http://localhost:3004'
};

app.use(cors());
app.use(express.json());

// Minimal in-memory conversation state to carry last intent/filters per conversation
const convState = new Map();

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

 // System context for LLM about the SGTIN system (single source of truth + strict no-internals policy)
const SYSTEM_CONTEXT = ENHANCED_SYSTEM_PROMPT + `

Important:
- Do not show raw SQL queries to the user.
- Do not reveal internal table or view names in responses. Provide business-level outputs only (e.g., “purchase orders”, “inventory items”, “sales”).
- Do not disclose internal endpoints or ports. Focus on operational answers.
- Summarize results and include only necessary identifiers (e.g., PO IDs, SGTINs) and business fields (status, quantities, supplier, warehouse).
`;

/* Removed legacy analyzeQuery: DB-first planning now handled entirely by QueryPlanner + DBExecutor */

// Get context data for LLM queries
async function getContextData(mandt) {
  try {
    const results = await Promise.allSettled([
      pool.query('SELECT COUNT(*) as count, status FROM purchase_orders WHERE mandt = $1 GROUP BY status', [mandt]),
      pool.query('SELECT COUNT(*) as count, status FROM serialized_items WHERE mandt = $1 GROUP BY status', [mandt]),
      pool.query('SELECT COUNT(*) as count, EXTRACT(month FROM sold_at) as month FROM sales WHERE mandt = $1 GROUP BY month ORDER BY month DESC LIMIT 3', [mandt])
    ]);

    const context = {
      purchaseOrders: results[0].status === 'fulfilled' ? results[0].value.rows : [],
      inventory: results[1].status === 'fulfilled' ? results[1].value.rows : [],
      recentSales: results[2].status === 'fulfilled' ? results[2].value.rows : []
    };

    return context;
  } catch (error) {
    console.error('Error getting context data:', error);
    return null;
  }
}

 // Main chat endpoint (schema-aware, DB-first for simple queries with LLM support and domain nudging)
app.post('/api/chat/query', async (req, res) => {
  try {
    const { mandt, question, conversationId } = req.body;
    const convId = conversationId || `conv_${Date.now()}`;

    if (!mandt || !question) {
      return res.status(400).json({ error: 'mandt and question are required' });
    }

    console.log(`🤖 Processing question: "${question}" for mandt: ${mandt}`);

    // Security guard for forbidden topics
    const lowerQ = String(question).toLowerCase();
    if (lowerQ.includes('password') || lowerQ.includes('credential') || lowerQ.includes('secret') || lowerQ.includes('token')) {
      return res.json({
        answer: "I can't provide sensitive system information like passwords, credentials, tokens, or API keys. I'm designed to help with SGTIN lifecycle operations such as purchase orders, inventory, GTIN/SGTIN, and sales analytics.",
        data: { type: 'SECURITY', results: [] },
        conversationId: convId,
        timestamp: new Date().toISOString(),
        method: 'security_guard'
      });
    }

    // 1) Out-of-domain check (e.g., weather, news, etc.)
    const outDomain = isOutOfDomain(question);

    // 2) Passport queries (route to external service if configured)
    const PASSPORT_URL = process.env.GTIN_PASSPORT_SERVICE_URL || 'http://localhost:3006';
    if (!outDomain && question.toLowerCase().includes('passport')) {
      const tries = [];
      try {
        // Try GTIN-based passport if GTIN present, else SGTIN
        const { entities } = plan(mandt, question);
        let resp;
        if (entities.gtins && entities.gtins.length > 0) {
          tries.push('gtin');
          resp = await axios.get(`${PASSPORT_URL}/api/passport/gtin/${entities.gtins[0]}`, {
            params: { mandt },
            headers: { 'X-API-Key': process.env.API_KEY || 'dev-api-key-12345' }
          });
        } else if (entities.sgtins && entities.sgtins.length > 0) {
          tries.push('sgtin');
          resp = await axios.get(`${PASSPORT_URL}/api/passport/sgtin/${entities.sgtins[0]}`, {
            params: { mandt },
            headers: { 'X-API-Key': process.env.API_KEY || 'dev-api-key-12345' }
          });
        }

        if (resp && resp.data) {
          return res.json({
            answer: 'Here is the requested product passport information.',
            data: { type: 'PASSPORT', results: [resp.data] },
            conversationId: convId,
            timestamp: new Date().toISOString(),
            method: 'passport_service'
          });
        }
      } catch (e) {
        console.warn(`⚠️ Passport service lookup failed via [${tries.join(', ')}]: ${e.message}`);
        // fall through to regular handling (DB/LLM)
      }
    }

    // 3) Plan DB queries for in-domain intents
    let planned = plan(mandt, question);

    // If this is a follow-up/affirmation, reuse prior plan/entities where possible
    const prior = convState.get(convId);
    if (planned.intent === 'FOLLOW_UP' && prior && prior.plans && prior.plans.length > 0) {
      planned = prior;
    } else if (prior && (planned.intent === 'PO_LIST' || planned.intent === 'PO_STATUS')) {
      // Carry over prior status filter for follow-ups referencing "those purchase orders"
      const priorStatus = prior.entities && prior.entities.statuses && prior.entities.statuses[0];
      if (priorStatus && planned.plans && planned.plans.length > 0) {
        planned.plans.forEach(pl => {
          if (pl.type === 'PURCHASE_ORDER_LIST' && (pl.params[1] === null || typeof pl.params[1] === 'undefined')) {
            pl.params[1] = priorStatus;
          }
        });
      }
    }

    // Store current plan in conversation state
    convState.set(convId, planned);

    const hasPlans = planned && Array.isArray(planned.plans) && planned.plans.length > 0;

    let dbOutputs = [];
    if (hasPlans) {
      try {
        dbOutputs = await executePlans(pool, planned.plans);
      } catch (e) {
        console.error('❌ Planned DB execution failed:', e.message);
        dbOutputs = [{ type: 'ERROR', error: e.message || 'DB plan execution failed' }];
      }
    }

    const anyData =
      dbOutputs.filter(o => o.type !== 'ERROR')
               .some(o => Array.isArray(o.data) && o.data.length > 0);

    // 4) For out-of-domain: answer with LLM plus domain nudge
    if (outDomain) {
      try {
        const contextData = await getContextData(mandt);
        const contextString = contextData ? `

CURRENT SYSTEM DATA:
Purchase Orders: ${JSON.stringify(contextData.purchaseOrders)}
Inventory Status: ${JSON.stringify(contextData.inventory)}
Recent Sales: ${JSON.stringify(contextData.recentSales)}` : '';

        const completion = await openaiClient.chat.completions.create({
          messages: [
            { role: 'system', content: SYSTEM_CONTEXT + contextString },
            { role: 'user', content: question }
          ],
          model: process.env.MODEL_NAME || 'openai/gpt-4o',
          temperature: 0.7,
          max_tokens: 600,
          top_p: 1.0
        });

        let answer = completion.choices[0].message.content || 'Here is a brief response.';
        answer += `

Note: This assistant is primarily for purchase orders, serialized items (SGTIN), GTIN/product passports, inventory, and sales analytics. Please consider asking about PO status, items, GTINs/SGTINs, or inventory.`;
        answer = sanitizeResponse(answer);

        return res.json({
          answer,
          data: { type: 'OUT_OF_DOMAIN', results: [] },
          conversationId: convId,
          timestamp: new Date().toISOString(),
          method: 'llm_out_of_domain'
        });
      } catch (llmError) {
        console.error('❌ LLM (out-of-domain) error:', llmError.message);
        const nudge = 'This assistant focuses on PO status, inventory, GTIN/SGTIN, product passports, and sales analytics. Please consider asking within these topics.';
        return res.json({
          answer: `Unable to process at the moment. ${nudge}`,
          data: { type: 'FALLBACK', results: [] },
          conversationId: convId,
          timestamp: new Date().toISOString(),
          method: 'out_of_domain_fallback'
        });
      }
    }

    // 5) In-domain: Prefer DB results for simple queries
    if (hasPlans) {
      const summary = summarize(planned.intent, dbOutputs);

      // If DB returned something usable, return it immediately
      if (anyData) {
        return res.json({
          answer: summary,
          data: { type: planned.intent, results: dbOutputs.flatMap(o => o.data || []) },
          conversationId: convId,
          timestamp: new Date().toISOString(),
          method: 'database_planner'
        });
      }

      // If DB plans exist but produced no data or errored, attempt LLM as secondary
      try {
        const contextData = await getContextData(mandt);
        const contextString = contextData ? `

CURRENT SYSTEM DATA:
Purchase Orders: ${JSON.stringify(contextData.purchaseOrders)}
Inventory Status: ${JSON.stringify(contextData.inventory)}
Recent Sales: ${JSON.stringify(contextData.recentSales)}` : '';

        const completion = await openaiClient.chat.completions.create({
          messages: [
            { role: 'system', content: SYSTEM_CONTEXT + contextString },
            { role: 'user', content: question }
          ],
          model: process.env.MODEL_NAME || 'openai/gpt-4o',
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1.0
        });

        let answer = completion.choices[0].message.content || summary;
        answer = sanitizeResponse(answer);
        return res.json({
          answer,
          data: { type: 'LLM_RESPONSE', results: contextData ? [contextData] : [] },
          conversationId: convId,
          timestamp: new Date().toISOString(),
          method: 'llm_after_db'
        });
      } catch (llmError) {
        console.error('❌ LLM after DB error:', llmError.message);
        // For simple queries when LLM fails, still return the DB summary (even if empty) instead of generic message
        return res.json({
          answer: summary || 'Unable to process at the moment. Please try later.',
          data: { type: planned.intent, results: dbOutputs.flatMap(o => o.data || []) },
          conversationId: convId,
          timestamp: new Date().toISOString(),
          method: 'db_summary_fallback'
        });
      }
    }

    // 6) No plans determined (likely very general). Try LLM with context; on failure return standard message.
    try {
      const contextData = await getContextData(mandt);
      const contextString = contextData ? `

CURRENT SYSTEM DATA:
Purchase Orders: ${JSON.stringify(contextData.purchaseOrders)}
Inventory Status: ${JSON.stringify(contextData.inventory)}
Recent Sales: ${JSON.stringify(contextData.recentSales)}` : '';

      const completion = await openaiClient.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_CONTEXT + contextString },
          { role: 'user', content: question }
        ],
        model: process.env.MODEL_NAME || 'openai/gpt-4o',
        temperature: 0.7,
        max_tokens: 800,
        top_p: 1.0
      });

      let answer = completion.choices[0].message.content;
      answer = sanitizeResponse(answer);
      return res.json({
        answer,
        data: { type: 'LLM_RESPONSE', results: contextData ? [contextData] : [] },
        conversationId: convId,
        timestamp: new Date().toISOString(),
        method: 'llm_general'
      });
    } catch (llmError) {
      console.error('❌ LLM general error:', llmError.message);
      return res.json({
        answer: 'Unable to process at the moment. Please try later.',
        data: { type: 'FALLBACK', results: [] },
        conversationId: convId,
        timestamp: new Date().toISOString(),
        method: 'general_unavailable'
      });
    }

  } catch (error) {
    console.error('❌ Chat API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/* Removed /api/chat/suggested-queries: UI no longer uses it */

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'chatbot-service',
    version: '2.0.0',
    features: {
      database_fallback: 'active',
      github_models_api: process.env.GITHUB_TOKEN ? 'configured' : 'not_configured',
      model: process.env.MODEL_NAME || 'openai/gpt-4o'
    },
    services: services,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🤖 Enhanced Chatbot Service v2.0 running on port ${port}`);
  console.log(`📡 API available at http://localhost:${port}/api/chat/query`);
  console.log(`🔧 Health check at http://localhost:${port}/health`);
  console.log(`🧠 LLM Model: ${process.env.MODEL_NAME || 'openai/gpt-4o'}`);
  console.log(`🗄️  Database Fallback: ${pool ? 'Connected' : 'Disabled'}`);
  console.log(`🌐 Service Integration: All 5 services (ports 3001-3005)`);
  
  if (process.env.GITHUB_TOKEN) {
    console.log(`✅ GitHub Models API: Configured`);
  } else {
    console.log(`⚠️  GitHub Models API: Token not configured, using database fallback only`);
  }
});
