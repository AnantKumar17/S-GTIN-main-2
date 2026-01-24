#!/usr/bin/env node

/**
 * Fix Purchase Order Quantity Mismatch Issue
 * 
 * Problem: PO-45000004 shows quantity=2 but has 4 SGTINs generated
 * Solution: Update PO quantity to match actual SGTIN count
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sgtin_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function fixQuantityMismatch() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Analyzing quantity mismatch issue...\n');

    // Check current PO data
    const poQuery = `
      SELECT po_id, quantity, received_quantity, status, created_at
      FROM purchase_orders 
      WHERE mandt = '100' AND po_id = 'PO-45000004'
    `;
    
    const poResult = await client.query(poQuery);
    if (poResult.rows.length === 0) {
      console.log('❌ Purchase Order PO-45000004 not found');
      return;
    }

    const po = poResult.rows[0];
    console.log('📋 Current PO Data:');
    console.log(`   PO ID: ${po.po_id}`);
    console.log(`   Quantity: ${po.quantity}`);
    console.log(`   Received: ${po.received_quantity}`);
    console.log(`   Status: ${po.status}`);
    console.log('');

    // Check actual SGTIN count
    const sgtinQuery = `
      SELECT COUNT(*) as sgtin_count
      FROM po_sgtin_mapping 
      WHERE mandt = '100' AND po_id = 'PO-45000004'
    `;
    
    const sgtinResult = await client.query(sgtinQuery);
    const actualSgtinCount = parseInt(sgtinResult.rows[0].sgtin_count);
    
    console.log(`🏷️  Actual SGTIN Count: ${actualSgtinCount}`);
    console.log(`📦 PO Quantity: ${po.quantity}`);
    console.log('');

    if (actualSgtinCount === po.quantity) {
      console.log('✅ No mismatch found - quantities already match!');
      return;
    }

    console.log(`❗ MISMATCH DETECTED: PO quantity (${po.quantity}) ≠ SGTIN count (${actualSgtinCount})`);
    console.log('');

    // List the SGTINs for reference
    const sgtinListQuery = `
      SELECT sgtin 
      FROM po_sgtin_mapping 
      WHERE mandt = '100' AND po_id = 'PO-45000004'
      ORDER BY sgtin
    `;
    
    const sgtinListResult = await client.query(sgtinListQuery);
    console.log('🏷️  SGTINs associated with this PO:');
    sgtinListResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.sgtin}`);
    });
    console.log('');

    // Update PO quantity to match SGTIN count
    console.log('🔧 Fixing quantity mismatch...');
    
    const updateQuery = `
      UPDATE purchase_orders 
      SET quantity = $1, 
          updated_at = CURRENT_TIMESTAMP
      WHERE mandt = '100' AND po_id = 'PO-45000004'
      RETURNING po_id, quantity, received_quantity, status
    `;
    
    const updateResult = await client.query(updateQuery, [actualSgtinCount]);
    
    if (updateResult.rows.length > 0) {
      const updatedPo = updateResult.rows[0];
      console.log('✅ Successfully updated PO quantity!');
      console.log('');
      console.log('📋 Updated PO Data:');
      console.log(`   PO ID: ${updatedPo.po_id}`);
      console.log(`   Quantity: ${updatedPo.quantity} (was ${po.quantity})`);
      console.log(`   Received: ${updatedPo.received_quantity}`);
      console.log(`   Status: ${updatedPo.status}`);
      console.log('');
      console.log('🎉 Quantity mismatch issue resolved!');
      console.log('   - PO quantity now matches actual SGTIN count');
      console.log('   - Data consistency restored');
      console.log('   - Business logic alignment achieved');
    } else {
      console.log('❌ Failed to update PO quantity');
    }

  } catch (error) {
    console.error('❌ Error fixing quantity mismatch:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 PO Quantity Mismatch Fix Script');
    console.log('=====================================\n');
    
    await fixQuantityMismatch();
    
    console.log('\n🏁 Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fixQuantityMismatch };
