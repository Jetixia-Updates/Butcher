/**
 * Drizzle ORM Schema for Butcher Shop Database
 * PostgreSQL schema definitions
 */

import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  pgEnum,
  serial,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =====================================================
// ENUMS
// =====================================================

export const userRoleEnum = pgEnum("user_role", ["customer", "admin", "staff", "delivery"]);
export const currencyEnum = pgEnum("currency", ["AED", "USD", "EUR"]);
export const languageEnum = pgEnum("language", ["en", "ar"]);
export const unitEnum = pgEnum("unit", ["kg", "piece", "gram"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "cod", "bank_transfer"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["in", "out", "adjustment", "reserved", "released"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "order_placed",
  "order_confirmed",
  "order_processing",
  "order_ready",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
  "payment_received",
  "payment_failed",
  "refund_processed",
  "low_stock",
  "promotional",
]);
export const notificationChannelEnum = pgEnum("notification_channel", ["sms", "email", "push"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "delivered", "failed"]);
export const deliveryTrackingStatusEnum = pgEnum("delivery_tracking_status", [
  "assigned",
  "picked_up",
  "in_transit",
  "nearby",
  "delivered",
  "failed",
]);
export const supplierStatusEnum = pgEnum("supplier_status", ["active", "inactive", "pending", "suspended"]);
export const supplierPaymentTermsEnum = pgEnum("supplier_payment_terms", ["net_7", "net_15", "net_30", "net_60", "cod", "prepaid"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "pending",
  "approved",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "sale",
  "refund",
  "expense",
  "purchase",
  "adjustment",
  "payout",
]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);
// IFRS/IAS 1 Compliant Expense Categories (Nature-based)
export const expenseCategoryEnum = pgEnum("expense_category", [
  // Cost of Sales (COGS)
  "inventory",           // Raw materials and goods
  "direct_labor",        // Direct wages
  "freight_in",          // Inbound shipping
  // Operating Expenses - Selling & Distribution
  "marketing",           // Advertising, promotions
  "delivery",            // Outbound shipping, delivery costs
  "sales_commission",    // Sales commissions
  // Operating Expenses - Administrative
  "salaries",            // Admin salaries & wages
  "rent",                // Office/warehouse rent
  "utilities",           // Electric, water, internet
  "office_supplies",     // Stationery, supplies
  "insurance",           // Business insurance
  "professional_fees",   // Legal, accounting, consulting
  "licenses_permits",    // Business licenses
  "bank_charges",        // Bank fees, transaction costs
  // Fixed Asset Related
  "equipment",           // Equipment purchases
  "maintenance",         // Repairs & maintenance
  "depreciation",        // Asset depreciation
  "amortization",        // Intangible amortization
  // Finance Costs
  "interest_expense",    // Loan interest
  "finance_charges",     // Late fees, finance costs
  // Taxes & Government
  "taxes",               // Non-VAT taxes
  "government_fees",     // Govt charges, fines
  // Employee Benefits (IAS 19)
  "employee_benefits",   // Health, pension, end of service
  "training",            // Staff training
  "travel",              // Business travel
  "meals_entertainment", // Client entertainment
  // Other
  "other",               // Miscellaneous
]);

// Expense Function Classification (IAS 1 - By Function)
export const expenseFunctionEnum = pgEnum("expense_function", [
  "cost_of_sales",       // Direct costs of goods sold
  "selling",             // Selling & distribution
  "administrative",      // General & administrative
  "finance",             // Finance costs
  "other_operating",     // Other operating expenses
]);

// Approval Status
export const approvalStatusEnum = pgEnum("approval_status", [
  "draft",               // Not yet submitted
  "pending_approval",    // Awaiting approval
  "approved",            // Approved
  "rejected",            // Rejected
  "cancelled",           // Cancelled by submitter
]);

// Payment Terms
export const paymentTermsEnum = pgEnum("payment_terms", [
  "immediate",           // Due immediately
  "net_7",               // Net 7 days
  "net_15",              // Net 15 days  
  "net_30",              // Net 30 days
  "net_45",              // Net 45 days
  "net_60",              // Net 60 days
  "net_90",              // Net 90 days
  "eom",                 // End of month
  "custom",              // Custom terms
]);

export const accountTypeEnum = pgEnum("account_type", ["cash", "bank", "card_payments", "cod_collections", "petty_cash"]);
export const expenseStatusEnum = pgEnum("expense_status", ["pending", "approved", "paid", "overdue", "cancelled", "reimbursed"]);
export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed"]);

// =====================================================
// USERS TABLE
// =====================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  password: text("password").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  familyName: varchar("family_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  emirate: varchar("emirate", { length: 100 }),
  address: text("address"),
  preferences: jsonb("preferences").$type<{
    language: "en" | "ar";
    currency: "AED" | "USD" | "EUR";
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;
  }>(),
  permissions: jsonb("permissions").$type<{
    canViewProducts: boolean;
    canEditProducts: boolean;
    canEditPrices: boolean;
    canManageStock: boolean;
    canViewOrders: boolean;
    canManageOrders: boolean;
    canCancelOrders: boolean;
    canViewCustomers: boolean;
    canManageCustomers: boolean;
    canViewPayments: boolean;
    canProcessRefunds: boolean;
    canViewDelivery: boolean;
    canManageDelivery: boolean;
    canAssignDrivers: boolean;
    canViewReports: boolean;
    canViewSettings: boolean;
    canManageSettings: boolean;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// =====================================================
// SESSIONS TABLE
// =====================================================

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// ADDRESSES TABLE
// =====================================================

export const addresses = pgTable("addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  latitude: real("latitude"),
  longitude: real("longitude"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// PRODUCTS TABLE
// =====================================================

export const products = pgTable("products", {
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
  unit: unitEnum("unit").notNull().default("kg"),
  minOrderQuantity: decimal("min_order_quantity", { precision: 10, scale: 2 }).notNull().default("0.25"),
  maxOrderQuantity: decimal("max_order_quantity", { precision: 10, scale: 2 }).notNull().default("10"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }).notNull().default("0"), // Product rating (0-5)
  tags: jsonb("tags").$type<string[]>().default([]),
  badges: jsonb("badges").$type<("halal" | "organic" | "grass-fed" | "premium" | "fresh" | "local")[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// STOCK TABLE
// =====================================================

export const stock = pgTable("stock", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }).unique(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  reservedQuantity: decimal("reserved_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  availableQuantity: decimal("available_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  reorderPoint: integer("reorder_point").notNull().default(10),
  reorderQuantity: integer("reorder_quantity").notNull().default(20),
  lastRestockedAt: timestamp("last_restocked_at"),
  expiryDate: timestamp("expiry_date"),
  batchNumber: varchar("batch_number", { length: 100 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// STOCK MOVEMENTS TABLE
// =====================================================

export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  type: stockMovementTypeEnum("type").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  previousQuantity: decimal("previous_quantity", { precision: 10, scale: 2 }).notNull(),
  newQuantity: decimal("new_quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: text("reference_id"),
  performedBy: text("performed_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// ORDERS TABLE
// =====================================================

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id),
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerMobile: varchar("customer_mobile", { length: 20 }).notNull(),
  
  // Pricing
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountCode: varchar("discount_code", { length: 50 }),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.05"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  
  // Status
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  
  // Delivery
  addressId: text("address_id").notNull(),
  deliveryAddress: jsonb("delivery_address").$type<{
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
  }>().notNull(),
  deliveryNotes: text("delivery_notes"),
  deliveryZoneId: text("delivery_zone_id"),
  estimatedDeliveryAt: timestamp("estimated_delivery_at"),
  actualDeliveryAt: timestamp("actual_delivery_at"),
  
  // Status History
  statusHistory: jsonb("status_history").$type<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }[]>().default([]),
  
  // Metadata
  source: varchar("source", { length: 20 }).notNull().default("web"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// ORDER ITEMS TABLE
// =====================================================

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  productName: varchar("product_name", { length: 200 }).notNull(),
  productNameAr: varchar("product_name_ar", { length: 200 }),
  sku: varchar("sku", { length: 50 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
});

// =====================================================
// PAYMENTS TABLE
// =====================================================

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("AED"),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  
  // Card details (masked)
  cardBrand: varchar("card_brand", { length: 50 }),
  cardLast4: varchar("card_last4", { length: 4 }),
  cardExpiryMonth: integer("card_expiry_month"),
  cardExpiryYear: integer("card_expiry_year"),
  
  // Gateway details
  gatewayTransactionId: text("gateway_transaction_id"),
  gatewayResponse: text("gateway_response"),
  
  // Refund details
  refundedAmount: decimal("refunded_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  refunds: jsonb("refunds").$type<{
    id: string;
    amount: number;
    reason: string;
    status: "pending" | "completed" | "failed";
    processedBy: string;
    createdAt: string;
  }[]>().default([]),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// DELIVERY ZONES TABLE
// =====================================================

export const deliveryZones = pgTable("delivery_zones", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  emirate: varchar("emirate", { length: 100 }).notNull(),
  areas: jsonb("areas").$type<string[]>().notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }).notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Express delivery settings
  expressEnabled: boolean("express_enabled").notNull().default(false),
  expressFee: decimal("express_fee", { precision: 10, scale: 2 }).notNull().default("25"),
  expressHours: integer("express_hours").notNull().default(1),
});

// =====================================================
// DELIVERY TRACKING TABLE
// =====================================================

export const deliveryTracking = pgTable("delivery_tracking", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  driverId: text("driver_id").references(() => users.id),
  driverName: varchar("driver_name", { length: 200 }),
  driverMobile: varchar("driver_mobile", { length: 20 }),
  status: deliveryTrackingStatusEnum("status").notNull().default("assigned"),
  currentLocation: jsonb("current_location").$type<{
    latitude: number;
    longitude: number;
    updatedAt: string;
  }>(),
  estimatedArrival: timestamp("estimated_arrival"),
  actualArrival: timestamp("actual_arrival"),
  deliveryProof: jsonb("delivery_proof").$type<{
    signature?: string;
    photo?: string;
    notes?: string;
  }>(),
  timeline: jsonb("timeline").$type<{
    status: string;
    timestamp: string;
    location?: string;
    notes?: string;
  }[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// DISCOUNT CODES TABLE
// =====================================================

export const discountCodes = pgTable("discount_codes", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  type: discountTypeEnum("type").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }).notNull().default("0"),
  maximumDiscount: decimal("maximum_discount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit").notNull().default(0),
  usageCount: integer("usage_count").notNull().default(0),
  userLimit: integer("user_limit").notNull().default(1),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  applicableProducts: jsonb("applicable_products").$type<string[]>(),
  applicableCategories: jsonb("applicable_categories").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// NOTIFICATIONS TABLE
// =====================================================

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  status: notificationStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// IN-APP NOTIFICATIONS TABLE (for real-time cross-device sync)
// =====================================================

export const inAppNotifications = pgTable("in_app_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(), // Can be a user ID or "admin" for admin notifications
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

// =====================================================
// CHAT MESSAGES TABLE
// =====================================================

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  
  // User info (for both user and admin to see)
  userId: text("user_id").notNull(),
  userName: varchar("user_name", { length: 200 }).notNull(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  
  // Message content
  text: text("text").notNull(),
  sender: varchar("sender", { length: 10 }).notNull(), // "user" or "admin"
  attachments: jsonb("attachments").$type<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }[]>(),
  
  // Read status
  readByAdmin: boolean("read_by_admin").notNull().default(false),
  readByUser: boolean("read_by_user").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// SUPPLIERS TABLE
// =====================================================

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  website: text("website"),
  taxNumber: varchar("tax_number", { length: 50 }),
  address: jsonb("address").$type<{
    street: string;
    city: string;
    emirate: string;
    country: string;
    postalCode: string;
  }>().notNull(),
  contacts: jsonb("contacts").$type<{
    id: string;
    name: string;
    position: string;
    email: string;
    phone: string;
    isPrimary: boolean;
  }[]>().default([]),
  paymentTerms: supplierPaymentTermsEnum("payment_terms").notNull().default("net_30"),
  currency: currencyEnum("currency").notNull().default("AED"),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }).notNull().default("0"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  categories: jsonb("categories").$type<string[]>().default([]),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  onTimeDeliveryRate: decimal("on_time_delivery_rate", { precision: 5, scale: 2 }).default("0"),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).default("0"),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  status: supplierStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastOrderAt: timestamp("last_order_at"),
});

// =====================================================
// SUPPLIER PRODUCTS TABLE
// =====================================================

export const supplierProducts = pgTable("supplier_products", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  productName: varchar("product_name", { length: 200 }).notNull(),
  supplierSku: varchar("supplier_sku", { length: 100 }),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  minimumOrderQuantity: integer("minimum_order_quantity").notNull().default(1),
  leadTimeDays: integer("lead_time_days").notNull().default(7),
  isPreferred: boolean("is_preferred").notNull().default(false),
  lastPurchasePrice: decimal("last_purchase_price", { precision: 10, scale: 2 }),
  lastPurchaseDate: timestamp("last_purchase_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// PURCHASE ORDERS TABLE
// =====================================================

export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  supplierId: text("supplier_id").notNull().references(() => suppliers.id),
  supplierName: varchar("supplier_name", { length: 200 }).notNull(),
  
  // Pricing
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull().default("0.05"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  
  // Status
  status: purchaseOrderStatusEnum("status").notNull().default("draft"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("pending"),
  
  // Dates
  orderDate: timestamp("order_date").notNull().defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date").notNull(),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  
  // Delivery
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNotes: text("delivery_notes"),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  
  // Approvals
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  // Notes
  internalNotes: text("internal_notes"),
  supplierNotes: text("supplier_notes"),
  
  // History
  statusHistory: jsonb("status_history").$type<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }[]>().default([]),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// PURCHASE ORDER ITEMS TABLE
// =====================================================

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  productName: varchar("product_name", { length: 200 }).notNull(),
  supplierSku: varchar("supplier_sku", { length: 100 }),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: decimal("received_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
});

// =====================================================
// FINANCE ACCOUNTS TABLE
// =====================================================

export const financeAccounts = pgTable("finance_accounts", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  type: accountTypeEnum("type").notNull(),
  balance: decimal("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: currencyEnum("currency").notNull().default("AED"),
  isActive: boolean("is_active").notNull().default(true),
  bankName: varchar("bank_name", { length: 100 }),
  accountNumber: varchar("account_number", { length: 50 }),
  iban: varchar("iban", { length: 50 }),
  lastReconciled: timestamp("last_reconciled"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// FINANCE TRANSACTIONS TABLE
// =====================================================

export const financeTransactions = pgTable("finance_transactions", {
  id: text("id").primaryKey(),
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("AED"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  category: expenseCategoryEnum("category"),
  reference: varchar("reference", { length: 100 }),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: text("reference_id"),
  accountId: text("account_id").notNull().references(() => financeAccounts.id),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  createdBy: text("created_by").notNull(),
  notes: text("notes"),
  attachments: jsonb("attachments").$type<string[]>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// FINANCE EXPENSES TABLE (IFRS/GAAP Enhanced)
// =====================================================

export const financeExpenses = pgTable("finance_expenses", {
  id: text("id").primaryKey(),
  expenseNumber: varchar("expense_number", { length: 50 }).notNull(), // Auto-generated EXP-2026-0001
  
  // Classification (IFRS/IAS 1)
  category: expenseCategoryEnum("category").notNull(),
  function: varchar("function", { length: 50 }).default("administrative"), // cost_of_sales, selling, administrative, finance
  
  // Amounts
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(), // Amount before VAT
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0"), // Input VAT (recoverable)
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("5"), // VAT rate %
  isVatRecoverable: boolean("is_vat_recoverable").default(true), // Can claim input VAT?
  withholdingTax: decimal("withholding_tax", { precision: 10, scale: 2 }).default("0"), // WHT if applicable
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Net amount (gross + VAT - WHT)
  currency: currencyEnum("currency").notNull().default("AED"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }).default("1"), // For multi-currency
  baseCurrencyAmount: decimal("base_currency_amount", { precision: 10, scale: 2 }), // Amount in AED
  
  // Description
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  
  // Vendor/Supplier Info
  vendorId: text("vendor_id"), // Link to vendors table
  vendor: varchar("vendor", { length: 200 }),
  vendorTrn: varchar("vendor_trn", { length: 20 }), // Vendor Tax Registration Number
  
  // Invoice Details
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceDate: timestamp("invoice_date"),
  receivedDate: timestamp("received_date"), // When invoice was received
  
  // Payment Terms (IFRS 9)
  paymentTerms: varchar("payment_terms", { length: 20 }).default("net_30"),
  dueDate: timestamp("due_date"),
  earlyPaymentDiscount: decimal("early_payment_discount", { precision: 5, scale: 2 }).default("0"), // % discount if paid early
  earlyPaymentDays: integer("early_payment_days").default(0), // Days for early payment
  
  // Payment Info
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  paymentReference: varchar("payment_reference", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 50 }), // bank_transfer, cash, card, cheque
  
  // Status & Workflow
  status: expenseStatusEnum("status").notNull().default("pending"),
  approvalStatus: varchar("approval_status", { length: 20 }).default("draft"), // draft, pending_approval, approved, rejected
  
  // Cost Allocation
  costCenterId: text("cost_center_id"), // Link to cost centers
  costCenterName: varchar("cost_center_name", { length: 100 }),
  projectId: text("project_id"), // Link to projects if any
  projectName: varchar("project_name", { length: 100 }),
  departmentId: text("department_id"),
  departmentName: varchar("department_name", { length: 100 }),
  
  // GL Integration
  accountId: text("account_id").references(() => financeAccounts.id),
  glAccountCode: varchar("gl_account_code", { length: 20 }), // Chart of accounts code
  journalEntryId: text("journal_entry_id"), // Link to journal entry when posted
  
  // Approval Workflow
  createdBy: text("created_by").notNull(),
  submittedBy: text("submitted_by"),
  submittedAt: timestamp("submitted_at"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: text("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  // Reimbursement (for employee expenses)
  isReimbursement: boolean("is_reimbursement").default(false),
  employeeId: text("employee_id"), // Employee to reimburse
  reimbursedAt: timestamp("reimbursed_at"),
  
  // Documentation
  attachments: jsonb("attachments").$type<string[]>(),
  notes: text("notes"),
  internalNotes: text("internal_notes"), // For approvers
  
  // Recurring
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 20 }), // daily, weekly, monthly, quarterly, yearly
  recurringEndDate: timestamp("recurring_end_date"),
  parentExpenseId: text("parent_expense_id"), // If created from recurring template
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// COST CENTERS TABLE
// =====================================================

export const costCenters = pgTable("cost_centers", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // CC-001
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  description: text("description"),
  parentId: text("parent_id"), // For hierarchical cost centers
  managerId: text("manager_id"), // Manager responsible
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// EXPENSE BUDGETS TABLE
// =====================================================

export const expenseBudgets = pgTable("expense_budgets", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  
  // Budget Period
  periodType: varchar("period_type", { length: 20 }).notNull(), // monthly, quarterly, yearly
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Scope
  category: varchar("category", { length: 50 }), // Specific category or null for all
  costCenterId: text("cost_center_id"),
  departmentId: text("department_id"),
  
  // Amounts
  budgetAmount: decimal("budget_amount", { precision: 12, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 12, scale: 2 }).default("0"),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }),
  
  // Alerts
  alertThreshold: integer("alert_threshold").default(80), // Alert at 80% spent
  isAlertSent: boolean("is_alert_sent").default(false),
  
  // Status
  isActive: boolean("is_active").default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// EXPENSE APPROVAL RULES TABLE
// =====================================================

export const expenseApprovalRules = pgTable("expense_approval_rules", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  
  // Rule Criteria
  minAmount: decimal("min_amount", { precision: 10, scale: 2 }).default("0"),
  maxAmount: decimal("max_amount", { precision: 10, scale: 2 }), // Null = no upper limit
  category: varchar("category", { length: 50 }), // Specific category or null for all
  costCenterId: text("cost_center_id"),
  
  // Approval Chain
  approverLevel: integer("approver_level").notNull().default(1), // 1, 2, 3...
  approverId: text("approver_id"), // Specific approver
  approverRole: varchar("approver_role", { length: 50 }), // Or role-based (manager, finance, cfo)
  
  // Settings
  requiresAllApprovers: boolean("requires_all_approvers").default(false), // All levels or any
  autoApproveBelow: decimal("auto_approve_below", { precision: 10, scale: 2 }), // Auto-approve small amounts
  
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // Rule priority
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// VENDORS/SUPPLIERS TABLE
// =====================================================

export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // V-001
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  
  // Contact
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  mobile: varchar("mobile", { length: 20 }),
  website: varchar("website", { length: 255 }),
  
  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  emirate: varchar("emirate", { length: 50 }),
  country: varchar("country", { length: 100 }).default("UAE"),
  
  // Tax Info
  trn: varchar("trn", { length: 20 }), // Tax Registration Number
  tradeLicense: varchar("trade_license", { length: 50 }),
  
  // Payment
  defaultPaymentTerms: varchar("default_payment_terms", { length: 20 }).default("net_30"),
  bankName: varchar("bank_name", { length: 100 }),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }),
  bankIban: varchar("bank_iban", { length: 50 }),
  bankSwift: varchar("bank_swift", { length: 20 }),
  
  // Categories
  category: varchar("category", { length: 50 }), // supplier, contractor, service_provider
  expenseCategories: jsonb("expense_categories").$type<string[]>(), // Typical expense categories
  
  // Balance
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).default("0"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0"), // Amount owed
  
  // Status
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// SAVED CARDS TABLE
// =====================================================

export const savedCards = pgTable("saved_cards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  brand: varchar("brand", { length: 50 }).notNull(),
  last4: varchar("last4", { length: 4 }).notNull(),
  expiryMonth: integer("expiry_month").notNull(),
  expiryYear: integer("expiry_year").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  token: text("token").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// WALLET TABLES
// =====================================================

export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "credit",
  "debit",
  "refund",
  "topup",
  "cashback",
]);

export const wallets = pgTable("wallets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: walletTransactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  reference: varchar("reference", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// WISHLIST TABLE
// =====================================================

export const wishlists = pgTable("wishlists", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// PRODUCT REVIEWS TABLE
// =====================================================

export const productReviews = pgTable("product_reviews", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userName: varchar("user_name", { length: 200 }).notNull(),
  rating: integer("rating").notNull(), // 1-5
  title: varchar("title", { length: 200 }).notNull(),
  comment: text("comment").notNull(),
  images: jsonb("images").$type<string[]>(),
  isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
  helpfulCount: integer("helpful_count").notNull().default(0),
  isApproved: boolean("is_approved").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// LOYALTY TABLES
// =====================================================

export const loyaltyTransactionTypeEnum = pgEnum("loyalty_transaction_type", [
  "earn",
  "redeem",
  "bonus",
  "expire",
]);

export const loyaltyPoints = pgTable("loyalty_points", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  points: integer("points").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  referredBy: text("referred_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: loyaltyTransactionTypeEnum("type").notNull(),
  points: integer("points").notNull(),
  description: text("description").notNull(),
  orderId: text("order_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// APP SETTINGS TABLES
// =====================================================

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("default"),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).notNull().default("0.05"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull().default("15"),
  freeDeliveryThreshold: decimal("free_delivery_threshold", { precision: 10, scale: 2 }).notNull().default("200"),
  expressDeliveryFee: decimal("express_delivery_fee", { precision: 10, scale: 2 }).notNull().default("25"),
  minimumOrderAmount: decimal("minimum_order_amount", { precision: 10, scale: 2 }).notNull().default("50"),
  maxOrdersPerDay: integer("max_orders_per_day").notNull().default(100),
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
  storePhone: varchar("store_phone", { length: 20 }).default("+971 4 123 4567"),
  storeEmail: varchar("store_email", { length: 255 }).default("support@aljazirabutcher.ae"),
  storeAddress: text("store_address"),
  storeAddressAr: text("store_address_ar"),
  workingHoursStart: varchar("working_hours_start", { length: 10 }).default("08:00"),
  workingHoursEnd: varchar("working_hours_end", { length: 10 }).default("22:00"),
  // UAE Compliance Fields
  taxRegistrationNumber: varchar("tax_registration_number", { length: 20 }), // TRN for UAE VAT
  tradeLicenseNumber: varchar("trade_license_number", { length: 50 }),
  companyNameEn: varchar("company_name_en", { length: 200 }).default("Al Jazira Butcher Shop"),
  companyNameAr: varchar("company_name_ar", { length: 200 }).default("ملحمة الجزيرة"),
  fiscalYearStart: varchar("fiscal_year_start", { length: 5 }).default("01-01"), // MM-DD
  fiscalYearEnd: varchar("fiscal_year_end", { length: 5 }).default("12-31"), // MM-DD
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const banners = pgTable("banners", {
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
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deliveryTimeSlots = pgTable("delivery_time_slots", {
  id: text("id").primaryKey(),
  label: varchar("label", { length: 100 }).notNull(),
  labelAr: varchar("label_ar", { length: 100 }).notNull(),
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
  isExpressSlot: boolean("is_express_slot").notNull().default(false),
  maxOrders: integer("max_orders").notNull().default(20),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loyaltyTiers = pgTable("loyalty_tiers", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  nameAr: varchar("name_ar", { length: 50 }).notNull(),
  minPoints: integer("min_points").notNull(),
  multiplier: decimal("multiplier", { precision: 3, scale: 1 }).notNull().default("1"),
  benefits: jsonb("benefits").$type<string[]>().notNull(),
  benefitsAr: jsonb("benefits_ar").$type<string[]>().notNull(),
  icon: varchar("icon", { length: 10 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// RELATIONS
// =====================================================

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  sessions: many(sessions),
  notifications: many(notifications),
  savedCards: many(savedCards),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  tracking: many(deliveryTracking),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  stock: one(stock, {
    fields: [products.id],
    references: [stock.productId],
  }),
  stockMovements: many(stockMovements),
  supplierProducts: many(supplierProducts),
}));

export const stockRelations = relations(stock, ({ one }) => ({
  product: one(products, {
    fields: [stock.productId],
    references: [products.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(supplierProducts),
  purchaseOrders: many(purchaseOrders),
}));

export const supplierProductsRelations = relations(supplierProducts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierProducts.supplierId],
    references: [suppliers.id],
  }),
  product: one(products, {
    fields: [supplierProducts.productId],
    references: [products.id],
  }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
}));

// =====================================================
// UAE COMPLIANCE - CHART OF ACCOUNTS (Double-Entry)
// =====================================================

export const accountClassEnum = pgEnum("account_class", [
  "asset",        // Assets (1xxx)
  "liability",    // Liabilities (2xxx)
  "equity",       // Equity (3xxx)
  "revenue",      // Revenue (4xxx)
  "expense",      // Expenses (5xxx)
]);

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(), // Account code (e.g., 1100, 2100)
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  accountClass: accountClassEnum("account_class").notNull(),
  parentId: text("parent_id"), // For sub-accounts
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isSystemAccount: boolean("is_system_account").notNull().default(false), // Cannot be deleted
  balance: decimal("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  normalBalance: varchar("normal_balance", { length: 10 }).notNull().default("debit"), // debit or credit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// UAE COMPLIANCE - JOURNAL ENTRIES (Audit Trail)
// =====================================================

export const journalEntryStatusEnum = pgEnum("journal_entry_status", [
  "draft",
  "posted",
  "reversed",
]);

export const journalEntries = pgTable("journal_entries", {
  id: text("id").primaryKey(),
  entryNumber: varchar("entry_number", { length: 20 }).notNull().unique(), // JE-2026-0001
  entryDate: timestamp("entry_date").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  reference: varchar("reference", { length: 100 }), // Order number, invoice, etc.
  referenceType: varchar("reference_type", { length: 50 }), // order, expense, adjustment
  referenceId: text("reference_id"),
  status: journalEntryStatusEnum("status").notNull().default("draft"),
  totalDebit: decimal("total_debit", { precision: 14, scale: 2 }).notNull().default("0"),
  totalCredit: decimal("total_credit", { precision: 14, scale: 2 }).notNull().default("0"),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  postedAt: timestamp("posted_at"),
  reversedAt: timestamp("reversed_at"),
  reversalEntryId: text("reversal_entry_id"), // Links to reversal entry
  notes: text("notes"),
  attachments: jsonb("attachments").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const journalEntryLines = pgTable("journal_entry_lines", {
  id: text("id").primaryKey(),
  journalEntryId: text("journal_entry_id").notNull().references(() => journalEntries.id),
  accountId: text("account_id").notNull().references(() => chartOfAccounts.id),
  accountCode: varchar("account_code", { length: 10 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  debit: decimal("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: decimal("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// UAE COMPLIANCE - AUDIT LOG
// =====================================================

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // order, payment, expense, etc.
  entityId: text("entity_id").notNull(),
  action: varchar("action", { length: 20 }).notNull(), // create, update, delete, approve, etc.
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  changedFields: jsonb("changed_fields").$type<string[]>(),
  userId: text("user_id").notNull(),
  userName: varchar("user_name", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// UAE COMPLIANCE - VAT RETURNS
// =====================================================

export const vatReturnStatusEnum = pgEnum("vat_return_status", [
  "draft",
  "submitted",
  "accepted",
  "rejected",
  "amended",
]);

export const vatReturns = pgTable("vat_returns", {
  id: text("id").primaryKey(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  dueDate: timestamp("due_date").notNull(),
  // Box 1: Standard rated supplies in Abu Dhabi
  box1Amount: decimal("box1_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  box1Vat: decimal("box1_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 2: Standard rated supplies in Dubai
  box2Amount: decimal("box2_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  box2Vat: decimal("box2_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 3: Standard rated supplies in Sharjah
  box3Amount: decimal("box3_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  box3Vat: decimal("box3_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 4: Standard rated supplies in Ajman
  box4Amount: decimal("box4_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  box4Vat: decimal("box4_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 5: Standard rated supplies in UAQ
  box5Amount: decimal("box5_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  box5Vat: decimal("box5_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 6: Standard rated supplies in RAK
  box6Amount: decimal("box6_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  box6Vat: decimal("box6_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 7: Standard rated supplies in Fujairah
  box7Amount: decimal("box7_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  box7Vat: decimal("box7_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 8: Zero-rated supplies
  box8Amount: decimal("box8_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 9: Exempt supplies
  box9Amount: decimal("box9_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  // Box 10: Recoverable VAT on expenses
  box10Vat: decimal("box10_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  // Calculated fields
  totalSalesVat: decimal("total_sales_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  totalPurchasesVat: decimal("total_purchases_vat", { precision: 14, scale: 2 }).notNull().default("0"),
  netVatDue: decimal("net_vat_due", { precision: 14, scale: 2 }).notNull().default("0"),
  status: vatReturnStatusEnum("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  submittedBy: text("submitted_by"),
  ftaReferenceNumber: varchar("fta_reference_number", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Journal entry relations
export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalEntryLines),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(chartOfAccounts, {
    fields: [journalEntryLines.accountId],
    references: [chartOfAccounts.id],
  }),
}));
