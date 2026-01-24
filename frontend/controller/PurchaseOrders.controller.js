sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"../utils/EventBus",
	"../utils/ApiConfig"
], function (Controller, JSONModel, MessageToast, MessageBox, EventBus, ApiConfig) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.PurchaseOrders", {

		onInit: function () {
			// Subscribe to data change events for auto-refresh
			this._subscribeToEvents();
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oModel = new JSONModel({
				products: [],
				purchaseOrders: [],
				allPurchaseOrders: [], // Keep original unfiltered list for search
				selectedProductGTIN: "",
				quantity: 1,
				showSGTINPreview: false,
				previewSGTINs: [],
				canCreatePO: false,
				searchQuery: "",
				sortProperty: "",
				sortDescending: false
			});
			this.getView().setModel(this.oModel);
			this._loadProductsThenPOs();
		},

		onExit: function() {
			// Clean up event subscriptions when controller is destroyed
			this._unsubscribeFromEvents();
		},

		_subscribeToEvents: function() {
			// Subscribe to purchase order and goods receipt events
			EventBus.subscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this._onPurchaseOrdersChanged, this);
			EventBus.subscribe(EventBus.Events.GOODS_RECEIPT_PROCESSED, this._onPurchaseOrdersChanged, this);
		},

		_unsubscribeFromEvents: function() {
			// Unsubscribe from all events to prevent memory leaks
			EventBus.unsubscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this);
			EventBus.unsubscribe(EventBus.Events.GOODS_RECEIPT_PROCESSED, this);
		},

		_onPurchaseOrdersChanged: function(data) {
			// Auto-refresh purchase orders when data changes
			console.log("PurchaseOrders controller: Data changed, refreshing...", data);
			this._loadPurchaseOrders();
		},

		onNavBack: function () {
			this.oRouter.navTo("main");
		},

		_loadProductsThenPOs: function () {
			// Load products from products master data table (not inventory/serialized_items)
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "/inventory/products?mandt=100";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					if (data && data.products && data.products.length > 0) {
						// Map products from master data table
						const products = data.products.map(product => ({
							gtin: product.gtin,
							name: product.name,
							brand: product.brand || 'Unknown',
							category: product.category || 'General',
							price: product.price
						}));
						
						this.oModel.setProperty("/products", products);
						MessageToast.show("Loaded " + products.length + " products from database");
						
						// Now load purchase orders with product data available
						this._loadPurchaseOrders();
					} else {
						this.oModel.setProperty("/products", []);
						MessageToast.show("No products found in database");
						
						// Still load purchase orders even if no products found
						this._loadPurchaseOrders();
					}
				},
				error: (xhr, status, error) => {
					this.oModel.setProperty("/products", []);
					let errorMessage = "Failed to load products from database";
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
					} catch (e) {
						errorMessage = "Backend service unavailable. Please ensure inventory service is running on port 3003.";
					}
					MessageBox.error(errorMessage);
					
					// Still try to load purchase orders even if products failed
					this._loadPurchaseOrders();
				}
			});
		},

		_loadProducts: function () {
			// Load products from products master data table (not inventory/serialized_items)
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "/inventory/products?mandt=100";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					if (data && data.products && data.products.length > 0) {
						// Map products from master data table
						const products = data.products.map(product => ({
							gtin: product.gtin,
							name: product.name,
							brand: product.brand || 'Unknown',
							category: product.category || 'General',
							price: product.price
						}));
						
						this.oModel.setProperty("/products", products);
						MessageToast.show("Loaded " + products.length + " products from database");
					} else {
						this.oModel.setProperty("/products", []);
						MessageToast.show("No products found in database");
					}
				},
				error: (xhr, status, error) => {
					this.oModel.setProperty("/products", []);
					let errorMessage = "Failed to load products from database";
					try {
						const errorResponse = JSON.parse(xhr.responseText);
						errorMessage = errorResponse.error || errorMessage;
					} catch (e) {
						errorMessage = "Backend service unavailable. Please ensure inventory service is running on port 3003.";
					}
					MessageBox.error(errorMessage);
				}
			});
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
					
					// Enrich purchase orders with product information
					const products = this.oModel.getProperty("/products") || [];
					const enrichedPurchaseOrders = purchaseOrders.map(po => {
						// Find matching product by GTIN
						const matchingProduct = products.find(product => product.gtin === po.gtin);
						
						// Add product information to purchase order
						return {
							...po,
							product_name: matchingProduct ? matchingProduct.name : po.gtin,
							product_brand: matchingProduct ? matchingProduct.brand : 'Unknown',
							product_category: matchingProduct ? matchingProduct.category : 'General'
						};
					});
					
					// Store both filtered and unfiltered lists for search functionality
					this.oModel.setProperty("/purchaseOrders", enrichedPurchaseOrders);
					this.oModel.setProperty("/allPurchaseOrders", enrichedPurchaseOrders);
					MessageToast.show("Loaded " + purchaseOrders.length + " purchase orders from database");
					
					// Apply current search filter if any
					const currentSearch = this.oModel.getProperty("/searchQuery");
					if (currentSearch) {
						this._filterPurchaseOrders(currentSearch);
					}
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

		onProductChange: function () {
			// Generate preview SGTINs when product changes
			this._generatePreviewSGTINs();
		},

		onQuantityChange: function () {
			// Generate preview SGTINs when quantity changes
			this._generatePreviewSGTINs();
		},

		_generatePreviewSGTINs: function () {
			const sGTIN = this.oModel.getProperty("/selectedProductGTIN");
			const iQuantity = parseInt(this.oModel.getProperty("/quantity"));

			// Reset preview if no valid inputs
			if (!sGTIN || !iQuantity || iQuantity <= 0) {
				this.oModel.setProperty("/showSGTINPreview", false);
				this.oModel.setProperty("/previewSGTINs", []);
				this.oModel.setProperty("/canCreatePO", false);
				return;
			}

			// Generate preview SGTINs (simulated - actual generation happens during PO creation)
			const previewSGTINs = [];
			const baseGTIN = sGTIN.padEnd(13, '0');
			
			for (let i = 1; i <= Math.min(iQuantity, 10); i++) { // Limit preview to 10 items
				const serialNumber = String(Date.now() + i).slice(-12);
				const sgtin = baseGTIN + serialNumber;
				previewSGTINs.push({
					sgtin: sgtin,
					serialNumber: serialNumber
				});
			}

			// Add indication if there are more items than shown in preview
			if (iQuantity > 10) {
				previewSGTINs.push({
					sgtin: `... and ${iQuantity - 10} more SGTINs`,
					serialNumber: "Will be generated automatically"
				});
			}

			this.oModel.setProperty("/previewSGTINs", previewSGTINs);
			this.oModel.setProperty("/showSGTINPreview", true);
			this.oModel.setProperty("/canCreatePO", true);
		},

		onCreatePO: function () {
			const sGTIN = this.oModel.getProperty("/selectedProductGTIN");
			const iQuantity = parseInt(this.oModel.getProperty("/quantity"));
			const previewSGTINs = this.oModel.getProperty("/previewSGTINs");

			if (!sGTIN) {
				MessageBox.warning("Please select a product");
				return;
			}

			if (!iQuantity || iQuantity <= 0) {
				MessageBox.warning("Please enter a valid quantity");
				return;
			}

			const sMessage = `Create Purchase Order with auto-generated SGTINs?\n\n` +
				`Product: ${sGTIN}\n` +
				`Quantity: ${iQuantity}\n` +
				`SGTINs to generate: ${iQuantity}`;

			MessageBox.confirm(sMessage, {
				title: "Create Purchase Order with SGTINs",
				onClose: (sAction) => {
					if (sAction === MessageBox.Action.OK) {
						this._createPurchaseOrderWithSGTINs(sGTIN, iQuantity);
					}
				}
			});
		},

		_createPurchaseOrderWithSGTINs: function (sGTIN, iQuantity) {
			// Create Purchase Order - PO Service automatically generates SGTINs internally
			// DO NOT call SGTIN service separately - this causes duplicate SGTIN generation
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.PO_SERVICE) + "/purchase-orders";
			const completePayload = {
				mandt: "100",
				gtin: sGTIN,
				quantity: iQuantity,
				supplier: "DEFAULT_SUPPLIER"
			};

			jQuery.ajax({
				url: sServiceUrl,
				type: "POST",
				contentType: "application/json",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				data: JSON.stringify(completePayload),
				success: (data) => {
					// PO Service returns the created PO with auto-generated SGTINs
					const purchaseOrder = data.purchaseOrder || {};
					const sPOId = purchaseOrder.poId || data.po_id;
					const generatedSGTINs = data.sgtins || [];
					
					MessageToast.show(`✅ Complete! PO ${sPOId} created with ${generatedSGTINs.length} SGTIN(s)`);
					
					// Reset the form and refresh data
					this.oModel.setProperty("/selectedProductGTIN", "");
					this.oModel.setProperty("/quantity", 1);
					this.oModel.setProperty("/showSGTINPreview", false);
					this.oModel.setProperty("/previewSGTINs", []);
					this.oModel.setProperty("/canCreatePO", false);
					
					this._loadPurchaseOrders();
					
					// Publish events to notify other components about new purchase order AND new inventory items
					EventBus.publish(EventBus.Events.PURCHASE_ORDERS_CHANGED, { 
						source: "purchase_orders", 
						action: "created",
						poId: sPOId 
					});
					
					// FIXED: Also publish INVENTORY_CHANGED since SGTINs are created during PO creation
					EventBus.publish(EventBus.Events.INVENTORY_CHANGED, { 
						source: "purchase_orders", 
						action: "sgtins_created",
						poId: sPOId,
						count: generatedSGTINs.length
					});
					
					// Explicitly trigger dashboard refresh
					EventBus.publish(EventBus.Events.DASHBOARD_REFRESH_NEEDED, {
						source: "purchase_orders",
						action: "created"
					});
				},
				error: (xhr, status, error) => {
					let errorMessage = "Failed to create Purchase Order";
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

		// REMOVED: _generateSGTINsForNewPO function - SGTINs are now generated by PO Service internally
		// This prevents duplicate SGTIN generation that was causing data inconsistency

		_createPurchaseOrder: function (oPayload) {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.PO_SERVICE) + "/purchase-orders";

			// Ensure all required fields are present
			const completePayload = {
				mandt: oPayload.mandt || "100",
				gtin: oPayload.gtin,
				quantity: oPayload.quantity,
				supplier: "DEFAULT_SUPPLIER"
			};

			jQuery.ajax({
				url: sServiceUrl,
				type: "POST",
				contentType: "application/json",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				data: JSON.stringify(completePayload),
				success: (data) => {
					MessageToast.show("Purchase Order created successfully: " + data.po_id);
					this.oModel.setProperty("/selectedProductGTIN", "");
					this.oModel.setProperty("/quantity", 1);
					this._loadPurchaseOrders();
				},
				error: (xhr, status, error) => {
					let errorMessage = "Failed to create Purchase Order";
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

		onSearchPO: function (oEvent) {
			const sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
			this.oModel.setProperty("/searchQuery", sQuery);
			this._filterPurchaseOrders(sQuery);
		},

		_filterPurchaseOrders: function (sQuery) {
			const allPurchaseOrders = this.oModel.getProperty("/allPurchaseOrders") || [];
			
			if (!sQuery || sQuery.trim() === "") {
				// No search query, show all purchase orders
				this.oModel.setProperty("/purchaseOrders", allPurchaseOrders);
				// Apply current sort if any
				this._applySortToPurchaseOrders();
				return;
			}
			
			// Filter purchase orders by PO ID (case-insensitive)
			const sQueryLower = sQuery.toLowerCase().trim();
			const filteredPOs = allPurchaseOrders.filter(po => {
				return po.po_id && po.po_id.toLowerCase().includes(sQueryLower);
			});
			
			this.oModel.setProperty("/purchaseOrders", filteredPOs);
			// Apply current sort to filtered results
			this._applySortToPurchaseOrders();
			
			// Show feedback to user
			if (filteredPOs.length === 0) {
				MessageToast.show(`No purchase orders found matching "${sQuery}"`);
			} else if (filteredPOs.length !== allPurchaseOrders.length) {
				MessageToast.show(`Found ${filteredPOs.length} purchase order(s) matching "${sQuery}"`);
			}
		},

		onSortColumn: function (oEvent) {
			const oButton = oEvent.getSource();
			const sSortProperty = oButton.data("sortProperty");
			
			if (!sSortProperty) {
				return;
			}
			
			const currentSortProperty = this.oModel.getProperty("/sortProperty");
			const currentSortDescending = this.oModel.getProperty("/sortDescending");
			
			// Determine new sort direction
			let newSortDescending = false;
			if (currentSortProperty === sSortProperty) {
				// Same column clicked, toggle sort direction
				newSortDescending = !currentSortDescending;
			} else {
				// Different column clicked, start with ascending
				newSortDescending = false;
			}
			
			// Update sort state
			this.oModel.setProperty("/sortProperty", sSortProperty);
			this.oModel.setProperty("/sortDescending", newSortDescending);
			
			// Apply sorting
			this._applySortToPurchaseOrders();
			
			// Show feedback to user
			const sortDirection = newSortDescending ? "descending" : "ascending";
			const sortLabel = this._getSortLabel(sSortProperty);
			MessageToast.show(`Sorted by ${sortLabel} (${sortDirection})`);
		},

		_applySortToPurchaseOrders: function () {
			const currentPOs = this.oModel.getProperty("/purchaseOrders") || [];
			const sortProperty = this.oModel.getProperty("/sortProperty");
			const sortDescending = this.oModel.getProperty("/sortDescending");
			
			if (!sortProperty || currentPOs.length === 0) {
				return;
			}
			
			// Create a copy of the array to sort
			const sortedPOs = [...currentPOs];
			
			// Sort based on property type
			sortedPOs.sort((a, b) => {
				let valueA, valueB;
				
				switch (sortProperty) {
					case "quantity":
						valueA = parseInt(a.quantity) || 0;
						valueB = parseInt(b.quantity) || 0;
						break;
					case "status":
						valueA = (a.status || "").toLowerCase();
						valueB = (b.status || "").toLowerCase();
						break;
					case "created_at":
						valueA = new Date(a.created_at || 0);
						valueB = new Date(b.created_at || 0);
						break;
					default:
						valueA = a[sortProperty] || "";
						valueB = b[sortProperty] || "";
				}
				
				// Compare values
				let comparison = 0;
				if (valueA < valueB) {
					comparison = -1;
				} else if (valueA > valueB) {
					comparison = 1;
				}
				
				// Apply sort direction
				return sortDescending ? -comparison : comparison;
			});
			
			// Update the model with sorted data
			this.oModel.setProperty("/purchaseOrders", sortedPOs);
		},

		_getSortLabel: function (sSortProperty) {
			switch (sSortProperty) {
				case "quantity": return "Quantity";
				case "status": return "Status";
				case "created_at": return "Created At";
				default: return sSortProperty;
			}
		},

		onRefreshData: function () {
			this._loadProductsThenPOs();
			MessageToast.show("Data refreshed");
		},

		onPOSelect: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			const sPOId = oContext.getProperty("po_id");
			MessageToast.show("Selected PO: " + sPOId);
		},

	onViewDetails: function (oEvent) {
		const oContext = oEvent.getSource().getBindingContext();
		const oPO = oContext.getObject();
		
		// Navigate to purchase order detail page with barcode labels
		this.oRouter.navTo("purchaseOrderDetail", {
			poId: oPO.po_id
		});
	},		onShowSGTINs: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			const oPO = oContext.getObject();
			
			this._showSGTINs(oPO);
		},


	_showSGTINs: function (oPO) {
		// Use PO service labels endpoint instead of SGTIN service
		const sServiceUrl = `${ApiConfig.getServiceUrl(ApiConfig.PO_SERVICE)}/purchase-orders/${oPO.po_id}/labels?mandt=100`;
		
		jQuery.ajax({
			url: sServiceUrl,
			type: "GET",
			headers: {
				'X-API-Key': 'dev-api-key-12345'
			},
			success: (data) => {
				if (data && data.success && data.labels && data.labels.length > 0) {
					// Display SGTINs in a formatted dialog
					let sgtinList = data.labels.map((label, index) => {
						let barcodeStatus = label.barcode ? '✓ Has Barcode' : '✗ No Barcode';
						let qrStatus = label.qrCode ? '✓ Has QR' : '✗ No QR';
						return `${index + 1}. SGTIN: ${label.sgtin}\n   Serial: ${label.serialNumber}\n   Status: ${label.status}\n   Location: ${label.location || 'Not specified'}\n   ${barcodeStatus} | ${qrStatus}`;
					}).join('\n\n');
					
					// Count statuses
					const statusCounts = {};
					data.labels.forEach(label => {
						statusCounts[label.status] = (statusCounts[label.status] || 0) + 1;
					});
					const statusSummaryText = Object.entries(statusCounts)
						.map(([status, count]) => `${status}: ${count}`)
						.join(', ');
					
					// Count barcodes
					const withBarcodes = data.labels.filter(l => l.barcode).length;
					const withQR = data.labels.filter(l => l.qrCode).length;
					
					const sMessage = `SGTINs for Purchase Order ${oPO.po_id}:\n\n` +
						`Total Count: ${data.count}\n` +
						`Status Summary: ${statusSummaryText}\n` +
						`Barcodes: ${withBarcodes}/${data.count} | QR Codes: ${withQR}/${data.count}\n\n` +
						`Individual SGTINs:\n${sgtinList}\n\n` +
						`💡 Click "Details" button to view barcode images`;
					
					MessageBox.information(sMessage, {
						title: `SGTINs for ${oPO.po_id}`,
						contentWidth: "600px"
					});
				} else {
					// No SGTINs found
					const sMessage = `No SGTINs found for Purchase Order ${oPO.po_id}.\n\n` +
						`This could mean:\n` +
						`• SGTINs haven't been generated yet\n` +
						`• This is an older PO created before automatic SGTIN generation\n` +
						`• Check if the purchase order has been processed\n\n` +
						`PO Details:\n` +
						`• GTIN: ${oPO.gtin}\n` +
						`• Quantity: ${oPO.quantity}\n` +
						`• Status: ${oPO.status}`;
					
					MessageBox.information(sMessage, {
						title: `No SGTINs - ${oPO.po_id}`,
						contentWidth: "450px"
					});
				}
			},
			error: (xhr, status, error) => {
				// Handle error case with helpful information
				const sMessage = `Unable to retrieve SGTINs for Purchase Order ${oPO.po_id}.\n\n` +
					`This might be because:\n` +
					`• PO service is not available\n` +
					`• No SGTINs have been generated for this PO yet\n` +
					`• Database connectivity issues\n\n` +
					`Try:\n` +
					`• Check if all services are running\n` +
					`• Contact system administrator if problem persists\n` +
					`• For newer POs, SGTINs should be automatically generated\n\n` +
					`Technical Details:\n` +
					`• Service: PO Service (Port 3002)\n` +
					`• PO ID: ${oPO.po_id}\n` +
					`• Error: ${error}`;
				
				MessageBox.warning(sMessage, {
					title: `SGTIN Retrieval Failed`,
					contentWidth: "500px"
				});
			}
		});
	},
		// Formatters
		formatStatus: function (sStatus) {
			switch (sStatus) {
				case "CREATED": return "Warning";
				case "SGTIN_GENERATED": return "Success";
				case "COMPLETED": return "Success";
				default: return "None";
			}
		},

		formatDate: function (sDate) {
			if (!sDate) return "";
			const oDate = new Date(sDate);
			return oDate.toLocaleDateString() + " " + oDate.toLocaleTimeString();
		},


	});
});
