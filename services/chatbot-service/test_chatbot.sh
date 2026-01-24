#!/bin/bash

# Chatbot Service Comprehensive Test Script
# Tests the chatbot service with various scenarios

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "CHATBOT SERVICE TEST SUITE"
echo "=========================================="
echo ""

# Configuration
BASE_URL="http://localhost:3005"
API_KEY="dev-api-key-12345"
MANDT="100"

# Test counters
PASSED=0
FAILED=0

# Helper function for tests
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d "${data}")
    else
        response=$(curl -s -H "X-API-Key: ${API_KEY}" "${BASE_URL}${endpoint}")
    fi
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Response: $response"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Check if service is running
echo "Checking if Chatbot Service is running..."
health_check=$(curl -s "${BASE_URL}/health")
if echo "$health_check" | grep -q '"status":"OK"'; then
    echo -e "${GREEN}✓ Chatbot Service is running${NC}"
    echo ""
else
    echo -e "${RED}✗ Chatbot Service is not running on port 3005${NC}"
    echo "Please start the service with: npm run dev"
    exit 1
fi

# Test AI Connection
echo "=========================================="
echo "AI CONNECTION TEST"
echo "=========================================="
echo ""

echo -e "${BLUE}Testing OpenRouter AI connection...${NC}"
ai_test=$(curl -s "${BASE_URL}/test-ai")
if echo "$ai_test" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ OpenRouter AI is working${NC}"
    echo "Model: $(echo "$ai_test" | grep -o '"model":"[^"]*"' | cut -d'"' -f4)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ OpenRouter AI connection failed${NC}"
    echo "Response: $ai_test"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 1: Get Suggested Queries
echo "=========================================="
echo "TEST 1: SUGGESTED QUERIES"
echo "=========================================="
echo ""

test_endpoint \
    "Get suggested queries" \
    "GET" \
    "/api/chat/suggested-queries?mandt=${MANDT}"

# Test 2: General Inventory Query
echo "=========================================="
echo "TEST 2: GENERAL INVENTORY QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Ask about inventory status" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"What is the current inventory status?\"}"

# Test 3: Purchase Order Query
echo "=========================================="
echo "TEST 3: PURCHASE ORDER QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Ask about purchase orders" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"Show me all purchase orders\"}"

# Test 4: Location-based Query
echo "=========================================="
echo "TEST 4: LOCATION-BASED QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Ask about items in warehouse" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"Which items are in the warehouse?\"}"

# Test 5: Count Query
echo "=========================================="
echo "TEST 5: COUNT QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Ask how many items in stock" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"How many items are currently in stock?\"}"

# Test 6: Missing SGTINs Query
echo "=========================================="
echo "TEST 6: MISSING SGTINS QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Ask about products without SGTINs" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"Which products don't have SGTINs yet?\"}"

# Test 7: Counterfeit Detection Query
echo "=========================================="
echo "TEST 7: COUNTERFEIT DETECTION QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Ask about counterfeit attempts" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"Show me recent counterfeit detection logs\"}"

# Test 8: Specific PO Query (if PO exists)
echo "=========================================="
echo "TEST 8: SPECIFIC PO QUERY"
echo "=========================================="
echo ""

# First, get a PO number from the system
echo "Getting a PO number from the system..."
po_response=$(curl -s -H "X-API-Key: ${API_KEY}" "http://localhost:3002/api/purchase-orders?mandt=${MANDT}")
po_id=$(echo "$po_response" | grep -o '"po_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$po_id" ]; then
    echo "Found PO: $po_id"
    test_endpoint \
        "Ask about specific PO" \
        "POST" \
        "/api/chat/query" \
        "{\"mandt\":\"${MANDT}\",\"question\":\"What is the status of PO ${po_id}?\"}"
else
    echo -e "${YELLOW}⊘ Skipped: No PO found in system${NC}"
    echo ""
fi

# Test 9: Brand Query
echo "=========================================="
echo "TEST 9: BRAND QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Ask about items from a specific brand" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"Show me all items from ChocoDreams brand\"}"

# Test 10: Conversation Context
echo "=========================================="
echo "TEST 10: CONVERSATION CONTEXT"
echo "=========================================="
echo ""

echo -e "${BLUE}Testing conversation with context...${NC}"

# First query
conv_response=$(curl -s -X POST "${BASE_URL}/api/chat/query" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d "{\"mandt\":\"${MANDT}\",\"question\":\"How many purchase orders are there?\"}")

if echo "$conv_response" | grep -q '"success":true'; then
    conv_id=$(echo "$conv_response" | grep -o '"conversationId":"[^"]*"' | cut -d'"' -f4)
    echo "Conversation ID: $conv_id"
    
    # Follow-up query using same conversation
    followup_response=$(curl -s -X POST "${BASE_URL}/api/chat/query" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d "{\"mandt\":\"${MANDT}\",\"question\":\"How many are open?\",\"conversationId\":\"${conv_id}\"}")
    
    if echo "$followup_response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ PASSED - Conversation context maintained${NC}"
        PASSED=$((PASSED + 1))
        
        # Test getting history
        history_response=$(curl -s -H "X-API-Key: ${API_KEY}" \
            "${BASE_URL}/api/chat/history?mandt=${MANDT}&conversationId=${conv_id}")
        
        if echo "$history_response" | grep -q '"success":true'; then
            echo -e "${GREEN}✓ PASSED - Conversation history retrieved${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}✗ FAILED - Could not retrieve history${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "${RED}✗ FAILED - Follow-up query failed${NC}"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${RED}✗ FAILED - Initial conversation query failed${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 11: Complex Query
echo "=========================================="
echo "TEST 11: COMPLEX QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Complex multi-criteria query" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"Show me all items that are in stock in the warehouse and tell me which suppliers they came from\"}"

# Test 12: Status Query
echo "=========================================="
echo "TEST 12: STATUS QUERY"
echo "=========================================="
echo ""

test_endpoint \
    "Query items by status" \
    "POST" \
    "/api/chat/query" \
    "{\"mandt\":\"${MANDT}\",\"question\":\"Show me all items with status CREATED\"}"

# Summary
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✅ ALL TESTS PASSED"
    echo "==========================================${NC}"
    exit 0
else
    echo -e "${RED}=========================================="
    echo "❌ SOME TESTS FAILED"
    echo "==========================================${NC}"
    exit 1
fi
