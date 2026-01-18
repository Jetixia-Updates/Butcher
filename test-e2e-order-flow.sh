#!/bin/bash

# End-to-End Test Script: Customer Registration → Order → Delivery Flow
# Tests against the production Vercel deployment

BASE_URL="https://butcher-lemon.vercel.app"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_customer_${TIMESTAMP}@test.com"
TEST_USERNAME="testuser_${TIMESTAMP}"
TEST_MOBILE="+971501234${TIMESTAMP: -3}"

echo "=================================================="
echo "E2E Order Flow Test - $(date)"
echo "Base URL: $BASE_URL"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
    echo -e "${RED}  Error: $3${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# ==================================================
# STEP 1: Register a Customer
# ==================================================
echo ""
echo "STEP 1: Registering a new customer..."

REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/users" \
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

echo "Response: $REGISTER_RESPONSE"

# Check if registration was successful
REGISTER_SUCCESS=$(echo "$REGISTER_RESPONSE" | grep -o '"success":\s*true' | head -1)
if [ -n "$REGISTER_SUCCESS" ]; then
  CUSTOMER_ID=$(echo "$REGISTER_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  print_result "PASS" "Customer registered successfully - ID: $CUSTOMER_ID"
else
  ERROR=$(echo "$REGISTER_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
  print_result "FAIL" "Customer registration failed" "$ERROR"
  echo "Cannot continue without customer. Exiting."
  exit 1
fi

# ==================================================
# STEP 2: Get Products for Order
# ==================================================
echo ""
echo "STEP 2: Fetching products to include in order..."

PRODUCTS_RESPONSE=$(curl -s "${BASE_URL}/api/products")

# Check if we got products
PRODUCTS_SUCCESS=$(echo "$PRODUCTS_RESPONSE" | grep -o '"success":\s*true' | head -1)
if [ -n "$PRODUCTS_SUCCESS" ]; then
  # Extract first product ID using a simpler method
  PRODUCT_ID=$(echo "$PRODUCTS_RESPONSE" | grep -o '"id":"prod_[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
  if [ -n "$PRODUCT_ID" ]; then
    print_result "PASS" "Products fetched successfully - Using product: $PRODUCT_ID"
  else
    # Try without prod_ prefix
    PRODUCT_ID=$(echo "$PRODUCTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
    if [ -n "$PRODUCT_ID" ]; then
      print_result "PASS" "Products fetched successfully - Using product: $PRODUCT_ID"
    else
      print_result "FAIL" "Could not find product ID in response" "No product ID found"
      exit 1
    fi
  fi
else
  print_result "FAIL" "Failed to fetch products" "Products API returned error"
  exit 1
fi

# ==================================================
# STEP 3: Create Order
# ==================================================
echo ""
echo "STEP 3: Creating order..."

CREATE_ORDER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/orders" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${CUSTOMER_ID}\",
    \"items\": [
      {
        \"productId\": \"${PRODUCT_ID}\",
        \"quantity\": 2
      }
    ],
    \"paymentMethod\": \"cod\",
    \"deliveryAddress\": {
      \"building\": \"Test Building\",
      \"street\": \"Test Street\",
      \"area\": \"Downtown Dubai\",
      \"emirate\": \"Dubai\",
      \"landmark\": \"Near Test Mall\"
    },
    \"deliveryNotes\": \"E2E test order - please ignore\"
  }")

echo "Response: $CREATE_ORDER_RESPONSE"

ORDER_SUCCESS=$(echo "$CREATE_ORDER_RESPONSE" | grep -o '"success":\s*true' | head -1)
if [ -n "$ORDER_SUCCESS" ]; then
  ORDER_ID=$(echo "$CREATE_ORDER_RESPONSE" | sed -n 's/.*"id":"order_[^"]*".*/&/p' | grep -o 'order_[^"]*' | head -1)
  ORDER_NUMBER=$(echo "$CREATE_ORDER_RESPONSE" | sed -n 's/.*"orderNumber":"\([^"]*\)".*/\1/p' | head -1)
  print_result "PASS" "Order created successfully - ID: $ORDER_ID, Number: $ORDER_NUMBER"
else
  ERROR=$(echo "$CREATE_ORDER_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
  print_result "FAIL" "Order creation failed" "$ERROR"
  exit 1
fi

# ==================================================
# STEP 4: Confirm Order (status: pending → confirmed)
# ==================================================
echo ""
echo "STEP 4: Confirming order..."

CONFIRM_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/orders/${ORDER_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmed"}')

echo "Response: $CONFIRM_RESPONSE"

CONFIRM_SUCCESS=$(echo "$CONFIRM_RESPONSE" | grep -o '"success":\s*true' | head -1)
CONFIRM_STATUS=$(echo "$CONFIRM_RESPONSE" | grep -o '"status":"confirmed"' | head -1)
if [ -n "$CONFIRM_SUCCESS" ] && [ -n "$CONFIRM_STATUS" ]; then
  print_result "PASS" "Order confirmed successfully - Status: confirmed"
else
  ERROR=$(echo "$CONFIRM_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
  print_result "FAIL" "Order confirmation failed" "$ERROR"
fi

# ==================================================
# STEP 5: Process Order (status: confirmed → processing)
# ==================================================
echo ""
echo "STEP 5: Processing order..."

PROCESS_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/orders/${ORDER_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "processing"}')

echo "Response: $PROCESS_RESPONSE"

PROCESS_SUCCESS=$(echo "$PROCESS_RESPONSE" | grep -o '"success":\s*true' | head -1)
PROCESS_STATUS=$(echo "$PROCESS_RESPONSE" | grep -o '"status":"processing"' | head -1)
if [ -n "$PROCESS_SUCCESS" ] && [ -n "$PROCESS_STATUS" ]; then
  print_result "PASS" "Order processing started - Status: processing"
else
  ERROR=$(echo "$PROCESS_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
  print_result "FAIL" "Order processing failed" "$ERROR"
fi

# ==================================================
# STEP 6: Get Available Drivers
# ==================================================
echo ""
echo "STEP 6: Fetching available delivery drivers..."

DRIVERS_RESPONSE=$(curl -s "${BASE_URL}/api/delivery/drivers")

echo "Response: $DRIVERS_RESPONSE"

DRIVERS_SUCCESS=$(echo "$DRIVERS_RESPONSE" | grep -o '"success":\s*true' | head -1)
if [ -n "$DRIVERS_SUCCESS" ]; then
  # Extract driver ID
  DRIVER_ID=$(echo "$DRIVERS_RESPONSE" | grep -o '"id":"driver_[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
  if [ -n "$DRIVER_ID" ]; then
    print_result "PASS" "Drivers fetched successfully - Using driver: $DRIVER_ID"
  else
    # Try to get any driver ID
    DRIVER_ID=$(echo "$DRIVERS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
    if [ -n "$DRIVER_ID" ]; then
      print_result "PASS" "Drivers fetched successfully - Using driver: $DRIVER_ID"
    else
      print_result "FAIL" "No drivers available" "Driver list is empty"
      echo "Skipping driver assignment and delivery confirmation..."
    fi
  fi
else
  ERROR=$(echo "$DRIVERS_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
  print_result "FAIL" "Failed to fetch drivers" "$ERROR"
  echo "Skipping driver assignment and delivery confirmation..."
fi

# ==================================================
# STEP 7: Assign Driver to Order
# ==================================================
if [ -n "$DRIVER_ID" ]; then
  echo ""
  echo "STEP 7: Assigning driver to order..."

  ASSIGN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/delivery/tracking/assign" \
    -H "Content-Type: application/json" \
    -d "{
      \"orderId\": \"${ORDER_ID}\",
      \"driverId\": \"${DRIVER_ID}\"
    }")

  echo "Response: $ASSIGN_RESPONSE"

  ASSIGN_SUCCESS=$(echo "$ASSIGN_RESPONSE" | grep -o '"success":\s*true' | head -1)
  if [ -n "$ASSIGN_SUCCESS" ]; then
    print_result "PASS" "Driver assigned successfully - Driver: $DRIVER_ID"
  else
    ERROR=$(echo "$ASSIGN_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
    print_result "FAIL" "Driver assignment failed" "$ERROR"
  fi

  # ==================================================
  # STEP 8: Update Delivery Status to In Transit
  # ==================================================
  echo ""
  echo "STEP 8: Updating delivery status to in_transit..."

  IN_TRANSIT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/delivery/tracking/${ORDER_ID}/update" \
    -H "Content-Type: application/json" \
    -d '{"status": "in_transit", "notes": "E2E Test - Driver picked up order"}')

  echo "Response: $IN_TRANSIT_RESPONSE"

  IN_TRANSIT_SUCCESS=$(echo "$IN_TRANSIT_RESPONSE" | grep -o '"success":\s*true' | head -1)
  if [ -n "$IN_TRANSIT_SUCCESS" ]; then
    print_result "PASS" "Delivery status updated to in_transit"
  else
    ERROR=$(echo "$IN_TRANSIT_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
    print_result "FAIL" "Delivery status update failed" "$ERROR"
  fi

  # ==================================================
  # STEP 9: Confirm Delivery (status: delivered)
  # ==================================================
  echo ""
  echo "STEP 9: Confirming delivery..."

  DELIVER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/delivery/tracking/${ORDER_ID}/update" \
    -H "Content-Type: application/json" \
    -d '{"status": "delivered", "notes": "E2E Test - Order delivered successfully"}')

  echo "Response: $DELIVER_RESPONSE"

  DELIVER_SUCCESS=$(echo "$DELIVER_RESPONSE" | grep -o '"success":\s*true' | head -1)
  DELIVER_STATUS=$(echo "$DELIVER_RESPONSE" | grep -o '"status":"delivered"' | head -1)
  if [ -n "$DELIVER_SUCCESS" ] && [ -n "$DELIVER_STATUS" ]; then
    print_result "PASS" "Delivery confirmed - Status: delivered"
  else
    ERROR=$(echo "$DELIVER_RESPONSE" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p' | head -1)
    print_result "FAIL" "Delivery confirmation failed" "$ERROR"
  fi
fi

# ==================================================
# STEP 10: Verify Final Order Status
# ==================================================
echo ""
echo "STEP 10: Verifying final order status..."

FINAL_ORDER_RESPONSE=$(curl -s "${BASE_URL}/api/orders/${ORDER_ID}")

echo "Response: $FINAL_ORDER_RESPONSE"

FINAL_STATUS=$(echo "$FINAL_ORDER_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')
if [ "$FINAL_STATUS" = "delivered" ]; then
  print_result "PASS" "Final order status is 'delivered' - Order lifecycle complete!"
else
  print_result "FAIL" "Order final status is '$FINAL_STATUS' (expected: delivered)" ""
fi

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
  echo "  - Order ID: $ORDER_ID"
  echo "  - Order Number: $ORDER_NUMBER"
  exit 0
else
  echo -e "${RED}✗ SOME TESTS FAILED${NC}"
  exit 1
fi
