# Notification System Improvements

I have audited the notification system and made the following improvements to fix errors, remove duplicates, and ensure consistency:

## 1. Route Conflicts Fixed
**File:** `server/routes/notifications.ts`
- **Issue:** The route `PATCH /:id/read` was defined *before* `PATCH /read-all`. Since Express matches routes sequentially, a request to `/read-all` was being interpreted as a request to mark an ID named "read-all" as read.
- **Fix:** Reordered the routes so that static routes like `/read-all` come *before* parameterized routes like `/:id/read`.

## 2. Code Duplication Removed
**Files:** `server/services/notifications.ts`, `server/routes/orders.ts`, `server/routes/delivery.ts`
- **Issue:** The notification content (titles, messages for different statuses) was duplicated in both `orders.ts` and `delivery.ts`.
- **Fix:** 
  - Created a centralized helper function `getInAppNotificationContent` in `server/services/notifications.ts`.
  - Refactored `server/routes/orders.ts` and `server/routes/delivery.ts` to use this shared helper.
  - This ensures all notifications use the same text and localization logic.

## 3. Improved Customer Notification Reliability
**File:** `server/routes/delivery.ts`
- **Issue:** The delivery notification helpers (`createOrderNotification` and `createDriverAssignedNotification`) were primarily designed for staff users (`userId`), potentially missing notifications for customers (`customerId`).
- **Fix:** Updated these functions to accept and check for both `userId` and `customerId`. If a customer ID is present (which is the case for most orders), it now correctly links the notification to the customer account.

## 4. Missing Notifications Restored
**File:** `server/routes/delivery.ts`
- **Issue:** The generic `updateDeliveryStatus` endpoint (used for updating tracking by ID) was updating the order status to "delivered" but **not** sending a push notification to the user.
- **Fix:** Added logic to fetch the order and trigger a "delivered" notification when the status is updated to "delivered" via this endpoint.
