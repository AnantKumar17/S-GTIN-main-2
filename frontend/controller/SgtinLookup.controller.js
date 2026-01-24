sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Image"
], function(Controller, JSONModel, MessageToast, MessageBox, Dialog, Button, Image) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.SGTINLookup", {

		onInit: function() {
			// Initialize model
			this.oModel = new JSONModel({
				gtins: [],
				purchaseOrders: [],
				sgtins: [],
				selectedGtin: null,
				selectedPoId: null,
				selectedSgtin: null,
				passport: null,
				showPassport: false,
				showError: false,
				errorMessage: "",
				isLoading: false
			});

			this.getView().setModel(this.oModel);
			
			// Get router
			this.oRouter = this.getOwnerComponent().getRouter();
			
			// API configuration
			this.baseUrl = "http://localhost:3006/api";
			this.apiKey = "dev-api-key-12345";
			this.mandt = "100";
			
			// Load initial GTINs
			this.loadGtins();
		},

		onNavBack: function() {
			this.oRouter.navTo("main");
		},

		// Load all GTINs for dropdown
		loadGtins: function() {
			this.oModel.setProperty("/isLoading", true);
			
			fetch(`${this.baseUrl}/gtin-passport/gtins?mandt=${this.mandt}`, {
				method: 'GET',
				headers: {
					'X-API-Key': this.apiKey,
					'Content-Type': 'application/json'
				}
			})
			.then(response => response.json())
			.then(data => {
				this.oModel.setProperty("/isLoading", false);
				if (data.success) {
					this.oModel.setProperty("/gtins", data.data || []);
					console.log("Loaded GTINs:", data.data);
				} else {
					MessageToast.show("Failed to load products");
				}
			})
			.catch(error => {
				this.oModel.setProperty("/isLoading", false);
				console.error("Error loading GTINs:", error);
				MessageToast.show("Error loading products");
			});
		},

		// Handle GTIN selection
		onGtinChange: function(oEvent) {
			const selectedKey = oEvent.getParameter("selectedItem").getKey();
			this.oModel.setProperty("/selectedGtin", selectedKey);
			
			// Reset dependent dropdowns
			this.oModel.setProperty("/selectedPoId", null);
			this.oModel.setProperty("/selectedSgtin", null);
			this.oModel.setProperty("/purchaseOrders", []);
			this.oModel.setProperty("/sgtins", []);
			this.oModel.setProperty("/showPassport", false);
			
			// Load purchase orders for selected GTIN
			if (selectedKey) {
				this.loadPurchaseOrders(selectedKey);
			}
		},

		// Load purchase orders for selected GTIN
		loadPurchaseOrders: function(gtin) {
			this.oModel.setProperty("/isLoading", true);
			
			fetch(`${this.baseUrl}/gtin-passport/purchase-orders/${gtin}?mandt=${this.mandt}`, {
				method: 'GET',
				headers: {
					'X-API-Key': this.apiKey,
					'Content-Type': 'application/json'
				}
			})
			.then(response => response.json())
			.then(data => {
				this.oModel.setProperty("/isLoading", false);
				if (data.success) {
					this.oModel.setProperty("/purchaseOrders", data.data || []);
					console.log("Loaded Purchase Orders:", data.data);
					if (data.data.length === 0) {
						MessageToast.show("No purchase orders found for this product");
					}
				} else {
					MessageToast.show("Failed to load purchase orders");
				}
			})
			.catch(error => {
				this.oModel.setProperty("/isLoading", false);
				console.error("Error loading purchase orders:", error);
				MessageToast.show("Error loading purchase orders");
			});
		},

		// Handle PO selection
		onPoChange: function(oEvent) {
			const selectedKey = oEvent.getParameter("selectedItem").getKey();
			this.oModel.setProperty("/selectedPoId", selectedKey);
			
			// Reset dependent dropdown
			this.oModel.setProperty("/selectedSgtin", null);
			this.oModel.setProperty("/sgtins", []);
			this.oModel.setProperty("/showPassport", false);
			
			// Load SGTINs for selected PO
			if (selectedKey) {
				this.loadSgtins(selectedKey);
			}
		},

		// Load SGTINs for selected purchase order
		loadSgtins: function(poId) {
			this.oModel.setProperty("/isLoading", true);
			
			fetch(`${this.baseUrl}/gtin-passport/sgtins/${poId}?mandt=${this.mandt}`, {
				method: 'GET',
				headers: {
					'X-API-Key': this.apiKey,
					'Content-Type': 'application/json'
				}
			})
			.then(response => response.json())
			.then(data => {
				this.oModel.setProperty("/isLoading", false);
				if (data.success) {
					this.oModel.setProperty("/sgtins", data.data || []);
					console.log("Loaded SGTINs:", data.data);
					if (data.data.length === 0) {
						MessageToast.show("No SGTINs found for this purchase order");
					}
				} else {
					MessageToast.show("Failed to load SGTINs");
				}
			})
			.catch(error => {
				this.oModel.setProperty("/isLoading", false);
				console.error("Error loading SGTINs:", error);
				MessageToast.show("Error loading SGTINs");
			});
		},

		// Handle SGTIN selection
		onSgtinChange: function(oEvent) {
			const selectedKey = oEvent.getParameter("selectedItem").getKey();
			this.oModel.setProperty("/selectedSgtin", selectedKey);
			this.oModel.setProperty("/showPassport", false);
		},

		// View passport for selected SGTIN
		onViewPassport: function() {
			const sgtin = this.oModel.getProperty("/selectedSgtin");
			
			if (!sgtin) {
				MessageBox.warning("Please select an SGTIN");
				return;
			}
			
			this.oModel.setProperty("/isLoading", true);
			this.oModel.setProperty("/showPassport", false);
			this.oModel.setProperty("/showError", false);
			
			fetch(`${this.baseUrl}/gtin-passport/${encodeURIComponent(sgtin)}?mandt=${this.mandt}`, {
				method: 'GET',
				headers: {
					'X-API-Key': this.apiKey,
					'Content-Type': 'application/json'
				}
			})
			.then(response => {
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				return response.json();
			})
			.then(data => {
				this.oModel.setProperty("/isLoading", false);
				if (data.success && data.data) {
					this.oModel.setProperty("/passport", data.data);
					this.oModel.setProperty("/showPassport", true);
					this.oModel.setProperty("/showError", false);
					MessageToast.show("Passport loaded successfully");
					console.log("Passport data:", data.data);
				} else {
					this.oModel.setProperty("/showPassport", true);
					this.oModel.setProperty("/showError", true);
					this.oModel.setProperty("/errorMessage", "No passport data found");
				}
			})
			.catch(error => {
				this.oModel.setProperty("/isLoading", false);
				this.oModel.setProperty("/showPassport", true);
				this.oModel.setProperty("/showError", true);
				this.oModel.setProperty("/errorMessage", "Failed to load passport: " + error.message);
				console.error("Error loading passport:", error);
			});
		},

		// Clear all selections
		onClearSelection: function() {
			this.oModel.setProperty("/selectedGtin", null);
			this.oModel.setProperty("/selectedPoId", null);
			this.oModel.setProperty("/selectedSgtin", null);
			this.oModel.setProperty("/purchaseOrders", []);
			this.oModel.setProperty("/sgtins", []);
			this.oModel.setProperty("/passport", null);
			this.oModel.setProperty("/showPassport", false);
			this.oModel.setProperty("/showError", false);
			this.oModel.setProperty("/errorMessage", "");
			
			MessageToast.show("Selection cleared");
		},

		// View barcode dialog
		onViewBarcode: function() {
			const barcode = this.oModel.getProperty("/passport/barcode");
			if (!barcode) {
				MessageBox.information("No barcode available");
				return;
			}
			
			const dialog = new Dialog({
				title: "Barcode",
				content: new Image({
					src: barcode,
					width: "400px",
					height: "200px"
				}),
				beginButton: new Button({
					text: "Close",
					press: function() {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});
			
			dialog.open();
		},

		// View QR code dialog
		onViewQRCode: function() {
			const qrCode = this.oModel.getProperty("/passport/qr_code");
			if (!qrCode) {
				MessageBox.information("No QR code available");
				return;
			}
			
			const dialog = new Dialog({
				title: "QR Code",
				content: new Image({
					src: qrCode,
					width: "300px",
					height: "300px"
				}),
				beginButton: new Button({
					text: "Close",
					press: function() {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
			});
			
			dialog.open();
		},

		// Export passport to CSV with clickable barcode/QR links
		onExportPassport: function() {
			const passport = this.oModel.getProperty("/passport");
			
			if (!passport) {
				MessageBox.warning("No passport data available to export");
				return;
			}

			// Prepare passport data for export with improved field handling
			const exportData = {
				// Product Information
				'Product Name': passport.product_name || '',
				'Brand': passport.brand || '',
				'Category': passport.category || '',
				'Subcategory': passport.subcategory || '',
				'GTIN': passport.gtin || '',
				'Product Price': passport.product_price ? `€${parseFloat(passport.product_price).toFixed(2)}` : '',
				'Description': passport.description || '',
				
				// Serialization Details
				'SGTIN': passport.sgtin || '',
				'Status': passport.status || '',
				'Current Location': passport.location || '',
				'Created At': this._formatDateTimeForExport(passport.sgtin_created_at),
				
				// Purchase Order Information (only if available)
				...(passport.po_id ? {
					'PO Number': passport.po_id,
					'Supplier': passport.supplier || '',
					'PO Warehouse': passport.warehouse || '',
					'PO Status': passport.po_status || '',
					'PO Created': this._formatDateTimeForExport(passport.po_created_at)
				} : {}),
				
				// Goods Receipt Information (only if available)
				...(passport.gr_id ? {
					'GR Number': passport.gr_id,
					'Received At': this._formatDateTimeForExport(passport.gr_received_at),
					'Received By': passport.received_by || '',
					'GR Warehouse': passport.gr_warehouse || ''
				} : {}),
				
				// Sales Information (only if available and not showing N/A values)
				...(passport.sale_id ? {
					'Sale ID': passport.sale_id,
					'Store': passport.store_id || '',
					'Sold At': this._formatDateTimeForExport(passport.sold_at),
					...(passport.actual_selling_price ? {
						'Selling Price': `€${parseFloat(passport.actual_selling_price).toFixed(2)}`
					} : {}),
					...(passport.profit && passport.profit !== 0 ? {
						'Profit': `€${parseFloat(passport.profit).toFixed(2)}`
					} : {}),
					...(passport.profit_margin && passport.profit_margin !== 0 ? {
						'Profit Margin': `${parseFloat(passport.profit_margin).toFixed(2)}%`
					} : {})
				} : {}),
				
				// Anti-Counterfeiting (clickable links)
				...(passport.barcode ? {
					'Barcode Image': passport.barcode
				} : {}),
				...(passport.qr_code ? {
					'QR Code Image': passport.qr_code
				} : {})
			};

			// Include lifecycle events if available
			if (passport.lifecycle_events && passport.lifecycle_events.length > 0) {
				exportData['Lifecycle Events'] = passport.lifecycle_events
					.map(event => `${event.event_type} (${this._formatDateTimeForExport(event.created_at)}) - Location: ${event.location || 'N/A'}`)
					.join('; ');
			}

			this._exportToCSV([exportData], `SGTIN_Passport_${passport.sgtin}`);
			MessageToast.show("Passport exported successfully");
		},

		_formatDateTimeForExport: function(dateString) {
			if (!dateString) return '';
			
			try {
				const date = new Date(dateString);
				if (isNaN(date.getTime())) return '';
				
				return date.toLocaleString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					hour12: true
				});
			} catch (e) {
				return '';
			}
		},

		_exportToCSV: function(aData, sFileName) {
			if (!aData || aData.length === 0) {
				return;
			}

			// Get headers from first object
			const aHeaders = Object.keys(aData[0]);
			
			// Create CSV content
			let csvContent = aHeaders.join(',') + '\n';
			
			aData.forEach(row => {
				const aValues = aHeaders.map(header => {
					let value = row[header] || '';
					
					// Handle URLs (barcode/QR images) - make them clickable in spreadsheet applications
					if (typeof value === 'string' && (value.startsWith('data:image/') || value.startsWith('http'))) {
						// Excel formula to make clickable link: =HYPERLINK("url", "display_text")
						value = `"=HYPERLINK(""${value}"",""View Image"")"`;
						return value;
					}
					
					// Escape quotes and wrap in quotes if contains comma or quotes
					if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
						value = '"' + value.replace(/"/g, '""') + '"';
					}
					return value;
				});
				csvContent += aValues.join(',') + '\n';
			});

			// Create download
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', sFileName + '_' + new Date().toISOString().split('T')[0] + '.csv');
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		},

		// ============================
		// Formatters
		// ============================

		formatNA: function(value) {
			return value || "N/A";
		},

		formatPrice: function(value) {
			if (!value || isNaN(value)) {
				return "N/A";
			}
			return "€" + parseFloat(value).toFixed(2);
		},

		formatProfit: function(value) {
			if (!value || isNaN(value)) {
				return "N/A";
			}
			const profit = parseFloat(value);
			const sign = profit >= 0 ? "+" : "";
			return sign + "€" + profit.toFixed(2);
		},

		formatProfitMargin: function(value) {
			if (!value || isNaN(value)) {
				return "N/A";
			}
			const margin = parseFloat(value);
			const sign = margin >= 0 ? "+" : "";
			return sign + margin.toFixed(2) + "%";
		},

		formatDateTime: function(dateString) {
			if (!dateString) {
				return "N/A";
			}
			
			try {
				const date = new Date(dateString);
				if (isNaN(date.getTime())) {
					return "N/A";
				}
				
				return date.toLocaleString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					hour12: true
				});
			} catch (e) {
				return "N/A";
			}
		},

		formatDateOnly: function(dateString) {
			if (!dateString) {
				return "N/A";
			}
			
			try {
				const date = new Date(dateString);
				if (isNaN(date.getTime())) {
					return "N/A";
				}
				
				return date.toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				});
			} catch (e) {
				return "N/A";
			}
		},

		formatStatusState: function(status) {
			if (!status) {
				return "None";
			}
			
			switch (status.toUpperCase()) {
				case "IN_STOCK":
					return "Success";
				case "SOLD":
					return "Information";
				case "CREATED":
					return "Warning";
				case "DAMAGED":
				case "RETURNED":
					return "Error";
				default:
					return "None";
			}
		}

	});

});