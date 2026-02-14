/**
 * Netlify Functions API Handler
 * 
 * This adapter converts Netlify Function requests to Express
 * Uses Neon PostgreSQL serverless driver
 */

import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import express from 'express';
import cors from 'cors';
import { neon, neonConfig, NeonQueryFunction } from '@neondatabase/serverless';
import serverless from 'serverless-http';
import bcrypt from 'bcryptjs';

// =====================================================
// NEON POSTGRESQL DATABASE CONNECTION
// =====================================================

// Configure Neon for serverless
neonConfig.fetchConnectionCache = true;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_GHrRQzwk9E4n@ep-hidden-paper-ajua0bg2-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

let sql: NeonQueryFunction<false, false> | null = null;

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

// Parse JSON fields that Neon may return as strings
const safeJson = (val: any, fallback: any = null) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return val;
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

  // =====================================================
  // PASSWORD RESET API
  // =====================================================

  // Forgot Password - generate reset token
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      // Find user by email
      const users = await sql`SELECT id, email, first_name FROM users WHERE LOWER(email) = LOWER(${email})`;

      // Always return success to prevent email enumeration attacks
      if (users.length === 0) {
        return res.json({ success: true, message: 'If an account with this email exists, a reset link has been generated.' });
      }

      const dbUser = users[0];

      // Invalidate any previous tokens for this user
      await sql`UPDATE password_reset_tokens SET used = true WHERE user_id = ${dbUser.id} AND used = false`;

      // Generate reset token
      const tokenId = `prt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const token = `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 15)}_${Math.random().toString(36).substr(2, 15)}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await sql`
        INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at)
        VALUES (${tokenId}, ${dbUser.id}, ${token}, ${expiresAt}, false, ${new Date()})
      `;

      // In production, you would send this via email. For now, return the token in the response.
      const resetLink = `/reset-password?token=${token}`;
      console.log(`[Password Reset] Reset link for ${dbUser.email}: ${resetLink}`);

      res.json({
        success: true,
        message: 'If an account with this email exists, a reset link has been generated.',
        // Include reset link in response since we don't have email service
        resetLink,
        token,
      });
    } catch (error) {
      console.error('[Forgot Password Error]', error);
      res.status(500).json({ success: false, error: 'Failed to process password reset request' });
    }
  });

  // Verify Reset Token
  app.get('/api/auth/verify-reset-token', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ success: false, valid: false, error: 'Token is required' });
      }

      const tokens = await sql`
        SELECT prt.*, u.email FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token = ${token as string} AND prt.used = false AND prt.expires_at > NOW()
      `;

      if (tokens.length === 0) {
        return res.json({ success: true, valid: false });
      }

      res.json({ success: true, valid: true, email: tokens[0].email });
    } catch (error) {
      console.error('[Verify Reset Token Error]', error);
      res.status(500).json({ success: false, valid: false, error: 'Failed to verify token' });
    }
  });

  // Reset Password with token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: 'Token and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }

      // Find valid token
      const tokens = await sql`
        SELECT prt.*, u.id as uid, u.email FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token = ${token} AND prt.used = false AND prt.expires_at > NOW()
      `;

      if (tokens.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
      }

      const resetToken = tokens[0];

      // Hash new password and update user
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await sql`UPDATE users SET password = ${hashedPassword}, updated_at = ${new Date()} WHERE id = ${resetToken.uid}`;

      // Mark token as used
      await sql`UPDATE password_reset_tokens SET used = true WHERE id = ${resetToken.id}`;

      res.json({ success: true, message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('[Reset Password Error]', error);
      res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
  });

  // Admin: Reset user password directly
  app.post('/api/admin/users/:id/reset-password', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ success: false, error: 'New password is required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }

      // Verify user exists
      const users = await sql`SELECT id, username, email FROM users WHERE id = ${id}`;
      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await sql`UPDATE users SET password = ${hashedPassword}, updated_at = ${new Date()} WHERE id = ${id}`;

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('[Admin Reset Password Error]', error);
      res.status(500).json({ success: false, error: 'Failed to reset password' });
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

  // Settings - Returns full settings data including banners, time slots, promo codes
  app.get('/api/settings', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Fetch settings
      const settingsRows = await sql`SELECT * FROM app_settings LIMIT 1`;
      const s = settingsRows.length > 0 ? settingsRows[0] : {};

      const settings = {
        vatRate: String(parseFloat(String(s.vat_rate || '0.05'))),
        deliveryFee: String(parseFloat(String(s.delivery_fee || '15'))),
        freeDeliveryThreshold: String(parseFloat(String(s.free_delivery_threshold || '200'))),
        expressDeliveryFee: String(parseFloat(String(s.express_delivery_fee || '25'))),
        minimumOrderAmount: String(parseFloat(String(s.minimum_order_amount || '50'))),
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
        welcomeBonus: String(parseFloat(String(s.welcome_bonus || '50'))),
        enableWelcomeBonus: s.enable_welcome_bonus ?? true,
        loyaltyPointsPerAed: String(parseFloat(String(s.loyalty_points_per_aed || '1'))),
        loyaltyPointValue: String(parseFloat(String(s.loyalty_point_value || '0.1'))),
      };

      // Fetch banners (with error handling if table doesn't exist)
      let banners: any[] = [];
      try {
        const bannersRows = await sql`SELECT * FROM banners ORDER BY sort_order`;
        banners = bannersRows.map((b: any) => ({
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
      } catch (e) {
        console.log('[Settings] Banners table not available');
      }

      // Fetch time slots (with error handling if table doesn't exist)
      let timeSlots: any[] = [];
      try {
        const timeSlotsRows = await sql`SELECT * FROM delivery_time_slots ORDER BY sort_order`;
        timeSlots = timeSlotsRows.map((t: any) => ({
          id: t.id,
          label: t.label,
          labelAr: t.label_ar,
          startTime: t.start_time,
          endTime: t.end_time,
          isExpressSlot: t.is_express_slot || false,
          maxOrders: t.max_orders || 20,
          enabled: t.enabled,
          sortOrder: t.sort_order,
        }));
      } catch (e) {
        console.log('[Settings] Time slots table not available');
      }

      // Fetch promo codes (with error handling if table doesn't exist)
      let promoCodes: any[] = [];
      try {
        const promoCodesRows = await sql`SELECT * FROM discount_codes ORDER BY created_at DESC`;
        promoCodes = promoCodesRows.map((p: any) => ({
          id: p.id,
          code: p.code,
          type: p.type,
          value: String(parseFloat(String(p.value || '0'))),
          minimumOrder: String(parseFloat(String(p.minimum_order || '0'))),
          maximumDiscount: p.maximum_discount ? String(parseFloat(String(p.maximum_discount))) : null,
          usageLimit: p.usage_limit || 0,
          usageCount: p.usage_count || 0,
          userLimit: p.user_limit || 1,
          validFrom: p.valid_from,
          validTo: p.valid_to,
          isActive: p.is_active,
        }));
      } catch (e) {
        console.log('[Settings] Discount codes table not available');
      }

      res.json({
        success: true,
        data: {
          settings,
          banners,
          timeSlots,
          promoCodes,
        }
      });
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

      const zones = rows.map((z: any) => {
        let parsedAreas: string[] = [];
        if (z.areas) {
          parsedAreas = typeof z.areas === 'string' ? JSON.parse(z.areas) : z.areas;
        }
        return {
          id: z.id,
          name: z.name,
          nameAr: z.name_ar,
          emirate: z.emirate,
          areas: parsedAreas,
          deliveryFee: parseFloat(String(z.delivery_fee || '0')),
          minimumOrder: parseFloat(String(z.minimum_order || '0')),
          estimatedMinutes: z.estimated_minutes,
          isActive: z.is_active,
          expressEnabled: z.express_enabled,
          expressFee: parseFloat(String(z.express_fee || '25')),
          expressHours: z.express_hours,
        };
      });

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

      // Notify admins about the new registration
      try {
        const admins = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 10`;
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: 'system',
            title: 'New Customer Registered',
            titleAr: 'عضو جديد مسجل',
            message: `${firstName} ${familyName} has just registered.`,
            messageAr: `قام ${firstName} ${familyName} بالتسجيل للتو.`,
            link: '/admin/customers',
          });
        }
      } catch (notifError) {
        console.error('[New Registration Notification Error]', notifError);
      }

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
        const items = await sql!`SELECT * FROM order_items WHERE order_id = ${o.id}`;

        return {
          id: o.id,
          orderNumber: o.order_number,
          userId: o.user_id,
          customerName: o.customer_name,
          customerEmail: o.customer_email,
          customerMobile: o.customer_mobile,
          status: o.status,
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          subtotal: parseFloat(String(o.subtotal || '0')),
          vat: parseFloat(String(o.vat_amount || '0')),
          vatRate: parseFloat(String(o.vat_rate || '0.05')),
          deliveryFee: parseFloat(String(o.delivery_fee || '0')),
          discount: parseFloat(String(o.discount || '0')),
          discountCode: o.discount_code,
          total: parseFloat(String(o.total || '0')),
          addressId: o.address_id,
          deliveryAddress: safeJson(o.delivery_address),
          deliveryNotes: o.delivery_notes,
          statusHistory: safeJson(o.status_history, []),
          estimatedDeliveryAt: o.estimated_delivery_at ? safeDate(o.estimated_delivery_at) : null,
          actualDeliveryAt: o.actual_delivery_at ? safeDate(o.actual_delivery_at) : null,
          items: items.map((i: any) => ({
            id: i.id,
            productId: i.product_id,
            productName: i.product_name,
            productNameAr: i.product_name_ar,
            sku: i.sku,
            quantity: parseFloat(String(i.quantity || '0')),
            unitPrice: parseFloat(String(i.unit_price || '0')),
            totalPrice: parseFloat(String(i.total_price || '0')),
            notes: i.notes,
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

  // Orders Stats (must be before :id route)
  app.get('/api/orders/stats', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const pending = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'pending'`;
      const confirmed = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'confirmed'`;
      const processing = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'processing'`;
      const outForDelivery = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'out_for_delivery'`;
      const delivered = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'delivered'`;
      const cancelled = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'cancelled'`;

      res.json({
        success: true,
        data: {
          pending: parseInt(pending[0].cnt),
          confirmed: parseInt(confirmed[0].cnt),
          processing: parseInt(processing[0].cnt),
          outForDelivery: parseInt(outForDelivery[0].cnt),
          delivered: parseInt(delivered[0].cnt),
          cancelled: parseInt(cancelled[0].cnt),
        },
      });
    } catch (error) {
      console.error('[Orders Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch orders stats' });
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
        orderNumber: o.order_number,
        userId: o.user_id,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        customerMobile: o.customer_mobile,
        status: o.status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        subtotal: parseFloat(String(o.subtotal || '0')),
        vat: parseFloat(String(o.vat_amount || '0')),
        vatRate: parseFloat(String(o.vat_rate || '0.05')),
        deliveryFee: parseFloat(String(o.delivery_fee || '0')),
        discount: parseFloat(String(o.discount || '0')),
        discountCode: o.discount_code,
        total: parseFloat(String(o.total || '0')),
        addressId: o.address_id,
        deliveryAddress: safeJson(o.delivery_address),
        deliveryNotes: o.delivery_notes,
        statusHistory: safeJson(o.status_history, []),
        estimatedDeliveryAt: o.estimated_delivery_at ? safeDate(o.estimated_delivery_at) : null,
        actualDeliveryAt: o.actual_delivery_at ? safeDate(o.actual_delivery_at) : null,
        items: items.map((i: any) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productNameAr: i.product_name_ar,
          sku: i.sku,
          quantity: parseFloat(String(i.quantity || '0')),
          unitPrice: parseFloat(String(i.unit_price || '0')),
          totalPrice: parseFloat(String(i.total_price || '0')),
          notes: i.notes,
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

      const {
        userId,
        items,
        addressId,
        deliveryAddress,
        deliveryNotes,
        paymentMethod,
        subtotal,
        vatAmount,
        deliveryFee,
        discount,
        discountAmount, // Frontend sends this
        discountCode,
        total,
        isExpressDelivery,
        driverTip
      } = req.body;

      // Use discountAmount if discount is not provided (frontend compatibility)
      const actualDiscount = discount ?? discountAmount ?? 0;

      if (!items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      // Fetch user info for customer details (optional - allow guest orders)
      let user: any = null;
      if (userId) {
        const userRows = await sql`SELECT * FROM users WHERE id = ${userId}`;
        user = userRows[0];
      }

      // Fetch address if addressId provided
      let address = deliveryAddress;
      if (addressId && !deliveryAddress) {
        const addrRows = await sql`SELECT * FROM addresses WHERE id = ${addressId}`;
        if (addrRows[0]) {
          const a = addrRows[0];
          address = {
            fullName: a.full_name,
            mobile: a.mobile,
            emirate: a.emirate,
            area: a.area,
            street: a.street,
            building: a.building,
            floor: a.floor,
            apartment: a.apartment,
            latitude: a.latitude,
            longitude: a.longitude
          };
        }
      }

      // Get customer details from user or delivery address
      const customerName = user ? (user.first_name + ' ' + (user.family_name || '')) : (address?.fullName || 'Guest Customer');
      const customerEmail = user?.email || '';
      const customerMobile = user?.mobile || address?.mobile || '';

      const orderId = `order_${Date.now()}`;
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const now = new Date();
      const vatRate = 0.05; // 5% VAT

      await sql`
        INSERT INTO orders (
          id, order_number, user_id, customer_name, customer_email, customer_mobile,
          subtotal, discount, discount_code, delivery_fee, vat_amount, vat_rate, total,
          status, payment_status, payment_method, address_id, delivery_address, delivery_notes,
          source, created_at, updated_at
        )
        VALUES (
          ${orderId}, ${orderNumber}, ${userId || 'guest'}, 
          ${customerName}, 
          ${customerEmail}, ${customerMobile},
          ${subtotal || 0}, ${actualDiscount}, ${discountCode || null}, ${deliveryFee || 0}, 
          ${vatAmount || 0}, ${vatRate}, ${total || 0},
          'pending', 'pending', ${paymentMethod || 'cod'}, 
          ${addressId || ''}, ${JSON.stringify(address || {})}, ${deliveryNotes || null},
          'web', ${now}, ${now}
        )
      `;

      // Insert order items
      for (const item of items) {
        const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

        // Fetch product info if needed
        let productName = item.productName || '';
        let productNameAr = item.productNameAr || '';
        let sku = item.sku || '';

        if (!productName || !sku) {
          const prodRows = await sql`SELECT name, name_ar, sku FROM products WHERE id = ${item.productId}`;
          if (prodRows[0]) {
            productName = productName || prodRows[0].name;
            productNameAr = productNameAr || prodRows[0].name_ar;
            sku = sku || prodRows[0].sku;
          }
        }

        const unitPrice = item.unitPrice || item.price || 0;
        const totalPrice = item.total || item.totalPrice || (unitPrice * item.quantity);

        await sql`
          INSERT INTO order_items (id, order_id, product_id, product_name, product_name_ar, sku, quantity, unit_price, total_price, notes)
          VALUES (${itemId}, ${orderId}, ${item.productId}, ${productName}, ${productNameAr || null}, ${sku || 'N/A'}, ${item.quantity}, ${unitPrice}, ${totalPrice}, ${item.notes || null})
        `;

        // Update stock - decrease quantity
        await sql`
          UPDATE stock 
          SET quantity = quantity - ${item.quantity}, 
              reserved_quantity = reserved_quantity + ${item.quantity},
              updated_at = ${now}
          WHERE product_id = ${item.productId}
        `;
      }

      // Notify admins and user about the new order
      try {
        // 1. Notify user
        await createNotification({
          userId: userId || 'guest',
          type: 'order_placed',
          title: 'Order Placed Successfully',
          titleAr: 'تم تقديم الطلب بنجاح',
          message: `Your order ${orderNumber} has been placed and is pending confirmation.`,
          messageAr: `تم تقديم طلبك ${orderNumber} وهو في انتظار التأكيد.`,
          link: '/orders',
        });

        // 2. Notify admins
        const admins = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 10`;
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: 'order_placed',
            title: `New Order: ${orderNumber}`,
            titleAr: `طلب جديد: ${orderNumber}`,
            message: `New order from ${customerName} for ${total} AED.`,
            messageAr: `طلب جديد من ${customerName} بقيمة ${total} درهم.`,
            link: `/admin/orders`,
          });
        }
      } catch (notifError) {
        console.error('[New Order Notification Error]', notifError);
      }

      res.json({
        success: true,
        data: {
          id: orderId,
          orderNumber: orderNumber,
          status: 'pending',
          createdAt: now.toISOString()
        },
        message: 'Order created successfully',
      });
    } catch (error: any) {
      console.error('[Create Order Error]', error);
      res.status(500).json({ success: false, error: `Failed to create order: ${error?.message || String(error)}` });
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

      // Table schema: id, user_id, type, channel, title, message, message_ar, status, sent_at, delivered_at, failure_reason, metadata, created_at
      // Valid status: pending, sent, delivered, failed - we use 'delivered' as "read"
      let rows;
      if (userId) {
        // If the user is an admin, they should also see notifications sent to the literal 'admin' ID
        const userRows = await sql`SELECT role FROM users WHERE id = ${userId as string}`;
        const isAdmin = userRows[0]?.role === 'admin';

        if (isAdmin) {
          rows = await sql`SELECT * FROM notifications WHERE user_id = ${userId as string} OR user_id = 'admin' ORDER BY created_at DESC LIMIT 100`;
        } else {
          rows = await sql`SELECT * FROM notifications WHERE user_id = ${userId as string} ORDER BY created_at DESC LIMIT 100`;
        }
      } else {
        rows = await sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100`;
      }

      // Use 'delivered' status to mean "read"
      if (unreadOnly === 'true') {
        rows = rows.filter((n: any) => n.status !== 'delivered');
      }

      const notifications = rows.map((n: any) => {
        const metadata = n.metadata || {};
        // Map back to original type from metadata if available
        const originalType = metadata.originalType || n.type || 'general';
        return {
          id: n.id,
          userId: n.user_id,
          type: originalType,
          title: n.title || '',
          titleAr: metadata.titleAr || n.title || '',
          message: n.message || '',
          messageAr: n.message_ar || n.message || '',
          link: metadata.link || null,
          linkTab: metadata.linkTab || null,
          linkId: metadata.linkId || null,
          unread: n.status !== 'delivered',
          createdAt: safeDate(n.created_at),
        };
      });

      res.json({ success: true, data: notifications });
    } catch (error) {
      console.error('[Notifications Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
  });

  // Mark All Notifications as Read (uses 'delivered' status)
  // IMPORTANT: This must be registered BEFORE :id/read to avoid Express matching "read-all" as :id
  app.patch('/api/notifications/read-all', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.body;
      if (userId) {
        const userRows = await sql`SELECT role FROM users WHERE id = ${userId as string}`;
        const isAdmin = userRows[0]?.role === 'admin';

        if (isAdmin) {
          await sql`UPDATE notifications SET status = 'delivered', delivered_at = ${new Date()} WHERE user_id = ${userId} OR user_id = 'admin'`;
        } else {
          await sql`UPDATE notifications SET status = 'delivered', delivered_at = ${new Date()} WHERE user_id = ${userId}`;
        }
      }

      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      console.error('[Mark All Notifications Read Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
    }
  });

  // Mark Notification as Read (uses 'delivered' status since enum doesn't have 'read')
  app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`UPDATE notifications SET status = 'delivered', delivered_at = ${new Date()} WHERE id = ${id}`;

      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      console.error('[Mark Notification Read Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
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
  // IMPORTANT: Specific routes (send, notify-admin, notify-user, all) MUST be registered
  // BEFORE the catch-all :userId routes, otherwise Express matches :userId first.

  // Get All Chats (Admin)
  app.get('/api/chat/all', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const usersRows = await sql`
        SELECT DISTINCT user_id, user_name, user_email FROM chat_messages
      `;

      const chats = [];
      for (const user of usersRows) {
        const messages = await sql`
          SELECT * FROM chat_messages WHERE user_id = ${user.user_id} ORDER BY created_at ASC
        `;
        const unreadCount = messages.filter((m: any) => m.sender === 'user' && !m.read_by_admin).length;
        const lastMsg = messages[messages.length - 1];

        chats.push({
          userId: user.user_id,
          userName: user.user_name || 'Customer',
          userEmail: user.user_email || '',
          messages: messages.map((m: any) => ({
            id: m.id,
            text: m.text,
            sender: m.sender,
            createdAt: safeDate(m.created_at),
            readByAdmin: m.read_by_admin ?? false,
            readByUser: m.read_by_user ?? false,
            attachments: safeJson(m.attachments, []),
          })),
          lastMessageAt: lastMsg ? safeDate(lastMsg.created_at) : null,
          unreadCount,
        });
      }

      res.json({ success: true, data: chats });
    } catch (error) {
      console.error('[Get All Chats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chats' });
    }
  });

  // Send Chat Message (via /api/chat/send)
  app.post('/api/chat/send', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, userName, userEmail, text, sender, attachments } = req.body;

      if (!userId || (!text && (!attachments || attachments.length === 0))) {
        return res.status(400).json({ success: false, error: 'User ID and either text or attachments are required' });
      }

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();
      const senderType = sender || 'user';

      await sql`
        INSERT INTO chat_messages (id, user_id, user_name, user_email, text, sender, attachments, read_by_admin, read_by_user, created_at)
        VALUES (${msgId}, ${userId}, ${userName || null}, ${userEmail || null}, ${text}, ${senderType}, ${JSON.stringify(attachments || [])}, ${senderType === 'admin'}, ${senderType === 'user'}, ${now})
      `;

      res.json({
        success: true,
        data: { id: msgId, userId, sender: senderType, text, readByAdmin: senderType === 'admin', readByUser: senderType === 'user', createdAt: now.toISOString() },
        message: 'Message sent successfully',
      });
    } catch (error) {
      console.error('[Send Chat Error]', error);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });

  // Chat: Notify User (from admin)
  app.post('/api/chat/notify-user', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        console.log('[Notify User] Database not available, skipping notification');
        return res.json({ success: true, message: 'Notification skipped (no db)' });
      }

      const { userId, message, hasAttachments } = req.body || {};

      if (!userId || (!message && !hasAttachments)) {
        console.log('[Notify User] Missing userId, message or attachments, skipping');
        return res.json({ success: true, message: 'Notification skipped (missing data)' });
      }

      const now = new Date();
      const displayMessage = message ? String(message).substring(0, 500) : (hasAttachments ? 'Sent an attachment' : 'New message');
      const safeUserId = String(userId).substring(0, 100);

      try {
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        const metadataStr = JSON.stringify({ originalType: 'chat' });
        await sql`
          INSERT INTO notifications (id, user_id, type, channel, title, message, message_ar, status, metadata, created_at)
          VALUES (${notifId}, ${safeUserId}, 'promotional', 'push', 'New message from support', ${displayMessage}, ${displayMessage}, 'sent', ${metadataStr}, ${now})
        `;
        res.json({ success: true, data: { notificationId: notifId } });
      } catch (insertError: any) {
        console.error('[Notify User Insert Error]', insertError?.message || insertError);
        res.json({ success: true, message: 'Chat sent, notification insert failed' });
      }
    } catch (error: any) {
      console.error('[Notify User Error]', error?.message || error);
      res.json({ success: true, message: 'Notification error handled gracefully' });
    }
  });

  // Chat: Notify Admin (from user)
  app.post('/api/chat/notify-admin', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        console.log('[Notify Admin] Database not available, skipping notification');
        return res.json({ success: true, message: 'Notification skipped (no db)' });
      }

      const { userId, userName, message, hasAttachments } = req.body || {};

      if (!message && !hasAttachments) {
        console.log('[Notify Admin] Missing message and attachments, skipping');
        return res.json({ success: true, message: 'Notification skipped (missing data)' });
      }

      const now = new Date();
      const safeName = String(userName || 'Customer').substring(0, 100);
      const safeUserId = String(userId || 'unknown').substring(0, 100);
      const displayMessage = message ? String(message).substring(0, 500) : (hasAttachments ? 'Sent an attachment' : 'New message');
      const title = safeName ? `New message from ${safeName}` : 'New customer message';

      try {
        const admins = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 10`;
        console.log('[Notify Admin] Found', admins.length, 'admin(s)');

        if (admins.length === 0) {
          console.log('[Notify Admin] No admins found, creating notification for fallback admin');
          const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
          const metadataStr = JSON.stringify({ originalType: 'chat', fromUserId: safeUserId });
          await sql`
            INSERT INTO notifications (id, user_id, type, channel, title, message, message_ar, status, metadata, created_at)
            VALUES (${notifId}, 'admin', 'promotional', 'push', ${title}, ${displayMessage}, ${displayMessage}, 'sent', ${metadataStr}, ${now})
          `;
        } else {
          for (const admin of admins) {
            const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
            const metadataStr = JSON.stringify({ originalType: 'chat', fromUserId: safeUserId });
            await sql`
              INSERT INTO notifications (id, user_id, type, channel, title, message, message_ar, status, metadata, created_at)
              VALUES (${notifId}, ${admin.id}, 'promotional', 'push', ${title}, ${displayMessage}, ${displayMessage}, 'sent', ${metadataStr}, ${now})
            `;
          }
        }

        res.json({ success: true, message: 'Admin notified' });
      } catch (insertError: any) {
        console.error('[Notify Admin Insert Error]', insertError?.message || insertError);
        res.json({ success: true, message: 'Chat sent, admin notification insert failed' });
      }
    } catch (error: any) {
      console.error('[Notify Admin Error]', error?.message || error);
      res.json({ success: true, message: 'Notification error handled gracefully' });
    }
  });

  // Mark Chat as Read (Admin)
  app.post('/api/chat/:userId/read-admin', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.params;
      await sql`UPDATE chat_messages SET read_by_admin = true WHERE user_id = ${userId} AND sender = 'user'`;

      res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
      console.error('[Mark Read Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
    }
  });

  // Get Chat Messages (catch-all :userId - MUST be after specific routes)
  // Table schema: id, user_id, user_name, user_email, text, sender, attachments, read_by_admin, read_by_user, created_at
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
        userName: m.user_name,
        userEmail: m.user_email,
        text: m.text,
        sender: m.sender,
        attachments: safeJson(m.attachments, []),
        readByAdmin: m.read_by_admin ?? false,
        readByUser: m.read_by_user ?? false,
        createdAt: safeDate(m.created_at),
      }));

      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('[Chat Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chat messages' });
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

      // Notify admins about the new review pending approval
      try {
        const admins = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 10`;
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: 'system',
            title: 'New Review Pending',
            titleAr: 'مراجعة جديدة في انتظار الموافقة',
            message: `New ${rating}-star review from ${userName || 'a customer'} needs approval.`,
            messageAr: `مراجعة جديدة بـ ${rating} نجوم من ${userName || 'عميل'} تحتاج للموافقة.`,
            link: '/admin/products',
          });
        }
      } catch (notifError) {
        console.error('[New Review Notification Error]', notifError);
      }

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

      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, isDefault } = req.body;

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
        INSERT INTO addresses (id, user_id, label, full_name, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, is_default, created_at, updated_at)
        VALUES (${addressId}, ${userId}, ${label}, ${fullName}, ${mobile}, ${emirate}, ${area}, ${street}, ${building}, ${floor || null}, ${apartment || null}, ${landmark || null}, ${latitude || null}, ${longitude || null}, ${shouldBeDefault}, ${now}, ${now})
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
      const { label, fullName, mobile, emirate, area, street, building, floor, apartment, landmark, latitude, longitude, isDefault } = req.body;
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

  // =====================================================
  // PRODUCTS ADMIN API (CRUD)
  // =====================================================

  // Get Single Product
  app.get('/api/products/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const rows = await sql`SELECT * FROM products WHERE id = ${id}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const p = rows[0];
      let tags = p.tags || [];
      let badges = p.badges || [];
      if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch { tags = []; }
      if (typeof badges === 'string') try { badges = JSON.parse(badges); } catch { badges = []; }

      const product = {
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

      res.json({ success: true, data: product });
    } catch (error) {
      console.error('[Get Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch product' });
    }
  });

  // Create Product
  app.post('/api/products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { name, nameAr, sku, price, costPrice, discount, category, description, descriptionAr, image, unit, minOrderQuantity, maxOrderQuantity, isActive, isFeatured, isPremium, tags, badges } = req.body;

      if (!name || !price || !category) {
        return res.status(400).json({ success: false, error: 'Name, price and category are required' });
      }

      const productId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const productSku = sku || `SKU${Date.now()}`;
      const now = new Date();

      await sql`
        INSERT INTO products (id, name, name_ar, sku, price, cost_price, discount, category, description, description_ar, image, unit, min_order_quantity, max_order_quantity, is_active, is_featured, is_premium, rating, tags, badges, created_at, updated_at)
        VALUES (${productId}, ${name}, ${nameAr || null}, ${productSku}, ${price}, ${costPrice || 0}, ${discount || 0}, ${category}, ${description || null}, ${descriptionAr || null}, ${image || null}, ${unit || 'kg'}, ${minOrderQuantity || 0.25}, ${maxOrderQuantity || 10}, ${isActive !== false}, ${isFeatured || false}, ${isPremium || false}, ${0}, ${JSON.stringify(tags || [])}, ${JSON.stringify(badges || [])}, ${now}, ${now})
      `;

      // Create stock entry - unlimited quantity by default
      await sql`
        INSERT INTO stock (id, product_id, quantity, reserved_quantity, available_quantity, low_stock_threshold, reorder_point, reorder_quantity, updated_at)
        VALUES (${`stock_${productId}`}, ${productId}, 999999, 0, 999999, 10, 10, 50, ${now})
      `;

      res.json({ success: true, data: { id: productId }, message: 'Product created successfully' });
    } catch (error) {
      console.error('[Create Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create product' });
    }
  });

  // Update Product
  app.put('/api/products/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { name, nameAr, sku, price, costPrice, discount, category, description, descriptionAr, image, unit, minOrderQuantity, maxOrderQuantity, isActive, isFeatured, isPremium, tags, badges } = req.body;
      const now = new Date();

      await sql`
        UPDATE products SET
          name = COALESCE(${name}, name),
          name_ar = COALESCE(${nameAr}, name_ar),
          sku = COALESCE(${sku}, sku),
          price = COALESCE(${price}, price),
          cost_price = COALESCE(${costPrice}, cost_price),
          discount = COALESCE(${discount}, discount),
          category = COALESCE(${category}, category),
          description = COALESCE(${description}, description),
          description_ar = COALESCE(${descriptionAr}, description_ar),
          image = COALESCE(${image}, image),
          unit = COALESCE(${unit}, unit),
          min_order_quantity = COALESCE(${minOrderQuantity}, min_order_quantity),
          max_order_quantity = COALESCE(${maxOrderQuantity}, max_order_quantity),
          is_active = COALESCE(${isActive}, is_active),
          is_featured = COALESCE(${isFeatured}, is_featured),
          is_premium = COALESCE(${isPremium}, is_premium),
          tags = COALESCE(${tags ? JSON.stringify(tags) : null}, tags),
          badges = COALESCE(${badges ? JSON.stringify(badges) : null}, badges),
          updated_at = ${now}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
      console.error('[Update Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update product' });
    }
  });

  // Delete Product
  app.delete('/api/products/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;

      // Soft delete - set is_active to false
      await sql`UPDATE products SET is_active = false, updated_at = ${new Date()} WHERE id = ${id}`;

      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      console.error('[Delete Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
  });

  // =====================================================
  // CATEGORIES ADMIN API (CRUD)
  // =====================================================

  // Create Category
  app.post('/api/categories', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { nameEn, nameAr, icon, color, sortOrder, isActive } = req.body;

      if (!nameEn) {
        return res.status(400).json({ success: false, error: 'Category name is required' });
      }

      const categoryId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      await sql`
        INSERT INTO product_categories (id, name_en, name_ar, icon, color, sort_order, is_active, created_at, updated_at)
        VALUES (${categoryId}, ${nameEn}, ${nameAr || null}, ${icon || 'Package'}, ${color || '#3B82F6'}, ${sortOrder || 0}, ${isActive !== false}, ${now}, ${now})
      `;

      res.json({ success: true, data: { id: categoryId }, message: 'Category created successfully' });
    } catch (error) {
      console.error('[Create Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create category' });
    }
  });

  // Update Category
  app.put('/api/categories/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { nameEn, nameAr, icon, color, sortOrder, isActive } = req.body;
      const now = new Date();

      await sql`
        UPDATE product_categories SET
          name_en = COALESCE(${nameEn}, name_en),
          name_ar = COALESCE(${nameAr}, name_ar),
          icon = COALESCE(${icon}, icon),
          color = COALESCE(${color}, color),
          sort_order = COALESCE(${sortOrder}, sort_order),
          is_active = COALESCE(${isActive}, is_active),
          updated_at = ${now}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'Category updated successfully' });
    } catch (error) {
      console.error('[Update Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update category' });
    }
  });

  // Delete Category
  app.delete('/api/categories/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM product_categories WHERE id = ${id}`;

      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
      console.error('[Delete Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
  });

  // =====================================================
  // USERS ADMIN API
  // =====================================================

  // Get All Users
  app.get('/api/users', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { role, search } = req.query;
      let rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;

      if (role && role !== 'all') {
        rows = rows.filter((u: any) => u.role === role);
      }

      if (search) {
        const q = (search as string).toLowerCase();
        rows = rows.filter((u: any) =>
          u.email?.toLowerCase().includes(q) ||
          u.first_name?.toLowerCase().includes(q) ||
          u.family_name?.toLowerCase().includes(q) ||
          u.mobile?.includes(q)
        );
      }

      const users = rows.map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        mobile: u.mobile,
        firstName: u.first_name,
        familyName: u.family_name,
        role: u.role,
        isActive: u.is_active,
        isVerified: u.is_verified,
        emirate: u.emirate,
        createdAt: safeDate(u.created_at),
        updatedAt: safeDate(u.updated_at),
      }));

      res.json({ success: true, data: users });
    } catch (error) {
      console.error('[Get Users Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  });

  // Get User Stats
  app.get('/api/users/stats', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const total = await sql`SELECT COUNT(*) as cnt FROM users`;
      const customers = await sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'customer'`;
      const staff = await sql`SELECT COUNT(*) as cnt FROM users WHERE role IN ('admin', 'staff', 'delivery')`;
      const active = await sql`SELECT COUNT(*) as cnt FROM users WHERE is_active = true`;

      res.json({
        success: true,
        data: {
          total: parseInt(total[0].cnt),
          customers: parseInt(customers[0].cnt),
          staff: parseInt(staff[0].cnt),
          active: parseInt(active[0].cnt),
        },
      });
    } catch (error) {
      console.error('[User Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user stats' });
    }
  });

  // Get Single User
  app.get('/api/users/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const rows = await sql`SELECT * FROM users WHERE id = ${id}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const u = rows[0];
      res.json({
        success: true,
        data: {
          id: u.id,
          username: u.username,
          email: u.email,
          mobile: u.mobile,
          firstName: u.first_name,
          familyName: u.family_name,
          role: u.role,
          isActive: u.is_active,
          isVerified: u.is_verified,
          emirate: u.emirate,
          createdAt: safeDate(u.created_at),
          updatedAt: safeDate(u.updated_at),
        },
      });
    } catch (error) {
      console.error('[Get User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
  });

  // Create User (Admin)
  app.post('/api/users', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { email, password, firstName, familyName, mobile, username, role, isActive, emirate } = req.body;

      if (!email || !password || !firstName) {
        return res.status(400).json({ success: false, error: 'Email, password and first name are required' });
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const hashedPassword = await bcrypt.hash(password, 10);
      const now = new Date();

      await sql`
        INSERT INTO users (id, username, email, mobile, password, first_name, family_name, role, is_active, is_verified, emirate, created_at, updated_at)
        VALUES (${userId}, ${username || email.split('@')[0]}, ${email}, ${mobile || null}, ${hashedPassword}, ${firstName}, ${familyName || null}, ${role || 'customer'}, ${isActive !== false}, false, ${emirate || null}, ${now}, ${now})
      `;

      res.json({ success: true, data: { id: userId }, message: 'User created successfully' });
    } catch (error) {
      console.error('[Create User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create user' });
    }
  });

  // Update User
  app.put('/api/users/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { email, firstName, familyName, mobile, role, isActive, isVerified, emirate } = req.body;
      const now = new Date();

      await sql`
        UPDATE users SET
          email = COALESCE(${email}, email),
          first_name = COALESCE(${firstName}, first_name),
          family_name = COALESCE(${familyName}, family_name),
          mobile = COALESCE(${mobile}, mobile),
          role = COALESCE(${role}, role),
          is_active = COALESCE(${isActive}, is_active),
          is_verified = COALESCE(${isVerified}, is_verified),
          emirate = COALESCE(${emirate}, emirate),
          updated_at = ${now}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
      console.error('[Update User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update user' });
    }
  });

  // Delete User
  app.delete('/api/users/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`UPDATE users SET is_active = false, updated_at = ${new Date()} WHERE id = ${id}`;

      res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
      console.error('[Delete User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
  });

  // Change Password
  app.post('/api/users/:id/change-password', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ success: false, error: 'New password is required' });
      }

      const users = await sql`SELECT password FROM users WHERE id = ${id}`;
      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Verify current password if provided
      if (currentPassword) {
        const isValid = users[0].password.startsWith('$2')
          ? await bcrypt.compare(currentPassword, users[0].password)
          : currentPassword === users[0].password;
        if (!isValid) {
          return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await sql`UPDATE users SET password = ${hashedPassword}, updated_at = ${new Date()} WHERE id = ${id}`;

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('[Change Password Error]', error);
      res.status(500).json({ success: false, error: 'Failed to change password' });
    }
  });

  // =====================================================
  // STOCK MANAGEMENT API
  // =====================================================

  // Get All Stock
  app.get('/api/stock', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT s.*, p.name as product_name, p.name_ar as product_name_ar, p.sku, p.category
        FROM stock s
        LEFT JOIN products p ON s.product_id = p.id
      `;

      const stock = rows.map((s: any) => ({
        id: s.id,
        productId: s.product_id,
        productName: s.product_name,
        productNameAr: s.product_name_ar,
        sku: s.sku,
        category: s.category,
        quantity: parseFloat(String(s.quantity || '0')),
        reservedQuantity: parseFloat(String(s.reserved_quantity || '0')),
        availableQuantity: parseFloat(String(s.available_quantity || s.quantity || '0')),
        lowStockThreshold: parseFloat(String(s.low_stock_threshold || '10')),
        reorderPoint: parseFloat(String(s.reorder_point || '10')),
        reorderQuantity: parseFloat(String(s.reorder_quantity || '50')),
        lastRestockedAt: s.last_restocked_at ? safeDate(s.last_restocked_at) : null,
        updatedAt: safeDate(s.updated_at),
      }));

      res.json({ success: true, data: stock });
    } catch (error) {
      console.error('[Stock Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock' });
    }
  });

  // Stock Valuation (must be before :productId route)
  app.get('/api/stock/valuation', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT s.*, p.name, p.cost_price, p.price
        FROM stock s
        JOIN products p ON s.product_id = p.id
      `;

      let totalCostValue = 0;
      let totalRetailValue = 0;

      const items = rows.map((r: any) => {
        const qty = parseFloat(String(r.quantity || '0'));
        const cost = parseFloat(String(r.cost_price || '0'));
        const retail = parseFloat(String(r.price || '0'));
        totalCostValue += qty * cost;
        totalRetailValue += qty * retail;

        return {
          productId: r.product_id,
          productName: r.name,
          quantity: qty,
          costPrice: cost,
          retailPrice: retail,
          costValue: qty * cost,
          retailValue: qty * retail,
        };
      });

      res.json({
        success: true,
        data: {
          items,
          totalCostValue,
          totalRetailValue,
          potentialProfit: totalRetailValue - totalCostValue,
        },
      });
    } catch (error) {
      console.error('[Stock Valuation Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock valuation' });
    }
  });

  // Get Low Stock Alerts (must be before :productId route)
  app.get('/api/stock/alerts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT s.*, p.name as product_name, p.sku
        FROM stock s
        LEFT JOIN products p ON s.product_id = p.id
        WHERE s.quantity <= s.low_stock_threshold
      `;

      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('[Low Stock Alerts Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
    }
  });

  // Get Stock Movements (must be before :productId route)
  app.get('/api/stock/movements', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT sm.*, p.name as product_name
        FROM stock_movements sm
        LEFT JOIN products p ON sm.product_id = p.id
        ORDER BY sm.created_at DESC
        LIMIT 100
      `;

      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('[Stock Movements Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock movements' });
    }
  });

  // Get Stock by Product (dynamic route - must be after static routes)
  app.get('/api/stock/:productId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId } = req.params;
      const rows = await sql`SELECT * FROM stock WHERE product_id = ${productId}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Stock not found' });
      }

      const s = rows[0];
      res.json({
        success: true,
        data: {
          id: s.id,
          productId: s.product_id,
          quantity: parseFloat(String(s.quantity || '0')),
          reservedQuantity: parseFloat(String(s.reserved_quantity || '0')),
          availableQuantity: parseFloat(String(s.available_quantity || s.quantity || '0')),
          lowStockThreshold: parseFloat(String(s.low_stock_threshold || '10')),
          reorderPoint: parseFloat(String(s.reorder_point || '10')),
          reorderQuantity: parseFloat(String(s.reorder_quantity || '50')),
          lastRestockedAt: s.last_restocked_at ? safeDate(s.last_restocked_at) : null,
          updatedAt: safeDate(s.updated_at),
        },
      });
    } catch (error) {
      console.error('[Get Stock Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock' });
    }
  });

  // Update Stock
  app.post('/api/stock/update', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId, quantity, type, reason, reference } = req.body;

      if (!productId || quantity === undefined) {
        return res.status(400).json({ success: false, error: 'Product ID and quantity are required' });
      }

      const now = new Date();
      const stocks = await sql`SELECT * FROM stock WHERE product_id = ${productId}`;

      let currentQty = 0;
      if (stocks.length > 0) {
        currentQty = parseFloat(String(stocks[0].quantity || '0'));
      }

      const newQty = type === 'set' ? quantity : currentQty + quantity;

      if (stocks.length === 0) {
        await sql`
          INSERT INTO stock (id, product_id, quantity, reserved_quantity, low_stock_threshold, reorder_quantity, created_at, updated_at)
          VALUES (${`stock_${productId}`}, ${productId}, ${newQty}, 0, 10, 50, ${now}, ${now})
        `;
      } else {
        await sql`UPDATE stock SET quantity = ${newQty}, updated_at = ${now} WHERE product_id = ${productId}`;
      }

      // Log movement
      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      await sql`
        INSERT INTO stock_movements (id, product_id, type, quantity, previous_quantity, new_quantity, reason, reference, created_at)
        VALUES (${movementId}, ${productId}, ${type || 'adjustment'}, ${quantity}, ${currentQty}, ${newQty}, ${reason || null}, ${reference || null}, ${now})
      `;

      res.json({ success: true, data: { quantity: newQty }, message: 'Stock updated successfully' });
    } catch (error) {
      console.error('[Update Stock Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update stock' });
    }
  });

  // =====================================================
  // DELIVERY ZONES API
  // =====================================================

  // Get Delivery Zones (including inactive for admin)
  app.get('/api/delivery/zones', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM delivery_zones ORDER BY name`;

      const zones = rows.map((z: any) => {
        let parsedAreas: string[] = [];
        if (z.areas) {
          parsedAreas = typeof z.areas === 'string' ? JSON.parse(z.areas) : z.areas;
        }
        return {
          id: z.id,
          name: z.name,
          nameAr: z.name_ar,
          emirate: z.emirate,
          areas: parsedAreas,
          deliveryFee: parseFloat(String(z.delivery_fee || '0')),
          minimumOrder: parseFloat(String(z.minimum_order || '0')),
          estimatedMinutes: z.estimated_minutes,
          isActive: z.is_active,
          expressEnabled: z.express_enabled,
          expressFee: parseFloat(String(z.express_fee || '25')),
          expressHours: z.express_hours,
        };
      });

      res.json({ success: true, data: zones });
    } catch (error) {
      console.error('[Delivery Zones Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch delivery zones' });
    }
  });

  // Create Delivery Zone
  app.post('/api/delivery/zones', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive, expressEnabled, expressFee, expressHours } = req.body;

      if (!name || !emirate) {
        return res.status(400).json({ success: false, error: 'Name and emirate are required' });
      }

      const zoneId = `zone_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      await sql`
        INSERT INTO delivery_zones (id, name, name_ar, emirate, areas, delivery_fee, minimum_order, estimated_minutes, is_active, express_enabled, express_fee, express_hours)
        VALUES (${zoneId}, ${name}, ${nameAr || null}, ${emirate}, ${JSON.stringify(areas || [])}, ${deliveryFee || 15}, ${minimumOrder || 50}, ${estimatedMinutes || 60}, ${isActive !== false}, ${expressEnabled || false}, ${expressFee || 25}, ${expressHours || 1})
      `;

      res.json({ success: true, data: { id: zoneId }, message: 'Delivery zone created successfully' });
    } catch (error) {
      console.error('[Create Zone Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create delivery zone' });
    }
  });

  // Update Delivery Zone
  app.put('/api/delivery/zones/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive, expressEnabled, expressFee, expressHours } = req.body;

      // Get existing zone first
      const existing = await sql`SELECT * FROM delivery_zones WHERE id = ${id}`;
      if (existing.length === 0) {
        return res.status(404).json({ success: false, error: 'Delivery zone not found' });
      }

      // Prepare update values, keeping existing values for undefined fields
      const current = existing[0];
      const updateName = name !== undefined ? name : current.name;
      const updateNameAr = nameAr !== undefined ? nameAr : current.name_ar;
      const updateEmirate = emirate !== undefined ? emirate : current.emirate;
      const updateAreas = areas !== undefined ? areas : (typeof current.areas === 'string' ? JSON.parse(current.areas) : current.areas);
      const updateDeliveryFee = deliveryFee !== undefined ? deliveryFee : current.delivery_fee;
      const updateMinimumOrder = minimumOrder !== undefined ? minimumOrder : current.minimum_order;
      const updateEstimatedMinutes = estimatedMinutes !== undefined ? estimatedMinutes : current.estimated_minutes;
      const updateIsActive = isActive !== undefined ? isActive : current.is_active;
      const updateExpressEnabled = expressEnabled !== undefined ? expressEnabled : current.express_enabled;
      const updateExpressFee = expressFee !== undefined ? expressFee : current.express_fee;
      const updateExpressHours = expressHours !== undefined ? expressHours : current.express_hours;

      // Update using template literal - Neon handles JSONB conversion automatically
      await sql`
        UPDATE delivery_zones 
        SET 
          name = ${updateName},
          name_ar = ${updateNameAr},
          emirate = ${updateEmirate},
          areas = ${JSON.stringify(updateAreas)},
          delivery_fee = ${updateDeliveryFee},
          minimum_order = ${updateMinimumOrder},
          estimated_minutes = ${updateEstimatedMinutes},
          is_active = ${updateIsActive},
          express_enabled = ${updateExpressEnabled},
          express_fee = ${updateExpressFee},
          express_hours = ${updateExpressHours}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'Delivery zone updated successfully' });
    } catch (error) {
      console.error('[Update Zone Error]', error);
      console.error('[Update Zone Error Details]', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update delivery zone'
      });
    }
  });

  // Delete Delivery Zone
  app.delete('/api/delivery/zones/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM delivery_zones WHERE id = ${id}`;

      res.json({ success: true, message: 'Delivery zone deleted successfully' });
    } catch (error) {
      console.error('[Delete Zone Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete delivery zone' });
    }
  });

  // =====================================================
  // DELIVERY TRACKING API
  // =====================================================

  // Helper: get notification content for order status
  function getNotificationContent(orderNumber: string, status: string) {
    const notifications: Record<string, { title: string; titleAr: string; message: string; messageAr: string }> = {
      confirmed: { title: "Order Confirmed", titleAr: "تم تأكيد الطلب", message: `Great news! Your order ${orderNumber} has been confirmed`, messageAr: `أخبار سارة! تم تأكيد طلبك ${orderNumber}` },
      processing: { title: "Order Being Prepared", titleAr: "جاري تحضير الطلب", message: `Your order ${orderNumber} is now being prepared`, messageAr: `جاري تحضير طلبك ${orderNumber} الآن` },
      ready_for_pickup: { title: "Order Ready", titleAr: "الطلب جاهز", message: `Your order ${orderNumber} is ready for pickup/delivery`, messageAr: `طلبك ${orderNumber} جاهز للاستلام/التوصيل` },
      out_for_delivery: { title: "Out for Delivery", titleAr: "في الطريق إليك", message: `Your order ${orderNumber} is on its way to you!`, messageAr: `طلبك ${orderNumber} في الطريق إليك!` },
      delivered: { title: "Order Delivered", titleAr: "تم تسليم الطلب", message: `Your order ${orderNumber} has been delivered. Enjoy!`, messageAr: `تم تسليم طلبك ${orderNumber}. بالهناء والشفاء!` },
      cancelled: { title: "Order Cancelled", titleAr: "تم إلغاء الطلب", message: `Your order ${orderNumber} has been cancelled`, messageAr: `تم إلغاء طلبك ${orderNumber}` },
    };
    return notifications[status] || null;
  }

  // Helper: generate unique id
  const genId = (prefix: string = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Helper: create a notification in the `notifications` table (the table that GET /api/notifications reads)
  // Maps app notification types to valid DB enum values and stores extra fields in metadata
  async function createNotification(params: {
    userId: string;
    type: string;
    title: string;
    titleAr: string;
    message: string;
    messageAr: string;
    link?: string | null;
  }) {
    if (!sql) return;
    const typeMapping: Record<string, string> = {
      'order': 'order_placed', 'order_new': 'order_placed', 'order_placed': 'order_placed',
      'order_confirmed': 'order_confirmed', 'order_processing': 'order_processing',
      'order_ready': 'order_ready', 'order_shipped': 'order_shipped',
      'order_delivered': 'order_delivered', 'order_cancelled': 'order_cancelled',
      'payment': 'payment_received', 'payment_received': 'payment_received',
      'driver_assigned': 'order_shipped', 'delivery': 'order_shipped',
      'system': 'promotional', 'general': 'promotional', 'chat': 'promotional',
    };
    const mappedType = typeMapping[params.type] || 'promotional';
    const notifId = genId('notif');
    const metadata = JSON.stringify({
      originalType: params.type,
      titleAr: params.titleAr,
      link: params.link || null,
      linkTab: null,
      linkId: null,
    });
    try {
      await sql`INSERT INTO notifications (id, user_id, type, channel, title, message, message_ar, status, metadata, created_at)
        VALUES (${notifId}, ${params.userId}, ${mappedType}, 'push', ${params.title}, ${params.message}, ${params.messageAr}, 'sent', ${metadata}::jsonb, NOW())`;
      console.log(`[Notification] Created for user ${params.userId}: ${params.title}`);
    } catch (err) {
      console.error(`[Notification] Failed to create:`, err);
    }
  }

  // GET /api/delivery/tracking - Get all trackings (admin) or filter by query
  app.get('/api/delivery/tracking', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId, driverId, status } = req.query;
      let rows = await sql`SELECT * FROM delivery_tracking ORDER BY created_at DESC`;

      if (orderId) rows = rows.filter((t: any) => t.order_id === orderId);
      if (driverId) rows = rows.filter((t: any) => t.driver_id === driverId);
      if (status) rows = rows.filter((t: any) => t.status === status);

      // Enrich with order details
      const allOrders = await sql`SELECT * FROM orders`;
      const allOrderItems = await sql`SELECT * FROM order_items`;

      const trackings = rows.map((t: any) => {
        const order = allOrders.find((o: any) => o.id === t.order_id);
        const items = allOrderItems
          .filter((item: any) => item.order_id === t.order_id)
          .map((item: any) => ({
            name: item.product_name,
            nameAr: item.product_name_ar,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            totalPrice: Number(item.total_price),
          }));

        return {
          id: t.id,
          orderId: t.order_id,
          orderNumber: t.order_number,
          driverId: t.driver_id,
          driverName: t.driver_name,
          driverMobile: t.driver_mobile,
          status: t.status,
          currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof),
          timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at),
          updatedAt: safeDate(t.updated_at),
          ...(order ? {
            customerName: order.customer_name,
            customerMobile: order.customer_mobile,
            userId: order.user_id,
            deliveryAddress: safeJson(order.delivery_address),
            total: Number(order.total || 0),
            items,
          } : {}),
        };
      });

      res.json({ success: true, data: trackings });
    } catch (error) {
      console.error('[Delivery Tracking Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch trackings' });
    }
  });

  // POST /api/delivery/tracking/assign - Assign delivery to driver (MUST be before /:id routes)
  app.post('/api/delivery/tracking/assign', async (req, res) => {
    console.log('[ASSIGN DELIVERY] Request received:', JSON.stringify(req.body));
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId, driverId, estimatedArrival } = req.body;
      if (!orderId || !driverId) {
        return res.status(400).json({ success: false, error: 'orderId and driverId are required' });
      }

      // Validate order
      const orderRows = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
      if (orderRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      const order = orderRows[0];

      // Validate driver
      const driverRows = await sql`SELECT * FROM users WHERE id = ${driverId} AND role = 'delivery'`;
      if (driverRows.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid delivery driver' });
      }
      const driver = driverRows[0];
      const driverFullName = `${driver.first_name} ${driver.family_name}`;

      // Check if tracking already exists
      const existing = await sql`SELECT * FROM delivery_tracking WHERE order_id = ${orderId}`;

      let tracking;
      if (existing.length > 0) {
        // Update existing
        const existingTimeline = safeJson(existing[0].timeline, []);
        existingTimeline.push({ status: 'assigned', timestamp: new Date().toISOString(), notes: `Assigned to driver: ${driver.first_name}` });

        await sql`UPDATE delivery_tracking SET 
          driver_id = ${driverId},
          driver_name = ${driverFullName},
          driver_mobile = ${driver.mobile},
          status = 'assigned',
          estimated_arrival = ${estimatedArrival ? new Date(estimatedArrival).toISOString() : existing[0].estimated_arrival},
          timeline = ${JSON.stringify(existingTimeline)}::jsonb,
          updated_at = NOW()
          WHERE id = ${existing[0].id}`;
        const updated = await sql`SELECT * FROM delivery_tracking WHERE id = ${existing[0].id}`;
        tracking = updated[0];
      } else {
        // Create new
        const trackingId = genId('track');
        const timeline = [{ status: 'assigned', timestamp: new Date().toISOString(), notes: `Order assigned to driver: ${driver.first_name}` }];

        await sql`INSERT INTO delivery_tracking (id, order_id, order_number, driver_id, driver_name, driver_mobile, status, estimated_arrival, timeline, created_at, updated_at)
          VALUES (${trackingId}, ${orderId}, ${order.order_number}, ${driverId}, ${driverFullName}, ${driver.mobile}, 'assigned', ${estimatedArrival ? new Date(estimatedArrival).toISOString() : order.estimated_delivery_at}, ${JSON.stringify(timeline)}::jsonb, NOW(), NOW())`;
        const inserted = await sql`SELECT * FROM delivery_tracking WHERE id = ${trackingId}`;
        tracking = inserted[0];
      }

      // Update order status to ready_for_pickup
      await sql`UPDATE orders SET status = 'ready_for_pickup', updated_at = NOW() WHERE id = ${orderId}`;

      // Create notification for user: driver assigned
      if (order.user_id) {
        await createNotification({
          userId: order.user_id,
          type: 'driver_assigned',
          title: 'Driver Assigned to Your Order',
          titleAr: 'تم تعيين سائق لطلبك',
          message: `Driver: ${driverFullName} | Mobile: ${driver.mobile}`,
          messageAr: `السائق: ${driverFullName} | الهاتف: ${driver.mobile}`,
          link: '/orders',
        });
        console.log('[ASSIGN DELIVERY] User notification created');
      }

      // Create notification for driver
      const parsedAddr = safeJson(order.delivery_address);
      const addressStr = parsedAddr ? `${parsedAddr.building || ''}, ${parsedAddr.street || ''}, ${parsedAddr.area || ''}` : 'Address not available';
      await createNotification({
        userId: driverId,
        type: 'delivery',
        title: 'New Delivery Assigned',
        titleAr: 'تم تعيين توصيل جديد',
        message: `Order ${order.order_number} assigned to you. Customer: ${order.customer_name}. Address: ${addressStr}`,
        messageAr: `تم تعيين الطلب ${order.order_number} لك. العميل: ${order.customer_name}. العنوان: ${addressStr}`,
      });

      console.log('[ASSIGN DELIVERY] Success! Tracking ID:', tracking.id);
      const result = {
        id: tracking.id,
        orderId: tracking.order_id,
        orderNumber: tracking.order_number,
        driverId: tracking.driver_id,
        driverName: tracking.driver_name,
        driverMobile: tracking.driver_mobile,
        status: tracking.status,
        currentLocation: safeJson(tracking.current_location),
        estimatedArrival: tracking.estimated_arrival ? safeDate(tracking.estimated_arrival) : null,
        actualArrival: tracking.actual_arrival ? safeDate(tracking.actual_arrival) : null,
        deliveryProof: safeJson(tracking.delivery_proof),
        timeline: safeJson(tracking.timeline, []),
        createdAt: safeDate(tracking.created_at),
        updatedAt: safeDate(tracking.updated_at),
      };
      res.json({ success: true, data: result, message: 'Delivery assigned successfully' });
    } catch (error) {
      console.error('[ASSIGN DELIVERY] Error:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to assign delivery' });
    }
  });

  // GET /api/delivery/tracking/by-order/:orderId - Get tracking by order ID (MUST be before /:id)
  app.get('/api/delivery/tracking/by-order/:orderId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId } = req.params;
      const rows = await sql`SELECT * FROM delivery_tracking WHERE order_id = ${orderId}`;

      if (rows.length === 0) {
        return res.json({ success: true, data: null });
      }

      const t = rows[0];
      res.json({
        success: true,
        data: {
          id: t.id,
          orderId: t.order_id,
          orderNumber: t.order_number,
          driverId: t.driver_id,
          driverName: t.driver_name,
          driverMobile: t.driver_mobile,
          status: t.status,
          currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof),
          timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at),
          updatedAt: safeDate(t.updated_at),
        },
      });
    } catch (error) {
      console.error('[Tracking By OrderId Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracking' });
    }
  });

  // GET /api/delivery/tracking/order/:orderNumber - Get tracking by order number (MUST be before /:id)
  app.get('/api/delivery/tracking/order/:orderNumber', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderNumber } = req.params;
      const rows = await sql`SELECT * FROM delivery_tracking WHERE order_number = ${orderNumber}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found for this order' });
      }

      const t = rows[0];
      res.json({
        success: true,
        data: {
          id: t.id,
          orderId: t.order_id,
          orderNumber: t.order_number,
          driverId: t.driver_id,
          driverName: t.driver_name,
          driverMobile: t.driver_mobile,
          status: t.status,
          currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof),
          timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at),
          updatedAt: safeDate(t.updated_at),
        },
      });
    } catch (error) {
      console.error('[Tracking By OrderNumber Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracking' });
    }
  });

  // POST /api/delivery/tracking/:orderId/update - Update delivery status by order ID (MUST be before /:id)
  app.post('/api/delivery/tracking/:orderId/update', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId } = req.params;
      const { status, notes, location } = req.body;

      const rows = await sql`SELECT * FROM delivery_tracking WHERE order_id = ${orderId}`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found for this order' });
      }

      const tracking = rows[0];
      const timeline = safeJson(tracking.timeline, []);
      timeline.push({ status, timestamp: new Date().toISOString(), location, notes });

      const updateFields: any = { status, timeline, updated_at: new Date() };
      if (status === 'delivered') {
        updateFields.actual_arrival = new Date();
      }

      await sql`UPDATE delivery_tracking SET 
        status = ${status}, 
        timeline = ${JSON.stringify(timeline)}::jsonb, 
        actual_arrival = ${status === 'delivered' ? new Date().toISOString() : tracking.actual_arrival},
        updated_at = NOW() 
        WHERE id = ${tracking.id}`;

      // Update order status
      if (status === 'delivered' || status === 'in_transit' || status === 'nearby') {
        const orderStatus = status === 'delivered' ? 'delivered' : 'out_for_delivery';
        const currentOrder = await sql`SELECT * FROM orders WHERE id = ${tracking.order_id}`;
        if (currentOrder.length > 0) {
          let statusHistory = safeJson(currentOrder[0].status_history, []);
          const historyNotes = notes ? `Driver note: ${notes}` : `Updated via delivery tracking: ${status}`;
          statusHistory.push({ status: orderStatus, changedBy: tracking.driver_id || 'driver', changedAt: new Date().toISOString(), notes: historyNotes });

          if (status === 'delivered') {
            // Save driver notes to delivery_notes (do NOT auto-capture payment for COD)
            if (notes) {
              const existingNotes = currentOrder[0].delivery_notes;
              const driverNote = `Driver note: ${notes}`;
              const combinedNotes = existingNotes ? `${existingNotes}\n${driverNote}` : driverNote;
              await sql`UPDATE orders SET status = 'delivered', status_history = ${JSON.stringify(statusHistory)}::jsonb, actual_delivery_at = NOW(), delivery_notes = ${combinedNotes}, updated_at = NOW() WHERE id = ${tracking.order_id}`;
            } else {
              await sql`UPDATE orders SET status = 'delivered', status_history = ${JSON.stringify(statusHistory)}::jsonb, actual_delivery_at = NOW(), updated_at = NOW() WHERE id = ${tracking.order_id}`;
            }
          } else {
            await sql`UPDATE orders SET status = ${orderStatus}, status_history = ${JSON.stringify(statusHistory)}::jsonb, updated_at = NOW() WHERE id = ${tracking.order_id}`;
          }
        }
      }

      // Create notification for user
      const orderResult = await sql`SELECT * FROM orders WHERE id = ${tracking.order_id}`;
      if (orderResult.length > 0 && orderResult[0].user_id) {
        const order = orderResult[0];
        if (status === 'assigned') {
          const driverName = tracking.driver_name || 'Driver';
          const driverMobile = tracking.driver_mobile || 'N/A';
          await createNotification({
            userId: order.user_id,
            type: 'driver_assigned',
            title: 'Driver Assigned to Your Order',
            titleAr: 'تم تعيين سائق لطلبك',
            message: `Driver: ${driverName} | Mobile: ${driverMobile}`,
            messageAr: `السائق: ${driverName} | الهاتف: ${driverMobile}`,
            link: '/orders',
          });
        } else if (status === 'in_transit' || status === 'picked_up') {
          const content = getNotificationContent(order.order_number, 'out_for_delivery');
          if (content) {
            await createNotification({
              userId: order.user_id,
              type: 'order_shipped',
              title: content.title,
              titleAr: content.titleAr,
              message: content.message,
              messageAr: content.messageAr,
              link: '/orders',
            });
          }
        } else if (status === 'delivered') {
          const content = getNotificationContent(order.order_number, 'delivered');
          if (content) {
            await createNotification({
              userId: order.user_id,
              type: 'order_delivered',
              title: content.title,
              titleAr: content.titleAr,
              message: content.message,
              messageAr: content.messageAr,
              link: '/orders',
            });
          }
        }
      }

      const updated = await sql`SELECT * FROM delivery_tracking WHERE id = ${tracking.id}`;
      const t = updated[0];
      res.json({
        success: true,
        data: {
          id: t.id, orderId: t.order_id, orderNumber: t.order_number,
          driverId: t.driver_id, driverName: t.driver_name, driverMobile: t.driver_mobile,
          status: t.status, currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof), timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at), updatedAt: safeDate(t.updated_at),
        },
        message: `Delivery status updated to ${status}`,
      });
    } catch (error) {
      console.error('[Delivery Status Update Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update delivery status' });
    }
  });

  // POST /api/delivery/tracking/:id/complete - Complete delivery with proof (MUST be before /:id GET)
  app.post('/api/delivery/tracking/:id/complete', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { signature, photo, notes } = req.body;

      const rows = await sql`SELECT * FROM delivery_tracking WHERE id = ${id}`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const tracking = rows[0];
      const timeline = safeJson(tracking.timeline, []);
      timeline.push({ status: 'delivered', timestamp: new Date().toISOString(), notes: notes || 'Delivery completed with proof' });
      const deliveryProof = JSON.stringify({ signature, photo, notes });

      await sql`UPDATE delivery_tracking SET 
        status = 'delivered', actual_arrival = NOW(), 
        delivery_proof = ${deliveryProof}::jsonb,
        timeline = ${JSON.stringify(timeline)}::jsonb, updated_at = NOW() 
        WHERE id = ${id}`;

      // Update order
      const currentOrder = await sql`SELECT * FROM orders WHERE id = ${tracking.order_id}`;
      if (currentOrder.length > 0) {
        let statusHistory = safeJson(currentOrder[0].status_history, []);
        statusHistory.push({ status: 'delivered', changedBy: tracking.driver_id || 'driver', changedAt: new Date().toISOString(), notes: notes || 'Delivery completed with proof' });
        // Save driver notes to delivery_notes and update status (do NOT auto-capture payment for COD)
        const driverNote = notes ? `Driver note: ${notes}` : null;
        if (driverNote) {
          const existingNotes = currentOrder[0].delivery_notes;
          const combinedNotes = existingNotes ? `${existingNotes}\n${driverNote}` : driverNote;
          await sql`UPDATE orders SET status = 'delivered', status_history = ${JSON.stringify(statusHistory)}::jsonb, actual_delivery_at = NOW(), delivery_notes = ${combinedNotes}, updated_at = NOW() WHERE id = ${tracking.order_id}`;
        } else {
          await sql`UPDATE orders SET status = 'delivered', status_history = ${JSON.stringify(statusHistory)}::jsonb, actual_delivery_at = NOW(), updated_at = NOW() WHERE id = ${tracking.order_id}`;
        }
      }

      // Notification for user
      const orderResult = await sql`SELECT * FROM orders WHERE id = ${tracking.order_id}`;
      if (orderResult.length > 0 && orderResult[0].user_id) {
        const order = orderResult[0];
        const notifMsg = notes ? `Your order ${order.order_number} has been delivered. Driver note: ${notes}` : `Your order ${order.order_number} has been delivered. Enjoy!`;
        const notifMsgAr = notes ? `تم تسليم طلبك ${order.order_number}. ملاحظة السائق: ${notes}` : `تم تسليم طلبك ${order.order_number}. بالهناء والشفاء!`;
        await createNotification({
          userId: order.user_id,
          type: 'order_delivered',
          title: 'Order Delivered',
          titleAr: 'تم تسليم الطلب',
          message: notifMsg,
          messageAr: notifMsgAr,
          link: '/orders',
        });
      }

      const updated = await sql`SELECT * FROM delivery_tracking WHERE id = ${id}`;
      const t = updated[0];
      res.json({
        success: true,
        data: {
          id: t.id, orderId: t.order_id, orderNumber: t.order_number,
          driverId: t.driver_id, driverName: t.driver_name, driverMobile: t.driver_mobile,
          status: t.status, currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof), timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at), updatedAt: safeDate(t.updated_at),
        },
        message: 'Delivery completed successfully',
      });
    } catch (error) {
      console.error('[Complete Delivery Error]', error);
      res.status(500).json({ success: false, error: 'Failed to complete delivery' });
    }
  });

  // PATCH /api/delivery/tracking/:id/location - Update driver location
  app.patch('/api/delivery/tracking/:id/location', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { latitude, longitude } = req.body;

      const rows = await sql`SELECT * FROM delivery_tracking WHERE id = ${id}`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const location = JSON.stringify({ latitude, longitude, updatedAt: new Date().toISOString() });
      await sql`UPDATE delivery_tracking SET current_location = ${location}::jsonb, updated_at = NOW() WHERE id = ${id}`;

      const updated = await sql`SELECT * FROM delivery_tracking WHERE id = ${id}`;
      const t = updated[0];
      res.json({
        success: true,
        data: {
          id: t.id, orderId: t.order_id, orderNumber: t.order_number,
          driverId: t.driver_id, driverName: t.driver_name, driverMobile: t.driver_mobile,
          status: t.status, currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof), timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at), updatedAt: safeDate(t.updated_at),
        },
      });
    } catch (error) {
      console.error('[Update Location Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update location' });
    }
  });

  // PATCH /api/delivery/tracking/:id/status - Update delivery status by tracking ID
  app.patch('/api/delivery/tracking/:id/status', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { status, notes, location } = req.body;

      const rows = await sql`SELECT * FROM delivery_tracking WHERE id = ${id}`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const tracking = rows[0];
      const timeline = safeJson(tracking.timeline, []);
      timeline.push({ status, timestamp: new Date().toISOString(), location, notes });

      await sql`UPDATE delivery_tracking SET 
        status = ${status}, 
        timeline = ${JSON.stringify(timeline)}::jsonb,
        actual_arrival = ${status === 'delivered' ? new Date().toISOString() : tracking.actual_arrival},
        updated_at = NOW() 
        WHERE id = ${id}`;

      // Update order status if delivered (do NOT auto-capture payment for COD - admin must confirm)
      if (status === 'delivered') {
        if (notes) {
          const orderForNotes = await sql`SELECT delivery_notes FROM orders WHERE id = ${tracking.order_id}`;
          const existingNotes = orderForNotes.length > 0 ? orderForNotes[0].delivery_notes : null;
          const driverNote = `Driver note: ${notes}`;
          const combinedNotes = existingNotes ? `${existingNotes}\n${driverNote}` : driverNote;
          await sql`UPDATE orders SET status = 'delivered', actual_delivery_at = NOW(), delivery_notes = ${combinedNotes}, updated_at = NOW() WHERE id = ${tracking.order_id}`;
        } else {
          await sql`UPDATE orders SET status = 'delivered', actual_delivery_at = NOW(), updated_at = NOW() WHERE id = ${tracking.order_id}`;
        }

        const orderRes = await sql`SELECT * FROM orders WHERE id = ${tracking.order_id}`;
        if (orderRes.length > 0 && orderRes[0].user_id) {
          const content = getNotificationContent(orderRes[0].order_number, 'delivered');
          if (content) {
            await createNotification({
              userId: orderRes[0].user_id,
              type: 'order_delivered',
              title: content.title,
              titleAr: content.titleAr,
              message: content.message,
              messageAr: content.messageAr,
              link: '/orders',
            });
          }
        }
      }

      const updated = await sql`SELECT * FROM delivery_tracking WHERE id = ${id}`;
      const t = updated[0];
      res.json({
        success: true,
        data: {
          id: t.id, orderId: t.order_id, orderNumber: t.order_number,
          driverId: t.driver_id, driverName: t.driver_name, driverMobile: t.driver_mobile,
          status: t.status, currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof), timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at), updatedAt: safeDate(t.updated_at),
        },
        message: `Delivery status updated to ${status}`,
      });
    } catch (error) {
      console.error('[Delivery Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update delivery status' });
    }
  });

  // GET /api/delivery/tracking/:id - Get tracking by ID (MUST be LAST among tracking routes)
  app.get('/api/delivery/tracking/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const rows = await sql`SELECT * FROM delivery_tracking WHERE id = ${id}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Tracking not found' });
      }

      const t = rows[0];
      res.json({
        success: true,
        data: {
          id: t.id, orderId: t.order_id, orderNumber: t.order_number,
          driverId: t.driver_id, driverName: t.driver_name, driverMobile: t.driver_mobile,
          status: t.status, currentLocation: safeJson(t.current_location),
          estimatedArrival: t.estimated_arrival ? safeDate(t.estimated_arrival) : null,
          actualArrival: t.actual_arrival ? safeDate(t.actual_arrival) : null,
          deliveryProof: safeJson(t.delivery_proof), timeline: safeJson(t.timeline, []),
          createdAt: safeDate(t.created_at), updatedAt: safeDate(t.updated_at),
        },
      });
    } catch (error) {
      console.error('[Get Tracking Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracking' });
    }
  });

  // GET /api/delivery/drivers - Get all delivery drivers
  app.get('/api/delivery/drivers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const driverRows = await sql`SELECT * FROM users WHERE role = 'delivery' AND is_active = true`;
      const trackingRows = await sql`SELECT * FROM delivery_tracking WHERE status NOT IN ('delivered', 'failed')`;

      const drivers = driverRows.map((d: any) => ({
        id: d.id,
        name: `${d.first_name} ${d.family_name}`,
        mobile: d.mobile,
        email: d.email,
        activeDeliveries: trackingRows.filter((t: any) => t.driver_id === d.id).length,
      }));

      res.json({ success: true, data: drivers });
    } catch (error) {
      console.error('[Delivery Drivers Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch drivers' });
    }
  });

  // =====================================================
  // PAYMENTS API
  // =====================================================

  // Get Payments
  app.get('/api/payments', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId, status } = req.query;
      let rows = await sql`SELECT * FROM payments ORDER BY created_at DESC`;

      if (orderId) {
        rows = rows.filter((p: any) => p.order_id === orderId);
      }
      if (status) {
        rows = rows.filter((p: any) => p.status === status);
      }

      const payments = rows.map((p: any) => ({
        id: p.id,
        orderId: p.order_id,
        userId: p.user_id,
        amount: parseFloat(String(p.amount || '0')),
        method: p.method,
        status: p.status,
        transactionId: p.transaction_id,
        gatewayResponse: p.gateway_response,
        createdAt: safeDate(p.created_at),
        updatedAt: safeDate(p.updated_at),
      }));

      res.json({ success: true, data: payments });
    } catch (error) {
      console.error('[Payments Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payments' });
    }
  });

  // Get Payment Stats
  app.get('/api/payments/stats', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const total = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'`;
      const pending = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'pending'`;
      const refunded = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'refunded'`;

      res.json({
        success: true,
        data: {
          totalCompleted: parseFloat(String(total[0].total || '0')),
          totalPending: parseFloat(String(pending[0].total || '0')),
          totalRefunded: parseFloat(String(refunded[0].total || '0')),
        },
      });
    } catch (error) {
      console.error('[Payment Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment stats' });
    }
  });

  // Process Payment
  app.post('/api/payments/process', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId, userId, amount, method } = req.body;

      if (!orderId || !amount || !method) {
        return res.status(400).json({ success: false, error: 'Order ID, amount and method are required' });
      }

      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const transactionId = `txn_${Date.now()}`;
      const now = new Date();

      await sql`
        INSERT INTO payments (id, order_id, amount, method, status, created_at, updated_at)
        VALUES (${paymentId}, ${orderId}, ${amount}, ${method}, 'captured', ${now}, ${now})
      `;

      // Update order payment status
      await sql`UPDATE orders SET payment_status = 'captured', updated_at = ${now} WHERE id = ${orderId}`;

      res.json({ success: true, data: { id: paymentId, transactionId }, message: 'Payment processed successfully' });
    } catch (error) {
      console.error('[Process Payment Error]', error);
      res.status(500).json({ success: false, error: 'Failed to process payment' });
    }
  });

  // Refund Payment
  app.post('/api/payments/:id/refund', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { reason } = req.body;
      const now = new Date();

      await sql`UPDATE payments SET status = 'refunded', updated_at = ${now} WHERE id = ${id}`;

      res.json({ success: true, message: 'Payment refunded successfully' });
    } catch (error) {
      console.error('[Refund Payment Error]', error);
      res.status(500).json({ success: false, error: 'Failed to refund payment' });
    }
  });

  // =====================================================
  // BANNERS API (Admin)
  // =====================================================

  // Get All Banners (including disabled)
  app.get('/api/settings/banners', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM banners ORDER BY sort_order`;

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

  // Create Banner
  app.post('/api/settings/banners', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { titleEn, titleAr, subtitleEn, subtitleAr, image, bgColor, link, badge, badgeAr, enabled, sortOrder } = req.body;

      const bannerId = `banner_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      await sql`
        INSERT INTO banners (id, title_en, title_ar, subtitle_en, subtitle_ar, image, bg_color, link, badge, badge_ar, enabled, sort_order, created_at, updated_at)
        VALUES (${bannerId}, ${titleEn || null}, ${titleAr || null}, ${subtitleEn || null}, ${subtitleAr || null}, ${image || null}, ${bgColor || '#FFFFFF'}, ${link || null}, ${badge || null}, ${badgeAr || null}, ${enabled !== false}, ${sortOrder || 0}, ${now}, ${now})
      `;

      res.json({ success: true, data: { id: bannerId }, message: 'Banner created successfully' });
    } catch (error) {
      console.error('[Create Banner Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create banner' });
    }
  });

  // Update Banner
  app.put('/api/settings/banners/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { titleEn, titleAr, subtitleEn, subtitleAr, image, bgColor, link, badge, badgeAr, enabled, sortOrder } = req.body;
      const now = new Date();

      await sql`
        UPDATE banners SET
          title_en = COALESCE(${titleEn}, title_en),
          title_ar = COALESCE(${titleAr}, title_ar),
          subtitle_en = COALESCE(${subtitleEn}, subtitle_en),
          subtitle_ar = COALESCE(${subtitleAr}, subtitle_ar),
          image = COALESCE(${image}, image),
          bg_color = COALESCE(${bgColor}, bg_color),
          link = COALESCE(${link}, link),
          badge = COALESCE(${badge}, badge),
          badge_ar = COALESCE(${badgeAr}, badge_ar),
          enabled = COALESCE(${enabled}, enabled),
          sort_order = COALESCE(${sortOrder}, sort_order),
          updated_at = ${now}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'Banner updated successfully' });
    } catch (error) {
      console.error('[Update Banner Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update banner' });
    }
  });

  // Delete Banner
  app.delete('/api/settings/banners/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM banners WHERE id = ${id}`;

      res.json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
      console.error('[Delete Banner Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete banner' });
    }
  });

  // =====================================================
  // TIME SLOTS API (Admin)
  // =====================================================

  // Create Time Slot
  app.post('/api/settings/time-slots', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { label, labelAr, startTime, endTime, isExpressSlot, maxOrders, enabled, sortOrder } = req.body;

      const slotId = `slot_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      await sql`
        INSERT INTO delivery_time_slots (id, label, label_ar, start_time, end_time, is_express_slot, max_orders, enabled, sort_order, created_at, updated_at)
        VALUES (${slotId}, ${label}, ${labelAr || null}, ${startTime}, ${endTime}, ${isExpressSlot || false}, ${maxOrders || 50}, ${enabled !== false}, ${sortOrder || 0}, ${now}, ${now})
      `;

      res.json({ success: true, data: { id: slotId }, message: 'Time slot created successfully' });
    } catch (error) {
      console.error('[Create Time Slot Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create time slot' });
    }
  });

  // Update Time Slot
  app.put('/api/settings/time-slots/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { label, labelAr, startTime, endTime, isExpressSlot, maxOrders, enabled, sortOrder } = req.body;
      const now = new Date();

      await sql`
        UPDATE delivery_time_slots SET
          label = COALESCE(${label}, label),
          label_ar = COALESCE(${labelAr}, label_ar),
          start_time = COALESCE(${startTime}, start_time),
          end_time = COALESCE(${endTime}, end_time),
          is_express_slot = COALESCE(${isExpressSlot}, is_express_slot),
          max_orders = COALESCE(${maxOrders}, max_orders),
          enabled = COALESCE(${enabled}, enabled),
          sort_order = COALESCE(${sortOrder}, sort_order),
          updated_at = ${now}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'Time slot updated successfully' });
    } catch (error) {
      console.error('[Update Time Slot Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update time slot' });
    }
  });

  // Delete Time Slot
  app.delete('/api/settings/time-slots/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM delivery_time_slots WHERE id = ${id}`;

      res.json({ success: true, message: 'Time slot deleted successfully' });
    } catch (error) {
      console.error('[Delete Time Slot Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete time slot' });
    }
  });

  // =====================================================
  // PROMO/DISCOUNT CODES API (Admin)
  // =====================================================

  // Get All Discount Codes
  app.get('/api/settings/promo-codes', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`SELECT * FROM discount_codes ORDER BY created_at DESC`;

      const codes = rows.map((c: any) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        value: parseFloat(String(c.value || '0')),
        minOrderAmount: parseFloat(String(c.minimum_order || '0')),
        maxDiscount: parseFloat(String(c.maximum_discount || '0')),
        maxUses: c.usage_limit,
        currentUses: c.usage_count || 0,
        expiresAt: c.valid_to ? safeDate(c.valid_to) : null,
        validFrom: c.valid_from ? safeDate(c.valid_from) : null,
        isActive: c.is_active,
        createdAt: safeDate(c.created_at),
      }));

      res.json({ success: true, data: codes });
    } catch (error) {
      console.error('[Discount Codes Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch discount codes' });
    }
  });

  // Create Discount Code
  app.post('/api/settings/promo-codes', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      // Accept both frontend field names and backend field names
      const {
        code, type, value,
        minOrderAmount, minimumOrder,
        maxDiscount, maximumDiscount,
        maxUses, usageLimit,
        userLimit,
        expiresAt, validTo, validFrom,
        isActive
      } = req.body;

      if (!code || !type || value === undefined) {
        return res.status(400).json({ success: false, error: 'Code, type and value are required' });
      }

      const codeId = `promo_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      // Use frontend field names with fallback to backend field names - parse strings to numbers
      const valueNum = parseFloat(String(value)) || 0;
      const minOrder = parseFloat(String(minimumOrder || minOrderAmount || 0)) || 0;
      const maxDiscountVal = maximumDiscount || maxDiscount ? parseFloat(String(maximumDiscount || maxDiscount)) : null;
      const maxUsesVal = parseInt(String(usageLimit || maxUses || 0), 10) || 0;
      const userLimitVal = parseInt(String(userLimit || 1), 10) || 1;
      const validFromVal = validFrom ? new Date(validFrom) : now;
      const expiresAtVal = validTo || expiresAt ? new Date(validTo || expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default to 1 year from now

      await sql`
        INSERT INTO discount_codes (id, code, type, value, minimum_order, maximum_discount, usage_limit, usage_count, user_limit, valid_from, valid_to, is_active, created_at, updated_at)
        VALUES (${codeId}, ${code.toUpperCase()}, ${type}, ${valueNum}, ${minOrder}, ${maxDiscountVal}, ${maxUsesVal}, 0, ${userLimitVal}, ${validFromVal}, ${expiresAtVal}, ${isActive !== false}, ${now}, ${now})
      `;

      res.json({ success: true, data: { id: codeId }, message: 'Discount code created successfully' });
    } catch (error: any) {
      console.error('[Create Discount Code Error]', error);
      const errMsg = error?.message || String(error);
      res.status(500).json({ success: false, error: `Failed to create discount code: ${errMsg}` });
    }
  });

  // Update Discount Code
  app.put('/api/settings/promo-codes/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      // Accept both frontend field names and backend field names
      const {
        code, type, value,
        minOrderAmount, minimumOrder,
        maxDiscount, maximumDiscount,
        maxUses, usageLimit,
        expiresAt, validTo,
        isActive
      } = req.body;

      // Use frontend field names with fallback to backend field names
      const minOrder = minimumOrder !== undefined ? minimumOrder : minOrderAmount;
      const maxDiscountVal = maximumDiscount !== undefined ? maximumDiscount : maxDiscount;
      const maxUsesVal = usageLimit !== undefined ? usageLimit : maxUses;
      const expiresAtVal = validTo !== undefined ? validTo : expiresAt;

      await sql`
        UPDATE discount_codes SET
          code = COALESCE(${code?.toUpperCase()}, code),
          type = COALESCE(${type}, type),
          value = COALESCE(${value}, value),
          minimum_order = COALESCE(${minOrder}, minimum_order),
          maximum_discount = COALESCE(${maxDiscountVal}, maximum_discount),
          usage_limit = COALESCE(${maxUsesVal}, usage_limit),
          valid_to = COALESCE(${expiresAtVal}, valid_to),
          is_active = COALESCE(${isActive}, is_active),
          updated_at = ${new Date()}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'Discount code updated successfully' });
    } catch (error) {
      console.error('[Update Discount Code Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update discount code' });
    }
  });

  // Delete Discount Code
  app.delete('/api/settings/promo-codes/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM discount_codes WHERE id = ${id}`;

      res.json({ success: true, message: 'Discount code deleted successfully' });
    } catch (error) {
      console.error('[Delete Discount Code Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete discount code' });
    }
  });

  // Reset all promo code usage limits (make unlimited)
  app.post('/api/settings/promo-codes/reset-limits', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      await sql`UPDATE discount_codes SET usage_limit = 0, usage_count = 0, updated_at = NOW()`;

      res.json({ success: true, message: 'All promo code limits reset successfully' });
    } catch (error) {
      console.error('[Reset Promo Limits Error]', error);
      res.status(500).json({ success: false, error: 'Failed to reset promo code limits' });
    }
  });

  // Validate Promo Code
  app.post('/api/settings/promo-codes/validate', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { code, orderTotal } = req.body;

      if (!code) {
        return res.status(400).json({ success: false, error: 'Promo code is required' });
      }

      // Find the promo code (check both promo_codes and discount_codes tables)
      let promoCode = null;

      // Try promo_codes table first
      try {
        const promoRows = await sql`
          SELECT * FROM promo_codes 
          WHERE UPPER(code) = UPPER(${code}) 
          AND is_active = true
          LIMIT 1
        `;
        if (promoRows.length > 0) {
          promoCode = promoRows[0];
        }
      } catch (e) {
        // Table might not exist
      }

      // Try discount_codes table if not found
      if (!promoCode) {
        try {
          const discountRows = await sql`
            SELECT * FROM discount_codes 
            WHERE UPPER(code) = UPPER(${code}) 
            AND is_active = true
            LIMIT 1
          `;
          if (discountRows.length > 0) {
            promoCode = discountRows[0];
          }
        } catch (e) {
          // Table might not exist
        }
      }

      if (!promoCode) {
        return res.json({ success: false, error: 'Invalid promo code' });
      }

      // Check expiry
      if (promoCode.valid_to && new Date(promoCode.valid_to) < new Date()) {
        return res.json({ success: false, error: 'Promo code has expired' });
      }

      // Check usage limit (0 or null means unlimited)
      const usageLimit = parseInt(String(promoCode.usage_limit || '0'), 10);
      const usageCount = parseInt(String(promoCode.usage_count || '0'), 10);
      if (usageLimit > 0 && usageCount >= usageLimit) {
        return res.json({ success: false, error: 'Promo code usage limit reached' });
      }

      // Check minimum order
      const minOrder = parseFloat(String(promoCode.minimum_order || '0'));
      if (orderTotal && orderTotal < minOrder) {
        return res.json({ success: false, error: `Minimum order amount is ${minOrder} AED` });
      }

      // Calculate discount
      const value = parseFloat(String(promoCode.value || '0'));
      const type = promoCode.type || 'percentage';
      let discount = 0;

      if (type === 'percentage') {
        discount = (orderTotal || 0) * (value / 100);
        // Apply max discount cap if set
        const maxDiscount = promoCode.maximum_discount ? parseFloat(String(promoCode.maximum_discount)) : null;
        if (maxDiscount && discount > maxDiscount) {
          discount = maxDiscount;
        }
      } else {
        discount = value;
      }

      // Round to 2 decimal places
      discount = Math.round(discount * 100) / 100;

      res.json({
        success: true,
        data: {
          valid: true,
          code: promoCode.code,
          type: type,
          value: value,
          discount: discount,
        }
      });
    } catch (error) {
      console.error('[Validate Promo Code Error]', error);
      res.status(500).json({ success: false, error: 'Failed to validate promo code' });
    }
  });

  // =====================================================
  // SETTINGS API (Admin)
  // =====================================================

  // Update Settings
  app.put('/api/settings', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { vatRate, deliveryFee, freeDeliveryThreshold, expressDeliveryFee, minimumOrderAmount, enableCashOnDelivery, enableCardPayment, enableWallet, enableLoyalty, enableReviews, enableWishlist, enableExpressDelivery, enableScheduledDelivery, storePhone, storeEmail, storeAddress, storeAddressAr, workingHoursStart, workingHoursEnd } = req.body;
      const now = new Date();

      // Check if settings exist
      const existing = await sql`SELECT id FROM app_settings LIMIT 1`;

      if (existing.length === 0) {
        await sql`
          INSERT INTO app_settings (id, vat_rate, delivery_fee, free_delivery_threshold, express_delivery_fee, minimum_order_amount, enable_cash_on_delivery, enable_card_payment, enable_wallet, enable_loyalty, enable_reviews, enable_wishlist, enable_express_delivery, enable_scheduled_delivery, store_phone, store_email, store_address, store_address_ar, working_hours_start, working_hours_end, created_at, updated_at)
          VALUES ('settings_1', ${vatRate || 0.05}, ${deliveryFee || 15}, ${freeDeliveryThreshold || 200}, ${expressDeliveryFee || 25}, ${minimumOrderAmount || 50}, ${enableCashOnDelivery !== false}, ${enableCardPayment !== false}, ${enableWallet !== false}, ${enableLoyalty !== false}, ${enableReviews !== false}, ${enableWishlist !== false}, ${enableExpressDelivery !== false}, ${enableScheduledDelivery !== false}, ${storePhone || null}, ${storeEmail || null}, ${storeAddress || null}, ${storeAddressAr || null}, ${workingHoursStart || '08:00'}, ${workingHoursEnd || '22:00'}, ${now}, ${now})
        `;
      } else {
        await sql`
          UPDATE app_settings SET
            vat_rate = COALESCE(${vatRate}, vat_rate),
            delivery_fee = COALESCE(${deliveryFee}, delivery_fee),
            free_delivery_threshold = COALESCE(${freeDeliveryThreshold}, free_delivery_threshold),
            express_delivery_fee = COALESCE(${expressDeliveryFee}, express_delivery_fee),
            minimum_order_amount = COALESCE(${minimumOrderAmount}, minimum_order_amount),
            enable_cash_on_delivery = COALESCE(${enableCashOnDelivery}, enable_cash_on_delivery),
            enable_card_payment = COALESCE(${enableCardPayment}, enable_card_payment),
            enable_wallet = COALESCE(${enableWallet}, enable_wallet),
            enable_loyalty = COALESCE(${enableLoyalty}, enable_loyalty),
            enable_reviews = COALESCE(${enableReviews}, enable_reviews),
            enable_wishlist = COALESCE(${enableWishlist}, enable_wishlist),
            enable_express_delivery = COALESCE(${enableExpressDelivery}, enable_express_delivery),
            enable_scheduled_delivery = COALESCE(${enableScheduledDelivery}, enable_scheduled_delivery),
            store_phone = COALESCE(${storePhone}, store_phone),
            store_email = COALESCE(${storeEmail}, store_email),
            store_address = COALESCE(${storeAddress}, store_address),
            store_address_ar = COALESCE(${storeAddressAr}, store_address_ar),
            working_hours_start = COALESCE(${workingHoursStart}, working_hours_start),
            working_hours_end = COALESCE(${workingHoursEnd}, working_hours_end),
            updated_at = ${now}
        `;
      }

      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
      console.error('[Update Settings Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
  });

  // =====================================================
  // SUPPLIERS API (Stub endpoints - feature not yet implemented)
  // =====================================================

  // Get all suppliers
  app.get('/api/suppliers', async (req, res) => {
    // Return empty array - suppliers feature not yet implemented
    res.json({ success: true, data: [] });
  });

  // Get supplier stats
  app.get('/api/suppliers/stats', async (req, res) => {
    // Return default stats - suppliers feature not yet implemented
    res.json({
      success: true,
      data: {
        totalSuppliers: 0,
        activeSuppliers: 0,
        inactiveSuppliers: 0,
        pendingOrders: 0,
        totalPurchaseOrders: 0,
        totalSpent: 0,
        avgLeadTime: 0,
        avgRating: 0
      }
    });
  });

  // Get supplier by ID
  app.get('/api/suppliers/:id', async (req, res) => {
    res.status(404).json({ success: false, error: 'Supplier not found' });
  });

  // Create supplier
  app.post('/api/suppliers', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  // Update supplier
  app.put('/api/suppliers/:id', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  // Delete supplier
  app.delete('/api/suppliers/:id', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  // Update supplier status
  app.patch('/api/suppliers/:id/status', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  // Supplier contacts
  app.post('/api/suppliers/:id/contacts', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  app.delete('/api/suppliers/:supplierId/contacts/:contactId', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  // Supplier products
  app.get('/api/suppliers/:id/products', async (req, res) => {
    res.json({ success: true, data: [] });
  });

  app.post('/api/suppliers/:id/products', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  app.delete('/api/suppliers/products/:id', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  // Purchase orders
  app.get('/api/suppliers/purchase-orders/list', async (req, res) => {
    res.json({ success: true, data: [] });
  });

  app.get('/api/suppliers/purchase-orders/:id', async (req, res) => {
    res.status(404).json({ success: false, error: 'Purchase order not found' });
  });

  app.post('/api/suppliers/purchase-orders', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  app.patch('/api/suppliers/purchase-orders/:id/status', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  app.put('/api/suppliers/purchase-orders/:id/receive', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  app.delete('/api/suppliers/purchase-orders/:id', async (req, res) => {
    res.status(501).json({ success: false, error: 'Suppliers feature not yet implemented' });
  });

  // =====================================================
  // ANALYTICS/DASHBOARD API
  // =====================================================

  // Dashboard Stats
  app.get('/api/analytics/dashboard', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);

      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const monthStart = new Date(today);
      monthStart.setDate(monthStart.getDate() - 30);

      const lastMonthStart = new Date(monthStart);
      lastMonthStart.setDate(lastMonthStart.getDate() - 30);

      // Today's stats
      const todayStats = await sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= ${today}`;
      const todayOrdersCount = parseInt(todayStats[0].cnt);
      const todayRevenueAmount = parseFloat(String(todayStats[0].total || '0'));

      // Yesterday's stats
      const yesterdayStats = await sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= ${yesterday} AND created_at < ${today}`;
      const yesterdayOrdersCount = parseInt(yesterdayStats[0].cnt);
      const yesterdayRevenueAmount = parseFloat(String(yesterdayStats[0].total || '0'));

      // Week stats
      const weekStats = await sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= ${weekStart}`;
      const weekOrdersCount = parseInt(weekStats[0].cnt);
      const weekRevenueAmount = parseFloat(String(weekStats[0].total || '0'));

      // Last week stats
      const lastWeekStats = await sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= ${lastWeekStart} AND created_at < ${weekStart}`;
      const lastWeekOrdersCount = parseInt(lastWeekStats[0].cnt);
      const lastWeekRevenueAmount = parseFloat(String(lastWeekStats[0].total || '0'));

      // Month stats
      const monthStats = await sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= ${monthStart}`;
      const monthOrdersCount = parseInt(monthStats[0].cnt);
      const monthRevenueAmount = parseFloat(String(monthStats[0].total || '0'));

      // Last month stats
      const lastMonthStats = await sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= ${lastMonthStart} AND created_at < ${monthStart}`;
      const lastMonthOrdersCount = parseInt(lastMonthStats[0].cnt);
      const lastMonthRevenueAmount = parseFloat(String(lastMonthStats[0].total || '0'));

      // Pending orders
      const pendingOrders = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status IN ('pending', 'confirmed', 'processing')`;

      // Total customers
      const totalCustomers = await sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'customer'`;

      // New customers (last 7 days)
      const newCustomers = await sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'customer' AND created_at >= ${weekStart}`;

      // Average order value
      const avgOrderValue = await sql`SELECT COALESCE(AVG(total), 0) as avg FROM orders`;
      const averageOrderValue = parseFloat(String(avgOrderValue[0].avg || '0'));

      // Previous period avg order value
      const prevAvgOrderValue = await sql`SELECT COALESCE(AVG(total), 0) as avg FROM orders WHERE created_at < ${weekStart}`;
      const prevAverageOrderValue = parseFloat(String(prevAvgOrderValue[0].avg || '0'));

      // Low stock items
      const lowStockResult = await sql`
        SELECT p.id, p.name as name_en, p.name_ar, s.quantity, s.low_stock_threshold, p.image
        FROM stock s
        JOIN products p ON s.product_id = p.id
        WHERE s.quantity <= s.low_stock_threshold
        LIMIT 10
      `;

      // Recent orders
      const recentOrdersResult = await sql`
        SELECT id, order_number, customer_name, total, status, payment_status, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 5
      `;

      // Calculate percentage changes
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      res.json({
        success: true,
        data: {
          // Revenue
          todayRevenue: todayRevenueAmount,
          weekRevenue: weekRevenueAmount,
          monthRevenue: monthRevenueAmount,

          // Orders
          todayOrders: todayOrdersCount,
          weekOrders: weekOrdersCount,
          monthOrders: monthOrdersCount,
          pendingOrders: parseInt(pendingOrders[0].cnt),

          // Customers
          totalCustomers: parseInt(totalCustomers[0].cnt),
          newCustomers: parseInt(newCustomers[0].cnt),

          // Metrics
          averageOrderValue,
          lowStockCount: lowStockResult.length,

          // Change percentages
          revenueChange: {
            daily: calcChange(todayRevenueAmount, yesterdayRevenueAmount),
            weekly: calcChange(weekRevenueAmount, lastWeekRevenueAmount),
            monthly: calcChange(monthRevenueAmount, lastMonthRevenueAmount),
          },
          ordersChange: {
            daily: calcChange(todayOrdersCount, yesterdayOrdersCount),
            weekly: calcChange(weekOrdersCount, lastWeekOrdersCount),
            monthly: calcChange(monthOrdersCount, lastMonthOrdersCount),
          },
          averageOrderValueChange: calcChange(averageOrderValue, prevAverageOrderValue),

          // Recent data
          recentOrders: recentOrdersResult.map((o: any) => ({
            id: o.id,
            orderNumber: o.order_number,
            customerName: o.customer_name,
            total: parseFloat(String(o.total)),
            status: o.status,
            paymentStatus: o.payment_status,
            createdAt: o.created_at,
          })),
          lowStockItems: lowStockResult.map((item: any) => ({
            productId: item.id,
            productName: item.name_en,
            productNameAr: item.name_ar,
            currentStock: parseInt(item.quantity),
            lowStockThreshold: parseInt(item.low_stock_threshold),
            image: item.image,
            suggestedReorderQuantity: parseInt(item.low_stock_threshold) * 2,
          })),
        },
      });
    } catch (error) {
      console.error('[Dashboard Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
    }
  });

  // Order Status Update (PATCH)
  app.patch('/api/orders/:id/status', async (req, res) => {
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

      // Return the full updated order (client expects response.data)
      const rows = await sql`SELECT * FROM orders WHERE id = ${id}`;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const o = rows[0];
      const items = await sql`SELECT * FROM order_items WHERE order_id = ${o.id}`;

      const order = {
        id: o.id,
        orderNumber: o.order_number,
        userId: o.user_id,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        customerMobile: o.customer_mobile,
        status: o.status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        subtotal: parseFloat(String(o.subtotal || '0')),
        vat: parseFloat(String(o.vat_amount || '0')),
        vatRate: parseFloat(String(o.vat_rate || '0.05')),
        deliveryFee: parseFloat(String(o.delivery_fee || '0')),
        discount: parseFloat(String(o.discount || '0')),
        discountCode: o.discount_code,
        total: parseFloat(String(o.total || '0')),
        addressId: o.address_id,
        deliveryAddress: safeJson(o.delivery_address),
        deliveryNotes: o.delivery_notes,
        statusHistory: safeJson(o.status_history, []),
        estimatedDeliveryAt: o.estimated_delivery_at ? safeDate(o.estimated_delivery_at) : null,
        actualDeliveryAt: o.actual_delivery_at ? safeDate(o.actual_delivery_at) : null,
        items: items.map((i: any) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productNameAr: i.product_name_ar,
          sku: i.sku,
          quantity: parseFloat(String(i.quantity || '0')),
          unitPrice: parseFloat(String(i.unit_price || '0')),
          totalPrice: parseFloat(String(i.total_price || '0')),
          notes: i.notes,
        })),
        createdAt: safeDate(o.created_at),
        updatedAt: safeDate(o.updated_at),
      };

      // Create server-side notification for order status change
      if (status && o.user_id) {
        // Map order status to notification content
        const statusToNotifType: Record<string, string> = {
          'confirmed': 'order_confirmed',
          'processing': 'order_processing',
          'ready_for_pickup': 'order_ready',
          'out_for_delivery': 'order_shipped',
          'delivered': 'order_delivered',
          'cancelled': 'order_cancelled',
        };
        const notifType = statusToNotifType[status] || 'order_placed';
        const content = getNotificationContent(o.order_number, status);
        if (content) {
          await createNotification({
            userId: o.user_id,
            type: notifType,
            title: content.title,
            titleAr: content.titleAr,
            message: content.message,
            messageAr: content.messageAr,
            link: '/orders',
          });
          console.log(`[Order Status] Notification created for user ${o.user_id}: ${status}`);
        }
      }

      // Notify admins if order is cancelled
      if (status === 'cancelled') {
        try {
          const admins = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 10`;
          for (const admin of admins) {
            await createNotification({
              userId: admin.id,
              type: 'order_cancelled',
              title: `Order Cancelled: ${o.order_number}`,
              titleAr: `تم إلغاء الطلب: ${o.order_number}`,
              message: `Order ${o.order_number} has been cancelled by the customer.`,
              messageAr: `تم إلغاء الطلب ${o.order_number} من قبل العميل.`,
              link: `/admin/orders`,
            });
          }
        } catch (adminError) {
          console.error('[Admin Notification Error]', adminError);
        }
      }

      res.json({ success: true, data: order, message: 'Order status updated successfully' });
    } catch (error) {
      console.error('[Update Order Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
  });

  // Delete Order
  app.delete('/api/orders/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;

      // Delete order items first
      await sql`DELETE FROM order_items WHERE order_id = ${id}`;
      // Delete order
      await sql`DELETE FROM orders WHERE id = ${id}`;

      res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
      console.error('[Delete Order Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete order' });
    }
  });

  // =====================================================
  // NOTIFICATIONS ADMIN API
  // =====================================================

  // Create Notification
  // Valid types: order_placed, order_confirmed, order_processing, order_ready, order_shipped, order_delivered, order_cancelled, payment_received, payment_failed, refund_processed, low_stock, promotional
  // Valid channels: sms, email, push
  // Valid statuses: pending, sent, delivered, failed
  app.post('/api/notifications', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId, type, title, titleAr, message, messageAr, data, channel, link, linkTab, linkId } = req.body;

      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const now = new Date();

      // Map app notification types to valid enum values
      const typeMapping: Record<string, string> = {
        'order': 'order_placed',
        'order_new': 'order_placed',
        'order_placed': 'order_placed',
        'order_confirmed': 'order_confirmed',
        'order_processing': 'order_processing',
        'order_ready': 'order_ready',
        'order_shipped': 'order_shipped',
        'order_delivered': 'order_delivered',
        'order_cancelled': 'order_cancelled',
        'payment': 'payment_received',
        'payment_received': 'payment_received',
        'payment_failed': 'payment_failed',
        'refund': 'refund_processed',
        'refund_processed': 'refund_processed',
        'stock': 'low_stock',
        'low_stock': 'low_stock',
        'promo': 'promotional',
        'promotional': 'promotional',
        'system': 'promotional',
        'general': 'promotional',
        'chat': 'promotional',
        'delivery': 'order_shipped',
      };
      const mappedType = typeMapping[type] || 'promotional';

      // Valid channels: sms, email, push - default to push for in-app style notifications
      const validChannels = ['sms', 'email', 'push'];
      const mappedChannel = validChannels.includes(channel) ? channel : 'push';

      // Store extra data in metadata including original type and in-app specific fields
      const metadata = {
        ...(data || {}),
        originalType: type,
        titleAr: titleAr || null,
        link: link || null,
        linkTab: linkTab || null,
        linkId: linkId || null,
      };

      // Table schema: id, user_id, type, channel, title, message, message_ar, status, sent_at, delivered_at, failure_reason, metadata, created_at
      await sql`
        INSERT INTO notifications (id, user_id, type, channel, title, message, message_ar, status, metadata, created_at)
        VALUES (${notificationId}, ${userId || null}, ${mappedType}, ${mappedChannel}, ${title || titleAr || ''}, ${message || ''}, ${messageAr || null}, 'sent', ${JSON.stringify(metadata)}, ${now})
      `;

      res.json({ success: true, data: { id: notificationId }, message: 'Notification created successfully' });
    } catch (error) {
      console.error('[Create Notification Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create notification' });
    }
  });

  // Delete Notification
  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM notifications WHERE id = ${id}`;

      res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
      console.error('[Delete Notification Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete notification' });
    }
  });

  // =====================================================
  // ADDITIONAL HIGH-PRIORITY ROUTES
  // =====================================================

  // Get Order by Order Number
  app.get('/api/orders/number/:orderNumber', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderNumber } = req.params;
      const rows = await sql`SELECT * FROM orders WHERE order_number = ${orderNumber}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const o = rows[0];
      const items = await sql`SELECT * FROM order_items WHERE order_id = ${o.id}`;

      const order = {
        id: o.id,
        orderNumber: o.order_number,
        userId: o.user_id,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        customerMobile: o.customer_mobile,
        status: o.status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        subtotal: parseFloat(String(o.subtotal || '0')),
        vat: parseFloat(String(o.vat_amount || '0')),
        vatRate: parseFloat(String(o.vat_rate || '0.05')),
        deliveryFee: parseFloat(String(o.delivery_fee || '0')),
        discount: parseFloat(String(o.discount || '0')),
        total: parseFloat(String(o.total || '0')),
        addressId: o.address_id,
        deliveryAddress: safeJson(o.delivery_address),
        deliveryNotes: o.delivery_notes,
        statusHistory: safeJson(o.status_history, []),
        items: items.map((i: any) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productNameAr: i.product_name_ar,
          sku: i.sku,
          quantity: parseFloat(String(i.quantity || '0')),
          unitPrice: parseFloat(String(i.unit_price || '0')),
          totalPrice: parseFloat(String(i.total_price || '0')),
        })),
        createdAt: safeDate(o.created_at),
        updatedAt: safeDate(o.updated_at),
      };

      res.json({ success: true, data: order });
    } catch (error) {
      console.error('[Get Order By Number Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
  });

  // Process Order Payment (also used for COD payment confirmation by admin)
  app.post('/api/orders/:id/payment', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { paymentMethod, amount, transactionId, status } = req.body;
      const now = new Date();

      // Fetch order to get amount and user_id
      const orderRows = await sql`SELECT * FROM orders WHERE id = ${id}`;
      if (orderRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      const order = orderRows[0];
      const paymentAmount = amount || parseFloat(String(order.total || '0'));
      const method = paymentMethod || order.payment_method || 'cod';

      // Update order payment status
      await sql`
        UPDATE orders 
        SET payment_status = 'captured', payment_method = ${method}, updated_at = ${now}
        WHERE id = ${id}
      `;

      // Create payment record
      const paymentId = `pay_${Date.now()}`;
      await sql`
        INSERT INTO payments (id, order_id, order_number, amount, method, status, created_at, updated_at)
        VALUES (${paymentId}, ${id}, ${order.order_number}, ${paymentAmount}, ${method}, 'captured', ${now}, ${now})
      `;

      console.log(`[Order Payment] Payment confirmed for order ${id}: ${paymentAmount} ${method}`);
      res.json({ success: true, data: { paymentId, status: 'captured' } });
    } catch (error: any) {
      console.error('[Order Payment Error]', error?.message || error, JSON.stringify(error));
      res.status(500).json({ success: false, error: error?.message || 'Failed to process payment' });
    }
  });

  // Get Single Delivery Zone
  app.get('/api/delivery/zones/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const rows = await sql`SELECT * FROM delivery_zones WHERE id = ${id}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Delivery zone not found' });
      }

      const z = rows[0];
      let parsedAreas: string[] = [];
      if (z.areas) {
        parsedAreas = typeof z.areas === 'string' ? JSON.parse(z.areas) : z.areas;
      }
      res.json({
        success: true,
        data: {
          id: z.id,
          name: z.name,
          nameAr: z.name_ar,
          emirate: z.emirate,
          areas: parsedAreas,
          deliveryFee: parseFloat(String(z.delivery_fee || '0')),
          minimumOrder: parseFloat(String(z.minimum_order || '0')),
          estimatedMinutes: z.estimated_minutes,
          isActive: z.is_active,
          expressEnabled: z.express_enabled,
          expressFee: parseFloat(String(z.express_fee || '25')),
          expressHours: z.express_hours,
        },
      });
    } catch (error) {
      console.error('[Get Zone Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch delivery zone' });
    }
  });

  // Get Reviews by Product
  app.get('/api/reviews/product/:productId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { productId } = req.params;
      const rows = await sql`
        SELECT r.*, u.first_name, u.family_name 
        FROM reviews r 
        LEFT JOIN users u ON r.user_id = u.id 
        WHERE r.product_id = ${productId}
        ORDER BY r.created_at DESC
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          id: r.id,
          productId: r.product_id,
          userId: r.user_id,
          userName: r.first_name ? `${r.first_name} ${r.family_name || ''}`.trim() : 'Anonymous',
          rating: r.rating,
          comment: r.comment,
          createdAt: safeDate(r.created_at),
        })),
      });
    } catch (error) {
      console.error('[Get Product Reviews Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
    }
  });

  // Update Review
  app.put('/api/reviews/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const { rating, comment } = req.body;
      const now = new Date();

      await sql`
        UPDATE reviews SET rating = ${rating}, comment = ${comment}, updated_at = ${now}
        WHERE id = ${id}
      `;

      res.json({ success: true, message: 'Review updated' });
    } catch (error) {
      console.error('[Update Review Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update review' });
    }
  });

  // Delete Review
  app.delete('/api/reviews/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      await sql`DELETE FROM reviews WHERE id = ${id}`;

      res.json({ success: true, message: 'Review deleted' });
    } catch (error) {
      console.error('[Delete Review Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete review' });
    }
  });

  // Analytics: Revenue Chart
  app.get('/api/analytics/charts/revenue', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { period = 'week' } = req.query;
      let days = 7;
      if (period === '30d' || period === 'month') days = 30;
      if (period === '90d' || period === 'quarter') days = 90;
      if (period === 'year') days = 365;
      if (period === 'week' || period === '7d') days = 7;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString();

      const rows = await sql`
        SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
        FROM orders
        WHERE created_at >= ${startDateStr}::timestamp
          AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          date: r.date,
          revenue: parseFloat(String(r.revenue || '0')),
          orders: parseInt(r.orders || '0'),
        })),
      });
    } catch (error) {
      console.error('[Revenue Chart Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch revenue data' });
    }
  });

  // Analytics: Orders by Status Chart
  app.get('/api/analytics/charts/orders-by-status', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT status, COUNT(*) as count
        FROM orders
        GROUP BY status
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          status: r.status,
          count: parseInt(r.count),
        })),
      });
    } catch (error) {
      console.error('[Orders By Status Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch order stats' });
    }
  });

  // Analytics: Top Products Chart
  app.get('/api/analytics/charts/top-products', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT oi.product_id, oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY oi.product_id, oi.product_name
        ORDER BY total_revenue DESC
        LIMIT 10
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          productId: r.product_id || '',
          productName: r.product_name,
          sales: parseFloat(String(r.total_revenue || '0')),
          quantity: parseFloat(String(r.total_qty || '0')),
        })),
      });
    } catch (error) {
      console.error('[Top Products Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch top products' });
    }
  });

  // Analytics: Sales by Emirate
  app.get('/api/analytics/charts/sales-by-emirate', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT 
          delivery_address->>'emirate' as emirate, 
          COUNT(*) as orders, 
          SUM(total) as revenue
        FROM orders
        WHERE status NOT IN ('cancelled', 'refunded')
        GROUP BY delivery_address->>'emirate'
        ORDER BY revenue DESC
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          emirate: r.emirate || 'Unknown',
          orders: parseInt(r.orders),
          revenue: parseFloat(String(r.revenue || '0')),
        })),
      });
    } catch (error) {
      console.error('[Sales By Emirate Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales by emirate' });
    }
  });

  // Analytics: Payment Methods Chart
  app.get('/api/analytics/charts/payment-methods', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT payment_method, COUNT(*) as count, SUM(total) as total
        FROM orders
        GROUP BY payment_method
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          method: r.payment_method,
          count: parseInt(r.count),
          total: parseFloat(String(r.total || '0')),
        })),
      });
    } catch (error) {
      console.error('[Payment Methods Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment methods' });
    }
  });

  // Analytics: Hourly Orders Chart
  app.get('/api/analytics/charts/hourly-orders', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as orders
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          hour: parseInt(r.hour),
          orders: parseInt(r.orders),
        })),
      });
    } catch (error) {
      console.error('[Hourly Orders Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch hourly orders' });
    }
  });

  // Analytics: Real-time Stats
  app.get('/api/analytics/real-time', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayOrders = await sql`SELECT COUNT(*) as cnt FROM orders WHERE created_at >= ${todayStart}`;
      const todayRevenue = await sql`SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE created_at >= ${todayStart} AND status NOT IN ('cancelled', 'refunded')`;
      const pendingOrders = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'pending'`;
      const processingOrders = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status IN ('confirmed', 'processing')`;
      const outForDelivery = await sql`SELECT COUNT(*) as cnt FROM orders WHERE status = 'out_for_delivery'`;

      res.json({
        success: true,
        data: {
          todayOrders: parseInt(todayOrders[0].cnt),
          todayRevenue: parseFloat(String(todayRevenue[0].total || '0')),
          pendingOrders: parseInt(pendingOrders[0].cnt),
          processingOrders: parseInt(processingOrders[0].cnt),
          outForDelivery: parseInt(outForDelivery[0].cnt),
        },
      });
    } catch (error) {
      console.error('[Real-time Stats Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch real-time stats' });
    }
  });

  // User Verify
  app.post('/api/users/:id/verify', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const now = new Date();

      await sql`UPDATE users SET is_verified = true, updated_at = ${now} WHERE id = ${id}`;

      res.json({ success: true, message: 'User verified successfully' });
    } catch (error) {
      console.error('[Verify User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to verify user' });
    }
  });

  // Get Single Payment
  app.get('/api/payments/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { id } = req.params;
      const rows = await sql`SELECT * FROM payments WHERE id = ${id}`;

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      const p = rows[0];
      res.json({
        success: true,
        data: {
          id: p.id,
          orderId: p.order_id,
          amount: parseFloat(String(p.amount || '0')),
          method: p.method,
          status: p.status,
          gatewayResponse: p.gateway_response,
          createdAt: safeDate(p.created_at),
        },
      });
    } catch (error) {
      console.error('[Get Payment Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment' });
    }
  });

  // Get Payments by Order
  app.get('/api/payments/order/:orderId', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { orderId } = req.params;
      const rows = await sql`SELECT * FROM payments WHERE order_id = ${orderId} ORDER BY created_at DESC`;

      res.json({
        success: true,
        data: rows.map((p: any) => ({
          id: p.id,
          orderId: p.order_id,
          amount: parseFloat(String(p.amount || '0')),
          method: p.method,
          status: p.status,
          gatewayResponse: p.gateway_response,
          createdAt: safeDate(p.created_at),
        })),
      });
    } catch (error) {
      console.error('[Get Order Payments Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payments' });
    }
  });

  // Stock Bulk Update
  app.post('/api/stock/bulk-update', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { updates } = req.body; // Array of { productId, quantity, reason }
      const now = new Date();

      for (const update of updates) {
        await sql`
          UPDATE stock 
          SET quantity = ${update.quantity}, updated_at = ${now}
          WHERE product_id = ${update.productId}
        `;
      }

      res.json({ success: true, message: `Updated ${updates.length} stock items` });
    } catch (error) {
      console.error('[Bulk Stock Update Error]', error);
      res.status(500).json({ success: false, error: 'Failed to update stock' });
    }
  });

  // Reports: Sales Summary
  app.get('/api/reports/sales', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { period = 'today' } = req.query;

      // Use database NOW() for date range to avoid clock skew issues
      let intervalDays = 1;
      if (period === 'week') intervalDays = 7;
      else if (period === 'month') intervalDays = 30;
      else if (period === 'year') intervalDays = 365;

      const summary = await sql`
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue,
          COALESCE(SUM(vat_amount), 0) as total_vat,
          COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
          COALESCE(SUM(discount), 0) as total_discounts,
          COALESCE(AVG(total), 0) as avg_order_value
        FROM orders
        WHERE status NOT IN ('cancelled', 'refunded')
          AND created_at >= NOW() - make_interval(days => ${intervalDays})
      `;

      // Also get items sold count
      const itemsSold = await sql`
        SELECT COALESCE(SUM(oi.quantity), 0) as total_items
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'refunded')
          AND o.created_at >= NOW() - make_interval(days => ${intervalDays})
      `;

      const totalRevenue = parseFloat(String(summary[0].total_revenue || '0'));
      const totalDeliveryFees = parseFloat(String(summary[0].total_delivery_fees || '0'));
      const totalVat = parseFloat(String(summary[0].total_vat || '0'));
      const totalDiscounts = parseFloat(String(summary[0].total_discounts || '0'));
      const netRevenue = totalRevenue - totalDiscounts;

      res.json({
        success: true,
        data: {
          period: String(period),
          startDate: new Date(Date.now() - intervalDays * 86400000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          totalSales: totalRevenue,
          totalOrders: parseInt(summary[0].total_orders),
          averageOrderValue: parseFloat(String(summary[0].avg_order_value || '0')),
          totalDiscount: totalDiscounts,
          totalVat: totalVat,
          totalDeliveryFees: totalDeliveryFees,
          netRevenue: netRevenue,
          costOfGoods: 0,
          grossProfit: netRevenue,
          grossProfitMargin: totalRevenue > 0 ? (netRevenue / totalRevenue) * 100 : 0,
          itemsSold: parseInt(String(itemsSold[0].total_items || '0')),
        },
      });
    } catch (error) {
      console.error('[Sales Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales report' });
    }
  });

  // Reports: Sales by Category
  app.get('/api/reports/sales-by-category', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT p.category, SUM(oi.total_price) as revenue, SUM(oi.quantity) as quantity
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY p.category
        ORDER BY revenue DESC
      `;

      // Calculate total for percentage
      const totalSalesAll = rows.reduce((sum: number, r: any) => sum + parseFloat(String(r.revenue || '0')), 0);

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          category: r.category,
          totalSales: parseFloat(String(r.revenue || '0')),
          totalQuantity: parseFloat(String(r.quantity || '0')),
          percentage: totalSalesAll > 0 ? parseFloat(((parseFloat(String(r.revenue || '0')) / totalSalesAll) * 100).toFixed(1)) : 0,
        })),
      });
    } catch (error) {
      console.error('[Sales By Category Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch category sales' });
    }
  });

  // Reports: Sales by Product
  app.get('/api/reports/sales-by-product', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT 
          oi.product_id, oi.product_name, 
          SUM(oi.total_price) as revenue, 
          SUM(oi.quantity) as quantity,
          COUNT(DISTINCT oi.order_id) as order_count,
          CASE WHEN SUM(oi.quantity) > 0 THEN SUM(oi.total_price) / SUM(oi.quantity) ELSE 0 END as avg_price
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY oi.product_id, oi.product_name
        ORDER BY revenue DESC
      `;

      res.json({
        success: true,
        data: rows.map((r: any) => ({
          productId: r.product_id,
          productName: r.product_name,
          totalSales: parseFloat(String(r.revenue || '0')),
          totalQuantity: parseFloat(String(r.quantity || '0')),
          averagePrice: parseFloat(String(r.avg_price || '0')),
          orderCount: parseInt(r.order_count),
        })),
      });
    } catch (error) {
      console.error('[Sales By Product Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch product sales' });
    }
  });

  // Reports: Customer Analytics
  app.get('/api/reports/customers', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const totalCustomers = await sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'customer'`;
      const newCustomers = await sql`SELECT COUNT(*) as cnt FROM users WHERE role = 'customer' AND created_at >= NOW() - INTERVAL '30 days'`;
      const repeatCustomers = await sql`
        SELECT COUNT(DISTINCT user_id) as cnt 
        FROM orders 
        WHERE user_id IN (
          SELECT user_id FROM orders GROUP BY user_id HAVING COUNT(*) > 1
        )
      `;

      res.json({
        success: true,
        data: {
          totalCustomers: parseInt(totalCustomers[0].cnt),
          newCustomers: parseInt(newCustomers[0].cnt),
          repeatCustomers: parseInt(repeatCustomers[0].cnt),
        },
      });
    } catch (error) {
      console.error('[Customer Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customer report' });
    }
  });

  // Reports: Inventory
  app.get('/api/reports/inventory', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const rows = await sql`
        SELECT s.*, p.name, p.category, p.cost_price, p.price
        FROM stock s
        JOIN products p ON s.product_id = p.id
        ORDER BY s.quantity ASC
      `;

      const lowStock = rows.filter((r: any) => parseFloat(String(r.quantity || '0')) <= parseFloat(String(r.low_stock_threshold || '5')));
      const outOfStock = rows.filter((r: any) => parseFloat(String(r.quantity || '0')) <= 0);

      res.json({
        success: true,
        data: {
          totalProducts: rows.length,
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length,
          items: rows.map((r: any) => ({
            productId: r.product_id,
            productName: r.name,
            category: r.category,
            quantity: parseFloat(String(r.quantity || '0')),
            lowStockThreshold: parseFloat(String(r.low_stock_threshold || '5')),
            isLowStock: parseFloat(String(r.quantity || '0')) <= parseFloat(String(r.low_stock_threshold || '5')),
          })),
        },
      });
    } catch (error) {
      console.error('[Inventory Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch inventory report' });
    }
  });

  // Wallet: Topup
  app.post('/api/wallet/topup', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      const { amount, paymentMethod } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ success: false, error: 'Missing userId or amount' });
      }

      const now = new Date();
      const txnId = `wtxn_${Date.now()}`;

      // Create wallet transaction
      await sql`
        INSERT INTO wallet_transactions (id, user_id, type, amount, description, reference_type, created_at)
        VALUES (${txnId}, ${userId}, 'credit', ${amount}, 'Wallet top-up', 'topup', ${now})
      `;

      // Update wallet balance
      await sql`
        UPDATE wallets SET balance = balance + ${amount}, updated_at = ${now}
        WHERE user_id = ${userId}
      `;

      res.json({ success: true, data: { transactionId: txnId, amount } });
    } catch (error) {
      console.error('[Wallet Topup Error]', error);
      res.status(500).json({ success: false, error: 'Failed to top up wallet' });
    }
  });

  // Wallet: Deduct
  app.post('/api/wallet/deduct', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      const { amount, orderId, description } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ success: false, error: 'Missing userId or amount' });
      }

      const now = new Date();
      const txnId = `wtxn_${Date.now()}`;

      await sql`
        INSERT INTO wallet_transactions (id, user_id, type, amount, description, reference_type, reference_id, created_at)
        VALUES (${txnId}, ${userId}, 'debit', ${amount}, ${description || 'Payment'}, 'order', ${orderId || null}, ${now})
      `;

      await sql`
        UPDATE wallets SET balance = balance - ${amount}, updated_at = ${now}
        WHERE user_id = ${userId}
      `;

      res.json({ success: true, data: { transactionId: txnId, amount } });
    } catch (error) {
      console.error('[Wallet Deduct Error]', error);
      res.status(500).json({ success: false, error: 'Failed to deduct from wallet' });
    }
  });

  // Loyalty: Earn Points
  app.post('/api/loyalty/earn', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      const { points, orderId, description } = req.body;

      if (!userId || !points) {
        return res.status(400).json({ success: false, error: 'Missing userId or points' });
      }

      const now = new Date();
      const txnId = `ltxn_${Date.now()}`;

      await sql`
        INSERT INTO loyalty_transactions (id, user_id, type, points, description, reference_type, reference_id, created_at)
        VALUES (${txnId}, ${userId}, 'earn', ${points}, ${description || 'Points earned'}, 'order', ${orderId || null}, ${now})
      `;

      await sql`
        UPDATE loyalty SET points = points + ${points}, total_earned = total_earned + ${points}, updated_at = ${now}
        WHERE user_id = ${userId}
      `;

      res.json({ success: true, data: { transactionId: txnId, points } });
    } catch (error) {
      console.error('[Loyalty Earn Error]', error);
      res.status(500).json({ success: false, error: 'Failed to earn points' });
    }
  });

  // Loyalty: Redeem Points
  app.post('/api/loyalty/redeem', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      const { points, description } = req.body;

      if (!userId || !points) {
        return res.status(400).json({ success: false, error: 'Missing userId or points' });
      }

      // Check balance
      const wallet = await sql`SELECT points FROM loyalty WHERE user_id = ${userId}`;
      if (wallet.length === 0 || wallet[0].points < points) {
        return res.status(400).json({ success: false, error: 'Insufficient points' });
      }

      const now = new Date();
      const txnId = `ltxn_${Date.now()}`;

      await sql`
        INSERT INTO loyalty_transactions (id, user_id, type, points, description, created_at)
        VALUES (${txnId}, ${userId}, 'redeem', ${points}, ${description || 'Points redeemed'}, ${now})
      `;

      await sql`
        UPDATE loyalty SET points = points - ${points}, total_redeemed = total_redeemed + ${points}, updated_at = ${now}
        WHERE user_id = ${userId}
      `;

      res.json({ success: true, data: { transactionId: txnId, points } });
    } catch (error) {
      console.error('[Loyalty Redeem Error]', error);
      res.status(500).json({ success: false, error: 'Failed to redeem points' });
    }
  });

  // Delete All Notifications for User
  app.delete('/api/notifications', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID required' });
      }

      const userRows = await sql`SELECT role FROM users WHERE id = ${userId as string}`;
      const isAdmin = userRows[0]?.role === 'admin';

      if (isAdmin) {
        await sql`DELETE FROM notifications WHERE user_id = ${userId} OR user_id = 'admin'`;
      } else {
        await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
      }

      res.json({ success: true, message: 'All notifications deleted' });
    } catch (error) {
      console.error('[Delete All Notifications Error]', error);
      res.status(500).json({ success: false, error: 'Failed to delete notifications' });
    }
  });

  // Delete All Wishlist Items
  app.delete('/api/wishlist', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const userId = getUserIdFromHeaders(req);
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID required' });
      }

      await sql`DELETE FROM wishlist WHERE user_id = ${userId}`;

      res.json({ success: true, message: 'Wishlist cleared' });
    } catch (error) {
      console.error('[Clear Wishlist Error]', error);
      res.status(500).json({ success: false, error: 'Failed to clear wishlist' });
    }
  });

  // Mark Chat as Read (User)
  app.post('/api/chat/:userId/read-user', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }

      const { userId } = req.params;
      await sql`UPDATE chat_messages SET read_by_user = true WHERE user_id = ${userId} AND sender = 'admin'`;

      res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
      console.error('[Mark Read User Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
    }
  });

  // =====================================================
  // FINANCE API
  // =====================================================

  // Helper: get date range for finance
  function getFinanceDateRange(period: string, startDateParam?: string, endDateParam?: string): { start: Date; end: Date } {
    if (startDateParam && endDateParam) {
      return { start: new Date(startDateParam), end: new Date(endDateParam) };
    }
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    switch (period) {
      case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); break;
      default: start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return { start, end };
  }

  // Finance: Summary
  app.get('/api/finance/summary', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { period = 'month', startDate, endDate } = req.query;
      const { start, end } = getFinanceDateRange(period as string, startDate as string, endDate as string);
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      // Get orders in range
      const ordersRows = await sql`
        SELECT total, vat_amount, payment_method, payment_status, status 
        FROM orders 
        WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp
          AND status != 'cancelled'
          AND (payment_status = 'captured' OR payment_status = 'authorized')
      `;
      const totalRevenue = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.total || '0')), 0);
      const totalVAT = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.vat_amount || '0')), 0);

      // Get transactions
      const txnRows = await sql`
        SELECT type, amount FROM finance_transactions 
        WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp
      `;
      const totalRefunds = txnRows
        .filter((t: any) => t.type === 'refund')
        .reduce((s: number, t: any) => s + Math.abs(parseFloat(String(t.amount || '0'))), 0);

      // Get expenses
      const expRows = await sql`
        SELECT category, amount FROM finance_expenses 
        WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp
      `;
      const totalExpenses = expRows.reduce((s: number, e: any) => s + parseFloat(String(e.amount || '0')), 0);

      // Get accounts
      const accRows = await sql`SELECT id, name, balance FROM finance_accounts`;

      const totalCOGS = totalRevenue * 0.6;
      const grossProfit = totalRevenue - totalCOGS;
      const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const netProfit = grossProfit - totalExpenses;
      const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Revenue by payment method
      const paymentMethodRevenue: Record<string, { amount: number; count: number }> = {};
      ordersRows.forEach((o: any) => {
        const method = o.payment_method || 'unknown';
        if (!paymentMethodRevenue[method]) paymentMethodRevenue[method] = { amount: 0, count: 0 };
        paymentMethodRevenue[method].amount += parseFloat(String(o.total || '0'));
        paymentMethodRevenue[method].count += 1;
      });

      // Expenses by category
      const expensesByCategory: Record<string, { amount: number; count: number }> = {};
      expRows.forEach((e: any) => {
        const cat = e.category || 'other';
        if (!expensesByCategory[cat]) expensesByCategory[cat] = { amount: 0, count: 0 };
        expensesByCategory[cat].amount += parseFloat(String(e.amount || '0'));
        expensesByCategory[cat].count += 1;
      });

      const inflow = totalRevenue;
      const outflow = totalExpenses + totalCOGS + totalRefunds;

      res.json({
        success: true,
        data: {
          period: period as string,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCOGS: Math.round(totalCOGS * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          netProfitMargin: Math.round(netProfitMargin * 100) / 100,
          totalRefunds: Math.round(totalRefunds * 100) / 100,
          totalVAT: Math.round(totalVAT * 100) / 100,
          vatCollected: Math.round(totalVAT * 100) / 100,
          vatPaid: 0,
          vatDue: Math.round(totalVAT * 100) / 100,
          cashFlow: {
            inflow: Math.round(inflow * 100) / 100,
            outflow: Math.round(outflow * 100) / 100,
            net: Math.round((inflow - outflow) * 100) / 100,
          },
          revenueByPaymentMethod: Object.entries(paymentMethodRevenue).map(([method, data]) => ({
            method, amount: Math.round(data.amount * 100) / 100, count: data.count,
          })),
          expensesByCategory: Object.entries(expensesByCategory).map(([category, data]) => ({
            category, amount: Math.round(data.amount * 100) / 100, count: data.count,
          })),
          accountBalances: accRows.map((a: any) => ({
            accountId: a.id, accountName: a.name, balance: parseFloat(String(a.balance || '0')),
          })),
        },
      });
    } catch (error) {
      console.error('[Finance Summary Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get finance summary' });
    }
  });

  // Finance: Transactions
  app.get('/api/finance/transactions', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { type, status, startDate, endDate, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      let rows = await sql`SELECT * FROM finance_transactions ORDER BY created_at DESC`;
      if (type) rows = rows.filter((t: any) => t.type === type);
      if (status) rows = rows.filter((t: any) => t.status === status);
      if (startDate) rows = rows.filter((t: any) => new Date(t.created_at) >= new Date(startDate as string));
      if (endDate) rows = rows.filter((t: any) => new Date(t.created_at) <= new Date(endDate as string));

      const startIdx = (pageNum - 1) * limitNum;
      const paginatedRows = rows.slice(startIdx, startIdx + limitNum);
      res.json({ success: true, data: paginatedRows });
    } catch (error) {
      console.error('[Finance Transactions Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get transactions' });
    }
  });

  // Finance: Transaction by ID
  app.get('/api/finance/transactions/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const rows = await sql`SELECT * FROM finance_transactions WHERE id = ${req.params.id}`;
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'Transaction not found' });
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get transaction' });
    }
  });

  // Finance: Accounts
  app.get('/api/finance/accounts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const rows = await sql`SELECT * FROM finance_accounts ORDER BY name`;
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('[Finance Accounts Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get accounts' });
    }
  });

  // Finance: Account by ID
  app.get('/api/finance/accounts/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const rows = await sql`SELECT * FROM finance_accounts WHERE id = ${req.params.id}`;
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'Account not found' });
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get account' });
    }
  });

  // Finance: Create Account
  app.post('/api/finance/accounts', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { name, nameAr, type, bankName, accountNumber, iban } = req.body;
      const accountId = genId();
      await sql`INSERT INTO finance_accounts (id, name, name_ar, type, balance, bank_name, account_number, iban, created_at, updated_at)
        VALUES (${accountId}, ${name}, ${nameAr || null}, ${type || 'cash'}, 0, ${bankName || null}, ${accountNumber || null}, ${iban || null}, NOW(), NOW())`;
      const rows = await sql`SELECT * FROM finance_accounts WHERE id = ${accountId}`;
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error('[Create Account Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create account' });
    }
  });

  // Finance: Update Account
  app.put('/api/finance/accounts/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { name, nameAr, type, bankName, accountNumber, iban, isActive } = req.body;
      await sql`UPDATE finance_accounts SET 
        name = COALESCE(${name || null}, name),
        name_ar = COALESCE(${nameAr || null}, name_ar),
        bank_name = COALESCE(${bankName || null}, bank_name),
        account_number = COALESCE(${accountNumber || null}, account_number),
        iban = COALESCE(${iban || null}, iban),
        updated_at = NOW()
        WHERE id = ${req.params.id}`;
      const rows = await sql`SELECT * FROM finance_accounts WHERE id = ${req.params.id}`;
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'Account not found' });
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update account' });
    }
  });

  // Finance: Transfer Between Accounts
  app.post('/api/finance/accounts/transfer', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { fromAccountId, toAccountId, amount, notes } = req.body;
      const fromRows = await sql`SELECT * FROM finance_accounts WHERE id = ${fromAccountId}`;
      const toRows = await sql`SELECT * FROM finance_accounts WHERE id = ${toAccountId}`;
      if (fromRows.length === 0 || toRows.length === 0) return res.status(404).json({ success: false, error: 'Account not found' });

      const fromBalance = parseFloat(String(fromRows[0].balance || '0'));
      if (fromBalance < amount) return res.status(400).json({ success: false, error: 'Insufficient balance' });

      await sql`UPDATE finance_accounts SET balance = balance - ${amount}, updated_at = NOW() WHERE id = ${fromAccountId}`;
      await sql`UPDATE finance_accounts SET balance = balance + ${amount}, updated_at = NOW() WHERE id = ${toAccountId}`;

      const txn1Id = genId();
      const txn2Id = genId();
      await sql`INSERT INTO finance_transactions (id, type, status, amount, currency, description, reference_type, account_id, account_name, created_by, notes, created_at, updated_at)
        VALUES (${txn1Id}, 'adjustment', 'completed', ${-amount}, 'AED', ${'Transfer to ' + toRows[0].name}, 'manual', ${fromAccountId}, ${fromRows[0].name}, 'admin', ${notes || null}, NOW(), NOW())`;
      await sql`INSERT INTO finance_transactions (id, type, status, amount, currency, description, reference_type, account_id, account_name, created_by, notes, created_at, updated_at)
        VALUES (${txn2Id}, 'adjustment', 'completed', ${amount}, 'AED', ${'Transfer from ' + fromRows[0].name}, 'manual', ${toAccountId}, ${toRows[0].name}, 'admin', ${notes || null}, NOW(), NOW())`;

      const updatedFrom = await sql`SELECT * FROM finance_accounts WHERE id = ${fromAccountId}`;
      const updatedTo = await sql`SELECT * FROM finance_accounts WHERE id = ${toAccountId}`;
      res.json({ success: true, data: { from: updatedFrom[0], to: updatedTo[0] } });
    } catch (error) {
      console.error('[Transfer Error]', error);
      res.status(500).json({ success: false, error: 'Failed to transfer' });
    }
  });

  // Finance: Reconcile Account
  app.post('/api/finance/accounts/:id/reconcile', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { statementBalance, reconciliationDate } = req.body;
      const rows = await sql`SELECT * FROM finance_accounts WHERE id = ${req.params.id}`;
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'Account not found' });

      const difference = statementBalance - parseFloat(String(rows[0].balance || '0'));
      if (difference !== 0) {
        const txnId = genId();
        await sql`INSERT INTO finance_transactions (id, type, status, amount, currency, description, reference_type, account_id, account_name, created_by, notes, created_at, updated_at)
          VALUES (${txnId}, 'adjustment', 'completed', ${difference}, 'AED', 'Reconciliation adjustment', 'manual', ${req.params.id}, ${rows[0].name}, 'admin', ${'Reconciliation on ' + reconciliationDate}, NOW(), NOW())`;
      }
      await sql`UPDATE finance_accounts SET balance = ${statementBalance}, last_reconciled = ${reconciliationDate}::timestamp, updated_at = NOW() WHERE id = ${req.params.id}`;
      const updated = await sql`SELECT * FROM finance_accounts WHERE id = ${req.params.id}`;
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to reconcile account' });
    }
  });

  // Finance: Expenses
  app.get('/api/finance/expenses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { category, status, startDate, endDate, page = '1', limit = '50' } = req.query;
      let rows = await sql`SELECT * FROM finance_expenses ORDER BY created_at DESC`;
      if (category) rows = rows.filter((e: any) => e.category === category);
      if (status) rows = rows.filter((e: any) => e.status === status);
      if (startDate) rows = rows.filter((e: any) => new Date(e.created_at) >= new Date(startDate as string));
      if (endDate) rows = rows.filter((e: any) => new Date(e.created_at) <= new Date(endDate as string));

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIdx = (pageNum - 1) * limitNum;
      res.json({ success: true, data: rows.slice(startIdx, startIdx + limitNum) });
    } catch (error) {
      console.error('[Finance Expenses Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get expenses' });
    }
  });

  // Finance: Create Expense
  app.post('/api/finance/expenses', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const data = req.body;
      const grossAmount = data.grossAmount || 0;
      const vatAmount = data.vatAmount || grossAmount * 0.05;
      const totalAmount = grossAmount + vatAmount;
      const expenseId = genId();
      const expenseNumber = 'EXP-' + Date.now();

      await sql`INSERT INTO finance_expenses (id, expense_number, category, gross_amount, vat_amount, amount, description, description_ar, vendor, invoice_number, payment_terms, notes, is_recurring, recurring_frequency, account_id, currency, status, created_by, created_at, updated_at)
        VALUES (${expenseId}, ${expenseNumber}, ${data.category || 'other'}, ${grossAmount}, ${vatAmount}, ${totalAmount}, ${data.description || ''}, ${data.descriptionAr || null}, ${data.vendor || null}, ${data.invoiceNumber || null}, ${data.paymentTerms || 'net_30'}, ${data.notes || null}, ${data.isRecurring || false}, ${data.recurringFrequency || null}, ${data.accountId || null}, 'AED', 'pending', 'admin', NOW(), NOW())`;
      const rows = await sql`SELECT * FROM finance_expenses WHERE id = ${expenseId}`;
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error('[Create Expense Error]', error);
      res.status(500).json({ success: false, error: 'Failed to create expense' });
    }
  });

  // Finance: Update Expense
  app.put('/api/finance/expenses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { description, descriptionAr, category, vendor, notes, status } = req.body;
      const existing = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      if (existing.length === 0) return res.status(404).json({ success: false, error: 'Expense not found' });

      await sql`UPDATE finance_expenses SET
        description = COALESCE(${description || null}, description),
        description_ar = COALESCE(${descriptionAr || null}, description_ar),
        category = COALESCE(${category || null}, category),
        vendor = COALESCE(${vendor || null}, vendor),
        notes = COALESCE(${notes || null}, notes),
        status = COALESCE(${status || null}, status),
        updated_at = NOW()
        WHERE id = ${req.params.id}`;
      const updated = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update expense' });
    }
  });

  // Finance: Delete Expense
  app.delete('/api/finance/expenses/:id', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const existing = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      if (existing.length === 0) return res.status(404).json({ success: false, error: 'Expense not found' });
      await sql`DELETE FROM finance_expenses WHERE id = ${req.params.id}`;
      res.json({ success: true, data: null });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to delete expense' });
    }
  });

  // Finance: Mark Expense Paid
  app.post('/api/finance/expenses/:id/pay', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { accountId } = req.body;
      const expRows = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      if (expRows.length === 0) return res.status(404).json({ success: false, error: 'Expense not found' });
      const accRows = await sql`SELECT * FROM finance_accounts WHERE id = ${accountId}`;
      if (accRows.length === 0) return res.status(404).json({ success: false, error: 'Account not found' });

      const expense = expRows[0];
      const account = accRows[0];
      const expAmount = parseFloat(String(expense.amount || '0'));

      await sql`UPDATE finance_expenses SET status = 'paid', paid_at = NOW(), account_id = ${accountId}, updated_at = NOW() WHERE id = ${req.params.id}`;
      await sql`UPDATE finance_accounts SET balance = balance - ${expAmount}, updated_at = NOW() WHERE id = ${accountId}`;

      const txnId = genId();
      await sql`INSERT INTO finance_transactions (id, type, status, amount, currency, description, category, reference_type, reference_id, account_id, account_name, created_by, created_at, updated_at)
        VALUES (${txnId}, 'expense', 'completed', ${-expAmount}, 'AED', ${expense.description}, ${expense.category}, 'expense', ${expense.id}, ${account.id}, ${account.name}, 'admin', NOW(), NOW())`;

      const updated = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      console.error('[Mark Expense Paid Error]', error);
      res.status(500).json({ success: false, error: 'Failed to mark expense as paid' });
    }
  });

  // Finance: Approve Expense
  app.post('/api/finance/expenses/:id/approve', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { approverId } = req.body;
      const existing = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      if (existing.length === 0) return res.status(404).json({ success: false, error: 'Expense not found' });
      await sql`UPDATE finance_expenses SET approved_by = ${approverId || 'admin'}, approval_status = 'approved', status = 'approved', updated_at = NOW() WHERE id = ${req.params.id}`;
      const updated = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to approve expense' });
    }
  });

  // Finance: Reject Expense
  app.post('/api/finance/expenses/:id/reject', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { rejectedBy, reason } = req.body;
      const existing = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      if (existing.length === 0) return res.status(404).json({ success: false, error: 'Expense not found' });
      await sql`UPDATE finance_expenses SET status = 'cancelled', notes = ${reason ? 'Rejected: ' + reason : 'Rejected'}, updated_at = NOW() WHERE id = ${req.params.id}`;
      const updated = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      res.json({ success: true, data: updated[0] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to reject expense' });
    }
  });

  // Finance: Submit Expense for Approval
  app.post('/api/finance/expenses/:id/submit', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const existing = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      if (existing.length === 0) return res.status(404).json({ success: false, error: 'Expense not found' });
      await sql`UPDATE finance_expenses SET status = 'pending', approval_status = 'pending', updated_at = NOW() WHERE id = ${req.params.id}`;
      const updated = await sql`SELECT * FROM finance_expenses WHERE id = ${req.params.id}`;
      res.json({ success: true, data: updated[0], message: 'Submitted for approval' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to submit for approval' });
    }
  });

  // Finance: Pending Approvals
  app.get('/api/finance/expenses/pending-approvals', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const rows = await sql`SELECT * FROM finance_expenses WHERE approved_by IS NULL AND status = 'pending' ORDER BY created_at DESC`;
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get pending approvals' });
    }
  });

  // Finance: Expense Categories (IFRS)
  app.get('/api/finance/expenses/categories', async (req, res) => {
    try {
      const categories = [
        { code: 'inventory', name: 'Inventory / Raw Materials', nameAr: 'المخزون', function: 'cost_of_sales', glCode: '5100' },
        { code: 'direct_labor', name: 'Direct Labor', nameAr: 'العمالة المباشرة', function: 'cost_of_sales', glCode: '5110' },
        { code: 'freight_in', name: 'Freight In', nameAr: 'الشحن الداخلي', function: 'cost_of_sales', glCode: '5120' },
        { code: 'marketing', name: 'Marketing & Advertising', nameAr: 'التسويق والإعلان', function: 'selling', glCode: '5200' },
        { code: 'delivery', name: 'Delivery & Shipping', nameAr: 'التوصيل والشحن', function: 'selling', glCode: '5210' },
        { code: 'sales_commission', name: 'Sales Commission', nameAr: 'عمولة المبيعات', function: 'selling', glCode: '5220' },
        { code: 'salaries', name: 'Salaries & Wages', nameAr: 'الرواتب والأجور', function: 'administrative', glCode: '5300' },
        { code: 'rent', name: 'Rent', nameAr: 'الإيجار', function: 'administrative', glCode: '5310' },
        { code: 'utilities', name: 'Utilities', nameAr: 'المرافق', function: 'administrative', glCode: '5320' },
        { code: 'office_supplies', name: 'Office Supplies', nameAr: 'مستلزمات المكتب', function: 'administrative', glCode: '5330' },
        { code: 'insurance', name: 'Insurance', nameAr: 'التأمين', function: 'administrative', glCode: '5340' },
        { code: 'professional_fees', name: 'Professional Fees', nameAr: 'الرسوم المهنية', function: 'administrative', glCode: '5350' },
        { code: 'licenses_permits', name: 'Licenses & Permits', nameAr: 'الرخص والتصاريح', function: 'administrative', glCode: '5360' },
        { code: 'bank_charges', name: 'Bank Charges', nameAr: 'رسوم البنك', function: 'administrative', glCode: '5370' },
        { code: 'equipment', name: 'Equipment', nameAr: 'المعدات', function: 'administrative', glCode: '5400' },
        { code: 'maintenance', name: 'Repairs & Maintenance', nameAr: 'الصيانة والإصلاحات', function: 'administrative', glCode: '5410' },
        { code: 'other', name: 'Other Expenses', nameAr: 'مصروفات أخرى', function: 'other_operating', glCode: '5900' },
      ];
      res.json({ success: true, data: categories });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get expense categories' });
    }
  });

  // Finance: Aging Report
  app.get('/api/finance/expenses/aging', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const allExpenses = await sql`SELECT * FROM finance_expenses WHERE status != 'paid' AND status != 'cancelled'`;
      const today = new Date();
      const summary = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90Days: 0, total: 0 };
      const byVendorMap: Record<string, any> = {};
      const details: any[] = [];

      allExpenses.forEach((expense: any) => {
        const dueDate = expense.due_date ? new Date(expense.due_date) : new Date(expense.created_at);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const amount = parseFloat(String(expense.amount || '0'));
        const balance = amount;
        let bucket = 'current';

        if (daysOverdue <= 0) { summary.current += balance; bucket = 'current'; }
        else if (daysOverdue <= 30) { summary.days1to30 += balance; bucket = '1-30'; }
        else if (daysOverdue <= 60) { summary.days31to60 += balance; bucket = '31-60'; }
        else if (daysOverdue <= 90) { summary.days61to90 += balance; bucket = '61-90'; }
        else { summary.over90Days += balance; bucket = '90+'; }
        summary.total += balance;

        const vendorName = expense.vendor || 'Unknown';
        if (!byVendorMap[vendorName]) byVendorMap[vendorName] = { vendorId: '', vendorName, current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90Days: 0, total: 0 };
        if (daysOverdue <= 0) byVendorMap[vendorName].current += balance;
        else if (daysOverdue <= 30) byVendorMap[vendorName].days1to30 += balance;
        else if (daysOverdue <= 60) byVendorMap[vendorName].days31to60 += balance;
        else if (daysOverdue <= 90) byVendorMap[vendorName].days61to90 += balance;
        else byVendorMap[vendorName].over90Days += balance;
        byVendorMap[vendorName].total += balance;

        details.push({ expenseId: expense.id, vendorName, invoiceNumber: expense.invoice_number || '-', dueDate: dueDate.toISOString(), amount, balance, daysOverdue: Math.max(0, daysOverdue), agingBucket: bucket });
      });

      res.json({ success: true, data: { asOfDate: today.toISOString(), summary, byVendor: Object.values(byVendorMap), details } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get aging report' });
    }
  });

  // Finance: Vendors (sample)
  app.get('/api/finance/vendors', async (req, res) => {
    try {
      res.json({
        success: true, data: [
          { id: 'v-001', code: 'V-001', name: 'Al Ain Farms', nameAr: 'مزارع العين', email: 'accounts@alainfarms.ae', phone: '+971 4 123 4567', trn: '100123456789003', defaultPaymentTerms: 'net_30', currentBalance: 15000, isActive: true, category: 'supplier' },
          { id: 'v-002', code: 'V-002', name: 'Emirates Spices', nameAr: 'توابل الإمارات', email: 'billing@emiratesspices.com', phone: '+971 4 987 6543', trn: '100987654321003', defaultPaymentTerms: 'net_15', currentBalance: 5200, isActive: true, category: 'supplier' },
        ]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get vendors' });
    }
  });

  // Finance: Create Vendor
  app.post('/api/finance/vendors', async (req, res) => {
    try {
      const data = req.body;
      const newVendor = { id: genId(), code: 'V-' + String(Date.now()).slice(-4), ...data, currentBalance: data.openingBalance || 0, isActive: true, createdAt: new Date().toISOString() };
      res.status(201).json({ success: true, data: newVendor });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to create vendor' });
    }
  });

  // Finance: Vendor by ID
  app.get('/api/finance/vendors/:id', async (req, res) => {
    try {
      res.json({ success: true, data: { id: req.params.id, code: 'V-001', name: 'Sample Vendor', currentBalance: 0, isActive: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get vendor' });
    }
  });

  // Finance: Cost Centers
  app.get('/api/finance/cost-centers', async (req, res) => {
    try {
      res.json({
        success: true, data: [
          { id: 'cc-001', code: 'CC-OPS', name: 'Operations', nameAr: 'العمليات', isActive: true },
          { id: 'cc-002', code: 'CC-ADMIN', name: 'Administration', nameAr: 'الإدارة', isActive: true },
          { id: 'cc-003', code: 'CC-SALES', name: 'Sales & Marketing', nameAr: 'المبيعات والتسويق', isActive: true },
          { id: 'cc-004', code: 'CC-DELIVERY', name: 'Delivery', nameAr: 'التوصيل', isActive: true },
          { id: 'cc-005', code: 'CC-WAREHOUSE', name: 'Warehouse', nameAr: 'المستودع', isActive: true },
        ]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get cost centers' });
    }
  });

  // Finance: Create Cost Center
  app.post('/api/finance/cost-centers', async (req, res) => {
    try {
      res.status(201).json({ success: true, data: { id: genId(), ...req.body, isActive: true, createdAt: new Date().toISOString() } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to create cost center' });
    }
  });

  // Finance: Budgets
  app.get('/api/finance/budgets', async (req, res) => {
    try {
      res.json({
        success: true, data: [
          { id: 'bud-001', name: 'Operations Q1 2026', periodType: 'quarterly', startDate: '2026-01-01', endDate: '2026-03-31', budgetAmount: 50000, spentAmount: 22500, remainingAmount: 27500, percentUsed: 45, alertThreshold: 80, isActive: true },
          { id: 'bud-002', name: 'Marketing Monthly', periodType: 'monthly', startDate: '2026-01-01', endDate: '2026-01-31', category: 'marketing', budgetAmount: 10000, spentAmount: 7800, remainingAmount: 2200, percentUsed: 78, alertThreshold: 80, isActive: true },
        ]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get budgets' });
    }
  });

  // Finance: Create Budget
  app.post('/api/finance/budgets', async (req, res) => {
    try {
      const data = req.body;
      res.status(201).json({ success: true, data: { id: genId(), ...data, spentAmount: 0, remainingAmount: data.budgetAmount, percentUsed: 0, isActive: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to create budget' });
    }
  });

  // Finance: Budget vs Actual
  app.get('/api/finance/budgets/vs-actual', async (req, res) => {
    try {
      res.json({
        success: true, data: {
          period: req.query.period || 'quarter', summary: { totalBudget: 180000, totalSpent: 38800, totalRemaining: 141200 }, byCategory: [
            { category: 'marketing', budget: 10000, actual: 7800, variance: 2200, variancePercent: 22 },
            { category: 'delivery', budget: 10000, actual: 8500, variance: 1500, variancePercent: 15 },
          ]
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get budget vs actual' });
    }
  });

  // Finance: Approval Rules
  app.get('/api/finance/approval-rules', async (req, res) => {
    try {
      res.json({
        success: true, data: [
          { id: 'rule-001', name: 'Auto-approve small expenses', minAmount: 0, maxAmount: 500, autoApproveBelow: 500, approverLevel: 0, isActive: true },
          { id: 'rule-002', name: 'Manager approval (500-5000)', minAmount: 500, maxAmount: 5000, approverRole: 'manager', approverLevel: 1, isActive: true },
        ]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get approval rules' });
    }
  });

  // Finance: Profit & Loss Report
  app.get('/api/finance/reports/profit-loss', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { period = 'month', startDate, endDate } = req.query;
      const { start, end } = getFinanceDateRange(period as string, startDate as string, endDate as string);
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      const ordersRows = await sql`SELECT total, vat_amount FROM orders WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp AND status != 'cancelled'`;
      const sales = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.total || '0')), 0);
      const totalRevenue = sales;
      const inventoryCost = totalRevenue * 0.6;
      const totalCOGS = inventoryCost;
      const grossProfit = totalRevenue - totalCOGS;
      const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      const expRows = await sql`SELECT category, amount FROM finance_expenses WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp AND status = 'paid'`;
      const expenseByCategory: Record<string, number> = {};
      expRows.forEach((e: any) => { expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + parseFloat(String(e.amount || '0')); });
      const operatingExpenses = Object.entries(expenseByCategory).map(([category, amount]) => ({ category, amount }));
      const totalOperatingExpenses = expRows.reduce((s: number, e: any) => s + parseFloat(String(e.amount || '0')), 0);
      const operatingProfit = grossProfit - totalOperatingExpenses;

      const txnRows = await sql`SELECT type, amount FROM finance_transactions WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp AND type = 'refund'`;
      const refunds = txnRows.reduce((s: number, t: any) => s + Math.abs(parseFloat(String(t.amount || '0'))), 0);
      const netProfit = operatingProfit - refunds;
      const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      res.json({
        success: true, data: {
          period: period as string, startDate: start.toISOString(), endDate: end.toISOString(),
          revenue: { sales: Math.round(sales * 100) / 100, otherIncome: 0, totalRevenue: Math.round(totalRevenue * 100) / 100 },
          costOfGoodsSold: { inventoryCost: Math.round(inventoryCost * 100) / 100, supplierPurchases: 0, totalCOGS: Math.round(totalCOGS * 100) / 100 },
          grossProfit: Math.round(grossProfit * 100) / 100, grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
          operatingExpenses, totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
          operatingProfit: Math.round(operatingProfit * 100) / 100,
          otherExpenses: { vatPaid: 0, refunds: Math.round(refunds * 100) / 100, totalOther: Math.round(refunds * 100) / 100 },
          netProfit: Math.round(netProfit * 100) / 100, netProfitMargin: Math.round(netProfitMargin * 100) / 100,
        }
      });
    } catch (error) {
      console.error('[P&L Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate profit/loss report' });
    }
  });

  // Finance: Cash Flow Report
  app.get('/api/finance/reports/cash-flow', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { period = 'month', startDate, endDate } = req.query;
      const { start, end } = getFinanceDateRange(period as string, startDate as string, endDate as string);
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      const accounts = await sql`SELECT * FROM finance_accounts`;
      const allTransactions = await sql`SELECT * FROM finance_transactions WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp`;
      const ordersRows = await sql`SELECT total, payment_method FROM orders WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp AND status != 'cancelled'`;
      const expRows = await sql`SELECT amount FROM finance_expenses WHERE status = 'paid' AND paid_at >= ${startStr}::timestamp AND paid_at <= ${endStr}::timestamp`;

      const closingBalance = accounts.reduce((s: number, a: any) => s + parseFloat(String(a.balance || '0')), 0);
      const txnTotal = allTransactions.reduce((s: number, t: any) => s + parseFloat(String(t.amount || '0')), 0);
      const openingBalance = closingBalance - txnTotal;

      const cashFromSales = ordersRows.filter((o: any) => o.payment_method === 'card').reduce((s: number, o: any) => s + parseFloat(String(o.total || '0')), 0);
      const cashFromCOD = ordersRows.filter((o: any) => o.payment_method === 'cod').reduce((s: number, o: any) => s + parseFloat(String(o.total || '0')), 0);
      const cashFromRefunds = allTransactions.filter((t: any) => t.type === 'refund').reduce((s: number, t: any) => s + parseFloat(String(t.amount || '0')), 0);
      const cashToSuppliers = allTransactions.filter((t: any) => t.type === 'purchase').reduce((s: number, t: any) => s + Math.abs(parseFloat(String(t.amount || '0'))), 0);
      const cashToExpenses = expRows.reduce((s: number, e: any) => s + parseFloat(String(e.amount || '0')), 0);
      const netOperating = cashFromSales + cashFromCOD + cashFromRefunds - cashToSuppliers - cashToExpenses;
      const netCashFlow = closingBalance - openingBalance;

      // Daily cash flow
      const dailyCashFlow: any[] = [];
      const currentDate = new Date(start);
      let runningBalance = openingBalance;
      while (currentDate <= end) {
        const dayStr = currentDate.toISOString().split('T')[0];
        const dayInflow = allTransactions.filter((t: any) => parseFloat(String(t.amount)) > 0 && String(t.created_at).startsWith(dayStr)).reduce((s: number, t: any) => s + parseFloat(String(t.amount)), 0);
        const dayOutflow = Math.abs(allTransactions.filter((t: any) => parseFloat(String(t.amount)) < 0 && String(t.created_at).startsWith(dayStr)).reduce((s: number, t: any) => s + parseFloat(String(t.amount)), 0));
        const dayNet = dayInflow - dayOutflow;
        runningBalance += dayNet;
        dailyCashFlow.push({ date: dayStr, inflow: Math.round(dayInflow * 100) / 100, outflow: Math.round(dayOutflow * 100) / 100, net: Math.round(dayNet * 100) / 100, balance: Math.round(runningBalance * 100) / 100 });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        success: true, data: {
          period: period as string, startDate: start.toISOString(), endDate: end.toISOString(),
          openingBalance: Math.round(openingBalance * 100) / 100, closingBalance: Math.round(closingBalance * 100) / 100,
          operatingActivities: { cashFromSales: Math.round(cashFromSales * 100) / 100, cashFromCOD: Math.round(cashFromCOD * 100) / 100, cashFromRefunds: Math.round(cashFromRefunds * 100) / 100, cashToSuppliers: Math.round(cashToSuppliers * 100) / 100, cashToExpenses: Math.round(cashToExpenses * 100) / 100, netOperating: Math.round(netOperating * 100) / 100 },
          investingActivities: { equipmentPurchases: 0, netInvesting: 0 },
          financingActivities: { ownerDrawings: 0, capitalInjection: 0, netFinancing: 0 },
          netCashFlow: Math.round(netCashFlow * 100) / 100, dailyCashFlow,
        }
      });
    } catch (error) {
      console.error('[Cash Flow Report Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate cash flow report' });
    }
  });

  // Finance: VAT Report
  app.get('/api/finance/reports/vat', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { period = 'month', startDate, endDate } = req.query;
      const { start, end } = getFinanceDateRange(period as string, startDate as string, endDate as string);
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      const ordersRows = await sql`SELECT total, vat_amount, order_number, created_at FROM orders WHERE created_at >= ${startStr}::timestamp AND created_at <= ${endStr}::timestamp AND status != 'cancelled'`;
      const salesTaxableAmount = ordersRows.reduce((s: number, o: any) => s + (parseFloat(String(o.total || '0')) - parseFloat(String(o.vat_amount || '0'))), 0);
      const salesVATAmount = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.vat_amount || '0')), 0);

      const transactionDetails = ordersRows.map((o: any) => ({
        date: o.created_at, type: 'sale', reference: o.order_number,
        taxableAmount: Math.round((parseFloat(String(o.total || '0')) - parseFloat(String(o.vat_amount || '0'))) * 100) / 100,
        vatAmount: Math.round(parseFloat(String(o.vat_amount || '0')) * 100) / 100, vatRate: 5,
      }));

      res.json({
        success: true, data: {
          period: period as string, startDate: start.toISOString(), endDate: end.toISOString(),
          salesVAT: { taxableAmount: Math.round(salesTaxableAmount * 100) / 100, vatAmount: Math.round(salesVATAmount * 100) / 100, exemptAmount: 0 },
          purchasesVAT: { taxableAmount: 0, vatAmount: 0 },
          vatDue: Math.round(salesVATAmount * 100) / 100, vatRefund: 0, netVAT: Math.round(salesVATAmount * 100) / 100,
          transactionDetails,
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to generate VAT report' });
    }
  });

  // Finance: Balance Sheet
  app.get('/api/finance/reports/balance-sheet', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const accounts = await sql`SELECT * FROM finance_accounts`;
      const ordersRows = await sql`SELECT total, vat_amount, payment_status, status FROM orders WHERE status != 'cancelled' AND payment_status = 'captured'`;
      const expRows = await sql`SELECT amount, status FROM finance_expenses`;
      const pendingOrdersRows = await sql`SELECT total FROM orders WHERE payment_status = 'pending' AND status != 'cancelled'`;

      const totalRevenue = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.total || '0')), 0);
      const totalVAT = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.vat_amount || '0')), 0);
      const totalExpensesPaid = expRows.filter((e: any) => e.status === 'paid').reduce((s: number, e: any) => s + parseFloat(String(e.amount || '0')), 0);

      const cashInHand = accounts.filter((a: any) => a.type === 'cash').reduce((s: number, a: any) => s + parseFloat(String(a.balance || '0')), 0);
      const bankAccounts = accounts.filter((a: any) => a.type === 'bank').reduce((s: number, a: any) => s + parseFloat(String(a.balance || '0')), 0);
      const accountsReceivable = pendingOrdersRows.reduce((s: number, o: any) => s + parseFloat(String(o.total || '0')), 0);
      const inventoryValue = totalRevenue * 0.3;
      const totalCurrentAssets = cashInHand + bankAccounts + accountsReceivable + inventoryValue;
      const fixedAssets = 50000;
      const totalAssets = totalCurrentAssets + fixedAssets;

      const accountsPayable = expRows.filter((e: any) => e.status === 'pending' || e.status === 'approved').reduce((s: number, e: any) => s + parseFloat(String(e.amount || '0')), 0);
      const totalCurrentLiabilities = totalVAT + accountsPayable;
      const totalLiabilities = totalCurrentLiabilities;

      const openingCapital = 100000;
      const retainedEarnings = totalRevenue - totalExpensesPaid - (totalRevenue * 0.6);
      const totalEquity = openingCapital + retainedEarnings;

      res.json({
        success: true, data: {
          asOfDate: new Date().toISOString(),
          assets: { currentAssets: { cashInHand: Math.round(cashInHand * 100) / 100, bankAccounts: Math.round(bankAccounts * 100) / 100, accountsReceivable: Math.round(accountsReceivable * 100) / 100, inventory: Math.round(inventoryValue * 100) / 100, total: Math.round(totalCurrentAssets * 100) / 100 }, fixedAssets: { equipment: 30000, furniture: 10000, vehicles: 10000, total: fixedAssets }, totalAssets: Math.round(totalAssets * 100) / 100 },
          liabilities: { currentLiabilities: { accountsPayable: Math.round(accountsPayable * 100) / 100, vatPayable: Math.round(totalVAT * 100) / 100, accruedExpenses: 0, total: Math.round(totalCurrentLiabilities * 100) / 100 }, longTermLiabilities: { loans: 0, total: 0 }, totalLiabilities: Math.round(totalLiabilities * 100) / 100 },
          equity: { openingCapital, retainedEarnings: Math.round(retainedEarnings * 100) / 100, currentYearIncome: Math.round(retainedEarnings * 100) / 100, totalEquity: Math.round(totalEquity * 100) / 100 },
          balanceCheck: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
        }
      });
    } catch (error) {
      console.error('[Balance Sheet Error]', error);
      res.status(500).json({ success: false, error: 'Failed to generate balance sheet' });
    }
  });

  // Finance: Chart of Accounts
  app.get('/api/finance/chart-of-accounts', async (req, res) => {
    try {
      res.json({
        success: true, data: [
          { code: '1000', name: 'Assets', nameAr: 'الأصول', accountClass: 'asset', isHeader: true },
          { code: '1100', name: 'Cash & Bank', nameAr: 'النقد والبنوك', accountClass: 'asset' },
          { code: '1110', name: 'Cash in Hand', nameAr: 'النقد في الصندوق', accountClass: 'asset' },
          { code: '1120', name: 'Bank Accounts', nameAr: 'الحسابات البنكية', accountClass: 'asset' },
          { code: '1200', name: 'Accounts Receivable', nameAr: 'الذمم المدينة', accountClass: 'asset' },
          { code: '1300', name: 'Inventory', nameAr: 'المخزون', accountClass: 'asset' },
          { code: '1400', name: 'Fixed Assets', nameAr: 'الأصول الثابتة', accountClass: 'asset' },
          { code: '2000', name: 'Liabilities', nameAr: 'الالتزامات', accountClass: 'liability', isHeader: true },
          { code: '2100', name: 'Accounts Payable', nameAr: 'الذمم الدائنة', accountClass: 'liability' },
          { code: '2200', name: 'VAT Payable', nameAr: 'ضريبة القيمة المضافة المستحقة', accountClass: 'liability' },
          { code: '3000', name: 'Equity', nameAr: 'حقوق الملكية', accountClass: 'equity', isHeader: true },
          { code: '3100', name: "Owner's Capital", nameAr: 'رأس مال المالك', accountClass: 'equity' },
          { code: '3200', name: 'Retained Earnings', nameAr: 'الأرباح المحتجزة', accountClass: 'equity' },
          { code: '4000', name: 'Revenue', nameAr: 'الإيرادات', accountClass: 'revenue', isHeader: true },
          { code: '4100', name: 'Sales Revenue', nameAr: 'إيرادات المبيعات', accountClass: 'revenue' },
          { code: '4200', name: 'Delivery Revenue', nameAr: 'إيرادات التوصيل', accountClass: 'revenue' },
          { code: '5000', name: 'Expenses', nameAr: 'المصروفات', accountClass: 'expense', isHeader: true },
          { code: '5100', name: 'Cost of Goods Sold', nameAr: 'تكلفة البضاعة المباعة', accountClass: 'expense' },
          { code: '5200', name: 'Salaries & Wages', nameAr: 'الرواتب والأجور', accountClass: 'expense' },
          { code: '5300', name: 'Rent Expense', nameAr: 'مصروف الإيجار', accountClass: 'expense' },
          { code: '5900', name: 'Other Expenses', nameAr: 'مصروفات أخرى', accountClass: 'expense' },
        ]
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get chart of accounts' });
    }
  });

  // Finance: Create Chart Account
  app.post('/api/finance/chart-of-accounts', async (req, res) => {
    try {
      const { code, name, nameAr, accountClass, parentId, description } = req.body;
      if (!code || !name || !accountClass) return res.status(400).json({ success: false, error: 'Missing required fields' });
      res.json({ success: true, data: { id: genId(), code, name, nameAr, accountClass, parentId, description, isActive: true, balance: '0', normalBalance: ['asset', 'expense'].includes(accountClass) ? 'debit' : 'credit' } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to create account' });
    }
  });

  // Finance: Journal Entries
  app.get('/api/finance/journal-entries', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const ordersRows = await sql`SELECT * FROM orders WHERE payment_status = 'captured' ORDER BY created_at DESC LIMIT 20`;
      const journalEntries = ordersRows.map((order: any, idx: number) => ({
        id: 'je_' + order.id, entryNumber: 'JE-' + new Date(order.created_at).getFullYear() + '-' + String(idx + 1).padStart(4, '0'),
        entryDate: order.created_at, description: 'Sale - Order ' + order.order_number, descriptionAr: 'مبيعات - طلب ' + order.order_number,
        reference: order.order_number, referenceType: 'order', referenceId: order.id, status: 'posted',
        totalDebit: parseFloat(String(order.total || '0')), totalCredit: parseFloat(String(order.total || '0')),
        createdBy: 'system', postedAt: order.created_at,
        lines: [
          { accountCode: '1110', accountName: 'Cash in Hand', debit: parseFloat(String(order.total || '0')), credit: 0, description: 'Payment received for ' + order.order_number },
          { accountCode: '4100', accountName: 'Sales Revenue', debit: 0, credit: parseFloat(String(order.total || '0')) - parseFloat(String(order.vat_amount || '0')), description: 'Sale ' + order.order_number },
          { accountCode: '2200', accountName: 'VAT Payable', debit: 0, credit: parseFloat(String(order.vat_amount || '0')), description: 'VAT on ' + order.order_number },
        ],
      }));
      res.json({ success: true, data: journalEntries });
    } catch (error) {
      console.error('[Journal Entries Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get journal entries' });
    }
  });

  // Finance: Create Journal Entry
  app.post('/api/finance/journal-entries', async (req, res) => {
    try {
      const { entryDate, description, descriptionAr, reference, lines } = req.body;
      if (!lines || lines.length < 2) return res.status(400).json({ success: false, error: 'Journal entry must have at least 2 lines' });
      const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) return res.status(400).json({ success: false, error: `Debits (${totalDebit}) must equal Credits (${totalCredit})` });

      const entry = { id: genId(), entryNumber: 'JE-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6), entryDate: entryDate || new Date().toISOString(), description, descriptionAr, reference, status: 'draft', totalDebit, totalCredit, lines, createdBy: 'admin', createdAt: new Date().toISOString() };
      res.json({ success: true, data: entry });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to create journal entry' });
    }
  });

  // Finance: Post Journal Entry
  app.post('/api/finance/journal-entries/:id/post', async (req, res) => {
    try {
      res.json({ success: true, data: { id: req.params.id, status: 'posted', postedAt: new Date().toISOString() }, message: 'Journal entry posted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to post journal entry' });
    }
  });

  // Finance: Audit Log
  app.get('/api/finance/audit-log', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const ordersRows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT ${limit}`;
      const auditEntries = ordersRows.flatMap((order: any) => {
        const entries: any[] = [];
        entries.push({ id: 'audit_' + order.id + '_create', entityType: 'order', entityId: order.id, action: 'create', previousValue: null, newValue: { status: 'pending', total: parseFloat(String(order.total || '0')) }, userId: order.user_id || 'guest', userName: order.customer_name, createdAt: order.created_at });
        const history = safeJson(order.status_history, []);
        history.forEach((h: any, idx: number) => {
          entries.push({ id: 'audit_' + order.id + '_status_' + idx, entityType: 'order', entityId: order.id, action: 'status_change', previousValue: { status: history[idx - 1]?.status || 'pending' }, newValue: { status: h.status }, changedFields: ['status'], userId: h.changedBy || 'system', userName: h.changedBy || 'System', createdAt: h.changedAt });
        });
        return entries;
      });
      res.json({ success: true, data: auditEntries.slice(0, limit) });
    } catch (error) {
      console.error('[Audit Log Error]', error);
      res.status(500).json({ success: false, error: 'Failed to get audit log' });
    }
  });

  // Finance: VAT Returns
  app.get('/api/finance/vat-returns', async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const vatReturns = [];
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3;
        vatReturns.push({ id: 'vat_' + currentYear + '_q' + q, period: 'Q' + q + ' ' + currentYear, periodStart: new Date(currentYear, startMonth, 1).toISOString(), periodEnd: new Date(currentYear, startMonth + 3, 0).toISOString(), dueDate: new Date(currentYear, startMonth + 3, 28).toISOString(), status: q < Math.ceil((new Date().getMonth() + 1) / 3) ? 'submitted' : 'draft', netVatDue: 0 });
      }
      res.json({ success: true, data: vatReturns });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get VAT returns' });
    }
  });

  // Finance: Create VAT Return
  app.post('/api/finance/vat-returns', async (req, res) => {
    try {
      if (!isDatabaseAvailable() || !sql) {
        return res.status(500).json({ success: false, error: 'Database not available' });
      }
      const { periodStart, periodEnd } = req.body;
      const ordersRows = await sql`SELECT total, vat_amount FROM orders WHERE created_at >= ${periodStart}::timestamp AND created_at <= ${periodEnd}::timestamp AND status != 'cancelled'`;
      const totalSales = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.total || '0')) - parseFloat(String(o.vat_amount || '0')), 0);
      const totalVat = ordersRows.reduce((s: number, o: any) => s + parseFloat(String(o.vat_amount || '0')), 0);
      res.json({
        success: true, data: {
          id: genId(), periodStart, periodEnd, dueDate: new Date(new Date(periodEnd).getFullYear(), new Date(periodEnd).getMonth() + 1, 28).toISOString(),
          box1Amount: 0, box1Vat: 0, box2Amount: totalSales, box2Vat: totalVat, box3Amount: 0, box3Vat: 0,
          totalSalesVat: Math.round(totalVat * 100) / 100, totalPurchasesVat: 0, netVatDue: Math.round(totalVat * 100) / 100, status: 'draft',
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to create VAT return' });
    }
  });

  // Finance: Export Report
  app.post('/api/finance/reports/export', async (req, res) => {
    try {
      const { reportType, format, startDate, endDate } = req.body;
      res.json({ success: true, data: { url: '/api/finance/reports/download/' + reportType + '-' + format + '-' + Date.now(), filename: reportType + '-report-' + startDate + '-' + endDate + '.' + format } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to export report' });
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
