# SGTIN System - Complete Technical Overview

**Date:** January 21, 2026  
**Status:** Phase 0-2 Complete ✅ | 17/17 Tests Passing  
**API Coverage:** 13/13 Endpoints (100%)

---

## 1. DATABASE ARCHITECTURE

### 1.1 Database Configuration

**Single Database:**
- **Name:** `sgtin_db`
- **Type:** PostgreSQL 14.20
- **Schema:** `public` (default schema)

**Connection Details:**
```javascript
// Location: database/models/db.js
{
  host: 'localhost',
  port: 5432,
  database: 'sgtin_db',
  user: process.env.DB_USER || 'postgres',  // Default: postgres
  password: process.env.DB_PASSWORD || 'postgres',  // Default: postgres
  max: 20  // Connection pool size
}
```

**Authentication:**
- **Username:** `I528623` (your macOS user - PostgreSQL uses peer authentication)
- **Password:** Not required (peer authentication trusts local OS user)
- **Services:** Connect as `postgres` user if DB_USER not set in .env

### 1.2 Tables (12 Total)

| # | Table Name | Purpose | Key Fields |
|---|------------|---------|------------|
| 1 | **products** | Master product data (GTIN level) | mandt, gtin, name, brand, price |
| 2 | **serialized_items** | Individual SGTINs | mandt, sgtin, gtin, status, location |
| 3 | **purchase_orders** | PO headers | mandt, po_id, gtin, quantity, status |
| 4 | **po_sgtin_mapping** | Links POs to SGTINs | mandt, po_id, sgtin |
| 5 | **goods_receipts** | Warehouse receipts | mandt, gr_id, po_id, warehouse |
| 6 | **gr_sgtin_mapping** | Links receipts to SGTINs | mandt, gr_id, sgtin |
| 7 | **sales** | Sales headers | mandt, sale_id, store_id, total_amount |
| 8 | **sale_items** | Sale line items | mandt, sale_id, sgtin, price |
| 9 | **counterfeit_logs** | Fraud detection logs | mandt, sgtin, reason, details |
| 10 | **lifecycle_events** | SGTIN history tracking | mandt, sgtin, event_type, metadata |
| 11 | **chat_conversations** | Chatbot sessions | mandt, conversation_id, user_id |
| 12 | **chat_messages** | Chat history | mandt, message_id, role, content |

**Multi-Tenancy:**
- All tables have `mandt VARCHAR(3)` field (SAP standard)
- Current tenant: `MANDT='100'`
- Composite primary keys: `(mandt, <entity_id>)`

### 1.3 Current Data State

**After Last Test Run:**
```
products: 5 rows (SAP S.Market confectionery)
serialized_items: ~15 SGTINs
purchase_orders: 3 POs
lifecycle_events: 10+ events
sales: Several test sales
counterfeit_logs: Test entries
```

---

## 2. SGTIN GENERATION LOGIC

### 2.1 Current Implementation ✅

**Location:** `services/sgtin-service/src/utils/sgtinUtils.js`

**Method:** PostgreSQL Sequence (Foolproof)

```sql
-- Sequence created in database schema
CREATE SEQUENCE IF NOT EXISTS sgtin_serial_sequence START 1;

-- Usage in code
const result = await db.query(
  'SELECT nextval($1) as serial',
  ['sgtin_serial_sequence']
);
const serial = result.rows[0].serial.toString().padStart(13, '0');
```

**SGTIN Format:**
```javascript
function generateSGTIN(gtin, serial) {
  // GS1 format: 01{14-digit GTIN}21{13-digit serial}
  return `01${gtin}21${serial.padStart(13, '0')}`;
}
```

**Example:**
```
GTIN: 20001234567890
Sequence: 1 → Serial: 0000000000001
SGTIN: 0120001234567890210000000000001
         ↑                ↑
         AI (01)          AI (21)
```

### 2.2 Uniqueness Guarantee ✅

**Current Implementation:**
- ✅ **Foolproof** - Uses database sequence (auto-incrementing)
- ✅ **No collisions** - Sequence guarantees uniqueness
- ✅ **Thread-safe** - PostgreSQL handles concurrent requests
- ✅ **No reuse** - Sequence never decrements (GS1 compliant)

**Protection Layers:**
```sql
-- Layer 1: Sequence guarantees unique serials
CREATE SEQUENCE sgtin_serial_sequence;

-- Layer 2: Primary key prevents duplicates
ALTER TABLE serialized_items 
  ADD PRIMARY KEY (mandt, sgtin);

-- Layer 3: Check constraint validates format
ALTER TABLE serialized_items 
  ADD CONSTRAINT check_sgtin_format 
  CHECK (sgtin ~ '^01[0-9]{14}21[0-9]{13}$');
```

