sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"../utils/EventBus"
], function(Controller, JSONModel, MessageToast, MessageBox, EventBus) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.Main", {

		onInit: function() {
			// Subscribe to data change events for auto-refresh
			this._subscribeToEvents();
			
			// Subscribe to route events to refresh when returning to dashboard
			this.oRouter = this.getOwnerComponent().getRouter();
			this.oRouter.getRoute("main").attachMatched(this._onRouteMatched, this);
			
			// Initialize dashboard data model
			this.oModel = new JSONModel({
				lastUpdated: new Date().toLocaleString(),
				kpis: {
					totalPurchaseOrders: 0,
					openPurchaseOrders: 0,
					partiallyReceivedPOs: 0,
					fullyReceivedPOs: 0,
					expectedDeliveries: 0,
					totalInventoryItems: 0,
					inStockItems: 0,
					soldItems: 0,
					totalStockValue: "0.00",
					totalSalesAmount: "0.00",
					totalSalesCount: 0,
					averageSaleValue: "0.00",
					todaysSales: "0.00",
					counterfeitDetections: 0,
					lastCounterfeitDetection: "Never",
					// Goods Receipt KPIs
					totalGoodsReceived: 0,
					pendingReceipts: 0,
					receivedToday: 0,
					itemsReceivedToday: 0
				},
				inventoryDistribution: {
					totalItems: 0,
					inStock: 0,
					sold: 0,
					inTransit: 0,
					returned: 0,
					created: 0,
					inStockPercentage: 0,
					soldPercentage: 0
				},
				recentActivity: [],
				isLoading: true
			});

			this.getView().setModel(this.oModel);
			this._loadDashboardData();
		},

		onExit: function() {
			// Clean up event subscriptions when controller is destroyed
			this._unsubscribeFromEvents();
		},

		_subscribeToEvents: function() {
			// Subscribe to all data change events
			EventBus.subscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this._onDataChanged, this);
			EventBus.subscribe(EventBus.Events.INVENTORY_CHANGED, this._onDataChanged, this);
			EventBus.subscribe(EventBus.Events.SALES_CHANGED, this._onDataChanged, this);
			EventBus.subscribe(EventBus.Events.GOODS_RECEIPT_PROCESSED, this._onDataChanged, this);
			EventBus.subscribe(EventBus.Events.POS_TRANSACTION_COMPLETED, this._onDataChanged, this);
			EventBus.subscribe(EventBus.Events.DASHBOARD_REFRESH_NEEDED, this._onDataChanged, this);
		},

		_unsubscribeFromEvents: function() {
			// Unsubscribe from all events to prevent memory leaks
			EventBus.unsubscribe(EventBus.Events.PURCHASE_ORDERS_CHANGED, this);
			EventBus.unsubscribe(EventBus.Events.INVENTORY_CHANGED, this);
			EventBus.unsubscribe(EventBus.Events.SALES_CHANGED, this);
			EventBus.unsubscribe(EventBus.Events.GOODS_RECEIPT_PROCESSED, this);
			EventBus.unsubscribe(EventBus.Events.POS_TRANSACTION_COMPLETED, this);
			EventBus.unsubscribe(EventBus.Events.DASHBOARD_REFRESH_NEEDED, this);
		},

		_onDataChanged: function(data) {
			// Auto-refresh dashboard when any relevant data changes
			console.log("Main controller: Data changed, refreshing dashboard...", data);
			this._loadDashboardData();
		},

		_onRouteMatched: function() {
			// Auto-refresh dashboard data when user returns to main page
			console.log("Main controller: Route matched - refreshing dashboard data...");
			
			// FIXED: Preserve scroll position to avoid jarring auto-scroll to top
			const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
			
			this._loadDashboardData().then(() => {
				// Restore scroll position after data refresh
				setTimeout(() => {
					window.scrollTo(0, scrollPosition);
				}, 100); // Small delay to ensure DOM has updated
			});
		},

		onRefreshDashboard: function() {
			MessageToast.show("Refreshing dashboard data...");
			this._loadDashboardData();
		},

		_loadDashboardData: function() {
			this.oModel.setProperty("/isLoading", true);
			
			// Load data from all services in parallel and return the promise
			return Promise.all([
				this._loadPurchaseOrdersData(),
				this._loadInventoryData(),
				this._loadSalesData(),
				this._loadCounterfeitData()
			]).then(() => {
				this._generateRecentActivity();
				this._updateInventoryDistribution();
				this.oModel.setProperty("/lastUpdated", new Date().toLocaleString());
				this.oModel.setProperty("/isLoading", false);
				MessageToast.show("Dashboard data updated successfully");
			}).catch((error) => {
				console.error("Error loading dashboard data:", error);
				MessageToast.show("Some dashboard data could not be loaded");
				this.oModel.setProperty("/isLoading", false);
				throw error; // Re-throw to allow scroll position restoration even on error
			});
		},

		_loadPurchaseOrdersData: function() {
			return new Promise((resolve) => {
				jQuery.ajax({
					url: "http://localhost:3002/api/purchase-orders?mandt=100",
					type: "GET",
					headers: {
						'X-API-Key': 'dev-api-key-12345'
					},
					success: (data) => {
						const purchaseOrders = data.purchaseOrders || [];
						const totalPOs = purchaseOrders.length || 0;
						const openPOs = purchaseOrders.filter(po => po.status === 'OPEN').length || 0;
						const partiallyReceivedPOs = purchaseOrders.filter(po => po.status === 'PARTIALLY_RECEIVED').length || 0;
						const fullyReceivedPOs = purchaseOrders.filter(po => po.status === 'FULLY_RECEIVED').length || 0;
						const expectedDeliveries = purchaseOrders.filter(po => 
							po.status === 'OPEN' && po.expected_delivery_date && 
							new Date(po.expected_delivery_date) <= new Date(Date.now() + 7*24*60*60*1000)
						).length || 0;

						this.oModel.setProperty("/kpis/totalPurchaseOrders", totalPOs);
						this.oModel.setProperty("/kpis/openPurchaseOrders", openPOs);
						this.oModel.setProperty("/kpis/partiallyReceivedPOs", partiallyReceivedPOs);
						this.oModel.setProperty("/kpis/fullyReceivedPOs", fullyReceivedPOs);
						this.oModel.setProperty("/kpis/expectedDeliveries", expectedDeliveries);
						resolve();
					},
					error: () => {
						console.warn("Could not load purchase orders data");
						resolve();
					}
				});
			});
		},

		_loadInventoryData: function() {
			return new Promise((resolve) => {
				// Load both inventory and goods receipts data in parallel
				Promise.all([
					this._loadInventoryItems(),
					this._loadGoodsReceipts()
				]).then(() => {
					resolve();
				}).catch(() => {
					console.warn("Could not load inventory data");
					resolve();
				});
			});
		},

		_loadInventoryItems: function() {
			return new Promise((resolve) => {
				jQuery.ajax({
					url: "http://localhost:3003/api/inventory?mandt=100",
					type: "GET",
					headers: {
						'X-API-Key': 'dev-api-key-12345'
					},
					success: (data) => {
						const allItems = data.inventory || [];
						
						// FIXED: Only count items that are physically in inventory (not CREATED status)
						const actualInventoryItems = allItems.filter(item => 
							item.status === 'IN_STOCK' || 
							item.status === 'SOLD' || 
							item.status === 'IN_TRANSIT' || 
							item.status === 'RETURNED'
						);
						
						const totalItems = allItems.length || 0; // Total of ALL items including CREATED
						const actualInventoryCount = actualInventoryItems.length || 0; // Only physical inventory
						const inStockItems = allItems.filter(item => item.status === 'IN_STOCK').length || 0;
						const soldItems = allItems.filter(item => item.status === 'SOLD').length || 0;
						const inTransitItems = allItems.filter(item => item.status === 'IN_TRANSIT').length || 0;
						const returnedItems = allItems.filter(item => item.status === 'RETURNED').length || 0;
						const createdItems = allItems.filter(item => item.status === 'CREATED').length || 0;

						// Calculate stock value (assuming products have prices)
						let totalStockValue = 0;
						allItems.forEach(item => {
							if (item.status === 'IN_STOCK' && item.price) {
								totalStockValue += parseFloat(item.price) || 0;
							}
						});

						// CHANGED: Show ALL items (including CREATED) for consistency with Inventory page
						// CREATED items are SGTINs generated but not yet received via Goods Receipt
						this.oModel.setProperty("/kpis/totalInventoryItems", totalItems);
						this.oModel.setProperty("/kpis/inStockItems", inStockItems);
						this.oModel.setProperty("/kpis/soldItems", soldItems);
						this.oModel.setProperty("/kpis/createdItems", createdItems);
						this.oModel.setProperty("/kpis/totalStockValue", totalStockValue.toFixed(2));

						// For now, use created items as pending receipts (items that exist but haven't been physically received)
						const pendingReceipts = createdItems;

						this.oModel.setProperty("/kpis/pendingReceipts", pendingReceipts);
						// Note: itemsReceivedToday is now calculated in _loadGoodsReceipts() using actual receipt data

						// Update inventory distribution for the new tiles
						this.oModel.setProperty("/inventoryDistribution/totalItems", totalItems);
						this.oModel.setProperty("/inventoryDistribution/inStock", inStockItems);
						this.oModel.setProperty("/inventoryDistribution/sold", soldItems);
						this.oModel.setProperty("/inventoryDistribution/inTransit", inTransitItems);
						this.oModel.setProperty("/inventoryDistribution/returned", returnedItems);
						this.oModel.setProperty("/inventoryDistribution/created", createdItems);

						resolve();
					},
					error: () => {
						console.warn("Could not load inventory items");
						resolve();
					}
				});
			});
		},

		_loadGoodsReceipts: function() {
			return new Promise((resolve) => {
				jQuery.ajax({
					url: "http://localhost:3003/api/goods-receipts?mandt=100",
					type: "GET",
					headers: {
						'X-API-Key': 'dev-api-key-12345'
					},
					success: (data) => {
						// FIXED: Backend returns 'receipts' not 'goodsReceipts'
						const goodsReceipts = data.receipts || [];
						
						// Total number of goods receipt transactions
						const totalGoodsReceived = goodsReceipts.length || 0;

						// Calculate items received today by summing items_count from today's receipts
						const today = new Date().toDateString();
						let itemsReceivedToday = 0;
						let receiptsToday = 0;
						
						goodsReceipts.forEach(receipt => {
							if (receipt.received_at && new Date(receipt.received_at).toDateString() === today) {
								itemsReceivedToday += parseInt(receipt.items_count) || 0;
								receiptsToday++;
							}
						});

						console.log("Loaded goods receipts:", totalGoodsReceived, "Items received today:", itemsReceivedToday, goodsReceipts);
						this.oModel.setProperty("/kpis/totalGoodsReceived", totalGoodsReceived);
						this.oModel.setProperty("/kpis/itemsReceivedToday", itemsReceivedToday);

						resolve();
					},
					error: (xhr, status, error) => {
						console.warn("Could not load goods receipts data:", error);
						console.warn("Response:", xhr.responseText);
						// Set default values if goods receipts endpoint fails
						this.oModel.setProperty("/kpis/totalGoodsReceived", 0);
						this.oModel.setProperty("/kpis/itemsReceivedToday", 0);
						resolve();
					}
				});
			});
		},

		_loadSalesData: function() {
			return new Promise((resolve) => {
				jQuery.ajax({
					url: "http://localhost:3004/api/sales?mandt=100",
					type: "GET",
					headers: {
						'X-API-Key': 'dev-api-key-12345'
					},
					success: (response) => {
						const salesData = response.sales || [];
						const totalSalesCount = salesData.length || 0;
						
						let totalSalesAmount = 0;
						let todaysSales = 0;
						const today = new Date().toDateString();

						salesData.forEach(sale => {
							const saleAmount = parseFloat(sale.total_amount) || 0;
							totalSalesAmount += saleAmount;
							
							if (new Date(sale.sold_at).toDateString() === today) {
								todaysSales += saleAmount;
							}
						});

						const averageSaleValue = totalSalesCount > 0 ? (totalSalesAmount / totalSalesCount) : 0;

						this.oModel.setProperty("/kpis/totalSalesAmount", totalSalesAmount.toFixed(2));
						this.oModel.setProperty("/kpis/totalSalesCount", totalSalesCount);
						this.oModel.setProperty("/kpis/averageSaleValue", averageSaleValue.toFixed(2));
						this.oModel.setProperty("/kpis/todaysSales", todaysSales.toFixed(2));

						resolve();
					},
					error: () => {
						console.warn("Could not load sales data");
						resolve();
					}
				});
			});
		},

		_loadCounterfeitData: function() {
			return new Promise((resolve) => {
				jQuery.ajax({
					url: "http://localhost:3004/api/sales/logs/counterfeit?mandt=100",
					type: "GET",
					headers: {
						'X-API-Key': 'dev-api-key-12345'
					},
					success: (response) => {
						const counterfeitLogs = response.counterfeitLogs || [];
						const totalDetections = counterfeitLogs.length || 0;
						
						let lastDetection = "Never";
						if (counterfeitLogs.length > 0) {
							const lastLog = counterfeitLogs[0]; // Assuming sorted by date DESC
							lastDetection = new Date(lastLog.detected_at).toLocaleDateString();
						}

						this.oModel.setProperty("/kpis/counterfeitDetections", totalDetections);
						this.oModel.setProperty("/kpis/lastCounterfeitDetection", lastDetection);

						resolve();
					},
					error: () => {
						console.warn("Could not load counterfeit data");
						// Set default values for security
						this.oModel.setProperty("/kpis/counterfeitDetections", 0);
						this.oModel.setProperty("/kpis/lastCounterfeitDetection", "Service Unavailable");
						resolve();
					}
				});
			});
		},

		_updateInventoryDistribution: function() {
			const inStock = this.oModel.getProperty("/inventoryDistribution/inStock");
			const sold = this.oModel.getProperty("/inventoryDistribution/sold");
			const total = inStock + sold;

			if (total > 0) {
				const inStockPercentage = Math.round((inStock / total) * 100);
				const soldPercentage = Math.round((sold / total) * 100);
				
				this.oModel.setProperty("/inventoryDistribution/inStockPercentage", inStockPercentage);
				this.oModel.setProperty("/inventoryDistribution/soldPercentage", soldPercentage);
			}
		},

		_generateRecentActivity: function() {
			const recentActivity = [
				{
					icon: "📋",
					title: "Purchase Order Created",
					description: `${this.oModel.getProperty("/kpis/openPurchaseOrders")} orders awaiting delivery`,
					timestamp: "2 hours ago"
				},
				{
					icon: "📦",
					title: "Goods Receipt Processed",
					description: `${this.oModel.getProperty("/kpis/inStockItems")} items received into inventory`,
					timestamp: "4 hours ago"
				},
				{
					icon: "🛒",
					title: "Sales Transaction",
					description: `€${this.oModel.getProperty("/kpis/todaysSales")} in sales today`,
					timestamp: "6 hours ago"
				},
				{
					icon: "🛡️",
					title: "Security Check",
					description: `${this.oModel.getProperty("/kpis/counterfeitDetections")} counterfeit attempts blocked`,
					timestamp: "8 hours ago"
				},
				{
					icon: "📊",
					title: "Inventory Update",
					description: `${this.oModel.getProperty("/kpis/totalInventoryItems")} items tracked in system`,
					timestamp: "12 hours ago"
				}
			];

			this.oModel.setProperty("/recentActivity", recentActivity);
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
		},

		onNavigateToSgtinLookup: function() {
			this.getOwnerComponent().getRouter().navTo("sgtinLookup");
		}

	});

});
