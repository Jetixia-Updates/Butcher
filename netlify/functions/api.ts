/**
 * Netlify Functions API Handler
 * 
 * This adapter converts Netlify Function requests to Express
 * Uses Neon PostgreSQL serverless driver
 */

import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import express from 'express';
import cors from 'cors';
import { neon, neonConfig } from '@neondatabase/serverless';
import serverless from 'serverless-http';
import bcrypt from 'bcryptjs';

// =====================================================
// NEON POSTGRESQL DATABASE CONNECTION
// =====================================================

// Configure Neon for serverless
neonConfig.fetchConnectionCache = true;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_GHrRQzwk9E4n@ep-hidden-paper-ajua0bg2-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

let sql: ReturnType<typeof neon> | null = null;

function initDatabase() {
  try {
    if (!sql) {
      console.log('[DB] Initializing Neon PostgreSQL connection');
      sql = neon(DATABASE_URL);
      console.log('[DB] Neon connection initialized');
    }
    return sql;
  } catch (err) {
    console.error('[DB] Failed to initialize:', err);
    return null;
  }
}

initDatabase();

// =====================================================
// HELPERS
// =====================================================

const isDatabaseAvailable = () => !!sql;
const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

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

function sanitizeUser(user: User): Omit<User, 'password'> {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

const safeDate = (d: any) => {
  if (!d) return new Date().toISOString();
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

// =====================================================
// EXPRESS APP
// =====================================================

let app: express.Express | null = null;

function createApp() {
  if (app) return app;

  app = express();
  app.use(cors());
  
  // Parse JSON body - serverless-http passes body as a string, not as a stream
  app.use((req, res, next) => {
    // If body is a JSON string, parse it
    if (req.body && typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        // Not JSON, leave as string
      }
      return next();
    }
    
    // If body is already a proper object, use it
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !(req.body.type === 'Buffer')) {
      return next();
    }
    
    // Handle Buffer body from serverless-http
    if (req.body && typeof req.body === 'object' && req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
      const str = Buffer.from(req.body.data).toString('utf8');
      try {
        req.body = JSON.parse(str);
        return next();
      } catch (e) {
        // Continue to express.json
      }
    }
    
    // Fallback to express.json for stream bodies
    express.json({ limit: '50mb' })(req, res, next);
  });
  
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', async (req, res) => {
    const dbConfigured = isDatabaseAvailable();
    let dbTest = false;

    if (dbConfigured && sql) {
      try {
        await sql`SELECT 1 as test`;
        dbTest = true;
      } catch (e) {
        console.error('[Health Check DB Error]', e);
      }
    }

    res.json({
      success: true,
      data: {
        status: 'ok',
        platform: 'netlify',
        database: 'neon-postgresql',
        timestamp: new Date().toISOString(),
        connection: { configured: dbConfigured, connected: dbTest },
      },
    });
  });

  // Ping
  app.get('/api/ping', (req, res) => {
    res.json({ message: 'pong', platform: 'netlify', database: 'neon', timestamp: new Date().toISOString() });
  });

  // Debug endpoint
  app.post('/api/debug', (req, res) => {
    res.json({
      bodyType: typeof req.body,
      body: req.body,
      headers: req.headers,
      rawBody: (req as any).rawBody,
    });
  });

  // Login
  app.post('/api/users/login', async (req, res) => {
    try {
      console.log('[Login] Raw body type:', typeof req.body);
      console.log('[Login] Body:', JSON.stringify(req.body));
      console.log('[Login] Headers:', JSON.stringify(req.headers));
      
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }

      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT * FROM users 
        WHERE username = ${username} OR email = ${username} 
        LIMIT 1
      `;

      if (rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const dbUser = rows[0];
      
      if (!dbUser.is_active) {
        return res.status(401).json({ success: false, error: 'Account is deactivated' });
      }

      // Compare password using bcrypt (supports both hashed and plain text)
      const isValidPassword = dbUser.password.startsWith('$2') 
        ? await bcrypt.compare(password, dbUser.password)
        : dbUser.password === password;
      
      if (!isValidPassword) {
        return res.status(401).json({ success: false, error: 'Incorrect password' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const sessionId = `session_${Date.now()}`;

      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at, created_at) 
        VALUES (${sessionId}, ${dbUser.id}, ${token}, ${expiresAt}, ${new Date()})
      `;

      const user: User = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        mobile: dbUser.mobile,
        password: dbUser.password,
        firstName: dbUser.first_name,
        familyName: dbUser.family_name,
        role: dbUser.role as User['role'],
        isActive: dbUser.is_active ?? true,
        isVerified: dbUser.is_verified ?? false,
        emirate: dbUser.emirate || '',
        createdAt: safeDate(dbUser.created_at),
        updatedAt: safeDate(dbUser.updated_at),
        lastLoginAt: safeDate(dbUser.last_login_at),
        preferences: dbUser.preferences || {
          language: 'en',
          currency: 'AED',
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
      };

      res.json({
        success: true,
        data: { user: sanitizeUser(user), token, expiresAt: expiresAt.toISOString() },
        message: 'Login successful',
      });
    } catch (error) {
      console.error('[Login Error]', error);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  });

  // Admin Login
  app.post('/api/users/admin-login', async (req, res) => {
    try {
      console.log('[Admin Login] Raw body type:', typeof req.body);
      console.log('[Admin Login] Body:', JSON.stringify(req.body));
      
      let { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }

      username = username.trim();
      password = password.trim();

      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT * FROM users 
        WHERE (username = ${username} OR email = ${username}) 
          AND role IN ('admin', 'staff', 'delivery') 
        LIMIT 1
      `;

      if (rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid staff credentials' });
      }

      const dbUser = rows[0];
      
      if (!dbUser.is_active) {
        return res.status(401).json({ success: false, error: 'Account is deactivated' });
      }

      // Compare password using bcrypt (supports both hashed and plain text)
      const isValidPassword = dbUser.password.startsWith('$2') 
        ? await bcrypt.compare(password, dbUser.password)
        : dbUser.password === password;
      
      if (!isValidPassword) {
        return res.status(401).json({ success: false, error: 'Invalid staff credentials' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const sessionId = `session_${Date.now()}`;

      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at, created_at) 
        VALUES (${sessionId}, ${dbUser.id}, ${token}, ${expiresAt}, ${new Date()})
      `;

      const user: User = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        mobile: dbUser.mobile,
        password: dbUser.password,
        firstName: dbUser.first_name,
        familyName: dbUser.family_name,
        role: dbUser.role as User['role'],
        isActive: dbUser.is_active ?? true,
        isVerified: dbUser.is_verified ?? false,
        emirate: dbUser.emirate || '',
        createdAt: safeDate(dbUser.created_at),
        updatedAt: safeDate(dbUser.updated_at),
        lastLoginAt: safeDate(dbUser.last_login_at),
        preferences: dbUser.preferences || {
          language: 'en',
          currency: 'AED',
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: false,
        },
      };

      res.json({
        success: true,
        data: { user: sanitizeUser(user), token, expiresAt: expiresAt.toISOString() },
        message: 'Admin login successful',
      });
    } catch (error) {
      console.error('[Admin Login Error]', error);
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  });

  // Products
  app.get('/api/products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      let rows = await sql`SELECT * FROM products WHERE is_active = true`;

      const { category, search, featured } = req.query;

      if (category && category !== 'all') {
        rows = rows.filter((p: any) => p.category.toLowerCase() === (category as string).toLowerCase());
      }

      if (search) {
        const q = (search as string).toLowerCase();
        rows = rows.filter((p: any) =>
          p.name.toLowerCase().includes(q) ||
          (p.name_ar && p.name_ar.toLowerCase().includes(q))
        );
      }

      if (featured === 'true') {
        rows = rows.filter((p: any) => p.is_featured);
      }

      const products = rows.map((p: any) => {
        // Parse JSON strings for tags and badges
        let tags = p.tags || [];
        let badges = p.badges || [];
        if (typeof tags === 'string') {
          try { tags = JSON.parse(tags); } catch { tags = []; }
        }
        if (typeof badges === 'string') {
          try { badges = JSON.parse(badges); } catch { badges = []; }
        }
        
        return {
          id: p.id,
          name: p.name,
          nameAr: p.name_ar,
          sku: p.sku,
          price: parseFloat(String(p.price || '0')),
          costPrice: parseFloat(String(p.cost_price || '0')),
          discount: parseFloat(String(p.discount || '0')),
          category: p.category,
          description: p.description,
          descriptionAr: p.description_ar,
          image: p.image,
          unit: p.unit,
          minOrderQuantity: parseFloat(String(p.min_order_quantity || '0.25')),
          maxOrderQuantity: parseFloat(String(p.max_order_quantity || '10')),
          isActive: p.is_active,
          isFeatured: p.is_featured,
          isPremium: p.is_premium,
          rating: parseFloat(String(p.rating || '0')),
          tags: Array.isArray(tags) ? tags : [],
          badges: Array.isArray(badges) ? badges : [],
          createdAt: safeDate(p.created_at),
          updatedAt: safeDate(p.updated_at),
        };
      });

      res.json({ success: true, data: products });
    } catch (error: any) {
      console.error('[Products Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
  });

  // Categories
  app.get('/api/categories', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM product_categories ORDER BY sort_order`;
      
      const categories = rows.map((c: any) => ({
        id: c.id,
        nameEn: c.name_en,
        nameAr: c.name_ar,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sort_order,
        isActive: c.is_active,
        createdAt: safeDate(c.created_at),
        updatedAt: safeDate(c.updated_at),
      }));

      res.json({ success: true, data: categories });
    } catch (error) {
      console.error('[Categories Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
  });

  // Settings
  app.get('/api/settings', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM app_settings LIMIT 1`;
      
      if (rows.length === 0) {
        return res.json({ success: true, data: {} });
      }

      const s = rows[0];
      const settings = {
        vatRate: parseFloat(String(s.vat_rate || '0.05')),
        deliveryFee: parseFloat(String(s.delivery_fee || '15')),
        freeDeliveryThreshold: parseFloat(String(s.free_delivery_threshold || '200')),
        expressDeliveryFee: parseFloat(String(s.express_delivery_fee || '25')),
        minimumOrderAmount: parseFloat(String(s.minimum_order_amount || '50')),
        enableCashOnDelivery: s.enable_cash_on_delivery ?? true,
        enableCardPayment: s.enable_card_payment ?? true,
        enableWallet: s.enable_wallet ?? true,
        enableLoyalty: s.enable_loyalty ?? true,
        enableReviews: s.enable_reviews ?? true,
        enableWishlist: s.enable_wishlist ?? true,
        enableExpressDelivery: s.enable_express_delivery ?? true,
        enableScheduledDelivery: s.enable_scheduled_delivery ?? true,
        storePhone: s.store_phone || '+971 4 123 4567',
        storeEmail: s.store_email || 'support@aljazirabutcher.ae',
        storeAddress: s.store_address || 'Dubai, UAE',
        storeAddressAr: s.store_address_ar || 'دبي، الإمارات',
        workingHoursStart: s.working_hours_start || '08:00',
        workingHoursEnd: s.working_hours_end || '22:00',
      };

      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('[Settings Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
  });

  // Banners
  app.get('/api/banners', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM banners WHERE enabled = true ORDER BY sort_order`;
      
      const banners = rows.map((b: any) => ({
        id: b.id,
        titleEn: b.title_en,
        titleAr: b.title_ar,
        subtitleEn: b.subtitle_en,
        subtitleAr: b.subtitle_ar,
        image: b.image,
        bgColor: b.bg_color,
        link: b.link,
        badge: b.badge,
        badgeAr: b.badge_ar,
        enabled: b.enabled,
        sortOrder: b.sort_order,
      }));

      res.json({ success: true, data: banners });
    } catch (error) {
      console.error('[Banners Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch banners' });
    }
  });

  // Delivery Zones
  app.get('/api/delivery-zones', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM delivery_zones WHERE is_active = true`;
      
      const zones = rows.map((z: any) => ({
        id: z.id,
        name: z.name,
        nameAr: z.name_ar,
        emirate: z.emirate,
        areas: z.areas || [],
        deliveryFee: parseFloat(String(z.delivery_fee || '0')),
        minimumOrder: parseFloat(String(z.minimum_order || '0')),
        estimatedMinutes: z.estimated_minutes,
        isActive: z.is_active,
        expressEnabled: z.express_enabled,
        expressFee: parseFloat(String(z.express_fee || '25')),
        expressHours: z.express_hours,
      }));

      res.json({ success: true, data: zones });
    } catch (error) {
      console.error('[Delivery Zones Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch delivery zones' });
    }
  });

  // Delivery Time Slots
  app.get('/api/delivery-time-slots', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM delivery_time_slots WHERE enabled = true ORDER BY sort_order`;
      
      const slots = rows.map((s: any) => ({
        id: s.id,
        label: s.label,
        labelAr: s.label_ar,
        startTime: s.start_time,
        endTime: s.end_time,
        isExpressSlot: s.is_express_slot,
        maxOrders: s.max_orders,
        enabled: s.enabled,
        sortOrder: s.sort_order,
      }));

      res.json({ success: true, data: slots });
    } catch (error) {
      console.error('[Delivery Time Slots Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch delivery time slots' });
    }
  });

  // Loyalty Tiers
  app.get('/api/loyalty-tiers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM loyalty_tiers ORDER BY sort_order`;
      
      const tiers = rows.map((t: any) => ({
        id: t.id,
        name: t.name,
        nameAr: t.name_ar,
        minPoints: t.min_points,
        multiplier: parseFloat(String(t.multiplier || '1')),
        benefits: t.benefits || [],
        benefitsAr: t.benefits_ar || [],
        icon: t.icon,
        sortOrder: t.sort_order,
      }));

      res.json({ success: true, data: tiers });
    } catch (error) {
      console.error('[Loyalty Tiers Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch loyalty tiers' });
    }
  });

  // User Registration
  app.post('/api/users/register', async (req, res) => {
    try {
      const { email, password, firstName, familyName, mobile, username } = req.body;

      if (!email || !password || !firstName || !familyName || !mobile) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Check if user exists
      const existing = await sql`
        SELECT id FROM users WHERE email = ${email} OR mobile = ${mobile}
      `;

      if (existing.length > 0) {
        return res.status(400).json({ success: false, error: 'User with this email or mobile already exists' });
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const finalUsername = username || email.split('@')[0];
      const now = new Date();

      await sql`
        INSERT INTO users (id, username, email, mobile, password, first_name, family_name, role, is_active, is_verified, created_at, updated_at)
        VALUES (${userId}, ${finalUsername}, ${email}, ${mobile}, ${password}, ${firstName}, ${familyName}, 'customer', true, false, ${now}, ${now})
      `;

      // Create wallet for user
      await sql`
        INSERT INTO wallets (id, user_id, balance, created_at, updated_at)
        VALUES (${`wallet_${userId}`}, ${userId}, 0, ${now}, ${now})
      `;

      // Create loyalty points for user
      const referralCode = `REF${userId.slice(-8).toUpperCase()}`;
      await sql`
        INSERT INTO loyalty_points (id, user_id, points, total_earned, referral_code, created_at, updated_at)
        VALUES (${`loyalty_${userId}`}, ${userId}, 0, 0, ${referralCode}, ${now}, ${now})
      `;

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await sql`
        INSERT INTO sessions (id, user_id, token, expires_at, created_at)
        VALUES (${`session_${Date.now()}`}, ${userId}, ${token}, ${expiresAt}, ${now})
      `;

      res.json({
        success: true,
        data: {
          user: {
            id: userId,
            username: finalUsername,
            email,
            mobile,
            firstName,
            familyName,
            role: 'customer',
            isActive: true,
            isVerified: false,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          token,
          expiresAt: expiresAt.toISOString(),
        },
        message: 'Registration successful',
      });
    } catch (error) {
      console.error('[Registration Error]', error);
      res.status(500).json({ success: false, error: 'Registration failed' });
    }
  });

  // Get User Profile
  app.get('/api/users/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const token = authHeader.substring(7);

      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const sessions = await sql`
        SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > ${new Date()}
      `;

      if (sessions.length === 0) {
        return res.status(401).json({ success: false, error: 'Session expired' });
      }

      const users = await sql`SELECT * FROM users WHERE id = ${sessions[0].user_id}`;

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const dbUser = users[0];
      const user: User = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        mobile: dbUser.mobile,
        password: dbUser.password,
        firstName: dbUser.first_name,
        familyName: dbUser.family_name,
        role: dbUser.role as User['role'],
        isActive: dbUser.is_active ?? true,
        isVerified: dbUser.is_verified ?? false,
        emirate: dbUser.emirate || '',
        createdAt: safeDate(dbUser.created_at),
        updatedAt: safeDate(dbUser.updated_at),
        lastLoginAt: safeDate(dbUser.last_login_at),
        preferences: dbUser.preferences || {
          language: 'en',
          currency: 'AED',
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
      };

      res.json({ success: true, data: sanitizeUser(user) });
    } catch (error) {
      console.error('[Get User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get user' });
    }
  });

  // Logout
  app.post('/api/users/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        if (isDatabaseAvailable() && sql) {
          await sql`DELETE FROM sessions WHERE token = ${token}`;
        }
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('[Logout Error]', error);
      res.json({ success: true, message: 'Logged out' });
    }
  });

  // =====================================================
  // ORDERS API
  // =====================================================

  // Get Orders (by userId or all for admin)
  app.get('/api/orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, status } = req.query;
      
      let rows;
      if (userId) {
        rows = await sql`SELECT * FROM orders WHERE user_id = ${userId as string} ORDER BY created_at DESC`;
      } else {
        rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      }

      if (status && status !== 'all') {
        rows = rows.filter((o: any) => o.status === status);
      }

      // Get order items for each order
      const orders = await Promise.all(rows.map(async (o: any) => {
        const items = await sql`SELECT * FROM order_items WHERE order_id = ${o.id}`;
        
        return {
          id: o.id,
          userId: o.user_id,
          status: o.status,
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          subtotal: parseFloat(String(o.subtotal || '0')),
          vat: parseFloat(String(o.vat || '0')),
          deliveryFee: parseFloat(String(o.delivery_fee || '0')),
          discount: parseFloat(String(o.discount || '0')),
          total: parseFloat(String(o.total || '0')),
          deliveryAddress: o.delivery_address,
          deliveryDate: o.delivery_date,
          deliverySlot: o.delivery_slot,
          specialInstructions: o.special_instructions,
          items: items.map((i: any) => ({
            id: i.id,
            productId: i.product_id,
            productName: i.product_name,
            productNameAr: i.product_name_ar,
            quantity: parseFloat(String(i.quantity || '0')),
            unit: i.unit,
            price: parseFloat(String(i.price || '0')),
            total: parseFloat(String(i.total || '0')),
          })),
          createdAt: safeDate(o.created_at),
          updatedAt: safeDate(o.updated_at),
        };
      }));

      res.json({ success: true, data: orders });
    } catch (error) {
      console.error('[Orders Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
  });

  // Get Single Order
  app.get('/api/orders/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const o = rows[0];
      const items = await sql`SELECT * FROM order_items WHERE order_id = ${o.id}`;

      const order = {
        id: o.id,
        userId: o.user_id,
        status: o.status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        subtotal: parseFloat(String(o.subtotal || '0')),
        vat: parseFloat(String(o.vat || '0')),
        deliveryFee: parseFloat(String(o.delivery_fee || '0')),
        discount: parseFloat(String(o.discount || '0')),
        total: parseFloat(String(o.total || '0')),
        deliveryAddress: o.delivery_address,
        deliveryDate: o.delivery_date,
        deliverySlot: o.delivery_slot,
        specialInstructions: o.special_instructions,
        items: items.map((i: any) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productNameAr: i.product_name_ar,
          quantity: parseFloat(String(i.quantity || '0')),
          unit: i.unit,
          price: parseFloat(String(i.price || '0')),
          total: parseFloat(String(i.total || '0')),
        })),
        createdAt: safeDate(o.created_at),
        updatedAt: safeDate(o.updated_at),
      };

      res.json({ success: true, data: order });
    } catch (error) {
      console.error('[Get Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
  });

  // Create Order
  app.post('/api/orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, items, deliveryAddress, deliveryDate, deliverySlot, paymentMethod, specialInstructions, subtotal, vat, deliveryFee, discount, total } = req.body;

      if (!userId || !items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      await sql`
        INSERT INTO orders (id, user_id, status, payment_status, payment_method, subtotal, vat, delivery_fee, discount, total, delivery_address, delivery_date, delivery_slot, special_instructions, created_at, updated_at)
        VALUES (${orderId}, ${userId}, 'pending', 'pending', ${paymentMethod || 'cash'}, ${subtotal || 0}, ${vat || 0}, ${deliveryFee || 0}, ${discount || 0}, ${total || 0}, ${deliveryAddress || null}, ${deliveryDate || null}, ${deliverySlot || null}, ${specialInstructions || null}, ${now}, ${now})
      `;

      // Insert order items
      for (const item of items) {
        const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        await sql`
          INSERT INTO order_items (id, order_id, product_id, product_name, product_name_ar, quantity, unit, price, total, created_at)
          VALUES (${itemId}, ${orderId}, ${item.productId}, ${item.productName}, ${item.productNameAr || null}, ${item.quantity}, ${item.unit || 'kg'}, ${item.price}, ${item.total || item.price * item.quantity}, ${now})
        `;
      }

      res.json({
        success: true,
        data: { id: orderId, status: 'pending', createdAt: now.toISOString() },
        message: 'Order created successfully',
      });
    } catch (error) {
      console.error('[Create Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create order' });
    }
  });

  // Update Order Status
  app.put('/api/orders/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { status, paymentStatus } = req.body;
      const now = new Date();

      if (status) {
        await sql`UPDATE orders SET status = ${status}, updated_at = ${now} WHERE id = ${id}`;
      }
      if (paymentStatus) {
        await sql`UPDATE orders SET payment_status = ${paymentStatus}, updated_at = ${now} WHERE id = ${id}`;
      }

      res.json({ success: true, message: 'Order updated successfully' });
    } catch (error) {
      console.error('[Update Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update order' });
    }
  });

  // =====================================================
  // NOTIFICATIONS API
  // =====================================================

  // Get Notifications
  app.get('/api/notifications', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, unreadOnly } = req.query;
      
      let rows;
      if (userId) {
        rows = await sql`SELECT * FROM notifications WHERE user_id = ${userId as string} ORDER BY created_at DESC LIMIT 100`;
      } else {
        rows = await sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100`;
      }

      if (unreadOnly === 'true') {
        rows = rows.filter((n: any) => !n.is_read);
      }

      const notifications = rows.map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        titleAr: n.title_ar,
        message: n.message,
        messageAr: n.message_ar,
        data: n.data || {},
        isRead: n.is_read ?? false,
        createdAt: safeDate(n.created_at),
      }));

      res.json({ success: true, data: notifications });
    } catch (error) {
      console.error('[Notifications Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  });

  // Mark Notification as Read
  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`UPDATE notifications SET is_read = true WHERE id = ${id}`;

      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      console.error('[Mark Notification Read Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
  });

  // Mark All Notifications as Read
  app.put('/api/notifications/read-all', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.body;
      if (userId) {
        await sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId}`;
      }

      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      console.error('[Mark All Notifications Read Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
    }
  });

  // =====================================================
  // WALLET API
  // =====================================================

  // Get Wallet
  app.get('/api/wallet', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Get user from auth header
      const authHeader = req.headers.authorization;
      let userId = req.query.userId as string;

      if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const sessions = await sql`SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > ${new Date()}`;
        if (sessions.length > 0) {
          userId = sessions[0].user_id;
        }
      }

      if (!userId) {
        return res.json({ success: true, data: { balance: 0, transactions: [] } });
      }

      const wallets = await sql`SELECT * FROM wallets WHERE user_id = ${userId}`;
      
      if (wallets.length === 0) {
        return res.json({ success: true, data: { balance: 0, transactions: [] } });
      }

      const wallet = wallets[0];
      const transactions = await sql`SELECT * FROM wallet_transactions WHERE wallet_id = ${wallet.id} ORDER BY created_at DESC LIMIT 50`;

      res.json({
        success: true,
        data: {
          id: wallet.id,
          userId: wallet.user_id,
          balance: parseFloat(String(wallet.balance || '0')),
          transactions: transactions.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: parseFloat(String(t.amount || '0')),
            description: t.description,
            orderId: t.order_id,
            createdAt: safeDate(t.created_at),
          })),
        },
      });
    } catch (error) {
      console.error('[Wallet Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch wallet' });
    }
  });

  // Add Funds to Wallet
  app.post('/api/wallet/add-funds', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, amount, description } = req.body;

      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid request' });
      }

      const wallets = await sql`SELECT * FROM wallets WHERE user_id = ${userId}`;
      
      if (wallets.length === 0) {
        return res.status(404).json({ success: false, error: 'Wallet not found' });
      }

      const wallet = wallets[0];
      const newBalance = parseFloat(String(wallet.balance || '0')) + amount;
      const now = new Date();

      await sql`UPDATE wallets SET balance = ${newBalance}, updated_at = ${now} WHERE id = ${wallet.id}`;

      const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      await sql`
        INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, created_at)
        VALUES (${txId}, ${wallet.id}, 'credit', ${amount}, ${description || 'Funds added'}, ${now})
      `;

      res.json({ success: true, data: { balance: newBalance }, message: 'Funds added successfully' });
    } catch (error) {
      console.error('[Add Funds Error]', error);
      res.status(500).json({ success: false, error: 'Failed to add funds' });
    }
  });

  // =====================================================
  // CHAT API
  // =====================================================

  // Get Chat Messages
  app.get('/api/chat/:userId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.params;
      const rows = await sql`SELECT * FROM chat_messages WHERE user_id = ${userId} ORDER BY created_at ASC`;

      const messages = rows.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        sender: m.sender,
        message: m.message,
        isRead: m.is_read ?? false,
        createdAt: safeDate(m.created_at),
      }));

      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('[Chat Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chat messages' });
    }
  });

  // Send Chat Message
  app.post('/api/chat/:userId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.params;
      const { message, sender } = req.body;

      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      await sql`
        INSERT INTO chat_messages (id, user_id, sender, message, is_read, created_at)
        VALUES (${msgId}, ${userId}, ${sender || 'user'}, ${message}, false, ${now})
      `;

      res.json({
        success: true,
        data: { id: msgId, userId, sender: sender || 'user', message, isRead: false, createdAt: now.toISOString() },
        message: 'Message sent successfully',
      });
    } catch (error) {
      console.error('[Send Chat Error]', error);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });

  // =====================================================
  // WISHLIST API
  // =====================================================

  // Get Wishlist
  app.get('/api/wishlist', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.query;
      if (!userId) {
        return res.json({ success: true, data: [] });
      }

      const rows = await sql`SELECT * FROM wishlist WHERE user_id = ${userId as string}`;
      
      const wishlist = rows.map((w: any) => ({
        id: w.id,
        userId: w.user_id,
        productId: w.product_id,
        createdAt: safeDate(w.created_at),
      }));

      res.json({ success: true, data: wishlist });
    } catch (error) {
      console.error('[Wishlist Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch wishlist' });
    }
  });

  // Add to Wishlist
  app.post('/api/wishlist', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, productId } = req.body;

      if (!userId || !productId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Check if already in wishlist
      const existing = await sql`SELECT id FROM wishlist WHERE user_id = ${userId} AND product_id = ${productId}`;
      if (existing.length > 0) {
        return res.json({ success: true, message: 'Already in wishlist' });
      }

      const wishlistId = `wish_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      await sql`
        INSERT INTO wishlist (id, user_id, product_id, created_at)
        VALUES (${wishlistId}, ${userId}, ${productId}, ${now})
      `;

      res.json({ success: true, data: { id: wishlistId }, message: 'Added to wishlist' });
    } catch (error) {
      console.error('[Add Wishlist Error]', error);
      res.status(500).json({ success: false, error: 'Failed to add to wishlist' });
    }
  });

  // Remove from Wishlist
  app.delete('/api/wishlist/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM wishlist WHERE id = ${id}`;

      res.json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
      console.error('[Remove Wishlist Error]', error);
      res.status(500).json({ success: false, error: 'Failed to remove from wishlist' });
    }
  });

  // =====================================================
  // REVIEWS API
  // =====================================================

  // Get Product Reviews
  app.get('/api/reviews', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId } = req.query;
      
      let rows;
      if (productId) {
        rows = await sql`SELECT * FROM product_reviews WHERE product_id = ${productId as string} AND is_approved = true ORDER BY created_at DESC`;
      } else {
        rows = await sql`SELECT * FROM product_reviews ORDER BY created_at DESC`;
      }

      const reviews = rows.map((r: any) => ({
        id: r.id,
        productId: r.product_id,
        userId: r.user_id,
        userName: r.user_name,
        rating: r.rating,
        comment: r.comment,
        isApproved: r.is_approved,
        createdAt: safeDate(r.created_at),
      }));

      res.json({ success: true, data: reviews });
    } catch (error) {
      console.error('[Reviews Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
    }
  });

  // Add Review
  app.post('/api/reviews', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId, userId, userName, rating, comment } = req.body;

      if (!productId || !userId || !rating) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      await sql`
        INSERT INTO product_reviews (id, product_id, user_id, user_name, rating, comment, is_approved, created_at)
        VALUES (${reviewId}, ${productId}, ${userId}, ${userName || 'Anonymous'}, ${rating}, ${comment || ''}, false, ${now})
      `;

      res.json({ success: true, data: { id: reviewId }, message: 'Review submitted for approval' });
    } catch (error) {
      console.error('[Add Review Error]', error);
      res.status(500).json({ success: false, error: 'Failed to add review' });
    }
  });

  // =====================================================
  // LOYALTY POINTS API
  // =====================================================

  // Get User Loyalty Points
  app.get('/api/loyalty', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.query;
      if (!userId) {
        return res.json({ success: true, data: { points: 0, totalEarned: 0, tier: 'Bronze' } });
      }

      const rows = await sql`SELECT * FROM loyalty_points WHERE user_id = ${userId as string}`;
      
      if (rows.length === 0) {
        return res.json({ success: true, data: { points: 0, totalEarned: 0, tier: 'Bronze' } });
      }

      const loyalty = rows[0];
      const transactions = await sql`SELECT * FROM loyalty_transactions WHERE loyalty_id = ${loyalty.id} ORDER BY created_at DESC LIMIT 50`;

      res.json({
        success: true,
        data: {
          id: loyalty.id,
          userId: loyalty.user_id,
          points: loyalty.points || 0,
          totalEarned: loyalty.total_earned || 0,
          tier: loyalty.tier || 'Bronze',
          referralCode: loyalty.referral_code,
          transactions: transactions.map((t: any) => ({
            id: t.id,
            type: t.type,
            points: t.points,
            description: t.description,
            orderId: t.order_id,
            createdAt: safeDate(t.created_at),
          })),
        },
      });
    } catch (error) {
      console.error('[Loyalty Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch loyalty points' });
    }
  });

  // =====================================================
  // ADDRESSES API
  // =====================================================

  // Helper to get user ID from headers (frontend sends via x-user-id or x-customer-id)
  const getUserIdFromHeaders = (req: any): string | null => {
    return (req.headers['x-user-id'] || req.headers['x-customer-id'] || null) as string | null;
  };

  // Get User Addresses
  app.get('/api/addresses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Get userId from query param or header
      let userId = req.query.userId as string || getUserIdFromHeaders(req);
      if (!userId) {
        return res.json({ success: true, data: [] });
      }

      const rows = await sql`SELECT * FROM addresses WHERE user_id = ${userId}`;
      
      const addresses = rows.map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        label: a.label,
        fullName: a.full_name,
        mobile: a.mobile,
        emirate: a.emirate,
        area: a.area,
        street: a.street,
        building: a.building,
        floor: a.floor,
        apartment: a.apartment,
        landmark: a.landmark,
        latitude: a.latitude ? parseFloat(String(a.latitude)) : null,
        longitude: a.longitude ? parseFloat(String(a.longitude)) : null,
        instructions: a.instructions,
        isDefault: a.is_default ?? false,
        createdAt: safeDate(a.created_at),
        updatedAt: safeDate(a.updated_at),
      }));

      res.json({ success: true, data: addresses });
    } catch (error) {
      console.error('[Addresses Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch addresses' });
    }
  });

  // Add Address
  app.post('/api/addresses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Get userId from header (frontend sends via x-user-id or x-customer-id)
      const userId = getUserIdFromHeaders(req) || req.body.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, instructions, isDefault } = req.body;

      // Validate required fields
      if (!label || !fullName || !mobile || !emirate || !area || !street || !building) {
        const missing = [];
        if (!label) missing.push('label');
        if (!fullName) missing.push('fullName');
        if (!mobile) missing.push('mobile');
        if (!emirate) missing.push('emirate');
        if (!area) missing.push('area');
        if (!street) missing.push('street');
        if (!building) missing.push('building');
        return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
      }

      const addressId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      // Check if user has any addresses
      const existingAddresses = await sql`SELECT id FROM addresses WHERE user_id = ${userId}`;
      const shouldBeDefault = isDefault || existingAddresses.length === 0;

      // If this is default, unset other defaults
      if (shouldBeDefault) {
        await sql`UPDATE addresses SET is_default = false WHERE user_id = ${userId}`;
      }

      await sql`
        INSERT INTO addresses (id, user_id, label, full_name, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, instructions, is_default, created_at, updated_at)
        VALUES (${addressId}, ${userId}, ${label}, ${fullName}, ${mobile}, ${emirate}, ${area}, ${street}, ${building}, ${floor || null}, ${apartment || null}, ${landmark || null}, ${latitude || null}, ${longitude || null}, ${instructions || null}, ${shouldBeDefault}, ${now}, ${now})
      `;

      // Return the created address
      const newAddress = {
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
        instructions: instructions || null,
        isDefault: shouldBeDefault,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      res.json({ success: true, data: newAddress });
    } catch (error) {
      console.error('[Add Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to add address' });
    }
  });

  // Update Address
  app.put('/api/addresses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req) || req.body.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { id } = req.params;
      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, instructions, isDefault } = req.body;
      const now = new Date();

      // Verify ownership
      const existing = await sql`SELECT id FROM addresses WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      // If this is default, unset other defaults
      if (isDefault) {
        await sql`UPDATE addresses SET is_default = false WHERE user_id = ${userId}`;
      }

      await sql`
        UPDATE addresses SET 
          label = COALESCE(${label}, label),
          full_name = COALESCE(${fullName}, full_name),
          mobile = COALESCE(${mobile}, mobile),
          emirate = COALESCE(${emirate}, emirate),
          area = COALESCE(${area}, area),
          street = COALESCE(${street}, street),
          building = COALESCE(${building}, building),
          floor = COALESCE(${floor}, floor),
          apartment = COALESCE(${apartment}, apartment),
          landmark = COALESCE(${landmark}, landmark),
          latitude = COALESCE(${latitude}, latitude),
          longitude = COALESCE(${longitude}, longitude),
          instructions = COALESCE(${instructions}, instructions),
          is_default = COALESCE(${isDefault}, is_default),
          updated_at = ${now}
        WHERE id = ${id}
      `;

      // Fetch and return updated address
      const updated = await sql`SELECT * FROM addresses WHERE id = ${id}`;
      if (updated.length > 0) {
        const a = updated[0];
        res.json({
          success: true,
          data: {
            id: a.id,
            userId: a.user_id,
            label: a.label,
            fullName: a.full_name,
            mobile: a.mobile,
            emirate: a.emirate,
            area: a.area,
            street: a.street,
            building: a.building,
            floor: a.floor,
            apartment: a.apartment,
            landmark: a.landmark,
            latitude: a.latitude ? parseFloat(String(a.latitude)) : null,
            longitude: a.longitude ? parseFloat(String(a.longitude)) : null,
            instructions: a.instructions,
            isDefault: a.is_default ?? false,
            createdAt: safeDate(a.created_at),
            updatedAt: safeDate(a.updated_at),
          },
        });
      } else {
        res.json({ success: true, message: 'Address updated successfully' });
      }
    } catch (error) {
      console.error('[Update Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update address' });
    }
  });

  // Set Address as Default
  app.put('/api/addresses/:id/default', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { id } = req.params;

      // Verify ownership
      const existing = await sql`SELECT id FROM addresses WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      // Unset all defaults for user
      await sql`UPDATE addresses SET is_default = false WHERE user_id = ${userId}`;

      // Set this address as default
      await sql`UPDATE addresses SET is_default = true, updated_at = ${new Date()} WHERE id = ${id}`;

      // Return updated address
      const updated = await sql`SELECT * FROM addresses WHERE id = ${id}`;
      if (updated.length > 0) {
        const a = updated[0];
        res.json({
          success: true,
          data: {
            id: a.id,
            userId: a.user_id,
            label: a.label,
            fullName: a.full_name,
            mobile: a.mobile,
            emirate: a.emirate,
            area: a.area,
            street: a.street,
            building: a.building,
            floor: a.floor,
            apartment: a.apartment,
            landmark: a.landmark,
            latitude: a.latitude ? parseFloat(String(a.latitude)) : null,
            longitude: a.longitude ? parseFloat(String(a.longitude)) : null,
            instructions: a.instructions,
            isDefault: true,
            createdAt: safeDate(a.created_at),
            updatedAt: safeDate(a.updated_at),
          },
        });
      } else {
        res.json({ success: true, message: 'Address set as default' });
      }
    } catch (error) {
      console.error('[Set Default Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to set default address' });
    }
  });

  // Delete Address
  app.delete('/api/addresses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { id } = req.params;

      // Verify ownership
      const existing = await sql`SELECT id FROM addresses WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Address not found' });
      }

      await sql`DELETE FROM addresses WHERE id = ${id}`;

      res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
      console.error('[Delete Address Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete address' });
    }
  });

  // =====================================================
  // DISCOUNT CODES API
  // =====================================================

  // Validate Discount Code
  app.post('/api/discount-codes/validate', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { code, subtotal } = req.body;

      if (!code) {
        return res.status(400).json({ success: false, error: 'Code is required' });
      }

      const rows = await sql`SELECT * FROM discount_codes WHERE code = ${code.toUpperCase()} AND is_active = true`;
      
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Invalid or expired discount code' });
      }

      const discount = rows[0];
      const now = new Date();

      // Check expiry
      if (discount.expires_at && new Date(discount.expires_at) < now) {
        return res.status(400).json({ success: false, error: 'Discount code has expired' });
      }

      // Check usage limit
      if (discount.max_uses && discount.current_uses >= discount.max_uses) {
        return res.status(400).json({ success: false, error: 'Discount code usage limit reached' });
      }

      // Check minimum order
      if (discount.min_order_amount && subtotal && subtotal < discount.min_order_amount) {
        return res.status(400).json({ success: false, error: `Minimum order amount is ${discount.min_order_amount} AED` });
      }

      let discountAmount = 0;
      if (discount.type === 'percentage') {
        discountAmount = (subtotal || 0) * (parseFloat(String(discount.value || '0')) / 100);
        if (discount.max_discount) {
          discountAmount = Math.min(discountAmount, parseFloat(String(discount.max_discount)));
        }
      } else {
        discountAmount = parseFloat(String(discount.value || '0'));
      }

      res.json({
        success: true,
        data: {
          id: discount.id,
          code: discount.code,
          type: discount.type,
          value: parseFloat(String(discount.value || '0')),
          discountAmount,
          minOrderAmount: parseFloat(String(discount.min_order_amount || '0')),
          maxDiscount: parseFloat(String(discount.max_discount || '0')),
        },
        message: 'Discount code is valid',
      });
    } catch (error) {
      console.error('[Validate Discount Error]', error);
      res.status(500).json({ success: false, error: 'Failed to validate discount code' });
    }
  });

  // Catch-all for unhandled routes
  app.use((req, res) => {
    console.log('[Netlify] Unhandled route:', req.method, req.url);
    res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
  });

  return app;
}

// =====================================================
// NETLIFY HANDLER
// =====================================================

const serverlessHandler = serverless(createApp(), {
  request: (request: any, event: any) => {
    // Ensure body is properly passed to Express
    if (event.body && typeof event.body === 'string') {
      request.body = event.body;
    }
  }
});

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  // Rewrite path from /.netlify/functions/api/* to /api/*
  if (event.path.startsWith('/.netlify/functions/api')) {
    event.path = event.path.replace('/.netlify/functions/api', '/api');
  }
  
  // Handle /api without trailing slash
  if (event.path === '/api' || event.path === '/.netlify/functions/api') {
    event.path = '/api/ping';
  }

  console.log('[Netlify Handler]', event.httpMethod, event.path, 'Body:', event.body?.substring?.(0, 100));

  try {
    const result = await serverlessHandler(event, context);
    return result as HandlerResponse;
  } catch (error) {
    console.error('[Netlify Handler Error]', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
