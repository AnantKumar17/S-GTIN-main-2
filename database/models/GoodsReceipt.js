const path = require('path');
const BaseModel = require(path.join(__dirname, 'BaseModel'));

class GoodsReceipt extends BaseModel {
    constructor(mandt) {
        super(mandt, 'goods_receipts');
    }

    /**
     * Create a new goods receipt
     * @param {Object} data - Goods receipt data
     * @returns {Promise<Object>} Created goods receipt
     */
    async create(data) {
        const { gr_id, po_id, warehouse, received_quantity, received_by } = data;

        const query = `
            INSERT INTO goods_receipts
            (mandt, gr_id, po_id, warehouse, received_quantity, received_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const values = [this.mandt, gr_id, po_id, warehouse, received_quantity, received_by || null];

        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Find goods receipt by ID
     * @param {string} grId - Goods receipt ID
     * @returns {Promise<Object|null>} Goods receipt or null if not found
     */
    async findById(grId) {
        const query = `
            SELECT * FROM goods_receipts
            WHERE mandt = $1 AND gr_id = $2
        `;
        const result = await this.query(query, [this.mandt, grId]);
        return result.rows[0] || null;
    }

    /**
     * Find goods receipts by PO ID
     * @param {string} poId - Purchase order ID
     * @returns {Promise<Array>} Array of goods receipts
     */
    async findByPoId(poId) {
        const query = `
            SELECT * FROM goods_receipts
            WHERE mandt = $1 AND po_id = $2
            ORDER BY received_at DESC
        `;
        const result = await this.query(query, [this.mandt, poId]);
        return result.rows;
    }

    /**
     * Get all goods receipts with pagination
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of goods receipts
     */
    async findAll(options = {}) {
        const { limit = 50, offset = 0, poId, warehouse } = options;

        let query = `
            SELECT * FROM goods_receipts
            WHERE mandt = $1
        `;

        const values = [this.mandt];
        let paramCount = 1;

        if (poId) {
            paramCount++;
            query += ` AND po_id = $${paramCount}`;
            values.push(poId);
        }

        if (warehouse) {
            paramCount++;
            query += ` AND warehouse = $${paramCount}`;
            values.push(warehouse);
        }

        query += ` ORDER BY received_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        values.push(limit, offset);

        const result = await this.query(query, values);
        return result.rows;
    }

    /**
     * Get SGTINs for a specific goods receipt
     * @param {string} grId - Goods receipt ID
     * @returns {Promise<Array>} Array of SGTINs
     */
    async getSgtins(grId) {
        const query = `
            SELECT s.sgtin, s.gtin, s.status, s.location
            FROM gr_sgtin_mapping gsm
            JOIN serialized_items s ON gsm.mandt = s.mandt AND gsm.sgtin = s.sgtin
            WHERE gsm.mandt = $1 AND gsm.gr_id = $2
        `;
        const result = await this.query(query, [this.mandt, grId]);
        return result.rows;
    }

    /**
     * Add SGTIN mapping to goods receipt
     * @param {string} grId - Goods receipt ID
     * @param {string} sgtin - SGTIN to add
     * @returns {Promise<Object>} Created mapping
     */
    async addSgtinMapping(grId, sgtin) {
        const query = `
            INSERT INTO gr_sgtin_mapping
            (mandt, gr_id, sgtin)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await this.query(query, [this.mandt, grId, sgtin]);
        return result.rows[0];
    }

    /**
     * Generate a unique goods receipt ID
     * @param {string} poId - Purchase order ID
     * @returns {Promise<string>} Generated GR ID
     */
    async generateGrId(poId) {
        // Format: GR-YYYYMMDD-POID-SEQUENCE
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const sequenceQuery = `
            SELECT COALESCE(MAX(CAST(SUBSTRING(gr_id FROM 'GR-\\d{8}-${poId}-(\\d+)') FROM '\\d+') AS INTEGER), 0) + 1 as next_seq
            FROM goods_receipts
            WHERE mandt = $1 AND gr_id LIKE 'GR-${dateStr}-${poId}-%'
        `;

        const result = await this.query(sequenceQuery, [this.mandt]);
        const sequence = result.rows[0].next_seq || 1;
        return `GR-${dateStr}-${poId}-${sequence.toString().padStart(3, '0')}`;
    }
}

module.exports = GoodsReceipt;