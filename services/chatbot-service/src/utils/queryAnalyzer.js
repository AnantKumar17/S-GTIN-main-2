const axios = require('axios');

/**
 * Query Analyzer
 * Analyzes user questions and determines which API endpoints to call
 */
class QueryAnalyzer {
  constructor(mandt) {
    this.mandt = mandt;
    this.sgtinServiceUrl = process.env.SGTIN_SERVICE_URL || 'http://localhost:3001';
    this.poServiceUrl = process.env.PO_SERVICE_URL || 'http://localhost:3002';
    this.inventoryServiceUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
    this.posServiceUrl = process.env.POS_SERVICE_URL || 'http://localhost:3004';
    this.apiKey = process.env.API_KEY || 'dev-api-key-12345';
  }

  /**
   * Extract entities from question (PO numbers, GTINs, SGTINs, etc.)
   */
  extractEntities(question) {
    const entities = {
      poNumbers: [],
      gtins: [],
      sgtins: [],
      locations: [],
      statuses: [],
      brands: [],
      dates: []
    };

    // Extract PO numbers (e.g., 45000023, PO-123456)
    const poPattern = /(?:PO[:\s-]?)?(\d{8})/gi;
    let match;
    while ((match = poPattern.exec(question)) !== null) {
      entities.poNumbers.push(match[1]);
    }

    // Extract GTINs (14 digits)
    const gtinPattern = /\b(\d{14})\b/g;
    while ((match = gtinPattern.exec(question)) !== null) {
      entities.gtins.push(match[1]);
    }

    // Extract SGTINs (longer format with serial number)
    const sgtinPattern = /\b(01\d{14}21\d{13})\b/g;
    while ((match = sgtinPattern.exec(question)) !== null) {
      entities.sgtins.push(match[1]);
    }

    // Extract common locations
    const locationKeywords = ['warehouse', 'store', 'location', 'bangalore', 'mumbai', 'delhi', 'chennai'];
    locationKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b(${keyword}[\\w\\s-]*)`, 'gi');
      while ((match = regex.exec(question)) !== null) {
        entities.locations.push(match[1].trim());
      }
    });

    // Extract statuses
    const statusKeywords = ['open', 'closed', 'received', 'sold', 'in_stock', 'in stock', 'created', 'partially received', 'fully received'];
    statusKeywords.forEach(status => {
      if (question.toLowerCase().includes(status.toLowerCase())) {
        entities.statuses.push(status.toUpperCase().replace(/\s+/g, '_'));
      }
    });

    // Extract brands
    const brandPattern = /(?:from|by|brand)\s+([A-Z][a-zA-Z&\s]+?)(?:\s+(?:in|at|with|from)|$)/gi;
    while ((match = brandPattern.exec(question)) !== null) {
      entities.brands.push(match[1].trim());
    }

    return entities;
  }

  /**
   * Determine query intent and type
   */
  determineIntent(question) {
    const q = question.toLowerCase();

    const intents = {
      // Purchase Order queries
      'PO_STATUS': ['status of po', 'purchase order status', 'po details', 'what is the status'],
      'PO_LIST': ['list purchase orders', 'show pos', 'all purchase orders', 'which pos'],
      'PO_SGTINS': ['sgtins in po', 'items in po', 'sgtin for po'],
      
      // Inventory queries
      'INVENTORY_STATUS': ['inventory', 'in stock', 'available items', 'items in warehouse'],
      'INVENTORY_LOCATION': ['location of', 'where is', 'which warehouse', 'stored in'],
      'INVENTORY_COUNT': ['how many', 'count of', 'number of items'],
      'MISSING_SGTINS': ['without sgtin', 'no sgtin', 'missing sgtin'],
      
      // SGTIN queries
      'SGTIN_TRACE': ['trace', 'lifecycle', 'history of sgtin', 'track'],
      'SGTIN_VALIDATE': ['validate', 'verify sgtin', 'is valid'],
      
      // Sales queries
      'SALES_DETAILS': ['sale details', 'sales transaction', 'sold items', 'sold state', 'in sold state'],
      'COUNTERFEIT': ['counterfeit', 'fraud', 'fake', 'invalid sale'],
      
      // Product queries
      'PRODUCT_INFO': ['product details', 'what is', 'tell me about product'],
      'BRAND_QUERY': ['from brand', 'by brand', 'brand items'],
      
      // Time-based queries
      'RECENT_UPDATES': ['latest', 'recent', 'today', 'yesterday', 'last updated'],
      
      // General queries
      'STATISTICS': ['statistics', 'summary', 'overview', 'report']
    };

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => q.includes(keyword))) {
        return intent;
      }
    }

    return 'GENERAL';
  }

  /**
   * Fetch data from Purchase Order Service
   */
  async fetchPurchaseOrderData(entities) {
    const results = [];

    try {
      // If specific PO number mentioned
      if (entities.poNumbers.length > 0) {
        for (const poId of entities.poNumbers) {
          try {
            const response = await axios.get(
              `${this.poServiceUrl}/api/purchase-orders/${poId}`,
              {
                params: { mandt: this.mandt },
                headers: { 'X-API-Key': this.apiKey }
              }
            );
            results.push({
              type: 'PURCHASE_ORDER',
              poId,
              data: response.data.purchaseOrder
            });
          } catch (error) {
            results.push({
              type: 'PURCHASE_ORDER',
              poId,
              error: `PO ${poId} not found`
            });
          }
        }
      } else {
        // List all POs with filters
        const params = { mandt: this.mandt };
        if (entities.statuses.length > 0) {
          params.status = entities.statuses[0];
        }

        const response = await axios.get(
          `${this.poServiceUrl}/api/purchase-orders`,
          {
            params,
            headers: { 'X-API-Key': this.apiKey }
          }
        );
        results.push({
          type: 'PURCHASE_ORDER_LIST',
          data: response.data.purchaseOrders
        });
      }
    } catch (error) {
      console.error('Error fetching PO data:', error.message);
      results.push({
        type: 'ERROR',
        error: 'Failed to fetch purchase order data'
      });
    }

    return results;
  }

  /**
   * Fetch data from Inventory Service
   */
  async fetchInventoryData(entities, intent) {
    const results = [];

    try {
      if (intent === 'MISSING_SGTINS') {
        const response = await axios.get(
          `${this.inventoryServiceUrl}/api/inventory/missing-sgtins`,
          {
            params: { mandt: this.mandt },
            headers: { 'X-API-Key': this.apiKey }
          }
        );
        results.push({
          type: 'MISSING_SGTINS',
          data: response.data.products
        });
      } else {
        const params = { mandt: this.mandt };
        
        if (entities.statuses.length > 0) {
          params.status = entities.statuses[0];
        } else if (intent === 'INVENTORY_STATUS') {
          params.status = 'IN_STOCK';
        }
        
        if (entities.locations.length > 0) {
          params.location = entities.locations[0];
        }
        
        if (entities.gtins.length > 0) {
          params.gtin = entities.gtins[0];
        }

        const response = await axios.get(
          `${this.inventoryServiceUrl}/api/inventory`,
          {
            params,
            headers: { 'X-API-Key': this.apiKey }
          }
        );
        results.push({
          type: 'INVENTORY',
          data: response.data.inventory
        });
      }
    } catch (error) {
      console.error('Error fetching inventory data:', error.message);
      results.push({
        type: 'ERROR',
        error: 'Failed to fetch inventory data'
      });
    }

    return results;
  }

  /**
   * Fetch data from SGTIN Service
   */
  async fetchSGTINData(entities) {
    const results = [];

    try {
      if (entities.sgtins.length > 0) {
        for (const sgtin of entities.sgtins) {
          try {
            // Get trace/lifecycle
            const response = await axios.get(
              `${this.sgtinServiceUrl}/api/sgtin/trace/${sgtin}`,
              {
                params: { mandt: this.mandt },
                headers: { 'X-API-Key': this.apiKey }
              }
            );
            results.push({
              type: 'SGTIN_TRACE',
              sgtin,
              data: response.data
            });
          } catch (error) {
            results.push({
              type: 'SGTIN_TRACE',
              sgtin,
              error: `SGTIN ${sgtin} not found`
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SGTIN data:', error.message);
      results.push({
        type: 'ERROR',
        error: 'Failed to fetch SGTIN data'
      });
    }

    return results;
  }

  /**
   * Fetch data from POS Service
   */
  async fetchSalesData(entities) {
    const results = [];

    try {
      // Fetch counterfeit logs
      const response = await axios.get(
        `${this.posServiceUrl}/api/sales/logs/counterfeit`,
        {
          params: { mandt: this.mandt },
          headers: { 'X-API-Key': this.apiKey }
        }
      );
      results.push({
        type: 'COUNTERFEIT_LOGS',
        data: response.data.logs
      });
    } catch (error) {
      console.error('Error fetching sales data:', error.message);
      results.push({
        type: 'ERROR',
        error: 'Failed to fetch sales data'
      });
    }

    return results;
  }

  /**
   * Main analysis method - determines what data to fetch
   */
  async analyzeAndFetch(question) {
    const entities = this.extractEntities(question);
    const intent = this.determineIntent(question);

    console.log('Query Analysis:', {
      question,
      intent,
      entities
    });

    const results = [];

    // Fetch data based on intent
    switch (intent) {
      case 'PO_STATUS':
      case 'PO_LIST':
      case 'PO_SGTINS':
        const poData = await this.fetchPurchaseOrderData(entities);
        results.push(...poData);
        break;

      case 'INVENTORY_STATUS':
      case 'INVENTORY_LOCATION':
      case 'INVENTORY_COUNT':
      case 'MISSING_SGTINS':
        const inventoryData = await this.fetchInventoryData(entities, intent);
        results.push(...inventoryData);
        break;

      case 'SGTIN_TRACE':
      case 'SGTIN_VALIDATE':
        const sgtinData = await this.fetchSGTINData(entities);
        results.push(...sgtinData);
        break;

      case 'SALES_DETAILS':
        // For sales queries, fetch inventory with SOLD status
        const soldInventoryData = await this.fetchInventoryData(entities, intent);
        results.push(...soldInventoryData);
        break;

      case 'COUNTERFEIT':
        const salesData = await this.fetchSalesData(entities);
        results.push(...salesData);
        break;

      case 'BRAND_QUERY':
        // Fetch inventory filtered by brand
        const brandInventory = await this.fetchInventoryData(entities, 'INVENTORY_STATUS');
        results.push(...brandInventory);
        break;

      case 'GENERAL':
      default:
        // Try to fetch relevant data based on entities
        if (entities.poNumbers.length > 0) {
          const poData = await this.fetchPurchaseOrderData(entities);
          results.push(...poData);
        }
        if (entities.sgtins.length > 0) {
          const sgtinData = await this.fetchSGTINData(entities);
          results.push(...sgtinData);
        }
        if (entities.locations.length > 0 || entities.statuses.length > 0) {
          const inventoryData = await this.fetchInventoryData(entities, intent);
          results.push(...inventoryData);
        }
        
        // If no specific entities, provide general inventory status
        if (results.length === 0) {
          const generalData = await this.fetchInventoryData({}, 'INVENTORY_STATUS');
          results.push(...generalData);
        }
        break;
    }

    return {
      intent,
      entities,
      results
    };
  }
}

module.exports = QueryAnalyzer;
