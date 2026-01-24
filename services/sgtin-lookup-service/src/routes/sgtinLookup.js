const express = require('express');
const router = express.Router();
const sgtinLookupController = require('../controllers/sgtinLookupController');

// New GTIN Passport routes (cascading filter approach)
router.get('/gtin-passport/gtins', sgtinLookupController.getGtins);
router.get('/gtin-passport/purchase-orders/:gtin', sgtinLookupController.getPurchaseOrdersByGtin);
router.get('/gtin-passport/sgtins/:poId', sgtinLookupController.getSgtinsByPurchaseOrder);
router.get('/gtin-passport/:sgtin', sgtinLookupController.getPassport);

// Legacy SGTIN Lookup routes (kept for backward compatibility)
router.get('/sgtin-lookup/:sgtin', sgtinLookupController.lookupSGTIN);

module.exports = router;