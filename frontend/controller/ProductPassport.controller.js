sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, MessageBox, JSONModel) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.ProductPassport", {

		onInit: function () {
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oRouter.getRoute("productPassport").attachPatternMatched(this._onObjectMatched, this);
		},

		_onObjectMatched: function (oEvent) {
			const sSGTIN = oEvent.getParameter("arguments").sgtin;
			this._loadProductPassport(sSGTIN);
		},

		onNavBack: function () {
			window.history.go(-1);
		},

		_loadProductPassport: function (sSGTIN) {
			// Show loading state
			const oLoadingModel = new JSONModel({
				sgtin: sSGTIN,
				product: {
					name: "Loading...",
					brand: "Loading...",
					status: "Loading"
				}
			});
			this.getView().setModel(oLoadingModel);

			// Load product data from inventory service
			this._loadProductData(sSGTIN);
		},

		_loadProductData: function (sSGTIN) {
			const sServiceUrl = "http://localhost:3003/api/inventory";
			
			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				success: (data) => {
					const oProduct = data.find(item => item.sgtin === sSGTIN);
					
					if (oProduct) {
						this._buildProductPassport(sSGTIN, oProduct);
					} else {
						this._buildSamplePassport(sSGTIN);
					}
				},
				error: (xhr, status, error) => {
					console.log("Failed to load product data:", error);
					this._buildSamplePassport(sSGTIN);
				}
			});
		},

		_buildProductPassport: function (sSGTIN, oProduct) {
			const sSerialNumber = sSGTIN.substring(18); // Extract serial from SGTIN
			
			const oPassportData = {
				sgtin: sSGTIN,
				serialNumber: sSerialNumber,
				product: {
					name: oProduct.product_name || "Unknown Product",
					brand: oProduct.brand || "Unknown Brand",
					gtin: oProduct.gtin,
					status: oProduct.status,
					batch: oProduct.batch,
					manufacture_date: oProduct.manufacture_date
				},
				manufacturing: this._getManufacturingData(oProduct.brand, oProduct.batch),
				sustainability: this._getSustainabilityData(oProduct.brand),
				lifecycle: this._getLifecycleData(sSGTIN),
				supplyChain: this._getSupplyChainData(oProduct.brand)
			};

			const oModel = new JSONModel(oPassportData);
			this.getView().setModel(oModel);
		},

		_buildSamplePassport: function (sSGTIN) {
			const sSerialNumber = sSGTIN.substring(18);
			const sGTIN = sSGTIN.substring(2, 16);
			
			const oPassportData = {
				sgtin: sSGTIN,
				serialNumber: sSerialNumber,
				product: {
					name: "Adidas UltraBoost 22",
					brand: "Adidas",
					gtin: sGTIN,
					status: "IN_STOCK",
					batch: "JAN26-ADIDAS-BLUE",
					manufacture_date: "2026-01-15T00:00:00.000Z"
				},
				manufacturing: this._getManufacturingData("Adidas", "JAN26-ADIDAS-BLUE"),
				sustainability: this._getSustainabilityData("Adidas"),
				lifecycle: this._getLifecycleData(sSGTIN),
				supplyChain: this._getSupplyChainData("Adidas")
			};

			const oModel = new JSONModel(oPassportData);
			this.getView().setModel(oModel);
		},

		_getManufacturingData: function (sBrand, sBatch) {
			const oManufacturingData = {
				"Adidas": {
					factory: "Adidas Factory Vietnam - Ho Chi Minh City",
					country: "Vietnam",
					materials: "Recycled polyester, organic cotton, rubber sole"
				},
				"Nike": {
					factory: "Nike Manufacturing Thailand - Bangkok",
					country: "Thailand", 
					materials: "Flyknit upper, ZoomX foam, carbon fiber plate"
				},
				"H&M": {
					factory: "H&M Supplier Bangladesh - Dhaka",
					country: "Bangladesh",
					materials: "Organic cotton, recycled polyester"
				}
			};

			return oManufacturingData[sBrand] || {
				factory: "Global Manufacturing Facility",
				country: "Unknown",
				materials: "Mixed materials"
			};
		},

		_getSustainabilityData: function (sBrand) {
			const oSustainabilityData = {
				"Adidas": {
					score: 8,
					carbon_footprint: 12.5,
					recyclable: "95%",
					ethical_sourcing: "Certified",
					certifications: {
						organic: false,
						fair_trade: true,
						recycled_materials: true
					}
				},
				"Nike": {
					score: 7,
					carbon_footprint: 14.2,
					recyclable: "85%",
					ethical_sourcing: "Certified",
					certifications: {
						organic: false,
						fair_trade: false,
						recycled_materials: true
					}
				},
				"H&M": {
					score: 6,
					carbon_footprint: 8.9,
					recyclable: "75%",
					ethical_sourcing: "Improving",
					certifications: {
						organic: true,
						fair_trade: true,
						recycled_materials: false
					}
				}
			};

			return oSustainabilityData[sBrand] || {
				score: 5,
				carbon_footprint: 15.0,
				recyclable: "60%",
				ethical_sourcing: "Unknown",
				certifications: {
					organic: false,
					fair_trade: false,
					recycled_materials: false
				}
			};
		},

		_getLifecycleData: function (sSGTIN) {
			// For demo purposes, create sample lifecycle events
			const oLifecycleData = {
				events: [
					{
						event_type: "CREATED",
						description: "SGTIN generated for product serialization",
						timestamp: "2026-01-20T09:00:00.000Z"
					},
					{
						event_type: "MANUFACTURED",
						description: "Product manufactured and quality tested",
						timestamp: "2026-01-20T12:00:00.000Z"
					},
					{
						event_type: "GOODS_RECEIVED",
						description: "Product received at distribution center",
						timestamp: "2026-01-20T16:30:00.000Z"
					},
					{
						event_type: "IN_STOCK",
						description: "Product available for sale",
						timestamp: "2026-01-20T17:00:00.000Z"
					}
				]
			};

			return oLifecycleData;
		},

		_getSupplyChainData: function (sBrand) {
			const oSupplyChainData = {
				"Adidas": {
					raw_materials: {
						location: "Recycling Facility, Netherlands",
						date: "2026-01-10"
					},
					manufacturing: {
						location: "Ho Chi Minh City, Vietnam",
						date: "2026-01-15"
					},
					distribution: {
						location: "Distribution Center, Germany",
						date: "2026-01-18"
					},
					retail: {
						location: "Adidas Store, Munich",
						date: "2026-01-20"
					}
				},
				"Nike": {
					raw_materials: {
						location: "Sustainable Materials, USA",
						date: "2026-01-08"
					},
					manufacturing: {
						location: "Bangkok, Thailand",
						date: "2026-01-12"
					},
					distribution: {
						location: "Nike Distribution, USA",
						date: "2026-01-16"
					},
					retail: {
						location: "Nike Store, New York",
						date: "2026-01-19"
					}
				}
			};

			return oSupplyChainData[sBrand] || {
				raw_materials: {
					location: "Global Supplier",
					date: "2026-01-10"
				},
				manufacturing: {
					location: "Manufacturing Facility",
					date: "2026-01-15"
				},
				distribution: {
					location: "Distribution Center",
					date: "2026-01-18"
				},
				retail: {
					location: "Retail Location",
					date: "2026-01-20"
				}
			};
		},

		onViewInInventory: function () {
			this.oRouter.navTo("inventory");
		},

		onReportIssue: function () {
			MessageBox.information(
				"Issue reporting functionality would integrate with customer service systems.\n\n" +
				"This feature would allow customers to report:\n" +
				"• Quality issues\n" +
				"• Counterfeit concerns\n" +
				"• Environmental impact feedback\n" +
				"• Supply chain transparency requests",
				{
					title: "Report Issue"
				}
			);
		},

		onSharePassport: function () {
			const sSGTIN = this.getView().getModel().getProperty("/sgtin");
			const sUrl = window.location.origin + window.location.pathname + "#/passport/" + sSGTIN;
			
			if (navigator.share) {
				navigator.share({
					title: 'Digital Product Passport',
					text: 'Check out this product\'s digital passport with full transparency information.',
					url: sUrl
				}).catch(console.error);
			} else {
				// Fallback for browsers without native sharing
				navigator.clipboard.writeText(sUrl).then(() => {
					MessageToast.show("Product passport URL copied to clipboard");
				}).catch(() => {
					MessageBox.information("Share this product passport:\n" + sUrl, {
						title: "Share Product Passport"
					});
				});
			}
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
				case "MANUFACTURED": return "sap-icon://factory";
				case "GOODS_RECEIVED": return "sap-icon://inventory";
				case "IN_STOCK": return "sap-icon://product";
				case "SOLD": return "sap-icon://cart";
				default: return "sap-icon://information";
			}
		}

	});
});
