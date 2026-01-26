const path = require('path');
const { SerializedItem, PurchaseOrder, Product, LifecycleEvent } = require(path.join(__dirname, '../../database/models'));
const db = require(path.join(__dirname, '../../database/models/db'));
const { decodeBarcode, validateSGTINFormat, parseSGTIN } = require(path.join(__dirname, '../utils/barcodeDecoder'));
const barcodeScanner = require(path.join(__dirname, '../utils/barcodeScanner'));

/**
 * Get goods receipt history
 * GET /api/goods-receipts?mandt=100
 */
exports.getGoodsReceipts = async (req, res, next) => {
  try {
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    // Query the actual goods_receipts table
    const query = `
      SELECT 
        gr_id,
        po_id,
        warehouse,
        received_quantity as items_count,
        received_at,
        received_by
      FROM goods_receipts
      WHERE mandt = $1
      ORDER BY received_at DESC
      LIMIT 50
    `;

    const result = await db.query(query, [mandt]);

    // Format the results to match the expected frontend structure
    const receipts = result.rows.map(row => ({
      gr_id: row.gr_id,
      po_id: row.po_id,
      warehouse: row.warehouse,
      items_count: parseInt(row.items_count),
      received_at: row.received_at,
      supplier: row.received_by || 'Unknown'
    }));

    res.status(200).json({
      success: true,
      count: receipts.length,
      receipts: receipts
    });

  } catch (error) {
    console.error('Error getting goods receipts:', error);
    next(error);
  }
};

/**
 * Record goods receipt
 * POST /api/goods-receipts
 */
