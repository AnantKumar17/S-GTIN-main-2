const path = require('path');
const { query } = require(path.join(__dirname, '../../database/models/db'));

class SGTINLookupController {
  // Get all GTINs with product names for dropdown
  async getGtins(req, res) {
    try {
      const { mandt = '100' } = req.query;

      const result = await query(
        `SELECT DISTINCT 
          p.gtin,
          p.name,
          p.brand,
          p.category,
          COUNT(DISTINCT si.sgtin) as sgtin_count
        FROM products p
        LEFT JOIN serialized_items si ON p.gtin = si.gtin AND p.mandt = si.mandt
        WHERE p.mandt = $1
        GROUP BY p.gtin, p.name, p.brand, p.category
        ORDER BY p.name`,
        [mandt]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getGtins:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GTINs'
      });
    }
  }

  // Get purchase orders for selected GTIN
  async getPurchaseOrdersByGtin(req, res) {
    try {
      const { gtin } = req.params;
      const { mandt = '100' } = req.query;

      if (!gtin) {
        return res.status(400).json({
          success: false,
          message: 'GTIN is required'
        });
      }

      const result = await query(
        `SELECT 
          po.po_id,
          po.gtin,
          po.quantity,
          po.received_quantity,
          po.status,
          po.supplier,
          po.warehouse,
          po.expected_delivery_date,
          po.created_at,
          COUNT(DISTINCT psm.sgtin) as sgtin_count
        FROM purchase_orders po
        LEFT JOIN po_sgtin_mapping psm ON po.po_id = psm.po_id AND po.mandt = psm.mandt
        WHERE po.gtin = $1 AND po.mandt = $2
        GROUP BY po.po_id, po.gtin, po.quantity, po.received_quantity, po.status, 
                 po.supplier, po.warehouse, po.expected_delivery_date, po.created_at
        ORDER BY po.created_at DESC`,
        [gtin, mandt]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getPurchaseOrdersByGtin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch purchase orders'
      });
    }
  }

  // Get SGTINs for selected purchase order
  async getSgtinsByPurchaseOrder(req, res) {
    try {
      const { poId } = req.params;
      const { mandt = '100' } = req.query;

      if (!poId) {
        return res.status(400).json({
          success: false,
          message: 'Purchase Order ID is required'
        });
      }

      const result = await query(
        `SELECT 
          si.sgtin,
          si.gtin,
          si.status,
          CASE 
            WHEN si.location IS NOT NULL AND si.location != '' AND si.location != 'N/A' THEN si.location
            WHEN si.status = 'CREATED' AND po.warehouse IS NOT NULL THEN CONCAT('Awaiting delivery to ', po.warehouse)
            WHEN si.status = 'CREATED' THEN 'Pending goods receipt'
            WHEN po.warehouse IS NOT NULL THEN CONCAT('Expected at ', po.warehouse)
            ELSE 'Location pending'
          END as location,
          si.batch,
          si.manufacture_date,
          si.created_at,
          p.name as product_name
        FROM po_sgtin_mapping psm
        JOIN serialized_items si ON psm.sgtin = si.sgtin AND psm.mandt = si.mandt
        LEFT JOIN products p ON si.gtin = p.gtin AND si.mandt = p.mandt
        LEFT JOIN purchase_orders po ON psm.po_id = po.po_id AND psm.mandt = po.mandt
        WHERE psm.po_id = $1 AND psm.mandt = $2
        ORDER BY si.sgtin`,
        [poId, mandt]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error in getSgtinsByPurchaseOrder:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SGTINs'
      });
    }
  }

  // Get complete SGTIN passport with all lifecycle data
  async getPassport(req, res) {
    try {
      const { sgtin } = req.params;
      const { mandt = '100' } = req.query;

      if (!sgtin) {
        return res.status(400).json({
          success: false,
          message: 'SGTIN is required'
        });
      }

      // Main passport data with proper JOINs
      const passportResult = await query(
        `SELECT 
          -- Product info
          p.gtin, 
          p.name as product_name, 
          p.brand, 
          p.category, 
          p.subcategory, 
          p.price as product_price,
          p.description,
          
          -- Serialized item info
          si.sgtin, 
          si.status, 
          CASE 
            WHEN si.location IS NOT NULL AND si.location != '' AND si.location != 'N/A' THEN si.location
            WHEN si.status = 'CREATED' AND po.warehouse IS NOT NULL THEN CONCAT('Awaiting delivery to ', po.warehouse)
            WHEN si.status = 'CREATED' THEN 'Pending goods receipt'
            WHEN po.warehouse IS NOT NULL THEN CONCAT('Expected at ', po.warehouse)
            ELSE 'Location pending'
          END as location,
          si.batch, 
          si.manufacture_date, 
          si.barcode, 
          si.qr_code,
          si.created_at as sgtin_created_at,
          si.updated_at as sgtin_updated_at,
          
          -- Purchase Order info
          po.po_id, 
          po.supplier, 
          po.warehouse, 
          po.quantity as po_quantity,
          po.received_quantity as po_received_quantity,
          po.expected_delivery_date, 
          po.created_at as po_created_at,
          po.status as po_status,
          
          -- Goods Receipt info
          gr.gr_id, 
          gr.received_at as gr_received_at, 
          gr.received_by,
          gr.warehouse as gr_warehouse,
          
          -- Sales info (if sold)
          s.sale_id, 
          s.store_id, 
          s.sold_at,
          s.cashier_id,
          s.total_amount as sale_total_amount,
          si_sale.price as actual_selling_price,
          
          -- Calculated fields (only if actual data exists)
          CASE 
            WHEN si_sale.price IS NOT NULL AND p.price IS NOT NULL
            THEN (si_sale.price - p.price)::numeric(10,2)
            ELSE NULL 
          END as profit,
          
          CASE 
            WHEN si_sale.price IS NOT NULL AND p.price IS NOT NULL AND p.price > 0
            THEN (((si_sale.price - p.price) / p.price) * 100)::numeric(10,2)
            ELSE NULL 
          END as profit_margin

        FROM serialized_items si
        LEFT JOIN products p ON si.gtin = p.gtin AND si.mandt = p.mandt
        LEFT JOIN po_sgtin_mapping psm ON si.sgtin = psm.sgtin AND si.mandt = psm.mandt
        LEFT JOIN purchase_orders po ON psm.po_id = po.po_id AND psm.mandt = po.mandt
        LEFT JOIN gr_sgtin_mapping gsm ON si.sgtin = gsm.sgtin AND si.mandt = gsm.mandt
        LEFT JOIN goods_receipts gr ON gsm.gr_id = gr.gr_id AND gsm.mandt = gr.mandt
        LEFT JOIN sale_items si_sale ON si.sgtin = si_sale.sgtin AND si.mandt = si_sale.mandt
        LEFT JOIN sales s ON si_sale.sale_id = s.sale_id AND si_sale.mandt = s.mandt

        WHERE si.sgtin = $1 AND si.mandt = $2
        LIMIT 1`,
        [sgtin, mandt]
      );

      if (passportResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'SGTIN not found'
        });
      }

      // Get lifecycle events with meaningful location context
      const lifecycleResult = await query(
        `SELECT 
          le.event_id,
          le.event_type,
          CASE 
            WHEN le.location IS NOT NULL AND le.location != '' AND le.location != 'N/A' THEN le.location
            WHEN le.event_type = 'CREATED' THEN 'SGTIN Service'
            WHEN le.event_type = 'RECEIVED' AND po.warehouse IS NOT NULL THEN po.warehouse
            WHEN le.event_type = 'SOLD' AND s.store_id IS NOT NULL THEN s.store_id
            WHEN po.warehouse IS NOT NULL THEN po.warehouse
            ELSE 'System'
          END as location,
          le.metadata,
          le.created_at
        FROM lifecycle_events le
        LEFT JOIN po_sgtin_mapping psm ON le.sgtin = psm.sgtin AND le.mandt = psm.mandt
        LEFT JOIN purchase_orders po ON psm.po_id = po.po_id AND psm.mandt = po.mandt
        LEFT JOIN sale_items si_sale ON le.sgtin = si_sale.sgtin AND le.mandt = si_sale.mandt
        LEFT JOIN sales s ON si_sale.sale_id = s.sale_id AND si_sale.mandt = s.mandt
        WHERE le.sgtin = $1 AND le.mandt = $2
        ORDER BY le.created_at ASC`,
        [sgtin, mandt]
      );

      // Combine data
      const passportData = {
        ...passportResult.rows[0],
        lifecycle_events: lifecycleResult.rows
      };

      res.json({
        success: true,
        data: passportData
      });
    } catch (error) {
      console.error('Error in getPassport:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SGTIN passport'
      });
    }
  }

  // Legacy endpoint - kept for backward compatibility
  async lookupSGTIN(req, res) {
    try {
      const { sgtin } = req.params;
      const { mandt = '100' } = req.query;

      if (!sgtin) {
        return res.status(400).json({
          success: false,
          message: 'SGTIN is required'
        });
      }

      const result = await query(
        `SELECT 
          si.sgtin,
          si.gtin,
          si.status,
          si.location,
          si.batch,
          si.manufacture_date,
          si.created_at,
          si.updated_at,
          si.barcode,
          si.qr_code,
          p.name as product_name,
          p.brand,
          p.description,
          p.category,
          p.price
        FROM serialized_items si
        LEFT JOIN products p ON si.gtin = p.gtin AND si.mandt = p.mandt
        WHERE si.sgtin = $1 AND si.mandt = $2
        LIMIT 1`,
        [sgtin, mandt]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'SGTIN not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error in lookupSGTIN:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = new SGTINLookupController();