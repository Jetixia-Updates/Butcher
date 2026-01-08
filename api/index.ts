import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';

// =====================================================
// INLINE DATABASE FOR VERCEL SERVERLESS
// =====================================================

interface User {
  id: string;
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
  { id: 'prod_1', name: 'Premium Beef Steak', nameAr: 'ستيك لحم بقري ممتاز', price: 89.99, category: 'Beef', unit: 'kg', isActive: true, isFeatured: true, description: 'Premium quality beef steak', descriptionAr: 'ستيك لحم بقري عالي الجودة', available: true },
  { id: 'prod_2', name: 'Lamb Chops', nameAr: 'ريش لحم ضأن', price: 74.50, category: 'Lamb', unit: 'kg', isActive: true, isFeatured: true, description: 'Fresh lamb chops', descriptionAr: 'ريش لحم ضأن طازجة', available: true },
  { id: 'prod_3', name: 'Chicken Breast', nameAr: 'صدر دجاج', price: 34.99, category: 'Chicken', unit: 'kg', isActive: true, isFeatured: false, description: 'Boneless chicken breast', descriptionAr: 'صدر دجاج بدون عظم', available: true },
  { id: 'prod_4', name: 'Ground Beef', nameAr: 'لحم بقري مفروم', price: 45.00, category: 'Beef', unit: 'kg', isActive: true, isFeatured: false, description: 'Fresh ground beef', descriptionAr: 'لحم بقري مفروم طازج', available: true },
  { id: 'prod_5', name: 'Beef Brisket', nameAr: 'صدر لحم بقري', price: 95.00, category: 'Beef', unit: 'kg', isActive: true, isFeatured: true, description: 'Premium beef brisket', descriptionAr: 'صدر لحم بقري ممتاز', available: true },
  { id: 'prod_6', name: 'Sheep Leg', nameAr: 'فخذ خروف', price: 125.00, category: 'Sheep', unit: 'piece', isActive: true, isFeatured: true, description: 'Whole sheep leg', descriptionAr: 'فخذ خروف كامل', available: true },
];

