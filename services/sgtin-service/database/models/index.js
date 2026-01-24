// Model Index - Export all models for SGTIN Service

const db = require('./db');
const BaseModel = require('./BaseModel');
const Product = require('./Product');
const SerializedItem = require('./SerializedItem');
const LifecycleEvent = require('./LifecycleEvent');

/**
 * Get all models for a specific MANDT
 * @param {string} mandt - Multi-tenant client identifier
 * @returns {Object} Object containing all model instances
 */
function getModels(mandt = process.env.MANDT || '100') {
  return {
    Product: new Product(mandt),
    SerializedItem: new SerializedItem(mandt),
    LifecycleEvent: new LifecycleEvent(mandt),
  };
}

module.exports = {
  db,
  BaseModel,
  Product,
  SerializedItem,
  LifecycleEvent,
  getModels
};
