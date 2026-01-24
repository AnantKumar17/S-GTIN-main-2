/**
 * API Configuration Manager
 * Loads service URLs from environment variables for easy deployment configuration
 */
sap.ui.define([], function() {
	"use strict";

	// Default localhost URLs (fallback)
	const DEFAULT_CONFIG = {
		SGTIN_SERVICE_URL: "http://localhost:3001",
		PO_SERVICE_URL: "http://localhost:3002",
		INVENTORY_SERVICE_URL: "http://localhost:3003",
		POS_SERVICE_URL: "http://localhost:3004",
		CHATBOT_SERVICE_URL: "http://localhost:3005",
		SGTIN_LOOKUP_SERVICE_URL: "http://localhost:3006"
	};

	// Try to load from window.__CONFIG__ (set by server or build process)
	// For development, these come from .env file
	const config = window.__CONFIG__ || DEFAULT_CONFIG;

	return {
		/**
		 * Get service URL by name
		 * @param {string} serviceName - Name of the service
		 * @returns {string} Service URL with /api appended
		 */
		getServiceUrl: function(serviceName) {
			const baseUrl = config[serviceName] || DEFAULT_CONFIG[serviceName];
			// Ensure /api is appended if not already present
			return baseUrl && !baseUrl.endsWith("/api") ? baseUrl + "/api" : baseUrl;
		},

		/**
		 * Get base service URL without /api suffix
		 * @param {string} serviceName - Name of the service
		 * @returns {string} Service base URL
		 */
		getBaseUrl: function(serviceName) {
			return config[serviceName] || DEFAULT_CONFIG[serviceName];
		},

		/**
		 * Get all configured services
		 * @returns {object} Configuration object with all service URLs
		 */
		getConfig: function() {
			return config;
		},

		/**
		 * Service URL constants
		 */
		SGTIN_SERVICE: "SGTIN_SERVICE_URL",
		PO_SERVICE: "PO_SERVICE_URL",
		INVENTORY_SERVICE: "INVENTORY_SERVICE_URL",
		POS_SERVICE: "POS_SERVICE_URL",
		CHATBOT_SERVICE: "CHATBOT_SERVICE_URL",
		SGTIN_LOOKUP_SERVICE: "SGTIN_LOOKUP_SERVICE_URL"
	};
});
