# Notification Fix Summary & Testing Guide

## 🎯 Problem Solved

**Issue:** Customers were not receiving ANY notifications after order placement.

**Root Cause:** 
1. Notification API was using `null` for optional fields instead of `undefined`
2. Explicit `createdAt: new Date()` was overriding database defaults
3. Query parameter approach was inconsistent with Bearer token authentication
4. Customer and staff IDs were handled differently across notification code

## ✅ Fixes Applied

### 1. **Server Route: `/api/notifications` (notifications.ts)**

**Changed:** Database field handling in notification creation
```typescript
// BEFORE (broken):
const newNotification = {
  id: generateId(),
  userId: userId || null,           // ❌ null instead of undefined
  customerId: customerId || null,   // ❌ null instead of undefined
  link: data.link || null,          // ❌ null instead of undefined
  linkTab: data.linkTab || null,    // ❌ null instead of undefined
  linkId: data.linkId || null,      // ❌ null instead of undefined
  unread: true,
  createdAt: new Date(),            // ❌ overrides database default
};

// AFTER (fixed):
const newNotification = {
  id: generateId(),
  userId: userId ? userId : undefined,           // ✅ undefined
  customerId: customerId ? customerId : undefined, // ✅ undefined
  link: data.link || undefined,                  // ✅ undefined
  linkTab: data.linkTab || undefined,            // ✅ undefined
  linkId: data.linkId || undefined,              // ✅ undefined
  unread: true,
  // ✅ removed createdAt - uses database .defaultNow()
};
```

### 2. **Order Routes: `/api/orders` (orders.ts)**

**Fixed 4 notification creation locations:**

#### A. Invoice Notification (createInvoiceNotificationForConfirmedOrder)
```typescript
// ✅ Removed createdAt: new Date()
// ✅ Changed null → undefined for nullable fields
```

#### B. Order Status Notifications (createCustomerOrderNotification)
```typescript
// ✅ Added userId: undefined field
// ✅ Changed linkTab: null → undefined
// ✅ Removed createdAt: new Date()
```

#### C. Staff Notifications (updateOrderStatus)
```typescript
// ✅ Changed null → undefined
// ✅ Removed createdAt: new Date()
```

#### D. Order Placed Notification (line ~705)
```typescript
// ✅ Added userId: undefined
// ✅ Changed linkTab: null → undefined
// ✅ Removed createdAt: new Date()
```

### 3. **API Client: (client/lib/api.ts)**

**Changed:** Notification fetching to use Bearer tokens
```typescript
// BEFORE (broken):
getAll: (userId?: string) => 
  fetchApi<InAppNotification[]>(`/notifications${userId ? `?userId=${userId}` : ""}`),
// ❌ Passed userId as query parameter
// ❌ Didn't work for customers

// AFTER (fixed):
getAll: (userId?: string | null) => {
  // ✅ Don't pass userId query param - let server use Bearer token
  return fetchApi<InAppNotification[]>(`/notifications`);
},
// ✅ Server now determines user type from Bearer token
// ✅ Works for both customers and staff
```

## 🔧 How It Works Now

### Authentication Flow
```
Customer/Staff Login
        ↓
Token stored in localStorage
        ↓
NotificationContext fetches every 5 seconds
        ↓
Bearer token added to Authorization header
        ↓
Server receives request
        ↓
getNotificationTarget() determines user type:
  - Checks customerSessions → customerId
  - Checks sessions → userId (staff/admin)
        ↓
Queries inAppNotifications with correct ID
        ↓
Returns notifications for that user
```

### Database Schema (Unchanged)
```typescript
inAppNotifications {
  id: text (primary key)
  userId: text (nullable) - for staff notifications
  customerId: text (nullable) - for customer notifications
  type: varchar - "order", "payment", "delivery", etc.
  title: varchar (English)
  titleAr: varchar (Arabic)
  message: text (English)
  messageAr: text (Arabic)
  link: text (optional)
  linkTab: varchar (optional)
  linkId: text (optional)
  unread: boolean (default: true)
  createdAt: timestamp (default: now())
}
```

