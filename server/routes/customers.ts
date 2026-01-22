/**
 * Customer Management Routes
 * Customer registration, authentication, and profile management using PostgreSQL
 * Customers are separate from Users (staff)
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import type { ApiResponse, PaginatedResponse } from "../../shared/api";
import { db, customers, customerSessions, addresses } from "../db/connection";

const router = Router();

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

// Customer type for API responses
interface Customer {
  id: string;
  username: string;
  email: string;
  mobile: string;
  firstName: string;
  familyName: string;
  isActive: boolean;
  isVerified: boolean;
  emirate: string;
  address?: string;
  customerNumber: string;
  segment: string;
  creditLimit: string;
  currentBalance: string;
  lifetimeValue: string;
  totalOrders: number;
  totalSpent: string;
  averageOrderValue: string;
  lastOrderDate?: string;
  preferences?: {
    language: "en" | "ar";
    currency: "AED" | "USD" | "EUR";
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingEmails: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

interface CustomerLoginResponse {
  customer: Customer;
  token: string;
  expiresAt: string;
}

// Validation schemas
const registerCustomerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email(),
  mobile: z.string().min(9),
  password: z.string().min(6),
  firstName: z.string().min(1),
  familyName: z.string().min(1),
  emirate: z.string().min(2),
  address: z.string().optional(),
  deliveryAddress: z.object({
    label: z.string(),
    fullName: z.string(),
    mobile: z.string(),
    emirate: z.string(),
    area: z.string(),
    street: z.string(),
    building: z.string(),
    floor: z.string().optional(),
    apartment: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    isDefault: z.boolean(),
  }).optional(),
});

const updateCustomerSchema = z.object({
  email: z.string().email().optional(),
  mobile: z.string().min(9).optional(),
  firstName: z.string().min(1).optional(),
  familyName: z.string().min(1).optional(),
  emirate: z.string().min(2).optional(),
  address: z.string().optional(),
  preferences: z.object({
    language: z.enum(["en", "ar"]).optional(),
    currency: z.enum(["AED", "USD", "EUR"]).optional(),
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  }).optional(),
});

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// Helper to convert DB customer to API customer (excludes password)
function toApiCustomer(dbCustomer: typeof customers.$inferSelect): Customer {
  return {
    id: dbCustomer.id,
    username: dbCustomer.username,
    email: dbCustomer.email,
    mobile: dbCustomer.mobile,
    firstName: dbCustomer.firstName,
    familyName: dbCustomer.familyName,
    isActive: dbCustomer.isActive,
    isVerified: dbCustomer.isVerified,
    emirate: dbCustomer.emirate || "",
    address: dbCustomer.address || undefined,
    customerNumber: dbCustomer.customerNumber,
    segment: dbCustomer.segment,
    creditLimit: dbCustomer.creditLimit,
    currentBalance: dbCustomer.currentBalance,
    lifetimeValue: dbCustomer.lifetimeValue,
    totalOrders: dbCustomer.totalOrders,
    totalSpent: dbCustomer.totalSpent,
    averageOrderValue: dbCustomer.averageOrderValue,
    lastOrderDate: dbCustomer.lastOrderDate?.toISOString(),
    preferences: (dbCustomer.preferences as Customer["preferences"]) || {
      language: "en",
      currency: "AED",
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: true,
    },
    createdAt: dbCustomer.createdAt.toISOString(),
    updatedAt: dbCustomer.updatedAt.toISOString(),
    lastLoginAt: dbCustomer.lastLoginAt?.toISOString(),
  };
}

// =====================================================
// AUTHENTICATION ROUTES
// =====================================================

// POST /api/customers/register - Register new customer
const registerCustomer: RequestHandler = async (req, res) => {
  try {
    const validation = registerCustomerSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;

    // Check if username already exists
    const existingByUsername = await db.select().from(customers).where(eq(customers.username, data.username.toLowerCase()));
    if (existingByUsername.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Username already taken",
      };
      return res.status(400).json(response);
    }

    // Check if email already exists
    const existingByEmail = await db.select().from(customers).where(eq(customers.email, data.email.toLowerCase()));
    if (existingByEmail.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Email already registered",
      };
      return res.status(400).json(response);
    }

    // Check if mobile already exists
    const normalizedMobile = data.mobile.replace(/\s/g, "");
    const existingByMobile = await db.select().from(customers).where(eq(customers.mobile, normalizedMobile));
    if (existingByMobile.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Phone number already registered",
      };
      return res.status(400).json(response);
    }

    // Get next customer number
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(customers);
    const customerNumber = `CUST-${String(Number(countResult[0]?.count || 0) + 1).padStart(4, '0')}`;

    const newCustomer = {
      id: generateId("cust"),
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      mobile: normalizedMobile,
      password: data.password, // In production, hash the password!
      firstName: data.firstName,
      familyName: data.familyName,
      isActive: true,
      isVerified: false,
      emirate: data.emirate,
      address: data.address || null,
      customerNumber,
      segment: "regular" as const,
      creditLimit: "0",
      currentBalance: "0",
      lifetimeValue: "0",
      totalOrders: 0,
      totalSpent: "0",
      averageOrderValue: "0",
      preferredLanguage: "en" as const,
      marketingOptIn: true,
      smsOptIn: true,
      emailOptIn: true,
      referralCount: 0,
      preferences: {
        language: "en" as const,
        currency: "AED" as const,
        emailNotifications: true,
        smsNotifications: true,
        marketingEmails: true,
      },
    };

    await db.insert(customers).values(newCustomer);

    // Create default address if provided
    if (data.deliveryAddress) {
      const addressId = generateId("addr");
      await db.insert(addresses).values({
        id: addressId,
        customerId: newCustomer.id,
        label: data.deliveryAddress.label,
        fullName: data.deliveryAddress.fullName,
        mobile: data.deliveryAddress.mobile,
        emirate: data.deliveryAddress.emirate,
        area: data.deliveryAddress.area,
        street: data.deliveryAddress.street,
        building: data.deliveryAddress.building,
        floor: data.deliveryAddress.floor,
        apartment: data.deliveryAddress.apartment,
        latitude: data.deliveryAddress.latitude,
        longitude: data.deliveryAddress.longitude,
        isDefault: data.deliveryAddress.isDefault ?? true,
      });
    }

    const result = await db.select().from(customers).where(eq(customers.id, newCustomer.id));

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(customerSessions).values({
      id: generateId("sess"),
      customerId: newCustomer.id,
      token,
      expiresAt,
    });

    const response: ApiResponse<CustomerLoginResponse> = {
      success: true,
      data: {
        customer: toApiCustomer(result[0]),
        token,
        expiresAt: expiresAt.toISOString(),
      },
      message: "Registration successful",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error registering customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to register customer",
    };
    res.status(500).json(response);
  }
};

// POST /api/customers/login - Customer login
const loginCustomer: RequestHandler = async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { username, password } = validation.data;

    // Find customer by username or email
    const customerResult = await db.select().from(customers).where(
      or(
        eq(customers.username, username.toLowerCase()),
        eq(customers.email, username.toLowerCase())
      )
    );

    if (customerResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid username or password",
      };
      return res.status(401).json(response);
    }

    const customer = customerResult[0];

    // Check password (in production, use bcrypt.compare)
    if (customer.password !== password) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid username or password",
      };
      return res.status(401).json(response);
    }

    // Check if active
    if (!customer.isActive) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Account is deactivated",
      };
      return res.status(403).json(response);
    }

    // Update last login
    await db.update(customers)
      .set({ lastLoginAt: new Date() })
      .where(eq(customers.id, customer.id));

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(customerSessions).values({
      id: generateId("sess"),
      customerId: customer.id,
      token,
      expiresAt,
    });

    const response: ApiResponse<CustomerLoginResponse> = {
      success: true,
      data: {
        customer: toApiCustomer({ ...customer, lastLoginAt: new Date() }),
        token,
        expiresAt: expiresAt.toISOString(),
      },
      message: "Login successful",
    };
    res.json(response);
  } catch (error) {
    console.error("Error logging in customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to login",
    };
    res.status(500).json(response);
  }
};

// POST /api/customers/logout - Customer logout
const logoutCustomer: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (token) {
      await db.delete(customerSessions).where(eq(customerSessions.token, token));
    }

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: "Logged out successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error logging out customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to logout",
    };
    res.status(500).json(response);
  }
};

// GET /api/customers/me - Get current customer (by token)
const getCurrentCustomer: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      const response: ApiResponse<null> = {
        success: false,
        error: "No token provided",
      };
      return res.status(401).json(response);
    }

    const sessionResult = await db.select().from(customerSessions).where(eq(customerSessions.token, token));
    
    if (sessionResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid or expired session",
      };
      return res.status(401).json(response);
    }

    const session = sessionResult[0];

    if (new Date(session.expiresAt) < new Date()) {
      await db.delete(customerSessions).where(eq(customerSessions.id, session.id));
      const response: ApiResponse<null> = {
        success: false,
        error: "Session expired",
      };
      return res.status(401).json(response);
    }

    const customerResult = await db.select().from(customers).where(eq(customers.id, session.customerId));
    
    if (customerResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Customer> = {
      success: true,
      data: toApiCustomer(customerResult[0]),
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting current customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get customer",
    };
    res.status(500).json(response);
  }
};

// GET /api/customers/:id - Get customer by ID
const getCustomerById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(customers).where(eq(customers.id, id));

    if (result.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Customer> = {
      success: true,
      data: toApiCustomer(result[0]),
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch customer",
    };
    res.status(500).json(response);
  }
};

// GET /api/customers - Get all customers (admin only)
const getAllCustomers: RequestHandler = async (req, res) => {
  try {
    const { page = "1", limit = "20", search, segment, sortBy = "createdAt", sortOrder = "desc" } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let allCustomers = await db.select().from(customers);

    // Filter by search
    if (search) {
      const searchLower = (search as string).toLowerCase();
      allCustomers = allCustomers.filter(c => 
        c.firstName.toLowerCase().includes(searchLower) ||
        c.familyName.toLowerCase().includes(searchLower) ||
        c.email.toLowerCase().includes(searchLower) ||
        c.customerNumber.toLowerCase().includes(searchLower)
      );
    }

    // Filter by segment
    if (segment && segment !== "all") {
      allCustomers = allCustomers.filter(c => c.segment === segment);
    }

    // Sort
    allCustomers.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a];
      const bVal = b[sortBy as keyof typeof b];
      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : 1;
      }
      return aVal > bVal ? -1 : 1;
    });

    const total = allCustomers.length;
    const paginatedCustomers = allCustomers.slice(offset, offset + limitNum);

    const response: PaginatedResponse<Customer> = {
      success: true,
      data: paginatedCustomers.map(toApiCustomer),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching customers:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch customers",
    };
    res.status(500).json(response);
  }
};

// PUT /api/customers/:id - Update customer
const updateCustomer: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(customers).where(eq(customers.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    const validation = updateCustomerSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;

    // Check email uniqueness if updating
    if (data.email && data.email.toLowerCase() !== existing[0].email.toLowerCase()) {
      const emailCheck = await db.select().from(customers).where(eq(customers.email, data.email.toLowerCase()));
      if (emailCheck.length > 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: "Email already in use",
        };
        return res.status(400).json(response);
      }
    }

    // Build update object
    const updateData: Partial<typeof customers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.familyName !== undefined) updateData.familyName = data.familyName;
    if (data.emirate !== undefined) updateData.emirate = data.emirate;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.preferences !== undefined) {
      updateData.preferences = {
        ...(existing[0].preferences as Customer["preferences"]),
        ...data.preferences,
      };
    }

    await db.update(customers).set(updateData).where(eq(customers.id, id));

    const result = await db.select().from(customers).where(eq(customers.id, id));

    const response: ApiResponse<Customer> = {
      success: true,
      data: toApiCustomer(result[0]),
      message: "Customer updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update customer",
    };
    res.status(500).json(response);
  }
};

// POST /api/customers/:id/change-password - Change customer password
const changePassword: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const validation = changePasswordSchema.safeParse(req.body);
    
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { currentPassword, newPassword } = validation.data;

    const existing = await db.select().from(customers).where(eq(customers.id, id));
    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    // Verify current password
    if (existing[0].password !== currentPassword) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Current password is incorrect",
      };
      return res.status(401).json(response);
    }

    await db.update(customers)
      .set({ password: newPassword, updatedAt: new Date() })
      .where(eq(customers.id, id));

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: "Password changed successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error changing password:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change password",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/customers/:id - Deactivate customer
const deactivateCustomer: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(customers).where(eq(customers.id, id));
    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    await db.update(customers)
      .set({ isActive: false, segment: "inactive", updatedAt: new Date() })
      .where(eq(customers.id, id));

    // Invalidate all sessions
    await db.delete(customerSessions).where(eq(customerSessions.customerId, id));

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: "Customer deactivated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deactivating customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to deactivate customer",
    };
    res.status(500).json(response);
  }
};

// =====================================================
// REGISTER ROUTES
// =====================================================

// Authentication
router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post("/logout", logoutCustomer);
router.get("/me", getCurrentCustomer);

// CRUD
router.get("/", getAllCustomers);
router.get("/:id", getCustomerById);
router.put("/:id", updateCustomer);
router.post("/:id/change-password", changePassword);
router.delete("/:id", deactivateCustomer);

export default router;
