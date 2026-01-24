# Manual Notification Flow Test

This document describes how to manually test the notification fix for the Butcher app.

## What Was Fixed

✅ **Notifications now use Bearer token authentication** instead of query parameters
✅ **Supports both customers and staff** users automatically
✅ **Works on web, iOS, and Android** (Capacitor)

## How to Test

### Option 1: Manual Test on Production (butcher-lemon.vercel.app)

1. **Login as customer** (use existing or create account via UI)
2. **Place an order** via the customer app
3. **Check notifications**:
   - Should see "Order Placed Successfully" notification ✅
   - Notification bell icon should show unread count
   - Click notification to navigate to orders

### Option 2: Test Notification Endpoints Directly

#### 1. Get customer token by logging in:
```bash
curl -X POST "https://butcher-lemon.vercel.app/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser", "password":"password"}'
```

#### 2. Use the token to fetch notifications:
```bash
curl "https://butcher-lemon.vercel.app/api/notifications" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
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
      "titleAr": "تم تقديم الطلب بنجاح",
      "message": "Your order #123 has been placed...",
      "messageAr": "تم تقديم طلبك #123...",
      "unread": true,
      "createdAt": "2026-01-25T..."
    }
  ]
}
```

## Expected Notification Events

| Event | Notification Type | Title |
|-------|-------------------|-------|
| Order Created | "order" | "Order Placed Successfully" |
| Order Confirmed | "order" | "Order Confirmed" |
| Order Processing | "order" | "Your order is being prepared" |
| Out for Delivery | "order" | "Your order is on the way" |
| Order Delivered | "delivery" | "Order Delivered" |
| Invoice Sent | "payment" | "Invoice - Order #..." |

## Server Changes Summary

### 1. **notifications.ts route** (Fixed database field handling)
- Changed `null` → `undefined` for nullable fields
- Removed explicit `createdAt: new Date()` to use database defaults
- Now consistent across all notification creation points

### 2. **orders.ts route** (Fixed all order notification creation)
- Fixed `createInvoiceNotificationForConfirmedOrder()`
- Fixed `createCustomerOrderNotification()`
- Fixed initial "Order Placed" notification
- Fixed staff notifications in `updateOrderStatus()`

### 3. **api.ts client** (Fixed to use Bearer tokens)
- `notificationsApi.getAll()` no longer passes `userId` query parameter
- Server now automatically detects if it's a customer or staff via Bearer token
- Works for both `/api/customers` and `/api/users` authentication flows

## How It Works Now

### Client Side (Web/Mobile)
1. User logs in → token stored in `localStorage`
2. NotificationContext initializes with `useAuth()` hook
3. `fetchNotifications()` called every 5 seconds
4. `notificationsApi.getAll()` adds Bearer token to request header
5. Receives notifications for logged-in user (customer or staff)

### Server Side
1. `GET /api/notifications` endpoint receives Bearer token
2. `getNotificationTarget()` helper determines user type:
   - Checks `customerSessions` table → returns `customerId`
   - If not customer, checks `sessions` table → returns `userId`
3. Queries `inAppNotifications` table with appropriate ID
4. Returns only notifications for that user

### Database
- `inAppNotifications` table has both `userId` and `customerId` fields
- Nullable fields use `defaultNow()` for timestamps
- Notifications created with `undefined` for optional fields (not `null`)

## Verification Checklist

- [ ] Customer can login on web
- [ ] Customer sees notifications after placing order
- [ ] Notifications appear in real-time (5-second polling)
- [ ] Notification bell shows unread count
- [ ] Clicking notification navigates correctly
- [ ] Test on mobile (iOS/Android) via Capacitor
- [ ] Admin can still receive admin notifications
- [ ] Staff can still receive their own notifications
- [ ] Notifications include correct links and data

## Troubleshooting

### No notifications appearing?
1. Check browser console for errors
2. Verify Bearer token is being sent: `curl -H "Authorization: Bearer TOKEN" /api/notifications`
3. Check server logs for database errors
4. Verify customer/order was created successfully
5. Wait 5 seconds for polling to fetch

### Wrong user seeing notifications?
1. Verify correct Bearer token is sent
2. Check `getNotificationTarget()` is determining user type correctly
3. Confirm customerId/userId matches in database

### Notifications not being created?
1. Check `createCustomerOrderNotification()` is called
2. Verify database fields aren't causing constraint violations
3. Confirm `undefined` (not `null`) is being used for optional fields

## Files Modified

- `server/routes/notifications.ts` - Fixed database field handling
- `server/routes/orders.ts` - Fixed all 4 notification creation locations
- `client/lib/api.ts` - Fixed to rely on Bearer tokens
- `client/context/NotificationContext.tsx` - Already correctly implemented

