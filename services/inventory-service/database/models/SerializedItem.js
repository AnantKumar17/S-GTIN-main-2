// SerializedItem Model
// Represents individual serialized items at SGTIN level

const BaseModel = require('./BaseModel');

class SerializedItem extends BaseModel {
  constructor(mandt) {
    super('serialized_items', mandt);
  }

  /**
   * Find item by SGTIN
   * @param {string} sgtin - Serialized GTIN
   * @param {boolean} includeDeleted - Include soft-deleted items (default: false) - Note: soft delete not yet implemented in schema
   * @returns {Promise<Object|null>} Serialized item record
   */
  async findBySgtin(sgtin, includeDeleted = false) {
    // Note: deleted_at column does not exist in current schema
    // Using standard findOne which queries by mandt and sgtin
    return await this.findOne({ sgtin });
  }

  /**
   * Find items by GTIN
   * @param {string} gtin - Global Trade Item Number
   * @returns {Promise<Array>} Array of serialized items
   */
  async findByGtin(gtin) {
    return await this.findAll({ gtin });
  }

  /**
   * Find items by status
   * @param {string} status - Item status (CREATED, IN_STOCK, SOLD, etc.)
   * @returns {Promise<Array>} Array of serialized items
   */
  async findByStatus(status) {
    return await this.findAll({ status });
  }

  /**
   * Find items by batch
   * @param {string} batch - Batch identifier
   * @returns {Promise<Array>} Array of serialized items
   */
  async findByBatch(batch) {
    return await this.findAll({ batch });
  }

  /**
   * Find items by location
   * @param {string} location - Location/warehouse
   * @returns {Promise<Array>} Array of serialized items
   */
  async findByLocation(location) {
    return await this.findAll({ location });
  }

