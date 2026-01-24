# SGTIN System - Quick Start Testing Guide

**Last Updated:** January 21, 2026  
**Test Status:** ✅ 17/17 Tests Passing

---

## 📋 What's in This Folder?

| File | Purpose |
|------|---------|
| **start_all_services.sh** | Starts all 4 microservices with security enabled |
| **test_phase_0_to_2_improved.sh** | Comprehensive test suite (17 tests) |
| **test_config.sh** | Test configuration (cleanup, data insertion toggles) |
| **test_data.txt** | Product data organized in sections (chocolates, electronics, apparel) |
| **insert_test_data.sh** | Smart data insertion script with duplicate handling |
| **README.md** | Full system documentation |
| **SYSTEM_ARCHITECTURE.md** | Technical deep-dive (database, APIs, architecture) |
| **TEST_RESULTS_JAN21_2026.md** | Latest test execution results |

---

## 🚀 Quick Start (3 Steps)

### Step 1: Database Setup (One-time)

```bash
# Create database if not exists
createdb sgtin_db

# Load schema
psql -U <your-username> -d sgtin_db -f database/schema.sql

# Load sample data (optional - 21 Adidas/Nike products)
psql -U <your-username> -d sgtin_db -f database/seed-data.sql
```

### Step 2: Start Services

```bash
cd readme_test_scripts_and_test_results
bash start_all_services.sh
```

**Expected Output:**
```
✅ All services started!
Service PIDs:
  SGTIN Service (3001): 12345
  PO Service (3002): 12346
  Inventory Service (3003): 12347
  POS Service (3004): 12348
```

### Step 3: Run Tests

```bash
bash test_phase_0_to_2_improved.sh
```

**Expected:** `✅ ALL TESTS PASSED (17/17)`

---

## 🎯 Complete Test Workflow (Clean Database)

Follow these steps for a fresh test run:

### 1️⃣ Clean Database
```bash
psql -U <username> -d sgtin_db -c "TRUNCATE TABLE chat_messages, chat_conversations, lifecycle_events, counterfeit_logs, sale_items, sales, gr_sgtin_mapping, goods_receipts, po_sgtin_mapping, purchase_orders, serialized_items, products CASCADE;"
```

### 2️⃣ Reset SGTIN Sequence
```bash
psql -U <username> -d sgtin_db -c "SELECT setval('sgtin_serial_sequence', 1, false);"
```

### 3️⃣ Insert Test Products
```bash
cd readme_test_scripts_and_test_results
bash insert_test_data.sh
# Type 'y' when prompted
```

**This inserts 5 ChocoDelux products** (Section 1 enabled in test_data.txt)

### 4️⃣ Restart Services
```bash
# Stop all services
pkill -9 -f "node src/server.js"

# Start fresh
bash start_all_services.sh
sleep 4
```

### 5️⃣ Verify Services Running
```bash
# Check health endpoints (no auth required)
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

### 6️⃣ Run Test Suite
```bash
bash test_phase_0_to_2_improved.sh
```

---

## 📊 What the Tests Do

### Phase 0: Foundation (3 tests)
- ✅ **Task 0.1:** Verifies 5 microservices folders exist
- ✅ **Task 0.2:** Checks Node.js and PostgreSQL versions
- ✅ **Task 0.3:** Validates 5 OpenAPI spec files

### Phase 1: Database (3 tests)
- ✅ **Task 1.1:** Verifies products exist with MANDT='100'
- ✅ **Task 1.2:** Checks 8 data model files
- ✅ **Task 1.3:** Lists sample products in database

### Phase 2: API Endpoints (11 tests)

**Core Workflow (Tasks 2.1-2.5):**
1. **Generate SGTINs** → Creates 3 standalone SGTINs
2. **Create Purchase Order** → Generates 5 more SGTINs via PO
3. **Receive Goods** → Moves 3 SGTINs to IN_STOCK status
4. **Process Sale** → Sells 1 SGTIN, detects fake SGTIN
5. **Trace Lifecycle** → Verifies CREATED→RECEIVED→SOLD

**Additional Endpoints (Tasks 2.6-2.10):**
6. **List POs** → Tests filters (status=CREATED)
7. **Generate Labels** → Returns barcodes/QR codes
8. **Missing SGTINs** → Finds products without serialization
9. **Sale Details** → Retrieves complete sale info
10. **Counterfeit Logs** → Checks fraud detection records

---

## 🔧 Test Configuration

Edit `test_config.sh` to customize test behavior:

```bash
# Clean database before testing?
CLEANUP_DATA="false"  # Set to "true" to TRUNCATE all tables

# Insert 5 test products?
INSERT_PRODUCTS="false"  # Set to "true" to add sample products

# Check if services are running?
CHECK_SERVICES="true"  # Fails fast if services down

# Continue on errors?
CONTINUE_ON_ERROR="false"  # Set to "true" to run all tests

# Which tenant?
MANDT="100"  # SAP multi-tenancy client