exports.receiveGoods = async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { mandt, poId, sgtins, location, receivedBy } = req.body;

    // Validation
    if (!mandt || !poId || !sgtins || !Array.isArray(sgtins) || sgtins.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, poId, sgtins (array)'
      });
    }

    // Verify PO exists
    const purchaseOrderModel = new PurchaseOrder(mandt);
    const po = await purchaseOrderModel.findOne({ po_id: poId });
    
    if (!po) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: `Purchase order ${poId} not found`
      });
    }

    // Get expected SGTINs for this PO
    const expectedSGTINs = await purchaseOrderModel.getSgtins(poId);
    const expectedSGTINSet = new Set(expectedSGTINs.map(s => s.sgtin));

    // Validate that all scanned SGTINs belong to this PO
    const invalidSGTINs = sgtins.filter(sgtin => !expectedSGTINSet.has(sgtin));
    if (invalidSGTINs.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `SGTINs not found in PO ${poId}`,
        invalidSGTINs
      });
    }

    // CRITICAL FIX: Check if any SGTINs have already been received
    const serializedItemModel = new SerializedItem(mandt);
    const alreadyReceivedSGTINs = [];
    
    for (const sgtin of sgtins) {
      const item = await serializedItemModel.findOne({ sgtin });
      if (item && (item.status === 'IN_STOCK' || item.status === 'SOLD' || item.status === 'IN_TRANSIT' || item.status === 'RETURNED')) {
        alreadyReceivedSGTINs.push({
          sgtin,
          currentStatus: item.status,
          location: item.location,
          lastUpdated: item.updated_at
        });
      }
    }

    if (alreadyReceivedSGTINs.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `Cannot receive goods: ${alreadyReceivedSGTINs.length} SGTIN(s) have already been received`,
        alreadyReceived: alreadyReceivedSGTINs
      });
    }

    const lifecycleEventModel = new LifecycleEvent(mandt);

    // Generate goods receipt ID
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const sequenceQuery = `
      SELECT COALESCE(MAX(CAST(SUBSTRING(gr_id FROM 'GR-\\d{8}-${poId}-(\\d+)') FROM '\\d+') AS INTEGER), 0) + 1 as next_seq
      FROM goods_receipts
      WHERE mandt = $1 AND gr_id LIKE 'GR-${dateStr}-${poId}-%'
    `;
    const sequenceResult = await client.query(sequenceQuery, [mandt]);
    const sequence = sequenceResult.rows[0].next_seq || 1;
    const grId = `GR-${dateStr}-${poId}-${sequence.toString().padStart(3, '0')}`;

    // Update each SGTIN status to IN_STOCK
    for (const sgtin of sgtins) {
      await serializedItemModel.updateStatus(sgtin, 'IN_STOCK', location);

      // Create lifecycle event
      await lifecycleEventModel.createEvent({
        sgtin,
        event_type: 'RECEIVED',
        location,
        metadata: {
          po_id: poId,
          received_by: receivedBy || null
        }
      });
    }

    // Update PO received quantity
    await purchaseOrderModel.updateReceivedQuantity(poId, sgtins.length);

    // Create goods receipt record
    const goodsReceiptQuery = `
      INSERT INTO goods_receipts
      (mandt, gr_id, po_id, warehouse, received_quantity, received_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const goodsReceiptResult = await client.query(goodsReceiptQuery, [
      mandt, grId, poId, location, sgtins.length, receivedBy || null
    ]);
    const goodsReceipt = goodsReceiptResult.rows[0];

    // Create goods receipt to SGTIN mappings
    for (const sgtin of sgtins) {
      const mappingQuery = `
        INSERT INTO gr_sgtin_mapping
        (mandt, gr_id, sgtin)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      await client.query(mappingQuery, [mandt, grId, sgtin]);
    }

    await client.query('COMMIT');

    // Calculate new received quantity for status determination
    const newReceivedQuantity = (po.received_quantity || 0) + sgtins.length;

    res.status(200).json({
      success: true,
      message: `Successfully received ${sgtins.length} item(s)`,
      goodsReceipt: {
        grId,
        poId,
        receivedCount: sgtins.length,
        location,
        poStatus: newReceivedQuantity >= po.quantity ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error receiving goods:', error);
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Query inventory with filters
 * GET /api/inventory?mandt=100&status=IN_STOCK&location=Bangalore&dateFrom=2024-01-01&dateTo=2024-12-31&poId=PO-001&datePeriod=last6months
 */
exports.getInventory = async (req, res, next) => {
  try {
    const { mandt, status, location, gtin, batch, dateFrom, dateTo, poId, datePeriod } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    // Calculate date range for predefined periods
    let calculatedDateFrom = dateFrom;
    let calculatedDateTo = dateTo;
    
    if (datePeriod) {
      // Use local timezone to ensure correct date calculations
      const now = new Date();
      
      // Helper function to format date in local timezone as YYYY-MM-DD
      const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      switch (datePeriod) {
        case 'today':
          // Use local date instead of UTC to avoid timezone issues
          calculatedDateFrom = formatLocalDate(now);
          calculatedDateTo = calculatedDateFrom;
          break;
        case 'thisweek':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          calculatedDateFrom = formatLocalDate(startOfWeek);
          calculatedDateTo = formatLocalDate(now);
          break;
        case 'thismonth':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          calculatedDateFrom = formatLocalDate(startOfMonth);
          calculatedDateTo = formatLocalDate(now);
          break;
        case 'last30days':
          const last30Days = new Date(now);
          last30Days.setDate(now.getDate() - 30);
          calculatedDateFrom = formatLocalDate(last30Days);
          calculatedDateTo = formatLocalDate(now);
          break;
        case 'last6months':
          const last6Months = new Date(now);
          last6Months.setMonth(now.getMonth() - 6);
          calculatedDateFrom = formatLocalDate(last6Months);
          calculatedDateTo = formatLocalDate(now);
          break;
        case 'thisyear':
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          calculatedDateFrom = formatLocalDate(startOfYear);
          calculatedDateTo = formatLocalDate(now);
          break;
      }
    }

    const inventory = await exports.getInventoryWithFilters(mandt, {
      status,
      location,
      gtin,
      batch,
      dateFrom: calculatedDateFrom,
      dateTo: calculatedDateTo,
      poId
    });

    res.status(200).json({
      success: true,
      count: inventory.length,
      inventory: inventory,
      filters: {
        applied: {
          status,
          location,
          gtin,
          batch,
          poId,
          dateFrom: calculatedDateFrom,
          dateTo: calculatedDateTo,
          datePeriod
        }
      }
    });

  } catch (error) {
    console.error('Error querying inventory:', error);
    next(error);
  }
};

/**
 * Enhanced inventory query with PO ID and Goods Receipt Date
 * @param {string} mandt - Client
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Inventory items with enhanced data
 */
exports.getInventoryWithFilters = async (mandt, filters = {}) => {
  const conditions = ['si.mandt = $1'];
  const values = [mandt];
  let paramCount = 1;

  // Helper function to convert date to PostgreSQL format
  const formatDateForPostgres = (dateStr) => {
    if (!dateStr) return null;
    
    // If already in ISO format (YYYY-MM-DD), return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Handle DD/MM/YY format like "22/01/26"
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      const fullYear = parseInt(year) + 2000; // Convert YY to YYYY
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Handle DD/MM/YYYY format like "22/01/2026" or "23/01/2026"
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Handle MM/DD/YYYY format (American format) like "01/23/2026"
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      // This regex is same as DD/MM/YYYY, so we need context to determine
      // For now, assume DD/MM/YYYY format since that's more common internationally
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try to parse as Date and format using local timezone
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        // Use local date formatting to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      // Silently handle parse errors
    }
    
    return dateStr; // Return as is if can't parse
  };

  // Build WHERE conditions
  // Only filter by status if it's provided and not empty
  if (filters.status && filters.status.trim() !== '') {
    paramCount++;
    conditions.push(`si.status = $${paramCount}`);
    values.push(filters.status);
  }

  if (filters.gtin) {
    paramCount++;
    conditions.push(`si.gtin = $${paramCount}`);
    values.push(filters.gtin);
  }

  if (filters.batch) {
    paramCount++;
    conditions.push(`si.batch = $${paramCount}`);
    values.push(filters.batch);
  }

  if (filters.location) {
    paramCount++;
    conditions.push(`si.location = $${paramCount}`);
    values.push(filters.location);
  }

  if (filters.poId) {
    paramCount++;
    conditions.push(`psm.po_id = $${paramCount}`);
    values.push(filters.poId);
  }

  if (filters.dateFrom) {
    const formattedDate = formatDateForPostgres(filters.dateFrom);
    if (formattedDate) {
      paramCount++;
      conditions.push(`DATE(le_received.created_at) >= $${paramCount}`);
      values.push(formattedDate);
    }
  }

  if (filters.dateTo) {
    const formattedDate = formatDateForPostgres(filters.dateTo);
    if (formattedDate) {
      paramCount++;
      conditions.push(`DATE(le_received.created_at) <= $${paramCount}`);
      values.push(formattedDate);
    }
  }

  const query = `
    SELECT 
      si.sgtin,
      si.gtin,
      p.name AS product_name,
      p.brand,
      p.category,
      p.price,
      si.status,
      si.location,
      si.batch,
      si.manufacture_date,
      si.passport,
      si.created_at,
      si.updated_at,
      psm.po_id,
      le_received.created_at AS goods_receipt_date
    FROM serialized_items si
    JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin
    LEFT JOIN po_sgtin_mapping psm ON si.sgtin = psm.sgtin AND si.mandt = psm.mandt
    LEFT JOIN (
      SELECT sgtin, mandt, MIN(created_at) AS created_at
      FROM lifecycle_events 
      WHERE event_type = 'RECEIVED'
      GROUP BY sgtin, mandt
    ) le_received ON si.sgtin = le_received.sgtin AND si.mandt = le_received.mandt
    WHERE ${conditions.join(' AND ')}
    ORDER BY si.created_at DESC
  `;

  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Get all products from master data
 * GET /api/inventory/products?mandt=100
 */
exports.getProducts = async (req, res, next) => {
  try {
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    // Query to get all products from products table
    const query = `
      SELECT gtin, name, brand, category, subcategory, price, description
      FROM products
      WHERE mandt = $1
      ORDER BY brand, name
    `;

    const result = await db.query(query, [mandt]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      products: result.rows
    });

  } catch (error) {
    console.error('Error getting products:', error);
    next(error);
  }
};

/**
 * Get available PO IDs for filtering
 * GET /api/inventory/po-ids?mandt=100
 */
exports.getAvailablePoIds = async (req, res, next) => {
  try {
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    const query = `
      SELECT DISTINCT psm.po_id, po.supplier, COUNT(psm.sgtin) as item_count
      FROM po_sgtin_mapping psm
      JOIN purchase_orders po ON psm.po_id = po.po_id AND psm.mandt = po.mandt
      JOIN serialized_items si ON psm.sgtin = si.sgtin AND psm.mandt = si.mandt
      WHERE psm.mandt = $1
      GROUP BY psm.po_id, po.supplier
      ORDER BY psm.po_id DESC
    `;

    const result = await db.query(query, [mandt]);

    const poIds = result.rows.map(row => {
      // Don't show supplier name if it's DEFAULT_SUPPLIER or Unknown
      const showSupplier = row.supplier && row.supplier !== 'DEFAULT_SUPPLIER' && row.supplier !== 'Unknown';
      const text = showSupplier 
        ? `${row.po_id} - ${row.supplier} (${row.item_count} items)`
        : `${row.po_id} (${row.item_count} items)`;
      
      return {
        key: row.po_id,
        text: text
      };
    });

    res.status(200).json({
      success: true,
      count: poIds.length,
      poIds: poIds
    });

  } catch (error) {
    console.error('Error getting available PO IDs:', error);
    next(error);
  }
};

/**
 * Get products without serialized items (for chatbot)
 * GET /api/inventory/missing-sgtins?mandt=100
 */
exports.getMissingSGTINs = async (req, res, next) => {
  try {
    const { mandt } = req.query;

    if (!mandt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: mandt'
      });
    }

    // Query to find products without any serialized items
    const query = `
      SELECT p.gtin, p.name, p.brand, p.category
      FROM products p
      LEFT JOIN serialized_items si ON p.gtin = si.gtin AND p.mandt = si.mandt
      WHERE p.mandt = $1 AND si.sgtin IS NULL
      ORDER BY p.brand, p.name
    `;

    const result = await db.query(query, [mandt]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      products: result.rows
    });

  } catch (error) {
    console.error('Error getting products without SGTINs:', error);
    next(error);
  }
};

