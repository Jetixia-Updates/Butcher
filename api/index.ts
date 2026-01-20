import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, or, ilike, desc, and, gte, lte, ne } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  decimal,
  integer,
  real,
} from 'drizzle-orm/pg-core';

// =====================================================
// NEON DATABASE CONNECTION
// =====================================================

const databaseUrl = process.env.DATABASE_URL;
const neonClient = databaseUrl ? neon(databaseUrl) : null;
const pgDb = neonClient ? drizzle(neonClient) : null;

// User role enum and table definition (inline for Vercel)
const userRoleEnum = pgEnum("user_role", ["customer", "admin", "staff", "delivery"]);

const usersTable = pgTable("users", {
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Unit enum for products
const unitEnum = pgEnum("unit", ["kg", "piece", "gram"]);

// Products table - MATCHES ACTUAL DATABASE SCHEMA
const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  nameAr: varchar("name_ar", { length: 200 }),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  // Note: discount, rating, badges columns don't exist in actual DB
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  descriptionAr: text("description_ar"),
  image: text("image"),
  unit: unitEnum("unit").notNull().default("kg"),
  minOrderQuantity: decimal("min_order_quantity", { precision: 10, scale: 2 }).notNull().default("0.25"),
  maxOrderQuantity: decimal("max_order_quantity", { precision: 10, scale: 2 }).notNull().default("10"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Stock table - integer thresholds match actual DB
const stockTable = pgTable("stock", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().unique(),
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

// Stock movements table - MATCHES ACTUAL DATABASE SCHEMA
const stockMovementTypeEnum = pgEnum("stock_movement_type", ["in", "out", "adjustment", "reserved", "released"]);
const stockMovementsTable = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
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

// Orders table
const orderStatusEnum = pgEnum("order_status", [
  "pending", "confirmed", "processing", "ready_for_pickup", 
  "out_for_delivery", "delivered", "cancelled", "refunded"
]);
const paymentStatusEnum = pgEnum("payment_status", [
  "pending", "authorized", "captured", "failed", "refunded", "partially_refunded"
]);
const paymentMethodEnum = pgEnum("payment_method", ["card", "cod", "bank_transfer"]);

const ordersTable = pgTable("orders", {
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
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  addressId: text("address_id").notNull(),
  deliveryAddress: jsonb("delivery_address").$type<any>().notNull(),
  deliveryNotes: text("delivery_notes"),
  deliveryZoneId: text("delivery_zone_id"),
  estimatedDeliveryAt: timestamp("estimated_delivery_at"),
  actualDeliveryAt: timestamp("actual_delivery_at"),
  statusHistory: jsonb("status_history").$type<any[]>().default([]),
  source: varchar("source", { length: 20 }).notNull().default("web"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Order items table
const orderItemsTable = pgTable("order_items", {
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
const currencyEnum = pgEnum("currency", ["AED", "USD", "EUR"]);
const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull().default("AED"),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  cardBrand: varchar("card_brand", { length: 50 }),
  cardLast4: varchar("card_last4", { length: 4 }),
  cardExpiryMonth: integer("card_expiry_month"),
  cardExpiryYear: integer("card_expiry_year"),
  gatewayTransactionId: text("gateway_transaction_id"),
  gatewayResponse: text("gateway_response"),
  refundedAmount: decimal("refunded_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  refunds: jsonb("refunds").$type<any[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Addresses table
const addressesTable = pgTable("addresses", {
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
  latitude: real("latitude"),
  longitude: real("longitude"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Delivery zones table
const deliveryZonesTable = pgTable("delivery_zones", {
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

// Delivery tracking table
const deliveryTrackingStatusEnum = pgEnum("delivery_tracking_status", [
  "assigned", "picked_up", "in_transit", "nearby", "delivered", "failed"
]);
const deliveryTrackingTable = pgTable("delivery_tracking", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull(),
  driverId: text("driver_id"),
  driverName: varchar("driver_name", { length: 200 }),
  driverMobile: varchar("driver_mobile", { length: 20 }),
  status: deliveryTrackingStatusEnum("status").notNull().default("assigned"),
  currentLocation: jsonb("current_location").$type<any>(),
  estimatedArrival: timestamp("estimated_arrival"),
  actualArrival: timestamp("actual_arrival"),
  deliveryProof: jsonb("delivery_proof").$type<any>(),
  timeline: jsonb("timeline").$type<any[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

// In-memory storage (note: resets on cold starts)
const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const orders = new Map<string, Order>();
const stockItems = new Map<string, StockItem>();
const stockMovements: StockMovement[] = [];
const payments = new Map<string, Payment>();
const addresses = new Map<string, Address>();

// Demo products data
const demoProducts = [
  { id: 'prod_1', name: 'Premium Beef Steak', nameAr: 'ستيك لحم بقري ممتاز', price: 89.99, category: 'Beef', unit: 'kg', isActive: true, isFeatured: true, isPremium: true, description: 'Premium quality beef steak', descriptionAr: 'ستيك لحم بقري عالي الجودة', available: true },
  { id: 'prod_2', name: 'Lamb Chops', nameAr: 'ريش لحم ضأن', price: 74.50, category: 'Lamb', unit: 'kg', isActive: true, isFeatured: true, isPremium: true, description: 'Fresh lamb chops', descriptionAr: 'ريش لحم ضأن طازجة', available: true },
  { id: 'prod_3', name: 'Chicken Breast', nameAr: 'صدر دجاج', price: 34.99, category: 'Chicken', unit: 'kg', isActive: true, isFeatured: false, isPremium: false, description: 'Boneless chicken breast', descriptionAr: 'صدر دجاج بدون عظم', available: true },
  { id: 'prod_4', name: 'Ground Beef', nameAr: 'لحم بقري مفروم', price: 45.00, category: 'Beef', unit: 'kg', isActive: true, isFeatured: false, isPremium: false, description: 'Fresh ground beef', descriptionAr: 'لحم بقري مفروم طازج', available: true },
  { id: 'prod_5', name: 'Beef Brisket', nameAr: 'صدر لحم بقري', price: 95.00, category: 'Beef', unit: 'kg', isActive: true, isFeatured: true, isPremium: true, description: 'Premium beef brisket', descriptionAr: 'صدر لحم بقري ممتاز', available: true },
  { id: 'prod_6', name: 'Goat Leg', nameAr: 'فخذ ماعز', price: 125.00, category: 'Goat', unit: 'piece', isActive: true, isFeatured: true, isPremium: true, description: 'Whole goat leg', descriptionAr: 'فخذ ماعز كامل', available: true },
  { id: 'prod_7', name: 'Lamb Leg', nameAr: 'فخذ ضأن', price: 125.00, category: 'Lamb', unit: 'piece', isActive: true, isFeatured: false, isPremium: true, description: 'Whole lamb leg, perfect for family dinners', descriptionAr: 'فخذ ضأن كامل، مثالي لعشاء العائلة', available: false },
  { id: 'prod_8', name: 'Goat Ribs', nameAr: 'ريش ماعز', price: 95.00, category: 'Goat', unit: 'kg', isActive: true, isFeatured: true, isPremium: true, description: 'Premium goat ribs, perfect for grilling', descriptionAr: 'ريش ماعز ممتازة، مثالية للشوي', available: true },
  { id: 'prod_9', name: 'Wagyu Ribeye', nameAr: 'واغيو ريب آي', price: 249.99, category: 'Beef', unit: 'kg', isActive: true, isFeatured: true, isPremium: true, description: 'Premium Australian Wagyu A5, melt-in-your-mouth texture', descriptionAr: 'واغيو أسترالي ممتاز A5، قوام يذوب في الفم', available: true },
  { id: 'prod_10', name: 'Organic Chicken Thighs', nameAr: 'أفخاذ دجاج عضوي', price: 42.99, category: 'Chicken', unit: 'kg', isActive: true, isFeatured: false, isPremium: false, description: 'Free-range organic chicken thighs, extra juicy', descriptionAr: 'أفخاذ دجاج عضوي حر، طرية وغنية بالعصارة', available: true },
];

// Seed initial data
function seedData() {
  if (users.size > 0) return; // Already seeded
  
  // Admin user
  users.set("admin_1", {
    id: "admin_1",
    username: "admin",
    email: "admin@butcher.ae",
    mobile: "+971501234567",
    password: "admin123",
    firstName: "Admin",
    familyName: "User",
    role: "admin",
    isActive: true,
    isVerified: true,
    emirate: "Dubai",
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      language: "en",
      currency: "AED",
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: false,
    },
  });

  // Demo customers
  const customerData = [
    { id: "user_1", username: "Mohamed", email: "ahmed@example.com", mobile: "+971501111111", firstName: "Ahmed", familyName: "Al Maktoum", emirate: "Dubai" },
    { id: "user_2", username: "fatima", email: "fatima@example.com", mobile: "+971502222222", firstName: "Fatima", familyName: "Al Nahyan", emirate: "Abu Dhabi" },
    { id: "user_3", username: "omar", email: "omar@example.com", mobile: "+971503333333", firstName: "Omar", familyName: "Al Qasimi", emirate: "Sharjah" },
    { id: "user_4", username: "sara", email: "sara@example.com", mobile: "+971504444444", firstName: "Sara", familyName: "Al Falasi", emirate: "Dubai" },
    { id: "user_5", username: "khalid", email: "khalid@example.com", mobile: "+971505555555", firstName: "Khalid", familyName: "Al Rashid", emirate: "Ajman" },
  ];

  customerData.forEach((c, i) => {
    users.set(c.id, {
      ...c,
      password: "password123",
      role: "customer",
      isActive: true,
      isVerified: true,
      createdAt: new Date(Date.now() - (60 - i * 10) * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: { language: "en", currency: "AED", emailNotifications: true, smsNotifications: true, marketingEmails: true },
    });
  });

  // Delivery staff
  users.set("driver_1", {
    id: "driver_1",
    username: "driver1",
    email: "driver1@butcher.ae",
    mobile: "+971509999999",
    password: "driver123",
    firstName: "Mohammed",
    familyName: "Driver",
    role: "delivery",
    isActive: true,
    isVerified: true,
    emirate: "Dubai",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: { language: "en", currency: "AED", emailNotifications: true, smsNotifications: true, marketingEmails: false },
  });

  // Demo orders
  const orderStatuses = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];
  const paymentStatuses = ['pending', 'authorized', 'captured'];
  const paymentMethods = ['card', 'cod', 'bank_transfer'];

  for (let i = 1; i <= 15; i++) {
    const customer = customerData[(i - 1) % customerData.length];
    const status = orderStatuses[i % orderStatuses.length];
    const paymentStatus = status === 'delivered' ? 'captured' : paymentStatuses[i % paymentStatuses.length];
    const orderDate = new Date(Date.now() - i * 2 * 60 * 60 * 1000);
    
    const items = [
      { id: `item_${i}_1`, productId: demoProducts[i % 6].id, productName: demoProducts[i % 6].name, quantity: 1 + (i % 3), unitPrice: demoProducts[i % 6].price, totalPrice: (1 + (i % 3)) * demoProducts[i % 6].price },
      { id: `item_${i}_2`, productId: demoProducts[(i + 1) % 6].id, productName: demoProducts[(i + 1) % 6].name, quantity: 1, unitPrice: demoProducts[(i + 1) % 6].price, totalPrice: demoProducts[(i + 1) % 6].price },
    ];
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryFee = 15;
    const vatRate = 0.05;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + deliveryFee + vatAmount;

    const order: Order = {
      id: `order_${i}`,
      orderNumber: `ORD-2026-${String(i).padStart(4, '0')}`,
      userId: customer.id,
      customerName: `${customer.firstName} ${customer.familyName}`,
      customerEmail: customer.email,
      customerMobile: customer.mobile,
      items,
      subtotal,
      discount: 0,
      deliveryFee,
      vatRate,
      vatAmount,
      total,
      status,
      paymentStatus,
      paymentMethod: paymentMethods[i % 3],
      deliveryAddress: { building: `Building ${i}`, street: `Street ${i}`, area: 'Downtown', emirate: customer.emirate },
      statusHistory: [{ status, changedAt: orderDate.toISOString(), changedBy: 'system' }],
      createdAt: orderDate.toISOString(),
      updatedAt: orderDate.toISOString(),
    };
    orders.set(order.id, order);

    // Create payment for the order
    payments.set(`pay_${i}`, {
      id: `pay_${i}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: total,
      currency: 'AED',
      method: order.paymentMethod,
      status: paymentStatus,
      customerName: order.customerName,
      gatewayTransactionId: `txn_${Date.now()}_${i}`,
      cardBrand: order.paymentMethod === 'card' ? 'Visa' : undefined,
      cardLast4: order.paymentMethod === 'card' ? '4242' : undefined,
      refundedAmount: 0,
      refunds: [],
      createdAt: orderDate.toISOString(),
      updatedAt: orderDate.toISOString(),
    });
  }

  // Demo stock items (quantities in grams)
  demoProducts.forEach((product, i) => {
    const qty = 5000.000 + i * 1000.500; // Base 5kg + increments
    const reserved = (i * 200.250);
    stockItems.set(product.id, {
      id: `stock_${product.id}`,
      productId: product.id,
      quantity: qty,
      reservedQuantity: reserved,
      availableQuantity: qty - reserved,
      lowStockThreshold: 1000.000, // 1kg threshold
      reorderPoint: 2000.000, // 2kg reorder point
      reorderQuantity: 5000.000, // 5kg reorder quantity
      lastRestockedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // Add a low stock item for demo (quantities in grams)
  stockItems.set('prod_low', {
    id: 'stock_prod_low',
    productId: 'prod_low',
    quantity: 500.500, // 500g
    reservedQuantity: 200.250,
    availableQuantity: 300.250, // Below 1kg threshold
    lowStockThreshold: 1000.000, // 1kg
    reorderPoint: 2000.000, // 2kg
    reorderQuantity: 5000.000, // 5kg
    lastRestockedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Demo stock movements (quantities in grams)
  for (let i = 1; i <= 10; i++) {
    stockMovements.push({
      id: `mov_${i}`,
      productId: demoProducts[i % 6].id,
      type: i % 3 === 0 ? 'out' : 'in',
      quantity: 500.000 + (i * 100.500), // grams
      reason: i % 3 === 0 ? 'Customer order' : 'Restocked',
      createdAt: new Date(Date.now() - i * 6 * 60 * 60 * 1000).toISOString(),
    });
  }

  console.log('[Vercel] Database seeded with', users.size, 'users,', orders.size, 'orders');
}

// Generate token
const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

// Sanitize user (remove password)
function sanitizeUser(user: User): Omit<User, 'password'> {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// =====================================================
// EXPRESS APP
// =====================================================

let app: express.Express | null = null;

function createApp() {
  if (app) return app;
  
  seedData();
  
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Ping endpoint
  app.get('/api/ping', (req, res) => {
    res.json({ message: 'pong', timestamp: new Date().toISOString() });
  });

  // Health check endpoint with DB status
  app.get('/api/health', async (req, res) => {
    const dbConnected = isDatabaseAvailable();
    let dbTest = false;
    
    if (dbConnected && pgDb) {
      try {
        // Test query
        await pgDb.select().from(usersTable).limit(1);
        dbTest = true;
      } catch (e) {
        console.error('[Health Check DB Error]', e);
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
          url: databaseUrl ? `${databaseUrl.substring(0, 30)}...` : 'not set',
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
              ilike(usersTable.username, username),
              ilike(usersTable.email, username)
            )
          ).limit(1);
          
          if (dbUsers.length > 0) {
            const dbUser = dbUsers[0];
            user = {
              id: dbUser.id,
              username: dbUser.username,
              email: dbUser.email,
              mobile: dbUser.mobile,
              password: dbUser.password,
              firstName: dbUser.firstName,
              familyName: dbUser.familyName,
              role: dbUser.role as User['role'],
              isActive: dbUser.isActive,
              isVerified: dbUser.isVerified,
              emirate: dbUser.emirate || '',
              address: dbUser.address || undefined,
              createdAt: dbUser.createdAt.toISOString(),
              updatedAt: dbUser.updatedAt.toISOString(),
              lastLoginAt: dbUser.lastLoginAt?.toISOString(),
              preferences: dbUser.preferences || {
                language: 'en',
                currency: 'AED',
                emailNotifications: true,
                smsNotifications: true,
                marketingEmails: true,
              },
            };
          }
        } catch (dbError) {
          console.error('[Login DB Error]', dbError);
          return res.status(500).json({ success: false, error: 'Database error during login' });
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
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      sessions.set(token, { userId: user.id, expiresAt });
      
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
          expiresAt,
        },
        message: 'Login successful',
      });
    } catch (error) {
      console.error('[Login Error]', error);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  });

  // Admin login
  app.post('/api/users/admin-login', async (req, res) => {
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
            ilike(usersTable.username, username)
          ).limit(1);
          
          if (dbUsers.length > 0 && dbUsers[0].role === 'admin') {
            const dbUser = dbUsers[0];
            user = {
              id: dbUser.id,
              username: dbUser.username,
              email: dbUser.email,
              mobile: dbUser.mobile,
              password: dbUser.password,
              firstName: dbUser.firstName,
              familyName: dbUser.familyName,
              role: dbUser.role as User['role'],
              isActive: dbUser.isActive,
              isVerified: dbUser.isVerified,
              emirate: dbUser.emirate || '',
              createdAt: dbUser.createdAt.toISOString(),
              updatedAt: dbUser.updatedAt.toISOString(),
              preferences: dbUser.preferences || {
                language: 'en',
                currency: 'AED',
                emailNotifications: true,
                smsNotifications: true,
                marketingEmails: false,
              },
            };
          }
        } catch (dbError) {
          console.error('[Admin Login DB Error]', dbError);
          return res.status(500).json({ success: false, error: 'Database error during login' });
        }
      } else {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      if (!user || user.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      sessions.set(token, { userId: user.id, expiresAt });
      
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
          expiresAt,
        },
        message: 'Admin login successful',
      });
    } catch (error) {
      console.error('[Admin Login Error]', error);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  });

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
            .where(ilike(usersTable.username, username)).limit(1);
          if (existingUsername.length > 0) {
            return res.status(400).json({ success: false, error: 'Username already taken' });
          }

          // Check for existing email
          const existingEmail = await pgDb.select().from(usersTable)
            .where(ilike(usersTable.email, email)).limit(1);
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

          const newUser: User = {
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

          // Also add to in-memory for session lookup
          users.set(userId, newUser);

          return res.status(201).json({
            success: true,
            data: sanitizeUser(newUser),
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

      const newUser: User = {
        id: userId,
        username,
        email,
        mobile,
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

      users.set(userId, newUser);

      // Create default delivery address if provided
      if (deliveryAddress) {
        const addressId = `addr_${Date.now()}`;
        const newAddress: Address = {
          id: addressId,
          userId: userId,
          label: deliveryAddress.label || 'Home',
          fullName: deliveryAddress.fullName || `${firstName} ${familyName}`,
          mobile: deliveryAddress.mobile || mobile,
          emirate: deliveryAddress.emirate || emirate,
          area: deliveryAddress.area || '',
          street: deliveryAddress.street || '',
          building: deliveryAddress.building || '',
          floor: deliveryAddress.floor,
          apartment: deliveryAddress.apartment,
          latitude: deliveryAddress.latitude,
          longitude: deliveryAddress.longitude,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addresses.set(addressId, newAddress);
      }

      res.status(201).json({
        success: true,
        data: sanitizeUser(newUser),
        message: 'User registered successfully',
      });
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
      let result = await pgDb.select().from(productsTable);
      
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
      
      // Convert to API format (without discount, rating, badges which don't exist in DB)
      const products = result.map(p => ({
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        sku: p.sku,
        price: parseFloat(p.price),
        costPrice: parseFloat(p.costPrice),
        discount: 0, // Column doesn't exist in DB
        category: p.category,
        description: p.description,
        descriptionAr: p.descriptionAr,
        image: p.image,
        unit: p.unit,
        minOrderQuantity: parseFloat(p.minOrderQuantity),
        maxOrderQuantity: parseFloat(p.maxOrderQuantity),
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        rating: 0, // Column doesn't exist in DB
        tags: p.tags || [],
        badges: [], // Column doesn't exist in DB
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));
      
      res.json({ success: true, data: products });
    } catch (error) {
      console.error('[Products Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch products' });
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
        discount: 0, // Column doesn't exist in DB
        category: p.category,
        description: p.description,
        descriptionAr: p.descriptionAr,
        image: p.image,
        unit: p.unit,
        minOrderQuantity: parseFloat(p.minOrderQuantity),
        maxOrderQuantity: parseFloat(p.maxOrderQuantity),
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        rating: 0, // Column doesn't exist in DB
        tags: p.tags || [],
        badges: [], // Column doesn't exist in DB
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
        // discount, rating, badges columns don't exist in DB
        category: req.body.category,
        description: req.body.description || null,
        descriptionAr: req.body.descriptionAr || null,
        image: req.body.image || '/photos/placeholder.svg',
        unit: req.body.unit || 'kg',
        minOrderQuantity: String(req.body.minOrderQuantity || 0.25),
        maxOrderQuantity: String(req.body.maxOrderQuantity || 10),
        isActive: req.body.isActive !== false,
        isFeatured: req.body.isFeatured || false,
        tags: req.body.tags || [],
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
          discount: 0, // Column doesn't exist in DB
          minOrderQuantity: parseFloat(newProduct.minOrderQuantity),
          maxOrderQuantity: parseFloat(newProduct.maxOrderQuantity),
          rating: 0, // Column doesn't exist in DB
          badges: [], // Column doesn't exist in DB
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
      // discount, rating, badges columns don't exist in DB
      if (req.body.category !== undefined) updateData.category = req.body.category;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.descriptionAr !== undefined) updateData.descriptionAr = req.body.descriptionAr;
      if (req.body.image !== undefined) updateData.image = req.body.image;
      if (req.body.unit !== undefined) updateData.unit = req.body.unit;
      if (req.body.minOrderQuantity !== undefined) updateData.minOrderQuantity = String(req.body.minOrderQuantity);
      if (req.body.maxOrderQuantity !== undefined) updateData.maxOrderQuantity = String(req.body.maxOrderQuantity);
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      if (req.body.isFeatured !== undefined) updateData.isFeatured = req.body.isFeatured;
      if (req.body.tags !== undefined) updateData.tags = req.body.tags;
      
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
          discount: 0, // Column doesn't exist in DB
          category: p.category,
          description: p.description,
          descriptionAr: p.descriptionAr,
          image: p.image,
          unit: p.unit,
          minOrderQuantity: parseFloat(p.minOrderQuantity),
          maxOrderQuantity: parseFloat(p.maxOrderQuantity),
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          rating: 0, // Column doesn't exist in DB
          tags: p.tags || [],
          badges: [], // Column doesn't exist in DB
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
        .filter(s => parseFloat(s.availableQuantity) <= parseFloat(s.lowStockThreshold))
        .map(s => ({
          productId: s.productId,
          productName: productMap.get(s.productId)?.name || s.productId,
          currentQuantity: parseFloat(s.availableQuantity),
          threshold: parseFloat(s.lowStockThreshold),
          suggestedReorderQuantity: parseFloat(s.reorderQuantity),
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

  // Hourly orders chart
  app.get('/api/analytics/charts/hourly-orders', (req, res) => {
    const data = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: Math.floor(Math.random() * 10) + (hour >= 10 && hour <= 20 ? 5 : 1),
      revenue: (Math.floor(Math.random() * 10) + (hour >= 10 && hour <= 20 ? 5 : 1)) * 150,
    }));
    
    res.json({ success: true, data });
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
      
      let allOrders = await pgDb.select().from(ordersTable);
      
      // Filter by status if provided
      const status = req.query.status as string;
      if (status && status !== 'all') {
        allOrders = allOrders.filter(o => o.status === status);
      }

      // Sort by date (newest first)
      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Get order items for each order
      const orderItems = await pgDb.select().from(orderItemsTable);
      const orderItemsMap = new Map<string, typeof orderItems>();
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
      
      const result = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      const o = result[0];
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
      
      const { userId, items, addressId: providedAddressId, deliveryAddress: providedAddress, paymentMethod, deliveryNotes, discountCode } = req.body;

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
      
      // Get products from database to calculate prices
      const products = await pgDb.select().from(productsTable);
      const productMap = new Map(products.map(p => [p.id, p]));

      // Calculate order items with prices
      const orderItemsData: Array<{
        id: string;
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }> = [];
      let subtotal = 0;

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          return res.status(404).json({ success: false, error: `Product ${item.productId} not found` });
        }

        const price = parseFloat(product.price);
        const totalPrice = price * item.quantity;
        orderItemsData.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: price,
          totalPrice,
        });
        subtotal += totalPrice;
      }

      // Calculate totals
      const discount = 0;
      const deliveryFee = subtotal > 200 ? 0 : 15;
      const vatRate = 0.05;
      const vatAmount = (subtotal - discount) * vatRate;
      const total = subtotal - discount + deliveryFee + vatAmount;

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
        deliveryFee: String(deliveryFee),
        vatRate: String(vatRate),
        vatAmount: String(vatAmount),
        total: String(total),
        status: 'pending' as const,
        paymentStatus: (paymentMethod === 'cod' ? 'pending' : 'captured') as const,
        paymentMethod: paymentMethod as 'cod' | 'card' | 'bank_transfer',
        addressId,
        deliveryAddress: {
          building: address.building || '',
          street: address.street || '',
          area: address.area || '',
          emirate: address.emirate || '',
          landmark: address.landmark || null,
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
          sku: prod?.sku || `SKU-${item.productId}`,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          totalPrice: String(item.totalPrice),
        });
      }

      // Create payment record
      const paymentId = `pay_${Date.now()}`;
      await pgDb.insert(paymentsTable).values({
        id: paymentId,
        orderId,
        orderNumber,
        amount: String(total),
        currency: 'AED',
        method: paymentMethod as 'cod' | 'card' | 'bank_transfer',
        status: (paymentMethod === 'cod' ? 'pending' : 'captured') as const,
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
        items: orderItemsData,
        subtotal,
        discount,
        deliveryFee,
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
      
      const result = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      const { status } = req.body;
      const now = new Date();
      const order = result[0];
      
      const newHistory = [...(order.statusHistory || []), {
        status,
        changedAt: now.toISOString(),
        changedBy: 'admin',
      }];
      
      await pgDb.update(ordersTable)
        .set({ 
          status, 
          statusHistory: newHistory,
          updatedAt: now 
        })
        .where(eq(ordersTable.id, req.params.id));
      
      // Fetch updated order
      const updated = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      console.error('[Update Order Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
  });

  // Get order by order number - DATABASE BACKED
  app.get('/api/orders/number/:orderNumber', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      
      const result = await pgDb.select().from(ordersTable).where(eq(ordersTable.orderNumber, req.params.orderNumber));
      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      const o = result[0];
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

      const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, req.params.id));
      if (orderResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      const order = orderResult[0];
      if (['delivered', 'cancelled'].includes(order.status)) {
        return res.status(400).json({ success: false, error: 'Cannot delete delivered or already cancelled orders' });
      }
      
      const newHistory = [...(order.statusHistory as any[] || []), {
        status: 'cancelled',
        changedAt: new Date().toISOString(),
        changedBy: 'admin',
      }];
      
      const [updated] = await pgDb.update(ordersTable)
        .set({ status: 'cancelled', statusHistory: newHistory, updatedAt: new Date() })
        .where(eq(ordersTable.id, req.params.id))
        .returning();
      
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
        lowStockThreshold: parseFloat(s.lowStockThreshold),
        reorderPoint: parseFloat(s.reorderPoint),
        reorderQuantity: parseFloat(s.reorderQuantity),
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
        lowStockThreshold: parseFloat(s.lowStockThreshold),
        reorderPoint: parseFloat(s.reorderPoint),
        reorderQuantity: parseFloat(s.reorderQuantity),
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
        .filter(s => parseFloat(s.availableQuantity) <= parseFloat(s.lowStockThreshold))
        .map(s => ({
          productId: s.productId,
          productName: productMap.get(s.productId)?.name || s.productId,
          currentQuantity: parseFloat(s.availableQuantity),
          threshold: parseFloat(s.lowStockThreshold),
          suggestedReorderQuantity: parseFloat(s.reorderQuantity),
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
          lowStockThreshold: parseFloat(s.lowStockThreshold),
          reorderPoint: parseFloat(s.reorderPoint),
          reorderQuantity: parseFloat(s.reorderQuantity),
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
      
      if (lowStockThreshold !== undefined) updateData.lowStockThreshold = String(lowStockThreshold);
      if (reorderPoint !== undefined) updateData.reorderPoint = String(reorderPoint);
      if (reorderQuantity !== undefined) updateData.reorderQuantity = String(reorderQuantity);
      
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
          lowStockThreshold: parseFloat(s.lowStockThreshold),
          reorderPoint: parseFloat(s.reorderPoint),
          reorderQuantity: parseFloat(s.reorderQuantity),
          updatedAt: s.updatedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error('[Update Thresholds Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update thresholds' });
    }
  });

  // =====================================================
  // SUPPLIERS API (serverless mock)
  // =====================================================

  type SupplierStatus = 'active' | 'inactive' | 'pending' | 'suspended';
  type PaymentTerms = 'net_7' | 'net_15' | 'net_30' | 'net_60' | 'cod' | 'prepaid';

  interface SupplierContact {
    id: string;
    name: string;
    position: string;
    email: string;
    phone: string;
    isPrimary: boolean;
  }

  interface Supplier {
    id: string;
    code: string;
    name: string;
    nameAr?: string;
    email: string;
    phone: string;
    website?: string;
    taxNumber?: string;
    address: { street: string; city: string; state: string; country: string; postalCode: string };
    contacts: SupplierContact[];
    paymentTerms: PaymentTerms;
    currency: 'AED' | 'USD' | 'EUR';
    creditLimit: number;
    currentBalance: number;
    categories: string[];
    rating: number;
    onTimeDeliveryRate: number;
    qualityScore: number;
    totalOrders: number;
    totalSpent: number;
    status: SupplierStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    lastOrderAt?: string;
  }

  interface SupplierProduct {
    id: string;
    supplierId: string;
    productId: string;
    productName: string;
    supplierSku: string;
    unitCost: number;
    minimumOrderQuantity: number;
    leadTimeDays: number;
    isPreferred: boolean;
    lastPurchasePrice: number;
    lastPurchaseDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  }

  interface PurchaseOrderItem {
    id: string;
    productId: string;
    productName: string;
    supplierSku?: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    receivedQuantity: number;
    notes?: string;
  }

  type PurchaseOrderStatus = 'draft' | 'pending' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

  interface PurchaseOrder {
    id: string;
    orderNumber: string;
    supplierId: string;
    supplierName: string;
    items: PurchaseOrderItem[];
    subtotal: number;
    taxAmount: number;
    taxRate: number;
    shippingCost: number;
    discount: number;
    total: number;
    status: PurchaseOrderStatus;
    paymentStatus: 'pending' | 'partial' | 'paid';
    orderDate: string;
    expectedDeliveryDate: string;
    actualDeliveryDate?: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    trackingNumber?: string;
    createdBy: string;
    approvedBy?: string;
    approvedAt?: string;
    internalNotes?: string;
    supplierNotes?: string;
    statusHistory: { status: PurchaseOrderStatus; changedBy: string; changedAt: string; notes?: string }[];
    createdAt: string;
    updatedAt: string;
  }

  const supplierList: Supplier[] = [
    {
      id: 'sup-001',
      code: 'SUP-001',
      name: 'Premium Meat Suppliers LLC',
      email: 'orders@premiummeat.ae',
      phone: '+971501234567',
      website: 'https://premiummeat.ae',
      taxNumber: '100123456700001',
      address: { street: 'Industrial Area 5, Warehouse 23', city: 'Dubai', state: 'Dubai', country: 'UAE', postalCode: '00000' },
      contacts: [
        { id: 'contact-001', name: 'Ahmed Al Maktoum', position: 'Sales Manager', email: 'ahmed@premiummeat.ae', phone: '+971501234567', isPrimary: true },
      ],
      paymentTerms: 'net_30',
      currency: 'AED',
      creditLimit: 100000,
      currentBalance: 25000,
      categories: ['beef', 'lamb'],
      rating: 4.5,
      onTimeDeliveryRate: 95,
      qualityScore: 98,
      totalOrders: 156,
      totalSpent: 450000,
      status: 'active',
      notes: 'Premium supplier with excellent quality beef and lamb products.',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: new Date().toISOString(),
      lastOrderAt: '2026-01-05T14:30:00Z',
    },
  ];

  const supplierProducts: SupplierProduct[] = [
    {
      id: 'sp-001',
      supplierId: 'sup-001',
      productId: 'beef-ribeye',
      productName: 'Premium Ribeye Steak',
      supplierSku: 'PMS-RIB-001',
      unitCost: 85,
      minimumOrderQuantity: 5000,
      leadTimeDays: 2,
      isPreferred: true,
      lastPurchasePrice: 85,
      lastPurchaseDate: '2026-01-05T14:30:00Z',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2026-01-05T14:30:00Z',
    },
  ];

  const supplierPOs: PurchaseOrder[] = [];

  const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const genCode = (prefix: string, items: { code: string }[]) => {
    const last = items.map(i => i.code).sort().pop();
    const lastNum = last ? parseInt(last.split('-')[1]) : 0;
    return `${prefix}-${String(lastNum + 1).padStart(3, '0')}`;
  };
  const genPoNumber = () => {
    const year = new Date().getFullYear();
    const yearOrders = supplierPOs.filter(o => o.orderNumber.startsWith(`PO-${year}`));
    const lastNum = yearOrders.length ? Math.max(...yearOrders.map(o => parseInt(o.orderNumber.split('-')[2]))) : 0;
    return `PO-${year}-${String(lastNum + 1).padStart(4, '0')}`;
  };

  // List suppliers
  app.get('/api/suppliers', (req, res) => {
    const { status, category, search } = req.query;
    let data = [...supplierList];
    if (status && status !== 'all') data = data.filter(s => s.status === status);
    if (category && category !== 'all') data = data.filter(s => s.categories.includes(category as string));
    if (search) {
      const q = (search as string).toLowerCase();
      data = data.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q)
      );
    }
    data.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, data });
  });

  // Supplier stats
  app.get('/api/suppliers/stats', (_req, res) => {
    const stats = {
      totalSuppliers: supplierList.length,
      activeSuppliers: supplierList.filter(s => s.status === 'active').length,
      pendingSuppliers: supplierList.filter(s => s.status === 'pending').length,
      totalPurchaseOrders: supplierPOs.length,
      pendingOrders: supplierPOs.filter(po => ['pending', 'ordered'].includes(po.status)).length,
      totalSpent: supplierList.reduce((sum, s) => sum + s.totalSpent, 0),
      averageLeadTime: supplierProducts.length ? supplierProducts.reduce((sum, sp) => sum + sp.leadTimeDays, 0) / supplierProducts.length : 0,
      topCategories: Array.from(new Set(supplierList.flatMap(s => s.categories))).map(cat => ({ category: cat, count: supplierList.filter(s => s.categories.includes(cat)).length })),
    };
    res.json({ success: true, data: stats });
  });

  // Create supplier
  app.post('/api/suppliers', (req, res) => {
    const body = req.body as Partial<Supplier>;
    if (!body.name || !body.email || !body.phone) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const newSupplier: Supplier = {
      id: genId(),
      code: genCode('SUP', supplierList),
      name: body.name,
      nameAr: body.nameAr,
      email: body.email,
      phone: body.phone,
      website: body.website,
      taxNumber: body.taxNumber,
      address: body.address || { street: '', city: '', state: '', country: 'UAE', postalCode: '' },
      contacts: (body.contacts || []).map(c => ({ ...c, id: genId() } as SupplierContact)),
      paymentTerms: (body.paymentTerms as PaymentTerms) || 'net_30',
      currency: (body.currency as Supplier['currency']) || 'AED',
      creditLimit: body.creditLimit ?? 0,
      currentBalance: 0,
      categories: body.categories || ['general'],
      rating: 0,
      onTimeDeliveryRate: 0,
      qualityScore: 0,
      totalOrders: 0,
      totalSpent: 0,
      status: 'pending',
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    supplierList.push(newSupplier);
    res.status(201).json({ success: true, data: newSupplier });
  });

  // Update supplier status
  app.patch('/api/suppliers/:id/status', (req, res) => {
    const sup = supplierList.find(s => s.id === req.params.id);
    if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });
    sup.status = req.body.status as SupplierStatus;
    sup.updatedAt = new Date().toISOString();
    res.json({ success: true, data: sup });
  });

  // Delete supplier
  app.delete('/api/suppliers/:id', (req, res) => {
    const idx = supplierList.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const hasPending = supplierPOs.some(po => po.supplierId === req.params.id && !['received', 'cancelled'].includes(po.status));
    if (hasPending) return res.status(400).json({ success: false, error: 'Cannot delete supplier with pending purchase orders' });
    supplierList.splice(idx, 1);
    res.json({ success: true, data: null });
  });

  // Contacts
  app.post('/api/suppliers/:id/contacts', (req, res) => {
    const sup = supplierList.find(s => s.id === req.params.id);
    if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const contact: SupplierContact = { id: genId(), ...req.body };
    sup.contacts.push(contact);
    sup.updatedAt = new Date().toISOString();
    res.status(201).json({ success: true, data: contact });
  });

  app.delete('/api/suppliers/:id/contacts/:contactId', (req, res) => {
    const sup = supplierList.find(s => s.id === req.params.id);
    if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const idx = sup.contacts.findIndex(c => c.id === req.params.contactId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Contact not found' });
    sup.contacts.splice(idx, 1);
    sup.updatedAt = new Date().toISOString();
    res.json({ success: true, data: null });
  });

  // Supplier products
  app.get('/api/suppliers/:id/products', (req, res) => {
    const products = supplierProducts.filter(p => p.supplierId === req.params.id);
    res.json({ success: true, data: products });
  });

  app.post('/api/suppliers/:id/products', (req, res) => {
    const sup = supplierList.find(s => s.id === req.params.id);
    if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const body = req.body as Partial<SupplierProduct>;
    const product: SupplierProduct = {
      id: genId(),
      supplierId: sup.id,
      productId: body.productId || genId(),
      productName: body.productName || 'New Product',
      supplierSku: body.supplierSku || '',
      unitCost: body.unitCost || 0,
      minimumOrderQuantity: body.minimumOrderQuantity || 1000,
      leadTimeDays: body.leadTimeDays || 3,
      isPreferred: !!body.isPreferred,
      lastPurchasePrice: body.unitCost || 0,
      lastPurchaseDate: new Date().toISOString(),
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    supplierProducts.push(product);
    res.status(201).json({ success: true, data: product });
  });

  app.delete('/api/suppliers/products/:productId', (req, res) => {
    const idx = supplierProducts.findIndex(p => p.id === req.params.productId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Supplier product not found' });
    supplierProducts.splice(idx, 1);
    res.json({ success: true, data: null });
  });

  // Purchase orders
  app.get('/api/suppliers/purchase-orders/list', (req, res) => {
    const { status, supplierId } = req.query;
    let data = [...supplierPOs];
    if (status && status !== 'all') data = data.filter(po => po.status === status);
    if (supplierId) data = data.filter(po => po.supplierId === supplierId);
    data.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    res.json({ success: true, data });
  });

  app.post('/api/suppliers/purchase-orders', (req, res) => {
    const body = req.body as { supplierId: string; items: { productId: string; quantity: number; unitCost: number; notes?: string }[]; expectedDeliveryDate: string; deliveryAddress: string; deliveryNotes?: string; shippingCost?: number; discount?: number; };
    const sup = supplierList.find(s => s.id === body.supplierId);
    if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const items: PurchaseOrderItem[] = body.items.map(it => {
      const sp = supplierProducts.find(p => p.productId === it.productId && p.supplierId === body.supplierId);
      return {
        id: genId(),
        productId: it.productId,
        productName: sp?.productName || it.productId,
        supplierSku: sp?.supplierSku,
        quantity: it.quantity,
        unitCost: it.unitCost,
        totalCost: (it.quantity / 1000) * it.unitCost,
        receivedQuantity: 0,
        notes: it.notes,
      };
    });
    const subtotal = items.reduce((sum, i) => sum + i.totalCost, 0);
    const taxRate = 5;
    const taxAmount = subtotal * (taxRate / 100);
    const shippingCost = body.shippingCost || 0;
    const discount = body.discount || 0;
    const total = subtotal + taxAmount + shippingCost - discount;
    const po: PurchaseOrder = {
      id: genId(),
      orderNumber: genPoNumber(),
      supplierId: sup.id,
      supplierName: sup.name,
      items,
      subtotal,
      taxAmount,
      taxRate,
      shippingCost,
      discount,
      total,
      status: 'draft',
      paymentStatus: 'pending',
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: body.expectedDeliveryDate,
      deliveryAddress: body.deliveryAddress,
      deliveryNotes: body.deliveryNotes,
      createdBy: 'admin',
      statusHistory: [{ status: 'draft', changedBy: 'admin', changedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    supplierPOs.push(po);
    res.status(201).json({ success: true, data: po });
  });

  app.patch('/api/suppliers/purchase-orders/:id/status', (req, res) => {
    const po = supplierPOs.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    const { status, notes } = req.body as { status: PurchaseOrderStatus; notes?: string };
    po.status = status;
    po.statusHistory.push({ status, changedBy: 'admin', changedAt: new Date().toISOString(), notes });
    if (status === 'received') po.actualDeliveryDate = new Date().toISOString();
    po.updatedAt = new Date().toISOString();
    res.json({ success: true, data: po });
  });

  app.put('/api/suppliers/purchase-orders/:id/receive', (req, res) => {
    const po = supplierPOs.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    const { items } = req.body as { items: { itemId: string; receivedQuantity: number }[] };
    po.items = po.items.map(it => {
      const recv = items.find(i => i.itemId === it.id);
      return recv ? { ...it, receivedQuantity: it.receivedQuantity + recv.receivedQuantity } : it;
    });
    const allReceived = po.items.every(i => i.receivedQuantity >= i.quantity);
    const anyReceived = po.items.some(i => i.receivedQuantity > 0);
    po.status = allReceived ? 'received' : anyReceived ? 'partially_received' : po.status;
    if (po.status === 'received') po.actualDeliveryDate = new Date().toISOString();
    po.statusHistory.push({ status: po.status, changedBy: 'admin', changedAt: new Date().toISOString() });
    po.updatedAt = new Date().toISOString();
    res.json({ success: true, data: po });
  });

  // Get purchase order by ID
  app.get('/api/suppliers/purchase-orders/:id', (req, res) => {
    const po = supplierPOs.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    res.json({ success: true, data: po });
  });

  app.delete('/api/suppliers/purchase-orders/:id', (req, res) => {
    const po = supplierPOs.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    if (['received', 'partially_received'].includes(po.status)) {
      return res.status(400).json({ success: false, error: 'Cannot delete received or partially received orders' });
    }
    po.status = 'cancelled';
    po.statusHistory.push({ status: 'cancelled', changedBy: 'admin', changedAt: new Date().toISOString() });
    po.updatedAt = new Date().toISOString();
    res.json({ success: true, data: po });
  });

  // Get supplier by ID
  app.get('/api/suppliers/:id', (req, res) => {
    const supplier = supplierList.find(s => s.id === req.params.id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: supplier });
  });

  // Update supplier
  app.put('/api/suppliers/:id', (req, res) => {
    const supplier = supplierList.find(s => s.id === req.params.id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    
    Object.assign(supplier, req.body, { updatedAt: new Date().toISOString() });
    res.json({ success: true, data: supplier });
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
      
      const [updated] = await pgDb.update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, req.params.id))
        .returning();
      
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
      
      const [updated] = await pgDb.update(usersTable)
        .set({ isVerified: true, updatedAt: new Date() })
        .where(eq(usersTable.id, req.params.id))
        .returning();
      
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

  // Store delivery zones in memory
  // Finance expenses placeholder (no DB table yet)
  const financeExpenses: { id: string; category: string; description: string; amount: number; status: string; date?: string }[] = [];

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

      const [zone] = await pgDb.insert(deliveryZonesTable).values({
        id: `zone_${Date.now()}`,
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
      }).returning();

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

      const [updated] = await pgDb.update(deliveryZonesTable)
        .set(updateData)
        .where(eq(deliveryZonesTable.id, req.params.id))
        .returning();

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

  app.get('/api/delivery/addresses', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: true, data: [] });
    }
    const session = sessions.get(token);
    if (!session) {
      return res.json({ success: true, data: [] });
    }
    const userAddresses = Array.from(addresses.values()).filter(a => a.userId === session.userId);
    res.json({ success: true, data: userAddresses });
  });

  app.post('/api/delivery/addresses', (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      let userId = 'guest';
      if (token) {
        const session = sessions.get(token);
        if (session) userId = session.userId;
      }

      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, isDefault } = req.body;
      
      if (!fullName || !mobile || !emirate || !area || !street || !building) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const addressId = `addr_${Date.now()}`;
      const newAddress: Address = {
        id: addressId,
        userId,
        label: label || 'Home',
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
        isDefault: isDefault || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // If this is default, unset other defaults for this user
      if (newAddress.isDefault) {
        addresses.forEach(addr => {
          if (addr.userId === userId) addr.isDefault = false;
        });
      }

      addresses.set(addressId, newAddress);
      res.status(201).json({ success: true, data: newAddress });
    } catch (error) {
      console.error('[Create Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create address' });
    }
  });

  app.put('/api/delivery/addresses/:id', (req, res) => {
    const address = addresses.get(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }
    
    const updates = req.body;
    Object.assign(address, updates, { updatedAt: new Date().toISOString() });
    
    // If setting as default, unset others
    if (updates.isDefault) {
      addresses.forEach(addr => {
        if (addr.id !== address.id && addr.userId === address.userId) {
          addr.isDefault = false;
        }
      });
    }
    
    res.json({ success: true, data: address });
  });

  app.delete('/api/delivery/addresses/:id', (req, res) => {
    const address = addresses.get(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }
    addresses.delete(req.params.id);
    res.json({ success: true, message: 'Address deleted' });
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

  // Get tracking by order ID
  app.get('/api/delivery/tracking/by-order/:orderId', (req, res) => {
    const { orderId } = req.params;
    
    // First check the in-memory tracking map
    let tracking = deliveryTracking.get(orderId);
    
    // If not found in map, try to get from order's trackingInfo
    if (!tracking) {
      const order = orders.get(orderId);
      if (order?.trackingInfo) {
        // Reconstruct full tracking response from order
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
        // Cache it in the map for faster future access
        deliveryTracking.set(orderId, tracking);
      }
    }
    
    if (!tracking) {
      // Return null data if no tracking exists yet (order not assigned)
      return res.json({ success: true, data: null });
    }
    
    res.json({ success: true, data: tracking });
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
        const newHistory = [...(order.statusHistory as any[] || []), {
          status: 'out_for_delivery',
          changedAt: now.toISOString(),
          changedBy: driverId,
        }];

        // Update order status in database
        await pgDb.update(ordersTable)
          .set({
            status: 'out_for_delivery',
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

      // Update order status
      order.status = 'out_for_delivery';
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({
        status: 'out_for_delivery',
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
        await pgDb.update(deliveryTrackingTable)
          .set({
            status: status as any,
            updatedAt: now,
            actualArrival: status === 'delivered' ? now : undefined,
          })
          .where(eq(deliveryTrackingTable.orderId, orderId));

        // Map tracking status to order status
        const orderStatusMap: Record<string, string> = {
          'assigned': 'out_for_delivery',
          'picked_up': 'out_for_delivery',
          'in_transit': 'out_for_delivery',
          'nearby': 'out_for_delivery',
          'delivered': 'delivered',
        };
        const newOrderStatus = orderStatusMap[status] || 'out_for_delivery';

        // Get and update order in database
        const orderResult = await pgDb.select().from(ordersTable).where(eq(ordersTable.id, orderId));
        if (orderResult.length > 0) {
          const order = orderResult[0];
          const newHistory = [...(order.statusHistory as any[] || []), {
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
  // PAYMENTS API
  // =====================================================

  app.get('/api/payments', (req, res) => {
    let allPayments = Array.from(payments.values());
    
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
    
    res.json({ success: true, data: allPayments });
  });

  app.get('/api/payments/stats', (req, res) => {
    const allPayments = Array.from(payments.values());
    const totalRevenue = allPayments.filter(p => p.status === 'captured').reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = allPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      data: {
        totalPayments: allPayments.length,
        totalRevenue,
        pendingAmount,
        refundedAmount: 0,
        byMethod: [
          { method: 'card', count: allPayments.filter(p => p.method === 'card').length, amount: allPayments.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0) },
          { method: 'cod', count: allPayments.filter(p => p.method === 'cod').length, amount: allPayments.filter(p => p.method === 'cod').reduce((s, p) => s + p.amount, 0) },
          { method: 'bank_transfer', count: allPayments.filter(p => p.method === 'bank_transfer').length, amount: allPayments.filter(p => p.method === 'bank_transfer').reduce((s, p) => s + p.amount, 0) },
        ],
        byStatus: [
          { status: 'captured', count: allPayments.filter(p => p.status === 'captured').length, amount: totalRevenue },
          { status: 'pending', count: allPayments.filter(p => p.status === 'pending').length, amount: pendingAmount },
          { status: 'authorized', count: allPayments.filter(p => p.status === 'authorized').length, amount: allPayments.filter(p => p.status === 'authorized').reduce((s, p) => s + p.amount, 0) },
        ],
      },
    });
  });

  app.post('/api/payments/:id/refund', (req, res) => {
    const payment = payments.get(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    
    const { amount, reason } = req.body;
    payment.status = amount >= payment.amount ? 'refunded' : 'partially_refunded';
    payment.refundedAmount = (payment.refundedAmount || 0) + amount;
    payment.refunds.push({
      id: `refund_${Date.now()}`,
      amount,
      reason,
      createdAt: new Date().toISOString(),
    });
    payment.updatedAt = new Date().toISOString();
    
    res.json({ success: true, data: payment });
  });

  // Get payment by ID
  app.get('/api/payments/:id', (req, res) => {
    const payment = payments.get(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    res.json({ success: true, data: payment });
  });

  // Get payment by order ID
  app.get('/api/payments/order/:orderId', (req, res) => {
    const payment = Array.from(payments.values()).find(p => p.orderId === req.params.orderId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found for this order' });
    }
    res.json({ success: true, data: payment });
  });

  // Process payment
  app.post('/api/payments/process', (req, res) => {
    const { orderId, amount, method, currency = 'AED', saveCard } = req.body;
    
    if (!orderId || !amount || !method) {
      return res.status(400).json({ success: false, error: 'orderId, amount, and method are required' });
    }

    const order = orders.get(orderId);
    const paymentId = `pay_${Date.now()}`;
    const newPayment: Payment = {
      id: paymentId,
      orderId,
      orderNumber: order?.orderNumber || `ORD-${Date.now()}`,
      amount,
      currency,
      method,
      status: method === 'cod' ? 'pending' : 'authorized',
      customerName: order ? `${order.customerName}` : 'Guest',
      gatewayTransactionId: `gtxn_${Date.now()}`,
      refundedAmount: 0,
      refunds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    payments.set(paymentId, newPayment);

    // Update order payment status
    if (order) {
      order.paymentStatus = method === 'cod' ? 'pending' : 'authorized';
      order.updatedAt = new Date().toISOString();
    }

    res.status(201).json({ success: true, data: newPayment });
  });

  // Capture payment (finalize after authorization)
  app.post('/api/payments/:id/capture', (req, res) => {
    const payment = payments.get(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    
    if (payment.status !== 'authorized') {
      return res.status(400).json({ success: false, error: 'Payment must be authorized before capture' });
    }

    payment.status = 'captured';
    payment.updatedAt = new Date().toISOString();

    // Update order payment status
    const order = orders.get(payment.orderId);
    if (order) {
      order.paymentStatus = 'paid';
      order.updatedAt = new Date().toISOString();
    }

    res.json({ success: true, data: payment, message: 'Payment captured successfully' });
  });

  // Get all active delivery tracking
  app.get('/api/delivery/tracking', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allTracking = await pgDb.select().from(deliveryTrackingTable);
      res.json({ success: true, data: allTracking });
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
      res.json({ success: true, data: trackingResult[0] });
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
      const [updated] = await pgDb.update(deliveryTrackingTable)
        .set({ updatedAt: new Date() })
        .where(eq(deliveryTrackingTable.id, req.params.id))
        .returning();
      
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
      
      const [updated] = await pgDb.update(deliveryTrackingTable)
        .set({ status, timeline: newTimeline, updatedAt: new Date() })
        .where(eq(deliveryTrackingTable.id, req.params.id))
        .returning();
      
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
      const [updatedTracking] = await pgDb.update(deliveryTrackingTable)
        .set({ status: 'delivered', timeline: newTimeline, updatedAt: new Date() })
        .where(eq(deliveryTrackingTable.id, req.params.id))
        .returning();
      
      // Update order status
      const newHistory = [...(tracking.statusHistory as any[] || []), {
        status: 'delivered',
        changedAt: new Date().toISOString(),
        changedBy: tracking.driverId,
      }];
      
      await pgDb.update(ordersTable)
        .set({ status: 'delivered', statusHistory: newHistory, updatedAt: new Date() })
        .where(eq(ordersTable.id, tracking.orderId));
      
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
  app.post('/api/delivery/check-availability', (req, res) => {
    const { emirate, area } = req.body;
    
    const zone = deliveryZones.find(z => 
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
  });

  // Get address by ID
  app.get('/api/delivery/addresses/:id', (req, res) => {
    const address = addresses.get(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }
    res.json({ success: true, data: address });
  });

  // Set address as default
  app.post('/api/delivery/addresses/:id/set-default', (req, res) => {
    const address = addresses.get(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }
    
    // Unset other defaults for this user
    addresses.forEach(addr => {
      if (addr.userId === address.userId) {
        addr.isDefault = addr.id === address.id;
      }
    });
    
    res.json({ success: true, data: address, message: 'Default address updated' });
  });

  // =====================================================
  // USER ADDRESSES API (separate from delivery)
  // =====================================================

  // GET /api/addresses - Get all addresses for user
  app.get('/api/addresses', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User ID required' });
      }

      // Try database first if available
      if (isDatabaseAvailable() && pgDb) {
        try {
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
          return res.json({ success: true, data: formattedAddresses });
        } catch (dbError) {
          console.error('[Addresses GET DB Error]', dbError);
        }
      }

      // Fallback to in-memory
      const userAddresses = Array.from(addresses.values()).filter(a => a.userId === userId);
      res.json({ success: true, data: userAddresses });
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
      const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalOrders = allOrders.length;
      const totalVat = allOrders.reduce((sum, o) => sum + parseFloat(String(o.vat)), 0);
      const totalDiscount = allOrders.reduce((sum, o) => sum + parseFloat(String(o.discount || 0)), 0);
      
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

  // Logout
  app.post('/api/users/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) sessions.delete(token);
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Get current user
  app.get('/api/users/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: true, data: null }); // Return null instead of error for unauthenticated
    }

    const session = sessions.get(token);
    if (!session || new Date(session.expiresAt) < new Date()) {
      sessions.delete(token);
      return res.json({ success: true, data: null }); // Return null for expired session
    }

    const user = users.get(session.userId);
    if (!user) {
      return res.json({ success: true, data: null }); // Return null if user not found
    }

    res.json({ success: true, data: sanitizeUser(user) });
  });

  // =====================================================
  // SETTINGS API
  // =====================================================

  app.get('/api/settings', (req, res) => {
    res.json({
      success: true,
      data: {
        settings: {
          id: 'settings_1',
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
      },
    });
  });

  app.put('/api/settings', (req, res) => {
    res.json({ success: true, data: req.body, message: 'Settings updated successfully' });
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

  app.get('/api/notifications', (req, res) => {
    res.json({ success: true, data: [] });
  });

  app.post('/api/notifications', (req, res) => {
    const newNotification = { id: `notif_${Date.now()}`, ...req.body, isRead: false, createdAt: new Date().toISOString() };
    res.status(201).json({ success: true, data: newNotification });
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    res.json({ success: true, data: { id: req.params.id, isRead: true } });
  });

  app.patch('/api/notifications/read-all', (req, res) => {
    res.json({ success: true, message: 'All notifications marked as read' });
  });

  app.delete('/api/notifications/:id', (req, res) => {
    res.json({ success: true, message: 'Notification deleted' });
  });

  app.delete('/api/notifications', (req, res) => {
    res.json({ success: true, message: 'All notifications cleared' });
  });

  // =====================================================
  // FINANCE API
  // =====================================================

  // Finance accounts mock data
  const financeAccounts = [
    { id: 'acc-001', name: 'Main Business Account', nameAr: 'الحساب التجاري الرئيسي', type: 'bank', balance: 125000, currency: 'AED', isActive: true, bankName: 'Emirates NBD', accountNumber: '****4521' },
    { id: 'acc-002', name: 'Card Payments', nameAr: 'مدفوعات البطاقات', type: 'card_payments', balance: 45000, currency: 'AED', isActive: true },
    { id: 'acc-003', name: 'COD Collections', nameAr: 'تحصيلات الدفع عند الاستلام', type: 'cod_collections', balance: 8500, currency: 'AED', isActive: true },
    { id: 'acc-004', name: 'Petty Cash', nameAr: 'النثرية', type: 'petty_cash', balance: 2500, currency: 'AED', isActive: true },
  ];

  // Finance summary
  app.get('/api/finance/summary', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalVAT = allOrders.reduce((sum, o) => sum + parseFloat(String(o.vatAmount)), 0);
      const totalExpenses = 0; // TODO: Implement expenses table
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
          expensesByCategory: [],
          accountBalances: [],
        },
      });
    } catch (error) {
      console.error('[Finance Summary Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch finance summary' });
    }
  });

  // Finance transactions
  app.get('/api/finance/transactions', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const transactions = allOrders.slice(0, 10).map((o, i) => ({
        id: `txn-${i + 1}`,
        type: 'sale',
        status: 'completed',
        amount: parseFloat(String(o.total)),
        currency: 'AED',
        description: `Order #${o.orderNumber}`,
        reference: o.orderNumber,
        referenceType: 'order',
        referenceId: o.id,
        accountId: o.paymentMethod === 'card' ? 'acc-002' : 'acc-003',
        accountName: o.paymentMethod === 'card' ? 'Card Payments' : 'COD Collections',
        createdBy: 'system',
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.createdAt.toISOString(),
      }));
      res.json({ success: true, data: transactions });
    } catch (error) {
      console.error('[Finance Transactions Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
  });

  // Finance accounts
  app.get('/api/finance/accounts', (req, res) => {
    res.json({ success: true, data: [] }); // TODO: Implement finance accounts table
  });

  // Get finance account by ID
  app.get('/api/finance/accounts/:id', (req, res) => {
    return res.status(404).json({ success: false, error: 'Account not found' }); // TODO: Implement finance accounts table
    res.json({ success: true, data: account });
  });

  app.post('/api/finance/accounts', (req, res) => {
    const newAccount = { id: `acc-${Date.now()}`, ...req.body, balance: 0, createdAt: new Date().toISOString() };
    res.status(201).json({ success: true, data: newAccount });
  });

  // Update finance account
  app.put('/api/finance/accounts/:id', (req, res) => {
    const accountIndex = financeAccounts.findIndex(a => a.id === req.params.id);
    if (accountIndex === -1) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    
    Object.assign(financeAccounts[accountIndex], req.body, { updatedAt: new Date().toISOString() });
    res.json({ success: true, data: financeAccounts[accountIndex] });
  });

  app.post('/api/finance/accounts/transfer', (req, res) => {
    const { fromAccountId, toAccountId, amount } = req.body;
    res.json({ success: true, data: { fromAccountId, toAccountId, amount, transferredAt: new Date().toISOString() } });
  });

  app.post('/api/finance/accounts/:id/reconcile', (req, res) => {
    const account = financeAccounts.find(a => a.id === req.params.id);
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    res.json({ success: true, data: { ...account, lastReconciled: new Date().toISOString() } });
  });

  // Get transaction by ID
  app.get('/api/finance/transactions/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const transactions = allOrders.map((o, i) => ({
        id: `txn-${i + 1}`,
        type: 'sale',
        status: 'completed',
        amount: parseFloat(String(o.total)),
        currency: 'AED',
        description: `Order #${o.orderNumber}`,
        reference: o.orderNumber,
        referenceType: 'order',
        referenceId: o.id,
        accountId: o.paymentMethod === 'card' ? 'acc-002' : 'acc-003',
        accountName: o.paymentMethod === 'card' ? 'Card Payments' : 'COD Collections',
        createdBy: 'system',
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.createdAt.toISOString(),
      }));
      
      const transaction = transactions.find(t => t.id === req.params.id);
      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }
      res.json({ success: true, data: transaction });
    } catch (error) {
      console.error('[Get Transaction Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
    }
  });

  // Finance expenses
  app.get('/api/finance/expenses', (req, res) => {
    res.json({ success: true, data: financeExpenses });
  });

  // Get expense by ID
  app.get('/api/finance/expenses/:id', (req, res) => {
    const expense = financeExpenses.find(e => e.id === req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    res.json({ success: true, data: expense });
  });

  app.post('/api/finance/expenses', (req, res) => {
    const newExpense = { id: `exp-${Date.now()}`, ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    res.status(201).json({ success: true, data: newExpense });
  });

  // Update expense
  app.put('/api/finance/expenses/:id', (req, res) => {
    const expenseIndex = financeExpenses.findIndex(e => e.id === req.params.id);
    if (expenseIndex === -1) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    Object.assign(financeExpenses[expenseIndex], req.body, { updatedAt: new Date().toISOString() });
    res.json({ success: true, data: financeExpenses[expenseIndex] });
  });

  // Delete expense
  app.delete('/api/finance/expenses/:id', (req, res) => {
    const expenseIndex = financeExpenses.findIndex(e => e.id === req.params.id);
    if (expenseIndex === -1) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    const deleted = financeExpenses.splice(expenseIndex, 1)[0];
    res.json({ success: true, data: deleted, message: 'Expense deleted successfully' });
  });

  app.post('/api/finance/expenses/:id/pay', (req, res) => {
    const expense = financeExpenses.find(e => e.id === req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
    res.json({ success: true, data: { ...expense, status: 'paid', paidAt: new Date().toISOString() } });
  });

  // Finance reports
  app.get('/api/finance/reports/profit-loss', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalCOGS = totalRevenue * 0.65;
      const grossProfit = totalRevenue - totalCOGS;
      const totalExpenses = financeExpenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
      const netProfit = grossProfit - totalExpenses;

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
          operatingExpenses: [
            { category: 'rent', amount: 15000 },
            { category: 'salaries', amount: 35000 },
            { category: 'utilities', amount: 1500 },
          ],
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

  app.get('/api/finance/reports/cash-flow', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !pgDb) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const allOrders = await pgDb.select().from(ordersTable);
      const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(String(o.total)), 0);
      const totalExpenses = financeExpenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);

      res.json({
        success: true,
        data: {
          period: req.query.period || 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          openingBalance: 100000,
          closingBalance: 100000 + totalRevenue - totalExpenses,
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
      const salesVAT = allOrders.reduce((sum, o) => sum + parseFloat(String(o.vat)), 0);
      const salesTaxable = allOrders.reduce((sum, o) => sum + (parseFloat(String(o.total)) - parseFloat(String(o.vat))), 0);

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
            taxableAmount: parseFloat(String(o.total)) - parseFloat(String(o.vat)),
            vatAmount: parseFloat(String(o.vat)),
            vatRate: 5,
          })),
        },
      });
    } catch (error) {
      console.error('[VAT Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate VAT report' });
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
