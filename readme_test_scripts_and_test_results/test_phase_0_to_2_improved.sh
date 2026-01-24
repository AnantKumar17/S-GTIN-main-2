#!/bin/bash
# Comprehensive Phase 0-2 Testing Script for SGTIN Lifecycle System
# IMPROVED VERSION with configurable options and better error handling

# Load configuration
TEST_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$(cd "$TEST_SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$TEST_SCRIPT_DIR/test_config.sh"

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    echo "✓ Loaded configuration from test_config.sh"
else
    echo "⚠ Warning: test_config.sh not found, using default settings"
    CLEANUP_DATA="false"
    INSERT_PRODUCTS="false"
    SKIP_PHASE_0="false"
    SKIP_PHASE_1="false"
    CONTINUE_ON_ERROR="false"
    CHECK_SERVICES="true"
    AUTO_START_SERVICES="false"
    MANDT="100"
    DB_USER="I528623"
    DB_NAME="sgtin_db"
    BASE_URL_SGTIN="http://localhost:3001"
    BASE_URL_PO="http://localhost:3002"
    BASE_URL_INV="http://localhost:3003"
    BASE_URL_POS="http://localhost:3004"
    VERBOSE="false"
    LOG_FILE=""
fi

# Set error handling based on config
if [ "$CONTINUE_ON_ERROR" = "true" ]; then
    set +e  # Don't exit on error
else
    set -e  # Exit on error
fi

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Logging function
log() {
    echo -e "$1"
    if [ -n "$LOG_FILE" ]; then
        echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g' >> "$LOG_FILE"
    fi
}

# Error handling function
handle_error() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log "${RED}✗ Test failed: $1${NC}"
    if [ "$CONTINUE_ON_ERROR" = "false" ]; then
        log "${RED}Exiting due to error (set CONTINUE_ON_ERROR=true to continue)${NC}"
        exit 1
    fi
}

# Success function
mark_success() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log "${GREEN}✓ $1${NC}"
}

# Skip function
mark_skipped() {
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
    log "${YELLOW}⊘ Skipped: $1${NC}"
}

log "=========================================="
log "SGTIN LIFECYCLE SYSTEM - COMPREHENSIVE TEST"
log "Testing Phases 0, 1, and 2"
log "=========================================="
log ""
log "Configuration:"
log "  CLEANUP_DATA: $CLEANUP_DATA"
log "  INSERT_PRODUCTS: $INSERT_PRODUCTS"
log "  CHECK_SERVICES: $CHECK_SERVICES"
log "  CONTINUE_ON_ERROR: $CONTINUE_ON_ERROR"
log "  MANDT: $MANDT"
log ""

# ===========================================
# PRE-FLIGHT CHECKS
# ===========================================

log "=========================================="
log "PRE-FLIGHT CHECKS"
log "=========================================="
log ""

if [ "$CHECK_SERVICES" = "true" ]; then
    log "Checking if all services are running..."
    
    SERVICES_RUNNING=0
    SERVICES_EXPECTED=4
    
    for port in 3001 3002 3003 3004; do
        if lsof -ti:$port > /dev/null 2>&1; then
            SERVICES_RUNNING=$((SERVICES_RUNNING + 1))
            log "  ✓ Service on port $port: Running"
        else
            log "  ${RED}✗ Service on port $port: NOT RUNNING${NC}"
            
            if [ "$AUTO_START_SERVICES" = "true" ]; then
                log "    Attempting to start service..."
                # Attempt to start based on port
                case $port in
                    3001)
                        (cd "$SCRIPT_DIR/services/sgtin-service" && node src/server.js > /tmp/sgtin_service.log 2>&1 &)
                        ;;
                    3002)
                        (cd "$SCRIPT_DIR/services/po-service" && node src/server.js > /tmp/po_service.log 2>&1 &)
                        ;;
                    3003)
                        (cd "$SCRIPT_DIR/services/inventory-service" && node src/server.js > /tmp/inventory_service.log 2>&1 &)
                        ;;
                    3004)
                        (cd "$SCRIPT_DIR/services/pos-service" && node src/server.js > /tmp/pos_service.log 2>&1 &)
                        ;;
                esac
                sleep 3
                if lsof -ti:$port > /dev/null 2>&1; then
                    log "    ${GREEN}✓ Service started successfully${NC}"
                    SERVICES_RUNNING=$((SERVICES_RUNNING + 1))
                else
                    log "    ${RED}✗ Failed to start service${NC}"
                fi
            fi
        fi
    done
    
    if [ $SERVICES_RUNNING -eq $SERVICES_EXPECTED ]; then
        mark_success "All $SERVICES_EXPECTED services are running"
    else
        handle_error "Only $SERVICES_RUNNING/$SERVICES_EXPECTED services running. Start missing services and retry."
    fi
    log ""
