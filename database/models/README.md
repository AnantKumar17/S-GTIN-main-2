# Database Models

This directory contains Node.js data models for the SGTIN Lifecycle System with built-in multi-tenancy support (MANDT field).

## Architecture

All models extend the `BaseModel` class which provides:
- Automatic MANDT (multi-tenant) filtering
- Common CRUD operations
- Transaction support
- Query building helpers

## Models

### BaseModel.js
Base class that all models extend. Provides:
- `findAll(filters, options)` - Find multiple records
- `findOne(primaryKey)` - Find single record
- `insert(data)` - Insert new record
- `insertMany(records)` - Bulk insert
- `update(filters, data)` - Update records
- `delete(filters)` - Delete records
- `count(filters)` - Count records
- `customQuery(sql, params)` - Execute custom SQL

### Product.js
Manages master product data (GTIN level).

**Key Methods:**
- `findByGtin(gtin)` - Find product by GTIN
- `findByBrand(brand)` - Find products by brand
- `findByCategory(category)` - Find products by category
- `searchByName(searchTerm)` - Search products
- `getAllBrands()` - Get unique brands
- `getAllCategories()` - Get unique categories
- `create(productData)` - Create new product

### SerializedItem.js
Manages individual serialized items (SGTIN level).

**Key Methods:**
- `findBySgtin(sgtin)` - Find item by SGTIN
- `findByGtin(gtin)` - Find all items for a GTIN
- `findByStatus(status)` - Find items by status
- `findByBatch(batch)` - Find items by batch
- `getInventory(filters)` - Get inventory with product details
- `updateStatus(sgtin, newStatus, location)` - Update item status
- `getStatusCounts()` - Get counts by status
- **Static:** `isValidSgtinFormat(sgtin)` - Validate SGTIN format
- **Static:** `extractGtin(sgtin)` - Extract GTIN from SGTIN

### PurchaseOrder.js
Manages purchase orders with SGTIN tracking.

**Key Methods:**
- `findByPoId(poId)` - Find PO by ID
- `findByStatus(status)` - Find POs by status
- `getPoDetails(poId)` - Get PO with product details
- `getAllWithDetails(filters)` - Get all POs with products
- `create(poData)` - Create new PO
- `updateReceivedQuantity(poId, qty)` - Update received quantity
- `getSgtins(poId)` - Get all SGTINs for a PO
- `linkSgtins(poId, sgtins)` - Link SGTINs to PO
- `generatePoId()` - Generate next PO ID

### Sale.js
Manages POS sales transactions.

**Key Methods:**
- `findBySaleId(saleId)` - Find sale by ID
- `findByStore(storeId)` - Find sales by store
- `getSaleDetails(saleId)` - Get sale with items
- `createSale(saleData, items)` - Create sale (with transaction)
- `getSalesByDateRange(start, end)` - Get sales by date
- `getSalesSummary(storeId, start, end)` - Get sales statistics
- `generateSaleId()` - Generate next sale ID

### LifecycleEvent.js
Manages lifecycle events for traceability.

**Key Methods:**
- `createEvent(eventData)` - Create new event
- `getTrace(sgtin)` - Get complete lifecycle for SGTIN
- `getEventsByType(eventType, start, end)` - Filter by type
- `getRecentEvents(limit)` - Get recent events with product details
- `getEventStatistics(start, end)` - Get event counts by type

## Usage Examples

### Import Models

```javascript
// Option 1: Import specific models
const { Product, SerializedItem } = require('./database/models');

// Option 2: Get all models for a specific MANDT
const { getModels } = require('./database/models');
const models = getModels('100'); // MANDT = '100'
```

### Product Operations

```javascript
const { Product } = require('./database/models');
const productModel = new Product('100'); // MANDT = '100'

// Find product by GTIN
const product = await productModel.findByGtin('04012345678901');

// Search products
const results = await productModel.searchByName('Adidas');

// Get all brands
const brands = await productModel.getAllBrands();

// Create new product
const newProduct = await productModel.create({
  gtin: '04012345678905',
  name: 'Adidas Running Shoes',
  brand: 'Adidas',
  category: 'Footwear',
  price: 120.00
});
```

### SerializedItem Operations

```javascript
const { SerializedItem } = require('./database/models');
const itemModel = new SerializedItem('100');

// Validate SGTIN format
const isValid = SerializedItem.isValidSgtinFormat('0104012345678901211234567');

// Get inventory
const inventory = await itemModel.getInventory({
  status: 'IN_STOCK',
  location: 'Warehouse A'
});

// Update item status
await itemModel.updateStatus(
  '0104012345678901211234567',
  'SOLD',
  'Store Mumbai'
);

// Get status counts
const counts = await itemModel.getStatusCounts();
// Returns: { CREATED: 10, IN_STOCK: 50, SOLD: 30 }
```