### 2.3 SGTIN Lifecycle - GS1 Compliant ✅

**GS1 Standard (Real World):**
- SGTINs are **NEVER reused** - even if item is deleted ✅
- Each serial is unique for product's entire lifecycle ✅
- Regulatory requirement for traceability ✅
- Deleted records archived, not removed ✅

**Our Implementation:**
- ✅ **Soft delete** enabled (status='DELETED')
- ✅ **Sequence never resets** - serials never reused
- ✅ **Complete audit trail** in lifecycle_events table
- ✅ **Archive table** ready for future implementation

```sql
-- Soft delete (current approach)
UPDATE serialized_items 
SET status = 'DELETED', 
    deleted_at = NOW(),
    deleted_by = 'system'
WHERE sgtin = '...';

-- Future: Archive table
CREATE TABLE serialized_items_archive (
  LIKE serialized_items INCLUDING ALL,
  archived_at TIMESTAMP DEFAULT NOW()
);
```

**Status Flow:**
```
CREATED → IN_STOCK → SOLD → (DELETED - soft)
   ↑         ↑         ↑         ↑
  PO    Goods Receipt  Sale   Archive
```

---

## 3. API ENDPOINTS (13 Total)

### 3.1 SGTIN Service (Port 3001)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/sgtin/generate` | Generate SGTINs for a GTIN |
| GET | `/api/sgtin/validate/:sgtin` | Validate SGTIN format & existence |
| GET | `/api/sgtin/trace/:sgtin` | Get complete lifecycle history |

### 3.2 Purchase Order Service (Port 3002)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/purchase-orders` | Create PO + auto-generate SGTINs |
| GET | `/api/purchase-orders/:poId` | Get PO details |
| GET | `/api/purchase-orders` | List all POs (with filters) |
| GET | `/api/purchase-orders/:poId/labels` | Get barcode labels |

### 3.3 Inventory Service (Port 3003)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/goods-receipts` | Receive goods into warehouse |
| GET | `/api/inventory` | Query inventory (filters: status, location) |
| GET | `/api/inventory/missing-sgtins` | Find products without serialization |

### 3.4 POS Service (Port 3004)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/sales` | Process sale + counterfeit detection |
| GET | `/api/sales/:saleId` | Get sale details |
| GET | `/api/sales/logs/counterfeit` | View fraud detection logs |

---

## 4. HOW THE SYSTEM WORKS

### 4.1 Starting Servers

**Why we start servers manually:**
```bash
# Each service is a separate Node.js Express server
cd services/sgtin-service && node src/server.js &   # Port 3001
cd services/po-service && node src/server.js &      # Port 3002
cd services/inventory-service && node src/server.js & # Port 3003
cd services/pos-service && node src/server.js &     # Port 3004
```

**What happens:**
1. Express server starts listening on port
2. Connects to PostgreSQL database
3. Registers API routes
4. Waits for HTTP requests

**Architecture:**
```
┌─────────────────────────────────────────────┐
│  4 Independent Node.js Servers              │
│  (Microservices Architecture)               │
└─────────────────────────────────────────────┘
         ↓              ↓              ↓
    Port 3001      Port 3002      Port 3003
         ↓              ↓              ↓
         └──────────────┴──────────────┘
                       ↓
                  PostgreSQL
                   sgtin_db
```

### 4.2 Making API Calls (GET/POST)

**Tool:** `curl` command-line HTTP client

**POST Example:**
```bash
curl -X POST http://localhost:3001/api/sgtin/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mandt": "100",
    "gtin": "20001234567890",
    "quantity": 5
  }'
```

**What happens:**
1. Curl sends HTTP POST request to server
2. Express route handler receives request
3. Controller validates input
4. Model queries/inserts to database
5. Response sent back as JSON
6. Curl displays response

**GET Example:**
```bash
curl http://localhost:3001/api/sgtin/validate/0120001234567890217432948824448?mandt=100
```

**Request Flow:**
```
curl → HTTP Request → Express Server → Controller → Model → PostgreSQL
                                                              ↓
curl ← HTTP Response ← Express Server ← Controller ← Model ← PostgreSQL
```

### 4.3 Complete Lifecycle Example

