const path = require('path');
const { SerializedItem, Sale, Product, LifecycleEvent } = require(path.join(__dirname, '../../../../database/models'));
const db = require(path.join(__dirname, '../../../../database/models/db'));
const { decodeBarcode, validateSGTINFormat, parseSGTIN } = require(path.join(__dirname, '../../../../shared/utils/barcodeDecoder'));
const barcodeScanner = require(path.join(__dirname, '../../../../shared/utils/barcodeScanner'));

/**
 * Get all sales
 * GET /api/sales?mandt=100&limit=50
 */
exports.getAllSales = async (req, res, next) => {
  try {
    const { mandt = '100', limit = '50' } = req.query;

    const saleModel = new Sale(mandt);
    const sales = await saleModel.getAllSales(parseInt(limit));

    res.status(200).json({
      success: true,
      count: sales.length,
      sales: sales
    });

  } catch (error) {
    console.error('Error getting all sales:', error);
    next(error);
  }
};

/**
 * Process sale transaction with counterfeit detection
 * POST /api/sales
 */
exports.processSale = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { mandt, sgtins, storeId, customerId, cashierId } = req.body;

    // Validation
    if (!mandt || !sgtins || !Array.isArray(sgtins) || sgtins.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, sgtins (array)'
      });
    }

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: storeId'
      });
    }

    const serializedItemModel = new SerializedItem(mandt);
    const productModel = new Product(mandt);
    const lifecycleEventModel = new LifecycleEvent(mandt);
    
    // COUNTERFEIT DETECTION: Check each SGTIN
    const validatedItems = [];
    const counterfeitItems = [];

    for (const sgtin of sgtins) {
      const item = await serializedItemModel.findBySgtin(sgtin);
      
      // Check 1: Unknown SGTIN (counterfeit)
      if (!item) {
        counterfeitItems.push({
          sgtin,
          reason: 'UNKNOWN_SGTIN',
          severity: 'HIGH',
          message: 'SGTIN not found in system - possible counterfeit'
        });
        
        // Log counterfeit attempt
        await db.query(
          `INSERT INTO counterfeit_logs (mandt, sgtin, reason, store_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [mandt, sgtin, 'NOT_FOUND', storeId, JSON.stringify({ severity: 'HIGH', detection_method: 'UNKNOWN_SGTIN' })]
        );
        continue;
      }

      // Check 2: Already sold (resale fraud)
      if (item.status === 'SOLD') {
        counterfeitItems.push({
          sgtin,
          reason: 'ALREADY_SOLD',
          severity: 'HIGH',
          message: `Item already sold on ${item.updated_at}`
        });
        
        // Log counterfeit attempt
        await db.query(
          `INSERT INTO counterfeit_logs (mandt, sgtin, reason, store_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [mandt, sgtin, 'ALREADY_SOLD', storeId, JSON.stringify({ severity: 'HIGH', previous_sale: item.updated_at })]
        );
        continue;
      }

      // Check 3: Wrong status (should be IN_STOCK or IN_TRANSIT)
      if (item.status !== 'IN_STOCK' && item.status !== 'IN_TRANSIT') {
        counterfeitItems.push({
          sgtin,
          reason: 'INVALID_STATUS',
          severity: 'MEDIUM',
          message: `Item has invalid status: ${item.status}`
        });
        continue;
      }

      validatedItems.push(item);
    }

    // If any counterfeits detected, return error
    if (counterfeitItems.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Counterfeit items detected',
        counterfeit: counterfeitItems,
        validCount: validatedItems.length,
        counterfeitCount: counterfeitItems.length
      });
    }

    // All items valid - process sale
    const saleItems = [];
    let totalAmount = 0;

    for (const item of validatedItems) {
      const product = await productModel.findByGtin(item.gtin);
      const price = product ? parseFloat(product.price) : 0;
      totalAmount += price;

      saleItems.push({
        sgtin: item.sgtin,
        gtin: item.gtin,
        price,
        product_name: product ? product.name : 'Unknown'
      });

      // Update SGTIN status to SOLD
      await serializedItemModel.updateStatus(item.sgtin, 'SOLD', storeId);

      // Create lifecycle event
      await lifecycleEventModel.createEvent({
        sgtin: item.sgtin,
        event_type: 'SOLD',
        location: storeId,
        metadata: {
          customer_id: customerId || null,
          cashier_id: cashierId || null,
          price
        }
      });
    }

    // Create sale record
    const saleModel = new Sale(mandt);
    const saleId = await saleModel.generateSaleId();
    const sale = await saleModel.createSale({
      sale_id: saleId,
      store_id: storeId,
      cashier_id: cashierId || null,
      total_amount: totalAmount
    }, saleItems);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Sale processed successfully for ${validatedItems.length} item(s)`,
      sale: {
        saleId: sale.sale_id,
        totalAmount: sale.total_amount,
        itemCount: saleItems.length,
        storeId: sale.store_id,
        saleDate: sale.sale_date
      },
      items: saleItems
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing sale:', error);
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Get sale details
 * GET /api/sales/:saleId?mandt=100
 */
exports.getSaleDetails = async (req, res, next) => {
  try {
    const { saleId } = req.params;
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    const saleModel = new Sale(mandt);
    const saleDetails = await saleModel.getSaleDetails(saleId);

    if (!saleDetails) {
      return res.status(404).json({
        success: false,
        error: `Sale ${saleId} not found`
      });
    }

    res.status(200).json({
      success: true,
      sale: saleDetails
    });

  } catch (error) {
    console.error('Error getting sale details:', error);
    next(error);
  }
};

/**
 * Get counterfeit detection logs
 * GET /api/sales/logs/counterfeit?mandt=100&from=2026-01-01
 */
exports.getCounterfeitLogs = async (req, res, next) => {
  try {
    const { mandt, from, to, severity } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    let query = `
      SELECT cl.*, si.gtin, p.name, p.brand
      FROM counterfeit_logs cl
      LEFT JOIN serialized_items si ON cl.sgtin = si.sgtin AND cl.mandt = si.mandt
      LEFT JOIN products p ON si.gtin = p.gtin AND si.mandt = p.mandt
      WHERE cl.mandt = $1
    `;
    const params = [mandt];
    let paramIndex = 2;

    if (from) {
      query += ` AND cl.detected_at >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND cl.detected_at <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    if (severity) {
      query += ` AND cl.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    query += ` ORDER BY cl.detected_at DESC LIMIT 100`;

    const result = await db.query(query, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      counterfeitLogs: result.rows
    });

  } catch (error) {
    console.error('Error getting counterfeit logs:', error);
    next(error);
  }
};

/**
 * Scan barcode for POS sale
 * POST /api/sales/scan-barcode
 * Body: { mandt, barcodeImage, storeId }
 */
exports.scanBarcodeForSale = async (req, res, next) => {
  try {
    const { mandt, barcodeImage, storeId } = req.body;

    // Validation
    if (!mandt || !barcodeImage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, barcodeImage'
      });
    }

    // Decode barcode image to get SGTIN
    let sgtin;
    try {
      sgtin = await decodeBarcode(barcodeImage);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Failed to decode barcode image',
        details: error.message
      });
    }

    // Validate SGTIN format
    if (!validateSGTINFormat(sgtin)) {
      return res.status(400).json({
        success: false,
        error: 'Decoded barcode is not a valid SGTIN format',
        decoded: sgtin
      });
    }

    // Parse SGTIN to get components
    const sgtinData = parseSGTIN(sgtin);

    // Get item details and validate
    const serializedItemModel = new SerializedItem(mandt);
    const item = await serializedItemModel.findBySgtin(sgtin);

    if (!item) {
      // Log counterfeit attempt
      await db.query(
        `INSERT INTO counterfeit_logs (mandt, sgtin, reason, store_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [mandt, sgtin, 'NOT_FOUND', storeId, JSON.stringify({ 
          severity: 'HIGH', 
          detection_method: 'BARCODE_SCAN',
          decoded_sgtin: sgtin 
        })]
      );

      return res.status(404).json({
        success: false,
        error: 'SGTIN not found in system - possible counterfeit',
        sgtin,
        ...sgtinData,
        severity: 'HIGH'
      });
    }

    // Get product details
    const productModel = new Product(mandt);
    const product = await productModel.findByGtin(item.gtin);

    // Check status
    let canSell = item.status === 'IN_STOCK' || item.status === 'IN_TRANSIT';
    let statusMessage = '';

    if (item.status === 'SOLD') {
      statusMessage = `Already sold on ${item.updated_at}`;
      // Log counterfeit attempt
      await db.query(
        `INSERT INTO counterfeit_logs (mandt, sgtin, reason, store_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [mandt, sgtin, 'ALREADY_SOLD', storeId, JSON.stringify({ 
          severity: 'HIGH', 
          previous_sale: item.updated_at 
        })]
      );
    } else if (!canSell) {
      statusMessage = `Invalid status: ${item.status}`;
    }

    // Return decoded SGTIN info for confirmation
    res.status(200).json({
      success: true,
      message: canSell ? 'Barcode decoded successfully' : 'Item cannot be sold',
      sgtin,
      ...sgtinData,
      currentStatus: item.status,
      canSell,
      statusMessage,
      product: product ? {
        gtin: product.gtin,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price
      } : null,
      location: item.location,
      batch: item.batch
    });

  } catch (error) {
    console.error('Error scanning barcode for sale:', error);
    next(error);
  }
};

/**
 * Scan barcode/QR image for POS sale
 * POST /api/sales/scan-image
 */
exports.scanBarcodeImage = async (req, res, next) => {
  try {
    const { mandt, barcodeImage } = req.body;

    // Validation
    if (!mandt || !barcodeImage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, barcodeImage (Base64)'
      });
    }

    // Decode the barcode image
    const decoded = await barcodeScanner.decodeBarcode(barcodeImage);

    if (!decoded.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to decode barcode image',
        details: decoded.error || decoded.reason
      });
    }

    const sgtin = decoded.sgtin;

    // Validate SGTIN format
    const validation = barcodeScanner.validateSGTIN(sgtin);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        decoded: sgtin
      });
    }

    // Parse SGTIN to get components
    const sgtinData = parseSGTIN(sgtin);

    // Get item details
    const serializedItemModel = new SerializedItem(mandt);
    const item = await serializedItemModel.findBySgtin(sgtin);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'SGTIN not found in database',
        sgtin,
        counterfeitWarning: 'This item may be counterfeit - not registered in system'
      });
    }

    // Get product details
    const productModel = new Product(mandt);
    const product = await productModel.findByGtin(item.gtin);

    // Check if item can be sold
    let canSell = false;
    let statusMessage = '';

    if (item.status === 'IN_STOCK' || item.status === 'IN_TRANSIT') {
      canSell = true;
      statusMessage = 'Item is available for sale';
    } else if (item.status === 'SOLD') {
      statusMessage = 'Item already sold - potential resale fraud';
    } else {
      statusMessage = `Item has status ${item.status} - cannot be sold`;
    }

    // Return decoded SGTIN info for confirmation
    res.status(200).json({
      success: true,
      message: canSell ? 'Barcode image decoded successfully' : 'Item cannot be sold',
      sgtin,
      barcodeType: decoded.type,
      confidence: decoded.confidence,
      ...sgtinData,
      currentStatus: item.status,
      canSell,
      statusMessage,
      product: product ? {
        gtin: product.gtin,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price
      } : null,
      location: item.location,
      batch: item.batch
    });

  } catch (error) {
    console.error('Error scanning barcode image for sale:', error);
    next(error);
  }
};
