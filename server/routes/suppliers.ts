/**
 * Supplier Management Routes - Database Backed
 * All data is stored in PostgreSQL via Drizzle ORM
 */

import { Router, RequestHandler } from "express";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, and, ne } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  decimal,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import type {
  Supplier,
  SupplierProduct,
  PurchaseOrder,
  SupplierStats,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  CreatePurchaseOrderRequest,
  PurchaseOrderStatus,
} from "../../shared/api";

const router = Router();

// =====================================================
// DATABASE CONNECTION
// =====================================================

const databaseUrl = process.env.DATABASE_URL;
const neonClient = databaseUrl ? neon(databaseUrl) : null;
const pgDb = neonClient ? drizzle(neonClient) : null;

const isDatabaseAvailable = () => !!pgDb;

// =====================================================
// TABLE DEFINITIONS
// =====================================================

const supplierStatusEnum = pgEnum("supplier_status", ["active", "inactive", "pending", "suspended"]);
const supplierPaymentTermsEnum = pgEnum("supplier_payment_terms", ["net_7", "net_15", "net_30", "net_60", "cod", "prepaid"]);
const currencyEnum = pgEnum("currency", ["AED", "USD", "EUR"]);
const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft", "pending", "approved", "ordered", "partially_received", "received", "cancelled"
]);

