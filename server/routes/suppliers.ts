/**
 * Supplier Management Routes
 * Comprehensive supplier and purchase order management API
 */

import { Router, RequestHandler } from "express";
import type {
  Supplier,
  SupplierProduct,
  PurchaseOrder,
  SupplierStats,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  CreatePurchaseOrderRequest,
  SupplierStatus,
  PurchaseOrderStatus,
} from "../../shared/api";

const router = Router();

// =====================================================
// MOCK DATA - In production, this would be in database
// =====================================================

const suppliers: Supplier[] = [
  {
    id: "sup-001",
    code: "SUP-001",
    name: "Premium Meat Suppliers LLC",
    nameAr: "موردو اللحوم الممتازة",
    email: "orders@premiummeat.ae",
    phone: "+971501234567",
    website: "https://premiummeat.ae",
    taxNumber: "100123456700001",
    address: {
      street: "Industrial Area 5, Warehouse 23",
      city: "Dubai",
      state: "Dubai",
      country: "UAE",
      postalCode: "00000",
    },
    contacts: [
      {
        id: "contact-001",
        name: "Ahmed Al Maktoum",
        position: "Sales Manager",
        email: "ahmed@premiummeat.ae",
        phone: "+971501234567",
        isPrimary: true,
      },
      {
        id: "contact-002",
        name: "Sara Hassan",
        position: "Account Executive",
        email: "sara@premiummeat.ae",
        phone: "+971509876543",
        isPrimary: false,
      },
    ],
    paymentTerms: "net_30",
    currency: "AED",
    creditLimit: 100000,
    currentBalance: 25000,
    categories: ["beef", "lamb"],
    rating: 4.5,
    onTimeDeliveryRate: 95,
    qualityScore: 98,
    totalOrders: 156,
    totalSpent: 450000,
    status: "active",
    notes: "Premium supplier with excellent quality beef and lamb products.",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2026-01-05T14:30:00Z",
    lastOrderAt: "2026-01-05T14:30:00Z",
  },
  {
    id: "sup-002",
    code: "SUP-002",
    name: "Gulf Poultry Farms",
    nameAr: "مزارع الخليج للدواجن",
    email: "sales@gulfpoultry.ae",
    phone: "+971502345678",
    website: "https://gulfpoultry.ae",
    taxNumber: "100123456700002",
    address: {
      street: "Al Ain Road, Farm Complex B",
      city: "Al Ain",
      state: "Abu Dhabi",
      country: "UAE",
      postalCode: "00000",
    },
    contacts: [
      {
        id: "contact-003",
        name: "Mohammed Rashid",
        position: "General Manager",
        email: "mohammed@gulfpoultry.ae",
        phone: "+971502345678",
        isPrimary: true,
      },
    ],
    paymentTerms: "net_15",
    currency: "AED",
    creditLimit: 50000,
    currentBalance: 12000,
    categories: ["chicken"],
    rating: 4.2,
    onTimeDeliveryRate: 92,
    qualityScore: 95,
    totalOrders: 89,
    totalSpent: 180000,
    status: "active",
    notes: "Reliable poultry supplier with fresh daily deliveries.",
    createdAt: "2024-03-20T09:00:00Z",
    updatedAt: "2026-01-04T11:00:00Z",
    lastOrderAt: "2026-01-04T11:00:00Z",
  },
  {
    id: "sup-003",
    code: "SUP-003",
    name: "Al Shamsi Livestock",
    nameAr: "الشمسي للمواشي",
    email: "info@alshamsilivestock.ae",
    phone: "+971503456789",
    taxNumber: "100123456700003",
    address: {
      street: "Emirates Road, Livestock Market",
      city: "Sharjah",
      state: "Sharjah",
      country: "UAE",
      postalCode: "00000",
    },
    contacts: [
      {
        id: "contact-004",
        name: "Khalid Al Shamsi",
        position: "Owner",
        email: "khalid@alshamsilivestock.ae",
        phone: "+971503456789",
        isPrimary: true,
      },
    ],
    paymentTerms: "cod",
    currency: "AED",
    creditLimit: 0,
    currentBalance: 0,
    categories: ["goat", "lamb"],
    rating: 4.0,
    onTimeDeliveryRate: 88,
    qualityScore: 90,
    totalOrders: 45,
    totalSpent: 95000,
    status: "active",
    notes: "Local livestock supplier specializing in sheep and lamb.",
    createdAt: "2024-06-10T08:00:00Z",
    updatedAt: "2026-01-02T16:00:00Z",
    lastOrderAt: "2026-01-02T16:00:00Z",
  },
  {
    id: "sup-004",
    code: "SUP-004",
    name: "International Meats Trading",
    nameAr: "التجارة الدولية للحوم",
    email: "contact@intmeats.com",
    phone: "+971504567890",
    website: "https://intmeats.com",
    taxNumber: "100123456700004",
    address: {
      street: "Jebel Ali Free Zone, Building C5",
      city: "Dubai",
      state: "Dubai",
      country: "UAE",
      postalCode: "00000",
    },
    contacts: [
      {
        id: "contact-005",
        name: "John Smith",
        position: "Regional Director",
        email: "john@intmeats.com",
        phone: "+971504567890",
        isPrimary: true,
      },
    ],
    paymentTerms: "net_60",
    currency: "AED",
    creditLimit: 200000,
    currentBalance: 75000,
    categories: ["beef", "lamb", "chicken"],
    rating: 4.8,
    onTimeDeliveryRate: 98,
    qualityScore: 99,
    totalOrders: 234,
    totalSpent: 890000,
    status: "active",
    notes: "Premium international supplier with certified Halal products.",
    createdAt: "2023-11-01T12:00:00Z",
    updatedAt: "2026-01-08T10:00:00Z",
    lastOrderAt: "2026-01-08T10:00:00Z",
  },
  {
    id: "sup-005",
    code: "SUP-005",
    name: "Pending Supplier Co",
    email: "info@pendingsupplier.ae",
    phone: "+971505678901",
    address: {
      street: "Business Bay, Tower 3",
      city: "Dubai",
      state: "Dubai",
      country: "UAE",
      postalCode: "00000",
    },
    contacts: [
      {
        id: "contact-006",
        name: "New Contact",
        position: "Sales",
        email: "sales@pendingsupplier.ae",
        phone: "+971505678901",
        isPrimary: true,
      },
    ],
    paymentTerms: "net_30",
    currency: "AED",
    creditLimit: 25000,
    currentBalance: 0,
    categories: ["beef"],
    rating: 0,
    onTimeDeliveryRate: 0,
    qualityScore: 0,
    totalOrders: 0,
    totalSpent: 0,
    status: "pending",
    notes: "New supplier pending approval and verification.",
    createdAt: "2026-01-07T14:00:00Z",
    updatedAt: "2026-01-07T14:00:00Z",
  },
];

