// Model Index - Export all models

const db = require('./db');
const BaseModel = require('./BaseModel');
const Product = require('./Product');
const SerializedItem = require('./SerializedItem');
const PurchaseOrder = require('./PurchaseOrder');
const Sale = require('./Sale');
const LifecycleEvent = require('./LifecycleEvent');
const GoodsReceipt = require('./GoodsReceipt');

/**
 * Get all models for a specific MANDT
 * @param {string} mandt - Multi-tenant client identifier
 * @returns {Object} Object containing all model instances
 */
function getModels(mandt = process.env.MANDT || '100') {
  return {
    Product: new Product(mandt),
    SerializedItem: new SerializedItem(mandt),
    PurchaseOrder: new PurchaseOrder(mandt),
    Sale: new Sale(mandt),
    LifecycleEvent: new LifecycleEvent(mandt),
    GoodsReceipt: new GoodsReceipt(mandt),
  };
}

module.exports = {
  db,
  BaseModel,
  Product,
  SerializedItem,
  PurchaseOrder,
  Sale,
  LifecycleEvent,
  GoodsReceipt,
  getModels
};
