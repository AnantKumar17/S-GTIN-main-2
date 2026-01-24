const path = require('path');
const { SerializedItem, LifecycleEvent, Product } = require(path.join(__dirname, '../../database/models'));
const { generateSGTINWithSequence, generateQRCode, generateBarcode, validateSGTINFormat } = require('../utils/sgtinUtils');

/**
 * Generate SGTINs for a product
 * POST /api/sgtin/generate
 */
exports.generate = async (req, res, next) => {
  try {
    const { mandt, gtin, quantity, batch, manufactureDate, passport, po_id } = req.body;

    // Validation
    if (!mandt || !gtin || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, gtin, quantity'
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

    const serializedItemModel = new SerializedItem(mandt);
    const lifecycleEventModel = new LifecycleEvent(mandt);

    const generatedSGTINs = [];

    // Generate SGTINs
    for (let i = 0; i < quantity; i++) {
      // Generate unique SGTIN using PostgreSQL sequence (production-ready)
      const sgtin = await generateSGTINWithSequence(gtin);
      
      // Generate QR code and barcode
      const qrCode = await generateQRCode(sgtin);
      const barcode = await generateBarcode(sgtin);

      // Create serialized item in database
      const itemData = {
        sgtin,
        gtin,
        status: 'CREATED',
        batch: batch || null,
        manufacture_date: manufactureDate || null,
        passport: passport || null,
        barcode: barcode,      // ← ADDED: Save barcode to database
        qr_code: qrCode        // ← ADDED: Save QR code to database
      };

      const item = await serializedItemModel.insert(itemData);

      // Create lifecycle event
      await lifecycleEventModel.createEvent({
        sgtin,
        event_type: 'CREATED',
        metadata: {
          gtin,
          batch,
          manufacture_date: manufactureDate,
          product_name: product.product_name,
          po_id: po_id
        }
      });

      // Create purchase order mapping if po_id is provided
      if (po_id) {
        try {
          const mappingQuery = `
            INSERT INTO po_sgtin_mapping (mandt, po_id, sgtin, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (mandt, po_id, sgtin) DO NOTHING
          `;
          await serializedItemModel.customQuery(mappingQuery, [mandt, po_id, sgtin]);
        } catch (mappingError) {
          console.warn(`Warning: Could not create PO mapping for ${sgtin}:`, mappingError.message);
          // Continue processing - don't fail the entire generation for mapping issues
        }
      }

      generatedSGTINs.push({
        sgtin,
        serialNumber: sgtin.substring(16), // Extract serial from SGTIN
        qrCode,
        barcode,
        status: 'CREATED'
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully generated ${quantity} SGTIN(s)`,
      sgtins: generatedSGTINs,
      product: {
        gtin: product.gtin,
        name: product.product_name,
        brand: product.brand
      },
      po_id: po_id || null
    });

  } catch (error) {
    console.error('Error generating SGTINs:', error);
    next(error);
  }
};

/**
 * Validate SGTIN format and check existence
 * GET /api/sgtin/validate/:sgtin
 */
exports.validate = async (req, res, next) => {
  try {
    const { sgtin } = req.params;
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    // Validate format
    const formatValid = validateSGTINFormat(sgtin);
    if (!formatValid.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: formatValid.error
      });
    }

    // Check if SGTIN exists in database
    const serializedItemModel = new SerializedItem(mandt);
    const item = await serializedItemModel.findBySgtin(sgtin);

    if (!item) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: 'SGTIN not found in system',
        formatValid: true
      });
    }

    // Get product details
    const productModel = new Product(mandt);
    const product = await productModel.findByGtin(item.gtin);

    res.status(200).json({
      success: true,
      valid: true,
      sgtin: item.sgtin,
      status: item.status,
      product: product ? {
        gtin: product.gtin,
        name: product.product_name,
        brand: product.brand,
        category: product.category
      } : null,
      batch: item.batch,
      manufactureDate: item.manufacture_date,
      location: item.location
    });

  } catch (error) {
    console.error('Error validating SGTIN:', error);
    next(error);
  }
};

/**
 * Get complete lifecycle trace for an SGTIN
 * GET /api/sgtin/trace/:sgtin
 */
exports.trace = async (req, res, next) => {
  try {
    const { sgtin } = req.params;
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    // Get SGTIN details
    const serializedItemModel = new SerializedItem(mandt);
    const item = await serializedItemModel.findBySgtin(sgtin);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'SGTIN not found in system'
      });
    }

    // Get lifecycle events
    const lifecycleEventModel = new LifecycleEvent(mandt);
    const events = await lifecycleEventModel.getTrace(sgtin);

    // Get product details
    const productModel = new Product(mandt);
    const product = await productModel.findByGtin(item.gtin);

    res.status(200).json({
      success: true,
      sgtin: item.sgtin,
      currentStatus: item.status,
      product: product ? {
        gtin: product.gtin,
        name: product.product_name,
        brand: product.brand,
        category: product.category
      } : null,
      batch: item.batch,
      manufactureDate: item.manufacture_date,
      location: item.location,
      lifecycle: events.map(event => ({
        eventType: event.event_type,
        timestamp: event.event_timestamp,
        location: event.location,
        data: event.metadata
      }))
    });

  } catch (error) {
    console.error('Error getting trace:', error);
    next(error);
  }
};

/**
 * Get all SGTINs for a specific purchase order
 * GET /api/sgtin/purchase-order/:poId
 */
exports.getSgtinsByPurchaseOrder = async (req, res, next) => {
  try {
    const { poId } = req.params;
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    if (!poId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: poId'
      });
    }

    const serializedItemModel = new SerializedItem(mandt);
    
    // Query to get all SGTINs mapped to this purchase order
    const query = `
      SELECT 
        si.sgtin,
        si.gtin,
        si.status,
        si.location,
        si.batch,
        si.manufacture_date,
        si.created_at,
        p.name AS product_name,
        p.brand,
        p.category,
        psm.created_at AS mapped_at
      FROM po_sgtin_mapping psm
      JOIN serialized_items si ON psm.mandt = si.mandt AND psm.sgtin = si.sgtin
      JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin
      WHERE psm.mandt = $1 AND psm.po_id = $2
      ORDER BY psm.created_at ASC
    `;

    const result = await serializedItemModel.customQuery(query, [mandt, poId]);
    const sgtins = result.rows;

    if (sgtins.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No SGTINs found for purchase order ${poId}`,
        poId,
        sgtins: []
      });
    }

    // Group by status for summary
    const statusSummary = {};
    sgtins.forEach(item => {
      statusSummary[item.status] = (statusSummary[item.status] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      poId,
      totalCount: sgtins.length,
      statusSummary,
      sgtins: sgtins.map(item => ({
        sgtin: item.sgtin,
        serialNumber: item.sgtin.substring(18), // Extract serial number
        gtin: item.gtin,
        status: item.status,
        location: item.location,
        batch: item.batch,
        manufactureDate: item.manufacture_date,
        product: {
          name: item.product_name,
          brand: item.brand,
          category: item.category
        },
        createdAt: item.created_at,
        mappedAt: item.mapped_at
      }))
    });

  } catch (error) {
    console.error('Error getting SGTINs for purchase order:', error);
    next(error);
  }
};