const suppliersTable = pgTable("suppliers", {
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

const supplierProductsTable = pgTable("supplier_products", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id").notNull(),
  productId: text("product_id").notNull(),
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

const purchaseOrdersTable = pgTable("purchase_orders", {
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
  status: purchaseOrderStatusEnum("status").notNull().default("draft"),
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
  statusHistory: jsonb("status_history").$type<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const purchaseOrderItemsTable = pgTable("purchase_order_items", {
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

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const generateSupplierCode = async (): Promise<string> => {
  if (!pgDb) return `SUP-001`;
  const suppliers = await pgDb.select().from(suppliersTable).orderBy(desc(suppliersTable.code)).limit(1);
  if (suppliers.length === 0) return `SUP-001`;
  const lastNum = parseInt(suppliers[0].code.split('-')[1]) || 0;
  return `SUP-${String(lastNum + 1).padStart(3, '0')}`;
};

const generatePONumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  if (!pgDb) return `PO-${year}-0001`;
  const orders = await pgDb.select().from(purchaseOrdersTable).orderBy(desc(purchaseOrdersTable.orderNumber)).limit(1);
  if (orders.length === 0) return `PO-${year}-0001`;
  const lastNum = parseInt(orders[0].orderNumber.split('-')[2]) || 0;
  return `PO-${year}-${String(lastNum + 1).padStart(4, '0')}`;
};

const formatSupplier = (s: typeof suppliersTable.$inferSelect): Supplier => ({
  id: s.id,
  code: s.code,
  name: s.name,
  nameAr: s.nameAr || undefined,
  email: s.email,
  phone: s.phone,
  website: s.website || undefined,
  taxNumber: s.taxNumber || undefined,
  address: s.address,
  contacts: s.contacts || [],
  paymentTerms: s.paymentTerms,
  currency: s.currency,
  creditLimit: parseFloat(s.creditLimit) || 0,
  currentBalance: parseFloat(s.currentBalance) || 0,
  categories: s.categories || [],
  rating: parseFloat(s.rating || '0') || 0,
  onTimeDeliveryRate: parseFloat(s.onTimeDeliveryRate || '0') || 0,
  qualityScore: parseFloat(s.qualityScore || '0') || 0,
  totalOrders: s.totalOrders || 0,
  totalSpent: parseFloat(s.totalSpent) || 0,
  status: s.status,
  notes: s.notes || undefined,
  createdAt: s.createdAt?.toISOString() || new Date().toISOString(),
  updatedAt: s.updatedAt?.toISOString() || new Date().toISOString(),
  lastOrderAt: s.lastOrderAt?.toISOString(),
});

const formatSupplierProduct = (sp: typeof supplierProductsTable.$inferSelect): SupplierProduct => ({
  id: sp.id,
  supplierId: sp.supplierId,
  productId: sp.productId,
  productName: sp.productName,
  supplierSku: sp.supplierSku || '',
  unitCost: parseFloat(sp.unitCost) || 0,
  minimumOrderQuantity: sp.minimumOrderQuantity || 1,
  leadTimeDays: sp.leadTimeDays || 7,
  isPreferred: sp.isPreferred || false,
  lastPurchasePrice: parseFloat(sp.lastPurchasePrice || '0') || 0,
  lastPurchaseDate: sp.lastPurchaseDate?.toISOString(),
  notes: sp.notes || undefined,
  createdAt: sp.createdAt?.toISOString() || new Date().toISOString(),
  updatedAt: sp.updatedAt?.toISOString() || new Date().toISOString(),
});

// =====================================================
// SUPPLIER HANDLERS
// =====================================================

// GET / - List all suppliers
const getAllSuppliers: RequestHandler = async (req, res) => {
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
    res.json({ success: true, data: suppliers.map(formatSupplier) });
  } catch (error) {
    console.error('[Suppliers List Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
  }
};

// GET /stats - Get supplier statistics
const getSupplierStats: RequestHandler = async (_req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const suppliers = await pgDb.select().from(suppliersTable);
    const purchaseOrders = await pgDb.select().from(purchaseOrdersTable);
    const supplierProds = await pgDb.select().from(supplierProductsTable);

    const stats: SupplierStats = {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter(s => s.status === 'active').length,
      pendingSuppliers: suppliers.filter(s => s.status === 'pending').length,
      totalPurchaseOrders: purchaseOrders.length,
      pendingOrders: purchaseOrders.filter(po => ['pending', 'ordered'].includes(po.status)).length,
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
};

// GET /:id - Get supplier by ID
const getSupplierById: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [supplier] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    res.json({ success: true, data: formatSupplier(supplier) });
  } catch (error) {
    console.error('[Get Supplier Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplier' });
  }
};

// POST / - Create new supplier
const createSupplier: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const data: CreateSupplierRequest = req.body;
    const id = generateId();
    const code = await generateSupplierCode();

    const newSupplier = {
      id,
      code,
      name: data.name,
      nameAr: data.nameAr || null,
      email: data.email,
      phone: data.phone,
      website: data.website || null,
      taxNumber: data.taxNumber || null,
      address: data.address,
      contacts: data.contacts.map(c => ({ ...c, id: generateId() })),
      paymentTerms: data.paymentTerms as "net_7" | "net_15" | "net_30" | "net_60" | "cod" | "prepaid",
      currency: (data.currency || 'AED') as "AED" | "USD" | "EUR",
      creditLimit: String(data.creditLimit || 0),
      currentBalance: '0',
      categories: data.categories || [],
      rating: '0',
      onTimeDeliveryRate: '0',
      qualityScore: '0',
      totalOrders: 0,
      totalSpent: '0',
      status: 'pending' as const,
      notes: data.notes || null,
    };

    await pgDb.insert(suppliersTable).values(newSupplier);
    const [created] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, id));

    res.status(201).json({ success: true, data: formatSupplier(created) });
  } catch (error) {
    console.error('[Create Supplier Error]', error);
    res.status(500).json({ success: false, error: 'Failed to create supplier' });
  }
};

// PUT /:id - Update supplier
const updateSupplier: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [existing] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const data: UpdateSupplierRequest = req.body;
    
    await pgDb.update(suppliersTable)
      .set({
        name: data.name || existing.name,
        nameAr: data.nameAr !== undefined ? data.nameAr : existing.nameAr,
        email: data.email || existing.email,
        phone: data.phone || existing.phone,
        website: data.website !== undefined ? data.website : existing.website,
        taxNumber: data.taxNumber !== undefined ? data.taxNumber : existing.taxNumber,
        address: data.address ? { ...existing.address, ...data.address } : existing.address,
        paymentTerms: data.paymentTerms ? data.paymentTerms as "net_7" | "net_15" | "net_30" | "net_60" | "cod" | "prepaid" : existing.paymentTerms,
        currency: data.currency ? data.currency as "AED" | "USD" | "EUR" : existing.currency,
        creditLimit: data.creditLimit !== undefined ? String(data.creditLimit) : existing.creditLimit,
        categories: data.categories || existing.categories,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(suppliersTable.id, req.params.id));

    const [updated] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    res.json({ success: true, data: formatSupplier(updated) });
  } catch (error) {
    console.error('[Update Supplier Error]', error);
    res.status(500).json({ success: false, error: 'Failed to update supplier' });
  }
};

