const express = require('express');
const router = express.Router();
const simplifiedChatbotController = require('../controllers/simplifiedChatbotController');
const chatbotController = require('../controllers/chatbotController'); // Keep for suggested queries

/**
 * @route POST /api/chat/query
 * @desc Ask a question to the chatbot (LLM-first approach)
 * @access Protected
 */
router.post('/query', simplifiedChatbotController.query);

/**
 * @route GET /api/chat/suggested-queries
 * @desc Get suggested example queries
 * @access Protected
 */
router.get('/suggested-queries', chatbotController.getSuggestedQueries);

/**
 * @route GET /api/chat/history
 * @desc Get chat conversation history
 * @access Protected
 */
router.get('/history', simplifiedChatbotController.getHistory);

module.exports = router;