const supplierProducts: SupplierProduct[] = [
  {
    id: "sp-001",
    supplierId: "sup-001",
    productId: "beef-ribeye",
    productName: "Premium Ribeye Steak",
    supplierSku: "PMS-RIB-001",
    unitCost: 85,
    minimumOrderQuantity: 5000, // 5kg
    leadTimeDays: 2,
    isPreferred: true,
    lastPurchasePrice: 85,
    lastPurchaseDate: "2026-01-05T14:30:00Z",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2026-01-05T14:30:00Z",
  },
  {
    id: "sp-002",
    supplierId: "sup-001",
    productId: "beef-tenderloin",
    productName: "Beef Tenderloin",
    supplierSku: "PMS-TEN-001",
    unitCost: 120,
    minimumOrderQuantity: 3000,
    leadTimeDays: 2,
    isPreferred: true,
    lastPurchasePrice: 118,
    lastPurchaseDate: "2026-01-03T10:00:00Z",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2026-01-03T10:00:00Z",
  },
  {
    id: "sp-003",
    supplierId: "sup-002",
    productId: "chicken-breast",
    productName: "Chicken Breast",
    supplierSku: "GPF-CHK-001",
    unitCost: 28,
    minimumOrderQuantity: 10000,
    leadTimeDays: 1,
    isPreferred: true,
    lastPurchasePrice: 28,
    lastPurchaseDate: "2026-01-04T11:00:00Z",
    createdAt: "2024-03-20T09:00:00Z",
    updatedAt: "2026-01-04T11:00:00Z",
  },
  {
    id: "sp-004",
    supplierId: "sup-003",
    productId: "lamb-leg",
    productName: "Lamb Leg",
    supplierSku: "ALS-LMB-001",
    unitCost: 65,
    minimumOrderQuantity: 8000,
    leadTimeDays: 3,
    isPreferred: false,
    lastPurchasePrice: 65,
    lastPurchaseDate: "2026-01-02T16:00:00Z",
    createdAt: "2024-06-10T08:00:00Z",
    updatedAt: "2026-01-02T16:00:00Z",
  },
];