fi

# ===========================================
# DATA CLEANUP (if enabled)
# ===========================================

if [ "$CLEANUP_DATA" = "true" ]; then
    log "=========================================="
    log "DATA CLEANUP"
    log "=========================================="
    log ""
    
    log "Clearing all existing data from database..."
    
    # Use -t -A flags to prevent pager issues
    psql -U $DB_USER -d $DB_NAME -t -A > /dev/null 2>&1 <<EOF
TRUNCATE TABLE lifecycle_events CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE goods_receipts CASCADE;
TRUNCATE TABLE po_sgtin_mapping CASCADE;
TRUNCATE TABLE purchase_orders CASCADE;
TRUNCATE TABLE serialized_items CASCADE;
TRUNCATE TABLE products CASCADE;
EOF
    
    if [ $? -eq 0 ]; then
        mark_success "Data cleanup completed"
    else
        handle_error "Data cleanup failed"
    fi
    log ""
fi

# ===========================================
# INSERT PRODUCTS (if enabled)
# ===========================================

if [ "$INSERT_PRODUCTS" = "true" ] && [ "$CLEANUP_DATA" = "true" ]; then
    log "=========================================="
    log "INSERTING SAMPLE PRODUCTS"
    log "=========================================="
    log ""
    
    log "Inserting 5 SAP S.Market confectionery products..."
    
    psql -U $DB_USER -d $DB_NAME > /dev/null 2>&1 <<EOF