// DELETE /:id - Delete supplier
const deleteSupplier: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [existing] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Check for pending orders
    const pendingPOs = await pgDb.select().from(purchaseOrdersTable)
      .where(and(
        eq(purchaseOrdersTable.supplierId, req.params.id),
        ne(purchaseOrdersTable.status, 'received'),
        ne(purchaseOrdersTable.status, 'cancelled')
      ));

    if (pendingPOs.length > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete supplier with pending purchase orders' });
    }

    // Delete related products first
    await pgDb.delete(supplierProductsTable).where(eq(supplierProductsTable.supplierId, req.params.id));
    await pgDb.delete(suppliersTable).where(eq(suppliersTable.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error('[Delete Supplier Error]', error);
    res.status(500).json({ success: false, error: 'Failed to delete supplier' });
  }
};

// PATCH /:id/status - Update supplier status
const updateSupplierStatus: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const { status } = req.body;
    if (!['active', 'inactive', 'pending', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const [existing] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    await pgDb.update(suppliersTable)
      .set({ status: status as "active" | "inactive" | "pending" | "suspended", updatedAt: new Date() })
      .where(eq(suppliersTable.id, req.params.id));

    const [updated] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    res.json({ success: true, data: formatSupplier(updated) });
  } catch (error) {
    console.error('[Update Supplier Status Error]', error);
    res.status(500).json({ success: false, error: 'Failed to update supplier status' });
  }
};

// =====================================================
// CONTACT HANDLERS
// =====================================================

// POST /:id/contacts - Add contact to supplier
const addSupplierContact: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [supplier] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const newContact = {
      id: generateId(),
      ...req.body,
    };

    const contacts = [...(supplier.contacts || []), newContact];
    await pgDb.update(suppliersTable)
      .set({ contacts, updatedAt: new Date() })
      .where(eq(suppliersTable.id, req.params.id));

    res.status(201).json({ success: true, data: newContact });
  } catch (error) {
    console.error('[Add Contact Error]', error);
    res.status(500).json({ success: false, error: 'Failed to add contact' });
  }
};

// DELETE /:id/contacts/:contactId - Remove contact from supplier
const removeSupplierContact: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [supplier] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const contacts = (supplier.contacts || []).filter(c => c.id !== req.params.contactId);
    await pgDb.update(suppliersTable)
      .set({ contacts, updatedAt: new Date() })
      .where(eq(suppliersTable.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error('[Remove Contact Error]', error);
    res.status(500).json({ success: false, error: 'Failed to remove contact' });
  }
};

// =====================================================
// SUPPLIER PRODUCT HANDLERS
// =====================================================

// GET /:id/products - Get products for a supplier
const getSupplierProducts: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const products = await pgDb.select().from(supplierProductsTable)
      .where(eq(supplierProductsTable.supplierId, req.params.id));

    res.json({ success: true, data: products.map(formatSupplierProduct) });
  } catch (error) {
    console.error('[Get Supplier Products Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplier products' });
  }
};

// POST /:id/products - Add product to supplier
const addSupplierProduct: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [supplier] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, req.params.id));
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const id = generateId();
    const newProduct = {
      id,
      supplierId: req.params.id,
      productId: req.body.productId,
      productName: req.body.productName,
      supplierSku: req.body.supplierSku || null,
      unitCost: String(req.body.unitCost),
      minimumOrderQuantity: req.body.minimumOrderQuantity || 1,
      leadTimeDays: req.body.leadTimeDays || 7,
      isPreferred: req.body.isPreferred || false,
      lastPurchasePrice: null,
      lastPurchaseDate: null,
      notes: req.body.notes || null,
    };

    await pgDb.insert(supplierProductsTable).values(newProduct);
    const [created] = await pgDb.select().from(supplierProductsTable).where(eq(supplierProductsTable.id, id));

    res.status(201).json({ success: true, data: formatSupplierProduct(created) });
  } catch (error) {
    console.error('[Add Supplier Product Error]', error);
    res.status(500).json({ success: false, error: 'Failed to add supplier product' });
  }
};

