sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel",
	"../utils/EventBus",
	"../utils/ApiConfig"
], function (Controller, MessageToast, MessageBox, JSONModel, EventBus, ApiConfig) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.POS", {

		onInit: function () {
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oModel = new JSONModel({
				storeId: "STORE_01",
				scannedSGTIN: "",
				cartItems: [],
				cartSummary: {
					totalItems: 0,
					validItems: 0,
					invalidItems: 0,
					totalAmount: 0
				},
				recentSales: [],
				isScanning: false
			});
			this.getView().setModel(this.oModel);
			this._loadRecentSales();
		},

		onNavBack: function () {
			this.oRouter.navTo("main");
		},

		_loadRecentSales: function () {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.POS_SERVICE) + "/sales?mandt=100";
			console.log("Loading recent sales from:", sServiceUrl);
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				dataType: "json",
				timeout: 8000,
				success: (response) => {
					console.log("Sales API response:", response);
					// Handle the structured response from our API
					const salesData = response && response.sales ? response.sales : (Array.isArray(response) ? response : []);
					this.oModel.setProperty("/recentSales", salesData);
					MessageToast.show("Loaded " + salesData.length + " sales from database");
				},
				error: (xhr, status, error) => {
					console.error("Failed to load sales - Status:", status, "Error:", error, "XHR:", xhr);
					this.oModel.setProperty("/recentSales", []);
					let errorMessage = "Failed to load sales from database";
					if (status === "timeout") {
						errorMessage = "Request timeout. POS service not responding.";
					} else if (xhr.status === 0) {
						errorMessage = "Network error. Cannot reach POS service at " + sServiceUrl;
					} else {
						try {
							const errorResponse = JSON.parse(xhr.responseText);
							errorMessage = errorResponse.error || errorMessage;
						} catch (e) {
							errorMessage = "Backend service error (HTTP " + xhr.status + "). URL: " + sServiceUrl;
						}
					}
					console.error("Error message:", errorMessage);
					MessageBox.error(errorMessage);
				}
			});
		},

		onStartCameraScanning: function () {
			const sStoreId = this.oModel.getProperty("/storeId");
			
			if (!sStoreId) {
				MessageBox.warning("Please enter a store ID");
				return;
			}

			this.oModel.setProperty("/isScanning", true);
			this.byId("posCameraBox").setVisible(true);
			
			MessageToast.show("Camera scanning started (simulated)");
			
			// Simulate QR code scanning after 3 seconds
			setTimeout(() => {
				if (this.oModel.getProperty("/isScanning")) {
					this._simulatePOSScannedSGTIN();
				}
			}, 3000);
		},

	onStopCameraScanning: function () {
		this.oModel.setProperty("/isScanning", false);
		this.byId("posCameraBox").setVisible(false);
		MessageToast.show("Scanning stopped");
	},

	onUploadBarcodeImage: function () {
		// Trigger the hidden file input
		const fileInput = document.getElementById('posBarcodeImageInput');
		if (fileInput) {
			// IMPORTANT: Reset the file input value to allow selecting the same file again
			fileInput.value = '';
			
			// Remove any existing event listener to prevent duplicates
			fileInput.onchange = null;
			
			// Add event listener for file selection
			fileInput.onchange = (event) => {
				const file = event.target.files[0];
				if (file) {
					this._processPOSBarcodeImage(file);
				}
				// Reset after processing
				fileInput.value = '';
			};
			
			fileInput.click();
		}
	},

	_processPOSBarcodeImage: function (file) {
		const reader = new FileReader();
		
		reader.onload = (e) => {
			const base64Image = e.target.result;
			const sStoreId = this.oModel.getProperty("/storeId");
			
			if (!sStoreId) {
				MessageBox.error("Please enter a store ID first");
				return;
			}
			
			// Show busy indicator
			sap.ui.core.BusyIndicator.show(0);
			
			// Call backend to decode QR code image
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.POS_SERVICE) + "/sales/scan-image";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "POST",
				contentType: "application/json",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				data: JSON.stringify({
					mandt: "100",
					barcodeImage: base64Image
				}),
				success: (data) => {
					sap.ui.core.BusyIndicator.hide();
					
					if (data.success && data.canSell) {
						MessageToast.show(`QR Code decoded: ${data.sgtin}`);
						
						// Add item to cart
						const aCartItems = this.oModel.getProperty("/cartItems");
						
						// Check if already in cart
						const bExists = aCartItems.some(item => item.sgtin === data.sgtin);
						if (bExists) {
							MessageBox.warning("Item already in cart");
							return;
						}
						
						const product = data.product || {};
						aCartItems.push({
							sgtin: data.sgtin,
							gtin: data.gtin || "",
							serialNumber: data.serial || "",
							product_name: product.name || "Unknown Product",
							brand: product.brand || "Unknown",
							price: parseFloat(product.price || 0), // FIXED: Ensure price is number
							validation_status: "Valid",
							inventory_item: {
								status: data.currentStatus,
								location: data.location,
								batch: data.batch
							}
						});
						
						this.oModel.setProperty("/cartItems", aCartItems);
						this.oModel.setProperty("/scannedSGTIN", "");
						
						// Update cart summary to enable Process Sale button
						this._updateCartSummary();
						
						MessageBox.success(`Added to cart!\n${product.name || 'Unknown'}\nPrice: €${product.price || 0}\nStatus: ${data.currentStatus}`);
					} else {
						MessageBox.error(data.statusMessage || data.error || "Item cannot be sold");
					}
				},
			error: (xhr, status, error) => {
				sap.ui.core.BusyIndicator.hide();
				let errorMessage = "Failed to decode QR code image";
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

	_simulatePOSScannedSGTIN: function () {
		// For real implementation, this would be replaced with actual camera scanning
		MessageToast.show("Camera scanning simulation - please enter SGTIN manually or use real camera integration");
		this.onStopCameraScanning();
	},		onScanSGTIN: function () {
			const sSGTIN = this.oModel.getProperty("/scannedSGTIN");
			
			if (!sSGTIN) {
				MessageBox.warning("Please enter or scan an SGTIN");
				return;
			}

			// Basic SGTIN format validation
			if (!sSGTIN.match(/^01\d{14}21\d+$/)) {
				MessageBox.error("Invalid SGTIN format. Expected: 01{14-digit GTIN}21{serial}");
				return;
			}

			// Check if already in cart
			const aCartItems = this.oModel.getProperty("/cartItems");
			const bExists = aCartItems.some(item => item.sgtin === sSGTIN);

			if (bExists) {
				MessageToast.show("Item already in cart");
				this.oModel.setProperty("/scannedSGTIN", "");
				return;
			}

			this._validateSGTINForSale(sSGTIN);
		},

		_validateSGTINForSale: function (sSGTIN) {
			const sServiceUrl = `${ApiConfig.getServiceUrl(ApiConfig.SGTIN_SERVICE)}/sgtin/validate/${sSGTIN}?mandt=100`;
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					console.log("SGTIN validation response:", data);
					if (data.valid) {
						// Check if item is available for sale (IN_STOCK status)
						this._checkItemAvailability(sSGTIN, data);
					} else {
						this._addInvalidItemToCart(sSGTIN, "Invalid SGTIN", data.error || data.message || "Not found in system");
					}
				},
				error: (xhr, status, error) => {
					console.error("SGTIN validation failed:", xhr, status, error);
					this._addInvalidItemToCart(sSGTIN, "Validation Failed", "Could not validate SGTIN - service unavailable");
				}
			});
		},

		_checkItemAvailability: function (sSGTIN, oValidationData) {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "?mandt=100";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					console.log("Inventory API response:", data);
					const inventoryItems = data && data.inventory ? data.inventory : (Array.isArray(data) ? data : []);
					const oItem = inventoryItems.find(item => item.sgtin === sSGTIN);
					
					if (oItem && oItem.status === "IN_STOCK") {
						this._addValidItemToCart(sSGTIN, oItem, oValidationData);
					} else if (oItem && oItem.status === "SOLD") {
						this._addInvalidItemToCart(sSGTIN, "Already Sold", "This item has already been sold");
					} else {
						this._addInvalidItemToCart(sSGTIN, "Not Available", "Item not found in inventory or not available for sale");
					}
				},
				error: (xhr, status, error) => {
					console.error("Inventory check failed:", xhr, status, error);
					this._addInvalidItemToCart(sSGTIN, "Inventory Check Failed", "Could not check inventory - service unavailable");
				}
			});
		},

		_addValidItemToCart: function (sSGTIN, oInventoryItem, oValidationData) {
			const oCartItem = {
				sgtin: sSGTIN,
				gtin: oInventoryItem.gtin,
				product_name: oInventoryItem.product_name,
				brand: oInventoryItem.brand || "Unknown",
				price: parseFloat(this._getProductPrice(oInventoryItem.gtin)), // FIXED: Ensure price is number
				validation_status: "Valid",
				inventory_item: oInventoryItem
			};

			const aCartItems = this.oModel.getProperty("/cartItems");
			aCartItems.push(oCartItem);
			this.oModel.setProperty("/cartItems", aCartItems);
			
			this._updateCartSummary();
			this.oModel.setProperty("/scannedSGTIN", "");
			
			MessageToast.show("Item added to cart: " + oCartItem.product_name);
		},

		_addInvalidItemToCart: function (sSGTIN, sStatus, sReason) {
			// CHANGED: Don't add invalid items to cart - just show warning
			// This prevents users from adding sold/invalid items to cart
			this.oModel.setProperty("/scannedSGTIN", "");
			
			MessageBox.warning(
				`Cannot add item to cart.\n\n` +
				`SGTIN: ${sSGTIN}\n` +
				`Status: ${sStatus}\n` +
				`Reason: ${sReason}`,
				{
					title: "Item Not Available for Sale"
				}
			);
		},

		_getProductPrice: function (sGTIN) {
			// Simple product catalog based on GTIN
			// In a real implementation, this would fetch from a product catalog service
			const productCatalog = {
				"20001234567890": 2.99, // Premium Dark Chocolate Bar 100g
				"20001234567891": 12.99  // Milk Chocolate Truffles Box 200g
			};

			return productCatalog[sGTIN] || 9.99; // Default price if not found in catalog
		},

		_updateCartSummary: function () {
			const aCartItems = this.oModel.getProperty("/cartItems");
			const oSummary = {
				totalItems: aCartItems.length,
				validItems: aCartItems.filter(item => item.validation_status === "Valid").length,
				invalidItems: aCartItems.filter(item => item.validation_status !== "Valid").length,
				totalAmount: aCartItems
					.filter(item => item.validation_status === "Valid")
					.reduce((sum, item) => sum + item.price, 0)
			};

			this.oModel.setProperty("/cartSummary", oSummary);
		},

		onRemoveCartItem: function (oEvent) {
			const oItem = oEvent.getParameter("listItem");
			const iIndex = oEvent.getSource().indexOfItem(oItem);
			
			const aCartItems = this.oModel.getProperty("/cartItems");
			aCartItems.splice(iIndex, 1);
			this.oModel.setProperty("/cartItems", aCartItems);
			
			this._updateCartSummary();
			MessageToast.show("Item removed from cart");
		},

		onClearCart: function () {
			MessageBox.confirm("Clear all items from cart?", {
				onClose: (sAction) => {
					if (sAction === MessageBox.Action.OK) {
						this.oModel.setProperty("/cartItems", []);
						this._updateCartSummary();
						MessageToast.show("Cart cleared");
					}
				}
			});
		},

		onProcessSale: function () {
			const aCartItems = this.oModel.getProperty("/cartItems");
			const sStoreId = this.oModel.getProperty("/storeId");
			const oSummary = this.oModel.getProperty("/cartSummary");

			const aValidItems = aCartItems.filter(item => item.validation_status === "Valid");

			if (aValidItems.length === 0) {
				MessageBox.warning("No valid items to process");
				return;
			}

			const oSaleData = {
				storeId: sStoreId,
				sgtins: aValidItems.map(item => item.sgtin),
				mandt: "100"
			};

			MessageBox.confirm(
				`Process sale for ${aValidItems.length} items?\nTotal: €${oSummary.totalAmount}`, 
				{
					onClose: (sAction) => {
						if (sAction === MessageBox.Action.OK) {
							this._processSale(oSaleData);
						}
					}
				}
			);
		},

		_processSale: function (oSaleData) {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.POS_SERVICE) + "/sales";

			jQuery.ajax({
				url: sServiceUrl,
				type: "POST",
				contentType: "application/json",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				data: JSON.stringify(oSaleData),
				success: (data) => {
					MessageToast.show(`Sale processed successfully: ${data.sale_id}`);
					
					// Clear cart and refresh data
					this.oModel.setProperty("/cartItems", []);
					this._updateCartSummary();
					this.onStopCameraScanning();
					this._loadRecentSales();
					
					// IMPORTANT: Fire event to notify Main dashboard to auto-refresh
					EventBus.publish(EventBus.Events.POS_TRANSACTION_COMPLETED, {
						saleId: data.sale_id,
						totalAmount: data.total_amount || oSaleData.totalAmount,
						itemCount: oSaleData.sgtins.length,
						timestamp: new Date()
					});
				},
				error: (xhr, status, error) => {
					console.error("Failed to process sale:", xhr, status, error);
					let errorMessage = "Failed to process sale";
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
					} catch (e) {
						errorMessage = "POS service unavailable. Please ensure POS service is running on port 3004.";
					}
					MessageBox.error(errorMessage);
				}
			});
		},

		onRefreshSales: function () {
			this._loadRecentSales();
			MessageToast.show("Sales data refreshed");
		},

		onViewSaleDetails: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			const sSaleId = oContext.getProperty("sale_id");
			
			// Load sale details from database
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.POS_SERVICE) + "/sales/" + encodeURIComponent(sSaleId) + "?mandt=100";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					// Extract the sale data from the API response structure
					const saleData = data && data.sale ? data.sale : data;
					console.log("Sale data being set to model:", saleData);
					console.log("Items array:", saleData.items);
					this.getView().setModel(new JSONModel(saleData), "saleDetails");
					this.byId("saleDetailsDialog").open();
				},
				error: (xhr, status, error) => {
					let errorMessage = "Failed to load sale details from database";
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
					} catch (e) {
						errorMessage = "Backend service unavailable. Please ensure POS service is running on port 3004.";
					}
					MessageBox.error(errorMessage);
				}
			});
		},

		onCloseSaleDetailsDialog: function () {
			this.byId("saleDetailsDialog").close();
		},

		// Formatters
		formatValidationStatus: function (sStatus) {
			switch (sStatus) {
				case "Valid": return "Success";
				case "Invalid SGTIN": return "Error";
				case "Already Sold": return "Error";
				case "Not Available": return "Warning";
				case "Validation Failed": return "Error";
				default: return "Warning";
			}
		},

		formatDateTime: function (sDate) {
			if (!sDate) return "";
			const oDate = new Date(sDate);
			return oDate.toLocaleDateString() + " " + oDate.toLocaleTimeString();
		}

	});
});
