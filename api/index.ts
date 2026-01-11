import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';

// =====================================================
// INLINE DATABASE FOR VERCEL SERVERLESS
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
    username: "driver",
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
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }
      
      const user = Array.from(users.values()).find(
        u => u.username?.toLowerCase() === username.toLowerCase()
      );

      if (!user) {
        return res.status(401).json({ success: false, error: 'No account found with this username' });
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
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }

      const user = Array.from(users.values()).find(
        u => u.username?.toLowerCase() === username.toLowerCase() && u.role === 'admin'
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
      const { username, email, mobile, password, firstName, familyName, emirate, address, deliveryAddress } = req.body;
      
      if (!username || !email || !mobile || !password || !firstName || !familyName || !emirate) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      // Check username
      if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ success: false, error: 'Username must be at least 3 characters and contain only letters, numbers, and underscores' });
      }

      const existingUsername = Array.from(users.values()).find(
        u => u.username?.toLowerCase() === username.toLowerCase()
      );
      if (existingUsername) {
        return res.status(400).json({ success: false, error: 'Username already taken' });
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

  // Create new order
  app.post('/api/orders', (req, res) => {
    try {
      const { userId, items, addressId, deliveryAddress: providedAddress, paymentMethod, deliveryNotes, discountCode } = req.body;

      if (!userId || !items || !items.length || !paymentMethod) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: userId, items, paymentMethod' 
        });
      }

      // Get user - if not found in memory, create a temporary user from the request
      let user = users.get(userId);
      if (!user) {
        // For newly registered users that might not be in the serverless memory,
        // we'll still process the order if we have the delivery address
        if (!providedAddress) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        // Create a minimal user object for the order
        user = {
          id: userId,
          email: '',
          mobile: providedAddress.mobile || '',
          password: '',
          firstName: providedAddress.fullName?.split(' ')[0] || 'Customer',
          familyName: providedAddress.fullName?.split(' ').slice(1).join(' ') || '',
          role: 'customer' as const,
          isActive: true,
          isVerified: false,
          emirate: providedAddress.emirate || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          preferences: {
            language: 'en' as const,
            currency: 'AED' as const,
            emailNotifications: true,
            smsNotifications: true,
            marketingEmails: true,
          },
        };
      }

      // Get address - try from memory first, then use provided address as fallback
      let address = addresses.get(addressId);
      if (!address && providedAddress) {
        // Use the provided address data directly
        address = {
          id: addressId || `addr_${Date.now()}`,
          userId: userId,
          label: 'Home',
          fullName: providedAddress.fullName || `${user.firstName} ${user.familyName}`,
          mobile: providedAddress.mobile || user.mobile,
          emirate: providedAddress.emirate || '',
          area: providedAddress.area || '',
          street: providedAddress.street || '',
          building: providedAddress.building || '',
          floor: providedAddress.floor,
          apartment: providedAddress.apartment,
          latitude: providedAddress.latitude,
          longitude: providedAddress.longitude,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // Save it for future use
        addresses.set(address.id, address);
      }
      
      if (!address) {
        return res.status(404).json({ success: false, error: 'Address not found. Please provide delivery address.' });
      }

      // Calculate order items with prices from products
      const orderItems: Order['items'] = [];
      let subtotal = 0;

      for (const item of items) {
        const product = demoProducts.find(p => p.id === item.productId);
        if (!product) {
          return res.status(404).json({ success: false, error: `Product ${item.productId} not found` });
        }

        const totalPrice = product.price * item.quantity;
        orderItems.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          totalPrice,
        });
        subtotal += totalPrice;
      }

      // Calculate totals
      const discount = 0; // Apply discount code logic here if needed
      const deliveryFee = subtotal > 200 ? 0 : 15; // Free delivery over 200 AED
      const vatRate = 0.05; // 5% VAT
      const vatAmount = (subtotal - discount) * vatRate;
      const total = subtotal - discount + deliveryFee + vatAmount;

      // Generate order number
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const orderId = `order_${Date.now()}`;

      const newOrder: Order = {
        id: orderId,
        orderNumber,
        userId,
        customerName: `${user.firstName} ${user.familyName}`,
        customerEmail: user.email,
        customerMobile: user.mobile,
        items: orderItems,
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
          building: address.building,
          street: address.street,
          area: address.area,
          emirate: address.emirate,
          landmark: address.landmark,
        },
        deliveryNotes,
        statusHistory: [{
          status: 'pending',
          changedAt: new Date().toISOString(),
          changedBy: 'customer',
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      orders.set(orderId, newOrder);

      // Create payment record
      const paymentId = `pay_${Date.now()}`;
      const payment: Payment = {
        id: paymentId,
        orderId,
        orderNumber,
        amount: total,
        currency: 'AED',
        method: paymentMethod,
        status: paymentMethod === 'cod' ? 'pending' : 'completed',
        customerName: `${user.firstName} ${user.familyName}`,
        gatewayTransactionId: paymentMethod === 'cod' ? '' : `TXN-${Date.now()}`,
        refundedAmount: 0,
        refunds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      payments.set(paymentId, payment);

      res.status(201).json({
        success: true,
        data: newOrder,
        message: 'Order created successfully',
      });
    } catch (error) {
      console.error('[Create Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create order' });
    }
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
        { category: 'Goat', totalSales: 1700, revenue: 1700, orders: 12, percentage: 15 },
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
          { category: 'Goat', count: 1, value: 6250 },
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