# API Key
API_KEY="dev-api-key-12345"  # Required for authenticated endpoints
```

---

## 🗂️ Managing Test Data

### View Available Data Sections

```bash
cat test_data.txt
```

**Sections:**
- ✅ **Section 1: Chocolates** (5 products, ENABLED)
- ⬜ **Section 2: Electronics** (5 products, DISABLED)
- ⬜ **Section 3: Apparel** (5 products, DISABLED)

### Enable Additional Sections

```bash
nano test_data.txt

# Change this line:
SECTION_2_ELECTRONICS=false

# To this:
SECTION_2_ELECTRONICS=true

# Then run:
bash insert_test_data.sh
```

---

## 🔍 Validation Commands

### Check Database Contents
```bash
psql -U <username> -d sgtin_db

-- How many products?
SELECT COUNT(*) FROM products WHERE mandt='100';

-- How many SGTINs generated?
SELECT COUNT(*) FROM serialized_items WHERE mandt='100';

-- What statuses do SGTINs have?
SELECT status, COUNT(*) FROM serialized_items WHERE mandt='100' GROUP BY status;

-- View lifecycle events
SELECT sgtin, event_type, created_at 
FROM lifecycle_events 
WHERE mandt='100' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Services Status
```bash
# List running node processes
ps aux | grep "node src/server.js" | grep -v grep

# Check port listeners
lsof -i :3001,:3002,:3003,:3004 | grep LISTEN
```

### Manual API Testing
```bash
# Generate SGTINs (requires API key)
curl -X POST http://localhost:3001/api/sgtin/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "mandt": "100",
    "gtin": "20001234567890",
    "quantity": 3
  }'

# Validate SGTIN
curl -H "X-API-Key: dev-api-key-12345" \
  "http://localhost:3001/api/sgtin/validate/0120001234567890210000000000001?mandt=100"

# Trace lifecycle
curl -H "X-API-Key: dev-api-key-12345" \
  "http://localhost:3001/api/sgtin/trace/0120001234567890210000000000001?mandt=100"
```

---

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check if ports already in use
lsof -i :3001,:3002,:3003,:3004

# Kill existing processes
pkill -9 -f "node src/server.js"

# Check logs
tail -f /tmp/sgtin-service.log
tail -f /tmp/po-service.log
tail -f /tmp/inventory-service.log
tail -f /tmp/pos-service.log
```

### Database Connection Errors
```bash
# Verify PostgreSQL is running
psql -U <username> -d sgtin_db -c "SELECT version();"

# Check connection settings in services
cat services/sgtin-service/.env
# Should have: DB_USER=<your-username>, DB_NAME=sgtin_db
```

### Tests Fail with "401 Unauthorized"
```bash
# Check API key in test config
grep API_KEY readme_test_scripts_and_test_results/test_config.sh

# Should be: API_KEY="dev-api-key-12345"

# Verify services use same key
grep API_KEY services/*/src/server.js
```

### "SGTIN Already Exists" Error
```bash
# This means database has old data
# Solution: Clean database (see Step 1 above)
```

---

## 📈 Expected Test Output

```
==========================================
SGTIN LIFECYCLE SYSTEM - COMPREHENSIVE TEST
Testing Phases 0, 1, and 2
==========================================

✓ All 4 services are running

Phase 0: 3/3 tests passed
Phase 1: 3/3 tests passed
Phase 2: 11/11 tests passed

==========================================
TEST SUMMARY
==========================================

Passed: 17
Failed: 0
Skipped: 0
Total: 17

✅ ALL TESTS PASSED
==========================================
```

---

## 🎓 Understanding the Test Flow

1. **Services Start** → 4 Node.js servers listening on ports 3001-3004
2. **Test Begins** → Script checks infrastructure (folders, versions, specs)
3. **Database Check** → Verifies products exist with MANDT='100'
4. **SGTIN Generation** → Creates unique serial numbers using PostgreSQL sequence
5. **Purchase Order** → Calls SGTIN service internally to generate 5 serials
6. **Goods Receipt** → Moves items from CREATED to IN_STOCK
7. **Sale Transaction** → Updates status to SOLD, logs lifecycle event
8. **Counterfeit Test** → Detects fake SGTIN, logs to counterfeit_logs table
9. **Traceability** → Traces complete history: CREATED→RECEIVED→SOLD
10. **Query Endpoints** → Tests listing, filtering, and reporting APIs

---

## 📝 Summary

**What You Need:**
- PostgreSQL 14+ running
- Node.js 20+ installed
- Database `sgtin_db` created with schema loaded
- 5 minutes of your time

**What You Get:**
- 17 automated tests covering 13 API endpoints
- Complete lifecycle testing (create→receive→sell→trace)
- Production security (API key auth + rate limiting)
- Clean data management (insert/cleanup scripts)
- Full traceability and counterfeit detection

**Next Steps:**
1. Run the tests following this guide
2. Check [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) for technical details
3. Review [TEST_RESULTS_JAN21_2026.md](TEST_RESULTS_JAN21_2026.md) for latest results
4. Start building Phase 3 features (chatbot, analytics, UI)

---

*Happy Testing! 🚀*
