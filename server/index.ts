import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";

// Import route modules
import ordersRouter from "./routes/orders";
import stockRouter from "./routes/stock";
import deliveryRouter from "./routes/delivery";
import paymentsRouter from "./routes/payments";
import usersRouter from "./routes/users";
import customersRouter from "./routes/customers";
import reportsRouter from "./routes/reports";
import analyticsRouter from "./routes/analytics";
import productsRouter from "./routes/products";
import suppliersRouter from "./routes/suppliers";
import financeRouter from "./routes/finance";
import notificationsRouter from "./routes/notifications";
import walletRouter from "./routes/wallet";
import wishlistRouter from "./routes/wishlist";
import reviewsRouter from "./routes/reviews";
import loyaltyRouter from "./routes/loyalty";
import settingsRouter from "./routes/settings";
import addressesRouter from "./routes/addresses";
import chatRouter from "./routes/chat";

export function createServer() {
  const app = express();

  // All data is stored in PostgreSQL via Neon serverless
  // To seed the database, run: pnpm db:seed

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check / ping endpoint
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Demo endpoint
  app.get("/api/demo", handleDemo);

  // ============================================
  // API Routes
  // ============================================

  // Order Management
  // GET /api/orders - List all orders
  // GET /api/orders/stats - Get order statistics
  // GET /api/orders/:id - Get order by ID
  // GET /api/orders/number/:orderNumber - Get order by order number
  // POST /api/orders - Create new order
  // PATCH /api/orders/:id/status - Update order status
  // DELETE /api/orders/:id - Cancel/delete order
  app.use("/api/orders", ordersRouter);

  // Stock/Inventory Management
  // GET /api/stock - List all stock items
  // GET /api/stock/alerts - Get low stock alerts
  // GET /api/stock/movements - Get stock movement history
  // GET /api/stock/:productId - Get stock for specific product
  // POST /api/stock/update - Update stock quantity
  // POST /api/stock/bulk-update - Bulk update stock
  // POST /api/stock/restock/:productId - Restock a product
  // PATCH /api/stock/:productId/thresholds - Update stock thresholds
  app.use("/api/stock", stockRouter);

  // Delivery & Address Management
  // GET /api/delivery/addresses - List user addresses
  // GET /api/delivery/addresses/:id - Get specific address
  // POST /api/delivery/addresses - Create address
  // PUT /api/delivery/addresses/:id - Update address
  // DELETE /api/delivery/addresses/:id - Delete address
  // GET /api/delivery/zones - List delivery zones
  // POST /api/delivery/zones - Create delivery zone
  // PUT /api/delivery/zones/:id - Update delivery zone
  // DELETE /api/delivery/zones/:id - Delete delivery zone
  // POST /api/delivery/check-availability - Check delivery availability
  // GET /api/delivery/tracking/:orderId - Get delivery tracking
  // POST /api/delivery/tracking/:orderId/update - Update tracking
  // POST /api/delivery/tracking/assign - Assign driver
  // POST /api/delivery/tracking/:orderId/proof - Upload proof of delivery
  app.use("/api/delivery", deliveryRouter);

  // Payment Processing
  // GET /api/payments - List all payments
  // GET /api/payments/stats - Get payment statistics
  // GET /api/payments/:id - Get payment by ID
  // GET /api/payments/order/:orderId - Get payment for order
  // POST /api/payments/process - Process a payment
  // POST /api/payments/:id/refund - Process refund
  // POST /api/payments/:id/capture - Capture authorized payment
  app.use("/api/payments", paymentsRouter);

  // User Management & Authentication (Staff only: admin, staff, delivery)
  // GET /api/users - List all users (admin only)
  // GET /api/users/stats - Get user statistics
  // GET /api/users/me - Get current user
  // GET /api/users/:id - Get user by ID
  // POST /api/users - Create new user (staff only)
  // POST /api/users/login - Staff login
  // POST /api/users/admin-login - Admin login
  // POST /api/users/logout - User logout
  // PUT /api/users/:id - Update user
  // DELETE /api/users/:id - Delete user
  // POST /api/users/:id/change-password - Change password
  // POST /api/users/:id/verify - Verify user email/phone
  app.use("/api/users", usersRouter);

  // Customer Management & Authentication (Customers only)
  // POST /api/customers/register - Customer registration
  // POST /api/customers/login - Customer login
  // POST /api/customers/logout - Customer logout
  // GET /api/customers/me - Get current customer
  // GET /api/customers - List all customers (admin only)
  // GET /api/customers/:id - Get customer by ID
  // PUT /api/customers/:id - Update customer
  // DELETE /api/customers/:id - Deactivate customer
  // POST /api/customers/:id/change-password - Change password
  app.use("/api/customers", customersRouter);

  // Sales Reports
  // GET /api/reports/sales - Get sales report
  // GET /api/reports/sales-by-category - Get sales by category
  // GET /api/reports/sales-by-product - Get sales by product
  // GET /api/reports/sales-timeseries - Get sales time series
  // GET /api/reports/customers - Get customer analytics
  // GET /api/reports/inventory - Get inventory report
  // GET /api/reports/orders - Get orders report
  // POST /api/reports/export - Export report (CSV, Excel, PDF)
  app.use("/api/reports", reportsRouter);

  // Admin Analytics Dashboard
  // GET /api/analytics/dashboard - Get dashboard stats
  // GET /api/analytics/charts/revenue - Revenue chart data
  // GET /api/analytics/charts/orders-by-status - Orders by status chart
  // GET /api/analytics/charts/top-products - Top selling products chart
  // GET /api/analytics/charts/sales-by-emirate - Sales by emirate chart
  // GET /api/analytics/charts/payment-methods - Payment methods breakdown
  // GET /api/analytics/charts/hourly-orders - Orders by hour of day
  // GET /api/analytics/real-time - Real-time stats for live dashboard
  app.use("/api/analytics", analyticsRouter);

  // Products Management
  // GET /api/products - List all products
  // GET /api/products/:id - Get product by ID
  // POST /api/products - Create new product
  // PUT /api/products/:id - Update product
  // DELETE /api/products/:id - Delete product
  app.use("/api/products", productsRouter);

  // Supplier Management
  // GET /api/suppliers - Suppliers, contacts, products, purchase orders
  app.use("/api/suppliers", suppliersRouter);

  // Finance Management
  // GET /api/finance/summary - Financial summary & dashboard
  // GET /api/finance/transactions - List financial transactions
  // GET /api/finance/accounts - List financial accounts
  // POST /api/finance/accounts - Create account
  // POST /api/finance/accounts/transfer - Transfer between accounts
  // POST /api/finance/accounts/:id/reconcile - Reconcile account
  // GET /api/finance/expenses - List expenses
  // POST /api/finance/expenses - Create expense
  // POST /api/finance/expenses/:id/pay - Mark expense as paid
  // GET /api/finance/reports/profit-loss - Profit & Loss report
  // GET /api/finance/reports/cash-flow - Cash flow report
  // GET /api/finance/reports/vat - VAT report
  app.use("/api/finance", financeRouter);

  // In-App Notifications
  // GET /api/notifications - Get notifications for current user
  // POST /api/notifications - Create notification for a user
  // PATCH /api/notifications/:id/read - Mark notification as read
  // PATCH /api/notifications/read-all - Mark all notifications as read
  // DELETE /api/notifications/:id - Delete notification
  // PATCH /api/notifications/read-all - Mark all notifications as read
  // DELETE /api/notifications/:id - Delete notification
  // DELETE /api/notifications - Clear all notifications
  app.use("/api/notifications", notificationsRouter);

  // Chat Support
  // GET /api/chat/all - Get all chats (admin)
  // GET /api/chat/:userId - Get user messages
  // POST /api/chat/send - Send message
  app.use("/api/chat", chatRouter);

  // Wallet Management
  // GET /api/wallet - Get wallet balance and transactions
  // POST /api/wallet/topup - Top up wallet
  // POST /api/wallet/deduct - Deduct from wallet (for payments)
  // POST /api/wallet/credit - Add credit (refunds, cashback)
  app.use("/api/wallet", walletRouter);

  // Wishlist Management
  // GET /api/wishlist - Get user's wishlist
  // POST /api/wishlist - Add item to wishlist
  // DELETE /api/wishlist/:productId - Remove item from wishlist
  // DELETE /api/wishlist - Clear wishlist
  app.use("/api/wishlist", wishlistRouter);

  // Product Reviews
  // GET /api/reviews - Get all reviews (with optional productId filter)
  // GET /api/reviews/product/:productId - Get reviews with stats for a product
  // POST /api/reviews - Create a review
  // PUT /api/reviews/:id - Update a review
  // DELETE /api/reviews/:id - Delete a review
  // POST /api/reviews/:id/helpful - Mark review as helpful
  app.use("/api/reviews", reviewsRouter);

  // Loyalty Points Program
  // GET /api/loyalty - Get user's loyalty points and tier
  // POST /api/loyalty/earn - Earn points from order
  // POST /api/loyalty/redeem - Redeem points
  // POST /api/loyalty/referral - Apply referral code
  // GET /api/loyalty/tiers - Get all loyalty tiers
  app.use("/api/loyalty", loyaltyRouter);

  // App Settings & Configuration
  // GET /api/settings - Get all settings, banners, time slots, promo codes
  // PUT /api/settings - Update settings
  // POST/PUT/DELETE /api/settings/banners/:id - Manage banners
  // POST/PUT/DELETE /api/settings/time-slots/:id - Manage time slots
  // POST/PUT/DELETE /api/settings/promo-codes/:id - Manage promo codes
  // POST /api/settings/promo-codes/validate - Validate promo code
  app.use("/api/settings", settingsRouter);

  // User Addresses
  // GET /api/addresses - Get user's addresses
  // POST /api/addresses - Create address
  // PUT /api/addresses/:id - Update address
  // DELETE /api/addresses/:id - Delete address
  // PUT /api/addresses/:id/default - Set as default
  app.use("/api/addresses", addressesRouter);

  return app;
}
