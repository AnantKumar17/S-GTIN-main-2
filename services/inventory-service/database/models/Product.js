// Product Model
// Represents master product data at GTIN level

const BaseModel = require('./BaseModel');

class Product extends BaseModel {
  constructor(mandt) {
    super('products', mandt);
  }

  /**
   * Find product by GTIN
   * @param {string} gtin - Global Trade Item Number
   * @returns {Promise<Object|null>} Product record
   */
  async findByGtin(gtin) {
    return await this.findOne({ gtin });
  }

  /**
   * Find products by brand
   * @param {string} brand - Brand name
   * @returns {Promise<Array>} Array of products
   */
  async findByBrand(brand) {
    return await this.findAll({ brand });
  }

  /**
   * Find products by category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Array of products
   */
  async findByCategory(category) {
    return await this.findAll({ category });
  }

  /**
   * Search products by name (case-insensitive)
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of products
   */
  async searchByName(searchTerm) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE mandt = $1 AND LOWER(name) LIKE LOWER($2)
      ORDER BY name
    `;
    const result = await this.customQuery(query, [this.mandt, `%${searchTerm}%`]);
    return result.rows;
  }

  /**
   * Get all brands
   * @returns {Promise<Array>} Array of unique brands
   */
  async getAllBrands() {
    const query = `
      SELECT DISTINCT brand FROM ${this.tableName}
      WHERE mandt = $1 AND brand IS NOT NULL
      ORDER BY brand
    `;
    const result = await this.customQuery(query, [this.mandt]);
    return result.rows.map(row => row.brand);
  }

  /**
   * Get all categories
   * @returns {Promise<Array>} Array of unique categories
   */
  async getAllCategories() {
    const query = `
      SELECT DISTINCT category FROM ${this.tableName}
      WHERE mandt = $1 AND category IS NOT NULL
      ORDER BY category
    `;
    const result = await this.customQuery(query, [this.mandt]);
    return result.rows.map(row => row.category);
  }

  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @returns {Promise<Object>} Created product
   */
  async create(productData) {
    const requiredFields = ['gtin', 'name'];
    for (const field of requiredFields) {
      if (!productData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Check if GTIN already exists
    const existing = await this.findByGtin(productData.gtin);
    if (existing) {
      throw new Error(`Product with GTIN ${productData.gtin} already exists`);
    }

    return await this.insert(productData);
  }

  /**
   * Update product by GTIN
   * @param {string} gtin - GTIN to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated product
   */
  async updateByGtin(gtin, updates) {
    const updated = await this.update({ gtin }, updates);
    return updated.length > 0 ? updated[0] : null;
  }
}

module.exports = Product;