// DELETE /products/:productId - Remove supplier product
const removeSupplierProduct: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    await pgDb.delete(supplierProductsTable).where(eq(supplierProductsTable.id, req.params.productId));
    res.json({ success: true });
  } catch (error) {
    console.error('[Remove Supplier Product Error]', error);
    res.status(500).json({ success: false, error: 'Failed to remove supplier product' });
  }
};

// =====================================================
// PURCHASE ORDER HANDLERS
// =====================================================

// GET /purchase-orders/list - Get all purchase orders
const getAllPurchaseOrders: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const { supplierId, status } = req.query;
    let orders = await pgDb.select().from(purchaseOrdersTable).orderBy(desc(purchaseOrdersTable.orderDate));

    if (supplierId) {
      orders = orders.filter(o => o.supplierId === supplierId);
    }
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    // Get items for each order
    const formattedOrders: PurchaseOrder[] = await Promise.all(
      orders.map(async (order) => {
        const items = await pgDb!.select().from(purchaseOrderItemsTable)
          .where(eq(purchaseOrderItemsTable.purchaseOrderId, order.id));

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          items: items.map(item => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            supplierSku: item.supplierSku || undefined,
            quantity: parseFloat(item.quantity),
            unitCost: parseFloat(item.unitCost),
            totalCost: parseFloat(item.totalCost),
            receivedQuantity: parseFloat(item.receivedQuantity),
            notes: item.notes || undefined,
          })),
          subtotal: parseFloat(order.subtotal),
          taxAmount: parseFloat(order.taxAmount),
          taxRate: parseFloat(order.taxRate),
          shippingCost: parseFloat(order.shippingCost),
          discount: parseFloat(order.discount),
          total: parseFloat(order.total),
          status: order.status,
          paymentStatus: order.paymentStatus as "pending" | "partial" | "paid",
          orderDate: order.orderDate.toISOString(),
          expectedDeliveryDate: order.expectedDeliveryDate.toISOString(),
          actualDeliveryDate: order.actualDeliveryDate?.toISOString(),
          deliveryAddress: order.deliveryAddress,
          deliveryNotes: order.deliveryNotes || undefined,
          trackingNumber: order.trackingNumber || undefined,
          createdBy: order.createdBy,
          approvedBy: order.approvedBy || undefined,
          approvedAt: order.approvedAt?.toISOString(),
          internalNotes: order.internalNotes || undefined,
          supplierNotes: order.supplierNotes || undefined,
          statusHistory: (order.statusHistory || []).map(h => ({
            ...h,
            status: h.status as PurchaseOrderStatus
          })),
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        };
      })
    );

    res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error('[Get Purchase Orders Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purchase orders' });
  }
};

// GET /purchase-orders/:id - Get purchase order by ID
const getPurchaseOrderById: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [order] = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    const items = await pgDb.select().from(purchaseOrderItemsTable)
      .where(eq(purchaseOrderItemsTable.purchaseOrderId, order.id));

    const formatted: PurchaseOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      items: items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        supplierSku: item.supplierSku || undefined,
        quantity: parseFloat(item.quantity),
        unitCost: parseFloat(item.unitCost),
        totalCost: parseFloat(item.totalCost),
        receivedQuantity: parseFloat(item.receivedQuantity),
        notes: item.notes || undefined,
      })),
      subtotal: parseFloat(order.subtotal),
      taxAmount: parseFloat(order.taxAmount),
      taxRate: parseFloat(order.taxRate),
      shippingCost: parseFloat(order.shippingCost),
      discount: parseFloat(order.discount),
      total: parseFloat(order.total),
      status: order.status,
      paymentStatus: order.paymentStatus as "pending" | "partial" | "paid",
      orderDate: order.orderDate.toISOString(),
      expectedDeliveryDate: order.expectedDeliveryDate.toISOString(),
      actualDeliveryDate: order.actualDeliveryDate?.toISOString(),
      deliveryAddress: order.deliveryAddress,
      deliveryNotes: order.deliveryNotes || undefined,
      trackingNumber: order.trackingNumber || undefined,
      createdBy: order.createdBy,
      approvedBy: order.approvedBy || undefined,
      approvedAt: order.approvedAt?.toISOString(),
      internalNotes: order.internalNotes || undefined,
      supplierNotes: order.supplierNotes || undefined,
      statusHistory: (order.statusHistory || []).map(h => ({
        ...h,
        status: h.status as PurchaseOrderStatus
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('[Get Purchase Order Error]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purchase order' });
  }
};

