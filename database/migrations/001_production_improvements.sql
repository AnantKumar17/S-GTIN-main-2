-- ============================================================================
-- SGTIN System Production Improvements Migration
-- Date: January 21, 2026
-- Purpose: Add sequence, soft delete, and security improvements
-- ============================================================================

-- =============================================================================
-- 1. CREATE SEQUENCE FOR SGTIN GENERATION
-- Guarantees unique serial numbers, prevents collisions
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS sgtin_serial_sequence
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  NO CYCLE
  CACHE 100;

-- Grant permissions to all users
GRANT USAGE, SELECT ON SEQUENCE sgtin_serial_sequence TO PUBLIC;

COMMENT ON SEQUENCE sgtin_serial_sequence IS 'Generates unique serial numbers for SGTINs, preventing collision issues';

-- =============================================================================
-- 2. ADD SOFT DELETE SUPPORT TO SERIALIZED_ITEMS
-- Never hard delete SGTINs - required for GS1/FDA compliance
-- =============================================================================

-- Add deleted_at field if not exists
ALTER TABLE serialized_items 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Update status CHECK constraint to include DELETED
ALTER TABLE serialized_items 
  DROP CONSTRAINT IF EXISTS serialized_items_status_check;

ALTER TABLE serialized_items 
  ADD CONSTRAINT serialized_items_status_check 
  CHECK (status IN ('CREATED', 'IN_STOCK', 'SOLD', 'RETURNED', 'DAMAGED', 'DELETED'));

-- Add UNIQUE constraint to prevent SGTIN reuse (even after soft delete)
-- This ensures that once an SGTIN is created, it can never be recreated
ALTER TABLE serialized_items 
  DROP CONSTRAINT IF EXISTS unique_sgtin_per_tenant;

ALTER TABLE serialized_items 
  ADD CONSTRAINT unique_sgtin_per_tenant UNIQUE (mandt, sgtin);

-- Create index for querying deleted items
CREATE INDEX IF NOT EXISTS idx_serialized_items_deleted 
  ON serialized_items(mandt, deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- Create index for active items (not deleted)
CREATE INDEX IF NOT EXISTS idx_serialized_items_active 
  ON serialized_items(mandt, status) 
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN serialized_items.deleted_at IS 'Soft delete timestamp - NULL for active items, timestamp for deleted items';

-- =============================================================================
-- 3. ADD AUDIT FIELDS FOR SECURITY
-- Track who made changes and when
-- =============================================================================

-- Add created_by and updated_by fields to key tables
ALTER TABLE serialized_items 
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'SYSTEM';

ALTER TABLE serialized_items 
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) DEFAULT 'SYSTEM';

ALTER TABLE purchase_orders 
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'SYSTEM';

ALTER TABLE purchase_orders 
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) DEFAULT 'SYSTEM';

ALTER TABLE sales 
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'SYSTEM';

-- =============================================================================
-- 4. CREATE VIEW FOR ACTIVE (NON-DELETED) ITEMS
-- Makes queries easier and enforces soft delete pattern
-- =============================================================================

CREATE OR REPLACE VIEW v_active_inventory AS
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
    si.created_at,
    si.updated_at,
    si.created_by,
    si.updated_by
FROM serialized_items si
JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin
WHERE si.deleted_at IS NULL;

COMMENT ON VIEW v_active_inventory IS 'Shows only active (non-deleted) inventory items';

-- =============================================================================
-- 5. CREATE VIEW FOR ARCHIVED (DELETED) ITEMS
-- Provides audit trail for deleted items
-- =============================================================================

CREATE OR REPLACE VIEW v_archived_inventory AS
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
    si.created_at,
    si.deleted_at,
    si.updated_by AS deleted_by
FROM serialized_items si
JOIN products p ON si.mandt = p.mandt AND si.gtin = p.gtin
WHERE si.deleted_at IS NOT NULL
ORDER BY si.deleted_at DESC;

COMMENT ON VIEW v_archived_inventory IS 'Shows archived (soft-deleted) inventory items for audit purposes';

-- =============================================================================
-- 6. CREATE FUNCTION FOR SOFT DELETE
-- Provides consistent soft delete behavior
-- =============================================================================

