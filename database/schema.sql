-- SGTIN Lifecycle System Database Schema
-- Multi-tenant architecture with MANDT field (SAP standard)
-- PostgreSQL 14+ compatible, designed for migration to SAP HANA Cloud

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PRODUCTS TABLE
-- Master data for products (GTIN level)
-- =============================================================================
CREATE TABLE IF NOT EXISTS products (
    mandt VARCHAR(3) NOT NULL,
    gtin VARCHAR(14) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    price DECIMAL(10, 2),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, gtin)
);

CREATE INDEX idx_products_brand ON products(mandt, brand);
CREATE INDEX idx_products_category ON products(mandt, category);

-- =============================================================================
-- SERIALIZED_ITEMS TABLE
-- Individual serialized items (SGTIN level)
-- =============================================================================
CREATE TABLE IF NOT EXISTS serialized_items (
    mandt VARCHAR(3) NOT NULL,
    sgtin VARCHAR(50) NOT NULL,
    gtin VARCHAR(14) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    location VARCHAR(100),
    batch VARCHAR(50),
    manufacture_date DATE,
    passport JSONB,
    barcode TEXT,
    qr_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, sgtin),
    FOREIGN KEY (mandt, gtin) REFERENCES products(mandt, gtin),
    CHECK (status IN ('CREATED', 'IN_STOCK', 'SOLD', 'RETURNED', 'DAMAGED'))
);

CREATE INDEX idx_sgtin_status ON serialized_items(mandt, status);
CREATE INDEX idx_sgtin_batch ON serialized_items(mandt, batch);
CREATE INDEX idx_sgtin_gtin ON serialized_items(mandt, gtin);
CREATE INDEX idx_sgtin_location ON serialized_items(mandt, location);

-- =============================================================================
-- PURCHASE_ORDERS TABLE
-- Purchase order header
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    mandt VARCHAR(3) NOT NULL,
    po_id VARCHAR(20) NOT NULL,
    gtin VARCHAR(14) NOT NULL,
    quantity INTEGER NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    supplier VARCHAR(255),
    warehouse VARCHAR(100),
    expected_delivery_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, po_id),
    FOREIGN KEY (mandt, gtin) REFERENCES products(mandt, gtin),
    CHECK (status IN ('OPEN', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED')),
    CHECK (received_quantity <= quantity)
);

CREATE INDEX idx_po_status ON purchase_orders(mandt, status);
CREATE INDEX idx_po_gtin ON purchase_orders(mandt, gtin);

-- =============================================================================
-- PO_SGTIN_MAPPING TABLE
-- Maps SGTINs to purchase orders
-- =============================================================================
CREATE TABLE IF NOT EXISTS po_sgtin_mapping (
    mandt VARCHAR(3) NOT NULL,
    po_id VARCHAR(20) NOT NULL,
    sgtin VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, po_id, sgtin),
    FOREIGN KEY (mandt, po_id) REFERENCES purchase_orders(mandt, po_id),
    FOREIGN KEY (mandt, sgtin) REFERENCES serialized_items(mandt, sgtin)
);

CREATE INDEX idx_mapping_sgtin ON po_sgtin_mapping(mandt, sgtin);

-- =============================================================================
-- GOODS_RECEIPTS TABLE
-- Goods receipt transactions
-- =============================================================================
CREATE TABLE IF NOT EXISTS goods_receipts (
    mandt VARCHAR(3) NOT NULL,
    gr_id VARCHAR(20) NOT NULL,
    po_id VARCHAR(20) NOT NULL,
    warehouse VARCHAR(100),
    received_quantity INTEGER NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_by VARCHAR(100),
    PRIMARY KEY (mandt, gr_id),
    FOREIGN KEY (mandt, po_id) REFERENCES purchase_orders(mandt, po_id)
);

CREATE INDEX idx_gr_po ON goods_receipts(mandt, po_id);
CREATE INDEX idx_gr_date ON goods_receipts(mandt, received_at);

-- =============================================================================
-- GR_SGTIN_MAPPING TABLE
-- Maps received SGTINs to goods receipts
-- =============================================================================
CREATE TABLE IF NOT EXISTS gr_sgtin_mapping (
    mandt VARCHAR(3) NOT NULL,
    gr_id VARCHAR(20) NOT NULL,
    sgtin VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, gr_id, sgtin),
    FOREIGN KEY (mandt, gr_id) REFERENCES goods_receipts(mandt, gr_id),
    FOREIGN KEY (mandt, sgtin) REFERENCES serialized_items(mandt, sgtin)
);

-- =============================================================================
-- SALES TABLE
-- Sales transactions
-- =============================================================================
CREATE TABLE IF NOT EXISTS sales (
    mandt VARCHAR(3) NOT NULL,
    sale_id VARCHAR(20) NOT NULL,
    store_id VARCHAR(20) NOT NULL,
    cashier_id VARCHAR(20),
    total_amount DECIMAL(10, 2),
    sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, sale_id)
);

CREATE INDEX idx_sales_store ON sales(mandt, store_id);
CREATE INDEX idx_sales_date ON sales(mandt, sold_at);

