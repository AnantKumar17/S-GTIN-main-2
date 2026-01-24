# SGTIN Lifecycle Management System

## Project Overview

**SGTIN Lifecycle Management System** is a proof-of-concept (POC) application that enables item-level tracking of retail products using Serialized Global Trade Item Numbers (SGTINs). This system addresses retail blind spots by providing complete lifecycle visibility from manufacturing to point of sale.

### Key Features

- **SGTIN Generation**: Automatic generation of unique serialized identifiers in GS1 format
- **Purchase Order Management**: Create POs with automated SGTIN assignment
- **Goods Receipt**: Barcode/QR scanning for receiving items into inventory
- **Point of Sale**: Sales transaction processing with counterfeit detection
- **Intelligent Q&A Chatbot**: Natural language queries for business intelligence
- **Digital Product Passport**: QR-scannable product authenticity and lifecycle information
- **Multi-Tenant Architecture**: Production-ready with SAP MANDT standard

### Technology Stack

- **Backend**: Node.js 18+ with Express
- **Database**: PostgreSQL 14+ (migration path to SAP HANA Cloud)
- **Frontend**: SAP UI5 (OpenUI5 SDK)
- **AI**: OpenAI GPT-4 / Claude with RAG
- **APIs**: REST with OpenAPI 3.0 specifications

### Architecture

Loosely coupled microservices architecture:
- **SGTIN Service** (Port 3001): SGTIN generation and validation
- **PO Service** (Port 3002): Purchase order management
- **Inventory Service** (Port 3003): Goods receipt and inventory tracking
- **POS Service** (Port 3004): Sales transactions and counterfeit detection
- **Chatbot Service** (Port 3005): Intelligent Q&A with RAG

## Project Structure

```
S-GTIN/
├── services/
│   ├── sgtin-service/
│   ├── po-service/
│   ├── inventory-service/
│   ├── pos-service/
│   └── chatbot-service/
├── frontend/                 # SAP UI5 application
├── database/
│   ├── schema.sql           # Database schema
│   └── seed-data.sql        # Sample data
├── docs/
│   ├── sgtin-service-api.yaml
│   ├── po-service-api.yaml
│   ├── inventory-service-api.yaml
│   ├── pos-service-api.yaml
│   └── chatbot-service-api.yaml
└── references/
    ├── development_roadmap.txt
    └── sample_app_folder/
```

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- OpenAI API key (for chatbot service)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Or download from:** https://www.postgresql.org/download/

### 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE sgtin_db;

# Create user (optional)
CREATE USER sgtin_user WITH PASSWORD 'sgtin_password';
GRANT ALL PRIVILEGES ON DATABASE sgtin_db TO sgtin_user;

# Exit psql
\q
```

### 3. Initialize Database Schema

```bash
cd /Users/I528623/HRE/git_repos/S-GTIN/database
psql -d sgtin_db -f schema.sql
psql -d sgtin_db -f seed-data.sql
```

### 4. Install Service Dependencies

```bash
# Install dependencies for all services
cd /Users/I528623/HRE/git_repos/S-GTIN

# SGTIN Service
cd services/sgtin-service
npm install
cp .env.example .env

# PO Service
cd ../po-service
npm install
cp .env.example .env

# Inventory Service
cd ../inventory-service
npm install
cp .env.example .env

# POS Service
cd ../pos-service
npm install
cp .env.example .env

# Chatbot Service
cd ../chatbot-service
npm install
cp .env.example .env
# IMPORTANT: Edit .env and add your OpenAI API key
```

### 5. Configure Environment Variables

Edit each service's `.env` file and update database credentials if needed:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sgtin_db
DB_USER=postgres
DB_PASSWORD=your_password
MANDT=100
```

For chatbot service, add your OpenAI API key:
```env
OPENAI_API_KEY=sk-...your_api_key_here
```

## Running the Application

### Start All Services

Open 5 terminal windows and start each service:

**Terminal 1 - SGTIN Service:**
```bash
cd /Users/I528623/HRE/git_repos/S-GTIN/services/sgtin-service
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 - PO Service:**
```bash
cd /Users/I528623/HRE/git_repos/S-GTIN/services/po-service
npm run dev
# Runs on http://localhost:3002
```

**Terminal 3 - Inventory Service:**
```bash
cd /Users/I528623/HRE/git_repos/S-GTIN/services/inventory-service
npm run dev
# Runs on http://localhost:3003
```

**Terminal 4 - POS Service:**
```bash
cd /Users/I528623/HRE/git_repos/S-GTIN/services/pos-service
npm run dev
# Runs on http://localhost:3004
```

**Terminal 5 - Chatbot Service:**
```bash
cd /Users/I528623/HRE/git_repos/S-GTIN/services/chatbot-service
npm run dev
# Runs on http://localhost:3005
```

### Start Frontend

The frontend is a static SAP UI5 application. You can serve it using:

**Option 1: Using Python:**
```bash
cd /Users/I528623/HRE/git_repos/S-GTIN/frontend
python3 -m http.server 8080
```

**Option 2: Using Node.js http-server:**
```bash
npm install -g http-server
cd /Users/I528623/HRE/git_repos/S-GTIN/frontend
http-server -p 8080
```

**Option 3: Using VS Code Live Server extension**

Access the application at: **http://localhost:8080**

## API Documentation

Interactive API documentation is available at:

- SGTIN Service: http://localhost:3001/api-docs
- PO Service: http://localhost:3002/api-docs
- Inventory Service: http://localhost:3003/api-docs
- POS Service: http://localhost:3004/api-docs
- Chatbot Service: http://localhost:3005/api-docs

OpenAPI specifications are in the `docs/` folder.

## Usage Examples

### 1. Create Purchase Order with SGTINs

```bash
curl -X POST http://localhost:3002/api/purchase-orders \
  -H "Content-Type: application/json" \
  -d '{
    "mandt": "100",
    "gtin": "04012345678901",
    "quantity": 10,
    "supplier": "Adidas Supply Co.",
    "warehouse": "Warehouse A"
  }'
```

### 2. Validate an SGTIN

```bash
curl "http://localhost:3001/api/sgtin/validate/0104012345678901211000000001?mandt=100"
```

### 3. Ask Chatbot a Question

```bash
curl -X POST http://localhost:3005/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{
    "mandt": "100",
    "question": "What is the status of PO 45000023?"
  }'
```

### 4. View Inventory

```bash
curl "http://localhost:3003/api/inventory?mandt=100&status=IN_STOCK"
```

## Sample Chatbot Queries

Try these natural language queries in the chatbot interface:

- "What's the status of PO 45000023?"
- "Show me all Adidas items without SGTIN"
- "Which items from batch JAN26-ADIDAS-BLUE are in Warehouse A?"
- "List all counterfeit scans from today"
- "How many items are currently in stock?"
- "Which purchase orders are partially received?"
- "Show products from H&M in Bangalore warehouse"

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Test connection
psql -h localhost -U postgres -d sgtin_db
```

### Port Already in Use

```bash
# Find process using port 3001 (example)
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Frontend Not Loading

- Ensure CORS is enabled on all backend services
- Check browser console for errors
- Verify all services are running

## Development Roadmap

See `references/development_roadmap.txt` for complete POC roadmap and feature list.

