sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/Fragment",
	"sap/ui/core/format/DateFormat",
	"../utils/EventBus",
	"../utils/ApiConfig",
	"../utils/ErrorHandler"
], function (Controller, MessageToast, MessageBox, JSONModel, Fragment, DateFormat, EventBus, ApiConfig, ErrorHandler) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.Inventory", {

		onInit: function () {
			// Subscribe to data change events for auto-refresh
			this._subscribeToEvents();
			
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oModel = new JSONModel({
				inventory: [],
				filteredInventory: [],
				products: [],
				gtins: [],
				poIds: [],
				statusFilter: "",
				gtinFilter: [],
				sgtinFilter: "",
				poIdFilter: "",
				datePeriodFilter: "",
				dateFromFilter: "",
				dateToFilter: "",
				summary: {
					totalItems: 0,
					inStock: 0,
					sold: 0,
					created: 0
				}
			});
			this.getView().setModel(this.oModel);
			this._loadInventory();
			this._loadPoIds();
		},

		onExit: function() {
			// Clean up event subscriptions when controller is destroyed
			this._unsubscribeFromEvents();
		},

		_subscribeToEvents: function() {
			// Subscribe to inventory and goods receipt events
			EventBus.subscribe(EventBus.Events.INVENTORY_CHANGED, this._onInventoryChanged, this);
			EventBus.subscribe(EventBus.Events.GOODS_RECEIPT_PROCESSED, this._onInventoryChanged, this);
			EventBus.subscribe(EventBus.Events.POS_TRANSACTION_COMPLETED, this._onInventoryChanged, this);
			// Subscribe to purchase order changes to refresh PO dropdown
			EventBus.subscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this._onPurchaseOrdersChanged, this);
		},

		_unsubscribeFromEvents: function() {
			// Unsubscribe from all events to prevent memory leaks
			EventBus.unsubscribe(EventBus.Events.INVENTORY_CHANGED, this);
			EventBus.unsubscribe(EventBus.Events.GOODS_RECEIPT_PROCESSED, this);
			EventBus.unsubscribe(EventBus.Events.POS_TRANSACTION_COMPLETED, this);
			EventBus.unsubscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this);
		},

		_onInventoryChanged: function(data) {
			// Auto-refresh inventory when data changes
			console.log("Inventory controller: Data changed, refreshing inventory...", data);
			this._loadInventory();
		},

		_onPurchaseOrdersChanged: function(data) {
			// Auto-refresh PO dropdown when purchase orders change
			console.log("Inventory controller: Purchase orders changed, refreshing PO dropdown...", data);
			this._loadPoIds();
			// Also refresh inventory since new POs might have created new inventory items
			this._loadInventory();
		},

		onNavBack: function () {
			this.oRouter.navTo("main");
		},

		_loadInventory: function () {
			// Build URL with current filters
			let sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "/inventory?mandt=100";
			
			// Add filters to URL
			const sStatusFilter = this.oModel.getProperty("/statusFilter");
			const sPoIdFilter = this.oModel.getProperty("/poIdFilter");
			const sDatePeriodFilter = this.oModel.getProperty("/datePeriodFilter");
			const sDateFromFilter = this.oModel.getProperty("/dateFromFilter");
			const sDateToFilter = this.oModel.getProperty("/dateToFilter");
			
			if (sStatusFilter) {
				sServiceUrl += "&status=" + encodeURIComponent(sStatusFilter);
			}
			if (sPoIdFilter) {
				sServiceUrl += "&poId=" + encodeURIComponent(sPoIdFilter);
			}
			// Only send datePeriod if it's NOT "custom"
			if (sDatePeriodFilter && sDatePeriodFilter !== "custom") {
				sServiceUrl += "&datePeriod=" + encodeURIComponent(sDatePeriodFilter);
			}
			// For custom date range, send dates directly (already in YYYY-MM-DD format)
			if (sDateFromFilter && sDatePeriodFilter === "custom") {
				sServiceUrl += "&dateFrom=" + encodeURIComponent(sDateFromFilter);
			}
			if (sDateToFilter && sDatePeriodFilter === "custom") {
				sServiceUrl += "&dateTo=" + encodeURIComponent(sDateToFilter);
			}
			
			console.log("Loading inventory with URL:", sServiceUrl);
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					const inventory = data && data.inventory ? data.inventory : [];
					this.oModel.setProperty("/inventory", inventory);
					this._processInventoryData(inventory);
					this._applyClientSideFilters();
					MessageToast.show("Loaded " + inventory.length + " items from database");
				},
				error: (xhr, status, error) => {
					this.oModel.setProperty("/inventory", []);
					this._processInventoryData([]);
					this._applyClientSideFilters();
					
					let errorMessage = "Failed to load inventory from database";
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

		_loadPoIds: function () {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.INVENTORY_SERVICE) + "/inventory/po-ids?mandt=100";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					const poIds = data && data.poIds ? data.poIds : [];
					this.oModel.setProperty("/poIds", poIds);
				},
				error: (xhr, status, error) => {
					console.error("Failed to load PO IDs:", error);
					this.oModel.setProperty("/poIds", []);
				}
			});
		},

		_processInventoryData: function (aData) {
			// Extract unique products and GTINs
			const uniqueProducts = [];
			const uniqueGTINs = [];
			const seenGTINs = new Set();

			// Initialize summary counters
			let summary = {
				totalItems: aData.length,
				inStock: 0,
				sold: 0,
				created: 0
			};

			aData.forEach(item => {
				// Count status
				switch (item.status) {
					case 'IN_STOCK': summary.inStock++; break;
					case 'SOLD': summary.sold++; break;
					case 'CREATED': summary.created++; break;
				}

				// Collect unique products and GTINs
				if (!seenGTINs.has(item.gtin)) {
					const productInfo = {
						gtin: item.gtin,
						name: item.product_name,
						brand: item.brand || 'Unknown'
					};
					uniqueProducts.push(productInfo);
					uniqueGTINs.push({
						key: item.gtin,
						text: item.gtin + " - " + item.product_name
					});
					seenGTINs.add(item.gtin);
				}
			});

			this.oModel.setProperty("/products", uniqueProducts);
			this.oModel.setProperty("/gtins", uniqueGTINs);
			this.oModel.setProperty("/summary", summary);
		},


		onStatusFilterChange: function (oEvent) {
			// Handle both dropdown selection and manual input
			let sStatusFilter = oEvent.getParameter("selectedKey") || oEvent.getParameter("value") || oEvent.getSource().getValue();
			
			// Handle "All Statuses" selection (empty key) or "All Statuses" text
			if (!sStatusFilter || sStatusFilter.trim() === "" || sStatusFilter === "All Statuses") {
				this.oModel.setProperty("/statusFilter", "");
				this._syncHierarchicalFilters();
				this._loadInventory();
				return;
			}
			
			// If there's a value, validate and normalize it
			const normalizedStatus = this._normalizeStatusInput(sStatusFilter.trim());
			
			// Check if normalization returned empty string (valid for "All Statuses" case)
			if (normalizedStatus === '') {
				this.oModel.setProperty("/statusFilter", "");
				this._syncHierarchicalFilters();
				this._loadInventory();
				return;
			}
			
			if (normalizedStatus === null) {
				MessageBox.error("Invalid Status!\n\nStatus must be: CREATED, IN_STOCK, or SOLD\n\nAccepted inputs:\n- Created/CREATED\n- In Stock/IN_STOCK\n- Sold/SOLD", {
					title: "Status Validation Error"
				});
				// Reset the field
				this.oModel.setProperty("/statusFilter", "");
				this.byId("statusFilter").setSelectedKey("");
				this.byId("statusFilter").setValue("");
				return;
			}
			
			// Update model with normalized value
			this.oModel.setProperty("/statusFilter", normalizedStatus);
			this._syncHierarchicalFilters();
			this._loadInventory();
		},

		onSgtinFilterChange: function () {
			// Validate SGTIN format
			const sSgtinFilter = this.oModel.getProperty("/sgtinFilter");
			if (sSgtinFilter && !this._isValidSGTIN(sSgtinFilter)) {
				MessageBox.error("Invalid SGTIN Format!\n\nSGTIN should be a 30-32 digit number starting with '01'.\n\nExamples:\n- 010123456789012345678901234567 (30 digits)\n- 0120001234567891210000000001302 (31 digits)", {
					title: "SGTIN Validation Error"
				});
				this.oModel.setProperty("/sgtinFilter", "");
				return;
			}
			this._applyClientSideFilters();
		},

		onPoIdFilterChange: function (oEvent) {
			// Handle both dropdown selection and manual input
			let sPoIdFilter = oEvent.getParameter("selectedKey") || oEvent.getParameter("value") || oEvent.getSource().getValue();
			
			console.log("PO ID change - selectedKey:", oEvent.getParameter("selectedKey"), "value:", oEvent.getParameter("value"), "getValue():", oEvent.getSource().getValue());
			
			// Handle "All Purchase Orders" selection (empty key)
			if (!sPoIdFilter || sPoIdFilter.trim() === "") {
				this.oModel.setProperty("/poIdFilter", "");
				this._syncHierarchicalFilters();
				this._loadInventory();
				return;
			}
			
			// If there's a value, validate and normalize it
			const normalizedPoId = this._extractPOIDFromValue(sPoIdFilter.trim());
			
			if (!normalizedPoId || !this._isValidPOID(normalizedPoId)) {
				MessageBox.error("Invalid PO ID Format!\n\nPO ID must start with 'PO-' followed by numbers (e.g., PO-45000001).\n\nPlease select from dropdown or enter valid PO ID.", {
					title: "PO ID Validation Error"
				});
				// Reset the field
				this.oModel.setProperty("/poIdFilter", "");
				this.byId("poIdFilter").setSelectedKey("");
				this.byId("poIdFilter").setValue("");
				return;
			}
			
			// Update model with normalized PO ID (not the full description)
			this.oModel.setProperty("/poIdFilter", normalizedPoId);
			this._syncHierarchicalFilters();
			this._loadInventory();
		},


		onFilterChange: function () {
			this._syncHierarchicalFilters();
			this._loadInventory(); // Reload with server-side filtering
		},

		onDatePeriodChange: function () {
			const sDatePeriod = this.oModel.getProperty("/datePeriodFilter");
			// Clear custom date fields when predefined period is selected
			if (sDatePeriod && sDatePeriod !== "custom") {
				this.oModel.setProperty("/dateFromFilter", "");
				this.oModel.setProperty("/dateToFilter", "");
				this._loadInventory();
			}
			// If "custom" is selected, don't load until dates are provided
		},

		onDateRangeChange: function () {
			// Set period filter to "custom" when dates are changed
			this.oModel.setProperty("/datePeriodFilter", "custom");
			
			// Get dates from model (valueFormat="yyyy-MM-dd" stores dates in this format)
			const sDateFrom = this.oModel.getProperty("/dateFromFilter");
			const sDateTo = this.oModel.getProperty("/dateToFilter");
			
			console.log("Date range change - From:", sDateFrom, "To:", sDateTo);
			
			// If only one date is selected, don't load yet - wait for both
			if (sDateFrom && sDateTo) {
				// Dates are in YYYY-MM-DD format, just compare them directly
				if (sDateFrom > sDateTo) {
					MessageBox.error(
						"Invalid Date Range!\n\n" +
						"From Date (" + sDateFrom + ") cannot be later than To Date (" + sDateTo + ").\n\n" +
						"Please adjust your date range.",
						{
							title: "Date Range Validation Error"
						}
					);
					return;
				}
				
				console.log("Valid date range - loading inventory");
				// Only load inventory if both dates are valid
				this._loadInventory();
			}
		},

		_formatDateForAPI: function(date) {
			// Use SAP UI5's built-in DateFormat to format Date object to YYYY-MM-DD format for backend API
			if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
				return null;
			}
			
			// Create SAP UI5 DateFormat instance for ISO date format (YYYY-MM-DD)
			const oDateFormat = DateFormat.getDateInstance({
				pattern: "yyyy-MM-dd"
			});
			
			return oDateFormat.format(date);
		},

		_parseDate: function(dateStr) {
			// Enhanced date parsing function to handle all possible SAP UI5 DatePicker formats
			if (!dateStr) return null;
			
			console.log("_parseDate input:", dateStr, "typeof:", typeof dateStr, "value:", JSON.stringify(dateStr));
			
			// Handle Date object (might come from DatePicker)
			if (dateStr instanceof Date) {
				console.log("_parseDate: Input is already a Date object");
				if (isNaN(dateStr.getTime())) {
					console.warn("_parseDate: Invalid Date object:", dateStr);
					return null;
				}
				return dateStr;
			}
			
			// Convert to string if needed and trim whitespace
			const dateString = String(dateStr).trim();
			console.log("_parseDate: Trimmed string:", JSON.stringify(dateString));
			
			// Check for obviously invalid formats early
			if (dateString === '' || dateString.toLowerCase() === 'invalid-date' || dateString.toLowerCase().includes('invalid')) {
				console.warn("_parseDate: Invalid date string:", dateString);
				return null;
			}
			
			// Handle ISO format (YYYY-MM-DD) - most common from DatePicker
			if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
				try {
					const parsedDate = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
					if (isNaN(parsedDate.getTime())) {
						console.warn("_parseDate: Invalid ISO date:", dateString);
						return null;
					}
					console.log("_parseDate: Parsed ISO date:", parsedDate);
					return parsedDate;
				} catch (error) {
					console.warn("_parseDate: Error parsing ISO date:", dateString, error.message);
					return null;
				}
			}
			
			// Handle DD/MM/YYYY and D/M/YYYY formats (with or without leading zeros)
			if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
				try {
					console.log("_parseDate: Matched DD/MM/YYYY or D/M/YYYY pattern");
					const parts = dateString.split('/');
					console.log("_parseDate: Date parts:", parts);
					
					const day = parseInt(parts[0], 10);
					const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JavaScript Date
					const year = parseInt(parts[2], 10);
					
					console.log("_parseDate: Parsed values - Day:", day, "Month:", month + 1, "Year:", year);
					
					// Validate ranges
					if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1900 || year > 2100) {
						console.warn("_parseDate: Invalid DD/MM/YYYY date values - Day:", day, "Month:", month + 1, "Year:", year);
						return null;
					}
					
					// Create date object
					const parsedDate = new Date(year, month, day);
					console.log("_parseDate: Created Date object:", parsedDate);
					
					if (isNaN(parsedDate.getTime())) {
						console.warn("_parseDate: Invalid DD/MM/YYYY date result:", parsedDate);
						return null;
					}
					
					// Additional validation - check if the date components match what we expected
					if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month || parsedDate.getDate() !== day) {
						console.warn("_parseDate: Date components don't match - Expected:", {year, month: month + 1, day}, "Got:", {
							year: parsedDate.getFullYear(),
							month: parsedDate.getMonth() + 1,
							day: parsedDate.getDate()
						});
						return null;
					}
					
					console.log("_parseDate: Successfully parsed DD/MM/YYYY date:", parsedDate);
					return parsedDate;
				} catch (error) {
					console.warn("_parseDate: Error parsing DD/MM/YYYY date:", dateString, error.message);
					return null;
				}
			}
			
			// Handle "DD MMM YYYY" format (e.g., "22 Jan 2026") - SAP UI5 often displays dates this way
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			
			// More flexible regex for DD MMM YYYY pattern - handle various separators and casing
			const monthPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i;
			const ddMmmYyyyPattern = new RegExp(`^(\\d{1,2})\\s+${monthPattern.source}\\s+(\\d{4})$`, 'i');
			
			if (ddMmmYyyyPattern.test(dateString)) {
				try {
					console.log("_parseDate: Matched DD MMM YYYY pattern");
					const parts = dateString.split(/\s+/);
					console.log("_parseDate: Month name parts:", parts);
					
					if (parts.length !== 3) {
						console.warn("_parseDate: Expected 3 parts, got:", parts.length, parts);
						return null;
					}
					
					const day = parseInt(parts[0], 10);
					const monthName = parts[1];
					const year = parseInt(parts[2], 10);
					
					console.log("_parseDate: Extracted - Day:", day, "MonthName:", monthName, "Year:", year);
					
					// Find month index - try both short and long names
					let month = monthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
					if (month === -1) {
						month = monthNamesLong.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
					}
					
					if (month === -1) {
						console.warn("_parseDate: Unknown month name:", monthName);
						// Try a more flexible approach - check if it contains the month name
						for (let i = 0; i < monthNames.length; i++) {
							if (monthName.toLowerCase().includes(monthNames[i].toLowerCase()) || 
								monthNames[i].toLowerCase().includes(monthName.toLowerCase())) {
								month = i;
								console.log("_parseDate: Found partial match for month:", monthName, "->", monthNames[i], "index:", month);
								break;
							}
						}
					}
					
					if (month === -1) {
						console.warn("_parseDate: Still no month match found for:", monthName);
						return null;
					}
					
					// Validate ranges
					if (day < 1 || day > 31 || year < 1900 || year > 2100) {
						console.warn("_parseDate: Invalid DD MMM YYYY values - Day:", day, "Month:", month + 1, "Year:", year);
						return null;
					}
					
					console.log("_parseDate: Parsed month name values - Day:", day, "Month:", month + 1, "Year:", year);
					
					const parsedDate = new Date(year, month, day);
					if (isNaN(parsedDate.getTime())) {
						console.warn("_parseDate: Invalid DD MMM YYYY date:", dateString);
						return null;
					}
					
					console.log("_parseDate: Successfully parsed DD MMM YYYY date:", parsedDate);
					return parsedDate;
				} catch (error) {
					console.warn("_parseDate: Error parsing DD MMM YYYY date:", dateString, error.message);
					return null;
				}
			}
			
			// Try to parse as standard Date (last resort)
			try {
				console.log("_parseDate: Trying standard Date parsing");
				const parsedDate = new Date(dateString);
				if (isNaN(parsedDate.getTime())) {
					console.warn("_parseDate: Invalid standard date:", dateString);
					return null;
				}
				console.log("_parseDate: Successfully parsed standard date:", parsedDate);
				return parsedDate;
			} catch (error) {
				console.warn("_parseDate: Error parsing standard date:", dateString, error.message);
				return null;
			}
		},

		_applyClientSideFilters: function () {
			// Apply remaining client-side filters (GTIN and SGTIN filters)
			const aInventory = this.oModel.getProperty("/inventory");
			const aGTINFilter = this.oModel.getProperty("/gtinFilter") || [];
			const sSGTINFilter = this.oModel.getProperty("/sgtinFilter");

			let aFiltered = aInventory.filter(item => {
				let bMatch = true;

				if (aGTINFilter.length > 0 && !aGTINFilter.includes(item.gtin)) {
					bMatch = false;
				}

				if (sSGTINFilter && !item.sgtin.toLowerCase().includes(sSGTINFilter.toLowerCase())) {
					bMatch = false;
				}

				return bMatch;
			});

			this.oModel.setProperty("/filteredInventory", aFiltered);
		},

		onClearFilters: function () {
			// Clear all model properties
			this.oModel.setProperty("/statusFilter", "");
			this.oModel.setProperty("/gtinFilter", []);
			this.oModel.setProperty("/sgtinFilter", "");
			this.oModel.setProperty("/poIdFilter", "");
			this.oModel.setProperty("/datePeriodFilter", "");
			this.oModel.setProperty("/dateFromFilter", "");
			this.oModel.setProperty("/dateToFilter", "");
			
			// Also reset UI controls directly to handle manual input cases
			const oStatusFilter = this.byId("statusFilter");
			const oGtinFilter = this.byId("gtinFilter");
			const oSgtinFilter = this.byId("sgtinFilter");
			const oPoIdFilter = this.byId("poIdFilter");
			const oDatePeriodFilter = this.byId("datePeriodFilter");
			const oDateFromFilter = this.byId("dateFromFilter");
			const oDateToFilter = this.byId("dateToFilter");
			
			if (oStatusFilter) oStatusFilter.setSelectedKey("");
			if (oGtinFilter) oGtinFilter.setSelectedKeys([]);
			if (oSgtinFilter) oSgtinFilter.setValue("");
			if (oPoIdFilter) oPoIdFilter.setSelectedKey(""); // Changed back to setSelectedKey since it's ComboBox again
			if (oDatePeriodFilter) oDatePeriodFilter.setSelectedKey("");
			if (oDateFromFilter) oDateFromFilter.setValue("");
			if (oDateToFilter) oDateToFilter.setValue("");
			
			this._loadInventory();
			MessageToast.show("Filters cleared");
		},

		onRefreshInventory: function () {
			this._loadInventory();
			MessageToast.show("Inventory refreshed");
		},

		onItemSelect: function (oEvent) {
			const oContext = oEvent.getSource().getBindingContext();
			const sSGTIN = oContext.getProperty("sgtin");
			MessageToast.show("Selected item: " + sSGTIN);
		},



		onExportToExcel: function () {
			const aFilteredInventory = this.oModel.getProperty("/filteredInventory");
			
			if (!aFilteredInventory || aFilteredInventory.length === 0) {
				MessageBox.information("No data to export. Please check your filters or refresh the inventory.");
				return;
			}

			// Get current filter context for filename
			const sStatusFilter = this.oModel.getProperty("/statusFilter");
			const sPoIdFilter = this.oModel.getProperty("/poIdFilter");
			const sDatePeriodFilter = this.oModel.getProperty("/datePeriodFilter");
			const sDateFromFilter = this.oModel.getProperty("/dateFromFilter");
			const sDateToFilter = this.oModel.getProperty("/dateToFilter");
			
			let sFilenameSuffix = '';
			if (sStatusFilter) sFilenameSuffix += '_' + sStatusFilter;
			if (sPoIdFilter) sFilenameSuffix += '_' + sPoIdFilter;
			if (sDatePeriodFilter) sFilenameSuffix += '_' + sDatePeriodFilter;
			if (sDateFromFilter || sDateToFilter) sFilenameSuffix += '_CustomDateRange';

			// Prepare data for export with new fields
			const aExportData = aFilteredInventory.map(item => ({
				'SGTIN': item.sgtin || '',
				'GTIN': item.gtin || '',
				'Product Name': item.product_name || '',
				'Brand': item.brand || '',
				'PO ID': item.po_id || '',
				'Goods Receipt Date': item.goods_receipt_date ? new Date(item.goods_receipt_date).toLocaleDateString() : '',
				'Status': item.status || '',
				'Location': item.location || '',
				'Batch': item.batch || '',
				'Created Date': item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
				'Updated Date': item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''
			}));

			this._exportToCSV(aExportData, 'SGTIN_Inventory_Export' + sFilenameSuffix);
			
			MessageToast.show(`Exported ${aExportData.length} items to CSV`);
		},

		_exportToCSV: function (aData, sFileName) {
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

		// Formatters
		formatStatus: function (sStatus) {
			switch (sStatus) {
				case "CREATED": return "Warning";
				case "IN_STOCK": return "Success";
				case "SOLD": return "Information";
				default: return "None";
			}
		},

		formatDate: function (sDate) {
			if (!sDate) return "";
			const oDate = new Date(sDate);
			return oDate.toLocaleDateString();
		},

		formatDateTime: function (sDate) {
			if (!sDate) return "";
			const oDate = new Date(sDate);
			return oDate.toLocaleDateString() + " " + oDate.toLocaleTimeString();
		},

		getEventIcon: function (sEventType) {
			switch (sEventType) {
				case "CREATED": return "sap-icon://add";
				case "GOODS_RECEIVED": return "sap-icon://inventory";
				case "STOCK_UPDATE": return "sap-icon://refresh";
				case "SOLD": return "sap-icon://cart";
				default: return "sap-icon://information";
			}
		},

		// Validation functions
		_normalizeStatusInput: function(sInput) {
			// Handle empty or "All Statuses" case - these are valid (means no filter)
			if (!sInput || sInput === 'All Statuses' || sInput.trim() === '') {
				return ''; // Return empty string for no filtering
			}
			
			// Convert user-friendly input to system values
			const statusMap = {
				// Exact matches (case-insensitive)
				'CREATED': 'CREATED',
				'IN_STOCK': 'IN_STOCK', 
				'SOLD': 'SOLD',
				// User-friendly variations
				'created': 'CREATED',
				'Created': 'CREATED',
				'IN STOCK': 'IN_STOCK',
				'in stock': 'IN_STOCK',
				'In Stock': 'IN_STOCK',
				'INSTOCK': 'IN_STOCK',
				'instock': 'IN_STOCK',
				'InStock': 'IN_STOCK',
				'SOLD': 'SOLD',
				'sold': 'SOLD',
				'Sold': 'SOLD'
			};
			
			// Try exact match first
			if (statusMap[sInput]) {
				return statusMap[sInput];
			}
			
			// Try case-insensitive match
			const normalizedInput = sInput.toUpperCase().replace(/\s+/g, '_');
			if (['CREATED', 'IN_STOCK', 'SOLD'].includes(normalizedInput)) {
				return normalizedInput;
			}
			
			// Invalid input
			return null;
		},

		_isValidStatus: function(sStatus) {
			const validStatuses = ["CREATED", "IN_STOCK", "SOLD"];
			// Convert input to uppercase for case-insensitive comparison
			return validStatuses.includes(sStatus.toUpperCase());
		},

		_isValidSGTIN: function(sSgtin) {
			// SGTIN validation - should be a number starting with '01' and be between 30-32 characters
			// Examples: 
			// - 30 chars: 010123456789012345678901234567
			// - 31 chars: 0120001234567891210000000001302 (your example)
			// - 32 chars: 01012345678901234567890123456789
			
			if (!sSgtin || typeof sSgtin !== 'string') {
				return false;
			}
			
			// Must start with '01' and be all digits, length 30-32
			const sgtinPattern = /^01\d{28,30}$/;
			return sgtinPattern.test(sSgtin);
		},

		_extractPOIDFromValue: function(sValue) {
			// Extract PO ID from dropdown values that might include descriptions
			// Examples:
			// "PO-45000012" -> "PO-45000012" (manual input)
			// "PO-45000012 - DEFAULT_SUPPLIER (5 items)" -> "PO-45000012" (dropdown)
			
			if (!sValue) return null;
			
			// Check if it's a simple PO ID (manual input)
			const simplePoMatch = sValue.match(/^PO-\d+$/);
			if (simplePoMatch) {
				return simplePoMatch[0];
			}
			
			// Extract PO ID from dropdown format "PO-XXXXX - Description"
			const dropdownPoMatch = sValue.match(/^(PO-\d+)[\s\-]/);
			if (dropdownPoMatch) {
				return dropdownPoMatch[1];
			}
			
			// If no match found, return null
			return null;
		},

		_isValidPOID: function(sPoId) {
			// PO ID should start with 'PO-' followed by numbers
			const poIdPattern = /^PO-\d+$/;
			return poIdPattern.test(sPoId);
		},

		/**
		 * Synchronize hierarchical filters based on business logic: PO -> GTIN -> SGTIN
		 * When a higher-level filter is selected, update lower-level options
		 */
		_syncHierarchicalFilters: function() {
			const sPoIdFilter = this.oModel.getProperty("/poIdFilter");
			const aGtinFilter = this.oModel.getProperty("/gtinFilter") || [];
			const sSgtinFilter = this.oModel.getProperty("/sgtinFilter");
			const aInventory = this.oModel.getProperty("/inventory") || [];

			// Step 1: Update GTIN options based on selected PO
			if (sPoIdFilter) {
				// Filter GTINs that exist in the selected PO
				const availableGtins = aInventory
					.filter(item => item.po_id === sPoIdFilter)
					.map(item => item.gtin)
					.filter((gtin, index, arr) => arr.indexOf(gtin) === index) // unique values
					.map(gtin => {
						const item = aInventory.find(inv => inv.gtin === gtin);
						return {
							key: gtin,
							text: gtin + " - " + (item.product_name || 'Unknown Product')
						};
					});

				this.oModel.setProperty("/gtins", availableGtins);
				
				// Clear GTIN filter if current selection is no longer valid
				const validGtinFilter = aGtinFilter.filter(selectedGtin => 
					availableGtins.some(available => available.key === selectedGtin)
				);
				
				if (validGtinFilter.length !== aGtinFilter.length) {
					this.oModel.setProperty("/gtinFilter", validGtinFilter);
					this.byId("gtinFilter").setSelectedKeys(validGtinFilter);
				}
			} else {
				// No PO selected - show all GTINs
				this._loadAllGtinsFromInventory(aInventory);
			}

			// Step 2: Validate SGTIN based on PO and GTIN selection
			if (sSgtinFilter && (sPoIdFilter || aGtinFilter.length > 0)) {
				let sgtinValid = true;
				
				// Check if SGTIN exists in selected PO
				if (sPoIdFilter) {
					const sgtinInPo = aInventory.some(item => 
						item.po_id === sPoIdFilter && item.sgtin === sSgtinFilter
					);
					if (!sgtinInPo) sgtinValid = false;
				}
				
				// Check if SGTIN matches selected GTINs
				if (aGtinFilter.length > 0) {
					const sgtinItem = aInventory.find(item => item.sgtin === sSgtinFilter);
					if (!sgtinItem || !aGtinFilter.includes(sgtinItem.gtin)) {
						sgtinValid = false;
					}
				}
				
				// Clear SGTIN if it's no longer valid
				if (!sgtinValid) {
					this.oModel.setProperty("/sgtinFilter", "");
					this.byId("sgtinFilter").setValue("");
					MessageToast.show("SGTIN filter cleared - not compatible with current selection");
				}
			}
		},

		/**
		 * Load all unique GTINs from current inventory for dropdown
		 */
		_loadAllGtinsFromInventory: function(aInventory) {
			const uniqueGTINs = [];
			const seenGTINs = new Set();

			aInventory.forEach(item => {
				if (!seenGTINs.has(item.gtin)) {
					uniqueGTINs.push({
						key: item.gtin,
						text: item.gtin + " - " + (item.product_name || 'Unknown Product')
					});
					seenGTINs.add(item.gtin);
				}
			});

			this.oModel.setProperty("/gtins", uniqueGTINs);
		}

	});
});
