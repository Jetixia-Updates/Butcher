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
export const paymentTermsEnum = pgEnum("payment_terms", ["net_7", "net_15", "net_30", "net_60", "cod", "prepaid"]);
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
export const expenseCategoryEnum = pgEnum("expense_category", [
  "inventory",
  "utilities",
  "salaries",
  "rent",
  "marketing",
  "equipment",
  "maintenance",
  "delivery",
  "taxes",
  "other",
]);
export const accountTypeEnum = pgEnum("account_type", ["cash", "bank", "card_payments", "cod_collections", "petty_cash"]);
export const expenseStatusEnum = pgEnum("expense_status", ["pending", "paid", "overdue", "cancelled"]);
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
    state: string;
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
  paymentTerms: paymentTermsEnum("payment_terms").notNull().default("net_30"),
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
// FINANCE EXPENSES TABLE
// =====================================================

export const financeExpenses = pgTable("finance_expenses", {
  id: text("id").primaryKey(),
  category: expenseCategoryEnum("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("AED"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  vendor: varchar("vendor", { length: 200 }),
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceDate: timestamp("invoice_date"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  status: expenseStatusEnum("status").notNull().default("pending"),
  accountId: text("account_id").references(() => financeAccounts.id),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  attachments: jsonb("attachments").$type<string[]>(),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 20 }),
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