// POST /purchase-orders - Create purchase order
const createPurchaseOrder: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const data: CreatePurchaseOrderRequest = req.body;

    const [supplier] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, data.supplierId));
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const orderId = generateId();
    const orderNumber = await generatePONumber();

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const taxRate = 0.05;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount + (data.shippingCost || 0) - (data.discount || 0);

    const newOrder = {
      id: orderId,
      orderNumber,
      supplierId: data.supplierId,
      supplierName: supplier.name,
      subtotal: String(subtotal),
      taxAmount: String(taxAmount),
      taxRate: String(taxRate),
      shippingCost: String(data.shippingCost || 0),
      discount: String(data.discount || 0),
      total: String(total),
      status: 'draft' as const,
      paymentStatus: 'pending',
      expectedDeliveryDate: new Date(data.expectedDeliveryDate),
      deliveryAddress: data.deliveryAddress,
      deliveryNotes: data.deliveryNotes || null,
      createdBy: 'admin',
      statusHistory: [{
        status: 'draft',
        changedBy: 'admin',
        changedAt: new Date().toISOString(),
      }],
    };

    await pgDb.insert(purchaseOrdersTable).values(newOrder);

    // Insert items
    for (const item of data.items) {
      const itemId = generateId();
      await pgDb.insert(purchaseOrderItemsTable).values({
        id: itemId,
        purchaseOrderId: orderId,
        productId: item.productId,
        productName: item.productId,
        supplierSku: null,
        quantity: String(item.quantity),
        unitCost: String(item.unitCost),
        totalCost: String(item.quantity * item.unitCost),
        receivedQuantity: '0',
        notes: item.notes || null,
      });
    }

    // Update supplier stats
    await pgDb.update(suppliersTable)
      .set({
        totalOrders: supplier.totalOrders + 1,
        lastOrderAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(suppliersTable.id, data.supplierId));

    const [created] = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, orderId));
    const items = await pgDb.select().from(purchaseOrderItemsTable)
      .where(eq(purchaseOrderItemsTable.purchaseOrderId, orderId));

    res.status(201).json({
      success: true,
      data: {
        ...created,
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: parseFloat(item.quantity),
          unitCost: parseFloat(item.unitCost),
          totalCost: parseFloat(item.totalCost),
          receivedQuantity: parseFloat(item.receivedQuantity),
        })),
      }
    });
  } catch (error) {
    console.error('[Create Purchase Order Error]', error);
    res.status(500).json({ success: false, error: 'Failed to create purchase order' });
  }
};

// PATCH /purchase-orders/:id/status - Update PO status
const updatePurchaseOrderStatus: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const { status } = req.body;
    const validStatuses = ['draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const [order] = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    const statusHistory = [...(order.statusHistory || []), {
      status,
      changedBy: 'admin',
      changedAt: new Date().toISOString(),
    }];

    const updateData: Record<string, unknown> = {
      status: status as "draft" | "pending" | "approved" | "ordered" | "partially_received" | "received" | "cancelled",
      statusHistory,
      updatedAt: new Date(),
    };

    if (status === 'approved') {
      updateData.approvedBy = 'admin';
      updateData.approvedAt = new Date();
    }
    if (status === 'received') {
      updateData.actualDeliveryDate = new Date();

      // Update supplier spent
      const [supplier] = await pgDb.select().from(suppliersTable).where(eq(suppliersTable.id, order.supplierId));
      if (supplier) {
        await pgDb.update(suppliersTable)
          .set({
            totalSpent: String(parseFloat(supplier.totalSpent) + parseFloat(order.total)),
            updatedAt: new Date(),
          })
          .where(eq(suppliersTable.id, order.supplierId));
      }
    }

    await pgDb.update(purchaseOrdersTable).set(updateData).where(eq(purchaseOrdersTable.id, req.params.id));

    const [updated] = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Update PO Status Error]', error);
    res.status(500).json({ success: false, error: 'Failed to update purchase order status' });
  }
};

