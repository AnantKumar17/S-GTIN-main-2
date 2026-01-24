#!/bin/bash

# ============================================================================
# Test Data Insertion Script
# ============================================================================
# This script reads test_data.txt and inserts only enabled product sections
# into the PostgreSQL database with proper error handling and validation
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DATA_FILE="$SCRIPT_DIR/test_data.txt"
DB_NAME="sgtin_db"
DB_USER="I528623"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test Data Insertion Script${NC}"
echo -e "${BLUE}============================================${NC}"

# Check if test data file exists
if [ ! -f "$TEST_DATA_FILE" ]; then
    echo -e "${RED}✗ Error: test_data.txt not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found test_data.txt${NC}"

# Parse the file and extract enabled sections
declare -a PRODUCTS_TO_INSERT

current_section=""
section_enabled=false

while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Check for section enable/disable flag
    if [[ "$line" =~ ^SECTION_.*=(true|false)$ ]]; then
        section_name=$(echo "$line" | cut -d'=' -f1)
        section_value=$(echo "$line" | cut -d'=' -f2)
        
        if [ "$section_value" == "true" ]; then
            section_enabled=true
            echo -e "${YELLOW}→ Section enabled: $section_name${NC}"
        else
            section_enabled=false
        fi
        continue
    fi
    
    # If we have a product line and section is enabled
    if [ "$section_enabled" == true ] && [[ "$line" =~ ^[0-9]{3}\| ]]; then
        PRODUCTS_TO_INSERT+=("$line")
    fi
done < "$TEST_DATA_FILE"

# Check if any products are ready to insert
if [ ${#PRODUCTS_TO_INSERT[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠ No products to insert (all sections disabled)${NC}"
    echo -e "${YELLOW}→ Edit test_data.txt and set SECTION_X=true to enable${NC}"
    exit 0
fi

echo -e "${GREEN}✓ Found ${#PRODUCTS_TO_INSERT[@]} products to insert${NC}"
echo ""

# Display products that will be inserted
echo -e "${BLUE}Products to insert:${NC}"
for product in "${PRODUCTS_TO_INSERT[@]}"; do
    gtin=$(echo "$product" | cut -d'|' -f2)
    name=$(echo "$product" | cut -d'|' -f3)
    echo -e "  - GTIN: $gtin | $name"
done
echo ""

# Ask for confirmation
read -p "Do you want to proceed with insertion? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Insertion cancelled${NC}"
    exit 0
fi

# Build SQL INSERT statements
SQL_STATEMENTS=""
INSERTED_COUNT=0
FAILED_COUNT=0

for product in "${PRODUCTS_TO_INSERT[@]}"; do
    IFS='|' read -r mandt gtin name brand category subcategory price description <<< "$product"
    
    # Build SQL INSERT
    SQL="INSERT INTO products (mandt, gtin, name, brand, category, subcategory, price, description, created_at, updated_at)
VALUES ('$mandt', '$gtin', '$name', '$brand', '$category', '$subcategory', $price, '$description', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (mandt, gtin) DO NOTHING;"
    
    # Execute SQL
    RESULT=$(psql -U "$DB_USER" -d "$DB_NAME" -c "$SQL" 2>&1)
    
    if [ $? -eq 0 ]; then
        # Check if INSERT was successful (not a duplicate)
        if [[ "$RESULT" == *"INSERT 0 1"* ]]; then
            echo -e "${GREEN}✓ Inserted: $name (GTIN: $gtin)${NC}"
            ((INSERTED_COUNT++))
        else
            echo -e "${YELLOW}⚠ Skipped (already exists): $name (GTIN: $gtin)${NC}"
        fi
    else
        echo -e "${RED}✗ Failed: $name (GTIN: $gtin)${NC}"
        echo -e "${RED}  Error: $RESULT${NC}"
        ((FAILED_COUNT++))
    fi
done

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Insertion Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Total products processed: ${#PRODUCTS_TO_INSERT[@]}"
echo -e "${GREEN}Successfully inserted: $INSERTED_COUNT${NC}"
echo -e "${YELLOW}Skipped (duplicates): $((${#PRODUCTS_TO_INSERT[@]} - INSERTED_COUNT - FAILED_COUNT))${NC}"
echo -e "${RED}Failed: $FAILED_COUNT${NC}"
echo ""

# Verify total count in database
TOTAL_PRODUCTS=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM products WHERE mandt='100';" | tr -d ' ')
echo -e "${GREEN}✓ Total products in database (MANDT=100): $TOTAL_PRODUCTS${NC}"
echo ""