const purchaseOrders: PurchaseOrder[] = [
  {
    id: "po-001",
    orderNumber: "PO-2026-0001",
    supplierId: "sup-001",
    supplierName: "Premium Meat Suppliers LLC",
    items: [
      {
        id: "poi-001",
        productId: "beef-ribeye",
        productName: "Premium Ribeye Steak",
        supplierSku: "PMS-RIB-001",
        quantity: 20000,
        unitCost: 85,
        totalCost: 1700,
        receivedQuantity: 20000,
        notes: "",
      },
      {
        id: "poi-002",
        productId: "beef-tenderloin",
        productName: "Beef Tenderloin",
        supplierSku: "PMS-TEN-001",
        quantity: 10000,
        unitCost: 120,
        totalCost: 1200,
        receivedQuantity: 10000,
        notes: "",
      },
    ],
    subtotal: 2900,
    taxAmount: 145,
    taxRate: 5,
    shippingCost: 50,
    discount: 0,
    total: 3095,
    status: "received",
    paymentStatus: "paid",
    orderDate: "2026-01-03T10:00:00Z",
    expectedDeliveryDate: "2026-01-05T10:00:00Z",
    actualDeliveryDate: "2026-01-05T09:30:00Z",
    deliveryAddress: "Butcher Shop, Al Barsha, Dubai",
    deliveryNotes: "Deliver to cold storage entrance",
    trackingNumber: "TRK-12345",
    createdBy: "admin",
    approvedBy: "admin",
    approvedAt: "2026-01-03T10:30:00Z",
    internalNotes: "Regular weekly order",
    statusHistory: [
      { status: "draft", changedBy: "admin", changedAt: "2026-01-03T10:00:00Z" },
      { status: "approved", changedBy: "admin", changedAt: "2026-01-03T10:30:00Z" },
      { status: "ordered", changedBy: "admin", changedAt: "2026-01-03T11:00:00Z" },
      { status: "received", changedBy: "admin", changedAt: "2026-01-05T09:30:00Z" },
    ],
    createdAt: "2026-01-03T10:00:00Z",
    updatedAt: "2026-01-05T09:30:00Z",
  },
  {
    id: "po-002",
    orderNumber: "PO-2026-0002",
    supplierId: "sup-002",
    supplierName: "Gulf Poultry Farms",
    items: [
      {
        id: "poi-003",
        productId: "chicken-breast",
        productName: "Chicken Breast",
        supplierSku: "GPF-CHK-001",
        quantity: 50000,
        unitCost: 28,
        totalCost: 1400,
        receivedQuantity: 0,
        notes: "",
      },
    ],
    subtotal: 1400,
    taxAmount: 70,
    taxRate: 5,
    shippingCost: 0,
    discount: 50,
    total: 1420,
    status: "ordered",
    paymentStatus: "pending",
    orderDate: "2026-01-08T09:00:00Z",
    expectedDeliveryDate: "2026-01-09T09:00:00Z",
    deliveryAddress: "Butcher Shop, Al Barsha, Dubai",
    createdBy: "admin",
    approvedBy: "admin",
    approvedAt: "2026-01-08T09:15:00Z",
    statusHistory: [
      { status: "draft", changedBy: "admin", changedAt: "2026-01-08T09:00:00Z" },
      { status: "approved", changedBy: "admin", changedAt: "2026-01-08T09:15:00Z" },
      { status: "ordered", changedBy: "admin", changedAt: "2026-01-08T09:30:00Z" },
    ],
    createdAt: "2026-01-08T09:00:00Z",
    updatedAt: "2026-01-08T09:30:00Z",
  },
  {
    id: "po-003",
    orderNumber: "PO-2026-0003",
    supplierId: "sup-004",
    supplierName: "International Meats Trading",
    items: [
      {
        id: "poi-004",
        productId: "beef-ribeye",
        productName: "Premium Ribeye Steak",
        quantity: 50000,
        unitCost: 82,
        totalCost: 4100,
        receivedQuantity: 25000,
        notes: "Partial delivery received",
      },
    ],
    subtotal: 4100,
    taxAmount: 205,
    taxRate: 5,
    shippingCost: 100,
    discount: 0,
    total: 4405,
    status: "partially_received",
    paymentStatus: "partial",
    orderDate: "2026-01-06T11:00:00Z",
    expectedDeliveryDate: "2026-01-08T11:00:00Z",
    deliveryAddress: "Butcher Shop, Al Barsha, Dubai",
    trackingNumber: "TRK-67890",
    createdBy: "admin",
    approvedBy: "admin",
    approvedAt: "2026-01-06T11:30:00Z",
    internalNotes: "Large order - split delivery expected",
    statusHistory: [
      { status: "draft", changedBy: "admin", changedAt: "2026-01-06T11:00:00Z" },
      { status: "approved", changedBy: "admin", changedAt: "2026-01-06T11:30:00Z" },
      { status: "ordered", changedBy: "admin", changedAt: "2026-01-06T12:00:00Z" },
      { status: "partially_received", changedBy: "admin", changedAt: "2026-01-08T10:00:00Z", notes: "First batch of 25kg received" },
    ],
    createdAt: "2026-01-06T11:00:00Z",
    updatedAt: "2026-01-08T10:00:00Z",
  },
  {
    id: "po-004",
    orderNumber: "PO-2026-0004",
    supplierId: "sup-001",
    supplierName: "Premium Meat Suppliers LLC",
    items: [
      {
        id: "poi-005",
        productId: "beef-tenderloin",
        productName: "Beef Tenderloin",
        supplierSku: "PMS-TEN-001",
        quantity: 15000,
        unitCost: 120,
        totalCost: 1800,
        receivedQuantity: 0,
      },
    ],
    subtotal: 1800,
    taxAmount: 90,
    taxRate: 5,
    shippingCost: 50,
    discount: 0,
    total: 1940,
    status: "pending",
    paymentStatus: "pending",
    orderDate: "2026-01-09T08:00:00Z",
    expectedDeliveryDate: "2026-01-11T08:00:00Z",
    deliveryAddress: "Butcher Shop, Al Barsha, Dubai",
    createdBy: "admin",
    statusHistory: [
      { status: "draft", changedBy: "admin", changedAt: "2026-01-09T08:00:00Z" },
      { status: "pending", changedBy: "admin", changedAt: "2026-01-09T08:00:00Z", notes: "Awaiting approval" },
    ],
    createdAt: "2026-01-09T08:00:00Z",
    updatedAt: "2026-01-09T08:00:00Z",
  },
];

