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

// In-memory storage (note: resets on cold starts)
const users = new Map<string, User>();
const sessions = new Map<string, Session>();

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      language: "en",
      currency: "AED",
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: false,
    },
  });

  // Demo customer
  users.set("user_1", {
    id: "user_1",
    email: "ahmed@example.com",
    mobile: "+971501111111",
    password: "password123",
    firstName: "Ahmed",
    familyName: "Al Maktoum",
    role: "customer",
    isActive: true,
    isVerified: true,
    emirate: "Dubai",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      language: "en",
      currency: "AED",
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: true,
    },
  });
  
  console.log('[Vercel] Database seeded with', users.size, 'users');
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

  // Products endpoint (returns sample data)
  app.get('/api/products', (req, res) => {
    const products = [
      { id: 'prod_1', name: 'Premium Beef Steak', nameAr: 'ستيك لحم بقري ممتاز', price: 89.99, category: 'Beef', unit: 'kg', isActive: true, isFeatured: true },
      { id: 'prod_2', name: 'Lamb Chops', nameAr: 'ريش لحم ضأن', price: 74.50, category: 'Lamb', unit: 'kg', isActive: true, isFeatured: true },
      { id: 'prod_3', name: 'Chicken Breast', nameAr: 'صدر دجاج', price: 34.99, category: 'Chicken', unit: 'kg', isActive: true, isFeatured: false },
      { id: 'prod_4', name: 'Ground Beef', nameAr: 'لحم بقري مفروم', price: 45.00, category: 'Beef', unit: 'kg', isActive: true, isFeatured: false },
      { id: 'prod_5', name: 'Beef Brisket', nameAr: 'صدر لحم بقري', price: 95.00, category: 'Beef', unit: 'kg', isActive: true, isFeatured: true },
      { id: 'prod_6', name: 'Sheep Leg', nameAr: 'فخذ خروف', price: 125.00, category: 'Sheep', unit: 'piece', isActive: true, isFeatured: true },
    ];
    res.json({ success: true, data: products });
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
