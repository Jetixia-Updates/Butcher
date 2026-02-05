/**
 * Drizzle ORM Schema for Butcher Shop Database
 * MySQL schema definitions (FreeHostia)
 */

import {
  mysqlTable,
  text,
  varchar,
  int,
  boolean,
  timestamp,
  decimal,
  json,
  mysqlEnum,
  float,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm/relations";

// =====================================================
// USERS TABLE
// =====================================================

export const users = mysqlTable("users", {
  id: varchar("id", { length: 100 }).primaryKey(),
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
  permissions: json("permissions").$type<{
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

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// ADDRESSES TABLE
// =====================================================

export const addresses = mysqlTable("addresses", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
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

// =====================================================
// PRODUCT CATEGORIES TABLE
// =====================================================

export const productCategories = mysqlTable("product_categories", {
  id: varchar("id", { length: 100 }).primaryKey(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 100 }),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// PRODUCTS TABLE
// =====================================================

export const products = mysqlTable("products", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).notNull().default("0"),
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
  rating: decimal("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  tags: json("tags").$type<string[]>().default([]),
  badges: json("badges").$type<("halal" | "organic" | "grass-fed" | "premium" | "fresh" | "local")[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// STOCK TABLE
// =====================================================

export const stock = mysqlTable("stock", {
  id: varchar("id", { length: 100 }).primaryKey(),
  productId: varchar("product_id", { length: 100 }).notNull().unique(),
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

// =====================================================
// STOCK MOVEMENTS TABLE
// =====================================================

export const stockMovements = mysqlTable("stock_movements", {
  id: varchar("id", { length: 100 }).primaryKey(),
  productId: varchar("product_id", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["in", "out", "adjustment", "reserved", "released"]).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  previousQuantity: decimal("previous_quantity", { precision: 10, scale: 2 }).notNull(),
  newQuantity: decimal("new_quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: varchar("reference_id", { length: 100 }),
  performedBy: varchar("performed_by", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// ORDERS TABLE
// =====================================================

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 100 }).primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  userId: varchar("user_id", { length: 100 }).notNull(),
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
  status: mysqlEnum("status", [
    "pending", "confirmed", "processing", "ready_for_pickup",
    "out_for_delivery", "delivered", "cancelled", "refunded"
  ]).notNull().default("pending"),
  paymentStatus: mysqlEnum("payment_status", [
    "pending", "authorized", "captured", "failed", "refunded", "partially_refunded"
  ]).notNull().default("pending"),
  paymentMethod: mysqlEnum("payment_method", ["card", "cod", "bank_transfer"]).notNull(),
  
  // Delivery
  addressId: varchar("address_id", { length: 100 }).notNull(),
  deliveryAddress: json("delivery_address").$type<{
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
  deliveryZoneId: varchar("delivery_zone_id", { length: 100 }),
  estimatedDeliveryAt: timestamp("estimated_delivery_at"),
  actualDeliveryAt: timestamp("actual_delivery_at"),
  
  // Status History
  statusHistory: json("status_history").$type<{
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

export const orderItems = mysqlTable("order_items", {
  id: varchar("id", { length: 100 }).primaryKey(),
  orderId: varchar("order_id", { length: 100 }).notNull(),
  productId: varchar("product_id", { length: 100 }).notNull(),
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

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 100 }).primaryKey(),
  orderId: varchar("order_id", { length: 100 }).notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["AED", "USD", "EUR"]).notNull().default("AED"),
  method: mysqlEnum("method", ["card", "cod", "bank_transfer"]).notNull(),
  status: mysqlEnum("status", [
    "pending", "authorized", "captured", "failed", "refunded", "partially_refunded"
  ]).notNull().default("pending"),
  
  // Card details (masked)
  cardBrand: varchar("card_brand", { length: 50 }),
  cardLast4: varchar("card_last4", { length: 4 }),
  cardExpiryMonth: int("card_expiry_month"),
  cardExpiryYear: int("card_expiry_year"),
  
  // Gateway details
  gatewayTransactionId: text("gateway_transaction_id"),
  gatewayResponse: text("gateway_response"),
  
  // Refund details
  refundedAmount: decimal("refunded_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  refunds: json("refunds").$type<{
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

export const deliveryZones = mysqlTable("delivery_zones", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }),
  emirate: varchar("emirate", { length: 100 }).notNull(),
  areas: json("areas").$type<string[]>().notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: decimal("minimum_order", { precision: 10, scale: 2 }).notNull(),
  estimatedMinutes: int("estimated_minutes").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Express delivery settings
  expressEnabled: boolean("express_enabled").notNull().default(false),
  expressFee: decimal("express_fee", { precision: 10, scale: 2 }).notNull().default("25"),
  expressHours: int("express_hours").notNull().default(1),
});

// =====================================================
// DELIVERY TRACKING TABLE
// =====================================================

export const deliveryTracking = mysqlTable("delivery_tracking", {
  id: varchar("id", { length: 100 }).primaryKey(),
  orderId: varchar("order_id", { length: 100 }).notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  driverId: varchar("driver_id", { length: 100 }),
  driverName: varchar("driver_name", { length: 200 }),
  driverMobile: varchar("driver_mobile", { length: 20 }),
  status: mysqlEnum("status", [
    "assigned", "picked_up", "in_transit", "nearby", "delivered", "failed"
  ]).notNull().default("assigned"),
  currentLocation: json("current_location").$type<{
    latitude: number;
    longitude: number;
    updatedAt: string;
  }>(),
  estimatedArrival: timestamp("estimated_arrival"),
  actualArrival: timestamp("actual_arrival"),
  deliveryProof: json("delivery_proof").$type<{
    signature?: string;
    photo?: string;
    notes?: string;
  }>(),
  timeline: json("timeline").$type<{
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

export const discountCodes = mysqlTable("discount_codes", {
  id: varchar("id", { length: 100 }).primaryKey(),
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

// =====================================================
// NOTIFICATIONS TABLE
// =====================================================

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  type: mysqlEnum("type", [
    "order_placed", "order_confirmed", "order_processing", "order_ready",
    "order_shipped", "order_delivered", "order_cancelled", "payment_received",
    "payment_failed", "refund_processed", "low_stock", "promotional"
  ]).notNull(),
  channel: mysqlEnum("channel", ["sms", "email", "push"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed"]).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// IN-APP NOTIFICATIONS TABLE
// =====================================================

export const inAppNotifications = mysqlTable("in_app_notifications", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  titleAr: varchar("title_ar", { length: 200 }).notNull(),
  message: text("message").notNull(),
  messageAr: text("message_ar").notNull(),
  link: text("link"),
  linkTab: varchar("link_tab", { length: 50 }),
  linkId: varchar("link_id", { length: 100 }),
  unread: boolean("unread").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// CHAT MESSAGES TABLE
// =====================================================

export const chatMessages = mysqlTable("chat_messages", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
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

// =====================================================
// SUPPLIERS TABLE
// =====================================================

export const suppliers = mysqlTable("suppliers", {
  id: varchar("id", { length: 100 }).primaryKey(),
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

// =====================================================
// SUPPLIER PRODUCTS TABLE
// =====================================================

export const supplierProducts = mysqlTable("supplier_products", {
  id: varchar("id", { length: 100 }).primaryKey(),
  supplierId: varchar("supplier_id", { length: 100 }).notNull(),
  productId: varchar("product_id", { length: 100 }).notNull(),
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

// =====================================================
// PURCHASE ORDERS TABLE
// =====================================================

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: varchar("id", { length: 100 }).primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  supplierId: varchar("supplier_id", { length: 100 }).notNull(),
  supplierName: varchar("supplier_name", { length: 200 }).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull().default("0.05"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", [
    "draft", "pending", "approved", "ordered", "partially_received", "received", "cancelled"
  ]).notNull().default("draft"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("pending"),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date").notNull(),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNotes: text("delivery_notes"),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  approvedBy: varchar("approved_by", { length: 100 }),
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

// =====================================================
// PURCHASE ORDER ITEMS TABLE
// =====================================================

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: varchar("id", { length: 100 }).primaryKey(),
  purchaseOrderId: varchar("purchase_order_id", { length: 100 }).notNull(),
  productId: varchar("product_id", { length: 100 }).notNull(),
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

export const financeAccounts = mysqlTable("finance_accounts", {
  id: varchar("id", { length: 100 }).primaryKey(),
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

// =====================================================
// FINANCE TRANSACTIONS TABLE
// =====================================================

export const financeTransactions = mysqlTable("finance_transactions", {
  id: varchar("id", { length: 100 }).primaryKey(),
  type: mysqlEnum("type", ["sale", "refund", "expense", "purchase", "adjustment", "payout"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).notNull().default("pending"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: mysqlEnum("currency", ["AED", "USD", "EUR"]).notNull().default("AED"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  category: varchar("category", { length: 50 }),
  reference: varchar("reference", { length: 100 }),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: varchar("reference_id", { length: 100 }),
  accountId: varchar("account_id", { length: 100 }).notNull(),
  accountName: varchar("account_name", { length: 100 }).notNull(),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  notes: text("notes"),
  attachments: json("attachments").$type<string[]>(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// FINANCE EXPENSES TABLE
// =====================================================

export const financeExpenses = mysqlTable("finance_expenses", {
  id: varchar("id", { length: 100 }).primaryKey(),
  expenseNumber: varchar("expense_number", { length: 50 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
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
  vendorId: varchar("vendor_id", { length: 100 }),
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
  costCenterId: varchar("cost_center_id", { length: 100 }),
  costCenterName: varchar("cost_center_name", { length: 100 }),
  projectId: varchar("project_id", { length: 100 }),
  projectName: varchar("project_name", { length: 100 }),
  departmentId: varchar("department_id", { length: 100 }),
  departmentName: varchar("department_name", { length: 100 }),
  accountId: varchar("account_id", { length: 100 }),
  glAccountCode: varchar("gl_account_code", { length: 20 }),
  journalEntryId: varchar("journal_entry_id", { length: 100 }),
  createdBy: varchar("created_by", { length: 100 }).notNull(),
  submittedBy: varchar("submitted_by", { length: 100 }),
  submittedAt: timestamp("submitted_at"),
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by", { length: 100 }),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  isReimbursement: boolean("is_reimbursement").default(false),
  employeeId: varchar("employee_id", { length: 100 }),
  reimbursedAt: timestamp("reimbursed_at"),
  attachments: json("attachments").$type<string[]>(),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringFrequency: varchar("recurring_frequency", { length: 20 }),
  recurringEndDate: timestamp("recurring_end_date"),
  parentExpenseId: varchar("parent_expense_id", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// SAVED CARDS TABLE
// =====================================================

export const savedCards = mysqlTable("saved_cards", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  brand: varchar("brand", { length: 50 }).notNull(),
  last4: varchar("last4", { length: 4 }).notNull(),
  expiryMonth: int("expiry_month").notNull(),
  expiryYear: int("expiry_year").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  token: text("token").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// WALLET TABLES
// =====================================================

export const wallets = mysqlTable("wallets", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTransactions = mysqlTable("wallet_transactions", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["credit", "debit", "refund", "topup", "cashback"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar").notNull(),
  reference: varchar("reference", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// WISHLIST TABLE
// =====================================================

export const wishlists = mysqlTable("wishlists", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  productId: varchar("product_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// PRODUCT REVIEWS TABLE
// =====================================================

export const productReviews = mysqlTable("product_reviews", {
  id: varchar("id", { length: 100 }).primaryKey(),
  productId: varchar("product_id", { length: 100 }).notNull(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  userName: varchar("user_name", { length: 200 }).notNull(),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  comment: text("comment").notNull(),
  images: json("images").$type<string[]>(),
  isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
  helpfulCount: int("helpful_count").notNull().default(0),
  isApproved: boolean("is_approved").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// LOYALTY TABLES
// =====================================================

export const loyaltyPoints = mysqlTable("loyalty_points", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().unique(),
  points: int("points").notNull().default(0),
  totalEarned: int("total_earned").notNull().default(0),
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  referredBy: varchar("referred_by", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const loyaltyTransactions = mysqlTable("loyalty_transactions", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["earn", "redeem", "bonus", "expire"]).notNull(),
  points: int("points").notNull(),
  description: text("description").notNull(),
  orderId: varchar("order_id", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// APP SETTINGS TABLES
// =====================================================

export const appSettings = mysqlTable("app_settings", {
  id: varchar("id", { length: 100 }).primaryKey().default("default"),
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
  storePhone: varchar("store_phone", { length: 20 }).default("+971 4 123 4567"),
  storeEmail: varchar("store_email", { length: 255 }).default("support@aljazirabutcher.ae"),
  storeAddress: text("store_address"),
  storeAddressAr: text("store_address_ar"),
  workingHoursStart: varchar("working_hours_start", { length: 10 }).default("08:00"),
  workingHoursEnd: varchar("working_hours_end", { length: 10 }).default("22:00"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const banners = mysqlTable("banners", {
  id: varchar("id", { length: 100 }).primaryKey(),
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

export const deliveryTimeSlots = mysqlTable("delivery_time_slots", {
  id: varchar("id", { length: 100 }).primaryKey(),
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

export const loyaltyTiers = mysqlTable("loyalty_tiers", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  nameAr: varchar("name_ar", { length: 50 }).notNull(),
  minPoints: int("min_points").notNull(),
  multiplier: decimal("multiplier", { precision: 3, scale: 1 }).notNull().default("1"),
  benefits: json("benefits").$type<string[]>().notNull(),
  benefitsAr: json("benefits_ar").$type<string[]>().notNull(),
  icon: varchar("icon", { length: 10 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
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