/**
 * Scan barcode for goods receipt
 * POST /api/goods-receipts/scan-barcode
 * Body: { mandt, poId, barcodeImage, location, receivedBy }
 */
exports.scanBarcodeForReceipt = async (req, res, next) => {
  try {
    const { mandt, poId, barcodeImage, location, receivedBy } = req.body;

    // Validation
    if (!mandt || !poId || !barcodeImage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, poId, barcodeImage'
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

    // Verify SGTIN belongs to the PO
    const purchaseOrderModel = new PurchaseOrder(mandt);
    const expectedSGTINs = await purchaseOrderModel.getSgtins(poId);
    const expectedSGTINSet = new Set(expectedSGTINs.map(s => s.sgtin));

    if (!expectedSGTINSet.has(sgtin)) {
      return res.status(400).json({
        success: false,
        error: `SGTIN ${sgtin} does not belong to PO ${poId}`,
        sgtin,
        ...sgtinData
      });
    }

    // Get current status
    const serializedItemModel = new SerializedItem(mandt);
    const item = await serializedItemModel.findBySgtin(sgtin);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'SGTIN not found in database',
        sgtin
      });
    }

    // Return decoded SGTIN info for confirmation
    res.status(200).json({
      success: true,
      message: 'Barcode decoded successfully',
      sgtin,
      ...sgtinData,
      currentStatus: item.status,
      canReceive: item.status === 'CREATED' || item.status === 'IN_TRANSIT',
      poId,
      location: item.location
    });

  } catch (error) {
    console.error('Error scanning barcode:', error);
    next(error);
  }
};

