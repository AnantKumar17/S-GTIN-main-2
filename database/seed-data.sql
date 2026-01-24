-- Sample Data for SGTIN Lifecycle System
-- MANDT = '100' (Test Client)

-- =============================================================================
-- PRODUCTS
-- =============================================================================
INSERT INTO products (mandt, gtin, name, brand, category, subcategory, price, description) VALUES
-- Adidas Products
('100', '04012345678901', 'Adidas Ultraboost 22', 'Adidas', 'Footwear', 'Running Shoes', 180.00, 'High-performance running shoes'),
('100', '04012345678902', 'Adidas Stan Smith', 'Adidas', 'Footwear', 'Sneakers', 85.00, 'Classic leather sneakers'),
('100', '04012345678903', 'Adidas Training Shirt', 'Adidas', 'Apparel', 'T-Shirts', 35.00, 'Performance training shirt'),
('100', '04012345678904', 'Adidas Track Pants', 'Adidas', 'Apparel', 'Pants', 55.00, 'Comfortable track pants'),

-- Nike Products
('100', '04056789012301', 'Nike Air Max 270', 'Nike', 'Footwear', 'Sneakers', 150.00, 'Iconic Air Max sneakers'),
('100', '04056789012302', 'Nike Dri-FIT Shirt', 'Nike', 'Apparel', 'T-Shirts', 30.00, 'Moisture-wicking sports shirt'),
('100', '04056789012303', 'Nike Pro Shorts', 'Nike', 'Apparel', 'Shorts', 40.00, 'Compression training shorts'),
('100', '04056789012304', 'Nike Running Jacket', 'Nike', 'Apparel', 'Outerwear', 90.00, 'Lightweight running jacket'),

-- H&M Products
('100', '07312345678901', 'H&M Cotton T-Shirt', 'H&M', 'Apparel', 'T-Shirts', 12.99, 'Basic cotton t-shirt'),
('100', '07312345678902', 'H&M Slim Jeans', 'H&M', 'Apparel', 'Jeans', 39.99, 'Slim fit denim jeans'),
('100', '07312345678903', 'H&M Summer Dress', 'H&M', 'Apparel', 'Dresses', 29.99, 'Light summer dress'),
('100', '07312345678904', 'H&M Hoodie', 'H&M', 'Apparel', 'Hoodies', 24.99, 'Comfortable cotton hoodie'),

-- Puma Products
('100', '04018765432101', 'Puma Suede Classic', 'Puma', 'Footwear', 'Sneakers', 70.00, 'Iconic suede sneakers'),
('100', '04018765432102', 'Puma Training Top', 'Puma', 'Apparel', 'T-Shirts', 32.00, 'Athletic training top'),
('100', '04018765432103', 'Puma Track Jacket', 'Puma', 'Apparel', 'Outerwear', 65.00, 'Classic track jacket'),

-- Zara Products
('100', '08423456789101', 'Zara Blazer', 'Zara', 'Apparel', 'Outerwear', 89.90, 'Tailored blazer'),
('100', '08423456789102', 'Zara Dress Shirt', 'Zara', 'Apparel', 'Shirts', 45.90, 'Formal dress shirt'),
('100', '08423456789103', 'Zara Chinos', 'Zara', 'Apparel', 'Pants', 49.90, 'Slim fit chino pants'),

-- Uniqlo Products
('100', '04965432101201', 'Uniqlo Heattech Shirt', 'Uniqlo', 'Apparel', 'T-Shirts', 19.90, 'Heat-retaining undershirt'),
('100', '04965432101202', 'Uniqlo Down Jacket', 'Uniqlo', 'Apparel', 'Outerwear', 69.90, 'Ultra-light down jacket'),
('100', '04965432101203', 'Uniqlo Jeans', 'Uniqlo', 'Apparel', 'Jeans', 39.90, 'Stretch selvedge jeans');

-- =============================================================================
-- SAMPLE BATCHES
-- Some products will have SGTINs pre-generated for demo purposes
-- =============================================================================

-- Batch 1: Adidas Ultraboost 22 - JAN26-ADIDAS-BLUE (10 items)
INSERT INTO serialized_items (mandt, sgtin, gtin, status, location, batch, manufacture_date, passport) VALUES
('100', '0104012345678901211000000001', '04012345678901', 'IN_STOCK', 'Warehouse A', 'JAN26-ADIDAS-BLUE', '2026-01-10',
 '{"factory": "Factory A, Vietnam", "sustainability": "Carbon Neutral", "certifications": ["ISO 9001", "Fair Trade"]}'),
