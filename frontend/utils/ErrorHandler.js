/**
 * Error Handler Utility
 * Provides consistent error handling for API calls across all controllers
 */
sap.ui.define([], function() {
	"use strict";

	return {
		/**
		 * Handle AJAX errors with detailed logging and user-friendly messages
		 * @param {object} xhr - XMLHttpRequest object
		 * @param {string} status - Status text
		 * @param {string} error - Error message
		 * @param {string} url - The URL that was being called
		 * @param {string} context - Context/description of the operation
		 * @returns {string} User-friendly error message
		 */
		getErrorMessage: function(xhr, status, error, url, context) {
			let errorMessage = "Failed to " + (context || "complete operation");
			
			console.error("=== API Error ===");
			console.error("Context:", context);
			console.error("URL:", url);
			console.error("Status:", status);
			console.error("HTTP Status Code:", xhr.status);
			console.error("Error:", error);
			console.error("Response Text:", xhr.responseText);
			console.error("================");

			// Determine the error based on status
			if (status === "timeout") {
				errorMessage = "Request timeout. " + (context || "The service") + " is not responding. Please check if the backend service is running.";
			} else if (xhr.status === 0) {
				errorMessage = "Network error. Cannot reach service at:\n" + url + "\n\nPlease ensure the backend service is deployed and accessible.";
			} else if (xhr.status === 404) {
				errorMessage = "Service endpoint not found:\n" + url + "\n\nPlease verify the API endpoint is correct.";
			} else if (xhr.status === 403 || xhr.status === 401) {
				errorMessage = "Authentication error. Please check your API credentials.\n\nURL: " + url;
			} else if (xhr.status === 500 || xhr.status === 502 || xhr.status === 503) {
				errorMessage = "Server error (HTTP " + xhr.status + ").\n\nThe backend service may be temporarily unavailable.\n\nURL: " + url;
			} else if (xhr.status >= 400) {
				try {
					const errorResponse = JSON.parse(xhr.responseText);
					errorMessage = errorResponse.error || errorResponse.message || ("HTTP Error " + xhr.status + ": " + error);
				} catch (e) {
					errorMessage = "HTTP Error " + xhr.status + ": " + error + "\n\nURL: " + url;
				}
			} else {
				try {
					const errorResponse = JSON.parse(xhr.responseText);
					errorMessage = errorResponse.error || errorResponse.message || errorMessage;
				} catch (e) {
					errorMessage = (error || errorMessage) + "\n\nURL: " + url;
				}
			}

			return errorMessage;
		},

		/**
		 * Create standard error handler function for AJAX calls
		 * @param {string} context - Context/description of the operation
		 * @param {string} url - The URL being called
		 * @param {function} callback - Optional callback function(errorMessage, xhr)
		 * @returns {function} Error handler function for jQuery.ajax
		 */
		createErrorHandler: function(context, url, callback) {
			return (xhr, status, error) => {
				const errorMessage = this.getErrorMessage(xhr, status, error, url, context);
				
				if (callback && typeof callback === "function") {
					callback(errorMessage, xhr);
				}
				
				return errorMessage;
			};
		}
	};
});