CREATE OR REPLACE FUNCTION soft_delete_sgtin(
    p_mandt VARCHAR(3),
    p_sgtin VARCHAR(50),
    p_deleted_by VARCHAR(100) DEFAULT 'SYSTEM'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    UPDATE serialized_items
    SET 
        status = 'DELETED',
        deleted_at = CURRENT_TIMESTAMP,
        updated_by = p_deleted_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE mandt = p_mandt 
      AND sgtin = p_sgtin
      AND deleted_at IS NULL; -- Only delete if not already deleted
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    -- Log lifecycle event
    IF v_rows_affected > 0 THEN
        INSERT INTO lifecycle_events (mandt, sgtin, event_type, metadata)
        VALUES (
            p_mandt,
            p_sgtin,
            'DELETED',
            jsonb_build_object(
                'deleted_by', p_deleted_by,
                'deleted_at', CURRENT_TIMESTAMP
            )
        );
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION soft_delete_sgtin IS 'Soft deletes an SGTIN by setting status=DELETED and deleted_at timestamp';

-- =============================================================================
-- 7. CREATE FUNCTION TO RESTORE SOFT-DELETED ITEM
-- Allows recovery of accidentally deleted items
-- =============================================================================

CREATE OR REPLACE FUNCTION restore_sgtin(
    p_mandt VARCHAR(3),
    p_sgtin VARCHAR(50),
    p_restored_by VARCHAR(100) DEFAULT 'SYSTEM',
    p_new_status VARCHAR(20) DEFAULT 'IN_STOCK'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    UPDATE serialized_items
    SET 
        status = p_new_status,
        deleted_at = NULL,
        updated_by = p_restored_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE mandt = p_mandt 
      AND sgtin = p_sgtin
      AND deleted_at IS NOT NULL; -- Only restore if deleted
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    -- Log lifecycle event
    IF v_rows_affected > 0 THEN
        INSERT INTO lifecycle_events (mandt, sgtin, event_type, metadata)
        VALUES (
            p_mandt,
            p_sgtin,
            'RESTORED',
            jsonb_build_object(
                'restored_by', p_restored_by,
                'restored_at', CURRENT_TIMESTAMP,
                'new_status', p_new_status
            )
        );
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION restore_sgtin IS 'Restores a soft-deleted SGTIN back to active status';

-- =============================================================================
-- 8. ADD LIFECYCLE EVENT TYPE FOR DELETED STATUS
-- =============================================================================

ALTER TABLE lifecycle_events 
  DROP CONSTRAINT IF EXISTS lifecycle_events_event_type_check;

ALTER TABLE lifecycle_events 
  ADD CONSTRAINT lifecycle_events_event_type_check 
  CHECK (event_type IN ('CREATED', 'RECEIVED', 'SOLD', 'RETURNED', 'DAMAGED', 'RECALLED', 'DELETED', 'RESTORED'));

-- =============================================================================
-- 9. CREATE STATISTICS VIEW FOR MONITORING
-- Helps track system health and usage
-- =============================================================================

CREATE OR REPLACE VIEW v_system_statistics AS
SELECT 
    'Total Products' AS metric,
    COUNT(*)::TEXT AS value,
    'products'::TEXT AS table_name
FROM products
WHERE mandt = '100'

UNION ALL

SELECT 
    'Total SGTINs (All)',
    COUNT(*)::TEXT,
    'serialized_items'
FROM serialized_items
WHERE mandt = '100'

UNION ALL

SELECT 
    'Active SGTINs',
    COUNT(*)::TEXT,
    'serialized_items'
FROM serialized_items
WHERE mandt = '100' AND deleted_at IS NULL

UNION ALL

SELECT 
    'Deleted SGTINs',
    COUNT(*)::TEXT,
    'serialized_items'
FROM serialized_items
WHERE mandt = '100' AND deleted_at IS NOT NULL

UNION ALL

SELECT 
    'SGTINs - ' || status,
    COUNT(*)::TEXT,
    'serialized_items'
FROM serialized_items
WHERE mandt = '100' AND deleted_at IS NULL
GROUP BY status

UNION ALL

SELECT 
    'Total Purchase Orders',
    COUNT(*)::TEXT,
    'purchase_orders'
FROM purchase_orders
WHERE mandt = '100'

UNION ALL

SELECT 
    'Total Sales',
    COUNT(*)::TEXT,
    'sales'
FROM sales
WHERE mandt = '100'

UNION ALL

SELECT 
    'Counterfeit Detections',
    COUNT(*)::TEXT,
    'counterfeit_logs'
FROM counterfeit_logs
WHERE mandt = '100'

UNION ALL

SELECT 
    'Next SGTIN Serial',
    nextval('sgtin_serial_sequence')::TEXT,
    'sgtin_serial_sequence'

ORDER BY metric;

COMMENT ON VIEW v_system_statistics IS 'Provides system-wide statistics for monitoring and reporting';

-- =============================================================================
-- VERIFICATION QUERIES
-- Run these to verify migration success
-- =============================================================================

-- Check sequence exists
SELECT 
    'Sequence Created' AS check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_sequences WHERE sequencename = 'sgtin_serial_sequence'
    ) THEN 'PASS' ELSE 'FAIL' END AS result;

-- Check deleted_at column exists
SELECT 
    'Soft Delete Column' AS check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'serialized_items' AND column_name = 'deleted_at'
    ) THEN 'PASS' ELSE 'FAIL' END AS result;

-- Check UNIQUE constraint
SELECT 
    'UNIQUE Constraint' AS check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'serialized_items' 
        AND constraint_name = 'unique_sgtin_per_tenant'
    ) THEN 'PASS' ELSE 'FAIL' END AS result;

-- Check new status values allowed
SELECT 
    'Status Constraint Updated' AS check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'serialized_items_status_check'
        AND check_clause LIKE '%DELETED%'
    ) THEN 'PASS' ELSE 'FAIL' END AS result;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Output success message
SELECT 
    '✅ Production Improvements Migration Completed' AS status,
    NOW() AS completed_at;
