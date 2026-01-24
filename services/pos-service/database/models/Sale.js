// Sale Model
// Represents POS sales transactions

const BaseModel = require('./BaseModel');

class Sale extends BaseModel {
  constructor(mandt) {
    super('sales', mandt);
  }

  /**
   * Find sale by sale ID
   * @param {string} saleId - Sale transaction ID
   * @returns {Promise<Object|null>} Sale record
   */
  async findBySaleId(saleId) {
    return await this.findOne({ sale_id: saleId });
  }

  /**
   * Find sales by store
   * @param {string} storeId - Store identifier
   * @returns {Promise<Array>} Array of sales
   */
  async findByStore(storeId) {
    return await this.findAll({ store_id: storeId });
  }

  /**
   * Get sale details with items
   * @param {string} saleId - Sale transaction ID
   * @returns {Promise<Object|null>} Sale with items
   */
  async getSaleDetails(saleId) {
    const saleQuery = `
      SELECT * FROM sales
      WHERE mandt = $1 AND sale_id = $2
    `;

    const itemsQuery = `
      SELECT 
        si_item.sgtin,
        si_item.price,
        si.gtin,
        p.name AS product_name,
        p.brand,
        p.category
      FROM sale_items si_item
      JOIN serialized_items si ON si_item.mandt = si.mandt AND si_item.sgtin = si.sgtin
      JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin
      WHERE si_item.mandt = $1 AND si_item.sale_id = $2
    `;

    const saleResult = await this.customQuery(saleQuery, [this.mandt, saleId]);
    
    if (saleResult.rows.length === 0) {
      return null;
    }

    const itemsResult = await this.customQuery(itemsQuery, [this.mandt, saleId]);

    return {
      ...saleResult.rows[0],
      items: itemsResult.rows
    };
  }

  /**
   * Create a new sale with items
   * @param {Object} saleData - Sale data
   * @param {Array<Object>} items - Array of items {sgtin, price}
   * @returns {Promise<Object>} Created sale with items
   */
  async createSale(saleData, items) {
    const requiredFields = ['sale_id', 'store_id'];
    for (const field of requiredFields) {
      if (!saleData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!items || items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    const db = require('./db');
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Insert sale - explicitly map fields to schema columns
      const saleQuery = `
        INSERT INTO sales (mandt, sale_id, store_id, cashier_id, total_amount, sold_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const saleResult = await client.query(saleQuery, [
        this.mandt,
        saleData.sale_id,
        saleData.store_id,
        saleData.cashier_id || null,
        saleData.total_amount || 0
      ]);
      const sale = saleResult.rows[0];

      // Insert sale items
      const saleItems = [];
      for (const item of items) {
        const itemQuery = `
          INSERT INTO sale_items (mandt, sale_id, sgtin, price)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;

        const itemResult = await client.query(itemQuery, [
          this.mandt,
          saleData.sale_id,
          item.sgtin,
          item.price
        ]);

        saleItems.push(itemResult.rows[0]);

        // Update serialized item status to SOLD
        const updateQuery = `
          UPDATE serialized_items
          SET status = 'SOLD', location = $1, updated_at = CURRENT_TIMESTAMP
          WHERE mandt = $2 AND sgtin = $3
        `;

        await client.query(updateQuery, [saleData.store_id, this.mandt, item.sgtin]);
      }

      await client.query('COMMIT');

      return {
        ...sale,
        items: saleItems
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all sales with limit
   * @param {number} limit - Maximum number of sales to return
   * @returns {Promise<Array>} Array of recent sales
   */
  async getAllSales(limit = 50) {
    const query = `
      SELECT s.*, COUNT(si.sgtin) as item_count
      FROM sales s
      LEFT JOIN sale_items si ON s.mandt = si.mandt AND s.sale_id = si.sale_id
      WHERE s.mandt = $1
      GROUP BY s.mandt, s.sale_id, s.store_id, s.cashier_id, s.total_amount, s.sold_at
      ORDER BY s.sold_at DESC
      LIMIT $2
    `;

    const result = await this.customQuery(query, [this.mandt, limit]);
    return result.rows;
  }

  /**
   * Get sales by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of sales
   */
  async getSalesByDateRange(startDate, endDate) {
    const query = `
      SELECT * FROM sales
      WHERE mandt = $1 AND sold_at BETWEEN $2 AND $3
      ORDER BY sold_at DESC
    `;

    const result = await this.customQuery(query, [this.mandt, startDate, endDate]);
    return result.rows;
  }

  /**
   * Get sales summary by store
   * @param {string} storeId - Store identifier
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @returns {Promise<Object>} Sales summary
   */
  async getSalesSummary(storeId, startDate = null, endDate = null) {
    const conditions = ['mandt = $1', 'store_id = $2'];
    const values = [this.mandt, storeId];

    if (startDate && endDate) {
      conditions.push('sold_at BETWEEN $3 AND $4');
      values.push(startDate, endDate);
    }

    const query = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_sale_amount,
        MIN(sold_at) as first_sale,
        MAX(sold_at) as last_sale
      FROM sales
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.customQuery(query, values);
    return result.rows[0];
  }

  /**
   * Generate next sale ID
   * @returns {Promise<string>} Next sale ID
   */
  async generateSaleId() {
    const query = `
      SELECT sale_id FROM sales
      WHERE mandt = $1
      ORDER BY sold_at DESC
      LIMIT 1
    `;

    const result = await this.customQuery(query, [this.mandt]);
    
    if (result.rows.length === 0) {
      const year = new Date().getFullYear();
      return `SALE-${year}-0001`;
    }

    const lastSaleId = result.rows[0].sale_id;
    const match = lastSaleId.match(/SALE-(\d{4})-(\d+)/);
    
    if (match) {
      const year = new Date().getFullYear();
      const lastYear = parseInt(match[1]);
      
      if (year === lastYear) {
        const nextNumber = parseInt(match[2]) + 1;
        return `SALE-${year}-${nextNumber.toString().padStart(4, '0')}`;
      } else {
        return `SALE-${year}-0001`;
      }
    }

    const year = new Date().getFullYear();
    return `SALE-${year}-0001`;
  }
}

module.exports = Sale;