**Step 1: Create PO**
```bash
POST /api/purchase-orders
→ Creates po_id: PO-45000001
→ Calls SGTIN service (inter-service call)
→ Generates 5 SGTINs
→ Inserts into serialized_items (status='CREATED')
→ Inserts into po_sgtin_mapping
→ Inserts into lifecycle_events (event_type='CREATED')
```

**Step 2: Receive Goods**
```bash
POST /api/goods-receipts
→ Validates SGTINs belong to PO
→ Updates serialized_items (status='IN_STOCK')
→ Inserts into lifecycle_events (event_type='RECEIVED')
```

**Step 3: Sell Item**
```bash
POST /api/sales
→ Validates SGTIN exists and status='IN_STOCK'
→ Counterfeit check (3 tests)
→ Updates serialized_items (status='SOLD')
→ Inserts into lifecycle_events (event_type='SOLD')
```

**Step 4: Trace History**
```bash
GET /api/sgtin/trace/{sgtin}
→ Queries lifecycle_events for all events
→ Returns: CREATED → RECEIVED → SOLD
```

---

## 5. WHAT HAS BEEN COMPLETED

### ✅ Phase 0: Foundation (3/3 Tasks)
- Repository structure with 5 microservices
- SAP-compatible stack (Node.js, PostgreSQL)
- OpenAPI 3.0 specifications

### ✅ Phase 1: Multi-Tenant Database (3/3 Tasks)
- 12 tables with MANDT field
- Node.js models with BaseModel
- Sample data (5 SAP S.Market products)

### ✅ Phase 2: Core Microservices (5/5 Tasks)
- **Task 2.1:** SGTIN Generation + Validation + QR/Barcodes
- **Task 2.2:** Purchase Order with auto-SGTIN generation
- **Task 2.3:** Inventory Management (goods receipt, queries)
- **Task 2.4:** POS with counterfeit detection (3-tier checks)
- **Task 2.5:** Traceability Engine (complete lifecycle)

### 🎯 End-to-End Verified
```
GTIN → SGTIN → PO → Goods Receipt → Sale → Traceability
  ✓      ✓      ✓         ✓          ✓          ✓
```

---

## 6. TESTING APPROACH

**Test Script:** `test_phase_0_to_2_improved.sh`  
**Configuration:** `test_config.sh`  
**Test Results:** See `TEST_RESULTS_JAN21_2026.md`

### 6.1 Test Coverage

**Test Suite:** 17 tests covering 13 API endpoints (100%)

| Phase | Tasks | Coverage |
|-------|-------|----------|
| Phase 0 | 3 | Infrastructure verification |
| Phase 1 | 3 | Database schema & models |
| Phase 2 | 11 | All 13 API endpoints |

### 6.2 How Tests Work

```bash
# 1. Configure
nano test_config.sh
  CLEANUP_DATA="false"  # Keep existing data
  INSERT_PRODUCTS="false"  # Don't add more products
  CHECK_SERVICES="true"  # Verify services running
  API_KEY="dev-api-key-12345"

# 2. Run tests
./test_phase_0_to_2_improved.sh

# 3. Script executes:
- ✅ Pre-flight: Verifies 4 services running
- ✅ Phase 0: Checks folders, versions, OpenAPI specs
- ✅ Phase 1: Validates database schema, models, data
- ✅ Phase 2: Tests all 13 endpoints end-to-end
  - Generate SGTINs
  - Create PO (auto-generates 5 SGTINs)
  - Receive goods (IN_STOCK status)
  - Process sale (SOLD status)
  - Trace lifecycle (CREATED→RECEIVED→SOLD)
  - Query endpoints (list, filter, labels, logs)
```

### 6.3 Test Data Management

**Files:**
- `test_data.txt` - Organized product data in sections
- `insert_test_data.sh` - Smart insertion with duplicate handling

**Sections Available:**
```bash
SECTION_1_CHOCOLATES=true   # 5 products (enabled)
SECTION_2_ELECTRONICS=false  # 5 products (disabled)
SECTION_3_APPAREL=false      # 5 products (disabled)
```

**Usage:**
```bash
# Enable section in test_data.txt
nano test_data.txt
# Set SECTION_2_ELECTRONICS=true

# Insert data
bash insert_test_data.sh
# Confirms before insertion
# Skips duplicates automatically
# Reports success/skip/fail counts
```

### 6.4 Latest Test Results ✅

**Date:** January 21, 2026  
**Status:** **ALL TESTS PASSED (17/17)**

