#!/usr/bin/env node

// Test script to fix PO-45000010 SGTIN status inconsistency
// This script will process the remaining 2 SGTINs that are stuck in CREATED status

const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function fixPO45000010() {
  console.log('🔧 FIXING PO-45000010 SGTIN Status Inconsistency...\n');

  try {
    // Step 1: Check current status of PO-45000010 SGTINs
    console.log('📊 Checking current status...');
    const inventoryOptions = {
      hostname: 'localhost',
      port: 3003,
      path: '/api/inventory?mandt=100&sgtin=0120001234567891210000100000851',
      method: 'GET',
      headers: {
        'X-API-Key': 'dev-api-key-12345'
      }
    };

    const inventoryResult = await makeRequest(inventoryOptions);
    console.log('Current SGTIN 851 Status:', inventoryResult.body.inventory?.[0]?.status || 'NOT_FOUND');

    // Step 2: Get the SGTINs for PO-45000010
    console.log('\n📋 Getting SGTINs for PO-45000010...');
    const sgtinOptions = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/purchase-orders/PO-45000010/labels?mandt=100',
      method: 'GET',
      headers: {
        'X-API-Key': 'dev-api-key-12345'
      }
    };

    const sgtinResult = await makeRequest(sgtinOptions);
    if (!sgtinResult.body.success) {
      throw new Error('Failed to get SGTINs for PO-45000010');
    }

    const allSGTINs = sgtinResult.body.labels.map(l => l.sgtin);
    console.log('All SGTINs for PO:', allSGTINs);

    // Step 3: Check which SGTINs are still in CREATED status
    console.log('\n🔍 Checking status of all SGTINs...');
    const problemSGTINs = [];
    
    for (const sgtin of allSGTINs) {
      const checkOptions = {
        hostname: 'localhost',
        port: 3003,
        path: `/api/inventory?mandt=100&sgtin=${sgtin}`,
        method: 'GET',
        headers: {
          'X-API-Key': 'dev-api-key-12345'
        }
      };
      
      const checkResult = await makeRequest(checkOptions);
      const item = checkResult.body.inventory?.[0];
      if (item && item.status === 'CREATED') {
        problemSGTINs.push(sgtin);
        console.log(`❌ SGTIN ${sgtin}: CREATED (should be IN_STOCK)`);
      } else if (item && item.status === 'IN_STOCK') {
        console.log(`✅ SGTIN ${sgtin}: IN_STOCK`);
      } else {
        console.log(`⚠️  SGTIN ${sgtin}: ${item?.status || 'NOT_FOUND'}`);
      }
    }

    if (problemSGTINs.length === 0) {
      console.log('\n🎉 No issues found! All SGTINs are properly updated.');
      return;
    }

    console.log(`\n🔧 Found ${problemSGTINs.length} SGTINs with incorrect status. Fixing now...`);

    // Step 4: Process goods receipt for the problem SGTINs
    const goodsReceiptPayload = {
      mandt: '100',
      poId: 'PO-45000010',
      sgtins: problemSGTINs,
      location: 'MAIN_WH',
      receivedBy: 'SYSTEM_FIX'
    };

    const receiptOptions = {
      hostname: 'localhost',
      port: 3003,
      path: '/api/goods-receipts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev-api-key-12345'
      }
    };

    console.log('📦 Processing goods receipt for problematic SGTINs...');
    const receiptResult = await makeRequest(receiptOptions, goodsReceiptPayload);

    if (receiptResult.statusCode === 200 && receiptResult.body.success) {
      console.log('✅ Goods receipt processed successfully!');
      console.log('📄 Result:', receiptResult.body.message);
    } else {
      console.log('❌ Goods receipt failed:', receiptResult.body.error || receiptResult.body);
      return;
    }

    // Step 5: Verify the fix
    console.log('\n🔍 Verifying the fix...');
    for (const sgtin of problemSGTINs) {
      const verifyOptions = {
        hostname: 'localhost',
        port: 3003,
        path: `/api/inventory?mandt=100&sgtin=${sgtin}`,
        method: 'GET',
        headers: {
          'X-API-Key': 'dev-api-key-12345'
        }
      };
      
      const verifyResult = await makeRequest(verifyOptions);
      const item = verifyResult.body.inventory?.[0];
      if (item && item.status === 'IN_STOCK') {
        console.log(`✅ SGTIN ${sgtin}: Fixed! Now IN_STOCK at ${item.location}`);
      } else {
        console.log(`❌ SGTIN ${sgtin}: Still problematic (${item?.status || 'NOT_FOUND'})`);
      }
    }

    // Step 6: Check final PO status
    console.log('\n📋 Checking final PO status...');
    const poOptions = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/purchase-orders?mandt=100&po_id=PO-45000010',
      method: 'GET',
      headers: {
        'X-API-Key': 'dev-api-key-12345'
      }
    };

    const poResult = await makeRequest(poOptions);
    const po = poResult.body.purchaseOrders?.[0];
    if (po) {
      console.log(`📊 PO Status: ${po.status} (${po.received_quantity}/${po.quantity} received)`);
    }

    console.log('\n🎉 FIX COMPLETED! All SGTINs should now be properly updated.');

  } catch (error) {
    console.error('❌ Error during fix:', error.message);
  }
}

// Run the fix
fixPO45000010();
