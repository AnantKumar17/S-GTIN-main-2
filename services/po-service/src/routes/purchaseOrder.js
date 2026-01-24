const express = require('express');
const router = express.Router();
const poController = require('../controllers/poController');

/**
 * @route   POST /api/purchase-orders
 * @desc    Create purchase order and generate SGTINs
 * @access  Public
 */
router.post('/', poController.create);

/**
 * @route   GET /api/purchase-orders/:poId
 * @desc    Get purchase order details
 * @access  Public
 */
router.get('/:poId', poController.getDetails);

/**
 * @route   GET /api/purchase-orders
 * @desc    List purchase orders with optional filters
 * @access  Public
 */
router.get('/', poController.list);

/**
 * @route   GET /api/purchase-orders/:poId/labels
 * @desc    Generate barcode labels for a PO
 * @access  Public
 */
router.get('/:poId/labels', poController.getLabels);

module.exports = router;
