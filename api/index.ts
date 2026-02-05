import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, or, like, desc, and, gte, lte, ne, inArray } from 'drizzle-orm';
import {
  mysqlTable,
  text,
  varchar,
  boolean,
  timestamp,
  json,
  mysqlEnum,
  decimal,
  int,
  float,
} from 'drizzle-orm/mysql-core';

// =====================================================
// MYSQL DATABASE CONNECTION
// Uses MySQL2 driver with connection pooling for Vercel
// =====================================================

const databaseConfig = {
  host: process.env.DB_HOST || 'mysql.freehostia.com',
  user: process.env.DB_USER || 'essref3_butcher',
  password: process.env.DB_PASSWORD || 'Butcher@123',
  database: process.env.DB_NAME || 'essref3_butcher',
  waitForConnections: true,
  connectionLimit: 1, // Minimal connections for FreeHostia limit
  queueLimit: 100, // Queue requests instead of failing
  connectTimeout: 30000,
  idleTimeout: 5000, // Close idle connections after 5 seconds
  enableKeepAlive: false, // Disable keep-alive to free connections faster
};

// Initialize pool and db instance
let mysqlPool: mysql.Pool | null = null;
let pgDb: any = null;

function initDatabase() {
  try {
    if (!mysqlPool) {
      console.log('[DB] Initializing MySQL pool with config:', {
        host: databaseConfig.host,
        user: databaseConfig.user,
        database: databaseConfig.database,
        connectionLimit: databaseConfig.connectionLimit,
      });
      mysqlPool = mysql.createPool(databaseConfig);
      pgDb = drizzle(mysqlPool);
      console.log('[DB] MySQL pool initialized successfully');
    }
    return pgDb;
  } catch (err) {
    console.error('[DB] Failed to initialize MySQL pool:', err);
    return null;
  }
}

// Initialize database on module load
initDatabase();

