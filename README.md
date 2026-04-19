# S-MARKET: SGTIN Lifecycle System

> **Team:** HRE-SAPify &nbsp;|&nbsp; **Team No.:** BLRSMT08

A full-stack SAP-integrated system that assigns **unique digital identities (SGTINs)** to every inventory item — enabling item-level traceability from purchase order through point-of-sale.

---

## Problem Statement

Retailers today know *what* they sell, but not *which exact item* — creating blind spots across the supply chain:

| Problem | Impact |
|---|---|
| **Inventory Shrinkage** | Cannot track individual items going missing |
| **Counterfeits** | No per-unit authenticity verification at POS |
| **Recalls** | Batch-based only; cannot isolate specific compromised units |

---

## What is an SGTIN?

An **SGTIN (Serialised Global Trade Item Number)** is a standard that combines a product's GTIN with a unique serial number, giving every physical unit its own **digital passport**. This enables granular lifecycle visibility from factory to consumer.

---

## Key Features

### Complete SGTIN Lifecycle
1. Create a Purchase Order (e.g., 10 Adidas shirts)
2. System auto-generates 10 unique SGTINs
3. Download barcode labels for warehouse scanning
4. Scan goods receipt to update inventory
5. Track each sale at POS with SGTIN-level precision
6. Real-time inventory updated after every transaction

### Product Passport & Lookup
- Every product gets a unique digital passport
- Full lifecycle visibility: Factory → Warehouse → Store → Consumer
- Generate audit reports for any SGTIN on demand

### AI Chatbot (Natural Language Queries)
Ask in plain English — get instant, structured answers:
- *"What's the status of PO 45000023?"*
- *"Show me all Adidas items with SGTIN"*
- *"Which items from warehouse X are in Bangalore?"*
- *"Show me counterfeit alerts for last month"*

### Counterfeit Detection (Real-Time Fraud Prevention)

| Alert | Description |
|---|---|
| **COUNTERFEIT DETECTED** | Unknown SGTIN scanned at POS — transaction blocked, security alert sent |
| **ITEM ALREADY SOLD** | Previously sold item detected — shows last sale date |

**Validation pipeline at POS:**
- ✓ Validate SGTIN exists in database
- ✓ Check item status (NEW / IN_STOCK / SOLD)
- ✓ Verify store authorization

---

## Architecture Overview

```
Purchase Order → SGTIN Generation → Barcode Labels
        ↓
Goods Receipt Scan → Inventory Update
        ↓
POS Scan → SGTIN Validation → Counterfeit Check → Sale Recorded
        ↓
AI Chatbot ← SQLite/SAP DB ← Real-time Inventory
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Services | Node.js / JavaScript |
| Database | SQLite + SAP integration |
| Frontend | React (web dashboard) |
| Containerisation | Docker Compose |
| Barcodes | Auto-generated SGTIN barcode labels |
| Deployment | Vercel (frontend) |

---

## Getting Started

### Prerequisites
- Node.js 16+
- Docker & Docker Compose
- npm

### Quick Start

```bash
# Clone the repo
git clone https://github.com/AnantKumar17/S-GTIN-main-2.git
cd S-GTIN-main-2

# Install all dependencies
bash install-all.sh

# Start all services
docker-compose up
```

---

## Project Structure

```
S-GTIN-main-2/
├── services/          # Backend microservices (inventory, POS, SGTIN gen)
├── frontend/          # React web dashboard
├── database/          # DB schemas and seed scripts
├── shared/            # Shared utilities and constants
├── docs/              # Architecture and design documents
├── references/        # Research and SGTIN standard references
├── docker-compose.yml
└── install-all.sh
```

---

## Business Impact

| Metric | Result |
|---|---|
| Shrinkage | Significant reduction through item-level tracking |
| Counterfeits | Real-time POS authenticity verification |
| Recall Efficiency | Major waste reduction — unit-specific recalls replace batch recalls |
| Consumer Trust | Digital product passports verify authenticity at the point of purchase |

---

## Documentation

- [Barcode Feature README](BARCODE_FEATURE_README.md)
- [Vercel Deployment Guide](VERCEL_DEPLOYMENT.md)
- [Inventory Service Deployment Notes](INVENTORY_SERVICE_DEPLOYMENT_ISSUE.md)
- [SGTIN Product Passport Presentation](SGTIN_Product_Passport_Presentation.md)
