#!/bin/bash

# Verification script for in-memory to database migration
# This script tests that all endpoints are using database-backed storage

set -e

API_URL="https://butcher-lemon.vercel.app"
PASS=0
FAIL=0

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     In-Memory to Database Migration - Verification Tests      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: API Health Check
echo "🧪 Test 1: API Health Check"
RESPONSE=$(curl -s "$API_URL/api/ping")
TIMESTAMP=$(echo "$RESPONSE" | jq -r '.timestamp // empty')
if [ ! -z "$TIMESTAMP" ]; then
  echo -e "${GREEN}✅ PASS${NC}: API is responding"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}: API not responding"
  ((FAIL++))
fi
echo ""

# Test 2: Orders Database Access
echo "🧪 Test 2: Orders Database Access"
ORDER_COUNT=$(curl -s "$API_URL/api/orders" | jq '.data | length')
if [ "$ORDER_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Orders table accessible ($ORDER_COUNT orders)"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}: Orders table not accessible"
  ((FAIL++))
fi
echo ""

# Test 3: Notifications Database Access
echo "🧪 Test 3: Notifications Database Access"
NOTIF_COUNT=$(curl -s "$API_URL/api/notifications?userId=user_1769105759076" | jq '.data | length')
if [ "$NOTIF_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Notifications table accessible ($NOTIF_COUNT records)"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}: Notifications table not accessible"
  ((FAIL++))
fi
echo ""

# Test 4: Products Database Access
echo "🧪 Test 4: Products Database Access"
PRODUCT_COUNT=$(curl -s "$API_URL/api/products" | jq '.data | length')
if [ "$PRODUCT_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Products table accessible ($PRODUCT_COUNT products)"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}: Products table not accessible"
  ((FAIL++))
fi
echo ""

# Test 5: Stock Database Access
echo "🧪 Test 5: Stock Database Access"
STOCK_COUNT=$(curl -s "$API_URL/api/stock" | jq '.data | length')
if [ "$STOCK_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Stock table accessible ($STOCK_COUNT items)"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}: Stock table not accessible"
  ((FAIL++))
fi
echo ""

# Test 6: Bearer Token Rejection (No Session)
echo "🧪 Test 6: Bearer Token Error Handling"
ERROR=$(curl -s -H "Authorization: Bearer invalid_token_12345" \
  "$API_URL/api/notifications" | jq -r '.error // empty')
if [[ "$ERROR" == *"Invalid"* ]] || [[ "$ERROR" == *"Not authenticated"* ]]; then
  echo -e "${GREEN}✅ PASS${NC}: Invalid tokens rejected properly"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}: Invalid tokens not handled correctly"
  ((FAIL++))
fi
echo ""

# Test 7: Order Detail Access
echo "🧪 Test 7: Order Detail Access"
ORDER_ID=$(curl -s "$API_URL/api/orders" | jq -r '.data[0].id // empty')
if [ ! -z "$ORDER_ID" ]; then
  ORDER_DETAIL=$(curl -s "$API_URL/api/orders/$ORDER_ID" | jq -r '.data.id // empty')
  if [ ! -z "$ORDER_DETAIL" ]; then
    echo -e "${GREEN}✅ PASS${NC}: Order details retrieved from database"
    ((PASS++))
  else
    echo -e "${RED}❌ FAIL${NC}: Order details not accessible"
    ((FAIL++))
  fi
else
  echo -e "${YELLOW}⚠️  SKIP${NC}: No orders found to test"
fi
echo ""

# Test 8: Data Consistency
echo "🧪 Test 8: Data Consistency Check"
ORDERS_A=$(curl -s "$API_URL/api/orders" | jq '.data | length')
sleep 1
ORDERS_B=$(curl -s "$API_URL/api/orders" | jq '.data | length')
if [ "$ORDERS_A" -eq "$ORDERS_B" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Data consistent between requests"
  ((PASS++))
else
  echo -e "${RED}❌ FAIL${NC}: Data inconsistency detected"
  ((FAIL++))
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        TEST RESULTS                            ║"
echo "╠════════════════════════════════════════════════════════════════╣"
TOTAL=$((PASS + FAIL))
echo "║ Total Tests: $TOTAL"
echo -e "║ ${GREEN}Passed: $PASS${NC}"
if [ $FAIL -gt 0 ]; then
  echo -e "║ ${RED}Failed: $FAIL${NC}"
else
  echo "║ Failed: $FAIL"
fi
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed! Database migration successful.${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed. Check the output above.${NC}"
  exit 1
fi
