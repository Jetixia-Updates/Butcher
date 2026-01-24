#!/bin/bash

# Notification Test Script: Create Order and Verify All Notifications
# Tests the complete notification flow for customer orders

BASE_URL="${1:-http://localhost:8080}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_customer_${TIMESTAMP}@test.com"
TEST_USERNAME="testuser_${TIMESTAMP}"
TEST_MOBILE="+971501234${TIMESTAMP: -3}"

echo "=================================================="
echo "Notification Flow Test - $(date)"
echo "Base URL: $BASE_URL"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

print_result() {
  if [ "$1" = "PASS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    if [ -n "$3" ]; then
      echo -e "${RED}  Error: $3${NC}"
    fi
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

print_info() {
  echo -e "${BLUE}ℹ INFO${NC}: $1"
}

# ==================================================
# STEP 1: Register a Customer
# ==================================================
echo ""
echo "STEP 1: Registering a new customer..."

REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/customers/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${TEST_USERNAME}\",
    \"email\": \"${TEST_EMAIL}\",
    \"mobile\": \"${TEST_MOBILE}\",
    \"password\": \"TestPassword123!\",
    \"firstName\": \"Test\",
    \"familyName\": \"Customer\",
    \"emirate\": \"Dubai\"
  }")

print_info "Response: $REGISTER_RESPONSE"

# Extract customer ID and token
CUSTOMER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"customerId":"[^"]*"' | head -1 | sed 's/"customerId":"//;s/"//')
AUTH_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')

if [ -n "$CUSTOMER_ID" ] && [ -n "$AUTH_TOKEN" ]; then
  print_result "PASS" "Customer registered - ID: $CUSTOMER_ID"
else
  ERROR=$(echo "$REGISTER_RESPONSE" | grep -o '"error":"[^"]*"' | head -1 | sed 's/"error":"//;s/"//')
  print_result "FAIL" "Customer registration failed" "$ERROR"
  exit 1
fi

# ==================================================
# STEP 2: Check Initial Notifications (should be empty before order)
# ==================================================
echo ""
echo "STEP 2: Checking notifications before order creation..."

