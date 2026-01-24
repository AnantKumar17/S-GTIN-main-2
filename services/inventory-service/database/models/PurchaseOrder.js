// PurchaseOrder Model
// Represents purchase orders with SGTIN tracking

const BaseModel = require('./BaseModel');

class PurchaseOrder extends BaseModel {
  constructor(mandt) {
    super('purchase_orders', mandt);
  }

  /**
   * Find purchase order by PO ID
   * @param {string} poId - Purchase order ID
   * @returns {Promise<Object|null>} PO record
   */
  async findByPoId(poId) {
    return await this.findOne({ po_id: poId });
  }

  /**
   * Find purchase orders by status
   * @param {string} status - PO status (OPEN, PARTIALLY_RECEIVED, FULLY_RECEIVED, CANCELLED)
   * @returns {Promise<Array>} Array of POs
   */
  async findByStatus(status) {
    return await this.findAll({ status });
  }

  /**
   * Find purchase orders by GTIN
   * @param {string} gtin - Global Trade Item Number
   * @returns {Promise<Array>} Array of POs
   */
  async findByGtin(gtin) {
    return await this.findAll({ gtin });
  }

  /**
   * Get PO details with product information
   * @param {string} poId - Purchase order ID
   * @returns {Promise<Object|null>} PO with product details
   */
  async getPoDetails(poId) {
    const query = `
      SELECT 
        po.po_id,
        po.gtin,
        p.name AS product_name,
        p.brand,
        p.category,
        po.quantity,
        po.received_quantity,
        po.status,
        po.supplier,
        po.warehouse,
        po.expected_delivery_date,
        po.created_at,
        po.updated_at
      FROM purchase_orders po
      JOIN products p ON po.mandt = p.mandt AND po.gtin = p.gtin
      WHERE po.mandt = $1 AND po.po_id = $2
    `;

    const result = await this.customQuery(query, [this.mandt, poId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get all POs with product details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of POs with product details
   */
  async getAllWithDetails(filters = {}) {
    const conditions = ['po.mandt = $1'];
    const values = [this.mandt];
    let paramCount = 1;

    if (filters.status) {
      paramCount++;
      conditions.push(`po.status = $${paramCount}`);
      values.push(filters.status);
    }

    if (filters.gtin) {
      paramCount++;
      conditions.push(`po.gtin = $${paramCount}`);
      values.push(filters.gtin);
    }

    const query = `
      SELECT 
        po.po_id,
        po.gtin,
        p.name AS product_name,
        p.brand,
        p.category,
        po.quantity,
        po.received_quantity,
        po.status,
        po.supplier,
        po.warehouse,
        po.expected_delivery_date,
        po.created_at,
        po.updated_at
      FROM purchase_orders po
      JOIN products p ON po.mandt = p.mandt AND po.gtin = p.gtin
      WHERE ${conditions.join(' AND ')}
      ORDER BY po.created_at DESC
    `;

    const result = await this.customQuery(query, values);
    return result.rows;
  }

  /**
   * Create a new purchase order
   * @param {Object} poData - PO data
   * @returns {Promise<Object>} Created PO
   */
  async create(poData) {
    const requiredFields = ['po_id', 'gtin', 'quantity'];
    for (const field of requiredFields) {
      if (!poData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Set defaults
    if (!poData.status) {
      poData.status = 'OPEN';
    }
    if (!poData.received_quantity) {
      poData.received_quantity = 0;
    }

    // Check if PO ID already exists
    const existing = await this.findByPoId(poData.po_id);
    if (existing) {
      throw new Error(`Purchase order with ID ${poData.po_id} already exists`);
    }

    return await this.insert(poData);
  }

  /**
   * Update received quantity and status
   * @param {string} poId - PO ID to update
   * @param {number} additionalQuantity - Quantity being received
   * @returns {Promise<Object>} Updated PO
   */
  async updateReceivedQuantity(poId, additionalQuantity) {
    const po = await this.findByPoId(poId);
    if (!po) {
      throw new Error(`Purchase order ${poId} not found`);
    }

    const newReceivedQty = po.received_quantity + additionalQuantity;
    
    if (newReceivedQty > po.quantity) {
      throw new Error(`Cannot receive more than ordered quantity. Ordered: ${po.quantity}, Already received: ${po.received_quantity}, Trying to receive: ${additionalQuantity}`);
    }

    const updates = {
      received_quantity: newReceivedQty
    };

    // Status will be auto-updated by database trigger
    const updated = await this.update({ po_id: poId }, updates);
    return updated.length > 0 ? updated[0] : null;
  }

  /**
   * Get SGTINs associated with a PO
   * @param {string} poId - Purchase order ID
   * @returns {Promise<Array>} Array of SGTINs
   */
  async getSgtins(poId) {
    const query = `
      SELECT 
        mapping.sgtin,
        si.status,
        si.location,
        si.batch,
        si.barcode,
        si.qr_code
      FROM po_sgtin_mapping mapping
      LEFT JOIN serialized_items si ON mapping.mandt = si.mandt AND mapping.sgtin = si.sgtin
      WHERE mapping.mandt = $1 AND mapping.po_id = $2
      ORDER BY mapping.sgtin
    `;

    const result = await this.customQuery(query, [this.mandt, poId]);
    return result.rows;
  }

  /**
   * Link SGTINs to a PO
   * @param {string} poId - Purchase order ID
   * @param {Array<string>} sgtins - Array of SGTINs
   * @returns {Promise<number>} Number of SGTINs linked
   */
  async linkSgtins(poId, sgtins) {
    if (sgtins.length === 0) return 0;

    const query = `
      INSERT INTO po_sgtin_mapping (mandt, po_id, sgtin)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `;

    let linkedCount = 0;
    for (const sgtin of sgtins) {
      const result = await this.customQuery(query, [this.mandt, poId, sgtin]);
      linkedCount += result.rowCount;
    }

    return linkedCount;
  }

  /**
   * Generate next PO ID
   * @returns {Promise<string>} Next PO ID
   */
  async generatePoId() {
    const query = `
      SELECT po_id FROM purchase_orders
      WHERE mandt = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.customQuery(query, [this.mandt]);
    
    if (result.rows.length === 0) {
      return 'PO-45000001';
    }

    const lastPoId = result.rows[0].po_id;
    const match = lastPoId.match(/PO-(\d+)/);
    
    if (match) {
      const nextNumber = parseInt(match[1]) + 1;
      return `PO-${nextNumber.toString().padStart(8, '0')}`;
    }

    return 'PO-45000001';
  }
}

module.exports = PurchaseOrder;
