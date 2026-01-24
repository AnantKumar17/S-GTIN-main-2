sap.ui.define([
	"sap/ui/core/util/MockServer",
	"sap/suite/ui/generic/template/genericUtilities/AjaxHelper",
	"sap/base/Log"
], function(MockServer, AjaxHelper, Log) {
	"use strict";
	var _sAppModulePath = "sap/ui/demoapps/rta/fiorielements/";

	var aUrlPrefixMatches = document.location.pathname.match(/(.*)\/test-resources\//);
	var sUrlPrefix = aUrlPrefixMatches &&  aUrlPrefixMatches[1] || "";
	var sImgDirectoryPath = sUrlPrefix + "/test-resources/sap/suite/ui/generic/template/demokit/test/service/images/";

	function getImagePath(sFileName){
		if (!sFileName) {
			return "";
		}
		return sImgDirectoryPath + sFileName;
	}

	return {

		/**
		 * Initializes the mock server.
		 * You can configure the delay with the URL parameter "serverDelay".
		 * The local mock data in this folder is returned instead of the real data for testing.
		 * @public
		 */

		init: function() {
			var	oUriParameters = new URL(window.location.href).searchParams;
			var sManifestUrl = sap.ui.require.toUrl(_sAppModulePath + "manifest.json"),
				oManifest = AjaxHelper.syncGetJSON(sManifestUrl).data;
			this.createMockServer(oManifest, oUriParameters);
		},

		createMockServer: function(oManifest, oUriParameters) {

			var iAutoRespond = (oUriParameters.get("serverDelay") || 1000),
				oMockServer, dataSource, sMockServerPath, sMetadataUrl,
				oDataSources = oManifest["sap.app"]["dataSources"];

			MockServer.config({
				autoRespond: true,
				autoRespondAfter: iAutoRespond
			});

			for (var property in oDataSources) {
				if (Object.prototype.hasOwnProperty.call(oDataSources, property)) {
					dataSource = oDataSources[property];

					//do we have a mock url in the app descriptor
					if (dataSource.settings && dataSource.settings.localUri) {
						if (typeof dataSource.type === "undefined" || dataSource.type === "OData") {
							oMockServer = new MockServer({
								rootUri: dataSource.uri
							});
							sMetadataUrl = sap.ui.require.toUrl(_sAppModulePath + dataSource.settings.localUri);
							sMockServerPath = sMetadataUrl.slice(0, sMetadataUrl.lastIndexOf("/") + 1);
							oMockServer.simulate(sMetadataUrl , {
								sMockdataBaseUrl: sMockServerPath,
								bGenerateMissingMockData: true
							});
							if (property === "mainService"){
								oMockServer.attachAfter(MockServer.HTTPMETHOD.GET, function (oEvent) {
									var oParameters = oEvent.getParameters();

									if (oParameters.oFilteredData && Array.isArray(oParameters.oFilteredData.results)){
										oParameters.oFilteredData.results.forEach(function (oProduct) {
											oProduct.ProductPictureURL = getImagePath(oProduct.ProductPictureURL);
										}.bind(this));
									} else if (oParameters.oEntry && typeof oParameters.oEntry.ProductPictureURL === "string") {
										oParameters.oEntry.ProductPictureURL = getImagePath(oParameters.oEntry.ProductPictureURL);
									}
								}.bind(this), "SEPMRA_C_PD_Product");
							}
						} else {
							if (oUriParameters.get("sap-client")) {
								dataSource.uri = dataSource.uri.concat("&sap-client=" + oUriParameters.get("sap-client"));
							}
							var rRegEx = dataSource.uri;
							if (dataSource.type !== "MockRegEx") {
								rRegEx = new RegExp(MockServer.prototype
										._escapeStringForRegExp(dataSource.uri) + "([?#].*)?");
							}
							sMetadataUrl = sap.ui.require.toUrl(_sAppModulePath + dataSource.settings.localUri);
							oMockServer = new MockServer({
								requests: [{
									method: "GET",
									//TODO have MockServer fixed and pass just the URL!
									path: rRegEx,
									response: this.makeCallbackFunction(sMetadataUrl)
								}]
							});
						}
						oMockServer.start();
						Log.info("Running the app with mock data for " + property);
					}
				}
			}
		},

		makeCallbackFunction: function(path) {
			return function(oXHR) {
				oXHR.respondFile(200, {}, path);
			};
		}
	};

});
