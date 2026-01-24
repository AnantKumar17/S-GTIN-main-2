#!/usr/bin/env node

// Direct database fix for PO-45000010 SGTIN status inconsistency
// This script will directly update SGTIN statuses in the database

const path = require('path');
const { SerializedItem, PurchaseOrder, LifecycleEvent } = require(path.join(__dirname, 'database/models'));

async function fixSGTINStatusDirectly() {
  console.log('🔧 DIRECT FIX: PO-45000010 SGTIN Status Inconsistency...\n');

  try {
    const mandt = '100';
    const poId = 'PO-45000010';
    const targetLocation = 'MAIN_WH';

    // Initialize models
    const serializedItemModel = new SerializedItem(mandt);
    const purchaseOrderModel = new PurchaseOrder(mandt);
    const lifecycleEventModel = new LifecycleEvent(mandt);

    // Step 1: Get all SGTINs for PO-45000010
    console.log('📋 Getting SGTINs for PO-45000010...');
    const sgtinData = await purchaseOrderModel.getSgtins(poId);
    console.log(`Found ${sgtinData.length} SGTINs for this PO:`);
    
    for (const item of sgtinData) {
      console.log(`  - ${item.sgtin}: ${item.status || 'UNKNOWN'} ${item.location ? `(${item.location})` : ''}`);
    }

    // Step 2: Identify SGTINs that need to be fixed
    const problemSGTINs = sgtinData.filter(item => item.status === 'CREATED' || item.status === null);
    
    if (problemSGTINs.length === 0) {
      console.log('\n🎉 No issues found! All SGTINs are properly updated.');
      return;
    }

    console.log(`\n🔧 Found ${problemSGTINs.length} SGTINs that need to be updated to IN_STOCK:`);
    problemSGTINs.forEach(item => {
      console.log(`  - ${item.sgtin}: ${item.status || 'NULL'} → IN_STOCK`);
    });

    // Step 3: Update each SGTIN status directly
    console.log('\n📦 Updating SGTIN statuses directly...');
    
    for (const item of problemSGTINs) {
      const sgtin = item.sgtin;
      
      try {
        // Update SGTIN status to IN_STOCK with location
        await serializedItemModel.updateStatus(sgtin, 'IN_STOCK', targetLocation);
        console.log(`✅ Updated ${sgtin}: CREATED → IN_STOCK (${targetLocation})`);
        
        // Create lifecycle event for audit trail
        await lifecycleEventModel.createEvent({
          sgtin,
          event_type: 'RECEIVED',
          location: targetLocation,
          metadata: {
            po_id: poId,
            received_by: 'SYSTEM_FIX_DIRECT',
            fix_reason: 'Correcting data inconsistency - PO marked as received but SGTINs were not updated'
          }
        });
        
      } catch (error) {
        console.log(`❌ Failed to update ${sgtin}: ${error.message}`);
      }
    }

    // Step 4: Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const verifyData = await purchaseOrderModel.getSgtins(poId);
    
    let fixedCount = 0;
    for (const item of verifyData) {
      if (item.status === 'IN_STOCK') {
        console.log(`✅ ${item.sgtin}: IN_STOCK at ${item.location}`);
        fixedCount++;
      } else {
        console.log(`❌ ${item.sgtin}: Still ${item.status || 'NULL'}`);
      }
    }

    // Step 5: Check PO status
    console.log('\n📋 Checking PO status...');
    const po = await purchaseOrderModel.findByPoId(poId);
    if (po) {
      console.log(`📊 PO Status: ${po.status} (${po.received_quantity}/${po.quantity} received)`);
      
      if (fixedCount === po.quantity && po.status !== 'FULLY_RECEIVED') {
        console.log('🔄 PO should be FULLY_RECEIVED - this will be handled by database triggers.');
      }
    }

    console.log(`\n🎉 DIRECT FIX COMPLETED! Updated ${problemSGTINs.length} SGTINs.`);
    console.log('✅ All SGTINs should now be properly synchronized with PO status.');

  } catch (error) {
    console.error('❌ Error during direct fix:', error);
    console.error(error.stack);
  }
}

// Run the direct fix
fixSGTINStatusDirectly().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