```
Phase 0: 3/3 ✅ (infrastructure)
Phase 1: 3/3 ✅ (database)
Phase 2: 11/11 ✅ (all endpoints)

Data Created:
- 5 Products (ChocoDelux)
- 8 SGTINs (sequence-based)
- 1 PO (PO-45000001)
- 1 Sale (SALE-2026-0001)
- 12 Lifecycle events
- 1 Counterfeit log
```

**Security Verified:**
- ✅ API key authentication working
- ✅ Rate limiting active
- ✅ Health checks public (no auth)
- ✅ Multi-tenancy enforced

See `TEST_RESULTS_JAN21_2026.md` for complete details.

---

## 7. PRODUCTION READINESS

### ✅ What's Production-Ready

**Infrastructure:**
- ✅ Microservices architecture (4 independent services)
- ✅ Multi-tenant database (MANDT field in all tables)
- ✅ PostgreSQL connection pooling configured
- ✅ Environment-based configuration (.env files)

**Security:**
- ✅ API key authentication on all endpoints
- ✅ Rate limiting (3 tiers: lenient, strict, specialized)
- ✅ CORS enabled for cross-origin requests
- ✅ Health checks public (no authentication)

**Data Integrity:**
- ✅ SGTIN generation using PostgreSQL sequence (collision-proof)
- ✅ Foreign key constraints enforced
- ✅ Soft delete implementation (preserves traceability)
- ✅ Complete audit trail (lifecycle_events table)

**Testing:**
- ✅ 17 automated tests covering 13 endpoints (100%)
- ✅ Clean database testing approach
- ✅ Flexible test data management
- ✅ End-to-end lifecycle verification

**Documentation:**
- ✅ OpenAPI 3.0 specifications for all services
- ✅ Complete system architecture documented
- ✅ Quick start guide for developers
- ✅ Latest test results available

### ⚠️ Recommendations for Production

**High Priority:**
1. **Replace static API key** with JWT tokens
2. **Enable HTTPS/TLS** for all endpoints
3. **Set up database credentials** (move from peer auth)
4. **Configure reverse proxy** (nginx/Apache) for load balancing
5. **Implement request logging** (morgan, winston)
6. **Add monitoring/alerting** (health check monitoring)

**Medium Priority:**
7. **Database backups** (automated daily)
8. **Error tracking** (Sentry, Rollbar)
9. **Performance monitoring** (New Relic, DataDog)
10. **API documentation portal** (Swagger UI hosted)

**Low Priority:**
11. **CI/CD pipeline** (GitHub Actions, Jenkins)
12. **Load testing** (k6, JMeter)
13. **Container orchestration** (Docker, Kubernetes)

---

## 8. GETTING STARTED

### 🚀 For Developers Cloning This Repo

**Step 1:** Read the documentation
- Start with `QUICK_START_GUIDE.md` (5-minute setup)
- Review `SYSTEM_ARCHITECTURE.md` (technical details)
- Check `TEST_RESULTS_JAN21_2026.md` (latest results)

**Step 2:** Set up environment
```bash
# Install dependencies
cd services/sgtin-service && npm install
cd ../po-service && npm install
cd ../inventory-service && npm install
cd ../pos-service && npm install

# Create database
createdb sgtin_db
psql -U <username> -d sgtin_db -f database/schema.sql

# Optional: Load sample data
psql -U <username> -d sgtin_db -f database/seed-data.sql
```

**Step 3:** Start services
```bash
cd readme_test_scripts_and_test_results
bash start_all_services.sh
```

**Step 4:** Run tests
```bash
bash test_phase_0_to_2_improved.sh
```

**Expected:** ✅ 17/17 tests passing

### 📚 Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **QUICK_START_GUIDE.md** | Setup and testing walkthrough | First time setup |
| **SYSTEM_ARCHITECTURE.md** | Technical deep-dive | Understanding internals |
| **TEST_RESULTS_JAN21_2026.md** | Latest test execution details | Verifying system works |
| **README.md** | Main project documentation | Overview and usage |
| **test_config.sh** | Test configuration options | Customizing test runs |
| **test_data.txt** | Test product data | Managing test data |

---

## 9. NEXT STEPS

### Phase 3: Chatbot & Analytics (Upcoming)

**Planned Features:**
- Q&A chatbot service (Port 3005)
- RAG architecture for intelligent responses
- Analytics endpoints (sales reports, inventory insights)
- SAP UI5 frontend integration

**Current Status:** Phase 0-2 Complete ✅

---

*Last Updated: January 21, 2026*  
*Test Status: 17/17 Passing ✅*  
*API Coverage: 13/13 Endpoints (100%)*