('100', '0104012345678901211000000002', '04012345678901', 'IN_STOCK', 'Warehouse A', 'JAN26-ADIDAS-BLUE', '2026-01-10',
 '{"factory": "Factory A, Vietnam", "sustainability": "Carbon Neutral", "certifications": ["ISO 9001", "Fair Trade"]}'),
('100', '0104012345678901211000000003', '04012345678901', 'IN_STOCK', 'Warehouse A', 'JAN26-ADIDAS-BLUE', '2026-01-10',
 '{"factory": "Factory A, Vietnam", "sustainability": "Carbon Neutral", "certifications": ["ISO 9001", "Fair Trade"]}'),
('100', '0104012345678901211000000004', '04012345678901', 'SOLD', 'Store Mumbai', 'JAN26-ADIDAS-BLUE', '2026-01-10',
 '{"factory": "Factory A, Vietnam", "sustainability": "Carbon Neutral", "certifications": ["ISO 9001", "Fair Trade"]}'),
('100', '0104012345678901211000000005', '04012345678901', 'SOLD', 'Store Mumbai', 'JAN26-ADIDAS-BLUE', '2026-01-10',
 '{"factory": "Factory A, Vietnam", "sustainability": "Carbon Neutral", "certifications": ["ISO 9001", "Fair Trade"]}');

-- Batch 2: Nike Air Max 270 - JAN26-NIKE-RED (8 items)
INSERT INTO serialized_items (mandt, sgtin, gtin, status, location, batch, manufacture_date, passport) VALUES
('100', '0104056789012301212000000001', '04056789012301', 'IN_STOCK', 'Warehouse B', 'JAN26-NIKE-RED', '2026-01-12',
 '{"factory": "Factory B, Indonesia", "sustainability": "Recycled Materials", "certifications": ["ISO 14001"]}'),
('100', '0104056789012301212000000002', '04056789012301', 'IN_STOCK', 'Warehouse B', 'JAN26-NIKE-RED', '2026-01-12',
 '{"factory": "Factory B, Indonesia", "sustainability": "Recycled Materials", "certifications": ["ISO 14001"]}'),
('100', '0104056789012301212000000003', '04056789012301', 'IN_STOCK', 'Warehouse B', 'JAN26-NIKE-RED', '2026-01-12',
 '{"factory": "Factory B, Indonesia", "sustainability": "Recycled Materials", "certifications": ["ISO 14001"]}');

-- Batch 3: H&M Cotton T-Shirts - DEC25-HM-WHITE (15 items in Bangalore)
INSERT INTO serialized_items (mandt, sgtin, gtin, status, location, batch, manufacture_date, passport) VALUES
('100', '0107312345678901213000000001', '07312345678901', 'IN_STOCK', 'Warehouse Bangalore', 'DEC25-HM-WHITE', '2025-12-20',
 '{"factory": "Factory C, Bangladesh", "sustainability": "Organic Cotton", "certifications": ["GOTS", "Fair Trade"]}'),
('100', '0107312345678901213000000002', '07312345678901', 'IN_STOCK', 'Warehouse Bangalore', 'DEC25-HM-WHITE', '2025-12-20',
 '{"factory": "Factory C, Bangladesh", "sustainability": "Organic Cotton", "certifications": ["GOTS", "Fair Trade"]}'),
('100', '0107312345678901213000000003', '07312345678901', 'IN_STOCK', 'Warehouse Bangalore', 'DEC25-HM-WHITE', '2025-12-20',
 '{"factory": "Factory C, Bangladesh", "sustainability": "Organic Cotton", "certifications": ["GOTS", "Fair Trade"]}'),
('100', '0107312345678901213000000004', '07312345678901', 'IN_STOCK', 'Warehouse Bangalore', 'DEC25-HM-WHITE', '2025-12-20',
 '{"factory": "Factory C, Bangladesh", "sustainability": "Organic Cotton", "certifications": ["GOTS", "Fair Trade"]}'),
('100', '0107312345678901213000000005', '07312345678901', 'IN_STOCK', 'Warehouse Bangalore', 'DEC25-HM-WHITE', '2025-12-20',
 '{"factory": "Factory C, Bangladesh", "sustainability": "Organic Cotton", "certifications": ["GOTS", "Fair Trade"]}');

-- =============================================================================
-- LIFECYCLE EVENTS
-- =============================================================================
INSERT INTO lifecycle_events (mandt, sgtin, event_type, location, metadata) VALUES
-- Adidas Ultraboost events
('100', '0104012345678901211000000001', 'CREATED', 'SGTIN Service', '{"po_id": "PO-45000021"}'),
('100', '0104012345678901211000000001', 'RECEIVED', 'Warehouse A', '{"gr_id": "GR-2026-0001"}'),

