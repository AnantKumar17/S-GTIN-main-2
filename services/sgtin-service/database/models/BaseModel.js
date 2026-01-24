// Base Model Class with MANDT Multi-Tenancy Support
// All models extend this base class

const db = require('./db');

class BaseModel {
  /**
   * Constructor
   * @param {string} tableName - Name of the database table
   * @param {string} mandt - Multi-tenant client identifier (SAP standard)
   */
  constructor(tableName, mandt = process.env.MANDT || '100') {
    this.tableName = tableName;
    this.mandt = mandt;
  }

  /**
   * Find all records with optional filters
   * @param {Object} filters - Key-value pairs for WHERE clause
   * @param {Object} options - Additional options (limit, offset, orderBy)
   * @returns {Promise<Array>} Array of records
   */
  async findAll(filters = {}, options = {}) {
    const { limit, offset, orderBy } = options;
    
    // Build WHERE clause
    const conditions = ['mandt = $1'];
    const values = [this.mandt];
    let paramCount = 1;

    Object.entries(filters).forEach(([key, value]) => {
      paramCount++;
      conditions.push(`${key} = $${paramCount}`);
      values.push(value);
    });

    let query = `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`;
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    if (offset) {
      query += ` OFFSET ${parseInt(offset)}`;
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Find a single record by primary key
   * @param {Object} primaryKey - Primary key field(s)
   * @returns {Promise<Object|null>} Single record or null
   */
  async findOne(primaryKey) {
    const conditions = ['mandt = $1'];
    const values = [this.mandt];
    let paramCount = 1;

    Object.entries(primaryKey).forEach(([key, value]) => {
      paramCount++;
      conditions.push(`${key} = $${paramCount}`);
      values.push(value);
    });

    const query = `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;
    const result = await db.query(query, values);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Insert a new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Inserted record
   */
  async insert(data) {
    // Add mandt to data
    const recordData = { mandt: this.mandt, ...data };
    
    const keys = Object.keys(recordData);
    const values = Object.values(recordData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Insert multiple records
   * @param {Array<Object>} records - Array of records to insert
   * @returns {Promise<Array>} Inserted records
   */
  async insertMany(records) {
    if (records.length === 0) return [];

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const insertedRecords = [];
      for (const record of records) {
        const recordData = { mandt: this.mandt, ...record };
        const keys = Object.keys(recordData);
        const values = Object.values(recordData);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
          INSERT INTO ${this.tableName} (${keys.join(', ')})
          VALUES (${placeholders})
          RETURNING *
        `;
        
        const result = await client.query(query, values);
        insertedRecords.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return insertedRecords;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update records matching filters
   * @param {Object} filters - WHERE clause conditions
   * @param {Object} data - Data to update
   * @returns {Promise<Array>} Updated records
   */
  async update(filters, data) {
    const setKeys = Object.keys(data);
    const setValues = Object.values(data);
    
    const setClause = setKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    const conditions = [`mandt = $${setKeys.length + 1}`];
    const values = [...setValues, this.mandt];
    let paramCount = setKeys.length + 1;

    Object.entries(filters).forEach(([key, value]) => {
      paramCount++;
      conditions.push(`${key} = $${paramCount}`);
      values.push(value);
    });

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${conditions.join(' AND ')}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Delete records matching filters
   * @param {Object} filters - WHERE clause conditions
   * @returns {Promise<number>} Number of deleted records
   */
  async delete(filters) {
    const conditions = ['mandt = $1'];
    const values = [this.mandt];
    let paramCount = 1;

    Object.entries(filters).forEach(([key, value]) => {
      paramCount++;
      conditions.push(`${key} = $${paramCount}`);
      values.push(value);
    });

    const query = `DELETE FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`;
    const result = await db.query(query, values);
    
    return result.rowCount;
  }

  /**
   * Count records matching filters
   * @param {Object} filters - WHERE clause conditions
   * @returns {Promise<number>} Count of records
   */
  async count(filters = {}) {
    const conditions = ['mandt = $1'];
    const values = [this.mandt];
    let paramCount = 1;

    Object.entries(filters).forEach(([key, value]) => {
      paramCount++;
      conditions.push(`${key} = $${paramCount}`);
      values.push(value);
    });

    const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`;
    const result = await db.query(query, values);
    
    return parseInt(result.rows[0].count);
  }

  /**
   * Execute a custom query
   * @param {string} queryText - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise} Query result
   */
  async customQuery(queryText, params = []) {
    return await db.query(queryText, params);
  }
}

module.exports = BaseModel;
