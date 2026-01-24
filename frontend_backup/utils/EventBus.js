sap.ui.define([
    "sap/ui/base/EventProvider"
], function(EventProvider) {
    "use strict";

    return EventProvider.extend("com.sgtin.lifecycle.utils.EventBus", {
        constructor: function() {
            EventProvider.prototype.constructor.apply(this, arguments);
        }
    });
}, /* bExport= */ true);