('100', '0104012345678901211000000004', 'CREATED', 'SGTIN Service', '{"po_id": "PO-45000021"}'),
('100', '0104012345678901211000000004', 'RECEIVED', 'Warehouse A', '{"gr_id": "GR-2026-0001"}'),
('100', '0104012345678901211000000004', 'SOLD', 'Store Mumbai', '{"sale_id": "SALE-2026-0001", "amount": 180.00}'),

-- Nike Air Max events
('100', '0104056789012301212000000001', 'CREATED', 'SGTIN Service', '{"po_id": "PO-45000022"}'),
('100', '0104056789012301212000000001', 'RECEIVED', 'Warehouse B', '{"gr_id": "GR-2026-0002"}');

-- =============================================================================
-- SAMPLE PURCHASE ORDERS
-- =============================================================================
INSERT INTO purchase_orders (mandt, po_id, gtin, quantity, received_quantity, status, supplier, warehouse, expected_delivery_date) VALUES
('100', 'PO-45000021', '04012345678901', 10, 10, 'FULLY_RECEIVED', 'Adidas Supply Co.', 'Warehouse A', '2026-01-15'),
('100', 'PO-45000022', '04056789012301', 8, 8, 'FULLY_RECEIVED', 'Nike Distribution', 'Warehouse B', '2026-01-18'),
('100', 'PO-45000023', '07312345678902', 20, 0, 'OPEN', 'H&M Logistics', 'Warehouse Bangalore', '2026-01-25'),
('100', 'PO-45000024', '04018765432101', 15, 7, 'PARTIALLY_RECEIVED', 'Puma Retail', 'Warehouse A', '2026-01-22');

-- =============================================================================
-- PO-SGTIN MAPPINGS
-- =============================================================================
INSERT INTO po_sgtin_mapping (mandt, po_id, sgtin) VALUES
('100', 'PO-45000021', '0104012345678901211000000001'),
('100', 'PO-45000021', '0104012345678901211000000002'),
('100', 'PO-45000021', '0104012345678901211000000003'),
('100', 'PO-45000021', '0104012345678901211000000004'),
('100', 'PO-45000021', '0104012345678901211000000005'),
('100', 'PO-45000022', '0104056789012301212000000001'),
('100', 'PO-45000022', '0104056789012301212000000002'),
('100', 'PO-45000022', '0104056789012301212000000003');

-- =============================================================================
-- GOODS RECEIPTS
-- =============================================================================
INSERT INTO goods_receipts (mandt, gr_id, po_id, warehouse, received_quantity, received_by) VALUES
('100', 'GR-2026-0001', 'PO-45000021', 'Warehouse A', 10, 'John Doe'),
('100', 'GR-2026-0002', 'PO-45000022', 'Warehouse B', 8, 'Jane Smith');

-- =============================================================================
-- SALES
-- =============================================================================
INSERT INTO sales (mandt, sale_id, store_id, cashier_id, total_amount) VALUES
('100', 'SALE-2026-0001', 'STORE-MUMBAI-001', 'CASHIER-101', 360.00);

INSERT INTO sale_items (mandt, sale_id, sgtin, price) VALUES
('100', 'SALE-2026-0001', '0104012345678901211000000004', 180.00),
('100', 'SALE-2026-0001', '0104012345678901211000000005', 180.00);

-- =============================================================================
-- COUNTERFEIT LOGS (Sample)
-- =============================================================================
INSERT INTO counterfeit_logs (mandt, sgtin, reason, store_id, details) VALUES
('100', '0199999999999999999999999999', 'NOT_FOUND', 'STORE-MUMBAI-001', '{"scanned_by": "CASHIER-101", "message": "SGTIN does not exist in system"}'),
('100', '0104012345678901211000000004', 'ALREADY_SOLD', 'STORE-DELHI-002', '{"scanned_by": "CASHIER-205", "original_sale": "SALE-2026-0001", "message": "Item was already sold"}');

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Count products per brand
-- SELECT brand, COUNT(*) FROM products WHERE mandt = '100' GROUP BY brand;

-- Count serialized items by status
-- SELECT status, COUNT(*) FROM serialized_items WHERE mandt = '100' GROUP BY status;

-- View purchase orders summary
-- SELECT * FROM v_purchase_orders WHERE mandt = '100';

-- View current inventory
-- SELECT * FROM v_inventory WHERE mandt = '100' AND status = 'IN_STOCK';
