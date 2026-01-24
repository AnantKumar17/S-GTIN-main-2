sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/core/format/DateFormat",
	"../utils/ApiConfig"
], function (Controller, JSONModel, MessageToast, MessageBox, DateFormat, ApiConfig) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.PurchaseOrderDetail", {

		onInit: function () {
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oRouter.getRoute("purchaseOrderDetail").attachPatternMatched(this._onObjectMatched, this);

			this.oModel = new JSONModel({
				purchaseOrder: {},
				labels: [],
				labelCount: 0,
				loading: false
			});
			this.getView().setModel(this.oModel);
		},

		_onObjectMatched: function (oEvent) {
			const sPoId = oEvent.getParameter("arguments").poId;
			this._loadPurchaseOrderDetails(sPoId);
			this._loadBarcodeLabels(sPoId);
		},

		_loadPurchaseOrderDetails: function (sPoId) {
			this.oModel.setProperty("/loading", true);
			
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.PO_SERVICE) + "/purchase-orders/" + sPoId + "?mandt=100";

			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					this.oModel.setProperty("/loading", false);
					if (data && data.purchaseOrder) {
						this.oModel.setProperty("/purchaseOrder", data.purchaseOrder);
						MessageToast.show("Purchase order loaded successfully");
					}
				},
				error: (xhr, status, error) => {
					this.oModel.setProperty("/loading", false);
					let errorMessage = "Failed to load purchase order";
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

		_loadBarcodeLabels: function (sPoId) {
			const sServiceUrl = ApiConfig.getServiceUrl(ApiConfig.PO_SERVICE) + "/purchase-orders/" + sPoId + "/labels?mandt=100";

			jQuery.ajax({
				url: sServiceUrl,
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (data) => {
					if (data && data.labels) {
						this.oModel.setProperty("/labels", data.labels);
						this.oModel.setProperty("/labelCount", data.labels.length);
						MessageToast.show("Loaded " + data.labels.length + " barcode labels");
					}
				},
				error: (xhr, status, error) => {
					let errorMessage = "Failed to load barcode labels";
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

		onNavBack: function () {
			this.oRouter.navTo("purchaseOrders");
		},

		onPrintAllLabels: function () {
			const labels = this.oModel.getProperty("/labels");
			if (!labels || labels.length === 0) {
				MessageBox.warning("No labels available to print");
				return;
			}

			// Create a print-friendly HTML page with all labels
			let printContent = this._generatePrintHTML(labels);
			
			// Open print dialog
			const printWindow = window.open('', '_blank', 'width=800,height=600');
			printWindow.document.write(printContent);
			printWindow.document.close();
			printWindow.focus();
			
			setTimeout(() => {
				printWindow.print();
			}, 500);
		},

		onPrintSingleLabel: function (oEvent) {
			const oBindingContext = oEvent.getSource().getBindingContext();
			const label = oBindingContext.getObject();

			// Create print content for single label
			let printContent = this._generatePrintHTML([label]);
			
			// Open print dialog
			const printWindow = window.open('', '_blank', 'width=800,height=600');
			printWindow.document.write(printContent);
			printWindow.document.close();
			printWindow.focus();
			
			setTimeout(() => {
				printWindow.print();
			}, 500);
		},

		_generatePrintHTML: function (labels) {
			const poId = this.oModel.getProperty("/purchaseOrder/po_id");
			const productName = this.oModel.getProperty("/purchaseOrder/product_name");
			
			let html = `
<!DOCTYPE html>
<html>
<head>
	<title>Barcode Labels - ${poId}</title>
	<style>
		@page { size: A4; margin: 10mm; }
		body { font-family: Arial, sans-serif; }
		.label-page { page-break-after: always; padding: 20px; }
		.label { border: 2px solid #333; padding: 20px; margin-bottom: 30px; }
		.label-header { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
		.label-info { margin: 10px 0; }
		.label-row { display: flex; justify-content: space-between; margin: 10px 0; }
		.label-field { font-size: 14px; }
		.label-field strong { font-weight: bold; }
		.barcode-container { text-align: center; margin: 20px 0; }
		.barcode-container img { max-width: 100%; height: auto; }
		.barcode-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
		@media print {
			.label { page-break-inside: avoid; }
		}
	</style>
</head>
<body>
	<h1>Barcode Labels - ${poId}</h1>
	<h2>Product: ${productName}</h2>
	<hr/>
`;

			labels.forEach((label, index) => {
				html += `
	<div class="label">
		<div class="label-header">Label ${index + 1} of ${labels.length}</div>
		<div class="label-info">
			<div class="label-row">
				<div class="label-field"><strong>SGTIN:</strong> ${label.sgtin}</div>
				<div class="label-field"><strong>Serial:</strong> ${label.serialNumber}</div>
			</div>
			<div class="label-row">
				<div class="label-field"><strong>Status:</strong> ${label.status}</div>
				<div class="label-field"><strong>Location:</strong> ${label.location || 'N/A'}</div>
			</div>
		</div>
		<div class="barcode-container">
			<div class="barcode-title">Code 128 Barcode</div>
			${label.barcode ? `<img src="${label.barcode}" alt="Barcode" style="width: 400px;"/>` : '<p>Barcode not available</p>'}
		</div>
		<div class="barcode-container">
			<div class="barcode-title">QR Code</div>
			${label.qrCode ? `<img src="${label.qrCode}" alt="QR Code" style="width: 200px;"/>` : '<p>QR Code not available</p>'}
		</div>
	</div>
`;
			});

			html += `
</body>
</html>
`;
			return html;
		},

		onExportLabels: function () {
			const labels = this.oModel.getProperty("/labels");
			if (!labels || labels.length === 0) {
				MessageBox.warning("No labels available to export");
				return;
			}

			// Create CSV export
			let csvContent = "data:text/csv;charset=utf-8,";
			csvContent += "SGTIN,Serial Number,Status,Location,Barcode Available,QR Code Available\n";
			
			labels.forEach(label => {
				csvContent += `"${label.sgtin}","${label.serialNumber}","${label.status}","${label.location || 'N/A'}","${label.barcode ? 'Yes' : 'No'}","${label.qrCode ? 'Yes' : 'No'}"\n`;
			});

			const encodedUri = encodeURI(csvContent);
			const link = document.createElement("a");
			link.setAttribute("href", encodedUri);
			link.setAttribute("download", `barcode_labels_${this.oModel.getProperty("/purchaseOrder/po_id")}.csv`);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			MessageToast.show("Labels exported successfully");
		},

		onDownloadLabel: function (oEvent) {
			const oBindingContext = oEvent.getSource().getBindingContext();
			const label = oBindingContext.getObject();

			if (!label.barcode) {
				MessageBox.warning("Barcode not available for this label");
				return;
			}

			// Download single barcode as PNG
			const link = document.createElement("a");
			link.href = label.barcode;
			link.download = `barcode_${label.sgtin}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			MessageToast.show("Barcode image downloaded");
		},

		formatStatus: function (sStatus) {
			const statusMap = {
				"OPEN": "Warning",
				"PARTIALLY_RECEIVED": "Information",
				"FULLY_RECEIVED": "Success",
				"CANCELLED": "Error",
				"CREATED": "Information",
				"IN_STOCK": "Success",
				"SOLD": "None"
			};
			return statusMap[sStatus] || "None";
		},

		formatDateTime: function (sDate) {
			if (!sDate) return "";
			const oDateFormat = DateFormat.getDateTimeInstance({
				pattern: "dd/MM/yyyy HH:mm"
			});
			return oDateFormat.format(new Date(sDate));
		}

	});
});