-- =============================================================================
-- SALE_ITEMS TABLE
-- Individual items in a sale
-- =============================================================================
CREATE TABLE IF NOT EXISTS sale_items (
    mandt VARCHAR(3) NOT NULL,
    sale_id VARCHAR(20) NOT NULL,
    sgtin VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, sale_id, sgtin),
    FOREIGN KEY (mandt, sale_id) REFERENCES sales(mandt, sale_id),
    FOREIGN KEY (mandt, sgtin) REFERENCES serialized_items(mandt, sgtin)
);

CREATE INDEX idx_sale_items_sgtin ON sale_items(mandt, sgtin);

-- =============================================================================
-- COUNTERFEIT_LOGS TABLE
-- Logs of counterfeit detection attempts
-- =============================================================================
CREATE TABLE IF NOT EXISTS counterfeit_logs (
    mandt VARCHAR(3) NOT NULL,
    log_id UUID DEFAULT uuid_generate_v4(),
    sgtin VARCHAR(50),
    reason VARCHAR(50) NOT NULL,
    store_id VARCHAR(20),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB,
    PRIMARY KEY (mandt, log_id),
    CHECK (reason IN ('NOT_FOUND', 'ALREADY_SOLD', 'WRONG_STORE', 'INVALID_FORMAT'))
);

CREATE INDEX idx_counterfeit_date ON counterfeit_logs(mandt, detected_at);
CREATE INDEX idx_counterfeit_store ON counterfeit_logs(mandt, store_id);

-- =============================================================================
-- LIFECYCLE_EVENTS TABLE
-- Complete audit trail of SGTIN lifecycle
-- =============================================================================
CREATE TABLE IF NOT EXISTS lifecycle_events (
    mandt VARCHAR(3) NOT NULL,
    event_id UUID DEFAULT uuid_generate_v4(),
    sgtin VARCHAR(50) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    location VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, event_id),
    FOREIGN KEY (mandt, sgtin) REFERENCES serialized_items(mandt, sgtin),
    CHECK (event_type IN ('CREATED', 'RECEIVED', 'SOLD', 'RETURNED', 'DAMAGED', 'RECALLED'))
);

CREATE INDEX idx_events_sgtin ON lifecycle_events(mandt, sgtin);
CREATE INDEX idx_events_type ON lifecycle_events(mandt, event_type);
CREATE INDEX idx_events_date ON lifecycle_events(mandt, created_at);

-- =============================================================================
-- CHAT_CONVERSATIONS TABLE (Optional)
-- Store chat conversation history
-- =============================================================================
CREATE TABLE IF NOT EXISTS chat_conversations (
    mandt VARCHAR(3) NOT NULL,
    conversation_id UUID DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, conversation_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    mandt VARCHAR(3) NOT NULL,
    message_id UUID DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mandt, message_id),
    FOREIGN KEY (mandt, conversation_id) REFERENCES chat_conversations(mandt, conversation_id),
    CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX idx_messages_conversation ON chat_messages(mandt, conversation_id);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View: Inventory with product details
CREATE OR REPLACE VIEW v_inventory AS
SELECT 
    si.mandt,
    si.sgtin,
    si.gtin,
    p.name AS product_name,
    p.brand,
    p.category,
    si.status,
    si.location,
    si.batch,
    si.manufacture_date,
    si.created_at
FROM serialized_items si
JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin;

-- View: Purchase Orders with product details
CREATE OR REPLACE VIEW v_purchase_orders AS
SELECT 
    po.mandt,
    po.po_id,
    po.gtin,
    p.name AS product_name,
    p.brand,
    po.quantity,
    po.received_quantity,
    po.status,
    po.supplier,
    po.warehouse,
    po.expected_delivery_date,
    po.created_at
FROM purchase_orders po
JOIN products p ON po.mandt = p.mandt AND po.gtin = p.gtin;

-- View: Sales with product details
CREATE OR REPLACE VIEW v_sales_details AS
SELECT 
    s.mandt,
    s.sale_id,
    s.store_id,
    si_item.sgtin,
    si.gtin,
    p.name AS product_name,
    p.brand,
    si_item.price,
    s.sold_at
FROM sales s
JOIN sale_items si_item ON s.mandt = si_item.mandt AND s.sale_id = si_item.sale_id
JOIN serialized_items si ON si_item.mandt = si.mandt AND si_item.sgtin = si.sgtin
JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update PO status based on received quantity
CREATE OR REPLACE FUNCTION update_po_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE purchase_orders
    SET 
        status = CASE 
            WHEN received_quantity = 0 THEN 'OPEN'
            WHEN received_quantity < quantity THEN 'PARTIALLY_RECEIVED'
            WHEN received_quantity = quantity THEN 'FULLY_RECEIVED'
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE mandt = NEW.mandt AND po_id = NEW.po_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update PO status
CREATE TRIGGER trg_update_po_status
AFTER UPDATE OF received_quantity ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_po_status();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_serialized_items_updated_at
BEFORE UPDATE ON serialized_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