// Seed initial data
function seedData() {
  if (users.size > 0) return; // Already seeded
  
  // Admin user
  users.set("admin_1", {
    id: "admin_1",
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
    { id: "user_1", email: "ahmed@example.com", mobile: "+971501111111", firstName: "Ahmed", familyName: "Al Maktoum", emirate: "Dubai" },
    { id: "user_2", email: "fatima@example.com", mobile: "+971502222222", firstName: "Fatima", familyName: "Al Nahyan", emirate: "Abu Dhabi" },
    { id: "user_3", email: "omar@example.com", mobile: "+971503333333", firstName: "Omar", familyName: "Al Qasimi", emirate: "Sharjah" },
    { id: "user_4", email: "sara@example.com", mobile: "+971504444444", firstName: "Sara", familyName: "Al Falasi", emirate: "Dubai" },
    { id: "user_5", email: "khalid@example.com", mobile: "+971505555555", firstName: "Khalid", familyName: "Al Rashid", emirate: "Ajman" },
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

  // User login
  app.post('/api/users/login', (req, res) => {
    try {
      const { mobile, password } = req.body;
      
      if (!mobile || !password) {
        return res.status(400).json({ success: false, error: 'Mobile and password are required' });
      }
      
      const normalizedMobile = mobile.replace(/\s/g, '');
      const user = Array.from(users.values()).find(
        u => u.mobile.replace(/\s/g, '') === normalizedMobile
      );

      if (!user) {
        return res.status(401).json({ success: false, error: 'No account found with this phone number' });
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
  app.post('/api/users/admin-login', (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      const user = Array.from(users.values()).find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.role === 'admin'
      );

      if (!user || user.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      sessions.set(token, { userId: user.id, expiresAt });
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
  app.post('/api/users', (req, res) => {
    try {
      const { email, mobile, password, firstName, familyName, emirate } = req.body;
      
      if (!email || !mobile || !password || !firstName || !familyName || !emirate) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      // Check existing
      const existingEmail = Array.from(users.values()).find(
        u => u.email.toLowerCase() === email.toLowerCase()
      );
      if (existingEmail) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
      }

      const normalizedMobile = mobile.replace(/\s/g, '');
      const existingMobile = Array.from(users.values()).find(
        u => u.mobile.replace(/\s/g, '') === normalizedMobile
      );
      if (existingMobile) {
        return res.status(400).json({ success: false, error: 'Phone number already registered' });
      }

      const userId = `user_${Date.now()}`;
      const newUser: User = {
        id: userId,
        email,
        mobile,
        password,
        firstName,
        familyName,
        role: 'customer',
        isActive: true,
        isVerified: false,
        emirate,
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

  // Products endpoint
  app.get('/api/products', (req, res) => {
    res.json({ success: true, data: demoProducts });
  });

  // =====================================================
  // ANALYTICS / DASHBOARD API
  // =====================================================

  app.get('/api/analytics/dashboard', (req, res) => {
    const allOrders = Array.from(orders.values());
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= todayStart);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekOrders = allOrders.filter(o => new Date(o.createdAt) >= weekStart);
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthOrders = allOrders.filter(o => new Date(o.createdAt) >= monthStart);

    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const weekRevenue = weekOrders.reduce((sum, o) => sum + o.total, 0);
    const monthRevenue = monthOrders.reduce((sum, o) => sum + o.total, 0);

    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
    const totalCustomers = Array.from(users.values()).filter(u => u.role === 'customer').length;
    
    // Low stock items
    const lowStockItems = Array.from(stockItems.values())
      .filter(s => s.availableQuantity <= s.lowStockThreshold)
      .map(s => ({
        productId: s.productId,
        productName: demoProducts.find(p => p.id === s.productId)?.name || s.productId,
        currentQuantity: s.availableQuantity,
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
        itemCount: o.items.length,
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
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
        averageOrderValue: allOrders.length > 0 ? monthRevenue / monthOrders.length : 0,
        revenueChange: { daily: 12.5, weekly: 8.3, monthly: 15.2 },
        ordersChange: { daily: 5.0, weekly: 10.0, monthly: 20.0 },
        lowStockCount: lowStockItems.length,
        lowStockItems,
        recentOrders,
      },
    });
  });

  // Revenue chart for analytics
  app.get('/api/analytics/charts/revenue', (req, res) => {
    const period = (req.query.period as string) || 'week';
    const days = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
    
    const data = Array.from({ length: Math.min(days, 14) }, (_, i) => ({
      date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revenue: 800 + Math.random() * 400,
      orders: 3 + Math.floor(Math.random() * 5),
    }));
    
    res.json({ success: true, data });
  });

  // Top products for analytics
  app.get('/api/analytics/charts/top-products', (req, res) => {
    const data = demoProducts.slice(0, 10).map((p, i) => ({
      productId: p.id,
      productName: p.name,
      sales: (5000 - i * 500) + Math.random() * 200,
      quantity: 50 - i * 5,
    }));
    
    res.json({ success: true, data });
  });

  // =====================================================
  // ORDERS API
  // =====================================================

  app.get('/api/orders', (req, res) => {
    let allOrders = Array.from(orders.values());
    
    // Filter by status if provided
    const status = req.query.status as string;
    if (status && status !== 'all') {
      allOrders = allOrders.filter(o => o.status === status);
    }

    // Sort by date (newest first)
    allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ success: true, data: allOrders });
  });

  app.get('/api/orders/stats', (req, res) => {
    const allOrders = Array.from(orders.values());
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
        todayRevenue: todayOrders.reduce((sum, o) => sum + o.total, 0),
      },
    });
  });

  app.get('/api/orders/:id', (req, res) => {
    const order = orders.get(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    const order = orders.get(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const { status, notes } = req.body;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    order.statusHistory.push({
      status,
      changedAt: new Date().toISOString(),
      changedBy: 'admin',
    });
    
    res.json({ success: true, data: order });
  });

  // =====================================================
  // STOCK / INVENTORY API
  // =====================================================

  app.get('/api/stock', (req, res) => {
    res.json({ success: true, data: Array.from(stockItems.values()) });
  });

  app.get('/api/stock/alerts', (req, res) => {
    const alerts = Array.from(stockItems.values())
      .filter(s => s.availableQuantity <= s.lowStockThreshold)
      .map(s => ({
        productId: s.productId,
        productName: demoProducts.find(p => p.id === s.productId)?.name || s.productId,
        currentQuantity: s.availableQuantity,
        threshold: s.lowStockThreshold,
        suggestedReorderQuantity: s.reorderQuantity,
      }));
    res.json({ success: true, data: alerts });
  });

  app.get('/api/stock/movements', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ success: true, data: stockMovements.slice(0, limit) });
  });

  app.post('/api/stock/restock/:productId', (req, res) => {
    const { productId } = req.params;
    const { quantity, batchNumber } = req.body;
    
    let item = stockItems.get(productId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Stock item not found' });
    }
    
    item.quantity += quantity;
    item.availableQuantity += quantity;
    item.lastRestockedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    
    stockMovements.unshift({
      id: `mov_${Date.now()}`,
      productId,
      type: 'in',
      quantity,
      reason: `Restocked${batchNumber ? ` (Batch: ${batchNumber})` : ''}`,
      createdAt: new Date().toISOString(),
    });
    
    res.json({ success: true, data: item });
  });

  app.patch('/api/stock/:productId/thresholds', (req, res) => {
    const item = stockItems.get(req.params.productId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Stock item not found' });
    }
    
    const { lowStockThreshold, reorderPoint, reorderQuantity } = req.body;
    if (lowStockThreshold !== undefined) item.lowStockThreshold = lowStockThreshold;
    if (reorderPoint !== undefined) item.reorderPoint = reorderPoint;
    if (reorderQuantity !== undefined) item.reorderQuantity = reorderQuantity;
    item.updatedAt = new Date().toISOString();
    
    res.json({ success: true, data: item });
  });

  // =====================================================
  // USERS API
  // =====================================================

  app.get('/api/users', (req, res) => {
    const allUsers = Array.from(users.values()).map(u => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
    res.json({ success: true, data: allUsers });
  });

  app.get('/api/users/stats', (req, res) => {
    const allUsers = Array.from(users.values());
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
        newThisMonth: 3,
      },
    });
  });

  app.put('/api/users/:id', (req, res) => {
    const user = users.get(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const updates = req.body;
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    
    const { password, ...userWithoutPassword } = user;
    res.json({ success: true, data: userWithoutPassword });
  });

  app.delete('/api/users/:id', (req, res) => {
    const user = users.get(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    users.delete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  });

  // =====================================================
  // DELIVERY API
  // =====================================================

  app.get('/api/delivery/zones', (req, res) => {
    const zones = [
      { id: 'zone_1', name: 'Dubai Downtown', nameAr: 'وسط دبي', emirate: 'Dubai', deliveryFee: 15, minimumOrder: 50, estimatedMinutes: 45, isActive: true, areas: ['Downtown', 'Business Bay', 'DIFC'] },
      { id: 'zone_2', name: 'Dubai Marina', nameAr: 'مرسى دبي', emirate: 'Dubai', deliveryFee: 20, minimumOrder: 75, estimatedMinutes: 60, isActive: true, areas: ['Marina', 'JBR', 'JLT'] },
      { id: 'zone_3', name: 'Abu Dhabi Central', nameAr: 'وسط أبوظبي', emirate: 'Abu Dhabi', deliveryFee: 25, minimumOrder: 100, estimatedMinutes: 90, isActive: true, areas: ['Corniche', 'Tourist Club', 'Hamdan Street'] },
      { id: 'zone_4', name: 'Sharjah', nameAr: 'الشارقة', emirate: 'Sharjah', deliveryFee: 30, minimumOrder: 100, estimatedMinutes: 75, isActive: true, areas: ['Al Majaz', 'Rolla', 'Industrial Area'] },
    ];
    res.json({ success: true, data: zones });
  });

  app.post('/api/delivery/zones', (req, res) => {
    const zone = { id: `zone_${Date.now()}`, ...req.body };
    res.json({ success: true, data: zone });
  });

  app.put('/api/delivery/zones/:id', (req, res) => {
    const zone = { id: req.params.id, ...req.body };
    res.json({ success: true, data: zone });
  });

  app.delete('/api/delivery/zones/:id', (req, res) => {
    res.json({ success: true, message: 'Zone deleted' });
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

  // =====================================================
  // REPORTS API
  // =====================================================

  app.get('/api/reports/sales', (req, res) => {
    const allOrders = Array.from(orders.values());
    const totalRevenue = allOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = allOrders.length;
    const totalVat = allOrders.reduce((sum, o) => sum + o.vatAmount, 0);
    const totalDiscount = allOrders.reduce((sum, o) => sum + o.discount, 0);
    
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
        topSellingProducts: demoProducts.slice(0, 5).map((p, i) => ({
          productId: p.id,
          productName: p.name,
          quantitySold: 50 - i * 5,
          revenue: (50 - i * 5) * p.price,
        })),
        revenueByDay: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          revenue: 1000 + Math.random() * 500,
          orders: 5 + Math.floor(Math.random() * 5),
        })),
      },
    });
  });

  app.get('/api/reports/sales-by-category', (req, res) => {
    res.json({
      success: true,
      data: [
        { category: 'Beef', totalSales: 4500, revenue: 4500, orders: 45, percentage: 40 },
        { category: 'Lamb', totalSales: 2800, revenue: 2800, orders: 28, percentage: 25 },
        { category: 'Chicken', totalSales: 2200, revenue: 2200, orders: 35, percentage: 20 },
        { category: 'Sheep', totalSales: 1700, revenue: 1700, orders: 12, percentage: 15 },
      ],
    });
  });

  app.get('/api/reports/sales-by-product', (req, res) => {
    res.json({
      success: true,
      data: demoProducts.map((p, i) => ({
        productId: p.id,
        productName: p.name,
        quantitySold: 50 - i * 5,
        revenue: (50 - i * 5) * p.price,
        category: p.category,
      })),
    });
  });

  app.get('/api/reports/customers', (req, res) => {
    res.json({
      success: true,
      data: {
        totalCustomers: 5,
        newCustomers: 2,
        returningCustomers: 3,
        customerRetentionRate: 75,
        averageOrdersPerCustomer: 3,
        topCustomers: Array.from(users.values())
          .filter(u => u.role === 'customer')
          .slice(0, 5)
          .map(u => ({
            userId: u.id,
            name: `${u.firstName} ${u.familyName}`,
            totalOrders: 3,
            totalSpent: 750,
          })),
      },
    });
  });

  app.get('/api/reports/inventory', (req, res) => {
    res.json({
      success: true,
      data: {
        totalProducts: demoProducts.length,
        inStock: demoProducts.length - 1,
        lowStock: 1,
        outOfStock: 0,
        totalValue: demoProducts.reduce((sum, p) => sum + p.price * 50, 0),
        categories: [
          { category: 'Beef', count: 3, value: 7500 },
          { category: 'Lamb', count: 1, value: 3725 },
          { category: 'Chicken', count: 1, value: 1750 },
          { category: 'Sheep', count: 1, value: 6250 },
        ],
      },
    });
  });

  app.get('/api/reports/orders', (req, res) => {
    const allOrders = Array.from(orders.values());
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
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const session = sessions.get(token);
    if (!session || new Date(session.expiresAt) < new Date()) {
      sessions.delete(token);
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    const user = users.get(session.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: sanitizeUser(user) });
  });

  // Catch all for unhandled routes
  app.all('*', (req, res) => {
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