  /**
   * Get inventory with product details
   * @param {Object} filters - Optional filters (status, gtin, batch, location)
   * @returns {Promise<Array>} Inventory items with product details
   */
  async getInventory(filters = {}) {
    const conditions = ['si.mandt = $1'];
    const values = [this.mandt];
    let paramCount = 1;

    if (filters.status) {
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

    const query = `
      SELECT 
        si.sgtin,
        si.gtin,
        p.name AS product_name,
        p.brand,
        p.category,
        si.status,
        si.location,
        si.batch,
        si.manufacture_date,
        si.passport,
        si.created_at,
        si.updated_at
      FROM serialized_items si
      JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin
      WHERE ${conditions.join(' AND ')}
      ORDER BY si.created_at DESC
    `;

    const result = await this.customQuery(query, values);
    return result.rows;
  }

  /**
   * Create a new serialized item
   * @param {Object} itemData - Item data
   * @returns {Promise<Object>} Created item
   */
  async create(itemData) {
    const requiredFields = ['sgtin', 'gtin'];
    for (const field of requiredFields) {
      if (!itemData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Set default status if not provided
    if (!itemData.status) {
      itemData.status = 'CREATED';
    }

    // Check if SGTIN already exists
    const existing = await this.findBySgtin(itemData.sgtin);
    if (existing) {
      throw new Error(`Serialized item with SGTIN ${itemData.sgtin} already exists`);
    }

    return await this.insert(itemData);
  }

  /**
   * Update item status
   * @param {string} sgtin - SGTIN to update
   * @param {string} newStatus - New status
   * @param {string} location - Optional new location
   * @returns {Promise<Object>} Updated item
   */
  async updateStatus(sgtin, newStatus, location = null) {
    const updates = { status: newStatus };
    if (location) {
      updates.location = location;
    }

    const updated = await this.update({ sgtin }, updates);
    return updated.length > 0 ? updated[0] : null;
  }

  /**
   * Update item location
   * @param {string} sgtin - SGTIN to update
   * @param {string} location - New location
   * @returns {Promise<Object>} Updated item
   */
  async updateLocation(sgtin, location) {
    const updated = await this.update({ sgtin }, { location });
    return updated.length > 0 ? updated[0] : null;
  }

  /**
   * Get count by status
   * @returns {Promise<Object>} Status counts
   */
  async getStatusCounts() {
    const query = `
      SELECT status, COUNT(*) as count
      FROM ${this.tableName}
      WHERE mandt = $1
      GROUP BY status
    `;
    const result = await this.customQuery(query, [this.mandt]);
    
    const counts = {};
    result.rows.forEach(row => {
      counts[row.status] = parseInt(row.count);
    });
    
    return counts;
  }

  /**
   * Validate SGTIN format (GS1 standard: 01{GTIN}21{Serial})
   * @param {string} sgtin - SGTIN to validate
   * @returns {boolean} True if valid format
   */
  static isValidSgtinFormat(sgtin) {
    // SGTIN format: 01{14-digit GTIN}21{Serial Number}
    const sgtinRegex = /^01\d{14}21\d+$/;
    return sgtinRegex.test(sgtin);
  }

  /**
   * Extract GTIN from SGTIN
   * @param {string} sgtin - Full SGTIN
   * @returns {string} GTIN portion
   */
  static extractGtin(sgtin) {
    if (!SerializedItem.isValidSgtinFormat(sgtin)) {
      throw new Error('Invalid SGTIN format');
    }
    return sgtin.substring(2, 16); // Extract 14-digit GTIN
  }

  /**
   * Extract serial number from SGTIN
   * @param {string} sgtin - Full SGTIN
   * @returns {string} Serial number portion
   */
  static extractSerial(sgtin) {
    if (!SerializedItem.isValidSgtinFormat(sgtin)) {
      throw new Error('Invalid SGTIN format');
    }
    return sgtin.substring(18); // Extract serial after '21' prefix
  }

  /**
   * Soft delete an SGTIN (GS1/FDA compliant - never hard delete)
   * @param {string} sgtin - SGTIN to soft delete
   * @param {string} deletedBy - User who deleted (default: 'SYSTEM')
   * @returns {Promise<boolean>} True if deleted, false if already deleted
   */
  async softDelete(sgtin, deletedBy = 'SYSTEM') {
    const db = require('./db');
    const result = await db.query(
      'SELECT soft_delete_sgtin($1, $2, $3)',
      [this.mandt, sgtin, deletedBy]
    );
    return result.rows[0].soft_delete_sgtin;
  }

  /**
   * Restore a soft-deleted SGTIN
   * @param {string} sgtin - SGTIN to restore
   * @param {string} restoredBy - User who restored (default: 'SYSTEM')
   * @param {string} newStatus - Status to set after restore (default: 'IN_STOCK')
   * @returns {Promise<boolean>} True if restored, false if not found or not deleted
   */
  async restore(sgtin, restoredBy = 'SYSTEM', newStatus = 'IN_STOCK') {
    const db = require('./db');
    const result = await db.query(
      'SELECT restore_sgtin($1, $2, $3, $4)',
      [this.mandt, sgtin, restoredBy, newStatus]
    );
    return result.rows[0].restore_sgtin;
  }

  /**
   * Get archived (soft-deleted) items
   * @param {Object} filters - Optional filters (gtin, batch, location)
   * @returns {Promise<Array>} Array of archived items
   */
  async getArchivedItems(filters = {}) {
    const conditions = ['mandt = $1', 'deleted_at IS NOT NULL'];
    const values = [this.mandt];
    let paramCount = 1;

    if (filters.gtin) {
      paramCount++;
      conditions.push(`gtin = $${paramCount}`);
      values.push(filters.gtin);
    }

    if (filters.batch) {
      paramCount++;
      conditions.push(`batch = $${paramCount}`);
      values.push(filters.batch);
    }

    if (filters.location) {
      paramCount++;
      conditions.push(`location = $${paramCount}`);
      values.push(filters.location);
    }

    const query = `
      SELECT 
        sgtin,
        gtin,
        status,
        location,
        batch,
        manufacture_date,
        created_at,
        deleted_at,
        updated_by AS deleted_by
      FROM serialized_items
      WHERE ${conditions.join(' AND ')}
      ORDER BY deleted_at DESC
    `;

    const result = await this.customQuery(query, values);
    return result.rows;
  }
}

module.exports = SerializedItem;
