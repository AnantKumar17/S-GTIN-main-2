const path = require('path');
const { v4: uuidv4 } = require('uuid');
const GitHubModelsClient = require('../utils/githubModelsClient');
const QueryAnalyzer = require('../utils/queryAnalyzer');
const {
  ENHANCED_SYSTEM_PROMPT,
  validateQuestion,
  sanitizeResponse
} = require('../utils/systemKnowledge');
const db = require(path.join(__dirname, '../../../../database/models/db'));

// In-memory conversation storage (for production, use Redis or database)
const conversations = new Map();

/**
 * Query the chatbot (with fallback to non-AI mode)
 * POST /api/chat/query
 */
exports.query = async (req, res, next) => {
  try {
    const { mandt, question, conversationId, useAI } = req.body;

    // Validation
    if (!mandt || !question) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, question'
      });
    }

    // Security: Validate question for forbidden topics BEFORE any processing
    console.log(`[Chatbot] Validating question: "${question}"`);
    const questionValidation = validateQuestion(question);
    console.log(`[Chatbot] Validation result:`, questionValidation);
    
    if (!questionValidation.valid) {
      console.log(`[Chatbot] ⚠️ SECURITY BLOCK TRIGGERED: ${questionValidation.category}`);
      
      // Return security message immediately without fetching data
      const convId = conversationId || uuidv4();
      return res.status(200).json({
        success: true,
        answer: questionValidation.message,
        data: {
          type: 'SECURITY_BLOCKED',
          category: questionValidation.category,
          results: []
        },
        conversationId: convId,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[Chatbot] ✅ Question passed security validation`);

    // Initialize Query Analyzer (only for valid questions)
    const queryAnalyzer = new QueryAnalyzer(mandt);

    // Analyze the question and fetch relevant data
    console.log(`[Chatbot] Processing valid question: "${question}"`);
    const analysisResult = await queryAnalyzer.analyzeAndFetch(question);

    // Build context from fetched data
    const dataContext = buildDataContext(analysisResult);
    
    // Get or create conversation
    const convId = conversationId || uuidv4();
    let conversation = conversations.get(convId) || {
      id: convId,
      messages: []
    };

    let answer;

    // Try AI if useAI is not explicitly false
    if (useAI !== false) {
      try {
        const aiClient = new GitHubModelsClient();
        
        // Build messages for AI with enhanced system prompt
        const messages = [
          { role: 'system', content: ENHANCED_SYSTEM_PROMPT },
          ...conversation.messages.slice(-10), // Last 10 messages for context
          {
            role: 'user',
            content: `User Question: ${question}\n\nRelevant Data:\n${dataContext}\n\nPlease provide a helpful answer based on this data. Remember to follow all security guidelines.`
          }
        ];

        // Get AI response
        console.log('[Chatbot] Calling GitHub Models AI...');
        const aiResponse = await aiClient.chat(messages, {
          temperature: 0.7,
          max_tokens: 1500
        });

        answer = aiResponse.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
        
        // Security: Sanitize response to remove any accidental sensitive information
        answer = sanitizeResponse(answer);
      } catch (aiError) {
        console.error('[Chatbot] AI Error:', aiError.message);
        // Fallback to non-AI structured response
        answer = generateStructuredAnswer(question, analysisResult);
      }
    } else {
      // Non-AI mode - generate structured answer directly
      answer = generateStructuredAnswer(question, analysisResult);
    }

    // Update conversation history
    conversation.messages.push(
      { role: 'user', content: question },
      { role: 'assistant', content: answer }
    );
    conversations.set(convId, conversation);

    // Store in database (optional)
    try {
      await storeConversationInDB(mandt, convId, question, answer);
    } catch (dbError) {
      console.error('[Chatbot] Failed to store conversation in DB:', dbError.message);
      // Continue even if DB storage fails
    }

    res.status(200).json({
      success: true,
      answer,
      data: {
        type: analysisResult.intent,
        results: analysisResult.results
      },
      conversationId: convId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Chatbot] Error processing query:', error);
    next(error);
  }
};

/**
 * Generate structured answer without AI (fallback)
 */
function generateStructuredAnswer(question, analysisResult) {
  const { intent, entities, results } = analysisResult;
  
  let answer = '';
  
  // Check for errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    return `I found some issues: ${errors.map(e => e.error).join(', ')}`;
  }

  // Generate answer based on intent
  switch (intent) {
    case 'INVENTORY_COUNT':
    case 'INVENTORY_STATUS':
      const inventoryData = results.find(r => r.type === 'INVENTORY');
      if (inventoryData) {
        const count = inventoryData.data.length;
        answer = `There are currently **${count} items** in stock.\n\n`;
        if (count > 0) {
          const sample = inventoryData.data.slice(0, 5);
          answer += 'Sample items:\n';
          sample.forEach(item => {
            answer += `- **${item.product?.name || 'Unknown'}** (${item.product?.brand || 'N/A'})\n`;
            answer += `  - SGTIN: ${item.sgtin}\n`;
            answer += `  - Location: ${item.location || 'N/A'}\n`;
            answer += `  - Status: ${item.status}\n`;
          });
          if (count > 5) {
            answer += `\n... and ${count - 5} more items`;
          }
        }
      } else {
        answer = 'No inventory data found.';
      }
      break;

    case 'MISSING_SGTINS':
      const missingData = results.find(r => r.type === 'MISSING_SGTINS');
      if (missingData) {
        const count = missingData.data.length;
        answer = `There are **${count} products** without SGTINs:\n\n`;
        missingData.data.forEach(product => {
          answer += `- **${product.name}** (${product.brand})\n`;
          answer += `  - GTIN: ${product.gtin}\n`;
        });
      } else {
        answer = 'All products have SGTINs assigned!';
      }
      break;

    case 'PO_STATUS':
    case 'PO_LIST':
      const poList = results.find(r => r.type === 'PURCHASE_ORDER_LIST');
      if (poList) {
        const count = poList.data.length;
        answer = `Found **${count} purchase orders**:\n\n`;
        poList.data.slice(0, 10).forEach(po => {
          answer += `- **PO ${po.po_id}**: ${po.product_name || po.gtin}\n`;
          answer += `  - Status: ${po.status}\n`;
          answer += `  - Quantity: ${po.received_quantity || 0}/${po.quantity} received\n`;
          answer += `  - Supplier: ${po.supplier}\n\n`;
        });
        if (count > 10) {
          answer += `... and ${count - 10} more purchase orders`;
        }
      } else {
        const specificPO = results.find(r => r.type === 'PURCHASE_ORDER');
        if (specificPO) {
          const po = specificPO.data;
          answer = `**Purchase Order ${po.poId}**:\n\n`;
          answer += `- Product: ${po.product?.name || 'N/A'} (${po.product?.brand || 'N/A'})\n`;
          answer += `- Status: **${po.status}**\n`;
          answer += `- Quantity: ${po.receivedQuantity || 0}/${po.quantity} received\n`;
          answer += `- Supplier: ${po.supplier}\n`;
          answer += `- Location: ${po.location || 'N/A'}\n`;
        } else {
          answer = 'No purchase order data found.';
        }
      }
      break;

    case 'INVENTORY_LOCATION':
      const locationData = results.find(r => r.type === 'INVENTORY');
      if (locationData && locationData.data.length > 0) {
        const count = locationData.data.length;
        const location = entities.locations[0] || 'the specified location';
        answer = `Found **${count} items** in ${location}:\n\n`;
        locationData.data.slice(0, 5).forEach(item => {
          answer += `- **${item.product?.name || 'Unknown'}** (${item.product?.brand || 'N/A'})\n`;
          answer += `  - SGTIN: ${item.sgtin}\n`;
          answer += `  - Status: ${item.status}\n`;
        });
        if (count > 5) {
          answer += `\n... and ${count - 5} more items`;
        }
      } else {
        answer = `No items found in ${entities.locations[0] || 'the specified location'}.`;
      }
      break;

    case 'COUNTERFEIT':
      const counterfeits = results.find(r => r.type === 'COUNTERFEIT_LOGS');
      if (counterfeits) {
        const count = counterfeits.data.length;
        answer = `Found **${count} counterfeit detection logs**:\n\n`;
        counterfeits.data.slice(0, 5).forEach(log => {
          answer += `- SGTIN: ${log.sgtin || 'N/A'}\n`;
          answer += `  - Reason: ${log.reason}\n`;
          answer += `  - Store: ${log.store_id}\n`;
          answer += `  - Detected: ${log.detected_at}\n\n`;
        });
      } else {
        answer = 'No counterfeit detection logs found.';
      }
      break;

    default:
      // General response
      answer = `I found the following information:\n\n`;
      results.forEach((result, idx) => {
        if (result.type === 'INVENTORY' && result.data) {
          answer += `- **${result.data.length} items** in inventory\n`;
        } else if (result.type === 'PURCHASE_ORDER_LIST' && result.data) {
          answer += `- **${result.data.length} purchase orders** found\n`;
        } else if (result.type === 'MISSING_SGTINS' && result.data) {
          answer += `- **${result.data.length} products** without SGTINs\n`;
        }
      });
      break;
  }

  return answer;
}

/**
 * Get suggested queries
 * GET /api/chat/suggested-queries
 */
exports.getSuggestedQueries = async (req, res, next) => {
  try {
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    const suggestedQueries = [
      {
        category: 'PURCHASE_ORDERS',
        question: 'What is the status of purchase orders?',
        description: 'Get overview of all purchase orders and their statuses'
      },
      {
        category: 'PURCHASE_ORDERS',
        question: 'Show me all open purchase orders',
        description: 'List purchase orders that haven\'t been fully received'
      },
      {
        category: 'INVENTORY',
        question: 'How many items are currently in stock?',
        description: 'Get count of items with IN_STOCK status'
      },
      {
        category: 'INVENTORY',
        question: 'Show inventory in warehouse locations',
        description: 'List all items and their warehouse locations'
      },
      {
        category: 'INVENTORY',
        question: 'Which products are missing SGTINs?',
        description: 'Find products that don\'t have serialized items yet'
      },
      {
        category: 'SALES',
        question: 'Show me recent counterfeit detection attempts',
        description: 'View logs of potential counterfeit items detected at POS'
      },
      {
        category: 'GENERAL',
        question: 'Give me a summary of the current inventory status',
        description: 'Get overall statistics and overview'
      }
    ];

    res.status(200).json({
      success: true,
      queries: suggestedQueries
    });

  } catch (error) {
    console.error('[Chatbot] Error getting suggested queries:', error);
    next(error);
  }
};

/**
 * Get conversation history
 * GET /api/chat/history
 */
exports.getHistory = async (req, res, next) => {
  try {
    const { mandt, conversationId } = req.query;

    if (!mandt || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: mandt, conversationId'
      });
    }

    // Try in-memory first
    const conversation = conversations.get(conversationId);
    
    if (conversation) {
      return res.status(200).json({
        success: true,
        conversationId,
        messages: conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date().toISOString()
        }))
      });
    }

    // Try database
    try {
      const query = `
        SELECT role, content, created_at as timestamp
        FROM chat_messages
        WHERE mandt = $1 AND conversation_id = $2
        ORDER BY created_at ASC
      `;
      const result = await db.query(query, [mandt, conversationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      res.status(200).json({
        success: true,
        conversationId,
        messages: result.rows
      });
    } catch (dbError) {
      console.error('[Chatbot] Database query failed:', dbError.message);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

  } catch (error) {
    console.error('[Chatbot] Error getting history:', error);
    next(error);
  }
};

/**
 * Build data context string for AI from analysis results
 */
function buildDataContext(analysisResult) {
  const { intent, entities, results } = analysisResult;
  
  let context = `Query Intent: ${intent}\n\n`;
  
  if (entities.poNumbers.length > 0) {
    context += `Purchase Order Numbers: ${entities.poNumbers.join(', ')}\n`;
  }
  if (entities.locations.length > 0) {
    context += `Locations: ${entities.locations.join(', ')}\n`;
  }
  if (entities.statuses.length > 0) {
    context += `Statuses: ${entities.statuses.join(', ')}\n`;
  }
  
  context += '\n--- Data Retrieved ---\n\n';
  
  if (results.length === 0) {
    context += 'No data found for this query.\n';
    return context;
  }

  results.forEach((result, index) => {
    if (result.error) {
      context += `[${index + 1}] ERROR: ${result.error}\n\n`;
      return;
    }

    switch (result.type) {
      case 'PURCHASE_ORDER':
        const po = result.data;
        context += `[${index + 1}] Purchase Order: ${po.poId}\n`;
        context += `  - Product: ${po.product?.name || 'N/A'} (Brand: ${po.product?.brand || 'N/A'})\n`;
        context += `  - Status: ${po.status}\n`;
        context += `  - Quantity: ${po.receivedQuantity || 0}/${po.quantity} received\n`;
        context += `  - Supplier: ${po.supplier}\n`;
        context += `  - Location: ${po.location || 'N/A'}\n`;
        if (po.sgtins && po.sgtins.length > 0) {
          context += `  - SGTINs: ${po.sgtins.length} items\n`;
        }
        context += '\n';
        break;

      case 'PURCHASE_ORDER_LIST':
        context += `[${index + 1}] Purchase Orders Found: ${result.data.length}\n`;
        result.data.slice(0, 10).forEach(po => {
          context += `  - PO ${po.po_id}: ${po.product_name || po.gtin} - ${po.status} (${po.received_quantity || 0}/${po.quantity})\n`;
        });
        if (result.data.length > 10) {
          context += `  ... and ${result.data.length - 10} more\n`;
        }
        context += '\n';
        break;

      case 'INVENTORY':
        context += `[${index + 1}] Inventory Items: ${result.data.length}\n`;
        result.data.slice(0, 10).forEach(item => {
          context += `  - SGTIN: ${item.sgtin}\n`;
          context += `    Product: ${item.product?.name || 'N/A'} (${item.product?.brand || 'N/A'})\n`;
          context += `    Status: ${item.status}, Location: ${item.location || 'N/A'}\n`;
          context += `    Batch: ${item.batch || 'N/A'}\n`;
        });
        if (result.data.length > 10) {
          context += `  ... and ${result.data.length - 10} more items\n`;
        }
        context += '\n';
        break;

      case 'MISSING_SGTINS':
        context += `[${index + 1}] Products Without SGTINs: ${result.data.length}\n`;
        result.data.forEach(product => {
          context += `  - ${product.brand || 'N/A'}: ${product.name} (GTIN: ${product.gtin})\n`;
        });
        context += '\n';
        break;

      case 'SGTIN_TRACE':
        const trace = result.data;
        context += `[${index + 1}] SGTIN Trace: ${result.sgtin}\n`;
        context += `  - Current Status: ${trace.currentStatus}\n`;
        context += `  - Location: ${trace.currentLocation || 'N/A'}\n`;
        context += `  - Product: ${trace.product?.name || 'N/A'}\n`;
        if (trace.lifecycle && trace.lifecycle.length > 0) {
          context += `  - Lifecycle Events: ${trace.lifecycle.length}\n`;
          trace.lifecycle.forEach(event => {
            context += `    * ${event.event_type} at ${event.location || 'N/A'} on ${event.created_at}\n`;
          });
        }
        context += '\n';
        break;

      case 'COUNTERFEIT_LOGS':
        context += `[${index + 1}] Counterfeit Detection Logs: ${result.data.length}\n`;
        result.data.slice(0, 10).forEach(log => {
          context += `  - SGTIN: ${log.sgtin || 'N/A'}\n`;
          context += `    Reason: ${log.reason}, Store: ${log.store_id}\n`;
          context += `    Detected: ${log.detected_at}\n`;
        });
        if (result.data.length > 10) {
          context += `  ... and ${result.data.length - 10} more logs\n`;
        }
        context += '\n';
        break;

      default:
        context += `[${index + 1}] ${result.type}: ${JSON.stringify(result.data).substring(0, 200)}...\n\n`;
    }
  });

  return context;
}

/**
 * Store conversation in database
 */
async function storeConversationInDB(mandt, conversationId, question, answer) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    // Ensure conversation exists
    const convCheck = await client.query(
      'SELECT conversation_id FROM chat_conversations WHERE mandt = $1 AND conversation_id = $2',
      [mandt, conversationId]
    );

    if (convCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO chat_conversations (mandt, conversation_id) VALUES ($1, $2)',
        [mandt, conversationId]
      );
    } else {
      await client.query(
        'UPDATE chat_conversations SET last_activity = NOW() WHERE mandt = $1 AND conversation_id = $2',
        [mandt, conversationId]
      );
    }

    // Store user message
    await client.query(
      'INSERT INTO chat_messages (mandt, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
      [mandt, conversationId, 'user', question]
    );

    // Store assistant message
    await client.query(
      'INSERT INTO chat_messages (mandt, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
      [mandt, conversationId, 'assistant', answer]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = exports;
