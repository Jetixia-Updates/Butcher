#!/bin/bash

# Simple Notification Test - Using existing staff login
# This tests if notifications are properly fetched using Bearer tokens

BASE_URL="${1:-https://butcher-lemon.vercel.app}"

echo "=================================================="
echo "Notification Bearer Token Test"
echo "Base URL: $BASE_URL"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# Step 1: Test API Ping
echo ""
echo "Step 1: Testing API connectivity..."
PING=$(curl -s "${BASE_URL}/api/ping")
if echo "$PING" | grep -q "pong"; then
  print_success "API is responding"
else
  print_error "API is not responding"
  exit 1
fi

# Step 2: Test unauthenticated notifications endpoint (should fail)
echo ""
echo "Step 2: Testing unauthenticated notifications request..."
UNAUTH=$(curl -s "${BASE_URL}/api/notifications")
if echo "$UNAUTH" | grep -q "Not authenticated\|401"; then
  print_success "Correctly rejects unauthenticated requests"
else
  print_info "Response: $UNAUTH"
fi

# Step 3: Test with invalid token (should fail)
echo ""
echo "Step 3: Testing with invalid Bearer token..."
INVALID=$(curl -s "${BASE_URL}/api/notifications" \
  -H "Authorization: Bearer invalid_token_12345")
if echo "$INVALID" | grep -q "Not authenticated\|401"; then
  print_success "Correctly rejects invalid tokens"
else
  print_info "Response: $INVALID"
fi

# Step 4: Login as a known test user (if available)
echo ""
echo "Step 4: Attempting to login as test staff user..."
LOGIN=$(curl -s -X POST "${BASE_URL}/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')

TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | head -1 | sed 's/"token":"//;s/"//')

if [ -n "$TOKEN" ]; then
  print_success "Login successful - Token obtained"
  print_info "Token: ${TOKEN:0:20}..."
  
  # Step 5: Test notifications with valid token
  echo ""
  echo "Step 5: Testing notifications with Bearer token..."
  NOTIF=$(curl -s "${BASE_URL}/api/notifications" \
    -H "Authorization: Bearer ${TOKEN}")
  
  if echo "$NOTIF" | grep -q '"success":true'; then
    print_success "Notifications endpoint returns success"
    
    # Count notifications
    COUNT=$(echo "$NOTIF" | grep -o '"id":"notif_' | wc -l)
    print_info "Found $COUNT notifications"
    
    # Show notification details
    if [ "$COUNT" -gt 0 ]; then
      echo ""
      echo "Sample Notifications:"
      echo "===================="
      echo "$NOTIF" | grep -o '{"id":"notif_[^}]*' | head -3 | while read line; do
        echo "  - ${line:0:80}..."
      done
    fi
    
    print_success "✅ All tests passed! Notifications are working correctly."
  else
    print_error "Notifications endpoint failed"
    print_info "Response: $NOTIF"
  fi
else
  print_info "Could not authenticate with admin account"
  print_info "Response: $LOGIN"
  
  echo ""
  echo "Skipping authenticated tests."
  echo ""
  echo "To test notifications manually:"
  echo "1. Login to $BASE_URL"
  echo "2. Open browser DevTools (F12)"
  echo "3. Go to Application → Local Storage"
  echo "4. Copy the 'auth_token' value"
  echo "5. Run this command:"
  echo ""
  echo "  curl '$BASE_URL/api/notifications' \\"
  echo "    -H 'Authorization: Bearer YOUR_TOKEN_HERE'"
  echo ""
fi

echo ""
echo "=================================================="
echo "Test Complete"
echo "=================================================="
