const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

/**
 * @route   GET /api/sales
 * @desc    Get all sales
 * @access  Public
 */
router.get('/', salesController.getAllSales);

/**
 * @route   POST /api/sales
 * @desc    Process sale transaction with counterfeit detection
 * @access  Public
 */
router.post('/', salesController.processSale);

/**
 * @route   POST /api/sales/scan-barcode
 * @desc    Scan barcode image and decode SGTIN for sale
 * @access  Public
 */
router.post('/scan-barcode', salesController.scanBarcodeForSale);

/**
 * @route   POST /api/sales/scan-image
 * @desc    Scan barcode/QR image to decode SGTIN for sale
 * @access  Public
 */
router.post('/scan-image', salesController.scanBarcodeImage);

/**
 * @route   GET /api/sales/:saleId
 * @desc    Get sale details
 * @access  Public
 */
router.get('/:saleId', salesController.getSaleDetails);

/**
 * @route   GET /api/sales/counterfeit-logs
 * @desc    Get counterfeit detection logs
 * @access  Public
 */
router.get('/logs/counterfeit', salesController.getCounterfeitLogs);

module.exports = router;
