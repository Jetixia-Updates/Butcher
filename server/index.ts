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
import reportsRouter from "./routes/reports";
import analyticsRouter from "./routes/analytics";
import productsRouter from "./routes/products";
import suppliersRouter from "./routes/suppliers";
import financeRouter from "./routes/finance";

export function createServer() {
  const app = express();

  // Database is seeded on module load in db/index.ts

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

  // User Management & Authentication
  // GET /api/users - List all users (admin only)
  // GET /api/users/stats - Get user statistics
  // GET /api/users/me - Get current user
  // GET /api/users/:id - Get user by ID
  // POST /api/users - Create new user (register)
  // POST /api/users/login - User login
  // POST /api/users/admin-login - Admin login
  // POST /api/users/logout - User logout
  // PUT /api/users/:id - Update user
  // DELETE /api/users/:id - Delete user
  // POST /api/users/:id/change-password - Change password
  // POST /api/users/:id/verify - Verify user email/phone
  app.use("/api/users", usersRouter);

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

  return app;
}
