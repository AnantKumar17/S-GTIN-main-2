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
   * @returns {Promise<Object|null>} Serialized item record
   */
  async findBySgtin(sgtin) {
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
}

module.exports = SerializedItem;
