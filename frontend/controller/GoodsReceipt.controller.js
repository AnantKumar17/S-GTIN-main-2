sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel",
	"../utils/EventBus"
], function (Controller, MessageToast, MessageBox, JSONModel, EventBus) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.GoodsReceipt", {

		onInit: function () {
			// Subscribe to data change events for auto-refresh
			this._subscribeToEvents();
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oModel = new JSONModel({
				purchaseOrders: [],
				goodsReceipts: [],
				scannedItems: [],
				selectedPOId: "",
				warehouse: "MAIN_WH",
				currentSGTIN: "",
				isScanning: false
			});
			this.getView().setModel(this.oModel);
			this._loadPurchaseOrders();
			this._loadGoodsReceipts();
		},

		onExit: function() {
			// Clean up event subscriptions when controller is destroyed
			this._unsubscribeFromEvents();
		},

		_subscribeToEvents: function() {
			// Subscribe to purchase order changes for auto-refresh
			EventBus.subscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this._onPurchaseOrdersChanged, this);
		},

		_unsubscribeFromEvents: function() {
			// Unsubscribe from all events to prevent memory leaks
			EventBus.unsubscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this);
		},

		_onPurchaseOrdersChanged: function(data) {
			// Auto-refresh purchase orders when data changes
			console.log("GoodsReceipt controller: Purchase orders changed, refreshing...", data);
			this._loadPurchaseOrders();
		},

		onNavBack: function () {
			this.oRouter.navTo("main");
		},

		_loadPurchaseOrders: function () {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.PO_SERVICE) + "/purchase-orders?mandt=100";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					const purchaseOrders = data && data.purchaseOrders ? data.purchaseOrders : [];
					this.oModel.setProperty("/purchaseOrders", purchaseOrders);
					MessageToast.show("Loaded " + purchaseOrders.length + " purchase orders from database");
				},
				error: (xhr, status, error) => {
					this.oModel.setProperty("/purchaseOrders", []);
					let errorMessage = "Failed to load purchase orders from database";
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
					} catch (e) {
						errorMessage = "Backend service unavailable. Please ensure PO service is running on port 3002.";
					}
					MessageBox.error(errorMessage);
				}
			});
		},

		_loadGoodsReceipts: function () {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "/goods-receipts?mandt=100";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					const goodsReceipts = data && data.receipts ? data.receipts : [];
					this.oModel.setProperty("/goodsReceipts", goodsReceipts);
					MessageToast.show("Loaded " + goodsReceipts.length + " goods receipts");
				},
				error: (xhr, status, error) => {
					this.oModel.setProperty("/goodsReceipts", []);
					// Don't show error popup for goods receipts since it might not be implemented yet
					console.log("Failed to load goods receipts - this might not be implemented yet");
				}
			});
		},

		onStartScanning: function () {
			const sPOId = this.oModel.getProperty("/selectedPOId");
			const sWarehouse = this.oModel.getProperty("/warehouse");

			if (!sPOId) {
				MessageBox.warning("Please select a Purchase Order");
				return;
			}

			if (!sWarehouse) {
				MessageBox.warning("Please enter a warehouse location");
				return;
			}

			this.oModel.setProperty("/isScanning", true);
			this.byId("cameraBox").setVisible(true);
			this.byId("manualEntryBox").setVisible(false);
			
			MessageToast.show("Camera scanning started (simulated)");
			
			// Simulate QR code scanning after 3 seconds
			setTimeout(() => {
				if (this.oModel.getProperty("/isScanning")) {
					this._simulateScannedSGTIN();
				}
			}, 3000);
		},

	onStopScanning: function () {
		this.oModel.setProperty("/isScanning", false);
		this.byId("cameraBox").setVisible(false);
		MessageToast.show("Scanning stopped");
	},

	onUploadBarcodeImage: function () {
		// Trigger the hidden file input
		const fileInput = document.getElementById('barcodeImageInput');
		if (fileInput) {
			// IMPORTANT: Reset the file input value to allow selecting the same file again
			// Without this, the onchange event won't fire if the same file is selected
			fileInput.value = '';
			
			// Remove any existing event listener to prevent duplicates
			fileInput.onchange = null;
			
			// Add event listener for file selection
			fileInput.onchange = (event) => {
				const file = event.target.files[0];
				if (file) {
					this._processBarcodeImage(file);
				}
				// Reset the input value after processing to allow re-selecting the same file
				fileInput.value = '';
			};
			
			fileInput.click();
		}
	},

	_processBarcodeImage: function (file) {
		const reader = new FileReader();
		
		reader.onload = (e) => {
			const base64Image = e.target.result;
			const sPOId = this.oModel.getProperty("/selectedPOId");
			
			if (!sPOId) {
				MessageBox.error("Please select a Purchase Order first");
				return;
			}
			
		// Show busy indicator
		sap.ui.core.BusyIndicator.show(0);
		
		// Call backend to decode QR code image
		const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "/goods-receipts/scan-image";			jQuery.ajax({
				url: sServiceUrl,
				type: "POST",
				contentType: "application/json",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				data: JSON.stringify({
					mandt: "100",
					poId: sPOId,
					barcodeImage: base64Image
				}),
				success: (data) => {
					sap.ui.core.BusyIndicator.hide();
					
				if (data.success) {
					MessageToast.show(`QR Code decoded: ${data.sgtin}`);
					
					// Check if already scanned
					const aScannedItems = this.oModel.getProperty("/scannedItems");
					const bExists = aScannedItems.some(item => item.sgtin === data.sgtin);
					if (bExists) {
						MessageBox.warning("SGTIN already scanned");
						return;
					}
					
					// BUSINESS LOGIC: Check if item is already received (IN_STOCK, SOLD, etc.)
					const actualStatus = data.currentStatus || "CREATED";
					const nonReceivableStatuses = ['IN_STOCK', 'SOLD', 'IN_TRANSIT', 'RETURNED'];
					
					if (nonReceivableStatuses.includes(actualStatus)) {
						MessageBox.warning(
							`Cannot add SGTIN ${data.sgtin}.\n\n` +
							`Current Status: ${actualStatus}\n` +
							`Location: ${data.location || 'Unknown'}\n\n` +
							`This item has already been received into inventory and cannot be received again.`,
							{
								title: "Item Already Received"
							}
						);
						return;
					}
					
					// Item is eligible for goods receipt - add to list
					aScannedItems.push({
						sgtin: data.sgtin,
						gtin: data.gtin,
						serial: data.serial,
						status: actualStatus,
						location: data.location || "",
						barcodeType: data.barcodeType || "IMAGE"
					});
					
					this.oModel.setProperty("/scannedItems", aScannedItems);
					MessageBox.success(`Successfully scanned: ${data.sgtin}\nStatus: ${actualStatus}\nType: ${data.barcodeType}`);
				} else {
					MessageBox.error(data.error || "Failed to decode barcode");
				}
				},
				error: (xhr, status, error) => {
					sap.ui.core.BusyIndicator.hide();
					let errorMessage = "Failed to decode barcode image";
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
					} catch (e) {
						errorMessage = "Backend service unavailable";
					}
					MessageBox.error(errorMessage);
				}
			});
		};
		
		reader.readAsDataURL(file);
	},

	onManualEntry: function () {
		this.byId("manualEntryBox").setVisible(true);
		this.byId("cameraBox").setVisible(false);
		this.oModel.setProperty("/isScanning", false);
	},		onAddSGTIN: function () {
			const sSGTIN = this.oModel.getProperty("/currentSGTIN");
			
			if (!sSGTIN) {
				MessageBox.warning("Please enter an SGTIN");
				return;
			}

			this._validateAndAddSGTIN(sSGTIN);
			this.oModel.setProperty("/currentSGTIN", "");
		},

		_simulateScannedSGTIN: function () {
			// For real implementation, this would be replaced with actual camera scanning
			MessageToast.show("Camera scanning simulation - please use manual entry or real camera integration");
			this.onStopScanning();
		},

		_validateAndAddSGTIN: function (sSGTIN) {
			// Basic SGTIN format validation
			if (!sSGTIN.match(/^01\d{14}21\d+$/)) {
				MessageBox.error("Invalid SGTIN format. Expected: 01{14-digit GTIN}21{serial}");
				return;
			}

			// Extract GTIN and serial
			const sGTIN = sSGTIN.substring(2, 16);
			const sSerial = sSGTIN.substring(18);

			// Check if already scanned
			const aScannedItems = this.oModel.getProperty("/scannedItems");
			const bExists = aScannedItems.some(item => item.sgtin === sSGTIN);

			if (bExists) {
				MessageBox.warning("SGTIN already scanned");
				return;
			}

			// Get selected PO ID
			const sPOId = this.oModel.getProperty("/selectedPOId");
			if (!sPOId) {
				MessageBox.error("Please select a Purchase Order first");
				return;
			}

			// Validate SGTIN against selected Purchase Order
			this._validateSGTINAgainstPO(sSGTIN, sGTIN, sSerial, sPOId);
		},

		_validateSGTINAgainstPO: function (sSGTIN, sGTIN, sSerial, sPOId) {
			// First get the valid SGTINs for this Purchase Order
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.PO_SERVICE) + `/purchase-orders/${sPOId}/labels?mandt=100`;
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					if (data.success && data.labels) {
						// Check if the SGTIN is in the list of valid SGTINs for this PO
						const validSGTINs = data.labels.map(label => label.sgtin);
						const isValidForPO = validSGTINs.includes(sSGTIN);
						
						if (!isValidForPO) {
							// Show popup for invalid SGTIN
							MessageBox.error(
								`Invalid SGTIN for Purchase Order ${sPOId}.\n\n` +
								`This SGTIN does not belong to the selected Purchase Order.\n` +
								`Please scan a valid SGTIN or select the correct Purchase Order.`,
								{
									title: "Invalid SGTIN"
								}
							);
							return;
						}
						
						// SGTIN is valid for this PO, now validate it against SGTIN service
						this._validateSGTINWithBackend(sSGTIN, sGTIN, sSerial);
					} else {
						MessageBox.error("Failed to retrieve valid SGTINs for this Purchase Order");
					}
				},
				error: (xhr, status, error) => {
					let errorMessage = "Failed to validate SGTIN against Purchase Order";
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
					} catch (e) {
						errorMessage = "PO service unavailable. Please ensure PO service is running on port 3002.";
					}
					MessageBox.error(errorMessage);
				}
			});
		},

		_validateSGTINWithBackend: function (sSGTIN, sGTIN, sSerial) {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.SGTIN_SERVICE) + `/sgtin/validate/${sSGTIN}?mandt=100`;
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					// Get actual database status instead of just "Valid"
					const actualStatus = data.status || (data.valid ? "CREATED" : "Unverified");
					
					// BUSINESS LOGIC: Check if item is already received (IN_STOCK, SOLD, etc.)
					const nonReceivableStatuses = ['IN_STOCK', 'SOLD', 'IN_TRANSIT', 'RETURNED'];
					if (nonReceivableStatuses.includes(actualStatus)) {
						MessageBox.warning(
							`Cannot add SGTIN ${sSGTIN}.\n\n` +
							`Current Status: ${actualStatus}\n` +
							`Location: ${data.location || 'Unknown'}\n\n` +
							`This item has already been received into inventory and cannot be received again.`,
							{
								title: "Item Already Received"
							}
						);
						return;
					}
					
					const oItem = {
						sgtin: sSGTIN,
						gtin: sGTIN,
						serial: sSerial,
						status: actualStatus,
						location: data.location || "",
						product_name: data.product_name || "Test Product"
					};
					
					const aScannedItems = this.oModel.getProperty("/scannedItems");
					aScannedItems.push(oItem);
					this.oModel.setProperty("/scannedItems", aScannedItems);
					
					if (data.valid) {
						MessageToast.show(`SGTIN added (Status: ${actualStatus})`);
					} else {
						MessageToast.show("SGTIN added as unverified (for testing)");
					}
				},
				error: (xhr, status, error) => {
					// For testing purposes, add the SGTIN even if validation fails
					const oItem = {
						sgtin: sSGTIN,
						gtin: sGTIN,
						serial: sSerial,
						status: "Unverified",
						product_name: "Test Product"
					};
					
					const aScannedItems = this.oModel.getProperty("/scannedItems");
					aScannedItems.push(oItem);
					this.oModel.setProperty("/scannedItems", aScannedItems);
					
					MessageToast.show("SGTIN added as unverified (for testing)");
				}
			});
		},

		onRemoveScannedItem: function (oEvent) {
			const oItem = oEvent.getParameter("listItem");
			const iIndex = oEvent.getSource().indexOfItem(oItem);
			
			const aScannedItems = this.oModel.getProperty("/scannedItems");
			aScannedItems.splice(iIndex, 1);
			this.oModel.setProperty("/scannedItems", aScannedItems);
			
			MessageToast.show("Item removed");
		},

		onClearAll: function () {
			MessageBox.confirm("Clear all scanned items?", {
				onClose: (sAction) => {
					if (sAction === MessageBox.Action.OK) {
						this.oModel.setProperty("/scannedItems", []);
						MessageToast.show("All items cleared");
					}
				}
			});
		},

		onProcessReceipt: function () {
			const aScannedItems = this.oModel.getProperty("/scannedItems");
			const sPOId = this.oModel.getProperty("/selectedPOId");
			const sWarehouse = this.oModel.getProperty("/warehouse");

			if (aScannedItems.length === 0) {
				MessageBox.warning("No items to process");
				return;
			}

			const oPayload = {
				poId: sPOId,
				location: sWarehouse,
				sgtins: aScannedItems.map(item => item.sgtin),
				mandt: "100"
			};

			MessageBox.confirm(`Process goods receipt for ${aScannedItems.length} items?`, {
				onClose: (sAction) => {
					if (sAction === MessageBox.Action.OK) {
						this._processGoodsReceipt(oPayload);
					}
				}
			});
		},

		_processGoodsReceipt: function (oPayload) {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "/goods-receipts";

			jQuery.ajax({
				url: sServiceUrl,
				type: "POST",
				contentType: "application/json",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				data: JSON.stringify(oPayload),
				success: (data) => {
					MessageToast.show(`Goods receipt processed: ${data.gr_id || 'GR-' + Date.now()}`);
					
					// Clear scanned items and refresh data
					this.oModel.setProperty("/scannedItems", []);
					this.onStopScanning();
					this._loadGoodsReceipts();
					
					// Publish events to notify other components about the data changes
					EventBus.publish(EventBus.Events.GOODS_RECEIPT_PROCESSED, {
						poId: oPayload.poId,
						sgtins: oPayload.sgtins,
						location: oPayload.location,
						grId: data.gr_id
					});
					EventBus.publish(EventBus.Events.INVENTORY_CHANGED, { source: "goods_receipt" });
					EventBus.publish(EventBus.Events.PURCHASE_ORDERS_CHANGED, { source: "goods_receipt" });
					
					// Explicitly trigger dashboard refresh
					EventBus.publish(EventBus.Events.DASHBOARD_REFRESH_NEEDED, {
						source: "goods_receipt",
						action: "processed"
					});
				},
				error: (xhr, status, error) => {
					let errorMessage = "Failed to process goods receipt";
					let errorDetails = "";
					
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
						
						// Handle duplicate goods receipt error specifically
						if (xhr.status === 409 && errorResponse.alreadyReceived) {
							errorMessage = "Duplicate Goods Receipt Detected";
							const duplicateDetails = errorResponse.alreadyReceived.map(item => 
								`• ${item.sgtin} (Status: ${item.currentStatus}, Location: ${item.location})`
							).join('\n');
							
							errorDetails = `The following SGTIN(s) have already been received:\n\n${duplicateDetails}\n\nGoods receipt cannot be processed for items that have already been received.`;
							
							MessageBox.error(errorDetails, {
								title: errorMessage,
								styleClass: "sapUiSizeCompact"
							});
							return;
						}
					} catch (e) {
						errorMessage = "Backend service unavailable. Please ensure inventory service is running on port 3003.";
					}
					
					MessageBox.error(errorMessage);
				}
			});
		},

		// Formatters
		formatItemStatus: function (sStatus) {
			switch (sStatus) {
				case "CREATED": return "Success";  // Ready to receive
				case "Valid": return "Success";    // Legacy - ready to receive
				case "IN_STOCK": return "Error";   // Already received - cannot receive again
				case "SOLD": return "Error";       // Already sold - cannot receive
				case "IN_TRANSIT": return "Warning";
				case "RETURNED": return "Warning";
				case "Unverified": return "Warning";
				case "Invalid": return "Error";
				default: return "None";
			}
		},

		formatDate: function (sDate) {
			if (!sDate) return "";
			const oDate = new Date(sDate);
			return oDate.toLocaleDateString() + " " + oDate.toLocaleTimeString();
		}

	});
});
