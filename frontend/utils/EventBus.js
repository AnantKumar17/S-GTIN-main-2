sap.ui.define([], function() {
	"use strict";

	/**
	 * Centralized Event Bus for real-time data synchronization
	 * Automatically refreshes components when data changes
	 */
	var EventBus = {
		
		_listeners: {},

		/**
		 * Subscribe to data change events
		 * @param {string} eventType - Type of data change (e.g., 'purchaseOrders', 'inventory', 'sales')
		 * @param {function} callback - Function to call when event occurs
		 * @param {object} context - Context for the callback (usually 'this' from controller)
		 */
		subscribe: function(eventType, callback, context) {
			if (!this._listeners[eventType]) {
				this._listeners[eventType] = [];
			}
			
			this._listeners[eventType].push({
				callback: callback,
				context: context
			});
		},

		/**
		 * Unsubscribe from data change events
		 * @param {string} eventType - Type of data change
		 * @param {object} context - Context to remove (usually 'this' from controller)
		 */
		unsubscribe: function(eventType, context) {
			if (!this._listeners[eventType]) {
				return;
			}
			
			this._listeners[eventType] = this._listeners[eventType].filter(function(listener) {
				return listener.context !== context;
			});
		},

		/**
		 * Publish a data change event to refresh all subscribed components
		 * @param {string} eventType - Type of data that changed
		 * @param {object} data - Optional data payload
		 */
		publish: function(eventType, data) {
			console.log("EventBus: Publishing event '" + eventType + "'", data);
			
			if (!this._listeners[eventType]) {
				return;
			}
			
			this._listeners[eventType].forEach(function(listener) {
				try {
					if (listener.context) {
						listener.callback.call(listener.context, data);
					} else {
						listener.callback(data);
					}
				} catch (error) {
					console.error("EventBus: Error in event listener for '" + eventType + "':", error);
				}
			});
		},

		/**
		 * Predefined event types for consistency
		 */
		Events: {
			PURCHASE_ORDERS_CHANGED: "purchaseOrders",
			INVENTORY_CHANGED: "inventory", 
			SALES_CHANGED: "sales",
			GOODS_RECEIPT_PROCESSED: "goodsReceipt",
			POS_TRANSACTION_COMPLETED: "posTransaction",
			DASHBOARD_REFRESH_NEEDED: "dashboardRefresh"
		}
	};

	return EventBus;
});
