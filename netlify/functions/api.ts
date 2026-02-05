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

      const products = rows.map((p: any) => ({
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
        tags: p.tags || [],
        badges: p.badges || [],
        createdAt: safeDate(p.created_at),
        updatedAt: safeDate(p.updated_at),
      }));

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
        enableCashOnDelivery: s.enable_cash_on_delivery,
        enableCardPayment: s.enable_card_payment,
        enableWallet: s.enable_wallet,
        enableLoyalty: s.enable_loyalty,
        enableReviews: s.enable_reviews,
        enableWishlist: s.enable_wishlist,
        enableExpressDelivery: s.enable_express_delivery,
        enableScheduledDelivery: s.enable_scheduled_delivery,
        storePhone: s.store_phone,
        storeEmail: s.store_email,
        storeAddress: s.store_address,
        workingHoursStart: s.working_hours_start,
        workingHoursEnd: s.working_hours_end,
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