// Helper to generate IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const generateCode = (prefix: string, items: { code?: string }[]) => {
  const lastCode = items
    .map(i => i.code)
    .filter(Boolean)
    .sort()
    .pop();
  const lastNum = lastCode ? parseInt(lastCode.split("-")[1]) : 0;
  return `${prefix}-${String(lastNum + 1).padStart(3, "0")}`;
};
const generateOrderNumber = (orders: PurchaseOrder[]) => {
  const year = new Date().getFullYear();
  const yearOrders = orders.filter(o => o.orderNumber.includes(String(year)));
  const lastNum = yearOrders.length > 0 
    ? Math.max(...yearOrders.map(o => parseInt(o.orderNumber.split("-")[2])))
    : 0;
  return `PO-${year}-${String(lastNum + 1).padStart(4, "0")}`;
};

// =====================================================
// SUPPLIER ROUTES
// =====================================================

// GET /api/suppliers - List all suppliers
const getAllSuppliers: RequestHandler = (req, res) => {
  const { status, category, search } = req.query;
  
  let filtered = [...suppliers];
  
  if (status && status !== "all") {
    filtered = filtered.filter(s => s.status === status);
  }
  
  if (category && category !== "all") {
    filtered = filtered.filter(s => s.categories.includes(category as string));
  }
  
  if (search) {
    const query = (search as string).toLowerCase();
    filtered = filtered.filter(s => 
      s.name.toLowerCase().includes(query) ||
      s.code.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.phone.includes(query)
    );
  }
  
  // Sort by name
  filtered.sort((a, b) => a.name.localeCompare(b.name));
  
  res.json({ success: true, data: filtered });
};

