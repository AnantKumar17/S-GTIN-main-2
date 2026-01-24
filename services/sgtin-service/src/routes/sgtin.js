const express = require('express');
const router = express.Router();
const sgtinController = require('../controllers/sgtinController');

/**
 * @route   POST /api/sgtin/generate
 * @desc    Generate SGTINs in GS1 format
 * @access  Public
 */
router.post('/generate', sgtinController.generate);

/**
 * @route   GET /api/sgtin/validate/:sgtin
 * @desc    Validate SGTIN format and existence
 * @access  Public
 */
router.get('/validate/:sgtin', sgtinController.validate);

/**
 * @route   GET /api/sgtin/trace/:sgtin
 * @desc    Get complete lifecycle trace for an SGTIN
 * @access  Public
 */
router.get('/trace/:sgtin', sgtinController.trace);

/**
 * @route   GET /api/sgtin/purchase-order/:poId
 * @desc    Get all SGTINs for a specific purchase order
 * @access  Public
 */
router.get('/purchase-order/:poId', sgtinController.getSgtinsByPurchaseOrder);

module.exports = router;