### PurchaseOrder Operations

```javascript
const { PurchaseOrder } = require('./database/models');
const poModel = new PurchaseOrder('100');

// Create purchase order
const po = await poModel.create({
  po_id: await poModel.generatePoId(),
  gtin: '04012345678901',
  quantity: 100,
  supplier: 'Adidas Supply Co.',
  warehouse: 'Warehouse A'
});

// Get PO details with product info
const details = await poModel.getPoDetails('PO-45000023');

// Update received quantity
await poModel.updateReceivedQuantity('PO-45000023', 10);

// Link SGTINs to PO
await poModel.linkSgtins('PO-45000023', [
  '0104012345678901211234567',
  '0104012345678901211234568'
]);
```

### Sale Operations

```javascript
const { Sale } = require('./database/models');
const saleModel = new Sale('100');

// Create sale with items (transactional)
const sale = await saleModel.createSale(
  {
    sale_id: await saleModel.generateSaleId(),
    store_id: 'STORE-MUMBAI-001',
    cashier_id: 'CASHIER-101',
    total_amount: 180.00
  },
  [
    { sgtin: '0104012345678901211234567', price: 180.00 }
  ]
);

// Get sale details
const saleDetails = await saleModel.getSaleDetails('SALE-2026-0001');

// Get sales summary
const summary = await saleModel.getSalesSummary('STORE-MUMBAI-001');
```

### LifecycleEvent Operations

```javascript
const { LifecycleEvent } = require('./database/models');
const eventModel = new LifecycleEvent('100');

// Create lifecycle event
await eventModel.createEvent({
  sgtin: '0104012345678901211234567',
  event_type: 'RECEIVED',
  location: 'Warehouse A',
  metadata: { gr_id: 'GR-2026-0001' }
});

// Get complete trace
const trace = await eventModel.getTrace('0104012345678901211234567');

// Get recent events
const recent = await eventModel.getRecentEvents(50);

// Get statistics
const stats = await eventModel.getEventStatistics();
```

### Multi-Tenant Usage

```javascript
// Different clients using same database
const client100 = new Product('100'); // Client 100
const client200 = new Product('200'); // Client 200

// Each sees only their own data
const products100 = await client100.findAll();
const products200 = await client200.findAll();
```

### Transaction Example

```javascript
const db = require('./database/models/db');
const client = await db.getClient();

try {
  await client.query('BEGIN');
  
  // Multiple operations...
  const po = await client.query('INSERT INTO purchase_orders...');
  const sgtins = await client.query('INSERT INTO serialized_items...');
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Environment Variables

Models use the following environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sgtin_db
DB_USER=postgres
DB_PASSWORD=postgres
MANDT=100
LOG_SQL=false  # Set to true to log SQL queries
```

## Error Handling

All models throw descriptive errors:

```javascript
try {
  await productModel.create({
    gtin: '04012345678901', // Duplicate GTIN
    name: 'Test Product'
  });
} catch (error) {
  console.error(error.message);
  // "Product with GTIN 04012345678901 already exists"
}
```

## Testing Models

```javascript
// test-models.js
const { Product, SerializedItem } = require('./database/models');

async function testModels() {
  const productModel = new Product('100');
  
  // Test product creation
  const product = await productModel.create({
    gtin: '99999999999999',
    name: 'Test Product',
    brand: 'Test Brand',
    price: 99.99
  });
  
  console.log('Created product:', product);
  
  // Cleanup
  await productModel.delete({ gtin: '99999999999999' });
}

testModels().catch(console.error);
```

## Best Practices

1. **Always specify MANDT**: Create model instances with appropriate MANDT value
2. **Use transactions**: For multi-step operations that must succeed/fail together
3. **Validate input**: Check required fields before calling model methods
4. **Handle errors**: Wrap model calls in try/catch blocks
5. **Close connections**: Call `db.closePool()` when shutting down
6. **Use indexes**: Leverage database indexes for better performance
7. **Batch operations**: Use `insertMany()` for bulk inserts

## Performance Tips

- Use `findAll()` with filters instead of fetching all and filtering in code
- Leverage database views (`v_inventory`, `v_purchase_orders`) for complex joins
- Use `count()` instead of `findAll().length` for counting
- Set appropriate limits on queries that might return many rows
- Use connection pooling (already configured in `db.js`)