// GET /api/suppliers/stats - Get supplier statistics
const getSupplierStats: RequestHandler = (_req, res) => {
  const stats: SupplierStats = {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter(s => s.status === "active").length,
    pendingSuppliers: suppliers.filter(s => s.status === "pending").length,
    totalPurchaseOrders: purchaseOrders.length,
    pendingOrders: purchaseOrders.filter(po => po.status === "pending" || po.status === "ordered").length,
    totalSpent: suppliers.reduce((sum, s) => sum + s.totalSpent, 0),
    averageLeadTime: supplierProducts.length > 0 
      ? supplierProducts.reduce((sum, sp) => sum + sp.leadTimeDays, 0) / supplierProducts.length
      : 0,
    topCategories: ["beef", "lamb", "chicken", "sheep"].map(cat => ({
      category: cat,
      count: suppliers.filter(s => s.categories.includes(cat)).length,
    })).filter(c => c.count > 0).sort((a, b) => b.count - a.count),
  };
  
  res.json({ success: true, data: stats });
};

// GET /api/suppliers/:id - Get supplier by ID
const getSupplierById: RequestHandler = (req, res) => {
  const supplier = suppliers.find(s => s.id === req.params.id);
  if (!supplier) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  res.json({ success: true, data: supplier });
};

// POST /api/suppliers - Create new supplier
const createSupplier: RequestHandler = (req, res) => {
  const data: CreateSupplierRequest = req.body;
  
  const newSupplier: Supplier = {
    id: generateId(),
    code: generateCode("SUP", suppliers),
    name: data.name,
    nameAr: data.nameAr,
    email: data.email,
    phone: data.phone,
    website: data.website,
    taxNumber: data.taxNumber,
    address: data.address,
    contacts: data.contacts.map(c => ({ ...c, id: generateId() })),
    paymentTerms: data.paymentTerms,
    currency: data.currency || "AED",
    creditLimit: data.creditLimit || 0,
    currentBalance: 0,
    categories: data.categories,
    rating: 0,
    onTimeDeliveryRate: 0,
    qualityScore: 0,
    totalOrders: 0,
    totalSpent: 0,
    status: "pending",
    notes: data.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  suppliers.push(newSupplier);
  res.status(201).json({ success: true, data: newSupplier });
};

// PUT /api/suppliers/:id - Update supplier
const updateSupplier: RequestHandler = (req, res) => {
  const index = suppliers.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  
  const data: UpdateSupplierRequest = req.body;
  const supplier = suppliers[index];
  
  suppliers[index] = {
    ...supplier,
    ...data,
    address: data.address ? { ...supplier.address, ...data.address } : supplier.address,
    updatedAt: new Date().toISOString(),
  };
  
  res.json({ success: true, data: suppliers[index] });
};

// DELETE /api/suppliers/:id - Delete supplier
const deleteSupplier: RequestHandler = (req, res) => {
  const index = suppliers.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  
  // Check for pending orders
  const hasPendingOrders = purchaseOrders.some(
    po => po.supplierId === req.params.id && !["received", "cancelled"].includes(po.status)
  );
  
  if (hasPendingOrders) {
    return res.status(400).json({ 
      success: false, 
      error: "Cannot delete supplier with pending purchase orders" 
    });
  }
  
  suppliers.splice(index, 1);
  res.json({ success: true, data: null });
};

// PATCH /api/suppliers/:id/status - Update supplier status
const updateSupplierStatus: RequestHandler = (req, res) => {
  const index = suppliers.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  
  const { status } = req.body as { status: SupplierStatus };
  suppliers[index] = {
    ...suppliers[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  
  res.json({ success: true, data: suppliers[index] });
};

// =====================================================
// SUPPLIER PRODUCTS ROUTES
// =====================================================

// GET /api/suppliers/:id/products - Get products for a supplier
const getSupplierProducts: RequestHandler = (req, res) => {
  const products = supplierProducts.filter(sp => sp.supplierId === req.params.id);
  res.json({ success: true, data: products });
};

// POST /api/suppliers/:id/products - Add product to supplier
const addSupplierProduct: RequestHandler = (req, res) => {
  const supplierId = req.params.id;
  const supplier = suppliers.find(s => s.id === supplierId);
  
  if (!supplier) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  
  const data = req.body;
  const newProduct: SupplierProduct = {
    id: generateId(),
    supplierId,
    productId: data.productId,
    productName: data.productName,
    supplierSku: data.supplierSku || "",
    unitCost: data.unitCost,
    minimumOrderQuantity: data.minimumOrderQuantity || 1000,
    leadTimeDays: data.leadTimeDays || 3,
    isPreferred: data.isPreferred || false,
    lastPurchasePrice: data.unitCost,
    notes: data.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  supplierProducts.push(newProduct);
  res.status(201).json({ success: true, data: newProduct });
};

// DELETE /api/suppliers/products/:productId - Remove supplier product
const removeSupplierProduct: RequestHandler = (req, res) => {
  const index = supplierProducts.findIndex(sp => sp.id === req.params.productId);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Supplier product not found" });
  }
  
  supplierProducts.splice(index, 1);
  res.json({ success: true, data: null });
};

// =====================================================
// PURCHASE ORDER ROUTES
// =====================================================

// GET /api/suppliers/purchase-orders - List all purchase orders
const getAllPurchaseOrders: RequestHandler = (req, res) => {
  const { status, supplierId, startDate, endDate } = req.query;
  
  let filtered = [...purchaseOrders];
  
  if (status && status !== "all") {
    filtered = filtered.filter(po => po.status === status);
  }
  
  if (supplierId) {
    filtered = filtered.filter(po => po.supplierId === supplierId);
  }
  
  if (startDate) {
    filtered = filtered.filter(po => new Date(po.orderDate) >= new Date(startDate as string));
  }
  
  if (endDate) {
    filtered = filtered.filter(po => new Date(po.orderDate) <= new Date(endDate as string));
  }
  
  // Sort by date descending
  filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  
  res.json({ success: true, data: filtered });
};

// GET /api/suppliers/purchase-orders/:id - Get purchase order by ID
const getPurchaseOrderById: RequestHandler = (req, res) => {
  const order = purchaseOrders.find(po => po.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: "Purchase order not found" });
  }
  res.json({ success: true, data: order });
};

// POST /api/suppliers/purchase-orders - Create purchase order
const createPurchaseOrder: RequestHandler = (req, res) => {
  const data: CreatePurchaseOrderRequest = req.body;
  
  const supplier = suppliers.find(s => s.id === data.supplierId);
  if (!supplier) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  
  const items: PurchaseOrder["items"] = data.items.map(item => {
    const sp = supplierProducts.find(p => p.productId === item.productId && p.supplierId === data.supplierId);
    return {
      id: generateId(),
      productId: item.productId,
      productName: sp?.productName || item.productId,
      supplierSku: sp?.supplierSku,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: (item.quantity / 1000) * item.unitCost, // Convert grams to kg for cost
      receivedQuantity: 0,
      notes: item.notes,
    };
  });
  
  const subtotal = items.reduce((sum, item) => sum + item.totalCost, 0);
  const taxRate = 5;
  const taxAmount = subtotal * (taxRate / 100);
  const shippingCost = data.shippingCost || 0;
  const discount = data.discount || 0;
  const total = subtotal + taxAmount + shippingCost - discount;
  
  const newOrder: PurchaseOrder = {
    id: generateId(),
    orderNumber: generateOrderNumber(purchaseOrders),
    supplierId: data.supplierId,
    supplierName: supplier.name,
    items,
    subtotal,
    taxAmount,
    taxRate,
    shippingCost,
    discount,
    total,
    status: "draft",
    paymentStatus: "pending",
    orderDate: new Date().toISOString(),
    expectedDeliveryDate: data.expectedDeliveryDate,
    deliveryAddress: data.deliveryAddress,
    deliveryNotes: data.deliveryNotes,
    createdBy: "admin",
    internalNotes: data.internalNotes,
    supplierNotes: data.supplierNotes,
    statusHistory: [
      { status: "draft", changedBy: "admin", changedAt: new Date().toISOString() },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  purchaseOrders.push(newOrder);
  res.status(201).json({ success: true, data: newOrder });
};

// PATCH /api/suppliers/purchase-orders/:id/status - Update purchase order status
const updatePurchaseOrderStatus: RequestHandler = (req, res) => {
  const index = purchaseOrders.findIndex(po => po.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Purchase order not found" });
  }
  
  const { status, notes } = req.body as { status: PurchaseOrderStatus; notes?: string };
  const order = purchaseOrders[index];
  
  // Update supplier stats if order is being received
  if (status === "received" && order.status !== "received") {
    const supplierIndex = suppliers.findIndex(s => s.id === order.supplierId);
    if (supplierIndex !== -1) {
      suppliers[supplierIndex].totalOrders += 1;
      suppliers[supplierIndex].totalSpent += order.total;
      suppliers[supplierIndex].lastOrderAt = new Date().toISOString();
    }
  }
  
  purchaseOrders[index] = {
    ...order,
    status,
    actualDeliveryDate: status === "received" ? new Date().toISOString() : order.actualDeliveryDate,
    approvedBy: status === "approved" ? "admin" : order.approvedBy,
    approvedAt: status === "approved" ? new Date().toISOString() : order.approvedAt,
    statusHistory: [
      ...order.statusHistory,
      { status, changedBy: "admin", changedAt: new Date().toISOString(), notes },
    ],
    updatedAt: new Date().toISOString(),
  };
  
  res.json({ success: true, data: purchaseOrders[index] });
};

// PUT /api/suppliers/purchase-orders/:id/receive - Receive items
const receivePurchaseOrderItems: RequestHandler = (req, res) => {
  const index = purchaseOrders.findIndex(po => po.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Purchase order not found" });
  }
  
  const { items } = req.body as { items: { itemId: string; receivedQuantity: number }[] };
  const order = purchaseOrders[index];
  
  // Update received quantities
  const updatedItems = order.items.map(item => {
    const received = items.find(i => i.itemId === item.id);
    return received 
      ? { ...item, receivedQuantity: item.receivedQuantity + received.receivedQuantity }
      : item;
  });
  
  // Check if fully received or partially received
  const allReceived = updatedItems.every(item => item.receivedQuantity >= item.quantity);
  const anyReceived = updatedItems.some(item => item.receivedQuantity > 0);
  const newStatus: PurchaseOrderStatus = allReceived 
    ? "received" 
    : anyReceived 
      ? "partially_received" 
      : order.status;
  
  purchaseOrders[index] = {
    ...order,
    items: updatedItems,
    status: newStatus,
    actualDeliveryDate: allReceived ? new Date().toISOString() : order.actualDeliveryDate,
    statusHistory: newStatus !== order.status 
      ? [...order.statusHistory, { status: newStatus, changedBy: "admin", changedAt: new Date().toISOString() }]
      : order.statusHistory,
    updatedAt: new Date().toISOString(),
  };
  
  // Update supplier stats if fully received
  if (allReceived && order.status !== "received") {
    const supplierIndex = suppliers.findIndex(s => s.id === order.supplierId);
    if (supplierIndex !== -1) {
      suppliers[supplierIndex].totalOrders += 1;
      suppliers[supplierIndex].totalSpent += order.total;
      suppliers[supplierIndex].lastOrderAt = new Date().toISOString();
    }
  }
  
  res.json({ success: true, data: purchaseOrders[index] });
};

// DELETE /api/suppliers/purchase-orders/:id - Cancel/delete purchase order
const deletePurchaseOrder: RequestHandler = (req, res) => {
  const index = purchaseOrders.findIndex(po => po.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Purchase order not found" });
  }
  
  const order = purchaseOrders[index];
  if (["received", "partially_received"].includes(order.status)) {
    return res.status(400).json({ 
      success: false, 
      error: "Cannot delete received or partially received orders" 
    });
  }
  
  // Mark as cancelled instead of deleting
  purchaseOrders[index] = {
    ...order,
    status: "cancelled",
    statusHistory: [
      ...order.statusHistory,
      { status: "cancelled", changedBy: "admin", changedAt: new Date().toISOString() },
    ],
    updatedAt: new Date().toISOString(),
  };
  
  res.json({ success: true, data: purchaseOrders[index] });
};

// =====================================================
// CONTACT ROUTES
// =====================================================

// POST /api/suppliers/:id/contacts - Add contact to supplier
const addSupplierContact: RequestHandler = (req, res) => {
  const index = suppliers.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  
  const contact = {
    id: generateId(),
    ...req.body,
  };
  
  suppliers[index].contacts.push(contact);
  suppliers[index].updatedAt = new Date().toISOString();
  
  res.status(201).json({ success: true, data: contact });
};

// DELETE /api/suppliers/:id/contacts/:contactId - Remove contact
const removeSupplierContact: RequestHandler = (req, res) => {
  const supplierIndex = suppliers.findIndex(s => s.id === req.params.id);
  if (supplierIndex === -1) {
    return res.status(404).json({ success: false, error: "Supplier not found" });
  }
  
  const contactIndex = suppliers[supplierIndex].contacts.findIndex(c => c.id === req.params.contactId);
  if (contactIndex === -1) {
    return res.status(404).json({ success: false, error: "Contact not found" });
  }
  
  suppliers[supplierIndex].contacts.splice(contactIndex, 1);
  suppliers[supplierIndex].updatedAt = new Date().toISOString();
  
  res.json({ success: true, data: null });
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