NOTIF_BEFORE=$(curl -s "${BASE_URL}/api/notifications" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

print_info "Response: $NOTIF_BEFORE"

NOTIF_COUNT_BEFORE=$(echo "$NOTIF_BEFORE" | grep -o '"id":"notif_[^"]*"' | wc -l)
print_info "Notifications before order: $NOTIF_COUNT_BEFORE"

# ==================================================
# STEP 3: Get Products for Order
# ==================================================
echo ""
echo "STEP 3: Fetching products..."

PRODUCTS_RESPONSE=$(curl -s "${BASE_URL}/api/products")

PRODUCT_ID=$(echo "$PRODUCTS_RESPONSE" | grep -o '"id":"prod_[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
if [ -z "$PRODUCT_ID" ]; then
  PRODUCT_ID=$(echo "$PRODUCTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
fi

if [ -n "$PRODUCT_ID" ]; then
  print_result "PASS" "Product found - ID: $PRODUCT_ID"
else
  print_result "FAIL" "Could not find product"
  exit 1
fi

# ==================================================
# STEP 4: Create Order (should trigger "Order Placed" notification)
# ==================================================
echo ""
echo "STEP 4: Creating order (should trigger 'Order Placed' notification)..."

CREATE_ORDER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "{
    \"items\": [
      {
        \"productId\": \"${PRODUCT_ID}\",
        \"quantity\": 1,
        \"unitPrice\": \"100\"
      }
    ],
    \"addressId\": \"addr_default\",
    \"paymentMethod\": \"cod\",
    \"deliveryFee\": \"0\",
    \"subtotal\": \"100\",
    \"vatAmount\": \"5\",
    \"total\": \"105\"
  }")

print_info "Response: $CREATE_ORDER_RESPONSE"

ORDER_ID=$(echo "$CREATE_ORDER_RESPONSE" | grep -o '"id":"order_[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
ORDER_NUMBER=$(echo "$CREATE_ORDER_RESPONSE" | grep -o '"orderNumber":"[^"]*"' | head -1 | sed 's/"orderNumber":"//;s/"//')

if [ -n "$ORDER_ID" ]; then
  print_result "PASS" "Order created - ID: $ORDER_ID, Number: $ORDER_NUMBER"
else
  ERROR=$(echo "$CREATE_ORDER_RESPONSE" | grep -o '"error":"[^"]*"' | head -1 | sed 's/"error":"//;s/"//')
  print_result "FAIL" "Order creation failed" "$ERROR"
  exit 1
fi

# Wait a bit for notifications to be created
sleep 1

# ==================================================
# STEP 5: Check Notifications After Order Created
# ==================================================
echo ""
echo "STEP 5: Checking notifications after order creation..."

NOTIF_AFTER_CREATE=$(curl -s "${BASE_URL}/api/notifications" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

print_info "Response: $NOTIF_AFTER_CREATE"

NOTIF_COUNT_AFTER_CREATE=$(echo "$NOTIF_AFTER_CREATE" | grep -o '"id":"notif_[^"]*"' | wc -l)
HAS_ORDER_PLACED=$(echo "$NOTIF_AFTER_CREATE" | grep -o '"type":"order"' | head -1)

if [ "$NOTIF_COUNT_AFTER_CREATE" -gt "$NOTIF_COUNT_BEFORE" ]; then
  print_result "PASS" "New notification received after order creation - Total: $NOTIF_COUNT_AFTER_CREATE"
  if [ -n "$HAS_ORDER_PLACED" ]; then
    print_info "✓ 'Order Placed' notification found"
  fi
else
  print_result "FAIL" "No new notification after order creation" "Expected at least 1, got $NOTIF_COUNT_AFTER_CREATE"
fi

# ==================================================
# STEP 6: Confirm Order (should trigger "Order Confirmed" + Invoice notification)
# ==================================================
echo ""
echo "STEP 6: Confirming order (should trigger 'Order Confirmed' + Invoice notifications)..."

CONFIRM_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/orders/${ORDER_ID}/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"status":"confirmed"}')

print_info "Response: $CONFIRM_RESPONSE"

CONFIRM_SUCCESS=$(echo "$CONFIRM_RESPONSE" | grep -o '"status":"confirmed"' | head -1)
if [ -n "$CONFIRM_SUCCESS" ]; then
  print_result "PASS" "Order confirmed"
else
  ERROR=$(echo "$CONFIRM_RESPONSE" | grep -o '"error":"[^"]*"' | head -1 | sed 's/"error":"//;s/"//')
  print_result "FAIL" "Order confirmation failed" "$ERROR"
fi

sleep 1

# ==================================================
# STEP 7: Check Notifications After Confirmation
# ==================================================
echo ""
echo "STEP 7: Checking notifications after order confirmation..."

NOTIF_AFTER_CONFIRM=$(curl -s "${BASE_URL}/api/notifications" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

print_info "Response: $NOTIF_AFTER_CONFIRM"

NOTIF_COUNT_AFTER_CONFIRM=$(echo "$NOTIF_AFTER_CONFIRM" | grep -o '"id":"notif_[^"]*"' | wc -l)

if [ "$NOTIF_COUNT_AFTER_CONFIRM" -gt "$NOTIF_COUNT_AFTER_CREATE" ]; then
  print_result "PASS" "New notification(s) after order confirmation - Total: $NOTIF_COUNT_AFTER_CONFIRM"
  print_info "Notifications received: $(($NOTIF_COUNT_AFTER_CONFIRM - $NOTIF_COUNT_AFTER_CREATE)) new"
else
  print_result "FAIL" "No new notification after order confirmation" "Expected at least 1, got $NOTIF_COUNT_AFTER_CONFIRM (was $NOTIF_COUNT_AFTER_CREATE)"
fi

# ==================================================
# STEP 8: Update Order to Processing
# ==================================================
echo ""
echo "STEP 8: Processing order..."

PROCESS_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/orders/${ORDER_ID}/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"status":"processing"}')

print_info "Response: $PROCESS_RESPONSE"

if [ -n "$(echo "$PROCESS_RESPONSE" | grep -o '"status":"processing"')" ]; then
  print_result "PASS" "Order set to processing"
else
  print_result "FAIL" "Order processing failed"
fi

# ==================================================
# STEP 9: Update Order to Out for Delivery
# ==================================================
echo ""
echo "STEP 9: Setting order to out_for_delivery..."

OUT_FOR_DELIVERY_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/orders/${ORDER_ID}/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"status":"out_for_delivery"}')

print_info "Response: $OUT_FOR_DELIVERY_RESPONSE"

if [ -n "$(echo "$OUT_FOR_DELIVERY_RESPONSE" | grep -o '"status":"out_for_delivery"')" ]; then
  print_result "PASS" "Order set to out_for_delivery"
else
  print_result "FAIL" "Setting order to out_for_delivery failed"
fi

# ==================================================
# STEP 10: Complete Delivery (should trigger "Order Delivered" notification)
# ==================================================
echo ""
echo "STEP 10: Completing delivery (should trigger 'Order Delivered' notification)..."

DELIVER_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/orders/${ORDER_ID}/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"status":"delivered","notes":"Test delivery completed with driver notes"}')

