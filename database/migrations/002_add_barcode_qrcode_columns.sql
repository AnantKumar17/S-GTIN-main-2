-- Migration: Add barcode and QR code columns to serialized_items
-- Date: 2026-01-22
-- Purpose: Store Base64-encoded PNG barcode images for each SGTIN

-- Add barcode column (stores Code 128 barcode as Base64 PNG)
ALTER TABLE serialized_items ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Add qr_code column (stores QR code as Base64 PNG)
ALTER TABLE serialized_items ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Comment for documentation
COMMENT ON COLUMN serialized_items.barcode IS 'Base64-encoded PNG image of Code 128 barcode (~12KB)';
COMMENT ON COLUMN serialized_items.qr_code IS 'Base64-encoded PNG image of QR code (~5-8KB)';

-- Verify migration
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'serialized_items' 
  AND column_name IN ('barcode', 'qr_code');
