/**
 * QueryPlanner
 * Schema-aware, safe prompt-to-DB query planner using parameterized SQL aligned to local schema/views.
 *
 * Output format:
 * {
 *   intent: 'INVENTORY_COUNT' | 'INVENTORY_STATUS' | 'INVENTORY_LOCATION' | 'MISSING_SGTINS' | 'PO_LIST' | 'PO_STATUS' | 'PO_SGTINS' | 'SGTIN_TRACE' | 'COUNTERFEIT' | 'SALES_DETAILS' | 'PASSPORT_QUERY' | 'GENERAL',
 *   entities: { poIds: [], gtins: [], sgtins: [], locations: [], statuses: [] },
 *   plans: [
 *     { sql: 'SELECT ... WHERE mandt = $1 ...', params: [mandt, ...], type: 'INVENTORY' | 'PURCHASE_ORDER' | 'PURCHASE_ORDER_LIST' | 'PO_SGTINS' | 'SGTIN_TRACE' | 'COUNTERFEIT_LOGS' | 'SALES', limit: 50 }
 *   ]
 * }
 */

const ALLOWED_ITEM_STATUSES = ['CREATED', 'IN_STOCK', 'SOLD', 'RETURNED', 'DAMAGED'];
const ALLOWED_PO_STATUSES = ['OPEN', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED'];

function extractEntities(question) {
  const q = question || '';
  const entities = {
    poIds: [],
    gtins: [],
    sgtins: [],
    locations: [],
    statuses: []
  };

  // PO ID patterns: 8-digit numeric (e.g., 45000023) or textual PO_001 / PO-001 / PO 001
  const poNumeric = /\b(\d{8})\b/g;
  let m;
  while ((m = poNumeric.exec(q)) !== null) {
    // Avoid accidentally capturing GTINs/SGTIN numeric spans by ensuring isolated 8 digits
    entities.poIds.push(m[1]);
  }
  const poText = /\bPO[_\-\s]?([A-Za-z0-9]+)\b/gi;
  while ((m = poText.exec(q)) !== null) {
    entities.poIds.push(`PO_${m[1].toUpperCase()}`);
  }

  // GTIN: 14 digits
  const gtinPattern = /\b(\d{14})\b/g;
  while ((m = gtinPattern.exec(q)) !== null) {
    entities.gtins.push(m[1]);
  }

  // SGTIN: GS1 AI format like 01 + 14 digits + 21 + up to 20 serial (we&#39;ll accept 6-20)
  const sgtinPattern = /\b01\d{14}21[0-9A-Za-z]{6,20}\b/g;
  while ((m = sgtinPattern.exec(q)) !== null) {
    entities.sgtins.push(m[0]);
  }

  // Locations: simple heuristic - words following keywords or common city/warehouse terms
  const locationKeywords = ['warehouse', 'store', 'location', 'bangalore', 'mumbai', 'delhi', 'chennai'];
  locationKeywords.forEach((kw) => {
    const rx = new RegExp(`\\b(${kw}[\\w\\s\\-]*)(?=\\b|\\s|\\.|,|$)`, 'gi');
    let lm;
    while ((lm = rx.exec(q)) !== null) {
      const loc = (lm[1] || '').trim();
      if (loc && !entities.locations.includes(loc)) {
        entities.locations.push(loc);
      }
    }
  });

  // Statuses: map common phrases to schema enums
  const statusMap = [
    { keys: ['created', 'new'], value: 'CREATED' },
    { keys: ['in stock', 'instock', 'stock'], value: 'IN_STOCK' },
    { keys: ['sold', 'sold state', 'in sold state'], value: 'SOLD' },
    { keys: ['returned', 'return'], value: 'RETURNED' },
    { keys: ['damaged', 'broken'], value: 'DAMAGED' },
    { keys: ['open'], value: 'OPEN' },
    { keys: ['partially received', 'partial'], value: 'PARTIALLY_RECEIVED' },
    { keys: ['fully received', 'fully'], value: 'FULLY_RECEIVED' },
    { keys: ['cancelled', 'canceled'], value: 'CANCELLED' }
  ];
  const qLower = q.toLowerCase();
  statusMap.forEach((entry) => {
    if (entry.keys.some((k) => qLower.includes(k))) {
      if (!entities.statuses.includes(entry.value)) {
        entities.statuses.push(entry.value);
      }
    }
  });

  return entities;
}

function determineIntent(question, entities) {
  const q = (question || '').toLowerCase();

  // Follow-up/affirmation intents (reuse prior context)
  const followUps = ['yes', 'yes please', 'yeah', 'yup', 'ok', 'okay', 'continue'];
  if (followUps.some(f => q === f || q === `${f}.` || q === `${f}!`)) {
    return 'FOLLOW_UP';
  }

  // Passport queries
  if (q.includes('passport')) {
    return 'PASSPORT_QUERY';
  }

  // SGTIN trace/validate
  if (entities.sgtins.length > 0 && (q.includes('trace') || q.includes('lifecycle') || q.includes('history'))) {
    return 'SGTIN_TRACE';
  }

  // Missing SGTINs
  if (q.includes('missing sgtin') || q.includes('without sgtin') || q.includes('no sgtin')) {
    return 'MISSING_SGTINS';
  }

  // Inventory
  if (q.includes('inventory') || q.includes('stock') || q.includes('items')) {
    if (q.includes('how many') || q.includes('count') || q.includes('number of')) {
      return 'INVENTORY_COUNT';
    }
    if (q.includes('where') || q.includes('which warehouse') || q.includes('location')) {
      return 'INVENTORY_LOCATION';
    }
    return 'INVENTORY_STATUS';
  }

  // Purchase Orders
  if (q.includes('purchase order') || q.includes('po')) {
    if (entities.poIds.length > 0 || q.includes('status')) {
      return 'PO_STATUS';
    }
    if (q.includes('items in po') || q.includes('sgtins in po')) {
      return 'PO_SGTINS';
    }
    return 'PO_LIST';
  }

  // Counterfeit / POS / Sales
  if (q.includes('counterfeit') || q.includes('fraud') || q.includes('fake')) {
    return 'COUNTERFEIT';
  }
  // Prefer inventory when the user asks about "sold state" or item status/SGTIN
  if (q.includes('sold state') || (q.includes('sold') && (q.includes('sgtin') || q.includes('status') || q.includes('inventory') || q.includes('item') || q.includes('items')))) {
    return 'INVENTORY_STATUS';
  }
  // Sales/transactions context
  if (q.includes('sales') || (q.includes('sold') && (q.includes('sale') || q.includes('pos') || q.includes('transaction')))) {
    return 'SALES_DETAILS';
  }

  return 'GENERAL';
}

function likePattern(s) {
  // For ILIKE search on location
  return `%${s.replace(/[%_]/g, '')}%`;
}

function plan(mandt, question) {
  const entities = extractEntities(question);
  const intent = determineIntent(question, entities);
  const plans = [];

  switch (intent) {
    case 'INVENTORY_COUNT': {
      plans.push({
        type: 'INVENTORY',
        sql: `
          SELECT 
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'IN_STOCK')::int as in_stock,
            COUNT(*) FILTER (WHERE status = 'SOLD')::int as sold,
            COUNT(*) FILTER (WHERE status = 'CREATED')::int as created,
            COUNT(*) FILTER (WHERE status = 'RETURNED')::int as returned,
            COUNT(*) FILTER (WHERE status = 'DAMAGED')::int as damaged
          FROM serialized_items
          WHERE mandt = $1
        `,
        params: [mandt],
        limit: 1
      });
      break;
    }

    case 'INVENTORY_LOCATION':
    case 'INVENTORY_STATUS': {
      const statusFilter = entities.statuses.find((s) => ALLOWED_ITEM_STATUSES.includes(s)) || null;
      const locFilter = entities.locations.length > 0 ? likePattern(entities.locations[0]) : null;
      const gtinFilter = entities.gtins.length > 0 ? entities.gtins[0] : null;

      plans.push({
        type: 'INVENTORY',
        sql: `
          SELECT mandt, sgtin, gtin, product_name, brand, category, status, location, batch, manufacture_date, created_at
          FROM v_inventory
          WHERE mandt = $1
            AND ($2::text IS NULL OR status = $2)
            AND ($3::text IS NULL OR location ILIKE $3)
            AND ($4::text IS NULL OR gtin = $4)
          ORDER BY created_at DESC
          LIMIT 50
        `,
        params: [mandt, statusFilter, locFilter, gtinFilter],
        limit: 50
      });
      break;
    }

    case 'MISSING_SGTINS': {
      plans.push({
        type: 'MISSING_SGTINS',
        sql: `
          SELECT p.mandt, p.gtin, p.name AS product_name, p.brand, p.category, p.created_at
          FROM products p
          WHERE p.mandt = $1
            AND NOT EXISTS (
              SELECT 1 FROM serialized_items si
              WHERE si.mandt = p.mandt AND si.gtin = p.gtin
            )
          ORDER BY p.created_at DESC
          LIMIT 100
        `,
        params: [mandt],
        limit: 100
      });
      break;
    }

    case 'PO_STATUS':
    case 'PO_LIST': {
      const statusFilter = entities.statuses.find((s) => ALLOWED_PO_STATUSES.includes(s)) || null;
      const poIdSpecific =
        entities.poIds.length > 0
          ? entities.poIds[0]
          : null;

      if (poIdSpecific) {
        // Use base table with LEFT JOIN to avoid losing rows when product master is missing
        plans.push({
          type: 'PURCHASE_ORDER',
          sql: `
            SELECT 
              p.mandt,
              p.po_id,
              p.gtin,
              pr.name AS product_name,
              pr.brand,
              p.quantity,
              p.received_quantity,
              p.status,
              p.supplier,
              p.warehouse,
              p.expected_delivery_date,
              p.created_at
            FROM purchase_orders p
            LEFT JOIN products pr ON pr.mandt = p.mandt AND pr.gtin = p.gtin
            WHERE p.mandt = $1
              AND (p.po_id = $2 OR p.po_id ILIKE $3)
            ORDER BY p.created_at DESC
            LIMIT 1
          `,
          params: [mandt, poIdSpecific, likePattern(poIdSpecific)],
          limit: 1
        });
      } else {
        plans.push({
          type: 'PURCHASE_ORDER_LIST',
          sql: `
            SELECT 
              p.mandt,
              p.po_id,
              p.gtin,
              pr.name AS product_name,
              pr.brand,
              p.quantity,
              p.received_quantity,
              p.status,
              p.supplier,
              p.warehouse,
              p.expected_delivery_date,
              p.created_at
            FROM purchase_orders p
            LEFT JOIN products pr ON pr.mandt = p.mandt AND pr.gtin = p.gtin
            WHERE p.mandt = $1
              AND ($2::text IS NULL OR p.status = $2)
            ORDER BY p.created_at DESC
            LIMIT 50
          `,
          params: [mandt, statusFilter],
          limit: 50
        });
      }
      break;
    }

    case 'PO_SGTINS': {
      const poId =
        entities.poIds.length > 0
          ? entities.poIds[0]
          : null;

      if (poId) {
        plans.push({
          type: 'PO_SGTINS',
          sql: `
            SELECT m.mandt, m.po_id, m.sgtin, si.status, si.location, p.name AS product_name, p.brand, si.created_at
            FROM po_sgtin_mapping m
            JOIN serialized_items si ON si.mandt = m.mandt AND si.sgtin = m.sgtin
            JOIN products p ON p.mandt = si.mandt AND p.gtin = si.gtin
            WHERE m.mandt = $1 AND m.po_id = $2
            ORDER BY si.created_at DESC
            LIMIT 100
          `,
          params: [mandt, poId],
          limit: 100
        });
      }
      break;
    }

    case 'SGTIN_TRACE': {
      if (entities.sgtins.length > 0) {
        plans.push({
          type: 'SGTIN_TRACE',
          sql: `
            SELECT mandt, event_id, sgtin, event_type, location, metadata, created_at
            FROM lifecycle_events
            WHERE mandt = $1 AND sgtin = $2
            ORDER BY created_at ASC
          `,
          params: [mandt, entities.sgtins[0]]
        });
      }
      break;
    }

    case 'COUNTERFEIT': {
      plans.push({
        type: 'COUNTERFEIT_LOGS',
        sql: `
          SELECT mandt, log_id, sgtin, reason, store_id, detected_at, details
          FROM counterfeit_logs
          WHERE mandt = $1
          ORDER BY detected_at DESC
          LIMIT 50
        `,
        params: [mandt],
        limit: 50
      });
      break;
    }

    case 'SALES_DETAILS': {
      const last24h = question.toLowerCase().includes('24') || question.toLowerCase().includes('today');
      if (last24h) {
        plans.push({
          type: 'SALES',
          sql: `
            SELECT mandt, sale_id, store_id, sgtin, gtin, product_name, brand, price, sold_at
            FROM v_sales_details
            WHERE mandt = $1
              AND sold_at >= NOW() - INTERVAL '24 hours'
            ORDER BY sold_at DESC
            LIMIT 50
          `,
          params: [mandt],
          limit: 50
        });
      } else {
        plans.push({
          type: 'SALES',
          sql: `
            SELECT mandt, sale_id, store_id, sgtin, gtin, product_name, brand, price, sold_at
            FROM v_sales_details
            WHERE mandt = $1
            ORDER BY sold_at DESC
            LIMIT 50
          `,
          params: [mandt],
          limit: 50
        });
      }
      break;
    }

    case 'PASSPORT_QUERY': {
      // No direct SQL plan here; expected to be handled by an external service (e.g., GTIN Passport on port 3006)
      break;
    }

    case 'GENERAL':
    default: {
      // Try to infer some defaults:
      if (entities.poIds.length > 0) {
        plans.push({
          type: 'PURCHASE_ORDER',
          sql: `
            SELECT 
              p.mandt,
              p.po_id,
              p.gtin,
              pr.name AS product_name,
              pr.brand,
              p.quantity,
              p.received_quantity,
              p.status,
              p.supplier,
              p.warehouse,
              p.expected_delivery_date,
              p.created_at
            FROM purchase_orders p
            LEFT JOIN products pr ON pr.mandt = p.mandt AND pr.gtin = p.gtin
            WHERE p.mandt = $1
              AND (p.po_id = $2 OR p.po_id ILIKE $3)
            ORDER BY p.created_at DESC
            LIMIT 1
          `,
          params: [mandt, entities.poIds[0], likePattern(entities.poIds[0])],
          limit: 1
        });
      } else if (entities.sgtins.length > 0) {
        plans.push({
          type: 'SGTIN_TRACE',
          sql: `
            SELECT mandt, event_id, sgtin, event_type, location, metadata, created_at
            FROM lifecycle_events
            WHERE mandt = $1 AND sgtin = $2
            ORDER BY created_at ASC
          `,
          params: [mandt, entities.sgtins[0]]
        });
      } else {
        // default general inventory status
        plans.push({
          type: 'INVENTORY',
          sql: `
            SELECT mandt, sgtin, gtin, product_name, brand, category, status, location, batch, manufacture_date, created_at
            FROM v_inventory
            WHERE mandt = $1 AND status = 'IN_STOCK'
            ORDER BY created_at DESC
            LIMIT 50
          `,
          params: [mandt],
          limit: 50
        });
      }
      break;
    }
  }

  return { intent, entities, plans };
}

function isOutOfDomain(question) {
  const q = (question || '').toLowerCase();
  const nonDomain = ['weather', 'temperature', 'rain', 'sunny', 'snow', 'news', 'headline', 'joke', 'time', 'date'];
  return nonDomain.some((k) => q.includes(k));
}

module.exports = {
  plan,
  extractEntities,
  determineIntent,
  isOutOfDomain,
  ALLOWED_ITEM_STATUSES,
  ALLOWED_PO_STATUSES
};