const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

/**
 * @route   GET /api/goods-receipts
 * @desc    Get goods receipt history
 * @access  Public
 */
router.get('/goods-receipts', inventoryController.getGoodsReceipts);

/**
 * @route   POST /api/goods-receipts
 * @desc    Record goods receipt and update SGTIN status
 * @access  Public
 */
router.post('/goods-receipts', inventoryController.receiveGoods);

/**
 * @route   POST /api/goods-receipts/scan-barcode
 * @desc    Scan barcode image and decode SGTIN for goods receipt
 * @access  Public
 */
router.post('/goods-receipts/scan-barcode', inventoryController.scanBarcodeForReceipt);

/**
 * @route   POST /api/goods-receipts/scan-image
 * @desc    Scan barcode/QR image to decode SGTIN for goods receipt
 * @access  Public
 */
router.post('/goods-receipts/scan-image', inventoryController.scanBarcodeImage);

/**
 * @route   GET /api/inventory
 * @desc    Query inventory with filters
 * @access  Public
 */
router.get('/inventory', inventoryController.getInventory);

/**
 * @route   GET /api/inventory/products
 * @desc    Get all products from master data (for PO creation dropdown)
 * @access  Public
 */
router.get('/inventory/products', inventoryController.getProducts);

/**
 * @route   GET /api/inventory/missing-sgtins
 * @desc    Get products without serialized items (for chatbot)
 * @access  Public
 */
router.get('/inventory/missing-sgtins', inventoryController.getMissingSGTINs);

/**
 * @route   GET /api/inventory/po-ids
 * @desc    Get available PO IDs for filtering
 * @access  Public
 */
router.get('/inventory/po-ids', inventoryController.getAvailablePoIds);

module.exports = router;
