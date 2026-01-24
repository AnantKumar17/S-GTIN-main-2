sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function(Controller) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.Main", {

		onInit: function() {
		},

		onNavigateToPurchaseOrders: function() {
			this.getOwnerComponent().getRouter().navTo("purchaseOrders");
		},

		onNavigateToGoodsReceipt: function() {
			this.getOwnerComponent().getRouter().navTo("goodsReceipt");
		},

		onNavigateToInventory: function() {
			this.getOwnerComponent().getRouter().navTo("inventory");
		},

		onNavigateToPOS: function() {
			this.getOwnerComponent().getRouter().navTo("pos");
		},

		onNavigateToChatbot: function() {
			this.getOwnerComponent().getRouter().navTo("chatbot");
		}

	});

});