// User table definition (inline for Vercel)
const usersTable = mysqlTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  password: text("password").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  familyName: varchar("family_name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["customer", "admin", "staff", "delivery"]).notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  emirate: varchar("emirate", { length: 100 }),
  address: text("address"),
  preferences: json("preferences").$type<{
    language: "en" | "ar";
    currency: "AED" | "USD" | "EUR";
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

const sessionsTable = mysqlTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Unit enum for products
const unitEnum = mysqlEnum("unit", ["kg", "piece", "gram"]);

// Product categories table
const productCategoriesTable = mysqlTable("product_categories", {
  id: text("id").primaryKey(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull().default("🥩"),
  color: varchar("color", { length: 100 }).notNull().default("bg-red-100 text-red-600"),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Products table - MATCHES ACTUAL DATABASE SCHEMA
const productsTable = mysqlTable("products", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).notNull().default("0"), // Discount percentage (0-100)
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  image: text("image"),
  unit: mysqlEnum("unit", ["kg", "piece", "gram"]).notNull().default("kg"),
  minOrderQuantity: decimal("min_order_quantity", { precision: 10, scale: 2 }).notNull().default("0.25"),
  maxOrderQuantity: decimal("max_order_quantity", { precision: 10, scale: 2 }).notNull().default("10"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }).notNull().default("0"), // Product rating (0-5)
  tags: json("tags").$type<string[]>().default([]),
  badges: json("badges").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Stock table - integer thresholds match actual DB
const stockTable = mysqlTable("stock", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  reservedQuantity: decimal("reserved_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  availableQuantity: decimal("available_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  lowStockThreshold: int("low_stock_threshold").notNull().default(5),
  reorderPoint: int("reorder_point").notNull().default(10),
  reorderQuantity: int("reorder_quantity").notNull().default(20),
  lastRestockedAt: timestamp("last_restocked_at"),
  expiryDate: timestamp("expiry_date"),
  batchNumber: varchar("batch_number", { length: 100 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Stock movements table - MATCHES ACTUAL DATABASE SCHEMA
const stockMovementTypeEnum = mysqlEnum("stock_movement_type", ["in", "out", "adjustment", "reserved", "released"]);
const stockMovementsTable = mysqlTable("stock_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  type: mysqlEnum("type", ["in", "out", "adjustment", "reserved", "released"]).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  previousQuantity: decimal("previous_quantity", { precision: 10, scale: 2 }).notNull(),
  newQuantity: decimal("new_quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: text("reference_id"),
  performedBy: text("performed_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Orders table
const orderStatusEnum = mysqlEnum("order_status", [
  "pending", "confirmed", "processing", "ready_for_pickup",
  "out_for_delivery", "delivered", "cancelled", "refunded"
]);
const paymentStatusEnum = mysqlEnum("payment_status", [
  "pending", "authorized", "captured", "failed", "refunded", "partially_refunded"
]);
const paymentMethodEnum = mysqlEnum("payment_method", ["card", "cod", "bank_transfer"]);

const ordersTable = mysqlTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  userId: text("user_id").notNull(),
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerMobile: varchar("customer_mobile", { length: 20 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountCode: varchar("discount_code", { length: 50 }),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.05"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "processing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled", "refunded"]).notNull().default("pending"),
  paymentStatus: mysqlEnum("payment_status", ["pending", "authorized", "captured", "failed", "refunded", "partially_refunded"]).notNull().default("pending"),
  paymentMethod: mysqlEnum("payment_method", ["card", "cod", "bank_transfer"]).notNull(),
  addressId: text("address_id").notNull(),
  deliveryAddress: json("delivery_address").$type<any>().notNull(),
  deliveryNotes: text("delivery_notes"),
  deliveryZoneId: text("delivery_zone_id"),
  estimatedDeliveryAt: timestamp("estimated_delivery_at"),
  actualDeliveryAt: timestamp("actual_delivery_at"),
  statusHistory: json("status_history").$type<any[]>().default([]),
  source: varchar("source", { length: 20 }).notNull().default("web"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Order items table
const orderItemsTable = mysqlTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  productNameAr: varchar("product_name_ar", { length: 200 }),
  sku: varchar("sku", { length: 50 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
});

// Payments table
const currencyEnum = mysqlEnum("currency", ["AED", "USD", "EUR"]);
const paymentsTable = mysqlTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["AED", "USD", "EUR"]).notNull().default("AED"),
  method: mysqlEnum("method", ["card", "cod", "bank_transfer"]).notNull(),
  status: mysqlEnum("status", ["pending", "authorized", "captured", "failed", "refunded", "partially_refunded"]).notNull().default("pending"),
  cardBrand: varchar("card_brand", { length: 50 }),
  cardLast4: varchar("card_last4", { length: 4 }),
  cardExpiryMonth: int("card_expiry_month"),
  cardExpiryYear: int("card_expiry_year"),
  gatewayTransactionId: text("gateway_transaction_id"),
  gatewayResponse: text("gateway_response"),
  refundedAmount: decimal("refunded_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  refunds: json("refunds").$type<any[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Addresses table
const addressesTable = mysqlTable("addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: varchar("label", { length: 50 }).notNull(),
  fullName: varchar("full_name", { length: 200 }).notNull(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  emirate: varchar("emirate", { length: 100 }).notNull(),
  area: varchar("area", { length: 200 }).notNull(),
  street: text("street").notNull(),
  building: varchar("building", { length: 200 }).notNull(),
  floor: varchar("floor", { length: 20 }),
  apartment: varchar("apartment", { length: 50 }),
  landmark: text("landmark"),
  latitude: float("latitude"),
  longitude: float("longitude"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Delivery zones table
const deliveryZonesTable = mysqlTable("delivery_zones", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  emirate: varchar("emirate", { length: 100 }).notNull(),
  areas: json("areas").$type<string[]>().notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }).notNull(),
  estimatedMinutes: int("estimated_minutes").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  expressEnabled: boolean("express_enabled").notNull().default(false),
  expressFee: decimal("express_fee", { precision: 10, scale: 2 }).notNull().default("25"),
  expressHours: int("express_hours").notNull().default(1),
});

// In-app notifications table
const inAppNotificationsTable = mysqlTable("in_app_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  titleAr: varchar("title_ar", { length: 200 }).notNull(),
  message: text("message").notNull(),
  messageAr: text("message_ar").notNull(),
  link: text("link"),
  linkTab: varchar("link_tab", { length: 50 }),
  linkId: text("link_id"),
  unread: boolean("unread").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chat messages table
const chatMessagesTable = mysqlTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: varchar("user_name", { length: 200 }).notNull(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  text: text("text").notNull(),
  sender: varchar("sender", { length: 10 }).notNull(),
  attachments: json("attachments").$type<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }[]>(),
  readByAdmin: boolean("read_by_admin").notNull().default(false),
  readByUser: boolean("read_by_user").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Delivery tracking table
const deliveryTrackingStatusEnum = mysqlEnum("delivery_tracking_status", [
  "assigned", "picked_up", "in_transit", "nearby", "delivered", "failed"
]);
const deliveryTrackingTable = mysqlTable("delivery_tracking", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  driverId: text("driver_id"),
  driverName: varchar("driver_name", { length: 200 }),
  driverMobile: varchar("driver_mobile", { length: 20 }),
  status: mysqlEnum("status", ["assigned", "picked_up", "in_transit", "nearby", "delivered", "failed"]).notNull().default("assigned"),
  currentLocation: json("current_location").$type<any>(),
  estimatedArrival: timestamp("estimated_arrival"),
  actualArrival: timestamp("actual_arrival"),
  deliveryProof: json("delivery_proof").$type<any>(),
  timeline: json("timeline").$type<any[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Banners table
const bannersTable = mysqlTable("banners", {
  id: text("id").primaryKey(),
  titleEn: varchar("title_en", { length: 200 }).notNull(),
  titleAr: varchar("title_ar", { length: 200 }).notNull(),
  subtitleEn: text("subtitle_en"),
  subtitleAr: text("subtitle_ar"),
  image: text("image"),
  bgColor: varchar("bg_color", { length: 100 }).notNull().default("from-red-800 to-red-900"),
  link: text("link"),
  badge: varchar("badge", { length: 50 }),
  badgeAr: varchar("badge_ar", { length: 50 }),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Supplier status and payment terms enums
const supplierStatusEnum = mysqlEnum("supplier_status", ["active", "inactive", "pending", "suspended"]);
const supplierPaymentTermsEnum = mysqlEnum("supplier_payment_terms", ["net_7", "net_15", "net_30", "net_60", "cod", "prepaid"]);
const purchaseOrderStatusEnum = mysqlEnum("purchase_order_status", [
  "draft", "pending", "approved", "ordered", "partially_received", "received", "cancelled"
]);

// Suppliers table
const suppliersTable = mysqlTable("suppliers", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  website: text("website"),
  taxNumber: varchar("tax_number", { length: 50 }),
  address: json("address").$type<{
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  }>().notNull(),
  contacts: json("contacts").$type<{
    id: string;
    name: string;
    position: string;
    email: string;
    phone: string;
    isPrimary: boolean;
  }[]>().default([]),
  paymentTerms: mysqlEnum("payment_terms", ["net_7", "net_15", "net_30", "net_60", "cod", "prepaid"]).notNull().default("net_30"),
  currency: mysqlEnum("currency", ["AED", "USD", "EUR"]).notNull().default("AED"),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }).notNull().default("0"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  categories: json("categories").$type<string[]>().default([]),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  onTimeDeliveryRate: decimal("on_time_delivery_rate", { precision: 5, scale: 2 }).default("0"),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).default("0"),
  totalOrders: int("total_orders").notNull().default(0),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  status: mysqlEnum("status", ["active", "inactive", "pending", "suspended"]).notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastOrderAt: timestamp("last_order_at"),
});

// Supplier products table
const supplierProductsTable = mysqlTable("supplier_products", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  productId: text("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  supplierSku: varchar("supplier_sku", { length: 100 }),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  minimumOrderQuantity: int("minimum_order_quantity").notNull().default(1),
  leadTimeDays: int("lead_time_days").notNull().default(7),
  isPreferred: boolean("is_preferred").notNull().default(false),
  lastPurchasePrice: decimal("last_purchase_price", { precision: 10, scale: 2 }),
  lastPurchaseDate: timestamp("last_purchase_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Purchase orders table
const purchaseOrdersTable = mysqlTable("purchase_orders", {
  id: text("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  supplierId: text("supplier_id").notNull(),
  supplierName: varchar("supplier_name", { length: 200 }).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull().default("0.05"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["draft", "pending", "approved", "ordered", "partially_received", "received", "cancelled"]).notNull().default("draft"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("pending"),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date").notNull(),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNotes: text("delivery_notes"),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  internalNotes: text("internal_notes"),
  supplierNotes: text("supplier_notes"),
  statusHistory: json("status_history").$type<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Purchase order items table
const purchaseOrderItemsTable = mysqlTable("purchase_order_items", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id").notNull(),
  productId: text("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  supplierSku: varchar("supplier_sku", { length: 100 }),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: decimal("received_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
});

// Transaction type and status enums for finance
const transactionTypeEnum = mysqlEnum("transaction_type", [
  "sale", "refund", "expense", "purchase", "adjustment", "payout"
]);
const transactionStatusEnum = mysqlEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);
const expenseCategoryEnum = mysqlEnum("expense_category", [
  "inventory", "direct_labor", "freight_in", "marketing", "delivery", "sales_commission",
  "salaries", "rent", "utilities", "office_supplies", "insurance", "professional_fees",
  "licenses_permits", "bank_charges", "equipment", "maintenance", "depreciation", "amortization",
  "interest_expense", "finance_charges", "taxes", "government_fees", "employee_benefits",
  "training", "travel", "meals_entertainment", "other"
]);

// Finance transactions table
const financeTransactionsTable = mysqlTable("finance_transactions", {
  id: text("id").primaryKey(),
  type: mysqlEnum("type", ["sale", "refund", "expense", "purchase", "adjustment", "payout"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).notNull().default("pending"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["AED", "USD", "EUR"]).notNull().default("AED"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  category: mysqlEnum("category", ["inventory", "direct_labor", "freight_in", "marketing", "delivery", "sales_commission", "salaries", "rent", "utilities", "office_supplies", "insurance", "professional_fees", "licenses_permits", "bank_charges", "equipment", "maintenance", "depreciation", "amortization", "interest_expense", "finance_charges", "taxes", "government_fees", "employee_benefits", "training", "travel", "meals_entertainment", "other"]),
  reference: varchar("reference", { length: 100 }),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: text("reference_id"),
  accountId: text("account_id").notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  createdBy: text("created_by").notNull(),
  notes: text("notes"),
  attachments: json("attachments").$type<string[]>(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Account type enum for finance accounts
const accountTypeEnum = mysqlEnum("account_type", ["cash", "bank", "card_payments", "cod_collections", "petty_cash"]);
const expenseStatusEnum = mysqlEnum("expense_status", ["pending", "approved", "paid", "overdue", "cancelled", "reimbursed"]);

// Finance accounts table
const financeAccountsTable = mysqlTable("finance_accounts", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  type: mysqlEnum("type", ["cash", "bank", "card_payments", "cod_collections", "petty_cash"]).notNull(),
  balance: decimal("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: mysqlEnum("currency", ["AED", "USD", "EUR"]).notNull().default("AED"),
  isActive: boolean("is_active").notNull().default(true),
  bankName: varchar("bank_name", { length: 100 }),
  accountNumber: varchar("account_number", { length: 50 }),
  iban: varchar("iban", { length: 50 }),
  lastReconciled: timestamp("last_reconciled"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Finance expenses table (IFRS/GAAP Enhanced)
const financeExpensesTable = mysqlTable("finance_expenses", {
  id: text("id").primaryKey(),
  expenseNumber: varchar("expense_number", { length: 50 }).notNull(),
  category: mysqlEnum("category", ["inventory", "direct_labor", "freight_in", "marketing", "delivery", "sales_commission", "salaries", "rent", "utilities", "office_supplies", "insurance", "professional_fees", "licenses_permits", "bank_charges", "equipment", "maintenance", "depreciation", "amortization", "interest_expense", "finance_charges", "taxes", "government_fees", "employee_benefits", "training", "travel", "meals_entertainment", "other"]).notNull(),
  function: varchar("function", { length: 50 }).default("administrative"),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5"),
  isVatRecoverable: boolean("is_vat_recoverable").default(true),
  withholdingTax: decimal("withholding_tax", { precision: 10, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["AED", "USD", "EUR"]).notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }).default("1"),
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 10, scale: 2 }),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  vendorId: text("vendor_id"),
  vendor: varchar("vendor", { length: 200 }),
  vendorTrn: varchar("vendor_trn", { length: 20 }),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceDate: timestamp("invoice_date"),
  receivedDate: timestamp("received_date"),
  paymentTerms: varchar("payment_terms", { length: 20 }).default("net_30"),
  dueDate: timestamp("due_date"),
  earlyPaymentDiscount: decimal("early_payment_discount", { precision: 5, scale: 2 }).default("0"),
  earlyPaymentDays: int("early_payment_days").default(0),
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  status: mysqlEnum("status", ["pending", "approved", "paid", "overdue", "cancelled", "reimbursed"]).notNull().default("pending"),
  approvalStatus: varchar("approval_status", { length: 20 }).default("draft"),
  costCenterId: text("cost_center_id"),
  costCenterName: varchar("cost_center_name", { length: 100 }),
  projectId: text("project_id"),
  projectName: varchar("project_name", { length: 100 }),
  departmentId: text("department_id"),
  departmentName: varchar("department_name", { length: 100 }),
  accountId: text("account_id"),
  glAccountCode: varchar("gl_account_code", { length: 20 }),
  journalEntryId: text("journal_entry_id"),
  createdBy: text("created_by").notNull(),
  submittedBy: text("submitted_by"),
  submittedAt: timestamp("submitted_at"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: text("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  attachments: json("attachments").$type<string[]>().default([]),
  tags: json("tags").$type<string[]>().default([]),
  isRecurring: boolean("is_recurring").default(false),
  recurringSchedule: varchar("recurring_schedule", { length: 20 }),
  nextRecurrenceDate: timestamp("next_recurrence_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Helper to generate expense number
const generateExpenseNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  if (!pgDb) return `EXP-${year}-0001`;
  const result = await pgDb.select().from(financeExpensesTable).orderBy(desc(financeExpensesTable.createdAt)).limit(1);
  if (result.length === 0) return `EXP-${year}-0001`;
  const lastNumber = result[0].expenseNumber;
  const match = lastNumber.match(/EXP-\d+-(\d+)/);
  const nextSeq = match ? String(parseInt(match[1], 10) + 1).padStart(4, '0') : '0001';
  return `EXP-${year}-${nextSeq}`;
};

// Helper to generate account ID
const generateAccountId = (): string => `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Account class enum for chart of accounts
const accountClassEnum = mysqlEnum("account_class", [
  "asset", "liability", "equity", "revenue", "expense"
]);

// Journal entry status enum
const journalEntryStatusEnum = mysqlEnum("journal_entry_status", [
  "draft", "posted", "reversed"
]);

// VAT return status enum
const vatReturnStatusEnum = mysqlEnum("vat_return_status", [
  "draft", "submitted", "accepted", "rejected", "amended"
]);

// Chart of accounts table
const chartOfAccountsTable = mysqlTable("chart_of_accounts", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  accountClass: mysqlEnum("account_class", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  parentId: text("parent_id"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isSystemAccount: boolean("is_system_account").notNull().default(false),
  balance: decimal("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  normalBalance: varchar("normal_balance", { length: 10 }).notNull().default("debit"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Cost centers table
const costCentersTable = mysqlTable("cost_centers", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  description: text("description"),
  parentId: text("parent_id"),
  managerId: text("manager_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Expense budgets table
const expenseBudgetsTable = mysqlTable("expense_budgets", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  periodType: varchar("period_type", { length: 20 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  category: varchar("category", { length: 50 }),
  costCenterId: text("cost_center_id"),
  departmentId: text("department_id"),
  budgetAmount: decimal("budget_amount", { precision: 12, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 12, scale: 2 }).default("0"),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }),
  alertThreshold: int("alert_threshold").default(80),
  isAlertSent: boolean("is_alert_sent").default(false),
  isActive: boolean("is_active").default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Vendors table (for finance, separate from suppliers)
const vendorsTable = mysqlTable("vendors", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  mobile: varchar("mobile", { length: 20 }),
  website: varchar("website", { length: 255 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  emirate: varchar("emirate", { length: 50 }),
  country: varchar("country", { length: 100 }).default("UAE"),
  trn: varchar("trn", { length: 20 }),
  defaultPaymentTerms: varchar("default_payment_terms", { length: 20 }).default("net_30"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Journal entries table
const journalEntriesTable = mysqlTable("journal_entries", {
  id: text("id").primaryKey(),
  entryNumber: varchar("entry_number", { length: 20 }).notNull().unique(),
  entryDate: timestamp("entry_date").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  reference: varchar("reference", { length: 100 }),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: text("reference_id"),
  status: mysqlEnum("status", ["draft", "posted", "reversed"]).notNull().default("draft"),
  totalDebit: decimal("total_debit", { precision: 14, scale: 2 }).notNull().default("0"),
  totalCredit: decimal("total_credit", { precision: 14, scale: 2 }).notNull().default("0"),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  postedAt: timestamp("posted_at"),
  reversedAt: timestamp("reversed_at"),
  reversalEntryId: text("reversal_entry_id"),
  notes: text("notes"),
  attachments: json("attachments").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Journal entry lines table
const journalEntryLinesTable = mysqlTable("journal_entry_lines", {
  id: text("id").primaryKey(),
  journalEntryId: text("journal_entry_id").notNull(),
  accountId: text("account_id").notNull(),
  accountCode: varchar("account_code", { length: 10 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  debit: decimal("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: decimal("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Audit log table
const auditLogTable = mysqlTable("audit_log", {
  id: text("id").primaryKey(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: text("entity_id").notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  previousValue: json("previous_value"),
  newValue: json("new_value"),
  changedFields: json("changed_fields").$type<string[]>(),
  userId: text("user_id").notNull(),
  userName: varchar("user_name", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// VAT returns table
const vatReturnsTable = mysqlTable("vat_returns", {
  id: text("id").primaryKey(),
  returnNumber: varchar("return_number", { length: 20 }).notNull().unique(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  box1StandardRatedSupplies: decimal("box1_standard_rated_supplies", { precision: 14, scale: 2 }).default("0"),
  box1VatOnSupplies: decimal("box1_vat_on_supplies", { precision: 14, scale: 2 }).default("0"),
  box2TaxRefundsForTourists: decimal("box2_tax_refunds", { precision: 14, scale: 2 }).default("0"),
  box3ZeroRatedSupplies: decimal("box3_zero_rated_supplies", { precision: 14, scale: 2 }).default("0"),
  box4ExemptSupplies: decimal("box4_exempt_supplies", { precision: 14, scale: 2 }).default("0"),
  box5GoodsImportedFromGcc: decimal("box5_goods_imported_gcc", { precision: 14, scale: 2 }).default("0"),
  box5VatOnImports: decimal("box5_vat_on_imports", { precision: 14, scale: 2 }).default("0"),
  box6Adjustments: decimal("box6_adjustments", { precision: 14, scale: 2 }).default("0"),
  box7TotalVatDue: decimal("box7_total_vat_due", { precision: 14, scale: 2 }).default("0"),
  box8StandardRatedExpenses: decimal("box8_standard_rated_expenses", { precision: 14, scale: 2 }).default("0"),
  box8RecoverableVat: decimal("box8_recoverable_vat", { precision: 14, scale: 2 }).default("0"),
  box9Adjustments: decimal("box9_adjustments", { precision: 14, scale: 2 }).default("0"),
  box10NetVatDue: decimal("box10_net_vat_due", { precision: 14, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["draft", "submitted", "accepted", "rejected", "amended"]).notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  submittedBy: text("submitted_by"),
  ftaReferenceNumber: varchar("fta_reference_number", { length: 50 }),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Expense approval rules table
const expenseApprovalRulesTable = mysqlTable("expense_approval_rules", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  minAmount: decimal("min_amount", { precision: 10, scale: 2 }).default("0"),
  maxAmount: decimal("max_amount", { precision: 10, scale: 2 }),
  category: varchar("category", { length: 50 }),
  costCenterId: text("cost_center_id"),
  approverLevel: int("approver_level").notNull().default(1),
  approverId: text("approver_id"),
  approverRole: varchar("approver_role", { length: 50 }),
  requiresAllApprovers: boolean("requires_all_approvers").default(false),
  autoApproveBelow: decimal("auto_approve_below", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  priority: int("priority").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Delivery time slots table
const deliveryTimeSlotsTable = mysqlTable("delivery_time_slots", {
  id: text("id").primaryKey(),
  label: varchar("label", { length: 100 }).notNull(),
  labelAr: varchar("label_ar", { length: 100 }).notNull(),
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
  isExpressSlot: boolean("is_express_slot").notNull().default(false),
  maxOrders: int("max_orders").notNull().default(20),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Discount codes / Promo codes table
const discountCodeTypeEnum = mysqlEnum("discount_code_type", ["percentage", "fixed"]);
const discountCodesTable = mysqlTable("discount_codes", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  type: mysqlEnum("type", ["percentage", "fixed"]).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }).notNull().default("0"),
  maximumDiscount: decimal("maximum_discount", { precision: 10, scale: 2 }),
  usageLimit: int("usage_limit").notNull().default(0),
  usageCount: int("usage_count").notNull().default(0),
  userLimit: int("user_limit").notNull().default(1),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  applicableProducts: json("applicable_products").$type<string[]>(),
  applicableCategories: json("applicable_categories").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// App settings table - matches server/db/schema.ts (no createdAt column)
const appSettingsTable = mysqlTable("app_settings", {
  id: text("id").primaryKey().default("default"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.05"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull().default("15"),
  freeDeliveryThreshold: decimal("free_delivery_threshold", { precision: 10, scale: 2 }).notNull().default("200"),
  expressDeliveryFee: decimal("express_delivery_fee", { precision: 10, scale: 2 }).notNull().default("25"),
  minimumOrderAmount: decimal("minimum_order_amount", { precision: 10, scale: 2 }).notNull().default("50"),
  maxOrdersPerDay: int("max_orders_per_day").notNull().default(100),
  enableCashOnDelivery: boolean("enable_cash_on_delivery").notNull().default(true),
  enableCardPayment: boolean("enable_card_payment").notNull().default(true),
  enableWallet: boolean("enable_wallet").notNull().default(true),
  enableLoyalty: boolean("enable_loyalty").notNull().default(true),
  enableReviews: boolean("enable_reviews").notNull().default(true),
  enableWishlist: boolean("enable_wishlist").notNull().default(true),
  enableExpressDelivery: boolean("enable_express_delivery").notNull().default(true),
  enableScheduledDelivery: boolean("enable_scheduled_delivery").notNull().default(true),
  enableWelcomeBonus: boolean("enable_welcome_bonus").notNull().default(true),
  welcomeBonus: decimal("welcome_bonus", { precision: 10, scale: 2 }).notNull().default("50"),
  cashbackPercentage: decimal("cashback_percentage", { precision: 5, scale: 2 }).notNull().default("2"),
  loyaltyPointsPerAed: decimal("loyalty_points_per_aed", { precision: 5, scale: 2 }).notNull().default("1"),
  loyaltyPointValue: decimal("loyalty_point_value", { precision: 5, scale: 4 }).notNull().default("0.1"),
  storePhone: varchar("store_phone", { length: 20 }),
  storeEmail: varchar("store_email", { length: 255 }),
  storeAddress: text("store_address"),
  storeAddressAr: text("store_address_ar"),
  workingHoursStart: varchar("working_hours_start", { length: 10 }).default("08:00"),
  workingHoursEnd: varchar("working_hours_end", { length: 10 }).default("22:00"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to check if DB is available
const isDatabaseAvailable = () => !!pgDb;

// =====================================================
// INLINE DATABASE FOR VERCEL SERVERLESS (FALLBACK)
// =====================================================

interface User {
  id: string;
  username?: string;
  email: string;
  mobile: string;
  password: string;
  firstName: string;
  familyName: string;
  role: 'customer' | 'admin' | 'staff' | 'delivery';
  isActive: boolean;
  isVerified: boolean;
  emirate: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences: {
    language: 'en' | 'ar';
    currency: 'AED' | 'USD' | 'EUR';
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;
  };
}

interface Session {
  userId: string;
  expiresAt: string;
}

interface TrackingData {
  id: string;
  driverId: string;
  driverName: string;
  driverMobile: string;
  status: string;
  estimatedArrival: string;
  timeline: { status: string; timestamp: string; notes?: string }[];
  createdAt: string;
  updatedAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  items: { id: string; productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryAddress: { building: string; street: string; area: string; emirate: string; landmark?: string };
  deliveryNotes?: string;
  statusHistory: { status: string; changedAt: string; changedBy: string }[];
  trackingInfo?: TrackingData;
  createdAt: string;
  updatedAt: string;
}

interface StockItem {
  id: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastRestockedAt: string;
  updatedAt: string;
}

interface StockMovement {
  id: string;
  productId: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string;
}

interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  customerName: string;
  gatewayTransactionId: string;
  cardBrand?: string;
  cardLast4?: string;
  refundedAmount: number;
  refunds: { id: string; amount: number; reason: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

interface Address {
  id: string;
  userId: string;
  label: string;
  fullName: string;
  mobile: string;
  emirate: string;
  area: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-memory caches only - NO SEEDING
// These are used for temporary caching only, primary storage is in database
const sessions = new Map<string, Session>();

// Legacy empty maps - kept for backward compatibility but NOT seeded
// All CRUD operations should use database, these are fallback only
const users = new Map<string, User>();
const orders = new Map<string, Order>();
const addresses = new Map<string, Address>();

// Delivery tracking cache for quick access (primary storage is in database)
const deliveryTrackingCache = new Map<string, {
  id: string;
  orderId: string;
  orderNumber: string;
  driverId: string;
  driverName: string;
  driverMobile: string;
  status: string;
  customerName?: string;
  customerMobile?: string;
  deliveryAddress?: any;
  deliveryNotes?: string;
  items?: { name: string; quantity: number }[];
  total?: number;
  estimatedArrival: string;
  timeline: { status: string; timestamp: string; notes?: string }[];
  createdAt: string;
  updatedAt: string;
}>();

// Generate token
const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

// Sanitize user (remove password)
function sanitizeUser(user: User): Omit<User, 'password'> {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// =====================================================
// INVENTORY MANAGEMENT HELPERS (IAS 2 / GAAP Compliant)
// =====================================================

/**
 * Validate stock availability for order items
 * Returns error message if any item has insufficient stock
 */
async function validateStockAvailability(
  items: Array<{ productId: string; quantity: number; productName?: string }>,
  db: typeof pgDb
): Promise<{ valid: boolean; error?: string; insufficientItems?: Array<{ productId: string; productName: string; available: number; requested: number }> }> {
  if (!db) return { valid: false, error: 'Database not available' };

  const insufficientItems: Array<{ productId: string; productName: string; available: number; requested: number }> = [];

  for (const item of items) {
    const stockResult = await db.select().from(stockTable).where(eq(stockTable.productId, item.productId));
    if (stockResult.length === 0) {
      // If no stock record exists, treat as out of stock
      insufficientItems.push({
        productId: item.productId,
        productName: item.productName || item.productId,
        available: 0,
        requested: item.quantity,
      });
      continue;
    }

    const stockItem = stockResult[0];
    const available = parseFloat(stockItem.availableQuantity);

    if (available < item.quantity) {
      insufficientItems.push({
        productId: item.productId,
        productName: item.productName || item.productId,
        available,
        requested: item.quantity,
      });
    }
  }

  if (insufficientItems.length > 0) {
    const errorItems = insufficientItems.map(i => `${i.productName}: ${i.available} available, ${i.requested} requested`).join('; ');
    return { valid: false, error: `Insufficient stock: ${errorItems}`, insufficientItems };
  }

  return { valid: true };
}

/**
 * Reserve stock for an order (reduces available quantity, increases reserved)
 * Called when order is placed
 */
async function reserveStockForOrder(
  orderId: string,
  orderNumber: string,
  items: Array<{ productId: string; quantity: number; productName?: string }>,
  db: typeof pgDb
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: 'Database not available' };

  const now = new Date();

  for (const item of items) {
    const stockResult = await db.select().from(stockTable).where(eq(stockTable.productId, item.productId));
    if (stockResult.length === 0) continue; // Skip if no stock record

    const stockItem = stockResult[0];
    const currentQuantity = parseFloat(stockItem.quantity);
    const currentReserved = parseFloat(stockItem.reservedQuantity);
    const currentAvailable = parseFloat(stockItem.availableQuantity);

    const newReserved = currentReserved + item.quantity;
    const newAvailable = currentAvailable - item.quantity;

    // Update stock
    await db.update(stockTable)
      .set({
        reservedQuantity: String(newReserved),
        availableQuantity: String(newAvailable),
        updatedAt: now,
      })
      .where(eq(stockTable.productId, item.productId));

    // Record movement
    await db.insert(stockMovementsTable).values({
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: item.productId,
      type: 'reserved',
      quantity: String(item.quantity),
      previousQuantity: String(currentQuantity),
      newQuantity: String(currentQuantity), // Total quantity unchanged, only reserved increased
      reason: `Reserved for order ${orderNumber}`,
      referenceType: 'order',
      referenceId: orderId,
      performedBy: 'system',
      createdAt: now,
    });
  }

  return { success: true };
}

/**
 * Confirm stock reduction when order is delivered
 * Moves items from reserved to actually sold (reduces total quantity)
 */
async function confirmStockForDeliveredOrder(
  orderId: string,
  orderNumber: string,
  db: typeof pgDb
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: 'Database not available' };

  const now = new Date();

  // Get order items
  const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));

  for (const item of orderItems) {
    const stockResult = await db.select().from(stockTable).where(eq(stockTable.productId, item.productId));
    if (stockResult.length === 0) continue;

    const stockItem = stockResult[0];
    const currentQuantity = parseFloat(stockItem.quantity);
    const currentReserved = parseFloat(stockItem.reservedQuantity);
    const itemQty = parseFloat(item.quantity);

    const newQuantity = currentQuantity - itemQty;
    const newReserved = Math.max(0, currentReserved - itemQty);
    const newAvailable = newQuantity - newReserved;

    // Update stock - reduce total quantity
    await db.update(stockTable)
      .set({
        quantity: String(newQuantity),
        reservedQuantity: String(newReserved),
        availableQuantity: String(newAvailable),
        updatedAt: now,
      })
      .where(eq(stockTable.productId, item.productId));

    // Record movement as "out" (sold)
    await db.insert(stockMovementsTable).values({
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: item.productId,
      type: 'out',
      quantity: String(itemQty),
      previousQuantity: String(currentQuantity),
      newQuantity: String(newQuantity),
      reason: `Sold via order ${orderNumber}`,
      referenceType: 'order',
      referenceId: orderId,
      performedBy: 'system',
      createdAt: now,
    });

    // Check for low stock alert
    if (newAvailable <= stockItem.lowStockThreshold) {
      console.log(`[Low Stock Alert] Product ${item.productId} is low on stock: ${newAvailable} remaining`);
    }
  }

  return { success: true };
}

/**
 * Release reserved stock when order is cancelled
 */
async function releaseStockForCancelledOrder(
  orderId: string,
  orderNumber: string,
  db: typeof pgDb
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: 'Database not available' };

  const now = new Date();

  // Get order items
  const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));

  for (const item of orderItems) {
    const stockResult = await db.select().from(stockTable).where(eq(stockTable.productId, item.productId));
    if (stockResult.length === 0) continue;

    const stockItem = stockResult[0];
    const currentQuantity = parseFloat(stockItem.quantity);
    const currentReserved = parseFloat(stockItem.reservedQuantity);
    const itemQty = parseFloat(item.quantity);

    const newReserved = Math.max(0, currentReserved - itemQty);
    const newAvailable = currentQuantity - newReserved;

    // Update stock - release reserved, restore available
    await db.update(stockTable)
      .set({
        reservedQuantity: String(newReserved),
        availableQuantity: String(newAvailable),
        updatedAt: now,
      })
      .where(eq(stockTable.productId, item.productId));

    // Record movement as "released"
    await db.insert(stockMovementsTable).values({
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: item.productId,
      type: 'released',
      quantity: String(itemQty),
      previousQuantity: String(currentQuantity),
      newQuantity: String(currentQuantity), // Total unchanged, only reserved decreased
      reason: `Released from cancelled order ${orderNumber}`,
      referenceType: 'order',
      referenceId: orderId,
      performedBy: 'system',
      createdAt: now,
    });
  }

  return { success: true };
}

/**
 * Receive stock from Purchase Order (increases inventory)
 * Called when PO items are received from supplier
 */
async function receiveStockFromPurchaseOrder(
  purchaseOrderId: string,
  purchaseOrderNumber: string,
  items: Array<{ productId: string; quantity: number; unitCost: number }>,
  performedBy: string,
  db: typeof pgDb
): Promise<{ success: boolean; error?: string; totalValue: number }> {
  if (!db) return { success: false, error: 'Database not available', totalValue: 0 };

  const now = new Date();
  let totalValue = 0;

  for (const item of items) {
    // Check if stock record exists
    const stockResult = await db.select().from(stockTable).where(eq(stockTable.productId, item.productId));

    if (stockResult.length === 0) {
      // Create new stock record for this product
      await db.insert(stockTable).values({
        id: `stock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: item.productId,
        quantity: String(item.quantity),
        reservedQuantity: '0',
        availableQuantity: String(item.quantity),
        lowStockThreshold: 10,
        reorderPoint: 20,
        reorderQuantity: 50,
        updatedAt: now,
      });

      // Record movement as "in"
      await db.insert(stockMovementsTable).values({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: item.productId,
        type: 'in',
        quantity: String(item.quantity),
        previousQuantity: '0',
        newQuantity: String(item.quantity),
        reason: `Received from PO ${purchaseOrderNumber}`,
        referenceType: 'purchase_order',
        referenceId: purchaseOrderId,
        performedBy,
        createdAt: now,
      });
    } else {
      const stockItem = stockResult[0];
      const currentQuantity = parseFloat(stockItem.quantity);
      const currentAvailable = parseFloat(stockItem.availableQuantity);

      const newQuantity = currentQuantity + item.quantity;
      const newAvailable = currentAvailable + item.quantity;

      // Update stock - increase quantity
      await db.update(stockTable)
        .set({
          quantity: String(newQuantity),
          availableQuantity: String(newAvailable),
          updatedAt: now,
        })
        .where(eq(stockTable.productId, item.productId));

      // Record movement as "in"
      await db.insert(stockMovementsTable).values({
        id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        productId: item.productId,
        type: 'in',
        quantity: String(item.quantity),
        previousQuantity: String(currentQuantity),
        newQuantity: String(newQuantity),
        reason: `Received from PO ${purchaseOrderNumber}`,
        referenceType: 'purchase_order',
        referenceId: purchaseOrderId,
        performedBy,
        createdAt: now,
      });
    }

    totalValue += item.quantity * item.unitCost;
  }

  console.log(`[Inventory Cycle] Received ${items.length} items from PO ${purchaseOrderNumber}, total value: ${totalValue} AED`);
  return { success: true, totalValue };
}

/**
 * Create finance transaction for a sale (customer order delivered)
 * IAS 18 / IFRS 15 compliant revenue recognition
 */
async function createSaleTransaction(
  orderId: string,
  orderNumber: string,
  total: number,
  vatAmount: number,
  paymentMethod: string,
  customerId: string,
  performedBy: string,
  db: typeof pgDb
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  if (!db) return { success: false, error: 'Database not available' };

  const now = new Date();
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine account based on payment method
  let accountName = 'Bank Account';
  if (paymentMethod === 'cod') accountName = 'COD Collections';
  else if (paymentMethod === 'card') accountName = 'Card Payments';

  await db.insert(financeTransactionsTable).values({
    id: transactionId,
    type: 'sale',
    status: paymentMethod === 'cod' ? 'pending' : 'completed',
    amount: String(total),
    currency: 'AED',
    description: `Sale from order ${orderNumber}`,
    descriptionAr: `مبيعات من الطلب ${orderNumber}`,
    category: 'inventory',
    reference: orderNumber,
    referenceType: 'order',
    referenceId: orderId,
    accountId: 'acc_main', // Default main account
    accountName,
    createdBy: performedBy,
    notes: `Customer ID: ${customerId}, VAT: ${vatAmount} AED`,
    metadata: {
      orderId,
      orderNumber,
      customerId,
      vatAmount,
      paymentMethod,
    },
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[Finance Cycle] Created sale transaction ${transactionId} for order ${orderNumber}`);
  return { success: true, transactionId };
}

/**
 * Create finance transaction for a purchase (PO payment)
 * IAS 2 compliant inventory costing
 */
async function createPurchaseTransaction(
  purchaseOrderId: string,
  purchaseOrderNumber: string,
  supplierId: string,
  supplierName: string,
  amount: number,
  vatAmount: number,
  performedBy: string,
  db: typeof pgDb
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  if (!db) return { success: false, error: 'Database not available' };

  const now = new Date();
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(financeTransactionsTable).values({
    id: transactionId,
    type: 'purchase',
    status: 'completed',
    amount: String(amount),
    currency: 'AED',
    description: `Purchase from ${supplierName} - PO ${purchaseOrderNumber}`,
    descriptionAr: `مشتريات من ${supplierName} - أمر شراء ${purchaseOrderNumber}`,
    category: 'inventory',
    reference: purchaseOrderNumber,
    referenceType: 'purchase_order',
    referenceId: purchaseOrderId,
    accountId: 'acc_main',
    accountName: 'Bank Account',
    createdBy: performedBy,
    notes: `Supplier ID: ${supplierId}, VAT: ${vatAmount} AED`,
    metadata: {
      purchaseOrderId,
      purchaseOrderNumber,
      supplierId,
      supplierName,
      vatAmount,
    },
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[Finance Cycle] Created purchase transaction ${transactionId} for PO ${purchaseOrderNumber}`);
  return { success: true, transactionId };
}

/**
 * Create refund transaction when order is refunded
 */
async function createRefundTransaction(
  orderId: string,
  orderNumber: string,
  amount: number,
  reason: string,
  performedBy: string,
  db: typeof pgDb
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  if (!db) return { success: false, error: 'Database not available' };

  const now = new Date();
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(financeTransactionsTable).values({
    id: transactionId,
    type: 'refund',
    status: 'completed',
    amount: String(amount),
    currency: 'AED',
    description: `Refund for order ${orderNumber}`,
    descriptionAr: `استرداد للطلب ${orderNumber}`,
    category: 'inventory',
    reference: orderNumber,
    referenceType: 'order',
    referenceId: orderId,
    accountId: 'acc_main',
    accountName: 'Bank Account',
    createdBy: performedBy,
    notes: reason,
    metadata: {
      orderId,
      orderNumber,
      refundReason: reason,
    },
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[Finance Cycle] Created refund transaction ${transactionId} for order ${orderNumber}`);
  return { success: true, transactionId };
}

// =====================================================
// EXPRESS APP
// =====================================================

let app: express.Express | null = null;

function createApp() {
  if (app) return app;

  // No seedData() - all data comes from real database

  app = express();
  app.use(cors());
  
  // Handle Vercel's pre-parsed body - Vercel parses the body before Express sees it
  // This middleware ensures req.body is available for Express routes
  app.use((req, res, next) => {
    // If body is already parsed by Vercel, skip express.json()
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      console.log('[Body Parser] Body already parsed by Vercel:', Object.keys(req.body));
      return next();
    }
    // Otherwise, use express.json()
    express.json({ limit: '50mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Ping endpoint
  app.get('/api/ping', (req, res) => {
    res.json({ message: 'pong', timestamp: new Date().toISOString() });
  });

  // Health check endpoint with DB status
  app.get('/api/health', async (req, res) => {
    const dbConnected = isDatabaseAvailable();
    let dbTest = false;
    let dbError = null;
    let errorCode = null;

    if (dbConnected && pgDb) {
      try {
        // Test query
        await pgDb.select().from(usersTable).limit(1);
        dbTest = true;
      } catch (e: any) {
        console.error('[Health Check DB Error]', e);
        dbError = e.message || 'Unknown error';
        errorCode = e.code || e.errno || null;
      }
    }

    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
          configured: dbConnected,
          connected: dbTest,
          error: dbError,
          errorCode: errorCode,
          url: `mysql://${databaseConfig.user}@${databaseConfig.host}/${databaseConfig.database}`,
          connectionLimit: databaseConfig.connectionLimit,
          envVars: {
            DB_HOST: process.env.DB_HOST ? 'set' : 'not set',
            DB_USER: process.env.DB_USER ? 'set' : 'not set',
            DB_PASSWORD: process.env.DB_PASSWORD ? 'set' : 'not set',
            DB_NAME: process.env.DB_NAME ? 'set' : 'not set',
          }
        },
        inMemoryUsers: users.size,
      },
    });
  });

  // User login
  app.post('/api/users/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }

      let user: User | undefined;

      // Try database first if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          const dbUsers = await pgDb.select().from(usersTable).where(
            or(
              eq(usersTable.username, username),
              eq(usersTable.email, username)
            )
          ).limit(1);

          if (dbUsers.length > 0) {
            const dbUser = dbUsers[0];
            // Safely handle timestamps that may be invalid
            const safeDate = (d: any) => {
              if (!d) return new Date().toISOString();
              const date = d instanceof Date ? d : new Date(d);
              return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
            };
            user = {
              id: dbUser.id,
              username: dbUser.username,
              email: dbUser.email,
              mobile: dbUser.mobile,
              password: dbUser.password,
              firstName: dbUser.firstName,
              familyName: dbUser.familyName,
              role: dbUser.role as User['role'],
              isActive: dbUser.isActive ?? true,
              isVerified: dbUser.isVerified ?? false,
              emirate: dbUser.emirate || '',
              address: dbUser.address || undefined,
              createdAt: safeDate(dbUser.createdAt),
              updatedAt: safeDate(dbUser.updatedAt),
              lastLoginAt: dbUser.lastLoginAt ? safeDate(dbUser.lastLoginAt) : undefined,
              preferences: typeof dbUser.preferences === 'string' 
                ? JSON.parse(dbUser.preferences) 
                : (dbUser.preferences || {
                    language: 'en',
                    currency: 'AED',
                    emailNotifications: true,
                    smsNotifications: true,
                    marketingEmails: true,
                  }),
            };
          }
        } catch (dbError: any) {
          console.error('[Login DB Error]', dbError?.message || dbError);
          return res.status(500).json({ success: false, error: 'Database error during login', details: dbError?.message });
        }
      } else {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      if (!user) {
        return res.status(401).json({ success: false, error: 'No account found with this username or email' });
      }

      if (!user.isActive) {
        return res.status(401).json({ success: false, error: 'Account is deactivated' });
      }

      if (user.password !== password) {
        return res.status(401).json({ success: false, error: 'Incorrect password' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const sessionId = `session_${Date.now()}`;

      // Store session in database
      if (isDatabaseAvailable() && pgDb) {
        try {
          await pgDb.insert(sessionsTable).values({
            id: sessionId,
            userId: user.id,
            token: token,
            expiresAt: expiresAt,
            createdAt: new Date(),
          });
        } catch (e) {
          console.error('[Session DB Error]', e);
        }
      }

      // Also store in memory for fallback
      sessions.set(token, { userId: user.id, expiresAt: expiresAt.toISOString() });

      // Update last login in DB if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          await pgDb.update(usersTable)
            .set({ lastLoginAt: new Date() })
            .where(eq(usersTable.id, user.id));
        } catch (e) { /* ignore */ }
      }
      user.lastLoginAt = new Date().toISOString();

      res.json({
        success: true,
        data: {
          user: sanitizeUser(user),
          token,
          expiresAt: expiresAt.toISOString(),
        },
        message: 'Login successful',
      });
    } catch (error) {
      console.error('[Login Error]', error);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  });

  // Admin/Staff login
  app.post('/api/users/admin-login', async (req, res) => {
    try {
      let { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }

      // Trim whitespace
      username = username.trim();
      password = password.trim();

      let user: User | undefined;

      // Try database first if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          // Find user by username OR email
          const dbUsers = await pgDb.select().from(usersTable).where(
            or(
              eq(usersTable.username, username),
              eq(usersTable.email, username)
            )
          ).limit(1);

          // Allow admin, staff, and delivery roles
          if (dbUsers.length > 0 && ['admin', 'staff', 'delivery'].includes(dbUsers[0].role)) {
            const dbUser = dbUsers[0];

            if (!dbUser.isActive) {
              return res.status(401).json({ success: false, error: 'Account is deactivated' });
            }

            // Safely handle timestamps that may be invalid
            const safeDate = (d: any) => {
              if (!d) return new Date().toISOString();
              const date = d instanceof Date ? d : new Date(d);
              return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
            };
            user = {
              id: dbUser.id,
              username: dbUser.username,
              email: dbUser.email,
              mobile: dbUser.mobile,
              password: dbUser.password,
              firstName: dbUser.firstName,
              familyName: dbUser.familyName,
              role: dbUser.role as User['role'],
              isActive: dbUser.isActive ?? true,
              isVerified: dbUser.isVerified ?? false,
              emirate: dbUser.emirate || '',
              createdAt: safeDate(dbUser.createdAt),
              updatedAt: safeDate(dbUser.updatedAt),
              preferences: typeof dbUser.preferences === 'string' 
                ? JSON.parse(dbUser.preferences) 
                : (dbUser.preferences || {
                    language: 'en',
                    currency: 'AED',
                    emailNotifications: true,
                    smsNotifications: true,
                    marketingEmails: false,
                  }),
            };
          }
        } catch (dbError: any) {
          console.error('[Admin Login DB Error]', dbError?.message || dbError);
          return res.status(500).json({ success: false, error: 'Database error during login', details: dbError?.message });
        }
      } else {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid staff credentials or insufficient permissions' });
      }

      if (user.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid staff credentials' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const sessionId = `session_${Date.now()}`;

      // Store session in database
      if (isDatabaseAvailable() && pgDb) {
        try {
          await pgDb.insert(sessionsTable).values({
            id: sessionId,
            userId: user.id,
            token: token,
            expiresAt: expiresAt,
            createdAt: new Date(),
          });
        } catch (e) {
          console.error('[Admin Session DB Error]', e);
        }
      }

      // Also store in memory for fallback
      sessions.set(token, { userId: user.id, expiresAt: expiresAt.toISOString() });

      if (isDatabaseAvailable() && pgDb) {
        try {
          await pgDb.update(usersTable)
            .set({ lastLoginAt: new Date() })
            .where(eq(usersTable.id, user.id));
        } catch (e) { /* ignore */ }
      }
      user.lastLoginAt = new Date().toISOString();

      res.json({
        success: true,
        data: {
          user: sanitizeUser(user),
          token,
          expiresAt: expiresAt.toISOString(),
        },
        message: 'Admin login successful',
      });
    } catch (error) {
      console.error('[Admin Login Error]', error);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  });

  // Register user
  // Register user
  app.post('/api/users', async (req, res) => {
    try {
      const { username, email, mobile, password, firstName, familyName, emirate, address, deliveryAddress } = req.body;

      if (!username || !email || !mobile || !password || !firstName || !familyName || !emirate) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      // Check username
      if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ success: false, error: 'Username must be at least 3 characters and contain only letters, numbers, and underscores' });
      }

      const normalizedMobile = mobile.replace(/\s/g, '');
      const userId = `user_${Date.now()}`;

      // Use database if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          // Check for existing username
          const existingUsername = await pgDb.select().from(usersTable)
            .where(eq(usersTable.username, username)).limit(1);
          if (existingUsername.length > 0) {
            return res.status(400).json({ success: false, error: 'Username already taken' });
          }

          // Check for existing email
          const existingEmail = await pgDb.select().from(usersTable)
            .where(eq(usersTable.email, email)).limit(1);
          if (existingEmail.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
          }

          // Check for existing mobile
          const existingMobile = await pgDb.select().from(usersTable)
            .where(eq(usersTable.mobile, normalizedMobile)).limit(1);
          if (existingMobile.length > 0) {
            return res.status(400).json({ success: false, error: 'Phone number already registered' });
          }

          // Insert new user into database
          await pgDb.insert(usersTable).values({
            id: userId,
            username,
            email: email.toLowerCase(),
            mobile: normalizedMobile,
            password,
            firstName,
            familyName,
            role: 'customer',
            isActive: true,
            isVerified: false,
            emirate,
            address,
            preferences: {
              language: 'en',
              currency: 'AED',
              emailNotifications: true,
              smsNotifications: true,
              marketingEmails: true,
            },
          });

          // Create default delivery address if provided
          if (deliveryAddress) {
            const addressId = `addr_${Date.now()}`;
            await pgDb.insert(addressesTable).values({
              id: addressId,
              userId: userId,
              label: deliveryAddress.label || 'Home',
              fullName: deliveryAddress.fullName || `${firstName} ${familyName}`,
              mobile: deliveryAddress.mobile || normalizedMobile,
              emirate: deliveryAddress.emirate || emirate,
              area: deliveryAddress.area || '',
              street: deliveryAddress.street || '',
              building: deliveryAddress.building || '',
              floor: deliveryAddress.floor || null,
              apartment: deliveryAddress.apartment || null,
              latitude: deliveryAddress.latitude || null,
              longitude: deliveryAddress.longitude || null,
              isDefault: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const newUser = {
            id: userId,
            username,
            email: email.toLowerCase(),
            mobile: normalizedMobile,
            password,
            firstName,
            familyName,
            role: 'customer',
            isActive: true,
            isVerified: false,
            emirate,
            address,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            preferences: {
              language: 'en',
              currency: 'AED',
              emailNotifications: true,
              smsNotifications: true,
              marketingEmails: true,
            },
          };

          return res.status(201).json({
            success: true,
            data: sanitizeUser(newUser as any),
            message: 'User registered successfully',
          });
        } catch (dbError: any) {
          console.error('[Register DB Error]', dbError);
          // Check for unique constraint violations
          if (dbError.message?.includes('unique') || dbError.code === '23505') {
            if (dbError.message?.includes('username')) {
              return res.status(400).json({ success: false, error: 'Username already taken' });
            }
            if (dbError.message?.includes('email')) {
              return res.status(400).json({ success: false, error: 'Email already registered' });
            }
            return res.status(400).json({ success: false, error: 'User already exists' });
          }
          return res.status(500).json({ success: false, error: 'Registration failed: Database error' });
        }
      } else {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
    } catch (error) {
      console.error('[Register Error]', error);
      res.status(500).json({ success: false, error: 'Registration failed' });
    }
  });

  // Products endpoint - DATABASE BACKED
  app.get('/api/products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { category, search, featured } = req.query;
      let result;
      try {
        result = await pgDb.select().from(productsTable);
        console.log('[Products] Fetched', result.length, 'products from DB');
      } catch (dbErr: any) {
        console.error('[Products DB Error]', dbErr.message, dbErr.code);
        return res.status(500).json({ success: false, error: 'Database query failed', details: dbErr.message });
      }

      // Filter by category
      if (category && category !== 'all') {
        result = result.filter(p => p.category.toLowerCase() === (category as string).toLowerCase());
      }

      // Search by name/description
      if (search) {
        const q = (search as string).toLowerCase();
        result = result.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.nameAr && p.nameAr.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      }

      // Filter by featured
      if (featured === 'true') {
        result = result.filter(p => p.isFeatured);
      }

      // Convert to API format with safe parsing
      const products = result.map(p => ({
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        sku: p.sku,
        price: parseFloat(String(p.price || '0')),
        costPrice: parseFloat(String(p.costPrice || '0')),
        discount: parseFloat(String(p.discount || '0')),
        category: p.category,
        description: p.description,
        descriptionAr: p.descriptionAr,
        image: p.image,
        unit: p.unit,
        minOrderQuantity: parseFloat(String(p.minOrderQuantity || '0.25')),
        maxOrderQuantity: parseFloat(String(p.maxOrderQuantity || '10')),
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        isPremium: p.isPremium,
        rating: parseFloat(String(p.rating || '0')),
        tags: p.tags || [],
        badges: p.badges || [],
        createdAt: p.createdAt ? (p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt)) : new Date().toISOString(),
        updatedAt: p.updatedAt ? (p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt)) : new Date().toISOString(),
      }));

      res.json({ success: true, data: products });
    } catch (error: any) {
      console.error('[Products Error]', error.message, error.stack);
      res.status(500).json({ success: false, error: 'Failed to fetch products', details: error.message });
    }
  });

  // Get product by ID - DATABASE BACKED
  app.get('/api/products/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(productsTable).where(eq(productsTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const p = result[0];
      const product = {
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        sku: p.sku,
        price: parseFloat(p.price),
        costPrice: parseFloat(p.costPrice),
        discount: parseFloat(p.discount || '0'),
        category: p.category,
        description: p.description,
        descriptionAr: p.descriptionAr,
        image: p.image,
        unit: p.unit,
        minOrderQuantity: parseFloat(p.minOrderQuantity),
        maxOrderQuantity: parseFloat(p.maxOrderQuantity),
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        isPremium: p.isPremium,
        rating: parseFloat(p.rating || '0'),
        tags: p.tags || [],
        badges: p.badges || [],
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };

      res.json({ success: true, data: product });
    } catch (error) {
      console.error('[Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
  });

  // Create product - DATABASE BACKED
  app.post('/api/products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const productId = `prod_${Date.now()}`;
      const now = new Date();

      const newProduct = {
        id: productId,
        name: req.body.name,
        nameAr: req.body.nameAr || null,
        sku: req.body.sku || `SKU-${Date.now()}`,
        barcode: req.body.barcode || null,
        price: String(req.body.price),
        costPrice: String(req.body.costPrice || req.body.price * 0.6),
        discount: String(req.body.discount || 0),
        category: req.body.category,
        description: req.body.description || null,
        descriptionAr: req.body.descriptionAr || null,
        image: req.body.image || '/photos/placeholder.svg',
        unit: req.body.unit || 'kg',
        minOrderQuantity: String(req.body.minOrderQuantity || 0.25),
        maxOrderQuantity: String(req.body.maxOrderQuantity || 10),
        isActive: req.body.isActive !== false,
        isFeatured: req.body.isFeatured || false,
        isPremium: req.body.isPremium || false,
        rating: String(req.body.rating || 0),
        tags: req.body.tags || [],
        badges: req.body.badges || [],
        createdAt: now,
        updatedAt: now,
      };

      await pgDb.insert(productsTable).values(newProduct);

      // Create stock item for new product
      const stockId = `stock_${productId}`;
      await pgDb.insert(stockTable).values({
        id: stockId,
        productId: productId,
        quantity: '0',
        reservedQuantity: '0',
        availableQuantity: '0',
        lowStockThreshold: 1000,
        reorderPoint: 2000,
        reorderQuantity: 5000,
        lastRestockedAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        success: true,
        data: {
          ...newProduct,
          price: parseFloat(newProduct.price),
          costPrice: parseFloat(newProduct.costPrice),
          discount: parseFloat(newProduct.discount),
          minOrderQuantity: parseFloat(newProduct.minOrderQuantity),
          maxOrderQuantity: parseFloat(newProduct.maxOrderQuantity),
          rating: parseFloat(newProduct.rating),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Create Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create product' });
    }
  });

  // Update product - DATABASE BACKED
  app.put('/api/products/:id', async (req, res) => {
    try {
      console.log('[Update Product] Received request for ID:', req.params.id);
      console.log('[Update Product] Request body:', JSON.stringify(req.body));
      
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const existing = await pgDb.select().from(productsTable).where(eq(productsTable.id, req.params.id));
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };

      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.nameAr !== undefined) updateData.nameAr = req.body.nameAr;
      if (req.body.sku !== undefined) updateData.sku = req.body.sku;
      if (req.body.barcode !== undefined) updateData.barcode = req.body.barcode;
      if (req.body.price !== undefined) updateData.price = String(req.body.price);
      if (req.body.costPrice !== undefined) updateData.costPrice = String(req.body.costPrice);
      if (req.body.discount !== undefined) updateData.discount = String(req.body.discount);
      if (req.body.rating !== undefined) updateData.rating = String(req.body.rating);
      if (req.body.badges !== undefined) updateData.badges = req.body.badges;
      if (req.body.category !== undefined) updateData.category = req.body.category;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.descriptionAr !== undefined) updateData.descriptionAr = req.body.descriptionAr;
      if (req.body.image !== undefined) updateData.image = req.body.image;
      if (req.body.unit !== undefined) updateData.unit = req.body.unit;
      if (req.body.minOrderQuantity !== undefined) updateData.minOrderQuantity = String(req.body.minOrderQuantity);
      if (req.body.maxOrderQuantity !== undefined) updateData.maxOrderQuantity = String(req.body.maxOrderQuantity);
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      if (req.body.isFeatured !== undefined) updateData.isFeatured = req.body.isFeatured;
      if (req.body.isPremium !== undefined) updateData.isPremium = req.body.isPremium;
      if (req.body.tags !== undefined) updateData.tags = req.body.tags;

      console.log('[Update Product] Update data to be applied:', JSON.stringify(updateData));
      
      await pgDb.update(productsTable).set(updateData).where(eq(productsTable.id, req.params.id));

      // Fetch updated product
      const updated = await pgDb.select().from(productsTable).where(eq(productsTable.id, req.params.id));
      const p = updated[0];

      res.json({
        success: true,
        data: {
          id: p.id,
          name: p.name,
          nameAr: p.nameAr,
          sku: p.sku,
          price: parseFloat(p.price),
          costPrice: parseFloat(p.costPrice),
          discount: parseFloat(p.discount || '0'),
          category: p.category,
          description: p.description,
          descriptionAr: p.descriptionAr,
          image: p.image,
          unit: p.unit,
          minOrderQuantity: parseFloat(p.minOrderQuantity),
          maxOrderQuantity: parseFloat(p.maxOrderQuantity),
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          isPremium: p.isPremium,
          rating: parseFloat(p.rating || '0'),
          tags: p.tags || [],
          badges: p.badges || [],
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Update Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update product' });
    }
  });

  // Delete product - DATABASE BACKED
  app.delete('/api/products/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const existing = await pgDb.select().from(productsTable).where(eq(productsTable.id, req.params.id));
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      // Delete stock first
      await pgDb.delete(stockTable).where(eq(stockTable.productId, req.params.id));
      // Delete product
      await pgDb.delete(productsTable).where(eq(productsTable.id, req.params.id));

      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      console.error('[Delete Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
  });

  // =====================================================
  // CATEGORIES API - DATABASE BACKED
  // =====================================================

  app.get('/api/categories', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const categories = await pgDb.select().from(productCategoriesTable).orderBy(productCategoriesTable.sortOrder);
      res.json({ success: true, data: categories });
    } catch (error) {
      console.error('[Get Categories Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
  });

  app.post('/api/categories', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { nameEn, nameAr, icon, color, sortOrder, isActive } = req.body;
      if (!nameEn || !nameAr) {
        return res.status(400).json({ success: false, error: 'Name in English and Arabic are required' });
      }

      const id = nameEn.toLowerCase().replace(/\s+/g, '-');
      await pgDb.insert(productCategoriesTable).values({
        id,
        nameEn,
        nameAr,
        icon: icon || '🥩',
        color: color || 'bg-red-100 text-red-600',
        sortOrder: sortOrder || 0,
        isActive: isActive !== undefined ? isActive : true,
      });
      
      const [newCategory] = await pgDb.select().from(productCategoriesTable).where(eq(productCategoriesTable.id, id));

      res.status(201).json({ success: true, data: newCategory, message: 'Category created successfully' });
    } catch (error) {
      console.error('[Create Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { nameEn, nameAr, icon, color, sortOrder, isActive } = req.body;
      await pgDb.update(productCategoriesTable)
        .set({
          nameEn,
          nameAr,
          icon,
          color,
          sortOrder,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(productCategoriesTable.id, req.params.id));
      const [updated] = await pgDb.select().from(productCategoriesTable).where(eq(productCategoriesTable.id, req.params.id));

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }

      res.json({ success: true, data: updated, message: 'Category updated successfully' });
    } catch (error) {
      console.error('[Update Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [toDelete] = await pgDb.select().from(productCategoriesTable).where(eq(productCategoriesTable.id, req.params.id));
      if (!toDelete) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }
      await pgDb.delete(productCategoriesTable)
        .where(eq(productCategoriesTable.id, req.params.id));

      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
      console.error('[Delete Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
  });

  // =====================================================
  // ANALYTICS / DASHBOARD API - DATABASE BACKED
  // =====================================================

  app.get('/api/analytics/dashboard', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Get all orders from database
      const allOrders = await pgDb.select().from(ordersTable);
      const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= todayStart);
      const weekOrders = allOrders.filter(o => new Date(o.createdAt) >= weekStart);
      const monthOrders = allOrders.filter(o => new Date(o.createdAt) >= monthStart);

      const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const weekRevenue = weekOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const monthRevenue = monthOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);

      const pendingOrders = allOrders.filter(o => o.status === 'pending').length;

      // Get customer count from database
      const allUsers = await pgDb.select().from(usersTable).where(eq(usersTable.role, 'customer'));
      const totalCustomers = allUsers.length;

      // Get products for name lookup
      const products = await pgDb.select().from(productsTable);
      const productMap = new Map(products.map(p => [p.id, p]));

      // Low stock items from database
      const stockData = await pgDb.select().from(stockTable);
      const lowStockItems = stockData
        .filter(s => parseFloat(s.availableQuantity) <= s.lowStockThreshold)
        .map(s => ({
          productId: s.productId,
          productName: productMap.get(s.productId)?.name || s.productId,
          currentQuantity: parseFloat(s.availableQuantity),
          threshold: s.lowStockThreshold,
          suggestedReorderQuantity: s.reorderQuantity,
        }));

      // Recent orders for dashboard
      const recentOrders = allOrders
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          itemCount: 0, // Would need to join order_items
          total: parseFloat(String(o.total)),
          status: o.status,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt.toISOString(),
        }));

      res.json({
        success: true,
        data: {
          todayRevenue,
          todayOrders: todayOrders.length,
          weekRevenue,
          weekOrders: weekOrders.length,
          monthRevenue,
          monthOrders: monthOrders.length,
          pendingOrders,
          totalCustomers,
          newCustomers: 3,
          averageOrderValue: monthOrders.length > 0 ? monthRevenue / monthOrders.length : 0,
          revenueChange: { daily: 12.5, weekly: 8.3, monthly: 15.2 },
          ordersChange: { daily: 5.0, weekly: 10.0, monthly: 20.0 },
          lowStockCount: lowStockItems.length,
          lowStockItems,
          recentOrders,
        },
      });
    } catch (error) {
      console.error('[Analytics Dashboard Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
    }
  });

  // Revenue chart for analytics - DATABASE BACKED
  app.get('/api/analytics/charts/revenue', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const period = (req.query.period as string) || 'week';
      const days = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;

      const allOrders = await pgDb.select().from(ordersTable);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const filteredOrders = allOrders.filter(o => new Date(o.createdAt) >= startDate);

      // Group by date
      const dateMap = new Map<string, { revenue: number; orders: number }>();
      for (let i = 0; i < Math.min(days, 14); i++) {
        const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateMap.set(date, { revenue: 0, orders: 0 });
      }

      filteredOrders.forEach(o => {
        const date = new Date(o.createdAt).toISOString().split('T')[0];
        const existing = dateMap.get(date);
        if (existing) {
          existing.revenue += parseFloat(String(o.total));
          existing.orders += 1;
        }
      });

      const data = Array.from(dateMap.entries()).map(([date, stats]) => ({
        date,
        revenue: Math.round(stats.revenue * 100) / 100,
        orders: stats.orders,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('[Revenue Chart Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch revenue data' });
    }
  });

  // Top products for analytics - DATABASE BACKED
  app.get('/api/analytics/charts/top-products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const products = await pgDb.select().from(productsTable).limit(10);
      const data = products.map((p, i) => ({
        productId: p.id,
        productName: p.name,
        sales: (5000 - i * 500) + Math.random() * 200, // TODO: Calculate from actual order items
        quantity: 50 - i * 5,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('[Top Products Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch top products' });
    }
  });

  // Orders by status chart - DATABASE BACKED
  app.get('/api/analytics/charts/orders-by-status', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const statusCounts: Record<string, number> = {};

      allOrders.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });

      const data = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: allOrders.length > 0 ? Math.round((count / allOrders.length) * 100) : 0,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('[Orders By Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch orders by status' });
    }
  });

  // Sales by emirate chart - DATABASE BACKED
  app.get('/api/analytics/charts/sales-by-emirate', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const emirateData: Record<string, { orders: number; revenue: number }> = {};

      allOrders.forEach(o => {
        const deliveryAddr = o.deliveryAddress as { emirate?: string } || {};
        const emirate = deliveryAddr.emirate || 'Unknown';
        if (!emirateData[emirate]) {
          emirateData[emirate] = { orders: 0, revenue: 0 };
        }
        emirateData[emirate].orders += 1;
        emirateData[emirate].revenue += parseFloat(String(o.total));
      });

      const data = Object.entries(emirateData).map(([emirate, stats]) => ({
        emirate,
        orders: stats.orders,
        revenue: Math.round(stats.revenue * 100) / 100,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('[Sales By Emirate Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales by emirate' });
    }
  });

  // Payment methods breakdown - DATABASE BACKED
  app.get('/api/analytics/charts/payment-methods', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const methodData: Record<string, { count: number; amount: number }> = {};

      allOrders.forEach(o => {
        const method = o.paymentMethod || 'unknown';
        if (!methodData[method]) {
          methodData[method] = { count: 0, amount: 0 };
        }
        methodData[method].count += 1;
        methodData[method].amount += parseFloat(String(o.total));
      });

      const data = Object.entries(methodData).map(([method, stats]) => ({
        method,
        count: stats.count,
        amount: Math.round(stats.amount * 100) / 100,
        percentage: allOrders.length > 0 ? Math.round((stats.count / allOrders.length) * 100) : 0,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('[Payment Methods Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment methods' });
    }
  });

  // Hourly orders chart - DATABASE BACKED
  app.get('/api/analytics/charts/hourly-orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Get today's orders
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const allOrders = await pgDb.select().from(ordersTable);
      const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= todayStart);

      // Group orders by hour
      const hourlyData = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));

      todayOrders.forEach(order => {
        const orderHour = new Date(order.createdAt).getHours();
        hourlyData[orderHour].orders += 1;
        hourlyData[orderHour].revenue += parseFloat(String(order.total));
      });

      // Round revenue to 2 decimal places
      const data = hourlyData.map(h => ({
        hour: h.hour,
        orders: h.orders,
        revenue: Math.round(h.revenue * 100) / 100,
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('[Hourly Orders Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch hourly orders' });
    }
  });

  // Real-time stats
  app.get('/api/analytics/real-time', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const last30Min = new Date(Date.now() - 30 * 60 * 1000);
      const recentOrders = allOrders.filter(o => new Date(o.createdAt) >= last30Min);
      const allUsers = await pgDb.select().from(usersTable);

      res.json({
        success: true,
        data: {
          activeOrders: allOrders.filter(o => ['pending', 'confirmed', 'processing', 'out_for_delivery'].includes(o.status)).length,
          ordersLast30Min: recentOrders.length,
          revenueLast30Min: recentOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0),
          activeDrivers: allUsers.filter(u => u.role === 'delivery' && u.isActive).length,
          pendingDeliveries: allOrders.filter(o => o.status === 'out_for_delivery').length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Real-time Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch real-time stats' });
    }
  });

  // =====================================================
  // ORDERS API - DATABASE BACKED
  // =====================================================

  app.get('/api/orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // --- AUTHENTICATION & AUTHORIZATION ---
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, error: 'Authorization token missing' });
      }

      let currentUser: any = null;
      // Try database for session
      if (isDatabaseAvailable() && pgDb) {
        try {
          const sessionResults = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token));
          if (sessionResults.length > 0) {
            const session = sessionResults[0];
            if (new Date(session.expiresAt) > new Date()) {
              const userResults = await pgDb.select().from(usersTable).where(eq(usersTable.id, session.userId));
              if (userResults.length > 0) {
                currentUser = userResults[0];
              }
            }
          }
        } catch (dbError) {
          console.error('[Orders Auth DB Error]', dbError);
        }
      }

      // Fallback to in-memory session
      if (!currentUser) {
        const memSession = sessions.get(token);
        if (memSession && new Date(memSession.expiresAt) > new Date()) {
          currentUser = users.get(memSession.userId);
        }
      }

      if (!currentUser) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session' });
      }

      // --- FILTERING ---
      let userIdFilter = req.query.userId as string;
      const statusFilter = req.query.status as string;

      // SECURITY: If not admin, FORCE filter to current user's ID
      if (currentUser.role !== 'admin') {
        userIdFilter = currentUser.id;
      }

      // Build the query conditions
      const conditions = [];
      if (userIdFilter) {
        conditions.push(eq(ordersTable.userId, userIdFilter));
      }
      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(ordersTable.status, statusFilter as any));
      }

      // Fetch orders
      let allOrdersRaw;
      if (conditions.length > 0) {
        allOrdersRaw = await pgDb.select().from(ordersTable).where(and(...conditions));
      } else {
        allOrdersRaw = await pgDb.select().from(ordersTable);
      }

      // Fetch order items (only for the retrieved orders to improve performance and security)
      let orderItems: any[] = [];
      if (allOrdersRaw.length > 0) {
        const orderIds = allOrdersRaw.map(o => o.id);
        const chunkSize = 100;
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize);
          const chunkItems = await pgDb.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, chunk));
          orderItems = [...orderItems, ...chunkItems];
        }
      }

      let allOrders = allOrdersRaw;

      // Sort by date (newest first)
      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Build order items map
      const orderItemsMap = new Map<string, any[]>();
      orderItems.forEach(item => {
        if (!orderItemsMap.has(item.orderId)) {
          orderItemsMap.set(item.orderId, []);
        }
        orderItemsMap.get(item.orderId)!.push(item);
      });

      const formattedOrders = allOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerMobile: o.customerMobile,
        items: (orderItemsMap.get(o.id) || []).map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productNameAr: item.productNameAr,
          quantity: parseFloat(String(item.quantity)),
          unitPrice: parseFloat(String(item.unitPrice)),
          totalPrice: parseFloat(String(item.totalPrice)),
          price: parseFloat(String(item.unitPrice)), // Alias for compatibility
          name: item.productName, // Alias for compatibility
        })),
        subtotal: parseFloat(String(o.subtotal)),
        discount: parseFloat(String(o.discount)),
        deliveryFee: parseFloat(String(o.deliveryFee)),
        vatRate: parseFloat(String(o.vatRate)),
        vat: parseFloat(String(o.vatAmount)), // Alias for compatibility
        vatAmount: parseFloat(String(o.vatAmount)),
        total: parseFloat(String(o.total)),
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        deliveryAddress: o.deliveryAddress || {},
        deliveryNotes: o.deliveryNotes,
        statusHistory: o.statusHistory || [],
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      }));

      res.json({ success: true, data: formattedOrders });
    } catch (error) {
      console.error('[Orders Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders/stats', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // --- ADMIN ONLY ---
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

      let currentUser: any = null;
      const sessionResults = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token));
      if (sessionResults.length > 0) {
        const session = sessionResults[0];
        if (new Date(session.expiresAt) > new Date()) {
          const userResults = await pgDb.select().from(usersTable).where(eq(usersTable.id, session.userId));
          if (userResults.length > 0) currentUser = userResults[0];
        }
      }
      
      if (!currentUser) {
        const memSession = sessions.get(token);
        if (memSession && new Date(memSession.expiresAt) > new Date()) {
          currentUser = users.get(memSession.userId);
        }
      }

      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= todayStart);

      res.json({
        success: true,
        data: {
          total: allOrders.length,
          pending: allOrders.filter(o => o.status === 'pending').length,
          confirmed: allOrders.filter(o => o.status === 'confirmed').length,
          processing: allOrders.filter(o => o.status === 'processing').length,
          outForDelivery: allOrders.filter(o => o.status === 'out_for_delivery').length,
          delivered: allOrders.filter(o => o.status === 'delivered').length,
          cancelled: allOrders.filter(o => o.status === 'cancelled').length,
          todayOrders: todayOrders.length,
          todayRevenue: todayOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0),
        },
      });
    } catch (error) {
      console.error('[Orders Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch orders stats' });
    }
  });

  app.get('/api/orders/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // --- AUTH CHECK ---
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

      let currentUser: any = null;
      const sessionResults = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token));
      if (sessionResults.length > 0) {
        const session = sessionResults[0];
        if (new Date(session.expiresAt) > new Date()) {
          const userResults = await pgDb.select().from(usersTable).where(eq(usersTable.id, session.userId));
          if (userResults.length > 0) currentUser = userResults[0];
        }
      }
      
      if (!currentUser) {
        const memSession = sessions.get(token);
        if (memSession && new Date(memSession.expiresAt) > new Date()) {
          currentUser = users.get(memSession.userId);
        }
      }

      const result = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const o = result[0];

      // SECURITY: If not admin, check if the order belongs to the user
      if (currentUser?.role !== 'admin' && o.userId !== currentUser?.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const orderItems = await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));

      const formattedOrder = {
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerMobile: o.customerMobile,
        items: orderItems.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productNameAr: item.productNameAr,
          quantity: parseFloat(String(item.quantity)),
          unitPrice: parseFloat(String(item.unitPrice)),
          totalPrice: parseFloat(String(item.totalPrice)),
          price: parseFloat(String(item.unitPrice)),
          name: item.productName,
        })),
        subtotal: parseFloat(String(o.subtotal)),
        discount: parseFloat(String(o.discount)),
        deliveryFee: parseFloat(String(o.deliveryFee)),
        vatRate: parseFloat(String(o.vatRate)),
        vat: parseFloat(String(o.vatAmount)),
        vatAmount: parseFloat(String(o.vatAmount)),
        total: parseFloat(String(o.total)),
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        deliveryAddress: o.deliveryAddress || {},
        deliveryNotes: o.deliveryNotes,
        statusHistory: o.statusHistory || [],
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      };

      res.json({ success: true, data: formattedOrder });
    } catch (error) {
      console.error('[Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
  });

  // Create new order - DATABASE BACKED
  app.post('/api/orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const {
        userId,
        items,
        addressId: providedAddressId,
        deliveryAddress: providedAddress,
        paymentMethod,
        deliveryNotes,
        discountCode,
        discountAmount: providedDiscountAmount,
        deliveryFee: providedDeliveryFee,
        isExpressDelivery: providedIsExpressDelivery,
        driverTip: providedDriverTip,
        subtotal: providedSubtotal,
        vatAmount: providedVatAmount,
        total: providedTotal,
      } = req.body;

      if (!userId || !items || !items.length || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, items, paymentMethod'
        });
      }

      // Get user from database
      const userResult = await pgDb.select().from(usersTable).where(eq(usersTable.id, userId));
      let user = userResult[0];

      if (!user && !providedAddress) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Get products from database for product names and SKUs
      const products = await pgDb.select().from(productsTable);
      const productMap = new Map(products.map(p => [p.id, p]));

      // Calculate order items - use prices sent from checkout if available
      const orderItemsData: Array<{
        id: string;
        productId: string;
        productName: string;
        productNameAr: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }> = [];
      let calculatedSubtotal = 0;

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          return res.status(404).json({ success: false, error: `Product ${item.productId} not found` });
        }

        // Use price from checkout if provided, otherwise fall back to database price
        const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : parseFloat(product.price);
        const totalPrice = unitPrice * item.quantity;

        orderItemsData.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          productNameAr: product.nameAr || product.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
        calculatedSubtotal += totalPrice;
      }

      // INVENTORY CYCLE: Validate stock availability before creating order (IAS 2 compliance)
      const stockValidation = await validateStockAvailability(
        items.map((item: { productId: string; quantity: number }) => ({
          productId: item.productId,
          quantity: item.quantity,
          productName: productMap.get(item.productId)?.name,
        })),
        pgDb
      );

      if (!stockValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient stock',
          insufficientItems: stockValidation.insufficientItems,
          message: `The following items have insufficient stock: ${stockValidation.insufficientItems
            ?.map(i => `${i.productName} (requested: ${i.requested}, available: ${i.available})`)
            .join(', ')}`,
        });
      }

      // Use provided values from checkout or calculate
      const discount = Number(providedDiscountAmount) || 0;
      const driverTip = Number(providedDriverTip) || 0;
      const isExpressDelivery = Boolean(providedIsExpressDelivery);

      // Use subtotal from checkout if provided (which already has discounts on item prices)
      // Otherwise use calculated subtotal
      const subtotal = providedSubtotal !== undefined ? Number(providedSubtotal) : calculatedSubtotal;

      // Use delivery fee from checkout if provided, otherwise use standard calculation
      const standardDeliveryFee = subtotal > 200 ? 0 : 15;
      const deliveryFee = providedDeliveryFee !== undefined ? Number(providedDeliveryFee) : standardDeliveryFee;

      const vatRate = 0.05;
      // Use VAT from checkout if provided
      const vatAmount = providedVatAmount !== undefined ? Number(providedVatAmount) : (subtotal * vatRate);

      // Use total from checkout if provided
      const total = providedTotal !== undefined ? Number(providedTotal) : (subtotal + deliveryFee + vatAmount + driverTip);

      // Generate order number and ID
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const orderId = `order_${Date.now()}`;
      const now = new Date();

      // Get delivery address info
      const address = providedAddress || {};
      const addressId = providedAddressId || address.id || `addr_${Date.now()}`;
      const customerName = user ? `${user.firstName} ${user.familyName}` : (address.fullName || 'Customer');

      // Insert order into database - uses delivery_address as JSONB
      const newOrderData = {
        id: orderId,
        orderNumber,
        userId,
        customerName,
        customerEmail: user?.email || '',
        customerMobile: user?.mobile || address.mobile || '',
        subtotal: String(subtotal),
        discount: String(discount),
        discountCode: discountCode || null,
        deliveryFee: String(deliveryFee),
        vatRate: String(vatRate),
        vatAmount: String(vatAmount),
        total: String(total),
        status: 'pending' as const,
        paymentStatus: (paymentMethod === 'cod' ? 'pending' : 'captured') as any,
        paymentMethod: paymentMethod as 'cod' | 'card' | 'bank_transfer',
        addressId,
        deliveryAddress: {
          building: address.building || '',
          street: address.street || '',
          area: address.area || '',
          emirate: address.emirate || '',
          landmark: address.landmark || null,
          latitude: address.latitude || null,
          longitude: address.longitude || null,
        },
        deliveryNotes: deliveryNotes || null,
        statusHistory: [{
          status: 'pending',
          changedAt: now.toISOString(),
          changedBy: 'customer',
        }],
        source: 'web',
        createdAt: now,
        updatedAt: now,
      };

      await pgDb.insert(ordersTable).values(newOrderData);

      // Insert order items (sku is required in the DB schema)
      for (const item of orderItemsData) {
        const prod = productMap.get(item.productId);
        await pgDb.insert(orderItemsTable).values({
          id: item.id,
          orderId,
          productId: item.productId,
          productName: item.productName,
          productNameAr: item.productNameAr,
          sku: prod?.sku || `SKU-${item.productId}`,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          totalPrice: String(item.totalPrice),
        });
      }

      // INVENTORY CYCLE: Reserve stock for order (IAS 2 compliance)
      await reserveStockForOrder(
        orderId,
        orderNumber,
        items.map((item: { productId: string; quantity: number }) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        pgDb
      );

      // Create payment record
      const paymentId = `pay_${Date.now()}`;
      await pgDb.insert(paymentsTable).values({
        id: paymentId,
        orderId,
        orderNumber,
        amount: String(total),
        currency: 'AED',
        method: paymentMethod as 'cod' | 'card' | 'bank_transfer',
        status: (paymentMethod === 'cod' ? 'pending' : 'captured') as any,
        gatewayTransactionId: paymentMethod === 'cod' ? null : `TXN-${Date.now()}`,
        refundedAmount: '0',
        createdAt: now,
        updatedAt: now,
      });

      // Format response
      const responseOrder = {
        id: orderId,
        orderNumber,
        userId,
        customerName,
        customerMobile: user?.mobile || address.mobile || '',
        items: orderItemsData.map(item => ({
          ...item,
          productNameAr: item.productNameAr,
        })),
        subtotal,
        discount,
        discountCode: discountCode || null,
        deliveryFee,
        isExpressDelivery,
        driverTip,
        vatRate,
        vatAmount,
        total,
        status: 'pending',
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        paymentMethod,
        deliveryAddress: {
          building: address.building || '',
          street: address.street || '',
          area: address.area || '',
          emirate: address.emirate || '',
          landmark: address.landmark || '',
          latitude: address.latitude || null,
          longitude: address.longitude || null,
        },
        deliveryNotes,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      res.status(201).json({
        success: true,
        data: responseOrder,
        message: 'Order created successfully',
      });

      // Create notification for the user (async, don't wait)
      try {
        await pgDb.insert(inAppNotificationsTable).values({
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: String(userId),
          type: 'order_placed',
          title: 'Order Placed Successfully',
          titleAr: 'تم تقديم الطلب بنجاح',
          message: `Your order #${orderNumber} has been placed and is being processing.`,
          messageAr: `تم تقديم طلبك #${orderNumber} وجاري معالجته.`,
          link: `/orders`,
          linkTab: 'orders',
          linkId: orderId,
          unread: true,
        });
      } catch (notifError) {
        console.error('[User Order Notification Error]', notifError);
      }

      // Create notification for admin about new order
      try {
        await pgDb.insert(inAppNotificationsTable).values({
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_admin`,
          userId: 'admin',
          type: 'order',
          title: 'New Order Received',
          titleAr: 'طلب جديد',
          message: `New order #${orderNumber} from ${customerName}. Total: AED ${total.toFixed(2)}`,
          messageAr: `طلب جديد #${orderNumber} من ${customerName}. المجموع: ${total.toFixed(2)} درهم`,
          link: `/admin/dashboard`,
          linkTab: 'orders',
          linkId: orderId,
          unread: true,
        });
      } catch (notifError) {
        console.error('[Admin Order Notification Error]', notifError);
      }
    } catch (error) {
      console.error('[Create Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create order' });
    }
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // --- ADMIN ONLY ---
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

      let currentUser: any = null;
      const sessionResults = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token));
      if (sessionResults.length > 0) {
        const session = sessionResults[0];
        if (new Date(session.expiresAt) > new Date()) {
          const userResults = await pgDb.select().from(usersTable).where(eq(usersTable.id, session.userId));
          if (userResults.length > 0) currentUser = userResults[0];
        }
      }
      
      if (!currentUser) {
        const memSession = sessions.get(token);
        if (memSession && new Date(memSession.expiresAt) > new Date()) {
          currentUser = users.get(memSession.userId);
        }
      }

      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required for status updates' });
      }

      const result = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const { status, notes } = req.body;
      const changedBy = currentUser.username;
      const now = new Date();
      const order = result[0];
      const previousStatus = order.status;

      console.log(`[Order Update] Updating order ${req.params.id} from ${previousStatus} to ${status} by ${changedBy}`);

      const currentHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
      const newHistory = [...currentHistory, {
        status,
        changedAt: now.toISOString(),
        changedBy,
        notes: notes || `Status updated from ${previousStatus} to ${status}`
      }];

      await pgDb.update(ordersTable)
        .set({
          status: status as any,
          statusHistory: newHistory,
          updatedAt: now
        })
        .where(eq(ordersTable.id, req.params.id));

      // INVENTORY CYCLE: Handle stock movements based on status change (IAS 2 compliance)
      // FINANCE CYCLE: Create transactions for revenue recognition (IFRS 15 compliance)
      if (status === 'delivered' && previousStatus !== 'delivered') {
        // When order is delivered, confirm stock reduction (move from reserved to sold)
        await confirmStockForDeliveredOrder(req.params.id, order.orderNumber, pgDb);
        console.log(`[Inventory Cycle] Confirmed stock reduction for delivered order ${req.params.id}`);

        // Create sale transaction for revenue recognition
        const total = parseFloat(order.total);
        const vatAmount = parseFloat(order.vatAmount);
        await createSaleTransaction(
          req.params.id,
          order.orderNumber,
          total,
          vatAmount,
          order.paymentMethod || 'cod',
          order.userId || 'guest',
          'admin',
          pgDb
        );
      } else if (status === 'cancelled' && previousStatus !== 'cancelled') {
        // When order is cancelled, release reserved stock back to available
        await releaseStockForCancelledOrder(req.params.id, order.orderNumber, pgDb);
        console.log(`[Inventory Cycle] Released reserved stock for cancelled order ${req.params.id}`);
      } else if (status === 'refunded' && previousStatus !== 'refunded') {
        // Create refund transaction
        const total = parseFloat(order.total);
        await createRefundTransaction(
          req.params.id,
          order.orderNumber,
          total,
          'Order refunded by admin',
          'admin',
          pgDb
        );
        // If refunded before delivery, also release the reserved stock
        if (previousStatus !== 'delivered') {
          await releaseStockForCancelledOrder(req.params.id, order.orderNumber, pgDb);
          console.log(`[Inventory Cycle] Released reserved stock for refunded order ${req.params.id}`);
        }
      }

      // Fetch updated order with items
      const updatedArr = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      const updatedOrder = updatedArr[0];

      const updatedItems = await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, req.params.id));

      const formattedOrder = {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        userId: updatedOrder.userId,
        customerName: updatedOrder.customerName,
        customerEmail: updatedOrder.customerEmail,
        customerMobile: updatedOrder.customerMobile,
        items: updatedItems.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productNameAr: item.productNameAr,
          quantity: parseFloat(String(item.quantity)),
          unitPrice: parseFloat(String(item.unitPrice)),
          totalPrice: parseFloat(String(item.totalPrice)),
          price: parseFloat(String(item.unitPrice)),
          name: item.productName,
        })),
        subtotal: parseFloat(String(updatedOrder.subtotal)),
        discount: parseFloat(String(updatedOrder.discount)),
        deliveryFee: parseFloat(String(updatedOrder.deliveryFee)),
        vatAmount: parseFloat(String(updatedOrder.vatAmount)),
        vatRate: parseFloat(String(updatedOrder.vatRate)),
        total: parseFloat(String(updatedOrder.total)),
        status: updatedOrder.status as any,
        paymentStatus: updatedOrder.paymentStatus as any,
        paymentMethod: updatedOrder.paymentMethod as any,
        addressId: updatedOrder.addressId,
        deliveryAddress: updatedOrder.deliveryAddress,
        deliveryNotes: updatedOrder.deliveryNotes,
        deliveryZoneId: updatedOrder.deliveryZoneId,
        estimatedDeliveryAt: updatedOrder.estimatedDeliveryAt?.toISOString(),
        actualDeliveryAt: updatedOrder.actualDeliveryAt?.toISOString(),
        statusHistory: updatedOrder.statusHistory,
        source: updatedOrder.source,
        ipAddress: updatedOrder.ipAddress,
        userAgent: updatedOrder.userAgent,
        createdAt: updatedOrder.createdAt.toISOString(),
        updatedAt: updatedOrder.updatedAt.toISOString(),
      };

      // Trigger invoice if confirmed
      if (status === 'confirmed') {
        try {
          // We can use the existing invoice logic if available, or just log
          console.log(`[Invoice] Triggering invoice for order ${updatedOrder.orderNumber}`);
          const invoiceNumber = `INV-${Date.now()}`;
          const invoiceText = `Order confirmed. Invoice #${invoiceNumber} generated for ${formattedOrder.total} AED.`;

          await pgDb.insert(inAppNotificationsTable).values({
            id: `notif_inv_${Date.now()}`,
            userId: String(updatedOrder.userId),
            type: 'payment',
            title: `📄 TAX Invoice #${invoiceNumber}`,
            titleAr: `📄 فاتورة ضريبية #${invoiceNumber}`,
            message: invoiceText,
            messageAr: `تمت عملية الدفع بنجاح. فاتورة رقم #${invoiceNumber} بمبلغ ${formattedOrder.total} درهم.`,
            link: '/orders',
            linkId: updatedOrder.id,
            unread: true,
            createdAt: now
          });
        } catch (invErr) {
          console.error('[Invoice Error]', invErr);
        }
      }

      res.json({ success: true, data: formattedOrder });

      // Create notification for order status change (async, don't wait)
      try {
        const statusMessages: Record<string, { en: string; ar: string; titleEn: string; titleAr: string }> = {
          confirmed: {
            en: 'Your order has been confirmed',
            ar: 'تم تأكيد طلبك',
            titleEn: 'Order Confirmed',
            titleAr: 'تم تأكيد الطلب'
          },
          processing: {
            en: 'Your order is being prepared',
            ar: 'جاري تحضير طلبك',
            titleEn: 'Order Processing',
            titleAr: 'جاري تحضير الطلب'
          },
          ready_for_pickup: {
            en: 'Your order is ready for pickup/delivery',
            ar: 'طلبك جاهز للاستلام/التوصيل',
            titleEn: 'Order Ready',
            titleAr: 'الطلب جاهز'
          },
          out_for_delivery: {
            en: 'Your order is on its way',
            ar: 'طلبك في الطريق إليك',
            titleEn: 'Out for Delivery',
            titleAr: 'في الطريق للتوصيل'
          },
          delivered: {
            en: 'Your order has been delivered',
            ar: 'تم توصيل طلبك',
            titleEn: 'Order Delivered',
            titleAr: 'تم التوصيل'
          },
          cancelled: {
            en: 'Your order has been cancelled',
            ar: 'تم إلغاء طلبك',
            titleEn: 'Order Cancelled',
            titleAr: 'تم إلغاء الطلب'
          },
          refunded: {
            en: 'Your order has been refunded',
            ar: 'تم استرداد مبلغ طلبك',
            titleEn: 'Order Refunded',
            titleAr: 'تم الاسترداد'
          },
        };

        const statusMsg = statusMessages[status];
        if (statusMsg && order.userId) {
          await pgDb.insert(inAppNotificationsTable).values({
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: String(order.userId),
            type: `order_${status}`,
            title: statusMsg.titleEn,
            titleAr: statusMsg.titleAr,
            message: `${statusMsg.en}. Order #${order.orderNumber}`,
            messageAr: `${statusMsg.ar}. طلب #${order.orderNumber}`,
            link: `/orders`,
            linkTab: 'orders',
            linkId: order.id,
            unread: true,
          });
          console.log(`[Order Status Notification] Created notification for user ${order.userId} - status: ${status}`);
        } else {
          console.log(`[Order Status Notification] Skipped - statusMsg: ${!!statusMsg}, userId: ${order.userId}, status: ${status}`);
        }
      } catch (notifError) {
        console.error('[Order Status Notification Error]', notifError);
      }
    } catch (error) {
      console.error('[Update Order Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
  });

  // Update payment status (for COD confirmation) - DATABASE BACKED
  app.post('/api/orders/:id/payment', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { status } = req.body;

      // Validate payment status
      const validStatuses = ['pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid payment status' });
      }

      const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, id));
      if (orderResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const order = orderResult[0];
      const now = new Date();

      // Update order payment status and history
      const changedBy = req.headers['x-user-id'] as string || 'admin';
      const newHistory = [...(order.statusHistory as any[] || []), {
        status: order.status,
        changedAt: now.toISOString(),
        changedBy,
        notes: `Payment status updated to ${status}`
      }];

      await pgDb.update(ordersTable)
        .set({
          paymentStatus: status as any,
          statusHistory: newHistory,
          updatedAt: now
        })
        .where(eq(ordersTable.id, id));

      // If payment is captured, also update the payments table
      if (status === 'captured') {
        // Check if payment record exists for this order
        const existingPayment = await pgDb.select().from(paymentsTable).where(eq(paymentsTable.orderId, id));

        if (existingPayment.length > 0) {
          // Update existing payment
          await pgDb.update(paymentsTable)
            .set({
              status: 'captured',
              updatedAt: now,
            })
            .where(eq(paymentsTable.orderId, id));
        } else {
          // Create new payment record for COD/Manual
          try {
            await pgDb.insert(paymentsTable).values({
              id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              orderId: id,
              orderNumber: order.orderNumber,
              amount: String(order.total),
              currency: 'AED',
              method: (order.paymentMethod as any) || 'cod',
              status: 'captured',
              createdAt: now,
              updatedAt: now,
            });
          } catch (insertError) {
            console.error('[Payment Insert Error]', insertError);
          }
        }

        console.log(`[Payment Confirmed] Order ${order.orderNumber} payment marked as captured`);
      }

      // Fetch updated order
      const updated = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, id));
      const orderItems = await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));

      const formattedOrder = {
        id: updated[0].id,
        orderNumber: updated[0].orderNumber,
        userId: updated[0].userId,
        customerName: updated[0].customerName,
        items: orderItems.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: parseFloat(String(item.quantity)),
          unitPrice: parseFloat(String(item.unitPrice)),
          totalPrice: parseFloat(String(item.totalPrice)),
        })),
        subtotal: parseFloat(String(updated[0].subtotal)),
        discount: parseFloat(String(updated[0].discount)),
        deliveryFee: parseFloat(String(updated[0].deliveryFee)),
        vat: parseFloat(String(updated[0].vatAmount)),
        total: parseFloat(String(updated[0].total)),
        status: updated[0].status,
        paymentStatus: updated[0].paymentStatus,
        paymentMethod: updated[0].paymentMethod,
        createdAt: updated[0].createdAt.toISOString(),
        updatedAt: updated[0].updatedAt.toISOString(),
      };

      res.json({
        success: true,
        data: formattedOrder,
        message: `Payment status updated to ${status}`
      });
    } catch (error) {
      console.error('[Update Payment Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update payment status' });
    }
  });

  // Get order by order number - DATABASE BACKED
  app.get('/api/orders/number/:orderNumber', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // --- AUTH CHECK ---
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

      let currentUser: any = null;
      const sessionResults = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token));
      if (sessionResults.length > 0) {
        const session = sessionResults[0];
        if (new Date(session.expiresAt) > new Date()) {
          const userResults = await pgDb.select().from(usersTable).where(eq(usersTable.id, session.userId));
          if (userResults.length > 0) currentUser = userResults[0];
        }
      }
      
      if (!currentUser) {
        const memSession = sessions.get(token);
        if (memSession && new Date(memSession.expiresAt) > new Date()) {
          currentUser = users.get(memSession.userId);
        }
      }

      const result = await pgDb.select().from(ordersTable).where(eq(ordersTable.orderNumber, req.params.orderNumber));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const o = result[0];

      // SECURITY: If not admin, check if the order belongs to the user
      if (currentUser?.role !== 'admin' && o.userId !== currentUser?.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const orderItems = await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));

      const formattedOrder = {
        id: o.id,
        orderNumber: o.orderNumber,
        userId: o.userId,
        customerName: o.customerName,
        items: orderItems.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productNameAr: item.productNameAr,
          quantity: parseFloat(String(item.quantity)),
          unitPrice: parseFloat(String(item.unitPrice)),
          totalPrice: parseFloat(String(item.totalPrice)),
          price: parseFloat(String(item.unitPrice)),
          name: item.productName,
        })),
        subtotal: parseFloat(String(o.subtotal)),
        discount: parseFloat(String(o.discount)),
        deliveryFee: parseFloat(String(o.deliveryFee)),
        vatRate: parseFloat(String(o.vatRate)),
        vat: parseFloat(String(o.vatAmount)),
        vatAmount: parseFloat(String(o.vatAmount)),
        total: parseFloat(String(o.total)),
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        deliveryAddress: o.deliveryAddress || {},
        deliveryNotes: o.deliveryNotes,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      };

      res.json({ success: true, data: formattedOrder });
    } catch (error) {
      console.error('[Order By Number Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
  });

  // Delete/Cancel order
  app.delete('/api/orders/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // --- AUTH CHECK ---
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

      let currentUser: any = null;
      const sessionResults = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token));
      if (sessionResults.length > 0) {
        const session = sessionResults[0];
        if (new Date(session.expiresAt) > new Date()) {
          const userResults = await pgDb.select().from(usersTable).where(eq(usersTable.id, session.userId));
          if (userResults.length > 0) currentUser = userResults[0];
        }
      }
      
      if (!currentUser) {
        const memSession = sessions.get(token);
        if (memSession && new Date(memSession.expiresAt) > new Date()) {
          currentUser = users.get(memSession.userId);
        }
      }

      const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      if (orderResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const order = orderResult[0];

      // SECURITY: Only owner or admin can cancel
      if (currentUser?.role !== 'admin' && order.userId !== currentUser?.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      if (['delivered', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ success: false, error: 'Cannot delete delivered or already cancelled orders' });
      }

      const newHistory = [...(order.statusHistory as any[] || []), {
        status: 'cancelled',
        changedAt: new Date().toISOString(),
        changedBy: currentUser?.username || 'user',
      }];

      await pgDb.update(ordersTable)
        .set({ status: 'cancelled', statusHistory: newHistory, updatedAt: new Date() })
        .where(eq(ordersTable.id, req.params.id));
      const [updated] = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));

      res.json({ success: true, data: updated, message: 'Order cancelled successfully' });
    } catch (error) {
      console.error('[Cancel Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to cancel order' });
    }
  });

  // =====================================================
  // STOCK / INVENTORY API - DATABASE BACKED
  // =====================================================

  app.get('/api/stock', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const stockData = await pgDb.select().from(stockTable);
      const formattedStock = stockData.map(s => ({
        id: s.id,
        productId: s.productId,
        quantity: parseFloat(s.quantity),
        reservedQuantity: parseFloat(s.reservedQuantity),
        availableQuantity: parseFloat(s.availableQuantity),
        lowStockThreshold: s.lowStockThreshold,
        reorderPoint: s.reorderPoint,
        reorderQuantity: s.reorderQuantity,
        lastRestockedAt: s.lastRestockedAt?.toISOString() || null,
        updatedAt: s.updatedAt.toISOString(),
      }));

      res.json({ success: true, data: formattedStock });
    } catch (error) {
      console.error('[Stock Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock' });
    }
  });

  // Get stock for specific product - DATABASE BACKED
  app.get('/api/stock/:productId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(stockTable).where(eq(stockTable.productId, req.params.productId));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock item not found' });
      }

      const s = result[0];
      const formattedStock = {
        id: s.id,
        productId: s.productId,
        quantity: parseFloat(s.quantity),
        reservedQuantity: parseFloat(s.reservedQuantity),
        availableQuantity: parseFloat(s.availableQuantity),
        lowStockThreshold: s.lowStockThreshold,
        reorderPoint: s.reorderPoint,
        reorderQuantity: s.reorderQuantity,
        lastRestockedAt: s.lastRestockedAt?.toISOString() || null,
        updatedAt: s.updatedAt.toISOString(),
      };

      res.json({ success: true, data: formattedStock });
    } catch (error) {
      console.error('[Stock Item Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock item' });
    }
  });

  app.get('/api/stock/alerts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const stockData = await pgDb.select().from(stockTable);
      const products = await pgDb.select().from(productsTable);
      const productMap = new Map(products.map(p => [p.id, p]));

      const alerts = stockData
        .filter(s => parseFloat(s.availableQuantity) <= s.lowStockThreshold)
        .map(s => ({
          productId: s.productId,
          productName: productMap.get(s.productId)?.name || s.productId,
          currentQuantity: parseFloat(s.availableQuantity),
          threshold: s.lowStockThreshold,
          suggestedReorderQuantity: s.reorderQuantity,
        }));

      res.json({ success: true, data: alerts });
    } catch (error) {
      console.error('[Stock Alerts Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock alerts' });
    }
  });

  app.get('/api/stock/movements', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const movements = await pgDb.select().from(stockMovementsTable).limit(limit);

      const formattedMovements = movements.map(m => ({
        id: m.id,
        productId: m.productId,
        type: m.type,
        quantity: parseFloat(m.quantity),
        reason: m.reason,
        createdAt: m.createdAt.toISOString(),
      }));

      res.json({ success: true, data: formattedMovements });
    } catch (error) {
      console.error('[Stock Movements Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock movements' });
    }
  });

  // INVENTORY VALUATION: Get inventory valuation report using Weighted Average Cost (IAS 2 compliance)
  app.get('/api/stock/valuation', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Get all stock items with product information
      const stockItems = await pgDb.select().from(stockTable);
      const products = await pgDb.select().from(productsTable);
      const productMap = new Map(products.map(p => [p.id, p]));

      // Get stock movements for weighted average calculation
      const movements = await pgDb
        .select()
        .from(stockMovementsTable)
        .orderBy(stockMovementsTable.createdAt);

      // Calculate Weighted Average Cost for each product
      const valuationData: Array<{
        productId: string;
        productName: string;
        sku: string;
        category: string;
        currentQuantity: number;
        availableQuantity: number;
        reservedQuantity: number;
        unitCost: number;
        totalValue: number;
        lastMovementDate: string | null;
        movementsSummary: {
          totalIn: number;
          totalOut: number;
          totalAdjustments: number;
        };
      }> = [];

      let totalInventoryValue = 0;
      let totalItems = 0;

      for (const stock of stockItems) {
        const product = productMap.get(stock.productId);
        if (!product) continue;

        const currentQty = parseFloat(stock.quantity);
        const availableQty = parseFloat(stock.availableQuantity);
        const reservedQty = parseFloat(stock.reservedQuantity);

        // Use product price as unit cost (in real implementation, this would track purchase costs)
        const unitCost = parseFloat(product.price);
        const totalValue = currentQty * unitCost;

        // Get movement summary for this product
        const productMovements = movements.filter(m => m.productId === stock.productId);
        const lastMovement = productMovements[productMovements.length - 1];

        const movementsSummary = {
          totalIn: productMovements
            .filter(m => m.type === 'in')
            .reduce((sum, m) => sum + parseFloat(m.quantity), 0),
          totalOut: productMovements
            .filter(m => m.type === 'out')
            .reduce((sum, m) => sum + parseFloat(m.quantity), 0),
          totalAdjustments: productMovements
            .filter(m => m.type === 'adjustment')
            .reduce((sum, m) => sum + parseFloat(m.quantity), 0),
        };

        valuationData.push({
          productId: stock.productId,
          productName: product.name,
          sku: product.sku || 'N/A',
          category: product.category || 'Uncategorized',
          currentQuantity: currentQty,
          availableQuantity: availableQty,
          reservedQuantity: reservedQty,
          unitCost,
          totalValue,
          lastMovementDate: lastMovement?.createdAt?.toISOString() || null,
          movementsSummary,
        });

        totalInventoryValue += totalValue;
        totalItems += currentQty;
      }

      // Group by category for summary
      const categoryBreakdown: Record<string, { items: number; value: number }> = {};
      for (const item of valuationData) {
        if (!categoryBreakdown[item.category]) {
          categoryBreakdown[item.category] = { items: 0, value: 0 };
        }
        categoryBreakdown[item.category].items += item.currentQuantity;
        categoryBreakdown[item.category].value += item.totalValue;
      }

      res.json({
        success: true,
        data: {
          summary: {
            totalInventoryValue,
            totalItems,
            totalProducts: valuationData.length,
            valuationMethod: 'Weighted Average Cost',
            reportDate: new Date().toISOString(),
            currency: 'AED',
          },
          categoryBreakdown,
          items: valuationData,
        },
      });
    } catch (error) {
      console.error('[Inventory Valuation Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate inventory valuation' });
    }
  });

  // INVENTORY CYCLE: Get stock audit trail for a product (IAS 2 compliance)
  app.get('/api/stock/:productId/audit', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId } = req.params;

      // Get current stock status
      const stockResult = await pgDb.select().from(stockTable).where(eq(stockTable.productId, productId));
      if (stockResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock item not found' });
      }

      const stock = stockResult[0];
      const product = await pgDb.select().from(productsTable).where(eq(productsTable.id, productId));

      // Get all movements for this product
      const movements = await pgDb
        .select()
        .from(stockMovementsTable)
        .where(eq(stockMovementsTable.productId, productId))
        .orderBy(desc(stockMovementsTable.createdAt));

      // Calculate running balances for audit trail
      const auditTrail = movements.map((m, index) => ({
        id: m.id,
        date: m.createdAt?.toISOString(),
        type: m.type,
        quantity: parseFloat(m.quantity),
        previousQuantity: m.previousQuantity ? parseFloat(m.previousQuantity) : null,
        newQuantity: m.newQuantity ? parseFloat(m.newQuantity) : null,
        reason: m.reason,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        performedBy: m.performedBy,
      }));

      res.json({
        success: true,
        data: {
          product: product[0] ? {
            id: product[0].id,
            name: product[0].name,
            sku: product[0].sku,
          } : null,
          currentStock: {
            quantity: parseFloat(stock.quantity),
            availableQuantity: parseFloat(stock.availableQuantity),
            reservedQuantity: parseFloat(stock.reservedQuantity),
            lowStockThreshold: stock.lowStockThreshold ? stock.lowStockThreshold : null,
            reorderPoint: stock.reorderPoint ? stock.reorderPoint : null,
            lastUpdated: stock.updatedAt?.toISOString(),
          },
          auditTrail,
          totalMovements: auditTrail.length,
        },
      });
    } catch (error) {
      console.error('[Stock Audit Trail Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock audit trail' });
    }
  });

  // Update stock - DATABASE BACKED
  app.post('/api/stock/update', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId, quantity, type, reason } = req.body;

      const result = await pgDb.select().from(stockTable).where(eq(stockTable.productId, productId));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock item not found' });
      }

      const item = result[0];
      const now = new Date();
      let newQuantity = parseFloat(item.quantity);
      let newAvailable = parseFloat(item.availableQuantity);

      if (type === 'add') {
        newQuantity += quantity;
        newAvailable += quantity;
      } else if (type === 'subtract') {
        newQuantity -= quantity;
        newAvailable -= quantity;
      } else {
        newQuantity = quantity;
        newAvailable = quantity - parseFloat(item.reservedQuantity);
      }

      await pgDb.update(stockTable)
        .set({
          quantity: String(newQuantity),
          availableQuantity: String(newAvailable),
          updatedAt: now
        })
        .where(eq(stockTable.productId, productId));

      // Create movement record with all required fields
      await pgDb.insert(stockMovementsTable).values({
        id: `mov_${Date.now()}`,
        productId,
        type: type === 'add' ? 'in' : 'out',
        quantity: String(quantity),
        previousQuantity: String(parseFloat(item.quantity)),
        newQuantity: String(newQuantity),
        reason: reason || 'Manual update',
        performedBy: 'admin',
        createdAt: now,
      });

      // Fetch updated item
      const updated = await pgDb.select().from(stockTable).where(eq(stockTable.productId, productId));
      const s = updated[0];

      res.json({
        success: true,
        data: {
          id: s.id,
          productId: s.productId,
          quantity: parseFloat(s.quantity),
          reservedQuantity: parseFloat(s.reservedQuantity),
          availableQuantity: parseFloat(s.availableQuantity),
          lowStockThreshold: s.lowStockThreshold,
          reorderPoint: s.reorderPoint,
          reorderQuantity: s.reorderQuantity,
          lastRestockedAt: s.lastRestockedAt?.toISOString() || null,
          updatedAt: s.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Stock Update Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update stock' });
    }
  });

  // Bulk update stock - DATABASE BACKED
  app.post('/api/stock/bulk-update', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { updates } = req.body;
      const results: Array<{
        id: string;
        productId: string;
        quantity: number;
        availableQuantity: number;
      }> = [];
      const now = new Date();

      for (const update of updates) {
        const result = await pgDb.select().from(stockTable).where(eq(stockTable.productId, update.productId));
        if (result.length > 0) {
          const item = result[0];
          let newQuantity = parseFloat(item.quantity);
          let newAvailable = parseFloat(item.availableQuantity);

          if (update.type === 'add') {
            newQuantity += update.quantity;
            newAvailable += update.quantity;
          } else if (update.type === 'subtract') {
            newQuantity -= update.quantity;
            newAvailable -= update.quantity;
          } else {
            newQuantity = update.quantity;
            newAvailable = update.quantity - parseFloat(item.reservedQuantity);
          }

          await pgDb.update(stockTable)
            .set({
              quantity: String(newQuantity),
              availableQuantity: String(newAvailable),
              updatedAt: now
            })
            .where(eq(stockTable.productId, update.productId));

          results.push({
            id: item.id,
            productId: item.productId,
            quantity: newQuantity,
            availableQuantity: newAvailable,
          });
        }
      }

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('[Bulk Stock Update Error]', error);
      res.status(500).json({ success: false, error: 'Failed to bulk update stock' });
    }
  });

  app.post('/api/stock/restock/:productId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId } = req.params;
      const { quantity, batchNumber } = req.body;

      const result = await pgDb.select().from(stockTable).where(eq(stockTable.productId, productId));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock item not found' });
      }

      const item = result[0];
      const now = new Date();
      const newQuantity = parseFloat(item.quantity) + quantity;
      const newAvailable = parseFloat(item.availableQuantity) + quantity;

      await pgDb.update(stockTable)
        .set({
          quantity: String(newQuantity),
          availableQuantity: String(newAvailable),
          lastRestockedAt: now,
          updatedAt: now
        })
        .where(eq(stockTable.productId, productId));

      // Create movement record with all required fields
      await pgDb.insert(stockMovementsTable).values({
        id: `mov_${Date.now()}`,
        productId,
        type: 'in',
        quantity: String(quantity),
        previousQuantity: String(parseFloat(item.quantity)),
        newQuantity: String(newQuantity),
        reason: `Restocked${batchNumber ? ` (Batch: ${batchNumber})` : ''}`,
        performedBy: 'admin',
        createdAt: now,
      });

      // Fetch updated item
      const updated = await pgDb.select().from(stockTable).where(eq(stockTable.productId, productId));
      const s = updated[0];

      res.json({
        success: true,
        data: {
          id: s.id,
          productId: s.productId,
          quantity: parseFloat(s.quantity),
          availableQuantity: parseFloat(s.availableQuantity),
          lastRestockedAt: s.lastRestockedAt?.toISOString() || null,
          updatedAt: s.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Restock Error]', error);
      res.status(500).json({ success: false, error: 'Failed to restock' });
    }
  });

  app.patch('/api/stock/:productId/thresholds', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(stockTable).where(eq(stockTable.productId, req.params.productId));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock item not found' });
      }

      const { lowStockThreshold, reorderPoint, reorderQuantity } = req.body;
      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };

      if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
      if (reorderPoint !== undefined) updateData.reorderPoint = reorderPoint;
      if (reorderQuantity !== undefined) updateData.reorderQuantity = reorderQuantity;

      await pgDb.update(stockTable)
        .set(updateData)
        .where(eq(stockTable.productId, req.params.productId));

      // Fetch updated item
      const updated = await pgDb.select().from(stockTable).where(eq(stockTable.productId, req.params.productId));
      const s = updated[0];

      res.json({
        success: true,
        data: {
          id: s.id,
          productId: s.productId,
          lowStockThreshold: s.lowStockThreshold,
          reorderPoint: s.reorderPoint,
          reorderQuantity: s.reorderQuantity,
          updatedAt: s.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Update Thresholds Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update thresholds' });
    }
  });

  // =====================================================
  // SUPPLIERS API - DATABASE BACKED
  // =====================================================

  // Helper to generate supplier code
  async function generateSupplierCode(db: typeof pgDb): Promise<string> {
    if (!db) return `SUP-${Date.now()}`;
    const suppliers = await db.select().from(suppliersTable).orderBy(desc(suppliersTable.code));
    if (suppliers.length === 0) return 'SUP-001';
    const lastCode = suppliers[0].code;
    const lastNum = parseInt(lastCode.split('-')[1]) || 0;
    return `SUP-${String(lastNum + 1).padStart(3, '0')}`;
  }

  // Helper to generate PO number
  async function generatePoNumber(db: typeof pgDb): Promise<string> {
    if (!db) return `PO-${new Date().getFullYear()}-${Date.now()}`;
    const year = new Date().getFullYear();
    const pos = await db.select().from(purchaseOrdersTable).orderBy(desc(purchaseOrdersTable.orderNumber));
    const yearOrders = pos.filter(po => po.orderNumber.startsWith(`PO-${year}`));
    if (yearOrders.length === 0) return `PO-${year}-0001`;
    const lastNum = Math.max(...yearOrders.map(o => parseInt(o.orderNumber.split('-')[2]) || 0));
    return `PO-${year}-${String(lastNum + 1).padStart(4, '0')}`;
  }

  // List suppliers - DATABASE BACKED
  app.get('/api/suppliers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { status, category, search } = req.query;
      let suppliers = await pgDb.select().from(suppliersTable);

      if (status && status !== 'all') {
        suppliers = suppliers.filter(s => s.status === status);
      }
      if (category && category !== 'all') {
        suppliers = suppliers.filter(s => (s.categories as string[] || []).includes(category as string));
      }
      if (search) {
        const q = (search as string).toLowerCase();
        suppliers = suppliers.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.phone.includes(q)
        );
      }

      suppliers.sort((a, b) => a.name.localeCompare(b.name));

      const formatted = suppliers.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        nameAr: s.nameAr,
        email: s.email,
        phone: s.phone,
        website: s.website,
        taxNumber: s.taxNumber,
        address: s.address,
        contacts: s.contacts || [],
        paymentTerms: s.paymentTerms,
        currency: s.currency,
        creditLimit: parseFloat(s.creditLimit),
        currentBalance: parseFloat(s.currentBalance),
        categories: s.categories || [],
        rating: s.rating ? parseFloat(s.rating) : 0,
        onTimeDeliveryRate: s.onTimeDeliveryRate ? parseFloat(s.onTimeDeliveryRate) : 0,
        qualityScore: s.qualityScore ? parseFloat(s.qualityScore) : 0,
        totalOrders: s.totalOrders,
        totalSpent: parseFloat(s.totalSpent),
        status: s.status,
        notes: s.notes,
        createdAt: s.createdAt?.toISOString(),
        updatedAt: s.updatedAt?.toISOString(),
        lastOrderAt: s.lastOrderAt?.toISOString(),
      }));

      res.json({ success: true, data: formatted });
    } catch (error) {
      console.error('[Suppliers List Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
    }
  });

  // Supplier stats - DATABASE BACKED
  app.get('/api/suppliers/stats', async (_req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const suppliers = await pgDb.select().from(suppliersTable);
      const pos = await pgDb.select().from(purchaseOrdersTable);
      const supplierProds = await pgDb.select().from(supplierProductsTable);

      const stats = {
        totalSuppliers: suppliers.length,
        activeSuppliers: suppliers.filter(s => s.status === 'active').length,
        pendingSuppliers: suppliers.filter(s => s.status === 'pending').length,
        totalPurchaseOrders: pos.length,
        pendingOrders: pos.filter(po => ['pending', 'ordered'].includes(po.status)).length,
        totalSpent: suppliers.reduce((sum, s) => sum + parseFloat(s.totalSpent), 0),
        averageLeadTime: supplierProds.length
          ? supplierProds.reduce((sum, sp) => sum + sp.leadTimeDays, 0) / supplierProds.length
          : 0,
        topCategories: Array.from(new Set(suppliers.flatMap(s => (s.categories as string[]) || [])))
          .map(cat => ({
            category: cat,
            count: suppliers.filter(s => ((s.categories as string[]) || []).includes(cat)).length
          })),
      };

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('[Supplier Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch supplier stats' });
    }
  });

  // Create supplier - DATABASE BACKED
  app.post('/api/suppliers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const body = req.body;
      if (!body.name || !body.email || !body.phone) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const now = new Date();
      const id = generateId('sup');
      const code = await generateSupplierCode(pgDb);

      const newSupplier = {
        id,
        code,
        name: body.name,
        nameAr: body.nameAr || null,
        email: body.email,
        phone: body.phone,
        website: body.website || null,
        taxNumber: body.taxNumber || null,
        address: body.address || { street: '', city: '', state: '', country: 'UAE', postalCode: '' },
        contacts: (body.contacts || []).map((c: any) => ({ ...c, id: generateId('contact') })),
        paymentTerms: body.paymentTerms || 'net_30',
        currency: body.currency || 'AED',
        creditLimit: String(body.creditLimit || 0),
        currentBalance: '0',
        categories: body.categories || ['general'],
        rating: '0',
        onTimeDeliveryRate: '0',
        qualityScore: '0',
        totalOrders: 0,
        totalSpent: '0',
        status: 'pending' as const,
        notes: body.notes || null,
        createdAt: now,
        updatedAt: now,
      };

      await pgDb.insert(suppliersTable).values(newSupplier);

      res.status(201).json({
        success: true,
        data: {
          ...newSupplier,
          creditLimit: parseFloat(newSupplier.creditLimit),
          currentBalance: 0,
          rating: 0,
          onTimeDeliveryRate: 0,
          qualityScore: 0,
          totalSpent: 0,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Create Supplier Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create supplier' });
    }
  });

  // Update supplier status - DATABASE BACKED
  app.patch('/api/suppliers/:id/status', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const now = new Date();
      await pgDb.update(suppliersTable)
        .set({ status: req.body.status, updatedAt: now })
        .where(eq(suppliersTable.id, req.params.id));

      const updated = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      console.error('[Update Supplier Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update supplier status' });
    }
  });

  // Delete supplier - DATABASE BACKED
  app.delete('/api/suppliers/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      // Check for pending POs
      const pendingPOs = await pgDb.select().from(purchaseOrdersTable)
        .where(and(
          eq(purchaseOrdersTable.supplierId, req.params.id),
          ne(purchaseOrdersTable.status, 'received'),
          ne(purchaseOrdersTable.status, 'cancelled')
        ));

      if (pendingPOs.length > 0) {
        return res.status(400).json({ success: false, error: 'Cannot delete supplier with pending purchase orders' });
      }

      await pgDb.delete(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[Delete Supplier Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete supplier' });
    }
  });

  // Add supplier contact - DATABASE BACKED
  app.post('/api/suppliers/:id/contacts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const supplier = result[0];
      const contact = { id: generateId('contact'), ...req.body };
      const contacts = [...(supplier.contacts as any[] || []), contact];

      await pgDb.update(suppliersTable)
        .set({ contacts, updatedAt: new Date() })
        .where(eq(suppliersTable.id, req.params.id));

      res.status(201).json({ success: true, data: contact });
    } catch (error) {
      console.error('[Add Contact Error]', error);
      res.status(500).json({ success: false, error: 'Failed to add contact' });
    }
  });

  // Delete supplier contact - DATABASE BACKED
  app.delete('/api/suppliers/:id/contacts/:contactId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const supplier = result[0];
      const contacts = (supplier.contacts as any[] || []).filter((c: any) => c.id !== req.params.contactId);

      await pgDb.update(suppliersTable)
        .set({ contacts, updatedAt: new Date() })
        .where(eq(suppliersTable.id, req.params.id));

      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[Delete Contact Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete contact' });
    }
  });

  // Supplier products - DATABASE BACKED
  app.get('/api/suppliers/:id/products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const products = await pgDb.select().from(supplierProductsTable)
        .where(eq(supplierProductsTable.supplierId, req.params.id));

      const formatted = products.map(p => ({
        id: p.id,
        supplierId: p.supplierId,
        productId: p.productId,
        productName: p.productName,
        supplierSku: p.supplierSku,
        unitCost: parseFloat(p.unitCost),
        minimumOrderQuantity: p.minimumOrderQuantity,
        leadTimeDays: p.leadTimeDays,
        isPreferred: p.isPreferred,
        lastPurchasePrice: p.lastPurchasePrice ? parseFloat(p.lastPurchasePrice) : null,
        lastPurchaseDate: p.lastPurchaseDate?.toISOString(),
        notes: p.notes,
        createdAt: p.createdAt?.toISOString(),
        updatedAt: p.updatedAt?.toISOString(),
      }));

      res.json({ success: true, data: formatted });
    } catch (error) {
      console.error('[Supplier Products Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch supplier products' });
    }
  });

  // Add supplier product - DATABASE BACKED
  app.post('/api/suppliers/:id/products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const body = req.body;
      const now = new Date();
      const id = generateId('sp');

      const product = {
        id,
        supplierId: req.params.id,
        productId: body.productId || generateId('prod'),
        productName: body.productName || 'New Product',
        supplierSku: body.supplierSku || null,
        unitCost: String(body.unitCost || 0),
        minimumOrderQuantity: body.minimumOrderQuantity || 1,
        leadTimeDays: body.leadTimeDays || 7,
        isPreferred: !!body.isPreferred,
        lastPurchasePrice: String(body.unitCost || 0),
        lastPurchaseDate: now,
        notes: body.notes || null,
        createdAt: now,
        updatedAt: now,
      };

      await pgDb.insert(supplierProductsTable).values(product);

      res.status(201).json({
        success: true,
        data: {
          ...product,
          unitCost: parseFloat(product.unitCost),
          lastPurchasePrice: parseFloat(product.lastPurchasePrice),
          lastPurchaseDate: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Add Supplier Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to add supplier product' });
    }
  });

  // Delete supplier product - DATABASE BACKED
  app.delete('/api/suppliers/products/:productId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(supplierProductsTable)
        .where(eq(supplierProductsTable.id, req.params.productId));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier product not found' });
      }

      await pgDb.delete(supplierProductsTable).where(eq(supplierProductsTable.id, req.params.productId));
      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[Delete Supplier Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete supplier product' });
    }
  });

  // Purchase orders list - DATABASE BACKED
  app.get('/api/suppliers/purchase-orders/list', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { status, supplierId } = req.query;
      let pos = await pgDb.select().from(purchaseOrdersTable).orderBy(desc(purchaseOrdersTable.orderDate));

      if (status && status !== 'all') {
        pos = pos.filter(po => po.status === status);
      }
      if (supplierId) {
        pos = pos.filter(po => po.supplierId === supplierId);
      }

      // Get items for each PO
      const formatted = await Promise.all(pos.map(async po => {
        const items = await pgDb!.select().from(purchaseOrderItemsTable)
          .where(eq(purchaseOrderItemsTable.purchaseOrderId, po.id));

        return {
          id: po.id,
          orderNumber: po.orderNumber,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          items: items.map(it => ({
            id: it.id,
            productId: it.productId,
            productName: it.productName,
            supplierSku: it.supplierSku,
            quantity: parseFloat(it.quantity),
            unitCost: parseFloat(it.unitCost),
            totalCost: parseFloat(it.totalCost),
            receivedQuantity: parseFloat(it.receivedQuantity),
            notes: it.notes,
          })),
          subtotal: parseFloat(po.subtotal),
          taxAmount: parseFloat(po.taxAmount),
          taxRate: parseFloat(po.taxRate),
          shippingCost: parseFloat(po.shippingCost),
          discount: parseFloat(po.discount),
          total: parseFloat(po.total),
          status: po.status,
          paymentStatus: po.paymentStatus,
          orderDate: po.orderDate?.toISOString(),
          expectedDeliveryDate: po.expectedDeliveryDate?.toISOString(),
          actualDeliveryDate: po.actualDeliveryDate?.toISOString(),
          deliveryAddress: po.deliveryAddress,
          deliveryNotes: po.deliveryNotes,
          trackingNumber: po.trackingNumber,
          createdBy: po.createdBy,
          approvedBy: po.approvedBy,
          approvedAt: po.approvedAt?.toISOString(),
          internalNotes: po.internalNotes,
          supplierNotes: po.supplierNotes,
          statusHistory: po.statusHistory || [],
          createdAt: po.createdAt?.toISOString(),
          updatedAt: po.updatedAt?.toISOString(),
        };
      }));

      res.json({ success: true, data: formatted });
    } catch (error) {
      console.error('[PO List Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch purchase orders' });
    }
  });

  // Create purchase order - DATABASE BACKED
  app.post('/api/suppliers/purchase-orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const body = req.body;
      const supplierResult = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, body.supplierId));
      if (supplierResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const supplier = supplierResult[0];
      const now = new Date();
      const poId = generateId('po');
      const orderNumber = await generatePoNumber(pgDb);

      // Calculate totals
      let subtotal = 0;
      const itemsData = body.items.map((it: any) => {
        const totalCost = (it.quantity / 1000) * it.unitCost;
        subtotal += totalCost;
        return {
          id: generateId('poi'),
          purchaseOrderId: poId,
          productId: it.productId,
          productName: it.productName || it.productId,
          supplierSku: it.supplierSku || null,
          quantity: String(it.quantity),
          unitCost: String(it.unitCost),
          totalCost: String(totalCost),
          receivedQuantity: '0',
          notes: it.notes || null,
        };
      });

      const taxRate = 0.05;
      const taxAmount = subtotal * taxRate;
      const shippingCost = body.shippingCost || 0;
      const discount = body.discount || 0;
      const total = subtotal + taxAmount + shippingCost - discount;

      const po = {
        id: poId,
        orderNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        subtotal: String(subtotal),
        taxAmount: String(taxAmount),
        taxRate: String(taxRate),
        shippingCost: String(shippingCost),
        discount: String(discount),
        total: String(total),
        status: 'draft' as const,
        paymentStatus: 'pending',
        orderDate: now,
        expectedDeliveryDate: new Date(body.expectedDeliveryDate),
        deliveryAddress: body.deliveryAddress,
        deliveryNotes: body.deliveryNotes || null,
        createdBy: 'admin',
        statusHistory: [{ status: 'draft', changedBy: 'admin', changedAt: now.toISOString() }],
        createdAt: now,
        updatedAt: now,
      };

      await pgDb.insert(purchaseOrdersTable).values(po);

      // Insert items
      for (const item of itemsData) {
        await pgDb.insert(purchaseOrderItemsTable).values(item);
      }

      res.status(201).json({
        success: true,
        data: {
          ...po,
          items: itemsData.map((it: any) => ({
            ...it,
            quantity: parseFloat(it.quantity),
            unitCost: parseFloat(it.unitCost),
            totalCost: parseFloat(it.totalCost),
            receivedQuantity: 0,
          })),
          subtotal,
          taxAmount,
          taxRate,
          shippingCost,
          discount,
          total,
          orderDate: now.toISOString(),
          expectedDeliveryDate: body.expectedDeliveryDate,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Create PO Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create purchase order' });
    }
  });

  // Update PO status - DATABASE BACKED
  app.patch('/api/suppliers/purchase-orders/:id/status', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = result[0];
      const { status, notes } = req.body;
      const now = new Date();

      const statusHistory = [...(po.statusHistory as any[] || []), { status, changedBy: 'admin', changedAt: now.toISOString(), notes }];

      const updateData: any = {
        status,
        statusHistory,
        updatedAt: now
      };

      if (status === 'received') {
        updateData.actualDeliveryDate = now;
      }

      await pgDb.update(purchaseOrdersTable)
        .set(updateData)
        .where(eq(purchaseOrdersTable.id, req.params.id));

      const updated = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      console.error('[Update PO Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update purchase order status' });
    }
  });

  // Receive PO items - DATABASE BACKED with Inventory Integration
  app.put('/api/suppliers/purchase-orders/:id/receive', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = result[0];
      const { items } = req.body as { items: { itemId: string; receivedQuantity: number }[] };
      const now = new Date();

      // Track items being received for inventory update
      const itemsToReceive: Array<{ productId: string; quantity: number; unitCost: number }> = [];

      // Update each item's received quantity
      const poItems = await pgDb.select().from(purchaseOrderItemsTable)
        .where(eq(purchaseOrderItemsTable.purchaseOrderId, req.params.id));

      for (const poItem of poItems) {
        const recv = items.find(i => i.itemId === poItem.id);
        if (recv && recv.receivedQuantity > 0) {
          const newReceivedQty = parseFloat(poItem.receivedQuantity) + recv.receivedQuantity;

          await pgDb.update(purchaseOrderItemsTable)
            .set({ receivedQuantity: String(newReceivedQty) })
            .where(eq(purchaseOrderItemsTable.id, poItem.id));

          // Add to items for inventory update
          itemsToReceive.push({
            productId: poItem.productId,
            quantity: recv.receivedQuantity,
            unitCost: parseFloat(poItem.unitCost),
          });
        }
      }

      // Check if all items received
      const updatedItems = await pgDb.select().from(purchaseOrderItemsTable)
        .where(eq(purchaseOrderItemsTable.purchaseOrderId, req.params.id));

      const allReceived = updatedItems.every(i => parseFloat(i.receivedQuantity) >= parseFloat(i.quantity));
      const anyReceived = updatedItems.some(i => parseFloat(i.receivedQuantity) > 0);

      const newStatus = allReceived ? 'received' : anyReceived ? 'partially_received' : po.status;
      const statusHistory = [...(po.statusHistory as any[] || []), { status: newStatus, changedBy: 'admin', changedAt: now.toISOString() }];

      const updateData: any = {
        status: newStatus,
        statusHistory,
        updatedAt: now
      };

      if (newStatus === 'received') {
        updateData.actualDeliveryDate = now;
      }

      await pgDb.update(purchaseOrdersTable)
        .set(updateData)
        .where(eq(purchaseOrdersTable.id, req.params.id));

      // INVENTORY CYCLE: Update stock when receiving PO items (IAS 2 compliance)
      if (itemsToReceive.length > 0) {
        const invResult = await receiveStockFromPurchaseOrder(
          po.id,
          po.orderNumber,
          itemsToReceive,
          'admin',
          pgDb
        );

        if (invResult.success) {
          console.log(`[Inventory Cycle] Received ${itemsToReceive.length} items from PO ${po.orderNumber}`);

          // FINANCE CYCLE: Create purchase transaction when PO is fully received
          if (newStatus === 'received') {
            await createPurchaseTransaction(
              po.id,
              po.orderNumber,
              po.supplierId,
              po.supplierName,
              parseFloat(po.total),
              parseFloat(po.taxAmount),
              'admin',
              pgDb
            );
          }
        }
      }

      const updatedPo = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
      res.json({ success: true, data: updatedPo[0] });
    } catch (error) {
      console.error('[PO Receive Error]', error);
      res.status(500).json({ success: false, error: 'Failed to receive purchase order items' });
    }
  });

  // Get purchase order by ID - DATABASE BACKED
  app.get('/api/suppliers/purchase-orders/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = result[0];
      const items = await pgDb.select().from(purchaseOrderItemsTable)
        .where(eq(purchaseOrderItemsTable.purchaseOrderId, po.id));

      res.json({
        success: true,
        data: {
          ...po,
          items: items.map(it => ({
            id: it.id,
            productId: it.productId,
            productName: it.productName,
            supplierSku: it.supplierSku,
            quantity: parseFloat(it.quantity),
            unitCost: parseFloat(it.unitCost),
            totalCost: parseFloat(it.totalCost),
            receivedQuantity: parseFloat(it.receivedQuantity),
            notes: it.notes,
          })),
          subtotal: parseFloat(po.subtotal),
          taxAmount: parseFloat(po.taxAmount),
          taxRate: parseFloat(po.taxRate),
          shippingCost: parseFloat(po.shippingCost),
          discount: parseFloat(po.discount),
          total: parseFloat(po.total),
          orderDate: po.orderDate?.toISOString(),
          expectedDeliveryDate: po.expectedDeliveryDate?.toISOString(),
          actualDeliveryDate: po.actualDeliveryDate?.toISOString(),
          approvedAt: po.approvedAt?.toISOString(),
          createdAt: po.createdAt?.toISOString(),
          updatedAt: po.updatedAt?.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Get PO Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch purchase order' });
    }
  });

  // Delete/Cancel PO - DATABASE BACKED
  app.delete('/api/suppliers/purchase-orders/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const po = result[0];
      if (['received', 'partially_received'].includes(po.status)) {
        return res.status(400).json({ success: false, error: 'Cannot delete received or partially received orders' });
      }

      const now = new Date();
      const statusHistory = [...(po.statusHistory as any[] || []), { status: 'cancelled', changedBy: 'admin', changedAt: now.toISOString() }];

      await pgDb.update(purchaseOrdersTable)
        .set({ status: 'cancelled', statusHistory, updatedAt: now })
        .where(eq(purchaseOrdersTable.id, req.params.id));

      const updated = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      console.error('[Delete PO Error]', error);
      res.status(500).json({ success: false, error: 'Failed to cancel purchase order' });
    }
  });

  // Get supplier by ID - DATABASE BACKED
  app.get('/api/suppliers/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const s = result[0];
      res.json({
        success: true,
        data: {
          id: s.id,
          code: s.code,
          name: s.name,
          nameAr: s.nameAr,
          email: s.email,
          phone: s.phone,
          website: s.website,
          taxNumber: s.taxNumber,
          address: s.address,
          contacts: s.contacts || [],
          paymentTerms: s.paymentTerms,
          currency: s.currency,
          creditLimit: parseFloat(s.creditLimit),
          currentBalance: parseFloat(s.currentBalance),
          categories: s.categories || [],
          rating: s.rating ? parseFloat(s.rating) : 0,
          onTimeDeliveryRate: s.onTimeDeliveryRate ? parseFloat(s.onTimeDeliveryRate) : 0,
          qualityScore: s.qualityScore ? parseFloat(s.qualityScore) : 0,
          totalOrders: s.totalOrders,
          totalSpent: parseFloat(s.totalSpent),
          status: s.status,
          notes: s.notes,
          createdAt: s.createdAt?.toISOString(),
          updatedAt: s.updatedAt?.toISOString(),
          lastOrderAt: s.lastOrderAt?.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Get Supplier Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch supplier' });
    }
  });

  // Update supplier - DATABASE BACKED
  app.put('/api/suppliers/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const result = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Supplier not found' });
      }

      const body = req.body;
      const now = new Date();

      const updateData: any = { updatedAt: now };
      if (body.name) updateData.name = body.name;
      if (body.nameAr !== undefined) updateData.nameAr = body.nameAr;
      if (body.email) updateData.email = body.email;
      if (body.phone) updateData.phone = body.phone;
      if (body.website !== undefined) updateData.website = body.website;
      if (body.taxNumber !== undefined) updateData.taxNumber = body.taxNumber;
      if (body.address) updateData.address = body.address;
      if (body.contacts) updateData.contacts = body.contacts;
      if (body.paymentTerms) updateData.paymentTerms = body.paymentTerms;
      if (body.currency) updateData.currency = body.currency;
      if (body.creditLimit !== undefined) updateData.creditLimit = String(body.creditLimit);
      if (body.categories) updateData.categories = body.categories;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.status) updateData.status = body.status;

      await pgDb.update(suppliersTable)
        .set(updateData)
        .where(eq(suppliersTable.id, req.params.id));

      const updated = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      console.error('[Update Supplier Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update supplier' });
    }
  });

  // =====================================================
  // USERS API
  // =====================================================

  app.get('/api/users', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { role, search } = req.query;
      let allUsers = await pgDb.select().from(usersTable);

      if (role && role !== 'all') {
        allUsers = allUsers.filter(u => u.role === role);
      }
      if (search) {
        const q = (search as string).toLowerCase();
        allUsers = allUsers.filter(u =>
          u.firstName.toLowerCase().includes(q) ||
          u.familyName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.mobile.includes(q)
        );
      }

      const sanitized = allUsers.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      });
      res.json({ success: true, data: sanitized });
    } catch (error) {
      console.error('[Users List Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  });

  app.get('/api/users/stats', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allUsers = await pgDb.select().from(usersTable);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      res.json({
        success: true,
        data: {
          total: allUsers.length,
          customers: allUsers.filter(u => u.role === 'customer').length,
          admins: allUsers.filter(u => u.role === 'admin').length,
          staff: allUsers.filter(u => u.role === 'staff').length,
          delivery: allUsers.filter(u => u.role === 'delivery').length,
          active: allUsers.filter(u => u.isActive).length,
          verified: allUsers.filter(u => u.isVerified).length,
          newThisMonth: allUsers.filter(u => new Date(u.createdAt) >= monthStart).length,
        },
      });
    } catch (error) {
      console.error('[User Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user stats' });
    }
  });

  // Get current user - MUST be before /api/users/:id to avoid route conflict
  app.get('/api/users/me', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.json({ success: true, data: null });
      }

      // Check database for session
      if (isDatabaseAvailable() && pgDb) {
        try {
          const sessionResults = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token));

          if (sessionResults.length > 0) {
            const session = sessionResults[0];

            // Check if session is expired
            if (new Date(session.expiresAt) < new Date()) {
              // Delete expired session
              await pgDb.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
              return res.json({ success: true, data: null });
            }

            // Get user from database
            const userResults = await pgDb.select().from(usersTable).where(eq(usersTable.id, session.userId));

            if (userResults.length > 0) {
              const dbUser = userResults[0];
              const { password, ...userWithoutPassword } = dbUser;
              return res.json({ success: true, data: userWithoutPassword });
            }
          }
        } catch (dbError) {
          console.error('[Get Me DB Error]', dbError);
        }
      }

      // Fallback to in-memory session (for local dev)
      const memSession = sessions.get(token);
      if (!memSession || new Date(memSession.expiresAt) < new Date()) {
        sessions.delete(token);
        return res.json({ success: true, data: null });
      }

      const memUser = users.get(memSession.userId);
      if (!memUser) {
        return res.json({ success: true, data: null });
      }

      res.json({ success: true, data: sanitizeUser(memUser) });
    } catch (error) {
      console.error('[Get Me Error]', error);
      res.json({ success: true, data: null });
    }
  });

  // Get user by ID
  app.get('/api/users/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userResult = await pgDb.select().from(usersTable).where(eq(usersTable.id, req.params.id));
      if (userResult.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const user = userResult[0];
      const { password, ...userWithoutPassword } = user;
      res.json({ success: true, data: userWithoutPassword });
    } catch (error) {
      console.error('[Get User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userResult = await pgDb.select().from(usersTable).where(eq(usersTable.id, req.params.id));
      if (userResult.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const updates = req.body;
      const updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };

      await pgDb.update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, req.params.id));
      const [updated] = await pgDb.select().from(usersTable).where(eq(usersTable.id, req.params.id));

      const { password, ...userWithoutPassword } = updated;
      res.json({ success: true, data: userWithoutPassword });
    } catch (error) {
      console.error('[Update User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userResult = await pgDb.select().from(usersTable).where(eq(usersTable.id, req.params.id));
      if (userResult.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      await pgDb.delete(usersTable).where(eq(usersTable.id, req.params.id));
      res.json({ success: true, message: 'User deleted' });
    } catch (error) {
      console.error('[Delete User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
  });

  // Change user password
  app.post('/api/users/:id/change-password', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userResult = await pgDb.select().from(usersTable).where(eq(usersTable.id, req.params.id));
      if (userResult.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const user = userResult[0];
      const { currentPassword, newPassword } = req.body;

      if (user.password !== currentPassword) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }

      await pgDb.update(usersTable)
        .set({ password: newPassword, updatedAt: new Date() })
        .where(eq(usersTable.id, req.params.id));

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('[Change Password Error]', error);
      res.status(500).json({ success: false, error: 'Failed to change password' });
    }
  });

  // Verify user (admin)
  app.post('/api/users/:id/verify', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userResult = await pgDb.select().from(usersTable).where(eq(usersTable.id, req.params.id));
      if (userResult.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      await pgDb.update(usersTable)
        .set({ isVerified: true, updatedAt: new Date() })
        .where(eq(usersTable.id, req.params.id));
      const [updated] = await pgDb.select().from(usersTable).where(eq(usersTable.id, req.params.id));

      const { password, ...userWithoutPassword } = updated;
      res.json({ success: true, data: userWithoutPassword, message: 'User verified successfully' });
    } catch (error) {
      console.error('[Verify User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to verify user' });
    }
  });

  // =====================================================
  // DELIVERY API
  // =====================================================

  // Get all delivery zones
  app.get('/api/delivery/zones', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const zones = await pgDb.select().from(deliveryZonesTable);
      res.json({ success: true, data: zones });
    } catch (error) {
      console.error('[Delivery Zones Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch delivery zones' });
    }
  });

  // Get zone by ID
  app.get('/api/delivery/zones/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const zones = await pgDb.select().from(deliveryZonesTable).where(eq(deliveryZonesTable.id, req.params.id));

      if (zones.length === 0) {
        return res.status(404).json({ success: false, error: 'Delivery zone not found' });
      }

      res.json({ success: true, data: zones[0] });
    } catch (error) {
      console.error('[Delivery Zone Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch delivery zone' });
    }
  });

  app.post('/api/delivery/zones', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive, expressEnabled, expressFee, expressHours } = req.body;

      const zoneId = `zone_${Date.now()}`;
      await pgDb.insert(deliveryZonesTable).values({
        id: zoneId,
        name,
        nameAr,
        emirate,
        areas: areas || [],
        deliveryFee: String(deliveryFee || 20),
        minimumOrder: String(minimumOrder || 50),
        estimatedMinutes: estimatedMinutes || 60,
        isActive: isActive ?? true,
        expressEnabled: expressEnabled ?? false,
        expressFee: String(expressFee || 25),
        expressHours: expressHours || 1,
      });
      const [zone] = await pgDb.select().from(deliveryZonesTable).where(eq(deliveryZonesTable.id, zoneId));

      res.status(201).json({ success: true, data: zone, message: 'Delivery zone created' });
    } catch (error) {
      console.error('[Create Zone Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create delivery zone' });
    }
  });

  app.put('/api/delivery/zones/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const zones = await pgDb.select().from(deliveryZonesTable).where(eq(deliveryZonesTable.id, req.params.id));

      if (zones.length === 0) {
        return res.status(404).json({ success: false, error: 'Delivery zone not found' });
      }

      const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive, expressEnabled, expressFee, expressHours } = req.body;
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) updateData.name = name;
      if (nameAr !== undefined) updateData.nameAr = nameAr;
      if (emirate !== undefined) updateData.emirate = emirate;
      if (areas !== undefined) updateData.areas = areas;
      if (deliveryFee !== undefined) updateData.deliveryFee = String(deliveryFee);
      if (minimumOrder !== undefined) updateData.minimumOrder = String(minimumOrder);
      if (estimatedMinutes !== undefined) updateData.estimatedMinutes = estimatedMinutes;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (expressEnabled !== undefined) updateData.expressEnabled = expressEnabled;
      if (expressFee !== undefined) updateData.expressFee = String(expressFee);
      if (expressHours !== undefined) updateData.expressHours = expressHours;

      await pgDb.update(deliveryZonesTable)
        .set(updateData)
        .where(eq(deliveryZonesTable.id, req.params.id));
      const [updated] = await pgDb.select().from(deliveryZonesTable).where(eq(deliveryZonesTable.id, req.params.id));

      res.json({ success: true, data: updated, message: 'Delivery zone updated' });
    } catch (error) {
      console.error('[Update Zone Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update delivery zone' });
    }
  });

  app.delete('/api/delivery/zones/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const zones = await pgDb.select().from(deliveryZonesTable).where(eq(deliveryZonesTable.id, req.params.id));

      if (zones.length === 0) {
        return res.status(404).json({ success: false, error: 'Delivery zone not found' });
      }

      await pgDb.delete(deliveryZonesTable).where(eq(deliveryZonesTable.id, req.params.id));

      res.json({ success: true, message: 'Zone deleted' });
    } catch (error) {
      console.error('[Delete Zone Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete delivery zone' });
    }
  });

  // Get user addresses - DATABASE BACKED
  app.get('/api/delivery/addresses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.json({ success: true, data: [] });
      }

      // Try to find session in database
      const sessionResult = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
      if (sessionResult.length === 0) {
        // Also check in-memory cache
        const memSession = sessions.get(token);
        if (!memSession) {
          return res.json({ success: true, data: [] });
        }
        // Get addresses for user from cache session
        const userAddresses = await pgDb.select().from(addressesTable).where(eq(addressesTable.userId, memSession.userId));
        return res.json({ success: true, data: userAddresses });
      }

      const session = sessionResult[0];
      const userAddresses = await pgDb.select().from(addressesTable).where(eq(addressesTable.userId, session.userId));
      res.json({ success: true, data: userAddresses });
    } catch (error) {
      console.error('[Get Addresses Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch addresses' });
    }
  });

  // Create address - DATABASE BACKED
  app.post('/api/delivery/addresses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const token = req.headers.authorization?.replace('Bearer ', '');
      let userId = 'guest';

      if (token) {
        // Try database first
        const sessionResult = await pgDb.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
        if (sessionResult.length > 0) {
          userId = sessionResult[0].userId;
        } else {
          // Fallback to in-memory cache
          const session = sessions.get(token);
          if (session) userId = session.userId;
        }
      }

      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, isDefault } = req.body;

      if (!fullName || !mobile || !emirate || !area || !street || !building) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const addressId = `addr_${Date.now()}`;
      const now = new Date();

      // If this is default, unset other defaults for this user
      if (isDefault) {
        await pgDb.update(addressesTable)
          .set({ isDefault: false })
          .where(eq(addressesTable.userId, userId));
      }

      // Insert new address
      await pgDb.insert(addressesTable).values({
        id: addressId,
        userId,
        label: label || 'Home',
        fullName,
        mobile,
        emirate,
        area,
        street,
        building,
        floor: floor || null,
        apartment: apartment || null,
        landmark: landmark || null,
        latitude: latitude || null,
        longitude: longitude || null,
        isDefault: isDefault || false,
        createdAt: now,
        updatedAt: now,
      });
      const [newAddress] = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, addressId));

      res.status(201).json({ success: true, data: newAddress });
    } catch (error) {
      console.error('[Create Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create address' });
    }
  });

  // Update address - DATABASE BACKED
  app.put('/api/delivery/addresses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const addressResult = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, req.params.id));
      if (addressResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      const existingAddress = addressResult[0];
      const updates = req.body;
      const now = new Date();

      // If setting as default, unset others for this user
      if (updates.isDefault) {
        await pgDb.update(addressesTable)
          .set({ isDefault: false })
          .where(and(
            eq(addressesTable.userId, existingAddress.userId),
            ne(addressesTable.id, req.params.id)
          ));
      }

      // Update the address
      const updateData: Record<string, unknown> = { updatedAt: now };
      if (updates.label !== undefined) updateData.label = updates.label;
      if (updates.fullName !== undefined) updateData.fullName = updates.fullName;
      if (updates.mobile !== undefined) updateData.mobile = updates.mobile;
      if (updates.emirate !== undefined) updateData.emirate = updates.emirate;
      if (updates.area !== undefined) updateData.area = updates.area;
      if (updates.street !== undefined) updateData.street = updates.street;
      if (updates.building !== undefined) updateData.building = updates.building;
      if (updates.floor !== undefined) updateData.floor = updates.floor;
      if (updates.apartment !== undefined) updateData.apartment = updates.apartment;
      if (updates.landmark !== undefined) updateData.landmark = updates.landmark;
      if (updates.latitude !== undefined) updateData.latitude = updates.latitude;
      if (updates.longitude !== undefined) updateData.longitude = updates.longitude;
      if (updates.isDefault !== undefined) updateData.isDefault = updates.isDefault;

      await pgDb.update(addressesTable)
        .set(updateData)
        .where(eq(addressesTable.id, req.params.id));
      const [updated] = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, req.params.id));

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[Update Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update address' });
    }
  });

  // Delete address - DATABASE BACKED
  app.delete('/api/delivery/addresses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const addressResult = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, req.params.id));
      if (addressResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      await pgDb.delete(addressesTable).where(eq(addressesTable.id, req.params.id));
      res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
      console.error('[Delete Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete address' });
    }
  });

  // In-memory tracking storage for assigned deliveries
  const deliveryTracking = new Map<string, {
    id: string;
    orderId: string;
    orderNumber: string;
    driverId: string;
    driverName: string;
    driverMobile: string;
    status: string;
    customerName?: string;
    customerMobile?: string;
    deliveryAddress?: any;
    deliveryNotes?: string;
    items?: { name: string; quantity: number }[];
    total?: number;
    estimatedArrival: string;
    timeline: { status: string; timestamp: string; notes?: string }[];
    createdAt: string;
    updatedAt: string;
  }>();

  // Note: Delivery tracking is now database-backed via deliveryTrackingTable
  // Demo tracking pre-population removed - all tracking created via /api/delivery/tracking/assign

  // Get tracking by order ID - DATABASE BACKED
  app.get('/api/delivery/tracking/by-order/:orderId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId } = req.params;

      // Query database for tracking
      const trackingResult = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.orderId, orderId));

      if (trackingResult.length === 0) {
        // Return null data if no tracking exists yet (order not assigned)
        return res.json({ success: true, data: null });
      }

      const dbTracking = trackingResult[0];

      // Get order details for enrichment
      const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, orderId));
      const order = orderResult[0];

      // Get order items
      const orderItems = order ? await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId)) : [];

      const tracking = {
        id: dbTracking.id,
        orderId: dbTracking.orderId,
        orderNumber: dbTracking.orderNumber,
        driverId: dbTracking.driverId,
        driverName: dbTracking.driverName,
        driverMobile: dbTracking.driverMobile,
        status: dbTracking.status,
        customerName: order?.customerName || '',
        customerMobile: order?.customerMobile || '',
        deliveryAddress: order?.deliveryAddress || {},
        deliveryNotes: order?.deliveryNotes || null,
        items: orderItems.map(i => ({ name: i.productName, quantity: Number(i.quantity) })),
        total: order ? Number(order.total) : 0,
        estimatedArrival: dbTracking.estimatedArrival?.toISOString() || null,
        actualArrival: dbTracking.actualArrival?.toISOString() || null,
        timeline: dbTracking.timeline || [],
        currentLocation: dbTracking.currentLocation || null,
        deliveryProof: dbTracking.deliveryProof || null,
        createdAt: dbTracking.createdAt.toISOString(),
        updatedAt: dbTracking.updatedAt.toISOString(),
      };

      res.json({ success: true, data: tracking });
    } catch (error) {
      console.error('[Get Tracking Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracking' });
    }
  });

  // Get delivery drivers
  app.get('/api/delivery/drivers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allUsers = await pgDb.select().from(usersTable);
      const allTracking = await pgDb.select().from(deliveryTrackingTable);

      const drivers = allUsers
        .filter(u => u.role === 'delivery' && u.isActive)
        .map(d => ({
          id: d.id,
          name: `${d.firstName} ${d.familyName}`,
          mobile: d.mobile,
          email: d.email,
          activeDeliveries: allTracking.filter(t => t.driverId === d.id && t.status !== 'delivered').length,
        }));
      res.json({ success: true, data: drivers });
    } catch (error) {
      console.error('[Delivery Drivers Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch drivers' });
    }
  });

  // Assign delivery to driver (orderId in body) - DATABASE BACKED
  app.post('/api/delivery/tracking/assign', async (req, res) => {
    try {
      const { orderId, driverId, estimatedArrival } = req.body;

      if (!orderId || !driverId) {
        return res.status(400).json({ success: false, error: 'orderId and driverId are required' });
      }

      // Try database first
      if (isDatabaseAvailable() && pgDb) {
        // Get order from database
        const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, orderId));
        if (orderResult.length === 0) {
          return res.status(404).json({ success: false, error: 'Order not found' });
        }
        const order = orderResult[0];

        // Get order items
        const orderItems = await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));

        // Get driver from database
        const driverResult = await pgDb.select().from(usersTable).where(eq(usersTable.id, driverId));
        let driver = driverResult[0];

        // Fallback to in-memory driver if not in DB
        if (!driver) {
          driver = users.get(driverId) as any;
        }

        if (!driver || driver.role !== 'delivery') {
          return res.status(400).json({ success: false, error: 'Invalid delivery driver' });
        }

        const now = new Date();
        // When driver is assigned, update status to ready_for_pickup if not already there
        // Order will become 'out_for_delivery' when driver clicks 'Start Delivery' (in_transit)
        const newStatus = order.status === 'confirmed' || order.status === 'processing' ? 'ready_for_pickup' : order.status;
        const newHistory = [...(order.statusHistory as any[] || []), {
          status: newStatus,
          changedAt: now.toISOString(),
          changedBy: driverId,
          notes: 'Driver assigned',
        }];

        // Update order status in database - keep at ready_for_pickup until driver starts delivery
        await pgDb.update(ordersTable)
          .set({
            status: newStatus as any,
            updatedAt: now,
            statusHistory: newHistory,
          })
          .where(eq(ordersTable.id, orderId));

        // Create tracking entry in database
        const trackingId = `track_${Date.now()}`;
        const initialTimeline = [{
          status: 'assigned',
          timestamp: now.toISOString(),
          notes: `Assigned to driver: ${driver.firstName}`,
        }];

        await pgDb.insert(deliveryTrackingTable).values({
          id: trackingId,
          orderId,
          orderNumber: order.orderNumber,
          driverId,
          driverName: `${driver.firstName} ${driver.familyName}`,
          driverMobile: driver.mobile,
          status: 'assigned',
          estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : new Date(Date.now() + 60 * 60 * 1000),
          timeline: initialTimeline,
          createdAt: now,
          updatedAt: now,
        });

        const tracking = {
          id: trackingId,
          orderId,
          orderNumber: order.orderNumber,
          driverId,
          driverName: `${driver.firstName} ${driver.familyName}`,
          driverMobile: driver.mobile,
          status: 'assigned',
          customerName: order.customerName,
          customerMobile: order.customerMobile,
          deliveryAddress: order.deliveryAddress,
          deliveryNotes: order.deliveryNotes,
          items: orderItems.map(i => ({ name: i.productName, quantity: parseInt(i.quantity) })),
          total: parseFloat(order.total),
          estimatedArrival: estimatedArrival || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          timeline: [{
            status: 'assigned',
            timestamp: now.toISOString(),
            notes: `Assigned to driver: ${driver.firstName}`,
          }],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        // Also store in memory for quick access
        deliveryTracking.set(orderId, tracking);

        // Create notification for customer about driver assignment
        if (order.userId) {
          try {
            const driverFullName = `${driver.firstName} ${driver.familyName}`;
            await pgDb.insert(inAppNotificationsTable).values({
              id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userId: String(order.userId),
              type: 'driver_assigned',
              title: 'Driver Assigned to Your Order',
              titleAr: 'تم تعيين سائق لطلبك',
              message: `Driver: ${driverFullName} | Mobile: ${driver.mobile}`,
              messageAr: `السائق: ${driverFullName} | الهاتف: ${driver.mobile}`,
              link: '/orders',
              linkTab: 'orders',
              linkId: orderId,
              unread: true,
            });
            console.log(`[Driver Assigned] ✅ Notification sent to customer ${order.userId} for order ${order.orderNumber}`);
          } catch (notifError) {
            console.error('[Driver Assigned Notification Error]', notifError);
          }
        }

        return res.json({
          success: true,
          data: tracking,
          message: 'Delivery assigned successfully',
        });
      }

      // Fallback to in-memory
      const order = orders.get(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const driver = users.get(driverId);
      if (!driver || driver.role !== 'delivery') {
        return res.status(400).json({ success: false, error: 'Invalid delivery driver' });
      }

      // Update order status - keep at ready_for_pickup until driver starts delivery
      const newStatus = order.status === 'confirmed' || order.status === 'processing' ? 'ready_for_pickup' : order.status;
      order.status = newStatus;
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({
        status: newStatus,
        changedAt: new Date().toISOString(),
        changedBy: driverId,
      });

      const tracking = {
        id: `track_${Date.now()}`,
        orderId,
        orderNumber: order.orderNumber,
        driverId,
        driverName: `${driver.firstName} ${driver.familyName}`,
        driverMobile: driver.mobile,
        status: 'assigned',
        customerName: order.customerName,
        customerMobile: order.customerMobile,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        items: order.items.map(i => ({ name: i.productName, quantity: i.quantity })),
        total: order.total,
        estimatedArrival: estimatedArrival || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        timeline: [{
          status: 'assigned',
          timestamp: new Date().toISOString(),
          notes: `Assigned to driver: ${driver.firstName}`,
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      deliveryTracking.set(orderId, tracking);

      res.json({
        success: true,
        data: tracking,
        message: 'Delivery assigned successfully',
      });
    } catch (error) {
      console.error('[Delivery Assign Error]', error);
      res.status(500).json({ success: false, error: 'Failed to assign delivery' });
    }
  });

  // Update tracking status - DATABASE BACKED
  app.post('/api/delivery/tracking/:orderId/update', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;

      // Try database first
      if (isDatabaseAvailable() && pgDb) {
        // Get tracking from database
        const trackingResult = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.orderId, orderId));

        // Also get in-memory tracking for full data
        let tracking = deliveryTracking.get(orderId);

        if (trackingResult.length === 0 && !tracking) {
          return res.status(404).json({ success: false, error: 'Tracking not found' });
        }

        const dbTracking = trackingResult[0];
        const now = new Date();

        // Update tracking in database
        const trackingUpdatePayload: any = {
          status: status as any,
          updatedAt: now,
        };

        if (status === 'delivered') {
          trackingUpdatePayload.actualArrival = now;
        }

        await pgDb.update(deliveryTrackingTable)
          .set(trackingUpdatePayload)
          .where(eq(deliveryTrackingTable.orderId, orderId));

        // Update tracking timeline in database
        const newTimeline = [...(dbTracking?.timeline as any[] || []), {
          status,
          timestamp: now.toISOString(),
          notes: notes || `Status updated to ${status}`
        }];

        await pgDb.update(deliveryTrackingTable)
          .set({
            ...trackingUpdatePayload,
            timeline: newTimeline
          })
          .where(eq(deliveryTrackingTable.orderId, orderId));

        // Map tracking status to order status
        // Order becomes 'out_for_delivery' only when driver starts delivery (in_transit)
        const orderStatusMap: Record<string, string> = {
          'assigned': 'ready_for_pickup',    // Driver assigned, waiting for pickup
          'picked_up': 'ready_for_pickup',   // Driver picked up, still preparing
          'in_transit': 'out_for_delivery',  // Driver started delivery - now out for delivery
          'nearby': 'out_for_delivery',      // Driver nearby
          'delivered': 'delivered',          // Delivered
        };

        // Get and update order in database
        const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, orderId));
        if (orderResult.length > 0) {
          const order = orderResult[0];
          const newOrderStatus = orderStatusMap[status] || order.status;
          console.log(`[Delivery Update] Updating order ${orderId} to ${newOrderStatus} for tracking status ${status}`);

          const currentHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
          const newHistory = [...currentHistory, {
            status: newOrderStatus,
            changedAt: now.toISOString(),
            changedBy: dbTracking?.driverId || 'driver',
          }];

          await pgDb.update(ordersTable)
            .set({
              status: newOrderStatus as any,
              updatedAt: now,
              statusHistory: newHistory,
              actualDeliveryAt: status === 'delivered' ? now : null,
            })
            .where(eq(ordersTable.id, orderId));

          // Create delivery status notification for customer
          const deliveryMessages: Record<string, { en: string; ar: string; type: string }> = {
            'picked_up': { en: 'Your order has been picked up by the driver', ar: 'تم استلام طلبك من قبل السائق', type: 'order_processing' },
            'in_transit': { en: 'Your order is on its way', ar: 'طلبك في الطريق إليك', type: 'order_shipped' },
            'nearby': { en: 'Your driver is nearby and will arrive soon', ar: 'السائق قريب منك وسيصل قريباً', type: 'order_shipped' },
            'delivered': { en: 'Your order has been delivered', ar: 'تم توصيل طلبك', type: 'order_delivered' },
          };

          // Special handling for 'assigned' status to include driver details
          if (status === 'assigned' && order.userId && dbTracking) {
            const driverName = dbTracking.driverName || 'Driver';
            const driverMobile = dbTracking.driverMobile || 'N/A';
            try {
              await pgDb.insert(inAppNotificationsTable).values({
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: String(order.userId),
                type: 'order_confirmed',
                title: 'Driver Assigned to Your Order',
                titleAr: 'تم تعيين سائق لطلبك',
                message: `Driver: ${driverName} | Mobile: ${driverMobile}`,
                messageAr: `السائق: ${driverName} | الهاتف: ${driverMobile}`,
                link: `/orders`,
                linkTab: 'orders',
                linkId: order.id,
                unread: true,
              });
              console.log(`[Driver Assigned Update] ✅ Notification with driver details sent to customer ${order.userId}`);
            } catch (notifError) {
              console.error('[Driver Assigned Notification Error]', notifError);
            }
          }

          const deliveryMsg = deliveryMessages[status];
          if (deliveryMsg && order.userId) {
            try {
              await pgDb.insert(inAppNotificationsTable).values({
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: String(order.userId),
                type: deliveryMsg.type as any,
                title: status === 'delivered' ? 'Order Delivered!' : 'Delivery Update',
                titleAr: status === 'delivered' ? 'تم التوصيل!' : 'تحديث التوصيل',
                message: `${deliveryMsg.en}. Order #${order.orderNumber}`,
                messageAr: `${deliveryMsg.ar}. طلب #${order.orderNumber}`,
                link: `/orders`,
                linkTab: 'orders',
                linkId: order.id,
                unread: true,
              });
            } catch (notifError) {
              console.error('[Delivery Status Notification Error]', notifError);
            }
          }
        }

        // Update in-memory tracking
        if (tracking) {
          tracking.status = status;
          tracking.updatedAt = now.toISOString();
          tracking.timeline.push({
            status,
            timestamp: now.toISOString(),
            notes,
          });
          deliveryTracking.set(orderId, tracking);
        }

        return res.json({
          success: true,
          data: tracking || {
            id: dbTracking?.id,
            orderId,
            status,
            updatedAt: now.toISOString(),
          }
        });
      }

      // Fallback to in-memory
      let tracking = deliveryTracking.get(orderId);

      const order = orders.get(orderId);
      if (!tracking && order?.trackingInfo) {
        tracking = {
          id: order.trackingInfo.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          driverId: order.trackingInfo.driverId,
          driverName: order.trackingInfo.driverName,
          driverMobile: order.trackingInfo.driverMobile,
          status: order.trackingInfo.status,
          customerName: order.customerName,
          customerMobile: order.customerMobile,
          deliveryAddress: order.deliveryAddress,
          deliveryNotes: order.deliveryNotes,
          items: order.items.map(i => ({ name: i.productName, quantity: i.quantity })),
          total: order.total,
          estimatedArrival: order.trackingInfo.estimatedArrival,
          timeline: order.trackingInfo.timeline,
          createdAt: order.trackingInfo.createdAt,
          updatedAt: order.trackingInfo.updatedAt,
        };
        deliveryTracking.set(orderId, tracking);
      }

      if (!tracking) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      tracking.status = status;
      tracking.updatedAt = new Date().toISOString();
      tracking.timeline.push({
        status,
        timestamp: new Date().toISOString(),
        notes,
      });

      if (order) {
        const orderStatusMap: Record<string, string> = {
          'assigned': 'out_for_delivery',
          'picked_up': 'out_for_delivery',
          'in_transit': 'out_for_delivery',
          'nearby': 'out_for_delivery',
          'delivered': 'delivered',
        };
        const newOrderStatus = orderStatusMap[status] || order.status;

        if (order.status !== newOrderStatus) {
          order.status = newOrderStatus;
          order.updatedAt = new Date().toISOString();
          order.statusHistory.push({
            status: newOrderStatus,
            changedAt: new Date().toISOString(),
            changedBy: tracking.driverId,
          });
        }

        order.trackingInfo = {
          id: tracking.id,
          driverId: tracking.driverId,
          driverName: tracking.driverName,
          driverMobile: tracking.driverMobile,
          status: tracking.status,
          estimatedArrival: tracking.estimatedArrival,
          timeline: [...tracking.timeline],
          createdAt: tracking.createdAt,
          updatedAt: tracking.updatedAt,
        };
      }

      res.json({ success: true, data: tracking });
    } catch (error) {
      console.error('[Delivery Update Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update delivery status' });
    }
  });

  // Legacy route with orderId in path
  app.post('/api/delivery/tracking/:orderId/assign', (req, res) => {
    const { driverId, estimatedArrival } = req.body;
    res.json({
      success: true,
      data: {
        orderId: req.params.orderId,
        driverId,
        status: 'assigned',
        estimatedArrival: estimatedArrival || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  });

  // =====================================================
  // PAYMENTS API - DATABASE BACKED
  // =====================================================

  app.get('/api/payments', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      let allPayments = await pgDb.select().from(paymentsTable);

      // Filter by status if provided
      const status = req.query.status as string;
      if (status) {
        allPayments = allPayments.filter(p => p.status === status);
      }

      // Filter by method if provided
      const method = req.query.method as string;
      if (method) {
        allPayments = allPayments.filter(p => p.method === method);
      }

      // Sort by date (newest first)
      allPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Format for API response
      const formattedPayments = allPayments.map(p => ({
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.orderNumber,
        amount: parseFloat(String(p.amount)),
        currency: p.currency,
        method: p.method,
        status: p.status,
        cardBrand: p.cardBrand,
        cardLast4: p.cardLast4,
        cardExpiryMonth: p.cardExpiryMonth,
        cardExpiryYear: p.cardExpiryYear,
        gatewayTransactionId: p.gatewayTransactionId,
        refundedAmount: parseFloat(String(p.refundedAmount || '0')),
        refunds: p.refunds || [],
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      res.json({ success: true, data: formattedPayments });
    } catch (error) {
      console.error('[Payments Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payments' });
    }
  });

  app.get('/api/payments/stats', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allPayments = await pgDb.select().from(paymentsTable);

      const captured = allPayments.filter(p => p.status === 'captured');
      const pending = allPayments.filter(p => p.status === 'pending');
      const authorized = allPayments.filter(p => p.status === 'authorized');
      const refunded = allPayments.filter(p => p.status === 'refunded' || p.status === 'partially_refunded');

      const totalRevenue = captured.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
      const pendingAmount = pending.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
      const refundedAmount = refunded.reduce((sum, p) => sum + parseFloat(String(p.refundedAmount || '0')), 0);

      const cardPayments = allPayments.filter(p => p.method === 'card');
      const codPayments = allPayments.filter(p => p.method === 'cod');
      const bankPayments = allPayments.filter(p => p.method === 'bank_transfer');

      res.json({
        success: true,
        data: {
          totalPayments: allPayments.length,
          totalRevenue,
          pendingAmount,
          refundedAmount,
          byMethod: [
            { method: 'card', count: cardPayments.length, amount: cardPayments.reduce((s, p) => s + parseFloat(String(p.amount)), 0) },
            { method: 'cod', count: codPayments.length, amount: codPayments.reduce((s, p) => s + parseFloat(String(p.amount)), 0) },
            { method: 'bank_transfer', count: bankPayments.length, amount: bankPayments.reduce((s, p) => s + parseFloat(String(p.amount)), 0) },
          ],
          byStatus: [
            { status: 'captured', count: captured.length, amount: totalRevenue },
            { status: 'pending', count: pending.length, amount: pendingAmount },
            { status: 'authorized', count: authorized.length, amount: authorized.reduce((s, p) => s + parseFloat(String(p.amount)), 0) },
          ],
        },
      });
    } catch (error) {
      console.error('[Payments Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment stats' });
    }
  });

  app.post('/api/payments/:id/refund', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const paymentResult = await pgDb.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
      if (paymentResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      const payment = paymentResult[0];
      const { amount, reason } = req.body;
      const currentAmount = parseFloat(String(payment.amount));
      const currentRefunded = parseFloat(String(payment.refundedAmount || '0'));
      const newRefundedAmount = currentRefunded + amount;
      const newStatus = newRefundedAmount >= currentAmount ? 'refunded' : 'partially_refunded';

      const currentRefunds = (payment.refunds as any[]) || [];
      const newRefunds = [...currentRefunds, {
        id: `refund_${Date.now()}`,
        amount,
        reason,
        createdAt: new Date().toISOString(),
      }];

      await pgDb.update(paymentsTable)
        .set({
          status: newStatus,
          refundedAmount: String(newRefundedAmount),
          refunds: newRefunds,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, req.params.id));
      const [updated] = await pgDb.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));

      res.json({
        success: true,
        data: {
          ...updated,
          amount: parseFloat(String(updated.amount)),
          refundedAmount: parseFloat(String(updated.refundedAmount)),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Refund Error]', error);
      res.status(500).json({ success: false, error: 'Failed to process refund' });
    }
  });

  // Get payment by ID - DATABASE BACKED
  app.get('/api/payments/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const paymentResult = await pgDb.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
      if (paymentResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      const p = paymentResult[0];
      res.json({
        success: true,
        data: {
          id: p.id,
          orderId: p.orderId,
          orderNumber: p.orderNumber,
          amount: parseFloat(String(p.amount)),
          currency: p.currency,
          method: p.method,
          status: p.status,
          cardBrand: p.cardBrand,
          cardLast4: p.cardLast4,
          gatewayTransactionId: p.gatewayTransactionId,
          refundedAmount: parseFloat(String(p.refundedAmount || '0')),
          refunds: p.refunds || [],
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Payment Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment' });
    }
  });

  // Get payment by order ID - DATABASE BACKED
  app.get('/api/payments/order/:orderId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const paymentResult = await pgDb.select().from(paymentsTable).where(eq(paymentsTable.orderId, req.params.orderId));
      if (paymentResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Payment not found for this order' });
      }

      const p = paymentResult[0];
      res.json({
        success: true,
        data: {
          id: p.id,
          orderId: p.orderId,
          orderNumber: p.orderNumber,
          amount: parseFloat(String(p.amount)),
          currency: p.currency,
          method: p.method,
          status: p.status,
          cardBrand: p.cardBrand,
          cardLast4: p.cardLast4,
          gatewayTransactionId: p.gatewayTransactionId,
          refundedAmount: parseFloat(String(p.refundedAmount || '0')),
          refunds: p.refunds || [],
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Payment by Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment' });
    }
  });

  // Process payment - DATABASE BACKED
  app.post('/api/payments/process', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId, amount, method, currency = 'AED', saveCard } = req.body;

      if (!orderId || !amount || !method) {
        return res.status(400).json({ success: false, error: 'orderId, amount, and method are required' });
      }

      // Get order from database
      const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, orderId));
      const order = orderResult[0];

      const paymentId = `pay_${Date.now()}`;
      const now = new Date();
      const paymentStatus = method === 'cod' ? 'pending' : 'authorized';

      // Insert payment into database
      await pgDb.insert(paymentsTable).values({
        id: paymentId,
        orderId,
        orderNumber: order?.orderNumber || `ORD-${Date.now()}`,
        amount: String(amount),
        currency: currency as 'AED' | 'USD' | 'EUR',
        method: method as 'card' | 'cod' | 'bank_transfer',
        status: paymentStatus,
        gatewayTransactionId: `gtxn_${Date.now()}`,
        refundedAmount: '0',
        refunds: [],
        createdAt: now,
        updatedAt: now,
      });

      // Update order payment status in database
      if (order) {
        await pgDb.update(ordersTable)
          .set({
            paymentStatus: paymentStatus,
            updatedAt: now,
          })
          .where(eq(ordersTable.id, orderId));
      }

      const newPayment = {
        id: paymentId,
        orderId,
        orderNumber: order?.orderNumber || `ORD-${Date.now()}`,
        amount,
        currency,
        method,
        status: paymentStatus,
        gatewayTransactionId: `gtxn_${Date.now()}`,
        refundedAmount: 0,
        refunds: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      res.status(201).json({ success: true, data: newPayment });
    } catch (error) {
      console.error('[Process Payment Error]', error);
      res.status(500).json({ success: false, error: 'Failed to process payment' });
    }
  });

  // Capture payment (finalize after authorization) - DATABASE BACKED
  app.post('/api/payments/:id/capture', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const paymentResult = await pgDb.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
      if (paymentResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      const payment = paymentResult[0];

      if (payment.status !== 'authorized') {
        return res.status(400).json({ success: false, error: 'Payment must be authorized before capture' });
      }

      const now = new Date();

      // Update payment status
      await pgDb.update(paymentsTable)
        .set({
          status: 'captured',
          updatedAt: now,
        })
        .where(eq(paymentsTable.id, req.params.id));
      const [updated] = await pgDb.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));

      // Update order payment status
      await pgDb.update(ordersTable)
        .set({
          paymentStatus: 'captured',
          updatedAt: now,
        })
        .where(eq(ordersTable.id, payment.orderId));

      res.json({
        success: true,
        data: {
          ...updated,
          amount: parseFloat(String(updated.amount)),
          refundedAmount: parseFloat(String(updated.refundedAmount)),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
        message: 'Payment captured successfully'
      });
    } catch (error) {
      console.error('[Capture Payment Error]', error);
      res.status(500).json({ success: false, error: 'Failed to capture payment' });
    }
  });

  // Get all active delivery tracking
  app.get('/api/delivery/tracking', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { driverId, orderId, status } = req.query;

      let allTracking = await pgDb.select().from(deliveryTrackingTable);

      // Apply filters if provided
      if (driverId) {
        allTracking = allTracking.filter(t => t.driverId === driverId);
      }
      if (orderId) {
        allTracking = allTracking.filter(t => t.orderId === orderId);
      }
      if (status) {
        allTracking = allTracking.filter(t => t.status === status);
      }

      // Sort by creation date (newest first)
      allTracking.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Enrich tracking with order details
      const enrichedTracking = await Promise.all(allTracking.map(async (tracking) => {
        // Get order details
        const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, tracking.orderId));
        const order = orderResult[0];

        // Get order items
        const orderItems = order
          ? await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, tracking.orderId))
          : [];

        return {
          ...tracking,
          customerName: order?.customerName || 'Customer',
          customerMobile: order?.customerMobile || '',
          deliveryAddress: order?.deliveryAddress || { area: '', emirate: '', street: '', building: '' },
          deliveryNotes: order?.deliveryNotes || null,
          items: orderItems.map(i => ({
            name: i.productName,
            nameAr: i.productNameAr,
            quantity: Number(i.quantity)
          })),
          total: order ? Number(order.total) : 0,
          subtotal: order ? Number(order.subtotal) : 0,
          vatAmount: order ? Number(order.vatAmount) : 0,
          deliveryFee: order ? Number(order.deliveryFee) : 0,
          paymentMethod: order?.paymentMethod || 'cod',
          userId: order?.userId,
        };
      }));

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({ success: true, data: enrichedTracking });
    } catch (error) {
      console.error('[Get All Tracking Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracking' });
    }
  });

  // Get tracking by ID
  app.get('/api/delivery/tracking/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const trackingResult = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.id, req.params.id));
      if (trackingResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const tracking = trackingResult[0];

      // Enrich with order details
      const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, tracking.orderId));
      const order = orderResult[0];

      const orderItems = order
        ? await pgDb.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, tracking.orderId))
        : [];

      const enrichedTracking = {
        ...tracking,
        customerName: order?.customerName || 'Customer',
        customerMobile: order?.customerMobile || '',
        deliveryAddress: order?.deliveryAddress || { area: '', emirate: '', street: '', building: '' },
        deliveryNotes: order?.deliveryNotes || null,
        items: orderItems.map(i => ({
          name: i.productName,
          nameAr: i.productNameAr,
          quantity: Number(i.quantity)
        })),
        total: order ? Number(order.total) : 0,
        subtotal: order ? Number(order.subtotal) : 0,
        vatAmount: order ? Number(order.vatAmount) : 0,
        deliveryFee: order ? Number(order.deliveryFee) : 0,
        paymentMethod: order?.paymentMethod || 'cod',
      };

      res.json({ success: true, data: enrichedTracking });
    } catch (error) {
      console.error('[Get Tracking Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracking' });
    }
  });

  // Update tracking location (for driver app)
  app.patch('/api/delivery/tracking/:id/location', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const trackingResult = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.id, req.params.id));
      if (trackingResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const { latitude, longitude } = req.body;
      await pgDb.update(deliveryTrackingTable)
        .set({ updatedAt: new Date() })
        .where(eq(deliveryTrackingTable.id, req.params.id));
      const [updated] = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.id, req.params.id));

      res.json({ success: true, data: { ...updated, currentLocation: { latitude, longitude } } });
    } catch (error) {
      console.error('[Update Tracking Location Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update location' });
    }
  });

  // Update tracking status
  app.patch('/api/delivery/tracking/:id/status', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const trackingResult = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.id, req.params.id));
      if (trackingResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const tracking = trackingResult[0];
      const { status, notes } = req.body;
      const newTimeline = [...(tracking.timeline as any[] || []), {
        status,
        timestamp: new Date().toISOString(),
        notes,
      }];

      await pgDb.update(deliveryTrackingTable)
        .set({ status, timeline: newTimeline, updatedAt: new Date() })
        .where(eq(deliveryTrackingTable.id, req.params.id));
      const [updated] = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.id, req.params.id));

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[Update Tracking Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update status' });
    }
  });

  // Complete delivery
  app.post('/api/delivery/tracking/:id/complete', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const trackingResult = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.id, req.params.id));
      if (trackingResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const tracking = trackingResult[0];
      const { signature, photo, notes } = req.body;

      const newTimeline = [...(tracking.timeline as any[] || []), {
        status: 'delivered',
        timestamp: new Date().toISOString(),
        notes: notes || 'Delivery completed',
      }];

      // Update tracking status
      await pgDb.update(deliveryTrackingTable)
        .set({ status: 'delivered', timeline: newTimeline, updatedAt: new Date() })
        .where(eq(deliveryTrackingTable.id, req.params.id));
      const [updatedTracking] = await pgDb.select().from(deliveryTrackingTable).where(eq(deliveryTrackingTable.id, req.params.id));

      // Update order status
      const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, tracking.orderId));
      if (orderResult.length > 0) {
        const order = orderResult[0];
        const currentHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
        const newHistory = [...currentHistory, {
          status: 'delivered',
          changedAt: new Date().toISOString(),
          changedBy: tracking.driverId || 'driver',
        }];

        await pgDb.update(ordersTable)
          .set({
            status: 'delivered',
            statusHistory: newHistory,
            updatedAt: new Date(),
            actualDeliveryAt: new Date(),
            paymentStatus: (order.paymentMethod === 'cod' ? 'captured' : order.paymentStatus) as any
          })
          .where(eq(ordersTable.id, tracking.orderId));
      }

      res.json({
        success: true,
        data: updatedTracking,
        message: 'Delivery completed successfully'
      });
    } catch (error) {
      console.error('[Complete Delivery Error]', error);
      res.status(500).json({ success: false, error: 'Failed to complete delivery' });
    }
  });

  // Check delivery availability for area
  app.post('/api/delivery/check-availability', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { emirate, area } = req.body;

      const zones = await pgDb.select().from(deliveryZonesTable);
      const zone = zones.find(z =>
        z.isActive &&
        z.emirate === emirate &&
        (z.areas.includes(area) || z.areas.length === 0)
      );

      if (!zone) {
        return res.json({
          success: true,
          data: {
            available: false,
            message: 'Delivery not available in this area',
          },
        });
      }

      res.json({
        success: true,
        data: {
          available: true,
          zone: zone,
          deliveryFee: zone.deliveryFee,
          minimumOrder: zone.minimumOrder,
          estimatedMinutes: zone.estimatedMinutes,
        },
      });
    } catch (error) {
      console.error('[Check Availability Error]', error);
      res.status(500).json({ success: false, error: 'Failed to check availability' });
    }
  });

  // Get address by ID - DATABASE BACKED
  app.get('/api/delivery/addresses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const addressResult = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, req.params.id));
      if (addressResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }
      res.json({ success: true, data: addressResult[0] });
    } catch (error) {
      console.error('[Get Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch address' });
    }
  });

  // Set address as default - DATABASE BACKED
  app.post('/api/delivery/addresses/:id/set-default', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const addressResult = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, req.params.id));
      if (addressResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      const address = addressResult[0];

      // Unset other defaults for this user, set this one as default
      await pgDb.update(addressesTable)
        .set({ isDefault: false })
        .where(eq(addressesTable.userId, address.userId));

      await pgDb.update(addressesTable)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(addressesTable.id, req.params.id));
      const [updated] = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, req.params.id));

      res.json({ success: true, data: updated, message: 'Default address updated' });
    } catch (error) {
      console.error('[Set Default Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to set default address' });
    }
  });

  // =====================================================
  // USER ADDRESSES API (separate from delivery)
  // =====================================================

  // GET /api/addresses - Get all addresses for user - DATABASE BACKED
  app.get('/api/addresses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User ID required' });
      }

      const dbAddresses = await pgDb.select().from(addressesTable).where(eq(addressesTable.userId, userId));
      const formattedAddresses = dbAddresses.map(a => ({
        id: a.id,
        userId: a.userId,
        label: a.label,
        fullName: a.fullName,
        mobile: a.mobile,
        emirate: a.emirate,
        area: a.area,
        street: a.street,
        building: a.building,
        floor: a.floor,
        apartment: a.apartment,
        landmark: a.landmark,
        latitude: a.latitude,
        longitude: a.longitude,
        isDefault: a.isDefault,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }));
      res.json({ success: true, data: formattedAddresses });
    } catch (error) {
      console.error('[Addresses GET Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch addresses' });
    }
  });

  // POST /api/addresses - Create new address
  app.post('/api/addresses', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      console.log('[Addresses POST] Creating address for user:', userId);

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User ID required' });
      }

      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, isDefault } = req.body;

      // Validation
      if (!label || !fullName || !mobile || !emirate || !area || !street || !building) {
        return res.status(400).json({ success: false, error: 'Missing required fields: label, fullName, mobile, emirate, area, street, building' });
      }

      const addressId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      // Try database first if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          // If this is set as default, unset other defaults
          if (isDefault) {
            await pgDb.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, userId));
          }

          // Check if this is the first address
          const existingAddresses = await pgDb.select().from(addressesTable).where(eq(addressesTable.userId, userId));
          const shouldBeDefault = isDefault || existingAddresses.length === 0;

          // If first address, make it default
          if (shouldBeDefault && existingAddresses.length > 0) {
            await pgDb.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, userId));
          }

          const newAddressData = {
            id: addressId,
            userId,
            label,
            fullName,
            mobile,
            emirate,
            area,
            street,
            building,
            floor: floor || null,
            apartment: apartment || null,
            landmark: landmark || null,
            latitude: latitude || null,
            longitude: longitude || null,
            isDefault: shouldBeDefault,
            createdAt: now,
            updatedAt: now,
          };

          await pgDb.insert(addressesTable).values(newAddressData);
          console.log('[Addresses POST] Address created in DB:', addressId);

          return res.json({
            success: true,
            data: {
              ...newAddressData,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            },
          });
        } catch (dbError) {
          console.error('[Addresses POST DB Error]', dbError);
          return res.status(500).json({ success: false, error: 'Failed to create address in database' });
        }
      }

      // Fallback to in-memory
      // If this is set as default, unset other defaults
      if (isDefault) {
        addresses.forEach(addr => {
          if (addr.userId === userId) {
            addr.isDefault = false;
          }
        });
      }

      const existingUserAddresses = Array.from(addresses.values()).filter(a => a.userId === userId);
      const shouldBeDefaultMem = isDefault || existingUserAddresses.length === 0;

      const newAddress: Address = {
        id: addressId,
        userId,
        label,
        fullName,
        mobile,
        emirate,
        area,
        street,
        building,
        floor,
        apartment,
        landmark,
        latitude,
        longitude,
        isDefault: shouldBeDefaultMem,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      addresses.set(addressId, newAddress);
      console.log('[Addresses POST] Address created in memory:', addressId);

      res.json({ success: true, data: newAddress });
    } catch (error) {
      console.error('[Addresses POST Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create address' });
    }
  });

  // PUT /api/addresses/:id - Update address
  app.put('/api/addresses/:id', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User ID required' });
      }

      const { id } = req.params;
      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, isDefault } = req.body;

      // Try database first if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          const existing = await pgDb.select().from(addressesTable).where(and(eq(addressesTable.id, id), eq(addressesTable.userId, userId)));
          if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Address not found' });
          }

          // If setting as default, unset others
          if (isDefault) {
            await pgDb.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, userId));
          }

          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (label !== undefined) updateData.label = label;
          if (fullName !== undefined) updateData.fullName = fullName;
          if (mobile !== undefined) updateData.mobile = mobile;
          if (emirate !== undefined) updateData.emirate = emirate;
          if (area !== undefined) updateData.area = area;
          if (street !== undefined) updateData.street = street;
          if (building !== undefined) updateData.building = building;
          if (floor !== undefined) updateData.floor = floor;
          if (apartment !== undefined) updateData.apartment = apartment;
          if (landmark !== undefined) updateData.landmark = landmark;
          if (latitude !== undefined) updateData.latitude = latitude;
          if (longitude !== undefined) updateData.longitude = longitude;
          if (isDefault !== undefined) updateData.isDefault = isDefault;

          await pgDb.update(addressesTable).set(updateData).where(eq(addressesTable.id, id));

          const updated = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, id));
          return res.json({ success: true, data: updated[0] });
        } catch (dbError) {
          console.error('[Addresses PUT DB Error]', dbError);
          return res.status(500).json({ success: false, error: 'Failed to update address' });
        }
      }

      // Fallback to in-memory
      const address = addresses.get(id);
      if (!address || address.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      if (isDefault) {
        addresses.forEach(addr => {
          if (addr.userId === userId) {
            addr.isDefault = addr.id === id;
          }
        });
      }

      Object.assign(address, {
        label: label ?? address.label,
        fullName: fullName ?? address.fullName,
        mobile: mobile ?? address.mobile,
        emirate: emirate ?? address.emirate,
        area: area ?? address.area,
        street: street ?? address.street,
        building: building ?? address.building,
        floor: floor ?? address.floor,
        apartment: apartment ?? address.apartment,
        landmark: landmark ?? address.landmark,
        latitude: latitude ?? address.latitude,
        longitude: longitude ?? address.longitude,
        isDefault: isDefault ?? address.isDefault,
        updatedAt: new Date().toISOString(),
      });

      res.json({ success: true, data: address });
    } catch (error) {
      console.error('[Addresses PUT Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update address' });
    }
  });

  // DELETE /api/addresses/:id - Delete address
  app.delete('/api/addresses/:id', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User ID required' });
      }

      const { id } = req.params;

      // Try database first if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          const existing = await pgDb.select().from(addressesTable).where(and(eq(addressesTable.id, id), eq(addressesTable.userId, userId)));
          if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Address not found' });
          }

          const wasDefault = existing[0].isDefault;
          await pgDb.delete(addressesTable).where(eq(addressesTable.id, id));

          // If deleted address was default, make another one default
          if (wasDefault) {
            const remaining = await pgDb.select().from(addressesTable).where(eq(addressesTable.userId, userId)).limit(1);
            if (remaining.length > 0) {
              await pgDb.update(addressesTable).set({ isDefault: true }).where(eq(addressesTable.id, remaining[0].id));
            }
          }

          return res.json({ success: true, message: 'Address deleted' });
        } catch (dbError) {
          console.error('[Addresses DELETE DB Error]', dbError);
          return res.status(500).json({ success: false, error: 'Failed to delete address' });
        }
      }

      // Fallback to in-memory
      const address = addresses.get(id);
      if (!address || address.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      const wasDefault = address.isDefault;
      addresses.delete(id);

      // If deleted address was default, make another one default
      if (wasDefault) {
        const userAddresses = Array.from(addresses.values()).filter(a => a.userId === userId);
        if (userAddresses.length > 0) {
          userAddresses[0].isDefault = true;
        }
      }

      res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
      console.error('[Addresses DELETE Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete address' });
    }
  });

  // PUT /api/addresses/:id/default - Set address as default
  app.put('/api/addresses/:id/default', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User ID required' });
      }

      const { id } = req.params;

      // Try database first if available
      if (isDatabaseAvailable() && pgDb) {
        try {
          const existing = await pgDb.select().from(addressesTable).where(and(eq(addressesTable.id, id), eq(addressesTable.userId, userId)));
          if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Address not found' });
          }

          // Unset all defaults for this user
          await pgDb.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, userId));

          // Set this one as default
          await pgDb.update(addressesTable).set({ isDefault: true, updatedAt: new Date() }).where(eq(addressesTable.id, id));

          const updated = await pgDb.select().from(addressesTable).where(eq(addressesTable.id, id));
          return res.json({ success: true, data: updated[0] });
        } catch (dbError) {
          console.error('[Addresses Set Default DB Error]', dbError);
          return res.status(500).json({ success: false, error: 'Failed to set default address' });
        }
      }

      // Fallback to in-memory
      const address = addresses.get(id);
      if (!address || address.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      // Unset all defaults for this user
      addresses.forEach(addr => {
        if (addr.userId === userId) {
          addr.isDefault = addr.id === id;
        }
      });

      res.json({ success: true, data: address });
    } catch (error) {
      console.error('[Addresses Set Default Error]', error);
      res.status(500).json({ success: false, error: 'Failed to set default address' });
    }
  });

  // =====================================================
  // REPORTS API
  // =====================================================

  app.get('/api/reports/sales', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      // Only include orders with captured payments for accurate sales reporting
      const paidOrders = allOrders.filter(o => o.paymentStatus === 'captured' && o.status !== 'cancelled');
      const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalOrders = paidOrders.length;
      const totalVat = paidOrders.reduce((sum, o) => sum + parseFloat(String(o.vatAmount)), 0);
      const totalDiscount = paidOrders.reduce((sum, o) => sum + parseFloat(String(o.discount || 0)), 0);

      res.json({
        success: true,
        data: {
          period: 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          totalRevenue,
          totalSales: totalRevenue,
          totalOrders,
          totalVat,
          totalDiscount,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          revenueGrowth: 15.2,
          ordersGrowth: 10.5,
          topSellingProducts: [],
          revenueByDay: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            revenue: 1000 + Math.random() * 500,
            orders: 5 + Math.floor(Math.random() * 5),
          })),
        },
      });
    } catch (error) {
      console.error('[Sales Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate sales report' });
    }
  });

  app.get('/api/reports/sales-by-category', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [items, products] = await Promise.all([
        pgDb.select().from(orderItemsTable),
        pgDb.select().from(productsTable),
      ]);

      const productMap = new Map(products.map(p => [p.id, p]));
      const categoryMap = new Map<string, { category: string; totalSales: number; revenue: number; orders: Set<string> }>();

      items.forEach(item => {
        const product = productMap.get(item.productId);
        const category = product?.category || 'Uncategorized';
        const quantity = parseFloat(String(item.quantity));
        const revenue = parseFloat(String(item.totalPrice));

        const existing = categoryMap.get(category) || { category, totalSales: 0, revenue: 0, orders: new Set<string>() };
        existing.totalSales += quantity;
        existing.revenue += revenue;
        existing.orders.add(item.orderId);
        categoryMap.set(category, existing);
      });

      const totalRevenue = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.revenue, 0);
      const data = Array.from(categoryMap.values())
        .map(c => ({
          category: c.category,
          totalSales: c.totalSales,
          revenue: c.revenue,
          orders: c.orders.size,
          percentage: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      res.json({ success: true, data });
    } catch (error) {
      console.error('[Sales By Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales by category' });
    }
  });

  app.get('/api/reports/sales-by-product', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [items, products] = await Promise.all([
        pgDb.select().from(orderItemsTable),
        pgDb.select().from(productsTable),
      ]);

      const productMap = new Map(products.map(p => [p.id, p]));
      const productTotals = new Map<string, { productId: string; productName: string; quantitySold: number; revenue: number; category: string }>();

      items.forEach(item => {
        const product = productMap.get(item.productId);
        const quantity = parseFloat(String(item.quantity));
        const revenue = parseFloat(String(item.totalPrice));
        const entry = productTotals.get(item.productId) || {
          productId: item.productId,
          productName: item.productName || product?.name || 'Unknown',
          quantitySold: 0,
          revenue: 0,
          category: product?.category || 'Uncategorized',
        };
        entry.quantitySold += quantity;
        entry.revenue += revenue;
        productTotals.set(item.productId, entry);
      });

      const data = Array.from(productTotals.values()).sort((a, b) => b.revenue - a.revenue);
      res.json({ success: true, data });
    } catch (error) {
      console.error('[Sales By Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales by product' });
    }
  });

  app.get('/api/reports/customers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [customers, ordersData] = await Promise.all([
        pgDb.select().from(usersTable).where(eq(usersTable.role, 'customer')),
        pgDb.select().from(ordersTable),
      ]);

      const orderStats = new Map<string, { orders: number; revenue: number }>();
      ordersData.forEach(o => {
        const revenue = parseFloat(String(o.total));
        const stat = orderStats.get(o.userId) || { orders: 0, revenue: 0 };
        stat.orders += 1;
        stat.revenue += revenue;
        orderStats.set(o.userId, stat);
      });

      const totalCustomers = customers.length;
      const totalOrders = ordersData.length;
      const now = new Date();
      const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const newCustomers = customers.filter(c => c.createdAt && new Date(c.createdAt) >= last30).length;
      const returningCustomers = Array.from(orderStats.values()).filter(s => s.orders > 1).length;
      const averageOrdersPerCustomer = totalCustomers > 0 ? totalOrders / totalCustomers : 0;

      const topCustomers = customers
        .map(c => {
          const stats = orderStats.get(c.id) || { orders: 0, revenue: 0 };
          return {
            userId: c.id,
            name: `${c.firstName} ${c.familyName}`,
            totalOrders: stats.orders,
            totalSpent: stats.revenue,
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          totalCustomers,
          newCustomers,
          returningCustomers,
          customerRetentionRate: totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0,
          averageOrdersPerCustomer,
          topCustomers,
        },
      });
    } catch (error) {
      console.error('[Customers Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customer report' });
    }
  });

  app.get('/api/reports/inventory', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [products, stock] = await Promise.all([
        pgDb.select().from(productsTable),
        pgDb.select().from(stockTable),
      ]);

      const stockMap = new Map(stock.map(s => [s.productId, s]));
      const inStockItems = stock.filter(s => parseFloat(String(s.availableQuantity)) > 0);
      const lowStockItems = stock.filter(s => parseFloat(String(s.availableQuantity)) <= (s.lowStockThreshold || 0));
      const outOfStockItems = stock.filter(s => parseFloat(String(s.availableQuantity)) <= 0);

      const categoryMap = new Map<string, { category: string; count: number; value: number }>();
      products.forEach(p => {
        const stockItem = stockMap.get(p.id);
        const availableQty = stockItem ? parseFloat(String(stockItem.availableQuantity)) : 0;
        const value = availableQty * parseFloat(String(p.price));
        const entry = categoryMap.get(p.category) || { category: p.category, count: 0, value: 0 };
        entry.count += 1;
        entry.value += value;
        categoryMap.set(p.category, entry);
      });

      const totalValue = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.value, 0);

      res.json({
        success: true,
        data: {
          totalProducts: products.length,
          inStock: inStockItems.length,
          lowStock: lowStockItems.length,
          outOfStock: outOfStockItems.length,
          totalValue,
          categories: Array.from(categoryMap.values()).sort((a, b) => b.value - a.value),
        },
      });
    } catch (error) {
      console.error('[Inventory Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch inventory report' });
    }
  });

  app.get('/api/reports/orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      res.json({
        success: true,
        data: {
          period: 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          totalOrders: allOrders.length,
          statusBreakdown: {
            pending: allOrders.filter(o => o.status === 'pending').length,
            confirmed: allOrders.filter(o => o.status === 'confirmed').length,
            processing: allOrders.filter(o => o.status === 'processing').length,
            out_for_delivery: allOrders.filter(o => o.status === 'out_for_delivery').length,
            delivered: allOrders.filter(o => o.status === 'delivered').length,
            cancelled: allOrders.filter(o => o.status === 'cancelled').length,
          },
          paymentBreakdown: {
            card: allOrders.filter(o => o.paymentMethod === 'card').length,
            cod: allOrders.filter(o => o.paymentMethod === 'cod').length,
            bank_transfer: allOrders.filter(o => o.paymentMethod === 'bank_transfer').length,
          },
          sourceBreakdown: { web: allOrders.length, mobile: 0 },
          deliveryPerformance: {
            totalDelivered: allOrders.filter(o => o.status === 'delivered').length,
            onTimeDeliveries: allOrders.filter(o => o.status === 'delivered').length,
            onTimeDeliveryRate: 95,
            averageDeliveryTime: 45,
          },
          cancellationRate: 5,
        },
      });
    } catch (error) {
      console.error('[Orders Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate orders report' });
    }
  });

  // Sales timeseries report
  app.get('/api/reports/sales-timeseries', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { startDate, endDate, granularity = 'day' } = req.query;
      const allOrders = await pgDb.select().from(ordersTable);

      // Generate time series data
      const now = new Date();
      const days = granularity === 'hour' ? 1 : granularity === 'week' ? 28 : 7;
      const dataPoints = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dataPoints.push({
          date: dateStr,
          timestamp: date.toISOString(),
          revenue: 800 + Math.random() * 400,
          orders: 5 + Math.floor(Math.random() * 5),
          averageOrderValue: 150 + Math.random() * 50,
        });
      }

      res.json({
        success: true,
        data: {
          granularity,
          startDate: dataPoints[0]?.date,
          endDate: dataPoints[dataPoints.length - 1]?.date,
          dataPoints,
          summary: {
            totalRevenue: dataPoints.reduce((sum, d) => sum + d.revenue, 0),
            totalOrders: dataPoints.reduce((sum, d) => sum + d.orders, 0),
            averageOrderValue: 175,
          },
        },
      });
    } catch (error) {
      console.error('[Sales Timeseries Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate timeseries report' });
    }
  });

  // Export report
  app.post('/api/reports/export', (req, res) => {
    const { reportType, format = 'csv', startDate, endDate, filters } = req.body;

    // In a real app, this would generate and return the actual file
    const exportId = `export_${Date.now()}`;

    res.json({
      success: true,
      data: {
        exportId,
        reportType,
        format,
        status: 'processing',
        downloadUrl: `/api/reports/export/${exportId}/download`,
        createdAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 30000).toISOString(),
      },
      message: 'Export started successfully',
    });
  });

  // Get export status/download
  app.get('/api/reports/export/:id', (req, res) => {
    res.json({
      success: true,
      data: {
        exportId: req.params.id,
        status: 'completed',
        downloadUrl: `/api/reports/export/${req.params.id}/download`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    });
  });

  // Logout - also delete session from database
  app.post('/api/users/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      sessions.delete(token);
      // Also delete from database
      if (isDatabaseAvailable() && pgDb) {
        try {
          await pgDb.delete(sessionsTable).where(eq(sessionsTable.token, token));
        } catch (e) { /* ignore */ }
      }
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // NOTE: /api/users/me is defined earlier in the file (before /api/users/:id)

  // =====================================================
  // SETTINGS API
  // =====================================================

  // Default settings fallback
  const DEFAULT_SETTINGS_DATA = {
    settings: {
      id: 'default',
      vatRate: '0.05',
      deliveryFee: '15.00',
      freeDeliveryThreshold: '200.00',
      expressDeliveryFee: '25.00',
      minimumOrderAmount: '50.00',
      maxOrdersPerDay: 100,
      enableCashOnDelivery: true,
      enableCardPayment: true,
      enableWallet: true,
      enableLoyalty: true,
      enableReviews: true,
      enableWishlist: true,
      enableExpressDelivery: true,
      enableScheduledDelivery: true,
      enableWelcomeBonus: true,
      welcomeBonus: '50.00',
      cashbackPercentage: '2.00',
      loyaltyPointsPerAed: '1.00',
      loyaltyPointValue: '0.10',
      storePhone: '+971501234567',
      storeEmail: 'contact@butcher.ae',
      storeAddress: 'Dubai, UAE',
      storeAddressAr: 'دبي، الإمارات العربية المتحدة',
      workingHoursStart: '08:00',
      workingHoursEnd: '22:00',
    },
    banners: [],
    timeSlots: [],
    promoCodes: [],
  };

  app.get('/api/settings', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        // Fallback to static data if database not available
        return res.json({ success: true, data: DEFAULT_SETTINGS_DATA });
      }

      // Run all queries in PARALLEL for much faster response time
      const [settingsResult, bannersResult, timeSlotsResult, promoCodesResult] = await Promise.all([
        pgDb.select().from(appSettingsTable).where(eq(appSettingsTable.id, "default")).catch((e) => {
          console.error('[Settings fetch error]', e);
          return [];
        }),
        pgDb.select().from(bannersTable).catch((e) => {
          console.error('[Banners fetch error]', e);
          return [];
        }),
        pgDb.select().from(deliveryTimeSlotsTable).catch((e) => {
          console.error('[TimeSlots fetch error]', e);
          return [];
        }),
        pgDb.select().from(discountCodesTable).catch((e) => {
          console.error('[PromoCodes fetch error]', e);
          return [];
        }),
      ]);

      const settings = settingsResult.length > 0 ? settingsResult[0] as any : DEFAULT_SETTINGS_DATA.settings;

      res.json({
        success: true,
        data: {
          settings,
          banners: bannersResult,
          timeSlots: timeSlotsResult,
          promoCodes: promoCodesResult,
        },
      });
    } catch (error) {
      console.error('[Get Settings Error]', error);
      // Return default data instead of 500 error
      res.json({ success: true, data: DEFAULT_SETTINGS_DATA });
    }
  });

  app.put('/api/settings', (req, res) => {
    res.json({ success: true, data: req.body, message: 'Settings updated successfully' });
  });

  // =====================================================
  // BANNERS API
  // =====================================================

  // POST /api/settings/banners - Create banner
  app.post('/api/settings/banners', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { titleEn, titleAr, subtitleEn, subtitleAr, image, bgColor, link, badge, badgeAr, enabled } = req.body;

      // Get existing banners count for sortOrder
      const existing = await pgDb.select().from(bannersTable);
      const sortOrder = existing.length;

      const newBanner = {
        id: generateId("banner"),
        titleEn,
        titleAr,
        subtitleEn,
        subtitleAr,
        image,
        bgColor: bgColor || "from-red-800 to-red-900",
        link,
        badge,
        badgeAr,
        enabled: enabled !== false,
        sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await pgDb.insert(bannersTable).values(newBanner);

      res.status(201).json({
        success: true,
        data: {
          ...newBanner,
          createdAt: newBanner.createdAt.toISOString(),
          updatedAt: newBanner.updatedAt.toISOString(),
        },
        message: 'Banner created successfully',
      });
    } catch (error) {
      console.error('[Create Banner Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create banner' });
    }
  });

  // PUT /api/settings/banners/:id - Update banner
  app.put('/api/settings/banners/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const updates = req.body;

      await pgDb.update(bannersTable).set({
        ...updates,
        updatedAt: new Date(),
      }).where(eq(bannersTable.id, id));

      const updated = await pgDb.select().from(bannersTable).where(eq(bannersTable.id, id));

      res.json({
        success: true,
        data: updated[0],
        message: 'Banner updated successfully',
      });
    } catch (error) {
      console.error('[Update Banner Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update banner' });
    }
  });

  // DELETE /api/settings/banners/:id - Delete banner
  app.delete('/api/settings/banners/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await pgDb.delete(bannersTable).where(eq(bannersTable.id, id));

      res.json({
        success: true,
        message: 'Banner deleted successfully',
      });
    } catch (error) {
      console.error('[Delete Banner Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete banner' });
    }
  });

  // =====================================================
  // TIME SLOTS API
  // =====================================================

  // POST /api/settings/time-slots - Create time slot
  app.post('/api/settings/time-slots', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { label, labelAr, startTime, endTime, isExpressSlot, maxOrders, enabled } = req.body;

      const existing = await pgDb.select().from(deliveryTimeSlotsTable);
      const sortOrder = existing.length;

      const newSlot = {
        id: generateId("slot"),
        label,
        labelAr,
        startTime,
        endTime,
        isExpressSlot: isExpressSlot || false,
        maxOrders: maxOrders || 20,
        enabled: enabled !== false,
        sortOrder,
        createdAt: new Date(),
      };

      await pgDb.insert(deliveryTimeSlotsTable).values(newSlot);

      res.status(201).json({
        success: true,
        data: { ...newSlot, createdAt: newSlot.createdAt.toISOString() },
        message: 'Time slot created successfully',
      });
    } catch (error) {
      console.error('[Create Time Slot Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create time slot' });
    }
  });

  // PUT /api/settings/time-slots/:id - Update time slot
  app.put('/api/settings/time-slots/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await pgDb.update(deliveryTimeSlotsTable).set(req.body).where(eq(deliveryTimeSlotsTable.id, id));
      const updated = await pgDb.select().from(deliveryTimeSlotsTable).where(eq(deliveryTimeSlotsTable.id, id));

      res.json({
        success: true,
        data: updated[0],
        message: 'Time slot updated successfully',
      });
    } catch (error) {
      console.error('[Update Time Slot Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update time slot' });
    }
  });

  // DELETE /api/settings/time-slots/:id - Delete time slot
  app.delete('/api/settings/time-slots/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await pgDb.delete(deliveryTimeSlotsTable).where(eq(deliveryTimeSlotsTable.id, id));

      res.json({
        success: true,
        message: 'Time slot deleted successfully',
      });
    } catch (error) {
      console.error('[Delete Time Slot Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete time slot' });
    }
  });

  // =====================================================
  // PROMO CODES API
  // =====================================================

  // POST /api/settings/promo-codes - Create promo code
  app.post('/api/settings/promo-codes', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { code, type, value, minimumOrder, maximumDiscount, usageLimit, userLimit, validFrom, validTo, applicableProducts, applicableCategories } = req.body;

      const newCode = {
        id: generateId("promo"),
        code: code.toUpperCase(),
        type,
        value: String(value),
        minimumOrder: String(minimumOrder || 0),
        maximumDiscount: maximumDiscount ? String(maximumDiscount) : null,
        usageLimit: usageLimit || 0,
        usageCount: 0,
        userLimit: userLimit || 1,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        isActive: true,
        applicableProducts,
        applicableCategories,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await pgDb.insert(discountCodesTable).values(newCode);

      res.status(201).json({
        success: true,
        data: { ...newCode, validFrom: newCode.validFrom.toISOString(), validTo: newCode.validTo.toISOString(), createdAt: newCode.createdAt.toISOString(), updatedAt: newCode.updatedAt.toISOString() },
        message: 'Promo code created successfully',
      });
    } catch (error) {
      console.error('[Create Promo Code Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create promo code' });
    }
  });

  // PUT /api/settings/promo-codes/:id - Update promo code
  app.put('/api/settings/promo-codes/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const updates = { ...req.body };

      if (updates.value) updates.value = String(updates.value);
      if (updates.minimumOrder) updates.minimumOrder = String(updates.minimumOrder);
      if (updates.maximumDiscount) updates.maximumDiscount = String(updates.maximumDiscount);
      if (updates.validFrom) updates.validFrom = new Date(updates.validFrom);
      if (updates.validTo) updates.validTo = new Date(updates.validTo);
      updates.updatedAt = new Date();

      await pgDb.update(discountCodesTable).set(updates).where(eq(discountCodesTable.id, id));
      const updated = await pgDb.select().from(discountCodesTable).where(eq(discountCodesTable.id, id));

      res.json({
        success: true,
        data: updated[0],
        message: 'Promo code updated successfully',
      });
    } catch (error) {
      console.error('[Update Promo Code Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update promo code' });
    }
  });

  // DELETE /api/settings/promo-codes/:id - Delete promo code
  app.delete('/api/settings/promo-codes/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await pgDb.delete(discountCodesTable).where(eq(discountCodesTable.id, id));

      res.json({
        success: true,
        message: 'Promo code deleted successfully',
      });
    } catch (error) {
      console.error('[Delete Promo Code Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete promo code' });
    }
  });

  // POST /api/settings/promo-codes/validate - Validate promo code
  app.post('/api/settings/promo-codes/validate', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { code, orderTotal } = req.body;

      const promoCode = await pgDb.select().from(discountCodesTable).where(eq(discountCodesTable.code, code.toUpperCase()));

      if (promoCode.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid promo code' });
      }

      const promo = promoCode[0];

      if (!promo.isActive) {
        return res.status(400).json({ success: false, error: 'This promo code is no longer active' });
      }

      const now = new Date();
      if (now < promo.validFrom || now > promo.validTo) {
        return res.status(400).json({ success: false, error: 'This promo code has expired' });
      }

      if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
        return res.status(400).json({ success: false, error: 'This promo code has reached its usage limit' });
      }

      if (orderTotal < parseFloat(String(promo.minimumOrder))) {
        return res.status(400).json({
          success: false,
          error: `Minimum order of ${parseFloat(String(promo.minimumOrder))} AED required`
        });
      }

      let discount = 0;
      if (promo.type === "percentage") {
        discount = orderTotal * (parseFloat(String(promo.value)) / 100);
        if (promo.maximumDiscount && discount > parseFloat(String(promo.maximumDiscount))) {
          discount = parseFloat(String(promo.maximumDiscount));
        }
      } else {
        discount = parseFloat(String(promo.value));
      }

      res.json({
        success: true,
        data: {
          valid: true,
          code: promo.code,
          type: promo.type,
          value: parseFloat(String(promo.value)),
          discount: Math.round(discount * 100) / 100,
        },
      });
    } catch (error) {
      console.error('[Validate Promo Code Error]', error);
      res.status(500).json({ success: false, error: 'Failed to validate promo code' });
    }
  });

  // =====================================================
  // REVIEWS API
  // =====================================================

  app.get('/api/reviews', (req, res) => {
    res.json({ success: true, data: [] });
  });

  app.get('/api/reviews/product/:productId', (req, res) => {
    res.json({ success: true, data: { reviews: [], stats: { averageRating: 0, totalReviews: 0 } } });
  });

  app.post('/api/reviews', (req, res) => {
    const newReview = { id: `review_${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
    res.status(201).json({ success: true, data: newReview });
  });

  app.put('/api/reviews/:id', (req, res) => {
    res.json({ success: true, data: { id: req.params.id, ...req.body } });
  });

  app.delete('/api/reviews/:id', (req, res) => {
    res.json({ success: true, message: 'Review deleted successfully' });
  });

  // =====================================================
  // WALLET API
  // =====================================================

  app.get('/api/wallet', (req, res) => {
    res.json({
      success: true,
      data: {
        balance: 0,
        transactions: [],
      },
    });
  });

  app.post('/api/wallet/topup', (req, res) => {
    const { amount } = req.body;
    res.json({ success: true, data: { balance: amount, transaction: { id: `txn_${Date.now()}`, amount, type: 'topup', createdAt: new Date().toISOString() } } });
  });

  app.post('/api/wallet/deduct', (req, res) => {
    const { amount } = req.body;
    res.json({ success: true, data: { balance: 0, transaction: { id: `txn_${Date.now()}`, amount, type: 'deduct', createdAt: new Date().toISOString() } } });
  });

  app.post('/api/wallet/credit', (req, res) => {
    const { amount } = req.body;
    res.json({ success: true, data: { balance: amount, transaction: { id: `txn_${Date.now()}`, amount, type: 'credit', createdAt: new Date().toISOString() } } });
  });

  // =====================================================
  // WISHLIST API
  // =====================================================

  app.get('/api/wishlist', (req, res) => {
    res.json({ success: true, data: [] });
  });

  app.post('/api/wishlist', (req, res) => {
    const { productId } = req.body;
    res.status(201).json({ success: true, data: { id: `wishlist_${Date.now()}`, productId, createdAt: new Date().toISOString() } });
  });

  app.delete('/api/wishlist/:productId', (req, res) => {
    res.json({ success: true, message: 'Item removed from wishlist' });
  });

  app.delete('/api/wishlist', (req, res) => {
    res.json({ success: true, message: 'Wishlist cleared' });
  });

  // =====================================================
  // LOYALTY API
  // =====================================================

  app.get('/api/loyalty', (req, res) => {
    res.json({
      success: true,
      data: {
        points: 0,
        totalEarned: 0,
        referralCode: 'REF000',
        currentTier: {
          id: 'bronze',
          name: 'Bronze',
          nameAr: 'برونزي',
          minPoints: 0,
          multiplier: '1.0',
          benefits: ['1 point per AED spent', 'Birthday bonus'],
          benefitsAr: ['1 نقطة لكل درهم', 'مكافأة عيد ميلاد'],
          icon: '🥉',
          sortOrder: 1,
        },
        nextTier: {
          id: 'silver',
          name: 'Silver',
          nameAr: 'فضي',
          minPoints: 1000,
          multiplier: '1.25',
          benefits: ['1.25 points per AED', 'Free delivery on all orders', 'Priority support'],
          benefitsAr: ['1.25 نقطة لكل درهم', 'توصيل مجاني لجميع الطلبات', 'دعم أولوية'],
          icon: '🥈',
          sortOrder: 2,
        },
        pointsToNextTier: 1000,
        transactions: [],
      },
    });
  });

  app.post('/api/loyalty/earn', (req, res) => {
    const { points } = req.body;
    res.json({ success: true, data: { points, transaction: { id: `loyalty_${Date.now()}`, points, type: 'earn', createdAt: new Date().toISOString() } } });
  });

  app.post('/api/loyalty/redeem', (req, res) => {
    const { points } = req.body;
    res.json({ success: true, data: { points: 0, transaction: { id: `loyalty_${Date.now()}`, points, type: 'redeem', createdAt: new Date().toISOString() } } });
  });

  app.get('/api/loyalty/tiers', (req, res) => {
    res.json({
      success: true,
      data: [
        { name: 'bronze', minPoints: 0, benefits: [] },
        { name: 'silver', minPoints: 1000, benefits: [] },
        { name: 'gold', minPoints: 5000, benefits: [] },
      ],
    });
  });

  // =====================================================
  // NOTIFICATIONS API
  // =====================================================

  // Get all notifications for a user
  app.get('/api/notifications', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const notifications = await pgDb
        .select()
        .from(inAppNotificationsTable)
        .where(eq(inAppNotificationsTable.userId, String(userId)))
        .orderBy(desc(inAppNotificationsTable.createdAt));

      const formattedNotifications = notifications.map(n => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        titleAr: n.titleAr,
        message: n.message,
        messageAr: n.messageAr,
        link: n.link,
        linkTab: n.linkTab,
        linkId: n.linkId,
        unread: n.unread,
        createdAt: n.createdAt?.toISOString(),
      }));

      res.json({ success: true, data: formattedNotifications });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  });

  // Create a new notification
  app.post('/api/notifications', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, type, title, titleAr, message, messageAr, link, linkTab, linkId } = req.body;

      if (!userId || !type || !title || !message) {
        return res.status(400).json({ success: false, error: 'userId, type, title, and message are required' });
      }

      const newNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: String(userId),
        type: type || 'general',
        title: title || '',
        titleAr: titleAr || title || '',
        message: message || '',
        messageAr: messageAr || message || '',
        link: link || null,
        linkTab: linkTab || null,
        linkId: linkId || null,
        unread: true,
      };

      await pgDb.insert(inAppNotificationsTable).values(newNotification);

      res.status(201).json({
        success: true,
        data: {
          ...newNotification,
          createdAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({ success: false, error: 'Failed to create notification' });
    }
  });

  // Mark all notifications as read for a user (MUST come before /:id/read)
  app.patch('/api/notifications/read-all', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      await pgDb
        .update(inAppNotificationsTable)
        .set({ unread: false })
        .where(eq(inAppNotificationsTable.userId, String(userId)));

      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
    }
  });

  // Mark a notification as read
  app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;

      await pgDb
        .update(inAppNotificationsTable)
        .set({ unread: false })
        .where(eq(inAppNotificationsTable.id, id));

      res.json({ success: true, data: { id, isRead: true } });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
  });

  // Delete a notification
  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;

      await pgDb
        .delete(inAppNotificationsTable)
        .where(eq(inAppNotificationsTable.id, id));

      res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ success: false, error: 'Failed to delete notification' });
    }
  });

  // Delete all notifications for a user
  app.delete('/api/notifications', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      await pgDb
        .delete(inAppNotificationsTable)
        .where(eq(inAppNotificationsTable.userId, String(userId)));

      res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
      console.error('Error clearing notifications:', error);
      res.status(500).json({ success: false, error: 'Failed to clear notifications' });
    }
  });

  // =====================================================
  // CHAT MESSAGE NOTIFICATIONS API
  // =====================================================

  // Create notification when admin sends a chat message to user
  app.post('/api/chat/notify-user', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, message } = req.body;

      if (!userId || !message) {
        return res.status(400).json({ success: false, error: 'userId and message are required' });
      }

      // Create notification for the user
      await pgDb.insert(inAppNotificationsTable).values({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: String(userId),
        type: 'chat',
        title: 'New Message from Support',
        titleAr: 'رسالة جديدة من الدعم',
        message: message.length > 100 ? message.substring(0, 100) + '...' : message,
        messageAr: message.length > 100 ? message.substring(0, 100) + '...' : message,
        link: '/profile',
        linkTab: 'chat',
        linkId: null,
        unread: true,
      });

      res.json({ success: true, message: 'User notified' });
    } catch (error) {
      console.error('[Chat User Notification Error]', error);
      res.status(500).json({ success: false, error: 'Failed to notify user' });
    }
  });

  // Create notification when user sends a chat message to admin
  app.post('/api/chat/notify-admin', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, userName, message } = req.body;

      if (!userId || !message) {
        return res.status(400).json({ success: false, error: 'userId and message are required' });
      }

      // Create notification for the admin
      await pgDb.insert(inAppNotificationsTable).values({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: 'admin',
        type: 'chat',
        title: `New Message from ${userName || 'Customer'}`,
        titleAr: `رسالة جديدة من ${userName || 'عميل'}`,
        message: message.length > 100 ? message.substring(0, 100) + '...' : message,
        messageAr: message.length > 100 ? message.substring(0, 100) + '...' : message,
        link: '/admin/support',
        linkTab: 'support',
        linkId: userId,
        unread: true,
      });

      res.json({ success: true, message: 'Admin notified' });
    } catch (error) {
      console.error('[Chat Admin Notification Error]', error);
      res.status(500).json({ success: false, error: 'Failed to notify admin' });
    }
  });

  // =====================================================
  // CHAT MESSAGES API (Server-side storage)
  // =====================================================

  // Get all chats for admin (grouped by user)
  app.get('/api/chat/all', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const messages = await pgDb
        .select()
        .from(chatMessagesTable)
        .orderBy(desc(chatMessagesTable.createdAt));

      // Group messages by userId
      const chatsMap = new Map<string, {
        userId: string;
        userName: string;
        userEmail: string;
        messages: typeof messages;
        lastMessageAt: string;
        unreadCount: number;
      }>();

      for (const msg of messages) {
        if (!chatsMap.has(msg.userId)) {
          chatsMap.set(msg.userId, {
            userId: msg.userId,
            userName: msg.userName,
            userEmail: msg.userEmail,
            messages: [],
            lastMessageAt: msg.createdAt.toISOString(),
            unreadCount: 0,
          });
        }
        const chat = chatsMap.get(msg.userId)!;
        // Serialize message with proper date format
        chat.messages.push({
          ...msg,
          createdAt: msg.createdAt, // Keep as Date object
        });
        if (msg.sender === 'user' && !msg.readByAdmin) {
          chat.unreadCount++;
        }
      }

      // Convert to array and sort by lastMessageAt descending
      const chats = Array.from(chatsMap.values())
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      res.json({ success: true, data: chats });
    } catch (error) {
      console.error('[Chat All Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chats' });
    }
  });

  // Get chat messages for a specific user
  app.get('/api/chat/:userId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.params;

      const messages = await pgDb
        .select()
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.userId, userId))
        .orderBy(chatMessagesTable.createdAt);

      // Convert Date objects to ISO strings for JSON serialization
      const serializedMessages = messages.map(msg => ({
        ...msg,
        createdAt: msg.createdAt.toISOString(),
      }));

      res.json({ success: true, data: serializedMessages });
    } catch (error) {
      console.error('[Chat Get Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
  });

  // Send a message (from user or admin)
  app.post('/api/chat/send', async (req, res) => {
    try {
      console.log('[Chat Send] Request received:', JSON.stringify(req.body));

      if (!isDatabaseAvailable() || !pgDb) {
        console.log('[Chat Send] Database not available');
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, userName, userEmail, text, sender, attachments } = req.body;

      if (!userId || !text || !sender) {
        console.log('[Chat Send] Missing required fields:', { userId, text, sender });
        return res.status(400).json({ success: false, error: 'userId, text, and sender are required' });
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('[Chat Send] Inserting message:', messageId);

      await pgDb.insert(chatMessagesTable).values({
        id: messageId,
        userId: String(userId),
        userName: userName || 'Customer',
        userEmail: userEmail || '',
        text,
        sender,
        attachments: attachments || null,
        readByAdmin: sender === 'admin',
        readByUser: sender === 'user',
      });

      const [newMessage] = await pgDb
        .select()
        .from(chatMessagesTable)
        .where(eq(chatMessagesTable.id, messageId));

      // Serialize date for JSON response
      const serializedMessage = {
        ...newMessage,
        createdAt: newMessage.createdAt.toISOString(),
      };

      res.json({ success: true, data: serializedMessage });
    } catch (error) {
      console.error('[Chat Send Error]', error);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });

  // Mark messages as read by admin
  app.post('/api/chat/:userId/read-admin', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.params;

      await pgDb
        .update(chatMessagesTable)
        .set({ readByAdmin: true })
        .where(and(
          eq(chatMessagesTable.userId, userId),
          eq(chatMessagesTable.sender, 'user')
        ));

      res.json({ success: true });
    } catch (error) {
      console.error('[Chat Read Admin Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark as read' });
    }
  });

  // Mark messages as read by user
  app.post('/api/chat/:userId/read-user', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.params;

      await pgDb
        .update(chatMessagesTable)
        .set({ readByUser: true })
        .where(and(
          eq(chatMessagesTable.userId, userId),
          eq(chatMessagesTable.sender, 'admin')
        ));

      res.json({ success: true });
    } catch (error) {
      console.error('[Chat Read User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark as read' });
    }
  });

  // =====================================================
  // FINANCE API - DATABASE BACKED
  // =====================================================

  // Finance summary - calculates from real database data
  app.get('/api/finance/summary', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Get orders for revenue calculation
      const allOrders = await pgDb.select().from(ordersTable);
      const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalVAT = allOrders.reduce((sum, o) => sum + parseFloat(String(o.vatAmount)), 0);

      // Get expenses from database
      const allExpenses = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.status, 'paid'));
      const totalExpenses = allExpenses.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0);

      // Get account balances
      const accounts = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.isActive, true));
      const accountBalances = accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: parseFloat(String(a.balance))
      }));

      const grossProfit = totalRevenue * 0.35;
      const netProfit = grossProfit - totalExpenses;

      // Calculate payment method breakdown
      const paymentMethodBreakdown = allOrders.reduce((acc, o) => {
        const method = o.paymentMethod || 'card';
        if (!acc[method]) acc[method] = { amount: 0, count: 0 };
        acc[method].amount += parseFloat(String(o.total));
        acc[method].count += 1;
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      // Calculate expenses by category
      const expensesByCategory = allExpenses.reduce((acc, e) => {
        const cat = e.category || 'other';
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += parseFloat(String(e.amount));
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        data: {
          period: req.query.period || 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          totalRevenue,
          totalCOGS: totalRevenue * 0.65,
          grossProfit,
          grossProfitMargin: 35,
          totalExpenses,
          netProfit,
          netProfitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
          totalRefunds: 0,
          totalVAT,
          vatCollected: totalVAT,
          vatPaid: 0,
          vatDue: totalVAT,
          cashFlow: { inflow: totalRevenue, outflow: totalExpenses, net: totalRevenue - totalExpenses },
          revenueByPaymentMethod: Object.entries(paymentMethodBreakdown).map(([method, stats]) => ({
            method,
            amount: stats.amount,
            count: stats.count
          })),
          expensesByCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({
            category,
            amount
          })),
          accountBalances,
        },
      });
    } catch (error) {
      console.error('[Finance Summary Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch finance summary' });
    }
  });

  // Finance transactions - get from database
  app.get('/api/finance/transactions', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const transactions = await pgDb.select().from(financeTransactionsTable).orderBy(desc(financeTransactionsTable.createdAt)).limit(100);
      res.json({ success: true, data: transactions });
    } catch (error) {
      console.error('[Finance Transactions Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
  });

  // Get transaction by ID
  app.get('/api/finance/transactions/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [transaction] = await pgDb.select().from(financeTransactionsTable).where(eq(financeTransactionsTable.id, req.params.id)).limit(1);
      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }
      res.json({ success: true, data: transaction });
    } catch (error) {
      console.error('[Get Transaction Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
    }
  });

  // Finance accounts - DATABASE BACKED
  app.get('/api/finance/accounts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const accounts = await pgDb.select().from(financeAccountsTable).orderBy(financeAccountsTable.name);
      res.json({ success: true, data: accounts });
    } catch (error) {
      console.error('[Finance Accounts Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch accounts' });
    }
  });

  // Get finance account by ID
  app.get('/api/finance/accounts/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [account] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, req.params.id)).limit(1);
      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      res.json({ success: true, data: account });
    } catch (error) {
      console.error('[Get Account Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch account' });
    }
  });

  // Create finance account
  app.post('/api/finance/accounts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { name, nameAr, type, currency, bankName, accountNumber, iban, isActive } = req.body;

      if (!name || !type) {
        return res.status(400).json({ success: false, error: 'Name and type are required' });
      }

      const accountId = generateAccountId();
      await pgDb.insert(financeAccountsTable).values({
        id: accountId,
        name,
        nameAr,
        type: type as any,
        balance: '0',
        currency: currency || 'AED',
        isActive: isActive ?? true,
        bankName,
        accountNumber,
        iban,
      });
      const [newAccount] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, accountId));

      res.status(201).json({ success: true, data: newAccount, message: 'Account created successfully' });
    } catch (error) {
      console.error('[Create Account Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create account' });
    }
  });

  // Update finance account
  app.put('/api/finance/accounts/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [existing] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, req.params.id)).limit(1);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }

      const { name, nameAr, type, balance, currency, bankName, accountNumber, iban, isActive } = req.body;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      if (name !== undefined) updateData.name = name;
      if (nameAr !== undefined) updateData.nameAr = nameAr;
      if (type !== undefined) updateData.type = type;
      if (balance !== undefined) updateData.balance = String(balance);
      if (currency !== undefined) updateData.currency = currency;
      if (bankName !== undefined) updateData.bankName = bankName;
      if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
      if (iban !== undefined) updateData.iban = iban;
      if (isActive !== undefined) updateData.isActive = isActive;

      await pgDb.update(financeAccountsTable)
        .set(updateData)
        .where(eq(financeAccountsTable.id, req.params.id));
      const [updated] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, req.params.id));

      res.json({ success: true, data: updated, message: 'Account updated successfully' });
    } catch (error) {
      console.error('[Update Account Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update account' });
    }
  });

  // Transfer between accounts
  app.post('/api/finance/accounts/transfer', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { fromAccountId, toAccountId, amount, description } = req.body;

      if (!fromAccountId || !toAccountId || !amount) {
        return res.status(400).json({ success: false, error: 'fromAccountId, toAccountId, and amount are required' });
      }

      const transferAmount = parseFloat(String(amount));

      // Get both accounts
      const [fromAccount] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, fromAccountId)).limit(1);
      const [toAccount] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, toAccountId)).limit(1);

      if (!fromAccount || !toAccount) {
        return res.status(404).json({ success: false, error: 'One or both accounts not found' });
      }

      const fromBalance = parseFloat(String(fromAccount.balance));
      const toBalance = parseFloat(String(toAccount.balance));

      if (fromBalance < transferAmount) {
        return res.status(400).json({ success: false, error: 'Insufficient balance in source account' });
      }

      // Update balances
      await pgDb.update(financeAccountsTable)
        .set({ balance: String(fromBalance - transferAmount), updatedAt: new Date() })
        .where(eq(financeAccountsTable.id, fromAccountId));

      await pgDb.update(financeAccountsTable)
        .set({ balance: String(toBalance + transferAmount), updatedAt: new Date() })
        .where(eq(financeAccountsTable.id, toAccountId));

      // Record the transfer as a transaction
      const txnId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(financeTransactionsTable).values({
        id: txnId,
        type: 'adjustment',
        status: 'completed',
        amount: String(transferAmount),
        currency: 'AED',
        description: description || `Transfer from ${fromAccount.name} to ${toAccount.name}`,
        reference: txnId,
        referenceType: 'transfer',
        accountId: fromAccountId,
        accountName: fromAccount.name,
        createdBy: 'system',
      });

      res.json({
        success: true,
        data: {
          fromAccountId,
          toAccountId,
          amount: transferAmount,
          transferredAt: new Date().toISOString()
        },
        message: 'Transfer completed successfully'
      });
    } catch (error) {
      console.error('[Transfer Error]', error);
      res.status(500).json({ success: false, error: 'Failed to transfer between accounts' });
    }
  });

  // Reconcile account
  app.post('/api/finance/accounts/:id/reconcile', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [existing] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, req.params.id)).limit(1);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }

      await pgDb.update(financeAccountsTable)
        .set({ lastReconciled: new Date(), updatedAt: new Date() })
        .where(eq(financeAccountsTable.id, req.params.id));
      const [updated] = await pgDb.select().from(financeAccountsTable).where(eq(financeAccountsTable.id, req.params.id));

      res.json({ success: true, data: updated, message: 'Account reconciled successfully' });
    } catch (error) {
      console.error('[Reconcile Error]', error);
      res.status(500).json({ success: false, error: 'Failed to reconcile account' });
    }
  });

  // Finance expenses - DATABASE BACKED
  app.get('/api/finance/expenses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { status, category, vendorId, startDate, endDate } = req.query;

      let expenses = await pgDb.select().from(financeExpensesTable).orderBy(desc(financeExpensesTable.createdAt));

      // Apply filters
      if (status && typeof status === 'string') {
        expenses = expenses.filter(e => e.status === status);
      }
      if (category && typeof category === 'string') {
        expenses = expenses.filter(e => e.category === category);
      }
      if (vendorId && typeof vendorId === 'string') {
        expenses = expenses.filter(e => e.vendorId === vendorId);
      }
      if (startDate && typeof startDate === 'string') {
        const start = new Date(startDate);
        expenses = expenses.filter(e => e.createdAt >= start);
      }
      if (endDate && typeof endDate === 'string') {
        const end = new Date(endDate);
        expenses = expenses.filter(e => e.createdAt <= end);
      }

      res.json({ success: true, data: expenses });
    } catch (error) {
      console.error('[Finance Expenses Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
    }
  });

  // Get expense by ID
  app.get('/api/finance/expenses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [expense] = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.id, req.params.id)).limit(1);
      if (!expense) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }
      res.json({ success: true, data: expense });
    } catch (error) {
      console.error('[Get Expense Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expense' });
    }
  });

  // Create expense
  app.post('/api/finance/expenses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const {
        category, description, descriptionAr, grossAmount, vatRate, isVatRecoverable,
        vendor, vendorId, vendorTrn, invoiceNumber, invoiceDate, paymentTerms, dueDate,
        costCenterId, costCenterName, departmentId, departmentName, accountId, notes, attachments, tags
      } = req.body;

      if (!category || !description || !grossAmount) {
        return res.status(400).json({ success: false, error: 'Category, description, and grossAmount are required' });
      }

      const gross = parseFloat(String(grossAmount));
      const vat = vatRate ? (gross * parseFloat(String(vatRate)) / 100) : (gross * 0.05);
      const amount = gross + (isVatRecoverable ? 0 : vat);

      const expenseNumber = await generateExpenseNumber();

      const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(financeExpensesTable).values({
        id: expenseId,
        expenseNumber,
        category: category as any,
        grossAmount: String(gross),
        vatAmount: String(vat),
        vatRate: String(vatRate || 5),
        isVatRecoverable: isVatRecoverable ?? true,
        amount: String(amount),
        description,
        descriptionAr,
        vendor,
        vendorId,
        vendorTrn,
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
        paymentTerms: paymentTerms || 'net_30',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        costCenterId,
        costCenterName,
        departmentId,
        departmentName,
        accountId,
        notes,
        attachments: attachments || [],
        tags: tags || [],
        status: 'pending',
        approvalStatus: 'draft',
        createdBy: 'admin',
      });
      const [newExpense] = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.id, expenseId));

      res.status(201).json({ success: true, data: newExpense, message: 'Expense created successfully' });
    } catch (error) {
      console.error('[Create Expense Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create expense' });
    }
  });

  // Update expense
  app.put('/api/finance/expenses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [existing] = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.id, req.params.id)).limit(1);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      const allowedFields = [
        'category', 'description', 'descriptionAr', 'grossAmount', 'vatAmount', 'vatRate',
        'isVatRecoverable', 'amount', 'vendor', 'vendorId', 'vendorTrn', 'invoiceNumber',
        'invoiceDate', 'paymentTerms', 'dueDate', 'costCenterId', 'costCenterName',
        'departmentId', 'departmentName', 'accountId', 'notes', 'attachments', 'tags', 'status'
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (['invoiceDate', 'dueDate'].includes(field) && req.body[field]) {
            updateData[field] = new Date(req.body[field]);
          } else if (['grossAmount', 'vatAmount', 'amount'].includes(field)) {
            updateData[field] = String(req.body[field]);
          } else {
            updateData[field] = req.body[field];
          }
        }
      }

      await pgDb.update(financeExpensesTable)
        .set(updateData)
        .where(eq(financeExpensesTable.id, req.params.id));
      const [updated] = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.id, req.params.id));

      res.json({ success: true, data: updated, message: 'Expense updated successfully' });
    } catch (error) {
      console.error('[Update Expense Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update expense' });
    }
  });

  // Delete expense
  app.delete('/api/finance/expenses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [existing] = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.id, req.params.id)).limit(1);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }

      await pgDb.delete(financeExpensesTable).where(eq(financeExpensesTable.id, req.params.id));

      res.json({ success: true, data: existing, message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('[Delete Expense Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete expense' });
    }
  });

  // Pay expense
  app.post('/api/finance/expenses/:id/pay', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [existing] = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.id, req.params.id)).limit(1);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }

      const { paymentMethod, paymentReference, accountId } = req.body;

      await pgDb.update(financeExpensesTable)
        .set({
          status: 'paid',
          paidAt: new Date(),
          paidAmount: existing.amount,
          paymentMethod,
          paymentReference,
          accountId: accountId || existing.accountId,
          updatedAt: new Date(),
        })
        .where(eq(financeExpensesTable.id, req.params.id));
      const [updated] = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.id, req.params.id));

      // Create finance transaction for the payment
      await pgDb.insert(financeTransactionsTable).values({
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'expense',
        status: 'completed',
        amount: existing.amount,
        currency: 'AED',
        description: `Expense payment: ${existing.description}`,
        category: existing.category,
        reference: existing.expenseNumber,
        referenceType: 'expense',
        referenceId: existing.id,
        accountId: accountId || existing.accountId || 'default',
        accountName: 'Operating Account',
        createdBy: 'admin',
      });

      res.json({ success: true, data: updated, message: 'Expense paid successfully' });
    } catch (error) {
      console.error('[Pay Expense Error]', error);
      res.status(500).json({ success: false, error: 'Failed to pay expense' });
    }
  });

  // Finance reports - Profit & Loss
  app.get('/api/finance/reports/profit-loss', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const allExpenses = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.status, 'paid'));

      const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalCOGS = totalRevenue * 0.65;
      const grossProfit = totalRevenue - totalCOGS;
      const totalExpenses = allExpenses.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0);
      const netProfit = grossProfit - totalExpenses;

      // Group expenses by category
      const expensesByCategory = allExpenses.reduce((acc, e) => {
        const cat = e.category || 'other';
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += parseFloat(String(e.amount));
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        data: {
          period: req.query.period || 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          revenue: { sales: totalRevenue, otherIncome: 0, totalRevenue },
          costOfGoodsSold: { inventoryCost: totalCOGS, supplierPurchases: 0, totalCOGS },
          grossProfit,
          grossProfitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
          operatingExpenses: Object.entries(expensesByCategory).map(([category, amount]) => ({
            category,
            amount
          })),
          totalOperatingExpenses: totalExpenses,
          operatingProfit: grossProfit - totalExpenses,
          otherExpenses: { vatPaid: 0, refunds: 0, totalOther: 0 },
          netProfit,
          netProfitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        },
      });
    } catch (error) {
      console.error('[Profit Loss Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate profit-loss report' });
    }
  });

  // Cash Flow Report
  app.get('/api/finance/reports/cash-flow', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const allExpenses = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.status, 'paid'));
      const accounts = await pgDb.select().from(financeAccountsTable);

      const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalExpenses = allExpenses.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0);
      const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(String(a.balance)), 0);

      res.json({
        success: true,
        data: {
          period: req.query.period || 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          openingBalance: totalBalance - totalRevenue + totalExpenses,
          closingBalance: totalBalance,
          operatingActivities: {
            cashFromSales: totalRevenue * 0.6,
            cashFromCOD: totalRevenue * 0.35,
            cashFromRefunds: 0,
            cashToSuppliers: totalRevenue * 0.5,
            cashToExpenses: totalExpenses,
            netOperating: totalRevenue - totalExpenses - totalRevenue * 0.5,
          },
          investingActivities: { equipmentPurchases: 0, netInvesting: 0 },
          financingActivities: { ownerDrawings: 0, capitalInjection: 0, netFinancing: 0 },
          netCashFlow: totalRevenue - totalExpenses,
          dailyCashFlow: [],
        },
      });
    } catch (error) {
      console.error('[Cash Flow Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate cash-flow report' });
    }
  });

  app.get('/api/finance/reports/vat', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const salesVAT = allOrders.reduce((sum, o) => sum + parseFloat(String(o.vatAmount)), 0);
      const salesTaxable = allOrders.reduce((sum, o) => sum + (parseFloat(String(o.total)) - parseFloat(String(o.vatAmount))), 0);

      res.json({
        success: true,
        data: {
          period: req.query.period || 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          salesVAT: { taxableAmount: salesTaxable, vatAmount: salesVAT, exemptAmount: 0 },
          purchasesVAT: { taxableAmount: 0, vatAmount: 0 },
          vatDue: salesVAT,
          vatRefund: 0,
          netVAT: salesVAT,
          transactionDetails: allOrders.slice(0, 10).map(o => ({
            date: o.createdAt.toISOString(),
            type: 'sale',
            reference: o.orderNumber,
            taxableAmount: parseFloat(String(o.total)) - parseFloat(String(o.vatAmount)),
            vatAmount: parseFloat(String(o.vatAmount)),
            vatRate: 5,
          })),
        },
      });
    } catch (error) {
      console.error('[VAT Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate VAT report' });
    }
  });

  // =====================================================
  // UAE COMPLIANCE ENDPOINTS
  // =====================================================

  // Balance Sheet report
  app.get('/api/finance/reports/balance-sheet', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const orders = await pgDb.select().from(ordersTable).where(eq(ordersTable.paymentStatus, 'captured'));
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalVAT = orders.reduce((sum, o) => sum + parseFloat(String(o.vatAmount)), 0);
      const pendingOrders = await pgDb.select().from(ordersTable).where(eq(ordersTable.paymentStatus, 'pending'));
      const accountsReceivable = pendingOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);

      res.json({
        success: true,
        data: {
          asOfDate: new Date().toISOString(),
          assets: {
            current: {
              cash: totalRevenue * 0.3,
              bankAccounts: totalRevenue * 0.5,
              accountsReceivable,
              inventory: 50000,
              total: totalRevenue * 0.8 + accountsReceivable + 50000,
            },
            fixed: { equipment: 25000, vehicles: 15000, furniture: 5000, total: 45000 },
            totalAssets: totalRevenue * 0.8 + accountsReceivable + 95000,
          },
          liabilities: {
            current: {
              accountsPayable: 10000,
              vatPayable: totalVAT,
              accruedExpenses: 5000,
              total: 15000 + totalVAT,
            },
            longTerm: { loans: 0, total: 0 },
            totalLiabilities: 15000 + totalVAT,
          },
          equity: {
            capital: 50000,
            retainedEarnings: totalRevenue * 0.8 + accountsReceivable + 95000 - 15000 - totalVAT - 50000,
            totalEquity: totalRevenue * 0.8 + accountsReceivable + 95000 - 15000 - totalVAT,
          },
        },
      });
    } catch (error) {
      console.error('[Balance Sheet Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate balance sheet' });
    }
  });

  // Chart of Accounts - DATABASE BACKED
  app.get('/api/finance/chart-of-accounts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const accounts = await pgDb.select().from(chartOfAccountsTable).orderBy(chartOfAccountsTable.code);
      res.json({ success: true, data: accounts });
    } catch (error) {
      console.error('[Chart of Accounts Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chart of accounts' });
    }
  });

  app.post('/api/finance/chart-of-accounts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { code, name, nameAr, accountClass, parentId, description, normalBalance } = req.body;

      if (!code || !name || !accountClass) {
        return res.status(400).json({ success: false, error: 'Code, name, and accountClass are required' });
      }

      const accountId = `coa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(chartOfAccountsTable).values({
        id: accountId,
        code,
        name,
        nameAr,
        accountClass: accountClass as any,
        parentId,
        description,
        normalBalance: normalBalance || 'debit',
        balance: '0',
        isActive: true,
        isSystemAccount: false,
      });
      const [newAccount] = await pgDb.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, accountId));

      res.status(201).json({ success: true, data: newAccount, message: 'Account created successfully' });
    } catch (error) {
      console.error('[Create Account Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create account' });
    }
  });

  // Journal Entries - DATABASE BACKED
  app.get('/api/finance/journal-entries', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const entries = await pgDb.select().from(journalEntriesTable).orderBy(desc(journalEntriesTable.createdAt)).limit(100);
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('[Journal Entries Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch journal entries' });
    }
  });

  app.post('/api/finance/journal-entries', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { date, description, descriptionAr, reference, referenceType, referenceId, lines, notes, attachments } = req.body;

      if (!description || !lines || lines.length === 0) {
        return res.status(400).json({ success: false, error: 'Description and at least one line are required' });
      }

      const totalDebits = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.debit) || 0), 0);
      const totalCredits = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.credit) || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return res.status(400).json({ success: false, error: 'Debits must equal credits' });
      }

      // Generate entry number
      const year = new Date().getFullYear();
      const existingEntries = await pgDb.select().from(journalEntriesTable).orderBy(desc(journalEntriesTable.createdAt)).limit(1);
      let seqNum = 1;
      if (existingEntries.length > 0) {
        const lastNum = existingEntries[0].entryNumber;
        const match = lastNum.match(/JE-\d+-(\d+)/);
        seqNum = match ? parseInt(match[1], 10) + 1 : 1;
      }
      const entryNumber = `JE-${year}-${String(seqNum).padStart(4, '0')}`;

      const entryId = `je_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(journalEntriesTable).values({
        id: entryId,
        entryNumber,
        entryDate: new Date(date || Date.now()),
        description,
        descriptionAr,
        reference,
        referenceType,
        referenceId,
        status: 'draft',
        totalDebit: String(totalDebits),
        totalCredit: String(totalCredits),
        notes,
        attachments: attachments || [],
        createdBy: 'admin',
      });
      const [entry] = await pgDb.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, entryId));

      // Insert journal entry lines
      for (const line of lines) {
        await pgDb.insert(journalEntryLinesTable).values({
          id: `jel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          journalEntryId: entryId,
          accountId: line.accountId,
          accountCode: line.accountCode || '',
          accountName: line.accountName || '',
          debit: String(line.debit || 0),
          credit: String(line.credit || 0),
          description: line.description,
        });
      }

      res.status(201).json({ success: true, data: entry, message: 'Journal entry created successfully' });
    } catch (error) {
      console.error('[Create Journal Entry Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create journal entry' });
    }
  });

  app.post('/api/finance/journal-entries/:id/post', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const [existing] = await pgDb.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, req.params.id)).limit(1);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Journal entry not found' });
      }

      await pgDb.update(journalEntriesTable)
        .set({ status: 'posted', postedAt: new Date(), updatedAt: new Date() })
        .where(eq(journalEntriesTable.id, req.params.id));
      const [updated] = await pgDb.select().from(journalEntriesTable).where(eq(journalEntriesTable.id, req.params.id));

      res.json({ success: true, data: updated, message: 'Journal entry posted successfully' });
    } catch (error) {
      console.error('[Post Journal Entry Error]', error);
      res.status(500).json({ success: false, error: 'Failed to post journal entry' });
    }
  });

  // Audit Log - DATABASE BACKED
  app.get('/api/finance/audit-log', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const page = parseInt(String(req.query.page)) || 1;
      const limit = parseInt(String(req.query.limit)) || 50;
      const offset = (page - 1) * limit;

      const logs = await pgDb.select().from(auditLogTable).orderBy(desc(auditLogTable.createdAt)).limit(limit).offset(offset);
      const totalResult = await pgDb.select().from(auditLogTable);
      const total = totalResult.length;

      res.json({
        success: true,
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('[Audit Log Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch audit log' });
    }
  });

  // VAT Returns (FTA Form 201) - DATABASE BACKED
  app.get('/api/finance/vat-returns', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const returns = await pgDb.select().from(vatReturnsTable).orderBy(desc(vatReturnsTable.createdAt));
      res.json({ success: true, data: returns });
    } catch (error) {
      console.error('[VAT Returns Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch VAT returns' });
    }
  });

  app.post('/api/finance/vat-returns', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { periodStart, periodEnd } = req.body;
      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      const orders = await pgDb.select().from(ordersTable).where(and(
        gte(ordersTable.createdAt, start),
        lte(ordersTable.createdAt, end),
        eq(ordersTable.paymentStatus, 'captured')
      ));

      const standardRatedSales = orders.reduce((sum, o) => sum + parseFloat(String(o.total)) - parseFloat(String(o.vatAmount)), 0);
      const vatOnSales = orders.reduce((sum, o) => sum + parseFloat(String(o.vatAmount)), 0);

      // Get expenses for recoverable VAT
      const expenses = await pgDb.select().from(financeExpensesTable).where(and(
        gte(financeExpensesTable.createdAt, start),
        lte(financeExpensesTable.createdAt, end),
        eq(financeExpensesTable.status, 'paid')
      ));

      const standardRatedExpenses = expenses.reduce((sum, e) => sum + parseFloat(String(e.grossAmount)), 0);
      const recoverableVat = expenses.filter(e => e.isVatRecoverable).reduce((sum, e) => sum + parseFloat(String(e.vatAmount)), 0);

      const quarter = Math.ceil((start.getMonth() + 1) / 3);
      const returnNumber = `VAT-${start.getFullYear()}-Q${quarter}`;

      const vatReturnId = `vat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(vatReturnsTable).values({
        id: vatReturnId,
        returnNumber,
        periodStart: start,
        periodEnd: end,
        box1StandardRatedSupplies: String(standardRatedSales),
        box1VatOnSupplies: String(vatOnSales),
        box2TaxRefundsForTourists: '0',
        box3ZeroRatedSupplies: '0',
        box4ExemptSupplies: '0',
        box5GoodsImportedFromGcc: '0',
        box5VatOnImports: '0',
        box6Adjustments: '0',
        box7TotalVatDue: String(vatOnSales),
        box8StandardRatedExpenses: String(standardRatedExpenses),
        box8RecoverableVat: String(recoverableVat),
        box9Adjustments: '0',
        box10NetVatDue: String(vatOnSales - recoverableVat),
        status: 'draft',
        createdBy: 'admin',
      });
      const [vatReturn] = await pgDb.select().from(vatReturnsTable).where(eq(vatReturnsTable.id, vatReturnId));

      res.status(201).json({ success: true, data: vatReturn, message: 'VAT return created successfully' });
    } catch (error) {
      console.error('[Create VAT Return Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create VAT return' });
    }
  });

  // =====================================================
  // EXPENSE MANAGEMENT ENDPOINTS (IFRS/GAAP Compliant)
  // =====================================================

  // Expense Categories (IFRS mapping) - Static reference data
  app.get('/api/finance/expenses/categories', async (req, res) => {
    try {
      // These are IFRS-compliant expense categories - static reference data
      const categories = [
        { code: "inventory", name: "Inventory / Raw Materials", nameAr: "المخزون", function: "cost_of_sales", glCode: "5100" },
        { code: "direct_labor", name: "Direct Labor", nameAr: "العمالة المباشرة", function: "cost_of_sales", glCode: "5110" },
        { code: "freight_in", name: "Freight In", nameAr: "الشحن الداخلي", function: "cost_of_sales", glCode: "5120" },
        { code: "marketing", name: "Marketing & Advertising", nameAr: "التسويق والإعلان", function: "selling", glCode: "5200" },
        { code: "delivery", name: "Delivery & Shipping", nameAr: "التوصيل والشحن", function: "selling", glCode: "5210" },
        { code: "sales_commission", name: "Sales Commission", nameAr: "عمولة المبيعات", function: "selling", glCode: "5220" },
        { code: "salaries", name: "Salaries & Wages", nameAr: "الرواتب والأجور", function: "administrative", glCode: "5300" },
        { code: "rent", name: "Rent", nameAr: "الإيجار", function: "administrative", glCode: "5310" },
        { code: "utilities", name: "Utilities", nameAr: "المرافق", function: "administrative", glCode: "5320" },
        { code: "office_supplies", name: "Office Supplies", nameAr: "مستلزمات المكتب", function: "administrative", glCode: "5330" },
        { code: "insurance", name: "Insurance", nameAr: "التأمين", function: "administrative", glCode: "5340" },
        { code: "professional_fees", name: "Professional Fees", nameAr: "الرسوم المهنية", function: "administrative", glCode: "5350" },
        { code: "equipment", name: "Equipment", nameAr: "المعدات", function: "administrative", glCode: "5400" },
        { code: "maintenance", name: "Repairs & Maintenance", nameAr: "الصيانة والإصلاحات", function: "administrative", glCode: "5410" },
        { code: "depreciation", name: "Depreciation", nameAr: "الإهلاك", function: "administrative", glCode: "5420" },
        { code: "interest_expense", name: "Interest Expense", nameAr: "مصروفات الفوائد", function: "finance", glCode: "5500" },
        { code: "taxes", name: "Taxes (Non-VAT)", nameAr: "الضرائب", function: "other_operating", glCode: "5600" },
        { code: "employee_benefits", name: "Employee Benefits", nameAr: "مزايا الموظفين", function: "administrative", glCode: "5700" },
        { code: "travel", name: "Travel & Transportation", nameAr: "السفر والمواصلات", function: "administrative", glCode: "5720" },
        { code: "other", name: "Other Expenses", nameAr: "مصروفات أخرى", function: "other_operating", glCode: "5900" },
      ];
      res.json({ success: true, data: categories });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get expense categories' });
    }
  });

  // Vendors - DATABASE BACKED
  app.get('/api/finance/vendors', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const vendors = await pgDb.select().from(vendorsTable).where(eq(vendorsTable.isActive, true)).orderBy(vendorsTable.name);
      res.json({ success: true, data: vendors });
    } catch (error) {
      console.error('[Vendors Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get vendors' });
    }
  });

  app.post('/api/finance/vendors', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { name, nameAr, email, phone, mobile, website, address, city, emirate, country, trn, defaultPaymentTerms } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }

      // Generate vendor code
      const existingVendors = await pgDb.select().from(vendorsTable).orderBy(desc(vendorsTable.createdAt)).limit(1);
      let seqNum = 1;
      if (existingVendors.length > 0) {
        const lastCode = existingVendors[0].code;
        const match = lastCode.match(/V-(\d+)/);
        seqNum = match ? parseInt(match[1], 10) + 1 : 1;
      }
      const code = `V-${String(seqNum).padStart(3, '0')}`;

      const vendorId = `vendor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(vendorsTable).values({
        id: vendorId,
        code,
        name,
        nameAr,
        email,
        phone,
        mobile,
        website,
        address,
        city,
        emirate,
        country: country || 'UAE',
        trn,
        defaultPaymentTerms: defaultPaymentTerms || 'net_30',
        currentBalance: '0',
        isActive: true,
      });
      const [newVendor] = await pgDb.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));

      res.status(201).json({ success: true, data: newVendor, message: 'Vendor created successfully' });
    } catch (error) {
      console.error('[Create Vendor Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create vendor' });
    }
  });

  // Cost Centers - DATABASE BACKED
  app.get('/api/finance/cost-centers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const costCenters = await pgDb.select().from(costCentersTable).where(eq(costCentersTable.isActive, true)).orderBy(costCentersTable.code);
      res.json({ success: true, data: costCenters });
    } catch (error) {
      console.error('[Cost Centers Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get cost centers' });
    }
  });

  app.post('/api/finance/cost-centers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { code, name, nameAr, description, parentId, managerId } = req.body;

      if (!code || !name) {
        return res.status(400).json({ success: false, error: 'Code and name are required' });
      }

      const costCenterId = `cc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(costCentersTable).values({
        id: costCenterId,
        code,
        name,
        nameAr,
        description,
        parentId,
        managerId,
        isActive: true,
      });
      const [newCostCenter] = await pgDb.select().from(costCentersTable).where(eq(costCentersTable.id, costCenterId));

      res.status(201).json({ success: true, data: newCostCenter, message: 'Cost center created successfully' });
    } catch (error) {
      console.error('[Create Cost Center Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create cost center' });
    }
  });

  // Budgets - DATABASE BACKED
  app.get('/api/finance/budgets', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const budgets = await pgDb.select().from(expenseBudgetsTable).where(eq(expenseBudgetsTable.isActive, true)).orderBy(desc(expenseBudgetsTable.createdAt));

      // Calculate percentUsed for each budget
      const budgetsWithPercent = budgets.map(b => ({
        ...b,
        percentUsed: parseFloat(String(b.budgetAmount)) > 0
          ? (parseFloat(String(b.spentAmount)) / parseFloat(String(b.budgetAmount))) * 100
          : 0
      }));

      res.json({ success: true, data: budgetsWithPercent });
    } catch (error) {
      console.error('[Budgets Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get budgets' });
    }
  });

  app.post('/api/finance/budgets', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { name, periodType, startDate, endDate, category, costCenterId, departmentId, budgetAmount, alertThreshold } = req.body;

      if (!name || !periodType || !startDate || !endDate || !budgetAmount) {
        return res.status(400).json({ success: false, error: 'Name, periodType, startDate, endDate, and budgetAmount are required' });
      }

      const budgetId = `bud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await pgDb.insert(expenseBudgetsTable).values({
        id: budgetId,
        name,
        periodType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        category,
        costCenterId,
        departmentId,
        budgetAmount: String(budgetAmount),
        spentAmount: '0',
        remainingAmount: String(budgetAmount),
        alertThreshold: alertThreshold || 80,
        isAlertSent: false,
        isActive: true,
        createdBy: 'admin',
      });
      const [newBudget] = await pgDb.select().from(expenseBudgetsTable).where(eq(expenseBudgetsTable.id, budgetId));

      res.status(201).json({ success: true, data: newBudget, message: 'Budget created successfully' });
    } catch (error) {
      console.error('[Create Budget Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create budget' });
    }
  });

  app.get('/api/finance/budgets/vs-actual', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const budgets = await pgDb.select().from(expenseBudgetsTable).where(eq(expenseBudgetsTable.isActive, true));
      const expenses = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.status, 'paid'));

      // Calculate totals
      const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(String(b.budgetAmount)), 0);
      const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(String(b.spentAmount)), 0);
      const totalRemaining = totalBudget - totalSpent;

      // Group expenses by category
      const expensesByCategory = expenses.reduce((acc, e) => {
        const cat = e.category || 'other';
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += parseFloat(String(e.amount));
        return acc;
      }, {} as Record<string, number>);

      // Get budgets by category
      const budgetsByCategory = budgets.reduce((acc, b) => {
        if (b.category) {
          if (!acc[b.category]) acc[b.category] = 0;
          acc[b.category] += parseFloat(String(b.budgetAmount));
        }
        return acc;
      }, {} as Record<string, number>);

      const byCategory = Object.keys({ ...expensesByCategory, ...budgetsByCategory }).map(category => {
        const budget = budgetsByCategory[category] || 0;
        const actual = expensesByCategory[category] || 0;
        const variance = budget - actual;
        return {
          category,
          budget,
          actual,
          variance,
          variancePercent: budget > 0 ? (variance / budget) * 100 : 0
        };
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalBudget,
            totalSpent,
            totalRemaining,
            overallVariancePercent: totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0
          },
          byCategory
        }
      });
    } catch (error) {
      console.error('[Budget vs Actual Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get budget vs actual report' });
    }
  });

  // Aging Report - DATABASE BACKED
  app.get('/api/finance/expenses/aging', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const now = new Date();
      const expenses = await pgDb.select().from(financeExpensesTable).where(ne(financeExpensesTable.status, 'paid'));

      // Calculate aging buckets
      let current = 0, days1to30 = 0, days31to60 = 0, days61to90 = 0, over90Days = 0;
      const byVendor: Record<string, { current: number; days1to30: number; days31to60: number; days61to90: number; over90Days: number; total: number }> = {};

      for (const expense of expenses) {
        const dueDate = expense.dueDate ? new Date(expense.dueDate) : expense.createdAt;
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const amount = parseFloat(String(expense.amount));
        const vendorName = expense.vendor || 'Unknown';

        if (!byVendor[vendorName]) {
          byVendor[vendorName] = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90Days: 0, total: 0 };
        }

        if (daysPastDue <= 0) {
          current += amount;
          byVendor[vendorName].current += amount;
        } else if (daysPastDue <= 30) {
          days1to30 += amount;
          byVendor[vendorName].days1to30 += amount;
        } else if (daysPastDue <= 60) {
          days31to60 += amount;
          byVendor[vendorName].days31to60 += amount;
        } else if (daysPastDue <= 90) {
          days61to90 += amount;
          byVendor[vendorName].days61to90 += amount;
        } else {
          over90Days += amount;
          byVendor[vendorName].over90Days += amount;
        }

        byVendor[vendorName].total += amount;
      }

      const total = current + days1to30 + days31to60 + days61to90 + over90Days;

      res.json({
        success: true,
        data: {
          asOfDate: now.toISOString(),
          summary: { current, days1to30, days31to60, days61to90, over90Days, total },
          byVendor: Object.entries(byVendor).map(([vendorName, data]) => ({ vendorName, ...data })),
          details: expenses.slice(0, 50).map(e => ({
            id: e.id,
            vendor: e.vendor,
            description: e.description,
            amount: parseFloat(String(e.amount)),
            dueDate: e.dueDate?.toISOString(),
            status: e.status
          }))
        }
      });
    } catch (error) {
      console.error('[Aging Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get aging report' });
    }
  });

  // Approval Workflow - DATABASE BACKED
  app.get('/api/finance/approval-rules', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rules = await pgDb.select().from(expenseApprovalRulesTable).where(eq(expenseApprovalRulesTable.isActive, true)).orderBy(expenseApprovalRulesTable.priority);
      res.json({ success: true, data: rules });
    } catch (error) {
      console.error('[Approval Rules Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get approval rules' });
    }
  });

  app.get('/api/finance/expenses/pending-approvals', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const pendingExpenses = await pgDb.select().from(financeExpensesTable).where(eq(financeExpensesTable.approvalStatus, 'pending_approval')).orderBy(desc(financeExpensesTable.createdAt));
      res.json({ success: true, data: pendingExpenses });
    } catch (error) {
      console.error('[Pending Approvals Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get pending approvals' });
    }
  });

  app.post('/api/finance/expenses/:id/approve', async (req, res) => {
    try {
      res.json({ success: true, data: { id: req.params.id, status: 'approved', approvedAt: new Date().toISOString() } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to approve expense' });
    }
  });

  app.post('/api/finance/expenses/:id/reject', async (req, res) => {
    try {
      res.json({ success: true, data: { id: req.params.id, status: 'rejected', rejectedAt: new Date().toISOString() } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to reject expense' });
    }
  });

  app.post('/api/finance/expenses/:id/submit', async (req, res) => {
    try {
      res.json({ success: true, data: { id: req.params.id, approvalStatus: 'pending_approval' }, message: 'Submitted for approval' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to submit for approval' });
    }
  });

  // Catch all for unhandled routes - Express 5 compatible syntax
  app.use((req, res) => {
    console.log('[Vercel] Unhandled route:', req.method, req.url);
    res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
  });

  return app;
}

// =====================================================
// VERCEL HANDLER
// =====================================================

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = createApp();

    // Get the path from query parameter (Vercel passes it as 'path' from the rewrite)
    const pathParam = req.query.path;

    if (pathParam) {
      const pathArray = Array.isArray(pathParam) ? pathParam : [pathParam];
      // Remove the path param from query to avoid confusion
      delete req.query.path;
      const queryString = Object.keys(req.query).length > 0
        ? '?' + new URLSearchParams(req.query as Record<string, string>).toString()
        : '';
      req.url = '/api/' + pathArray.join('/') + queryString;
    } else if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + req.url;
    }

    console.log('[Vercel Handler]', req.method, req.url);

    return expressApp(req as any, res as any);
  } catch (error) {
    console.error('[Vercel Handler Error]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
