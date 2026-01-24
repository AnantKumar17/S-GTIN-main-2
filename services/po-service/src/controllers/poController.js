const path = require('path');
const axios = require('axios');
const { PurchaseOrder, Product } = require(path.join(__dirname, '../../database/models'));

const SGTIN_SERVICE_URL = process.env.SGTIN_SERVICE_URL || 'http://localhost:3001';

/**
 * Create purchase order and generate SGTINs
 * POST /api/purchase-orders
 */
exports.create = async (req, res, next) => {
  try {
    const { mandt, gtin, quantity, supplier, batch, manufactureDate, passport } = req.body;

    // Validation
    if (!mandt || !gtin || !quantity || !supplier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, gtin, quantity, supplier'
      });
    }

    if (quantity < 1 || quantity > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be between 1 and 1000'
      });
    }

    // Verify product exists
    const productModel = new Product(mandt);
    const product = await productModel.findByGtin(gtin);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: `Product with GTIN ${gtin} not found`
      });
    }

    // Create purchase order
    const purchaseOrderModel = new PurchaseOrder(mandt);
    const poId = await purchaseOrderModel.generatePoId();
    
    const poData = {
      po_id: poId,
      gtin,
      quantity,
      supplier,
      status: 'OPEN',
      received_quantity: 0
    };

    const po = await purchaseOrderModel.insert(poData);

    // Call SGTIN service to generate SGTINs
    let sgtinResponse;
    try {
      sgtinResponse = await axios.post(`${SGTIN_SERVICE_URL}/api/sgtin/generate`, {
        mandt,
        gtin,
        quantity,
        batch,
        manufactureDate,
        passport
      }, {
        headers: {
          'X-API-Key': process.env.API_KEY
        }
      });
    } catch (error) {
      console.error('Error calling SGTIN service:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate SGTINs. Please try again.',
        poId: po.po_id
      });
    }

    const sgtins = sgtinResponse.data.sgtins.map(s => s.sgtin);

    // Link SGTINs to PO
    await purchaseOrderModel.linkSgtins(poId, sgtins);

    res.status(201).json({
      success: true,
      message: `Purchase order created successfully with ${quantity} SGTIN(s)`,
      purchaseOrder: {
        poId: po.po_id,
        gtin: po.gtin,
        product: {
          name: product.product_name,
          brand: product.brand
        },
        quantity: po.quantity,
        supplier: po.supplier,
        status: po.status,
        createdAt: po.created_at
      },
      sgtins: sgtinResponse.data.sgtins
    });

  } catch (error) {
    console.error('Error creating purchase order:', error);
    next(error);
  }
};

/**
 * Get purchase order details
 * GET /api/purchase-orders/:poId
 */
exports.getDetails = async (req, res, next) => {
  try {
    const { poId } = req.params;
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    const purchaseOrderModel = new PurchaseOrder(mandt);
    const poDetails = await purchaseOrderModel.getPoDetails(poId);

    if (!poDetails) {
      return res.status(404).json({
        success: false,
        error: `Purchase order ${poId} not found`
      });
    }

    res.status(200).json({
      success: true,
      purchaseOrder: poDetails
    });

  } catch (error) {
    console.error('Error getting PO details:', error);
    next(error);
  }
};

/**
 * List purchase orders with optional filters
 * GET /api/purchase-orders?status=OPEN&mandt=100
 */
exports.list = async (req, res, next) => {
  try {
    const { mandt, status, supplier, gtin } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    const purchaseOrderModel = new PurchaseOrder(mandt);
    
    let conditions = {};
    if (status) conditions.status = status;
    if (supplier) conditions.supplier = supplier;
    if (gtin) conditions.gtin = gtin;

    const purchaseOrders = await purchaseOrderModel.findAll(conditions);

    res.status(200).json({
      success: true,
      count: purchaseOrders.length,
      purchaseOrders
    });

  } catch (error) {
    console.error('Error listing purchase orders:', error);
    next(error);
  }
};

/**
 * Generate barcode labels for a PO
 * GET /api/purchase-orders/:poId/labels
 */
exports.getLabels = async (req, res, next) => {
  try {
    const { poId } = req.params;
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    const purchaseOrderModel = new PurchaseOrder(mandt);
    const sgtins = await purchaseOrderModel.getSgtins(poId);

    if (!sgtins || sgtins.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No SGTINs found for purchase order ${poId}`
      });
    }

    // Return labels (barcodes and QR codes are already generated in SGTIN service)
    res.status(200).json({
      success: true,
      poId,
      count: sgtins.length,
      labels: sgtins.map(item => ({
        sgtin: item.sgtin,
        serialNumber: item.serial_number || item.sgtin.substring(item.sgtin.length - 12), // Extract serial from SGTIN if not available
        barcode: item.barcode,      // Base64 PNG barcode
        qrCode: item.qr_code,       // Base64 PNG QR code
        status: item.status || 'CREATED',
        location: item.location || 'Not specified',
        batch: item.batch || 'Not specified'
      }))
    });

  } catch (error) {
    console.error('Error getting labels:', error);
    next(error);
  }
};