// PUT /purchase-orders/:id/receive - Receive PO items
const receivePurchaseOrderItems: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Items must be an array' });
    }

    const [order] = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    // Update each item's received quantity
    for (const item of items) {
      const [existingItem] = await pgDb.select().from(purchaseOrderItemsTable)
        .where(eq(purchaseOrderItemsTable.id, item.itemId));

      if (existingItem) {
        const newReceivedQty = parseFloat(existingItem.receivedQuantity) + item.receivedQuantity;
        await pgDb.update(purchaseOrderItemsTable)
          .set({ receivedQuantity: String(newReceivedQty) })
          .where(eq(purchaseOrderItemsTable.id, item.itemId));
      }
    }

    // Check if all items are fully received
    const allItems = await pgDb.select().from(purchaseOrderItemsTable)
      .where(eq(purchaseOrderItemsTable.purchaseOrderId, req.params.id));

    const fullyReceived = allItems.every(item =>
      parseFloat(item.receivedQuantity) >= parseFloat(item.quantity)
    );
    const partiallyReceived = allItems.some(item =>
      parseFloat(item.receivedQuantity) > 0
    );

    const newStatus = fullyReceived ? 'received' : partiallyReceived ? 'partially_received' : order.status;

    if (newStatus !== order.status) {
      const statusHistory = [...(order.statusHistory || []), {
        status: newStatus,
        changedBy: 'admin',
        changedAt: new Date().toISOString(),
        notes: 'Items received',
      }];

      await pgDb.update(purchaseOrdersTable)
        .set({
          status: newStatus as "draft" | "pending" | "approved" | "ordered" | "partially_received" | "received" | "cancelled",
          statusHistory,
          actualDeliveryDate: fullyReceived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrdersTable.id, req.params.id));
    }

    const [updated] = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Receive PO Items Error]', error);
    res.status(500).json({ success: false, error: 'Failed to receive purchase order items' });
  }
};

// DELETE /purchase-orders/:id - Delete purchase order
const deletePurchaseOrder: RequestHandler = async (req, res) => {
  try {
    if (!isDatabaseAvailable() || !pgDb) {
      return res.status(500).json({ success: false, error: 'Database not available' });
    }

    const [order] = await pgDb.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));
    if (!order) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    if (!['draft', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Can only delete draft or cancelled orders' });
    }

    await pgDb.delete(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, req.params.id));
    await pgDb.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error('[Delete PO Error]', error);
    res.status(500).json({ success: false, error: 'Failed to delete purchase order' });
  }
};

// =====================================================
// REGISTER ROUTES
// =====================================================

// Suppliers
router.get("/", getAllSuppliers);
router.get("/stats", getSupplierStats);
router.get("/:id", getSupplierById);
router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);
router.patch("/:id/status", updateSupplierStatus);

// Supplier Contacts
router.post("/:id/contacts", addSupplierContact);
router.delete("/:id/contacts/:contactId", removeSupplierContact);

// Supplier Products
router.get("/:id/products", getSupplierProducts);
router.post("/:id/products", addSupplierProduct);
router.delete("/products/:productId", removeSupplierProduct);

// Purchase Orders
router.get("/purchase-orders/list", getAllPurchaseOrders);
router.get("/purchase-orders/:id", getPurchaseOrderById);
router.post("/purchase-orders", createPurchaseOrder);
router.patch("/purchase-orders/:id/status", updatePurchaseOrderStatus);
router.put("/purchase-orders/:id/receive", receivePurchaseOrderItems);
router.delete("/purchase-orders/:id", deletePurchaseOrder);

export default router;
