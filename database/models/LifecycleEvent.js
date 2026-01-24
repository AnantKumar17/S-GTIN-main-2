// LifecycleEvent Model
// Represents lifecycle events for complete SGTIN traceability

const BaseModel = require('./BaseModel');

class LifecycleEvent extends BaseModel {
  constructor(mandt) {
    super('lifecycle_events', mandt);
  }

  /**
   * Create a new lifecycle event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async createEvent(eventData) {
    const requiredFields = ['sgtin', 'event_type'];
    for (const field of requiredFields) {
      if (!eventData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate event type
    const validTypes = ['CREATED', 'RECEIVED', 'SOLD', 'RETURNED', 'DAMAGED', 'RECALLED'];
    if (!validTypes.includes(eventData.event_type)) {
      throw new Error(`Invalid event type. Must be one of: ${validTypes.join(', ')}`);
    }

    return await this.insert(eventData);
  }

  /**
   * Get complete lifecycle trace for an SGTIN
   * @param {string} sgtin - Serialized GTIN
   * @returns {Promise<Array>} Array of lifecycle events
   */
  async getTrace(sgtin) {
    const query = `
      SELECT 
        event_id,
        event_type,
        location,
        metadata,
        created_at
      FROM ${this.tableName}
      WHERE mandt = $1 AND sgtin = $2
      ORDER BY created_at ASC
    `;

    const result = await this.customQuery(query, [this.mandt, sgtin]);
    return result.rows;
  }

  /**
   * Get events by type
   * @param {string} eventType - Event type
   * @param {Date} startDate - Optional start date
   * @param {Date} endDate - Optional end date
   * @returns {Promise<Array>} Array of events
   */
  async getEventsByType(eventType, startDate = null, endDate = null) {
    const conditions = ['mandt = $1', 'event_type = $2'];
    const values = [this.mandt, eventType];

    if (startDate && endDate) {
      conditions.push('created_at BETWEEN $3 AND $4');
      values.push(startDate, endDate);
    }

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `;

    const result = await this.customQuery(query, values);
    return result.rows;
  }

  /**
   * Get recent events
   * @param {number} limit - Maximum number of events to return
   * @returns {Promise<Array>} Array of recent events
   */
  async getRecentEvents(limit = 100) {
    const query = `
      SELECT 
        le.*,
        si.gtin,
        p.name AS product_name,
        p.brand
      FROM lifecycle_events le
      JOIN serialized_items si ON le.mandt = si.mandt AND le.sgtin = si.sgtin
      JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin
      WHERE le.mandt = $1
      ORDER BY le.created_at DESC
      LIMIT $2
    `;

    const result = await this.customQuery(query, [this.mandt, limit]);
    return result.rows;
  }

  /**
   * Get event statistics
   * @param {Date} startDate - Optional start date
   * @param {Date} endDate - Optional end date
   * @returns {Promise<Object>} Event statistics
   */
  async getEventStatistics(startDate = null, endDate = null) {
    const conditions = ['mandt = $1'];
    const values = [this.mandt];

    if (startDate && endDate) {
      conditions.push('created_at BETWEEN $2 AND $3');
      values.push(startDate, endDate);
    }

    const query = `
      SELECT 
        event_type,
        COUNT(*) as count
      FROM ${this.tableName}
      WHERE ${conditions.join(' AND ')}
      GROUP BY event_type
      ORDER BY count DESC
    `;

    const result = await this.customQuery(query, values);
    
    const stats = {};
    result.rows.forEach(row => {
      stats[row.event_type] = parseInt(row.count);
    });
    
    return stats;
  }
}

module.exports = LifecycleEvent;
