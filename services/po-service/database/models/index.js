// Model Index - Export all models for PO Service

const db = require('./db');
const BaseModel = require('./BaseModel');
const Product = require('./Product');
const PurchaseOrder = require('./PurchaseOrder');

/**
 * Get all models for a specific MANDT
 * @param {string} mandt - Multi-tenant client identifier
 * @returns {Object} Object containing all model instances
 */
function getModels(mandt = process.env.MANDT || '100') {
  return {
    Product: new Product(mandt),
    PurchaseOrder: new PurchaseOrder(mandt),
  };
}

module.exports = {
  db,
  BaseModel,
  Product,
  PurchaseOrder,
  getModels
};