/**
 * Scan barcode image for goods receipt
 * POST /api/goods-receipts/scan-image
 */
exports.scanBarcodeImage = async (req, res, next) => {
  try {
    const { mandt, poId, barcodeImage } = req.body;

    // Validation
    if (!mandt || !poId || !barcodeImage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: mandt, poId, barcodeImage (Base64)'
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

    // Verify SGTIN belongs to the PO
    const purchaseOrderModel = new PurchaseOrder(mandt);
    const expectedSGTINs = await purchaseOrderModel.getSgtins(poId);
    const expectedSGTINSet = new Set(expectedSGTINs.map(s => s.sgtin));

    if (!expectedSGTINSet.has(sgtin)) {
      return res.status(400).json({
        success: false,
        error: `SGTIN ${sgtin} does not belong to PO ${poId}`,
        sgtin,
        ...sgtinData
      });
    }

    // Get current status
    const serializedItemModel = new SerializedItem(mandt);
    const item = await serializedItemModel.findBySgtin(sgtin);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'SGTIN not found in database',
        sgtin
      });
    }

    // Return decoded SGTIN info for confirmation
    res.status(200).json({
      success: true,
      message: 'Barcode image decoded successfully',
      sgtin,
      barcodeType: decoded.type,
      confidence: decoded.confidence,
      ...sgtinData,
      currentStatus: item.status,
      canReceive: item.status === 'CREATED' || item.status === 'IN_TRANSIT',
      poId,
      location: item.location
    });

  } catch (error) {
    console.error('Error scanning barcode image:', error);
    next(error);
  }
};