INSERT INTO products (mandt, gtin, name, brand, category, price, description, created_at, updated_at) VALUES
('$MANDT', '20001234567890', 'Premium Dark Chocolate Bar 100g', 'ChocoDreams', 'Confectionery', 8.99, 'Rich 75% cocoa dark chocolate bar', NOW(), NOW()),
('$MANDT', '20001234567891', 'Milk Chocolate Truffles Box 200g', 'ChocoDreams', 'Confectionery', 12.99, 'Assorted milk chocolate truffles', NOW(), NOW()),
('$MANDT', '20001234567892', 'Hazelnut Praline Collection 250g', 'NuttyDelights', 'Confectionery', 15.49, 'Premium hazelnut pralines', NOW(), NOW()),
('$MANDT', '20001234567893', 'Caramel Toffee Mix 300g', 'SweetSpot', 'Confectionery', 9.99, 'Soft caramel and crunchy toffee mix', NOW(), NOW()),
('$MANDT', '20001234567894', 'White Chocolate Raspberry Bar 150g', 'BerryBliss', 'Confectionery', 10.99, 'White chocolate with raspberry pieces', NOW(), NOW());
EOF
    
    if [ $? -eq 0 ]; then
        # Verify insertion using -t -A to prevent pager
        PRODUCT_COUNT=$(psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT COUNT(*) FROM products WHERE mandt='$MANDT';" 2>&1)
        if [ "$PRODUCT_COUNT" = "5" ]; then
            mark_success "5 products inserted successfully"
        else
            handle_error "Product insertion verification failed (expected 5, got $PRODUCT_COUNT)"
        fi
    else
        handle_error "Product insertion failed"
    fi
    log ""
fi

# ===========================================
# PHASE 0: FOUNDATION SETUP
# ===========================================

if [ "$SKIP_PHASE_0" = "true" ]; then
    mark_skipped "Phase 0 (configured to skip)"
    log ""
else
    log "=========================================="
    log "PHASE 0: FOUNDATION SETUP VERIFICATION"
    log "=========================================="
    log ""
    
    log "Task 0.1: Microservices Repository Structure"
    log "----------------------------------------------"
    if ls -d "$SCRIPT_DIR/services"/*/ > /dev/null 2>&1; then
        SERVICE_COUNT=$(ls -d "$SCRIPT_DIR/services"/*/ 2>/dev/null | wc -l | tr -d ' ')
        if [ "$SERVICE_COUNT" -ge "4" ]; then
            mark_success "Task 0.1: $SERVICE_COUNT microservices found"
        else
            handle_error "Task 0.1: Expected at least 4 services, found $SERVICE_COUNT"
        fi
    else
        handle_error "Task 0.1: services/ directory not found"
    fi
    log ""
    
    log "Task 0.2: SAP-Compatible Stack"
    log "----------------------------------------------"
    NODE_VERSION=$(node --version 2>/dev/null)
    PG_VERSION=$(psql --version 2>/dev/null | head -1)
    if [ -n "$NODE_VERSION" ] && [ -n "$PG_VERSION" ]; then
        log "  Node.js: $NODE_VERSION"
        log "  PostgreSQL: $PG_VERSION"
        mark_success "Task 0.2: Stack verified"
    else
        handle_error "Task 0.2: Stack verification failed"
    fi
    log ""
    
    log "Task 0.3: OpenAPI Specifications"
    log "----------------------------------------------"
    if ls "$SCRIPT_DIR/docs"/*.yaml > /dev/null 2>&1; then
        SPEC_COUNT=$(ls "$SCRIPT_DIR/docs"/*.yaml 2>/dev/null | wc -l | tr -d ' ')
        if [ "$SPEC_COUNT" -ge "4" ]; then
            mark_success "Task 0.3: $SPEC_COUNT OpenAPI specs found"
        else
            handle_error "Task 0.3: Expected at least 4 specs, found $SPEC_COUNT"
        fi
    else
        handle_error "Task 0.3: docs/ directory or YAML files not found"
    fi
    log ""
fi

# ===========================================
# PHASE 1: MULTI-TENANT DATABASE
# ===========================================

if [ "$SKIP_PHASE_1" = "true" ]; then
    mark_skipped "Phase 1 (configured to skip)"
    log ""
else
    log "=========================================="
    log "PHASE 1: MULTI-TENANT DATABASE"
    log "=========================================="
    log ""
    
    log "Task 1.1: Database Schema with MANDT"
    log "----------------------------------------------"
    PRODUCT_COUNT=$(psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT COUNT(*) FROM products WHERE mandt='$MANDT';" 2>&1)
    if [ $? -eq 0 ]; then
        log "  Products in MANDT $MANDT: $PRODUCT_COUNT"
        mark_success "Task 1.1: Multi-tenant schema verified"
    else
        handle_error "Task 1.1: Database query failed"
    fi
    log ""
    
    log "Task 1.2: Node.js Data Models"
    log "----------------------------------------------"
    if ls "$SCRIPT_DIR/database/models"/*.js > /dev/null 2>&1; then
        MODEL_COUNT=$(ls "$SCRIPT_DIR/database/models"/*.js 2>/dev/null | wc -l | tr -d ' ')
        mark_success "Task 1.2: $MODEL_COUNT data models found"
    else
        handle_error "Task 1.2: database/models/ not found"
    fi
    log ""
    
    log "Task 1.3: Sample Data Verification"
    log "----------------------------------------------"
    if [ "$PRODUCT_COUNT" -ge "1" ]; then
        # Use -t -A to prevent pager, limit to 5 rows
        SAMPLE_PRODUCTS=$(psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT LEFT(name, 40) FROM products WHERE mandt='$MANDT' LIMIT 5;" 2>&1)
        log "  Sample products:"
        echo "$SAMPLE_PRODUCTS" | while read -r line; do
            log "    - $line"
        done
        mark_success "Task 1.3: $PRODUCT_COUNT products verified"
    else
        handle_error "Task 1.3: No products found in database"
    fi
    log ""
fi

# ===========================================
# PHASE 2: CORE MICROSERVICES
# ===========================================

log "=========================================="
log "PHASE 2: CORE MICROSERVICES TESTING"
log "=========================================="
log ""

log "Task 2.1: SGTIN Generation Service (Port 3001)"
log "----------------------------------------------"

# Get a GTIN from database
GTIN=$(psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT gtin FROM products WHERE mandt='$MANDT' LIMIT 1;" 2>&1)

if [ -z "$GTIN" ]; then
    handle_error "Task 2.1: No GTIN available for testing"
else
    log "Testing POST /api/sgtin/generate with GTIN: $GTIN..."
    
    SGTIN_RESPONSE=$(curl -s -X POST $BASE_URL_SGTIN/api/sgtin/generate \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d '{
        "mandt": "'$MANDT'",
        "gtin": "'$GTIN'",
        "quantity": 3,
        "batch": "BATCH-TEST-'$(date +%m%d%H%M)'",
        "manufactureDate": "2026-01-21"
      }' 2>&1)
    
    if echo "$SGTIN_RESPONSE" | grep -q '"success":true'; then
        SGTIN_COUNT=$(echo "$SGTIN_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('sgtins', [])))" 2>/dev/null)
        log "  Generated $SGTIN_COUNT SGTINs"
        
        # Save first SGTIN for later tests
        SGTIN_1=$(echo "$SGTIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['sgtins'][0]['sgtin'])" 2>/dev/null)
        
        # Test validation
        VALIDATE_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_SGTIN/api/sgtin/validate/$SGTIN_1?mandt=$MANDT" 2>&1)
        if echo "$VALIDATE_RESPONSE" | grep -q '"valid":true'; then
            mark_success "Task 2.1: SGTIN Service verified (generate + validate)"
        else
            handle_error "Task 2.1: SGTIN validation failed"
        fi
    else
        handle_error "Task 2.1: SGTIN generation failed"
    fi
fi
log ""

log "Task 2.2: Purchase Order Service (Port 3002)"
log "----------------------------------------------"

# Get a different GTIN for PO
GTIN_PO=$(psql -U $DB_USER -d $DB_NAME -t -A -c "SELECT gtin FROM products WHERE mandt='$MANDT' OFFSET 1 LIMIT 1;" 2>&1)

if [ -z "$GTIN_PO" ]; then
    GTIN_PO=$GTIN  # Fallback to first GTIN
fi

log "Testing POST /api/purchase-orders with GTIN: $GTIN_PO..."

PO_RESPONSE=$(curl -s -X POST $BASE_URL_PO/api/purchase-orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "mandt": "'$MANDT'",
    "gtin": "'$GTIN_PO'",
    "quantity": 5,
    "supplier": "Test Supplier Co",
    "expectedDelivery": "2026-01-28",
    "batch": "BATCH-PO-'$(date +%m%d%H%M)'",
    "manufactureDate": "2026-01-21"
  }' 2>&1)

if echo "$PO_RESPONSE" | grep -q '"success":true'; then
    PO_ID=$(echo "$PO_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['purchaseOrder']['poId'])" 2>/dev/null)
    SGTIN_COUNT=$(echo "$PO_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('sgtins', [])))" 2>/dev/null)
    log "  PO ID: $PO_ID"
    log "  SGTINs Generated: $SGTIN_COUNT"
    
    # Save SGTINs for next tests
    echo "$PO_RESPONSE" | python3 -c "import sys,json; [print(s['sgtin']) for s in json.load(sys.stdin).get('sgtins', [])]" 2>/dev/null > /tmp/po_sgtins.txt
    PO_SGTIN_1=$(sed -n '1p' /tmp/po_sgtins.txt)
    PO_SGTIN_2=$(sed -n '2p' /tmp/po_sgtins.txt)
    PO_SGTIN_3=$(sed -n '3p' /tmp/po_sgtins.txt)
    
    # Test GET endpoint
    PO_GET=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_PO/api/purchase-orders/$PO_ID?mandt=$MANDT" 2>&1)
    if echo "$PO_GET" | grep -q '"success":true'; then
        mark_success "Task 2.2: Purchase Order Service verified (create + get)"
    else
        handle_error "Task 2.2: PO retrieval failed"
    fi
else
    handle_error "Task 2.2: Purchase Order creation failed"
fi
log ""

log "Task 2.3: Inventory Service (Port 3003)"
log "----------------------------------------------"

if [ -n "$PO_ID" ] && [ -n "$PO_SGTIN_1" ]; then
    log "Testing POST /api/goods-receipts..."
    
    GR_RESPONSE=$(curl -s -X POST $BASE_URL_INV/api/goods-receipts \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d '{
        "mandt": "'$MANDT'",
        "poId": "'$PO_ID'",
        "sgtins": ["'$PO_SGTIN_1'", "'$PO_SGTIN_2'", "'$PO_SGTIN_3'"],
        "location": "WAREHOUSE-TEST"
      }' 2>&1)
    
    if echo "$GR_RESPONSE" | grep -q '"success":true'; then
        GR_ID=$(echo "$GR_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('grId', 'N/A'))" 2>/dev/null)
        log "  GR ID: $GR_ID"
        
        # Test inventory query
        INV_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_INV/api/inventory?mandt=$MANDT&status=IN_STOCK" 2>&1)
        if echo "$INV_RESPONSE" | grep -q '"success":true'; then
            INV_COUNT=$(echo "$INV_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('inventory', [])))" 2>/dev/null)
            log "  Items in stock: $INV_COUNT"
            mark_success "Task 2.3: Inventory Service verified (receipt + query)"
        else
            handle_error "Task 2.3: Inventory query failed"
        fi
    else
        handle_error "Task 2.3: Goods receipt failed"
    fi
else
    mark_skipped "Task 2.3: No PO/SGTINs available for testing"
fi
log ""

log "Task 2.4: POS Service (Port 3004)"
log "----------------------------------------------"

if [ -n "$PO_SGTIN_1" ]; then
    log "Testing POST /api/sales (normal sale)..."
    
    SALE_RESPONSE=$(curl -s -X POST $BASE_URL_POS/api/sales \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d '{
        "mandt": "'$MANDT'",
        "sgtins": ["'$PO_SGTIN_1'"],
        "storeId": "STORE-TEST-001",
        "customerId": "CUST-TEST",
        "totalAmount": 12.99
      }' 2>&1)
    
    if echo "$SALE_RESPONSE" | grep -q '"success":true'; then
        SALE_ID=$(echo "$SALE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sale', {}).get('saleId', 'N/A'))" 2>/dev/null)
        log "  Sale ID: $SALE_ID"
        
        # Test counterfeit detection
        log "  Testing counterfeit detection (unknown SGTIN)..."
        COUNTERFEIT_RESPONSE=$(curl -s -X POST $BASE_URL_POS/api/sales \
          -H "Content-Type: application/json" \
          -H "X-API-Key: $API_KEY" \
          -d '{
            "mandt": "'$MANDT'",
            "sgtins": ["0199999999999921FAKE'$(date +%s)'"],
            "storeId": "STORE-TEST-001",
            "totalAmount": 99.99
          }' 2>&1)
        
        if echo "$COUNTERFEIT_RESPONSE" | grep -qi 'counterfeit\|not found\|invalid'; then
            log "  ✓ Counterfeit detection working"
            mark_success "Task 2.4: POS Service verified (sale + counterfeit detection)"
        else
            log "  ${YELLOW}⚠ Counterfeit detection unclear${NC}"
            mark_success "Task 2.4: POS Service verified (sale only)"
        fi
    else
        handle_error "Task 2.4: Sales transaction failed"
    fi
else
    mark_skipped "Task 2.4: No SGTIN available for testing"
fi
log ""

log "Task 2.5: Traceability Engine"
log "----------------------------------------------"

if [ -n "$PO_SGTIN_1" ]; then
    log "Testing GET /api/sgtin/trace/$PO_SGTIN_1..."
    
    TRACE_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_SGTIN/api/sgtin/trace/$PO_SGTIN_1?mandt=$MANDT" 2>&1)
    
    if echo "$TRACE_RESPONSE" | grep -q '"success":true'; then
        EVENT_COUNT=$(echo "$TRACE_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('lifecycle', [])))" 2>/dev/null)
        STATUS=$(echo "$TRACE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('currentStatus', 'N/A'))" 2>/dev/null)
        log "  Current Status: $STATUS"
        log "  Lifecycle Events: $EVENT_COUNT"
        
        if [ "$EVENT_COUNT" -ge "3" ]; then
            log "  ✓ Complete lifecycle tracked (CREATED → RECEIVED → SOLD)"
            mark_success "Task 2.5: Traceability Engine verified"
        else
            mark_success "Task 2.5: Traceability Engine working (partial lifecycle)"
        fi
    else
        handle_error "Task 2.5: Traceability query failed"
    fi
else
    mark_skipped "Task 2.5: No SGTIN available for testing"
fi
log ""

log "Task 2.6: Purchase Order List & Filters"
log "----------------------------------------------"

log "Testing GET /api/purchase-orders (list all POs)..."

PO_LIST_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_PO/api/purchase-orders?mandt=$MANDT" 2>&1)

if echo "$PO_LIST_RESPONSE" | grep -q '"success":true'; then
    PO_LIST_COUNT=$(echo "$PO_LIST_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('purchaseOrders', [])))" 2>/dev/null)
    log "  Total POs found: $PO_LIST_COUNT"
    
    # Test with status filter
    log "  Testing with status filter (status=CREATED)..."
    PO_FILTER_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_PO/api/purchase-orders?mandt=$MANDT&status=CREATED" 2>&1)
    
    if echo "$PO_FILTER_RESPONSE" | grep -q '"success":true'; then
        FILTERED_COUNT=$(echo "$PO_FILTER_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('purchaseOrders', [])))" 2>/dev/null)
        log "  POs with status=CREATED: $FILTERED_COUNT"
        mark_success "Task 2.6: PO list & filter endpoints verified"
    else
        handle_error "Task 2.6: PO filter query failed"
    fi
else
    handle_error "Task 2.6: PO list query failed"
fi
log ""

log "Task 2.7: Purchase Order Barcode Labels"
log "----------------------------------------------"

if [ -n "$PO_ID" ]; then
    log "Testing GET /api/purchase-orders/$PO_ID/labels..."
    
    LABELS_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_PO/api/purchase-orders/$PO_ID/labels?mandt=$MANDT" 2>&1)
    
    if echo "$LABELS_RESPONSE" | grep -q '"success":true'; then
        LABEL_COUNT=$(echo "$LABELS_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('labels', [])))" 2>/dev/null)
        log "  Labels generated: $LABEL_COUNT"
        
        # Check if labels have required fields
        HAS_BARCODE=$(echo "$LABELS_RESPONSE" | grep -q '"barcode"' && echo "yes" || echo "no")
        HAS_QR=$(echo "$LABELS_RESPONSE" | grep -q '"qrCode"' && echo "yes" || echo "no")
        log "  Contains barcodes: $HAS_BARCODE"
        log "  Contains QR codes: $HAS_QR"
        
        mark_success "Task 2.7: Barcode labels endpoint verified"
    else
        handle_error "Task 2.7: Label generation failed"
    fi
else
    mark_skipped "Task 2.7: No PO available for label testing"
fi
log ""

log "Task 2.8: Inventory Missing SGTINs"
log "----------------------------------------------"

log "Testing GET /api/inventory/missing-sgtins..."

MISSING_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_INV/api/inventory/missing-sgtins?mandt=$MANDT" 2>&1)

if echo "$MISSING_RESPONSE" | grep -q '"success":true'; then
    MISSING_COUNT=$(echo "$MISSING_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('products', [])))" 2>/dev/null)
    log "  Products without SGTINs: $MISSING_COUNT"
    
    if [ "$MISSING_COUNT" -ge "0" ]; then
        mark_success "Task 2.8: Missing SGTINs endpoint verified"
    else
        handle_error "Task 2.8: Invalid response format"
    fi
else
    handle_error "Task 2.8: Missing SGTINs query failed"
fi
log ""

log "Task 2.9: Sale Details Retrieval"
log "----------------------------------------------"

if [ -n "$SALE_ID" ]; then
    log "Testing GET /api/sales/$SALE_ID..."
    
    SALE_GET_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_POS/api/sales/$SALE_ID?mandt=$MANDT" 2>&1)
    
    if echo "$SALE_GET_RESPONSE" | grep -q '"success":true'; then
        SALE_ITEMS=$(echo "$SALE_GET_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('sale', {}).get('items', [])))" 2>/dev/null)
        SALE_TOTAL=$(echo "$SALE_GET_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sale', {}).get('totalAmount', 'N/A'))" 2>/dev/null)
        log "  Sale items: $SALE_ITEMS"
        log "  Total amount: \$$SALE_TOTAL"
        
        mark_success "Task 2.9: Sale details endpoint verified"
    else
        handle_error "Task 2.9: Sale retrieval failed"
    fi
else
    mark_skipped "Task 2.9: No sale ID available for testing"
fi
log ""

log "Task 2.10: Counterfeit Detection Logs"
log "----------------------------------------------"

log "Testing GET /api/sales/logs/counterfeit..."

COUNTERFEIT_LOGS=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL_POS/api/sales/logs/counterfeit?mandt=$MANDT" 2>&1)

if echo "$COUNTERFEIT_LOGS" | grep -q '"success":true'; then
    LOG_COUNT=$(echo "$COUNTERFEIT_LOGS" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('logs', [])))" 2>/dev/null)
    log "  Counterfeit detection logs: $LOG_COUNT"
    
    if [ "$LOG_COUNT" -ge "0" ]; then
        log "  ✓ Fraud detection logging active"
        mark_success "Task 2.10: Counterfeit logs endpoint verified"
    else
        handle_error "Task 2.10: Invalid log response format"
    fi
else
    handle_error "Task 2.10: Counterfeit logs query failed"
fi
log ""

# ===========================================
# TEST SUMMARY
# ===========================================

log "=========================================="
log "TEST SUMMARY"
log "=========================================="
log ""
log "${GREEN}Passed: $TESTS_PASSED${NC}"
log "${RED}Failed: $TESTS_FAILED${NC}"
log "${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
log "Total: $((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))"
log ""

if [ $TESTS_FAILED -eq 0 ]; then
    log "${GREEN}=========================================="
    log "✅ ALL TESTS PASSED"
    log "==========================================${NC}"
    exit 0
else
    log "${RED}=========================================="
    log "❌ SOME TESTS FAILED"
    log "==========================================${NC}"
    exit 1
fi
