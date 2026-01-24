const path = require('path');
const { v4: uuidv4 } = require('uuid');
const SQLGenerator = require('../utils/sqlGenerator');
const {
  validateQuestion,
  sanitizeResponse
} = require('../utils/systemKnowledge');
const db = require('../../../../database/models/db');

// In-memory conversation storage (for production, use Redis or database)
const conversations = new Map();

/**
 * Simplified LLM-First Query Handler
 * POST /api/chat/query
 */
exports.query = async (req, res, next) => {
  try {
    const { mandt, question, conversationId } = req.body;

    // Validation
    if (!mandt || !question) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, question'
      });
    }

    console.log(`🤖 Processing question: "${question}" for mandt: ${mandt}`);

    // Security: Validate question for forbidden topics
    const questionValidation = validateQuestion(question);
    if (!questionValidation.valid) {
      console.log(`⚠️ SECURITY BLOCK: ${questionValidation.category}`);
      
      const convId = conversationId || uuidv4();
      return res.status(200).json({
        success: true,
        answer: questionValidation.message,
        data: {
          type: 'SECURITY_BLOCKED',
          results: []
        },
        conversationId: convId,
        timestamp: new Date().toISOString(),
        method: 'security_filter'
      });
    }

    // Initialize SQL Generator
    const sqlGenerator = new SQLGenerator(mandt);
    
    // Process question with LLM-first approach
    const result = await sqlGenerator.processQuestion(question);

    // Generate natural language answer
    const answer = generateNaturalAnswer(question, result);
    
    // Update conversation history
    const convId = conversationId || uuidv4();
    updateConversationHistory(convId, question, answer);

    // Store in database (optional)
    try {
      await storeConversationInDB(mandt, convId, question, answer);
    } catch (dbError) {
      console.error('[SimplifiedChatbot] Failed to store conversation:', dbError.message);
    }

    // Return response
    res.status(200).json({
      success: true,
      answer: sanitizeResponse(answer),
      data: {
        type: determineResponseType(result),
        results: result.data || [],
        count: result.count || 0,
        sql: result.sql // Include generated SQL for debugging
      },
      conversationId: convId,
      timestamp: new Date().toISOString(),
      method: result.method || 'unknown'
    });

  } catch (error) {
    console.error('[SimplifiedChatbot] Error processing query:', error);
    next(error);
  }
};

/**
 * Generate natural language answer from SQL results
 */
function generateNaturalAnswer(question, result) {
  if (!result.success) {
    return `I encountered an issue processing your question: ${result.error}. Please try rephrasing your question or contact support if the problem persists.`;
  }

  const { data, count, method } = result;

  if (count === 0) {
    return `I didn't find any results for your question "${question}". The data might not exist or you may need to rephrase your query.`;
  }

  let answer = '';

  // Add method indicator for debugging (only in development)
  const methodIndicator = method === 'llm_generated' ? '🤖 ' : '🔄 ';
  
  if (count === 1) {
    answer += `${methodIndicator}I found 1 result matching your query:\n\n`;
  } else {
    answer += `${methodIndicator}I found ${count} results matching your query. Here are the details:\n\n`;
  }

  // Format results based on data type
  if (data.length > 0) {
    const firstItem = data[0];
    
    // Check what type of data we have and format accordingly
    if (firstItem.sgtin) {
      // Inventory/Item data
      answer += formatInventoryResults(data);
    } else if (firstItem.po_id) {
      // Purchase Order data
      answer += formatPurchaseOrderResults(data);
    } else if (firstItem.sale_id) {
      // Sales data
      answer += formatSalesResults(data);
    } else if (firstItem.log_id) {
      // Counterfeit logs
      answer += formatCounterfeitResults(data);
    } else {
      // Generic formatting
      answer += formatGenericResults(data);
    }
  }

  // Add helpful note if showing limited results
  if (count > 10) {
    answer += `\n💡 Showing first ${Math.min(count, 50)} results. Use more specific criteria to narrow down your search.`;
  }

  return answer;
}

/**
 * Format inventory/item results
 */
function formatInventoryResults(data) {
  let formatted = '';
  
  data.slice(0, 10).forEach((item, index) => {
    formatted += `**${index + 1}. ${item.product_name || 'Unknown Product'}**\n`;
    formatted += `   - SGTIN: \`${item.sgtin}\`\n`;
    formatted += `   - Status: **${item.status}**\n`;
    formatted += `   - Brand: ${item.brand || 'N/A'}\n`;
    formatted += `   - Location: ${item.location || 'N/A'}\n`;
    if (item.batch) formatted += `   - Batch: ${item.batch}\n`;
    if (item.manufacture_date) formatted += `   - Manufactured: ${item.manufacture_date}\n`;
    formatted += '\n';
  });
  
  return formatted;
}