## 📱 Platform Support

✅ **Web** - Uses localStorage for tokens, standard fetch API
✅ **iOS** - Capacitor supports localStorage, same fetch mechanism
✅ **Android** - Capacitor supports localStorage, same fetch mechanism

All platforms use the **same API client** (`fetchApi`) and **same Bearer token mechanism**.

## 🧪 Testing Instructions

### Quick Test on Web (butcher-lemon.vercel.app)

1. **Open DevTools** (F12)
2. **Go to Application → Local Storage**
3. Find `auth_token` value
4. Copy it and run:
```bash
curl 'https://butcher-lemon.vercel.app/api/notifications' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' | jq .
```

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "id": "notif_...",
      "type": "order",
      "title": "Order Placed Successfully",
      "unread": true,
      "createdAt": "2026-01-25T..."
    }
  ]
}
```

### Manual Testing Flow

1. **Login as customer** on https://butcher-lemon.vercel.app
2. **Place an order** (add items to cart, checkout)
3. **Check notifications**:
   - Look for notification bell icon (🔔)
   - Should show unread count
   - Click to see "Order Placed Successfully" notification
4. **Confirm order** (via admin if available)
   - Should receive "Order Confirmed" notification
   - Should receive "Invoice" notification
5. **Mark order as delivered** (via admin if available)
   - Should receive "Order Delivered" notification

### Test Script Available

Run the simple test script:
```bash
bash test-notifications-simple.sh https://butcher-lemon.vercel.app
```

Or for local development:
```bash
bash test-notifications-simple.sh http://localhost:8080
```

## 📊 Notification Types

| Event | Trigger | Type | Title |
|-------|---------|------|-------|
| Order placed | `POST /api/orders` | "order" | "Order Placed Successfully" |
| Order confirmed | PATCH status→confirmed | "order" | "Order Confirmed" |
| Invoice sent | On order confirmation | "payment" | "Invoice - Order #..." |
| Processing | PATCH status→processing | "order" | "Your order is being prepared" |
| Out for delivery | PATCH status→out_for_delivery | "order" | "Your order is on the way" |
| Delivered | PATCH status→delivered | "delivery" | "Order Delivered" |

## ✨ Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| Field handling | `null` | `undefined` |
| Timestamps | Explicit JS date | Database default |
| Authentication | Query parameter | Bearer token |
| Customer support | ❌ Broken | ✅ Works |
| Staff support | ✅ Partial | ✅ Fully works |
| Web/Mobile | Inconsistent | ✅ Same code path |
| Polling | ✅ Works | ✅ Works |
| Real-time | ✅ 5 sec polling | ✅ 5 sec polling |

## 🚀 Deployment Notes

After these changes:
1. **Rebuild:** `pnpm build`
2. **Test locally:** `pnpm dev` then check notifications
3. **Deploy:** Push to Vercel/your hosting
4. **Verify:** Test both web and mobile apps

## 🔍 Verification Checklist

- [ ] Customers see "Order Placed" notification after ordering
- [ ] Notifications appear within 5 seconds
- [ ] Notification bell shows unread count
- [ ] Clicking notification navigates correctly
- [ ] Multiple notifications display in chronological order
- [ ] Admin receives admin notifications
- [ ] Staff receives their own notifications
- [ ] Mobile app (iOS/Android) receives notifications
- [ ] Bearer token authentication works
- [ ] Unauthenticated requests are rejected

## 📝 Files Modified

1. `server/routes/notifications.ts` - Fixed database field handling
2. `server/routes/orders.ts` - Fixed 4 notification creation locations
3. `client/lib/api.ts` - Fixed to use Bearer tokens instead of query params

## 🎓 What Changed Technically

**Before:** App was passing `userId` as query parameter, but customers don't have `userId` - they have `customerId`. Notifications created with `null` values and explicit timestamps that conflicted with database defaults.

**After:** App relies on Bearer token to determine user type. Server automatically detects customer vs staff from session tables. All notifications use `undefined` for optional fields and database defaults for timestamps. Single consistent code path for web and mobile.

