/**
 * DBExecutor
 * Executes parameterized SQL plans safely against PostgreSQL and returns
 * normalized result objects suitable for chatbot responses.
 *
 * Usage:
 *   const { executePlans } = require('./dbExecutor');
 *   const results = await executePlans(pool, plans);
 *
 * Input:
 *   plans: [
 *     { sql, params, type, limit }
 *   ]
 *
 * Output:
 *   [
 *     { type: 'INVENTORY' | 'PURCHASE_ORDER' | 'PURCHASE_ORDER_LIST' | 'PO_SGTINS' | 'SGTIN_TRACE' | 'COUNTERFEIT_LOGS' | 'SALES', data: rows }
 *     or
 *     { type: 'ERROR', error: 'message' }
 *   ]
 */

async function executePlans(pool, plans = []) {
  const outputs = [];

  for (const p of plans) {
    try {
      const res = await pool.query(p.sql, p.params || []);
      outputs.push({
        type: p.type,
        data: res.rows || []
      });
    } catch (err) {
      outputs.push({
        type: 'ERROR',
        error: err.message || 'Database execution failed'
      });
    }
  }

  return outputs;
}

/**
 * Summarize results into a simple human-readable string without LLM.
 * Keeps schema-aware naming and avoids leaking internal details.
 */
function summarize(plannedIntent, outputs) {
  if (!outputs || outputs.length === 0) {
    return 'No data found for this query.';
  }

  // If any error present, surface concise issues
  const errors = outputs.filter(o => o.type === 'ERROR');
  if (errors.length > 0) {
    const msg = errors.map(e => e.error).join('; ');
    return `Encountered issues fetching data: ${msg}`;
  }

  switch (plannedIntent) {
    case 'INVENTORY_COUNT': {
      const inv = outputs.find(o => o.type === 'INVENTORY');
      if (!inv || !inv.data || inv.data.length === 0) return 'No inventory summary available.';
      const row = inv.data[0];
      return [
        'Inventory summary:',
        `- Total items: ${row.total}`,
        `- In stock: ${row.in_stock}`,
        `- Sold: ${row.sold}`,
        `- Created: ${row.created}`,
        `- Returned: ${row.returned}`,
        `- Damaged: ${row.damaged}`
      ].join('\n');
    }

    case 'INVENTORY_STATUS':
    case 'INVENTORY_LOCATION': {
      const inv = outputs.find(o => o.type === 'INVENTORY');
      const count = inv && inv.data ? inv.data.length : 0;
      return count > 0
        ? `Found ${count} inventory items matching your criteria. Showing up to ${Math.min(count, 50)}.`
        : 'No inventory items matched the criteria.';
    }

    case 'MISSING_SGTINS': {
      const miss = outputs.find(o => o.type === 'MISSING_SGTINS');
      const count = miss && miss.data ? miss.data.length : 0;
      return count > 0
        ? `Found ${count} products without any serialized items (SGTINs).`
        : 'All products appear to have serialized items.';
    }

    case 'PO_STATUS': {
      const po = outputs.find(o => o.type === 'PURCHASE_ORDER');
      if (po && po.data && po.data.length > 0) {
        const row = po.data[0];
        return [
          `Purchase Order ${row.po_id}:`,
          `- Product: ${row.product_name || row.gtin}`,
          `- Status: ${row.status}`,
          `- Quantity: ${row.received_quantity || 0}/${row.quantity}`,
          `- Supplier: ${row.supplier || 'N/A'}`,
          `- Warehouse: ${row.warehouse || 'N/A'}`
        ].join('\n');
      }
      const list = outputs.find(o => o.type === 'PURCHASE_ORDER_LIST');
      if (list && list.data) {
        const rows = list.data;
        const count = rows.length;
        const top = rows.slice(0, Math.min(count, 10));
        const lines = top.map(r => {
          const nameOrGtin = r.product_name || r.gtin || 'N/A';
          return `- PO ${r.po_id}: ${nameOrGtin} (${r.status}, ${r.received_quantity || 0}/${r.quantity})`;
        });
        return [
          `Found ${count} purchase orders. Showing up to ${Math.min(count, 50)}.`,
          'Sample PO IDs:',
          ...lines
        ].join('\n');
      }
      return 'No purchase order data found.';
    }

    case 'PO_LIST': {
      const list = outputs.find(o => o.type === 'PURCHASE_ORDER_LIST');
      const rows = list && list.data ? list.data : [];
      const count = rows.length;
      if (count === 0) return 'No purchase orders found.';
      const top = rows.slice(0, Math.min(count, 10));
      const lines = top.map(r => {
        const nameOrGtin = r.product_name || r.gtin || 'N/A';
        return `- PO ${r.po_id}: ${nameOrGtin} (${r.status}, ${r.received_quantity || 0}/${r.quantity})`;
      });
      return [
        `Found ${count} purchase orders. Showing up to ${Math.min(count, 50)}.`,
        'Sample PO IDs:',
        ...lines
      ].join('\n');
    }

    case 'PO_SGTINS': {
      const m = outputs.find(o => o.type === 'PO_SGTINS');
      const count = m && m.data ? m.data.length : 0;
      return count > 0
        ? `Found ${count} SGTIN items mapped to the purchase order.`
        : 'No SGTINs mapped to the specified purchase order.';
    }

    case 'SGTIN_TRACE': {
      const tr = outputs.find(o => o.type === 'SGTIN_TRACE');
      const count = tr && tr.data ? tr.data.length : 0;
      return count > 0
        ? `Lifecycle trace contains ${count} events for the specified SGTIN.`
        : 'No lifecycle events found for the specified SGTIN.';
    }

    case 'COUNTERFEIT': {
      const cf = outputs.find(o => o.type === 'COUNTERFEIT_LOGS');
      const count = cf && cf.data ? cf.data.length : 0;
      return count > 0
        ? `Found ${count} counterfeit detection logs. Showing up to ${Math.min(count, 50)}.`
        : 'No counterfeit detection logs found.';
    }

    case 'SALES_DETAILS': {
      const s = outputs.find(o => o.type === 'SALES');
      const count = s && s.data ? s.data.length : 0;
      return count > 0
        ? `Found ${count} sales line items. Showing up to ${Math.min(count, 50)}.`
        : 'No sales records matched the criteria.';
    }

    default: {
      // Generic summary across known types
      const frags = [];
      const add = (t, arr) => {
        if (arr && arr.length > 0) frags.push(`- ${t}: ${arr.length}`);
      };
      outputs.forEach(o => {
        if (o.data) {
          add(o.type, o.data);
        }
      });
      return frags.length > 0 ? `Summary:\n${frags.join('\n')}` : 'No data found.';
    }
  }
}

module.exports = {
  executePlans,
  summarize
};