print_info "Response: $DELIVER_RESPONSE"

if [ -n "$(echo "$DELIVER_RESPONSE" | grep -o '"status":"delivered"')" ]; then
  print_result "PASS" "Order marked as delivered"
else
  print_result "FAIL" "Delivery completion failed"
fi

sleep 1

# ==================================================
# STEP 11: Check Final Notifications
# ==================================================
echo ""
echo "STEP 11: Checking final notifications..."

NOTIF_FINAL=$(curl -s "${BASE_URL}/api/notifications" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

print_info "Response: $NOTIF_FINAL"

NOTIF_COUNT_FINAL=$(echo "$NOTIF_FINAL" | grep -o '"id":"notif_[^"]*"' | wc -l)

echo ""
echo "Notification Summary:"
echo "  - Before order: $NOTIF_COUNT_BEFORE"
echo "  - After order created: $NOTIF_COUNT_AFTER_CREATE"
echo "  - After order confirmed: $NOTIF_COUNT_AFTER_CONFIRM"
echo "  - Final: $NOTIF_COUNT_FINAL"

if [ "$NOTIF_COUNT_FINAL" -ge 3 ]; then
  print_result "PASS" "Multiple notifications received throughout order lifecycle - Total: $NOTIF_COUNT_FINAL"
else
  print_result "FAIL" "Expected at least 3 notifications, got $NOTIF_COUNT_FINAL"
fi

# ==================================================
# STEP 12: Check Notification Details
# ==================================================
echo ""
echo "STEP 12: Displaying all notifications..."

echo ""
echo "All Notifications:"
echo "==================="
echo "$NOTIF_FINAL" | grep -o '{"id":"[^}]*' | head -10 | while read line; do
  echo "  $line"
done

# ==================================================
# TEST SUMMARY
# ==================================================
echo ""
echo "=================================================="
echo "TEST SUMMARY"
echo "=================================================="
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
  echo ""
  echo "Test Data Created:"
  echo "  - Customer ID: $CUSTOMER_ID"
  echo "  - Auth Token: $AUTH_TOKEN"
  echo "  - Order ID: $ORDER_ID"
  echo "  - Order Number: $ORDER_NUMBER"
  echo "  - Total Notifications: $NOTIF_COUNT_FINAL"
  exit 0
else
  echo -e "${RED}✗ SOME TESTS FAILED${NC}"
  exit 1
fi
