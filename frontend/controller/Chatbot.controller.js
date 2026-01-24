sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, MessageBox, JSONModel) {
	"use strict";

	return Controller.extend("com.sgtin.lifecycle.controller.Chatbot", {

		onInit: function () {
			this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			this.oModel = new JSONModel({
				messages: [
					{
						sender: "assistant",
						message: "Hello! I'm your SGTIN Lifecycle Assistant. I can help you with information about purchase orders, inventory, sales, and more. Try asking me a question or use the quick actions below.",
						timestamp: new Date().toISOString()
					}
				],
				currentMessage: ""
			});
			this.getView().setModel(this.oModel);
		},

		onNavBack: function () {
			this.oRouter.navTo("main");
		},

		onSendMessage: function () {
			const sMessage = this.oModel.getProperty("/currentMessage").trim();
			
			if (!sMessage) {
				MessageToast.show("Please enter a message");
				return;
			}

			// Add user message
			this._addMessage("user", sMessage);
			this.oModel.setProperty("/currentMessage", "");

			// Process the message and get response
			this._processUserMessage(sMessage);
		},


		onQuickAction: function (oEvent) {
			const sAction = oEvent.getSource().data("action");
			this._executeQuickAction(sAction);
		},

		onClearChat: function () {
			MessageBox.confirm("Clear all chat messages?", {
				onClose: (sAction) => {
					if (sAction === MessageBox.Action.OK) {
						this.oModel.setProperty("/messages", [
							{
								sender: "assistant",
								message: "Chat cleared. How can I help you today?",
								timestamp: new Date().toISOString()
							}
						]);
						this._scrollToBottom();
					}
				}
			});
		},

		_addMessage: function (sSender, sMessage, aData = null) {
			const aMessages = this.oModel.getProperty("/messages");
			const oMessage = {
				sender: sSender,
				message: sMessage,
				timestamp: new Date().toISOString()
			};

			if (aData && aData.length > 0) {
				oMessage.data = aData;
			}

			aMessages.push(oMessage);
			this.oModel.setProperty("/messages", aMessages);
			
			// Auto-scroll to bottom
			setTimeout(() => this._scrollToBottom(), 100);
		},

		_scrollToBottom: function () {
			const oScrollContainer = this.byId("chatMessagesContainer");
			if (oScrollContainer) {
				oScrollContainer.scrollTo(0, 9999);
			}
		},

		_processUserMessage: function (sMessage) {
			// Show typing indicator
			this._addMessage("assistant", "Thinking... 🤔");
			
			// Use the intelligent chatbot service instead of direct API calls
			setTimeout(() => {
				this._removeLastMessage();
				this._queryIntelligentChatbot(sMessage);
			}, 800);
		},

		_removeLastMessage: function () {
			const aMessages = this.oModel.getProperty("/messages");
			aMessages.pop();
			this.oModel.setProperty("/messages", aMessages);
		},

		_queryIntelligentChatbot: function (sMessage) {
			console.log("DEBUG: Querying intelligent chatbot service with:", sMessage);
			
			jQuery.ajax({
				url: "http://localhost:3005/api/chat/query",
				type: "POST",
				headers: {
					'Content-Type': 'application/json'
				},
				data: JSON.stringify({
					mandt: "100",
					question: sMessage,
					conversationId: this._conversationId || null
				}),
				success: (chatResponse) => {
					console.log("DEBUG: Chatbot service response:", chatResponse);
					
					// Store conversation ID for context
					if (chatResponse.conversationId) {
						this._conversationId = chatResponse.conversationId;
					}
					
					// Display the natural language answer
					const answer = chatResponse.answer || "I couldn't process that request.";
					
					// Convert newlines to HTML breaks for display
					const formattedAnswer = answer.replace(/\n/g, '<br/>');
					
					// Add the response with any structured data
					const structuredData = chatResponse.data && chatResponse.data.results && chatResponse.data.results.length > 0 ? 
						chatResponse.data.results : null;
					
					this._addMessage("assistant", formattedAnswer, structuredData);
				},
				error: (xhr, status, error) => {
					console.error("Chatbot service error:", error, xhr.responseText);
					
					// Fallback to direct API calls when chatbot service fails
					console.log("DEBUG: Falling back to direct API calls");
					this._addMessage("assistant", "The intelligent assistant is temporarily unavailable. Let me try to help you with direct data access...");
					
					// Use the old logic as fallback
					setTimeout(() => {
						this._analyzeAndRespond(sMessage);
					}, 1000);
				}
			});
		},

		_analyzeAndRespond: function (sMessage) {
			const sLowerMessage = sMessage.toLowerCase();

			// Enhanced pattern matching for different types of queries
			if (this._isPOQuery(sLowerMessage)) {
				this._handlePOStatusQuery(sMessage);
			} else if (sLowerMessage.includes("batch")) {
				this._handleBatchQuery(sMessage);
			} else if (sLowerMessage.includes("stock") || sLowerMessage.includes("inventory")) {
				this._handleInventoryQuery(sMessage);
			} else if (sLowerMessage.includes("sales") || sLowerMessage.includes("sold")) {
				this._handleSalesQuery(sMessage);
			} else if (sLowerMessage.includes("sgtin") && (sLowerMessage.includes("without") || sLowerMessage.includes("missing"))) {
				this._handleMissingSGTINQuery();
			} else {
				this._handleGeneralQuery(sMessage);
			}
		},

		_isPOQuery: function (sLowerMessage) {
			// Check for PO-related keywords
			const poKeywords = ["po", "purchase order", "purchase-order"];
			const hasPOKeyword = poKeywords.some(keyword => sLowerMessage.includes(keyword));
			
			if (!hasPOKeyword) return false;
			
			// Check for query indicators
			const queryIndicators = [
				"status", "how many", "count", "number", "total",
				"open", "closed", "pending", "completed", "received",
				"show", "list", "tell me", "what", "which"
			];
			
			return queryIndicators.some(indicator => sLowerMessage.includes(indicator));
		},

		_handlePOStatusQuery: function (sMessage) {
			const sLowerMessage = sMessage.toLowerCase();
			console.log("DEBUG: Processing PO query:", sMessage);
			
			jQuery.ajax({
				url: "http://localhost:3002/api/purchase-orders?mandt=100",
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (apiResponse) => {
					const data = apiResponse.purchaseOrders || apiResponse || [];
					console.log("DEBUG: Received PO data:", data.length, "purchase orders");
					
					// First check if user is asking for a specific PO ID (more precise pattern)
					const specificPOMatch = sMessage.match(/\b(PO[-_]\d+)\b/i);
					const specificPOId = specificPOMatch ? specificPOMatch[1] : null;
					
					if (specificPOId) {
						console.log("DEBUG: Looking for specific PO:", specificPOId);
						const oPO = data.find(po => po.po_id && po.po_id.toUpperCase().includes(specificPOId.toUpperCase()));
						if (oPO) {
							this._addMessage("assistant", 
								`Here's the status of Purchase Order ${oPO.po_id}:<br/>` +
								`• GTIN: ${oPO.gtin || 'N/A'}<br/>` +
								`• Quantity: ${oPO.quantity}<br/>` +
								`• Status: ${oPO.status}<br/>` +
								`• Supplier: ${oPO.supplier || 'N/A'}<br/>` +
								`• Created: ${new Date(oPO.created_at).toLocaleDateString()}`
							);
						} else {
							this._addMessage("assistant", `I couldn't find Purchase Order ${specificPOId}. Here are the recent purchase orders:`, data.slice(0, 5));
						}
					} 
					// Check if user is asking for counts or summaries
					else if (sLowerMessage.includes("how many") || sLowerMessage.includes("count") || sLowerMessage.includes("number") || sLowerMessage.includes("total")) {
						console.log("DEBUG: Processing count query");
						
						// Count POs by status
						const totalPOs = data.length || 0;
						const openPOs = data.filter(po => po.status === 'OPEN').length || 0;
						const partiallyReceived = data.filter(po => po.status === 'PARTIALLY_RECEIVED').length || 0;
						const fullyReceived = data.filter(po => po.status === 'FULLY_RECEIVED').length || 0;
						const completed = data.filter(po => po.status === 'COMPLETED').length || 0;
						
						console.log("DEBUG: PO Status counts:", { totalPOs, openPOs, partiallyReceived, fullyReceived, completed });
						
						let response = `📊 **Purchase Order Summary:**<br/><br/>`;
						response += `• **Total Purchase Orders**: ${totalPOs}<br/>`;
						response += `• **Open (awaiting delivery)**: ${openPOs}<br/>`;
						response += `• **Partially Received**: ${partiallyReceived}<br/>`;
						response += `• **Fully Received**: ${fullyReceived}<br/>`;
						response += `• **Completed**: ${completed}<br/><br/>`;
						
						// Provide specific answer based on what user asked
						if (sLowerMessage.includes("open")) {
							response += `🔍 **Answer to your question**: There are **${openPOs} purchase orders** currently in OPEN state.`;
							// Show the open POs in a table
							const openPOsData = data.filter(po => po.status === 'OPEN').slice(0, 10);
							this._addMessage("assistant", response, openPOsData.length > 0 ? openPOsData : null);
						} else if (sLowerMessage.includes("partial")) {
							response += `🔍 **Answer to your question**: There are **${partiallyReceived} purchase orders** currently in PARTIALLY_RECEIVED state.`;
							const partialPOsData = data.filter(po => po.status === 'PARTIALLY_RECEIVED').slice(0, 10);
							this._addMessage("assistant", response, partialPOsData.length > 0 ? partialPOsData : null);
						} else if (sLowerMessage.includes("completed")) {
							response += `🔍 **Answer to your question**: There are **${completed} purchase orders** currently in COMPLETED state.`;
							const completedPOsData = data.filter(po => po.status === 'COMPLETED').slice(0, 10);
							this._addMessage("assistant", response, completedPOsData.length > 0 ? completedPOsData : null);
						} else if (sLowerMessage.includes("fully")) {
							response += `🔍 **Answer to your question**: There are **${fullyReceived} purchase orders** currently in FULLY_RECEIVED state.`;
							const fullyReceivedPOsData = data.filter(po => po.status === 'FULLY_RECEIVED').slice(0, 10);
							this._addMessage("assistant", response, fullyReceivedPOsData.length > 0 ? fullyReceivedPOsData : null);
						} else {
							response += `💡 You asked about purchase order counts. Is there a specific status you'd like to know about?`;
							this._addMessage("assistant", response);
						}
					} 
					// General PO listing or status queries
					else {
						console.log("DEBUG: Processing general PO query");
						let generalResponse = "Here are the recent purchase orders:";
						if (data.length === 0) {
							generalResponse = "No purchase orders found in the system.";
						}
						this._addMessage("assistant", generalResponse, data.slice(0, 10));
					}
				},
				error: (xhr, status, error) => {
					console.error("PO API Error:", error);
					this._addMessage("assistant", "I'm having trouble accessing purchase order data right now. Please check if the PO service is running on port 3002.");
				}
			});
		},

		_handleBatchQuery: function (sMessage) {
			console.log("DEBUG: Processing batch query:", sMessage);
			// Extract batch ID if mentioned
			const batchMatch = sMessage.match(/batch[:\s]+([A-Z0-9\-]+)/i);
			const batchId = batchMatch ? batchMatch[1] : null;

			jQuery.ajax({
				url: "http://localhost:3003/api/inventory?mandt=100",
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (batchResponse) => {
					console.log("DEBUG: Received batch/inventory data:", batchResponse);
					const data = batchResponse.inventory || batchResponse || [];
					let filteredData = data;
					let responseMessage = "Here are items in the inventory:";

					if (batchId) {
						filteredData = data.filter(item => 
							item.batch && item.batch.toUpperCase().includes(batchId.toUpperCase())
						);
						responseMessage = `Here are items in batch ${batchId}:`;
					}

					if (filteredData.length > 0) {
						this._addMessage("assistant", responseMessage, filteredData.slice(0, 20));
					} else {
						this._addMessage("assistant", batchId ? 
							`No items found in batch ${batchId}.` : 
							"No items found in inventory."
						);
					}
				},
				error: (xhr, status, error) => {
					console.error("Batch/Inventory API Error:", error, xhr.responseText);
					this._addMessage("assistant", "I'm having trouble accessing inventory data right now. Please check if the inventory service is running on port 3003.");
				}
			});
		},

		_handleInventoryQuery: function (sMessage) {
			const sLowerMessage = sMessage.toLowerCase();
			console.log("DEBUG: Processing inventory query:", sMessage);

			jQuery.ajax({
				url: "http://localhost:3003/api/inventory?mandt=100",
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				success: (inventoryResponse) => {
					console.log("DEBUG: Received inventory data:", inventoryResponse);
					const data = inventoryResponse.inventory || inventoryResponse || [];
					console.log("DEBUG: Processing", data.length, "inventory items");
					
					const summary = {
						total: data.length,
						inStock: data.filter(item => item.status === "IN_STOCK").length,
						sold: data.filter(item => item.status === "SOLD").length,
						created: data.filter(item => item.status === "CREATED").length,
						inTransit: data.filter(item => item.status === "IN_TRANSIT").length,
						returned: data.filter(item => item.status === "RETURNED").length
					};

					console.log("DEBUG: Inventory summary:", summary);

					let response = `📦 **Current Inventory Summary:**<br/><br/>`;
					response += `• **Total items**: ${summary.total}<br/>`;
					response += `• **In stock**: ${summary.inStock}<br/>`;
					response += `• **Sold**: ${summary.sold}<br/>`;
					response += `• **Created (not received)**: ${summary.created}<br/>`;
					response += `• **In transit**: ${summary.inTransit}<br/>`;
					response += `• **Returned**: ${summary.returned}<br/><br/>`;

					// Answer specific questions
					if (sLowerMessage.includes("how many") || sLowerMessage.includes("count") || sLowerMessage.includes("number")) {
						if (sLowerMessage.includes("stock")) {
							response += `🔍 **Answer to your question**: There are **${summary.inStock} items** currently in stock.`;
						} else if (sLowerMessage.includes("sold")) {
							response += `🔍 **Answer to your question**: There are **${summary.sold} items** that have been sold.`;
						} else {
							response += `🔍 **Answer to your question**: There are **${summary.total} items** in total inventory.`;
						}
					}

					if (sLowerMessage.includes("location")) {
						const locations = {};
						data.forEach(item => {
							if (item.location) {
								locations[item.location] = (locations[item.location] || 0) + 1;
							}
						});

						response += "<br/><br/>📍 **Items by location:**<br/>";
						Object.entries(locations).forEach(([location, count]) => {
							response += `• ${location}: ${count} items<br/>`;
						});
					}

					// Show detailed data if requested
					const showData = sLowerMessage.includes("detail") || sLowerMessage.includes("list") || sLowerMessage.includes("show") ? 
						data.slice(0, 15) : null;

					this._addMessage("assistant", response, showData);
				},
				error: (xhr, status, error) => {
					console.error("Inventory API Error:", error, xhr.responseText);
					this._addMessage("assistant", "I'm having trouble accessing inventory data right now. Please check if the inventory service is running on port 3003.");
				}
			});
		},

		_handleSalesQuery: function (sMessage) {
			jQuery.ajax({
				url: "http://localhost:3004/api/sales",
				type: "GET",
				success: (data) => {
					if (data.length === 0) {
						this._addMessage("assistant", "No sales data found.");
						return;
					}

					let filteredData = data;
					let responseMessage = "Here are the recent sales:";

					// Filter by time if specified
					if (sMessage.includes("24") || sMessage.includes("today")) {
						const yesterday = new Date();
						yesterday.setDate(yesterday.getDate() - 1);
						
						filteredData = data.filter(sale => 
							new Date(sale.sold_at) > yesterday
						);
						responseMessage = "Here are sales from the last 24 hours:";
					}

					if (filteredData.length > 0) {
						const totalRevenue = filteredData.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
						responseMessage += `<br/>Total sales: ${filteredData.length} transactions<br/>Total revenue: €${totalRevenue.toFixed(2)}`;
						
						this._addMessage("assistant", responseMessage, filteredData.slice(0, 10));
					} else {
						this._addMessage("assistant", "No sales found for the specified criteria.");
					}
				},
				error: () => {
					// Fallback with sample data
					const sampleSales = [
						{
							sale_id: "SALE_001",
							store_id: "STORE_01",
							total_amount: 199.98,
							sold_at: new Date().toISOString()
						}
					];
					this._addMessage("assistant", "Here are some recent sales (demo data):", sampleSales);
				}
			});
		},

		_handleMissingSGTINQuery: function () {
			// Frontend fallback aligned to backend: query inventory service for products without serialized items
			jQuery.ajax({
				url: "http://localhost:3003/api/inventory/missing-sgtins",
				type: "GET",
				headers: {
					'X-API-Key': 'dev-api-key-12345'
				},
				data: {
					mandt: "100"
				},
				success: (resp) => {
					const products = resp.products || resp || [];
					if (products.length > 0) {
						this._addMessage("assistant", "Here are products that don't have any serialized items (SGTINs) yet:", products.slice(0, 20));
					} else {
						this._addMessage("assistant", "All products appear to have serialized items.");
					}
				},
				error: (xhr, status, error) => {
					console.error("Missing SGTINs API Error:", error, xhr.responseText);
					this._addMessage("assistant", "I'm having trouble checking SGTIN status right now. Please try again later.");
				}
			});
		},

		_handleGeneralQuery: function (sMessage) {
			// Provide helpful general responses
			const generalResponses = [
				"I can help you with information about purchase orders, inventory, sales, and item tracking. Try asking about specific PO numbers, batch IDs, or inventory status.",
				"Here are some things I can help with:<br/>• Purchase order status<br/>• Inventory levels and locations<br/>• Sales data and analytics<br/>• Item batch information<br/>• SGTIN generation status",
				"I'm designed to help with SGTIN lifecycle management. You can ask me about any aspect of your supply chain from purchase orders to final sales."
			];

			const randomResponse = generalResponses[Math.floor(Math.random() * generalResponses.length)];
			this._addMessage("assistant", randomResponse);
		},

		_executeQuickAction: function (sAction) {
			let questionText = "";
			
			switch (sAction) {
				case "po_status":
					questionText = "Show me the status of recent purchase orders";
					break;
				case "missing_sgtins":
					questionText = "Which items don't have SGTINs generated yet?";
					break;
				case "stock_location":
					questionText = "Show me stock by location";
					break;
				case "batch_items":
					questionText = "Show me items in different batches";
					break;
				case "recent_sales":
					questionText = "Show me recent sales";
					break;
				case "inventory_summary":
					questionText = "How many items are in stock?";
					break;
				default:
					this._addMessage("assistant", "I'm not sure how to handle that action. Please try asking me a specific question.");
					return;
			}
			
			// Add user message and process with intelligent chatbot
			this._addMessage("user", questionText);
			this._processUserMessage(questionText);
		},

		// Formatters
		getChatMessageClass: function (sSender) {
			return sSender === "user" ? "chatMessageUser" : "chatMessageAssistant";
		},

		getSenderIcon: function (sSender) {
			return sSender === "user" ? "sap-icon://person-placeholder" : "sap-icon://robot";
		},

		getSenderName: function (sSender) {
			return sSender === "user" ? "You" : "Assistant";
		},

		formatChatTime: function (sTimestamp) {
			if (!sTimestamp) return "";
			const oDate = new Date(sTimestamp);
			return oDate.toLocaleTimeString();
		},

		formatDataStatus: function (sStatus) {
			switch (sStatus) {
				// Serialized item statuses
				case "CREATED": return "Warning";
				case "IN_STOCK": return "Success";
				case "SOLD": return "Information";
				case "RETURNED": return "Warning";
				case "DAMAGED": return "Error";
				// Purchase order statuses
				case "OPEN": return "Warning";
				case "PARTIALLY_RECEIVED": return "Information";
				case "FULLY_RECEIVED": return "Success";
				case "CANCELLED": return "Error";
				default: return "None";
			}
		}

	});
});