/**
 * Format purchase order results
 */
function formatPurchaseOrderResults(data) {
  let formatted = '';
  
  data.slice(0, 10).forEach((po, index) => {
    formatted += `**${index + 1}. PO ${po.po_id}**\n`;
    formatted += `   - Product: ${po.product_name || 'Unknown'}\n`;
    formatted += `   - Status: **${po.status}**\n`;
    formatted += `   - Quantity: ${po.received_quantity || 0}/${po.quantity} received\n`;
    formatted += `   - Supplier: ${po.supplier || 'N/A'}\n`;
    formatted += `   - Warehouse: ${po.warehouse || 'N/A'}\n`;
    if (po.expected_delivery_date) formatted += `   - Expected: ${po.expected_delivery_date}\n`;
    formatted += '\n';
  });
  
  return formatted;
}

/**
 * Format sales results
 */
function formatSalesResults(data) {
  let formatted = '';
  
  data.slice(0, 10).forEach((sale, index) => {
    formatted += `**${index + 1}. Sale ${sale.sale_id}**\n`;
    formatted += `   - Product: ${sale.product_name || 'Unknown'}\n`;
    formatted += `   - SGTIN: \`${sale.sgtin}\`\n`;
    formatted += `   - Store: ${sale.store_id}\n`;
    formatted += `   - Price: $${sale.price || 'N/A'}\n`;
    formatted += `   - Sold: ${new Date(sale.sold_at).toLocaleString()}\n`;
    formatted += '\n';
  });
  
  return formatted;
}

/**
 * Format counterfeit log results
 */
function formatCounterfeitResults(data) {
  let formatted = '';
  
  data.slice(0, 10).forEach((log, index) => {
    formatted += `**${index + 1}. Counterfeit Detection**\n`;
    formatted += `   - SGTIN: \`${log.sgtin || 'N/A'}\`\n`;
    formatted += `   - Reason: **${log.reason}**\n`;
    formatted += `   - Store: ${log.store_id || 'N/A'}\n`;
    formatted += `   - Detected: ${new Date(log.detected_at).toLocaleString()}\n`;
    formatted += '\n';
  });
  
  return formatted;
}

/**
 * Format generic results
 */
function formatGenericResults(data) {
  let formatted = '';
  
  data.slice(0, 10).forEach((item, index) => {
    formatted += `**${index + 1}. Result**\n`;
    Object.keys(item).forEach(key => {
      if (key !== 'mandt' && item[key] !== null) {
        formatted += `   - ${key}: ${item[key]}\n`;
      }
    });
    formatted += '\n';
  });
  
  return formatted;
}

/**
 * Determine response type for frontend
 */
function determineResponseType(result) {
  if (!result.success) return 'ERROR';
  
  const data = result.data || [];
  if (data.length === 0) return 'NO_RESULTS';
  
  const firstItem = data[0];
  
  if (firstItem.sgtin && firstItem.status) return 'INVENTORY';
  if (firstItem.po_id) return 'PURCHASE_ORDERS';
  if (firstItem.sale_id) return 'SALES';
  if (firstItem.log_id) return 'COUNTERFEIT_LOGS';
  
  return 'GENERAL';
}

/**
 * Update conversation history
 */
function updateConversationHistory(conversationId, question, answer) {
  let conversation = conversations.get(conversationId) || {
    id: conversationId,
    messages: []
  };

  conversation.messages.push(
    { role: 'user', content: question, timestamp: new Date() },
    { role: 'assistant', content: answer, timestamp: new Date() }
  );

  // Keep only last 20 messages to prevent memory issues
  if (conversation.messages.length > 20) {
    conversation.messages = conversation.messages.slice(-20);
  }

  conversations.set(conversationId, conversation);
}

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
          timestamp: msg.timestamp?.toISOString() || new Date().toISOString()
        }))
      });
    }

    // Try database fallback
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
      console.error('[SimplifiedChatbot] Database query failed:', dbError.message);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

  } catch (error) {
    console.error('[SimplifiedChatbot] Error getting history:', error);
    next(error);
  }
};

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

    // Store messages
    await client.query(
      'INSERT INTO chat_messages (mandt, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
      [mandt, conversationId, 'user', question]
    );

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