#!/bin/bash
# Configuration file for test_phase_0_to_2.sh

# ===========================================
# DATA MANAGEMENT SETTINGS
# ===========================================

# CLEANUP_DATA: Set to "true" to delete all existing data before testing
# Set to "false" to keep existing data and run tests on current state
CLEANUP_DATA="false"

# INSERT_PRODUCTS: Set to "true" to insert 5 new SAP S.Market products
# Only applicable when CLEANUP_DATA="true"
INSERT_PRODUCTS="false"

# ===========================================
# TEST EXECUTION SETTINGS
# ===========================================

# SKIP_PHASE_0: Set to "true" to skip Phase 0 verification (faster for repeated tests)
SKIP_PHASE_0="false"

# SKIP_PHASE_1: Set to "true" to skip Phase 1 verification
SKIP_PHASE_1="false"

# CONTINUE_ON_ERROR: Set to "true" to continue testing even if a task fails
CONTINUE_ON_ERROR="false"

# ===========================================
# SERVICE SETTINGS
# ===========================================

# CHECK_SERVICES: Set to "true" to verify all services are running before testing
CHECK_SERVICES="true"

# AUTO_START_SERVICES: Set to "true" to attempt starting stopped services
# WARNING: This will start services in background - you may need to kill them manually later
AUTO_START_SERVICES="false"

# ===========================================
# DATABASE SETTINGS
# ===========================================

# Multi-tenancy identifier
MANDT="100"

# Database connection (adjust if your setup differs)
DB_USER="I762188"
DB_NAME="sgtin_db"

# ===========================================
# SERVICE ENDPOINTS
# ===========================================

BASE_URL_SGTIN="http://localhost:3001"
BASE_URL_PO="http://localhost:3002"
BASE_URL_INV="http://localhost:3003"
BASE_URL_POS="http://localhost:3004"

# API Key for secured endpoints (use dev key for testing)
API_KEY="dev-api-key-12345"

# ===========================================
# OUTPUT SETTINGS
# ===========================================

# VERBOSE: Set to "true" for detailed output
VERBOSE="false"

# LOG_FILE: Path to log file (leave empty to disable file logging)
LOG_FILE=""
