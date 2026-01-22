/**
 * User Management Routes
 * User CRUD, authentication, and role management using PostgreSQL
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import type { User, LoginResponse, ApiResponse, PaginatedResponse } from "../../shared/api";
import { db, users, sessions, addresses, customers } from "../db/connection";

const router = Router();

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

// Validation schemas
const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email(),
  mobile: z.string().min(9),
  password: z.string().min(6),
  firstName: z.string().min(1),
  familyName: z.string().min(1),
  emirate: z.string().min(2),
  address: z.string().optional(),
  isVisitor: z.boolean().optional(),
  role: z.enum(["customer", "admin", "staff", "delivery"]).optional(),
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

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  mobile: z.string().min(9).optional(),
  firstName: z.string().min(1).optional(),
  familyName: z.string().min(1).optional(),
  emirate: z.string().min(2).optional(),
  address: z.string().optional(),
  role: z.enum(["customer", "admin", "staff", "delivery"]).optional(),
  isActive: z.boolean().optional(),
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

// Admin reset password schema (no current password required)
const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

// Helper to convert DB user to API user (excludes password)
function toApiUser(dbUser: typeof users.$inferSelect): User {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    mobile: dbUser.mobile,
    firstName: dbUser.firstName,
    familyName: dbUser.familyName,
    role: dbUser.role,
    isActive: dbUser.isActive,
    isVerified: dbUser.isVerified,
    emirate: dbUser.emirate || "",
    address: dbUser.address || undefined,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
    lastLoginAt: dbUser.lastLoginAt?.toISOString(),
    preferences: (dbUser.preferences as User["preferences"]) || {
      language: "en",
      currency: "AED",
      emailNotifications: true,
      smsNotifications: true,
      marketingEmails: true,
    },
    permissions: dbUser.permissions as User["permissions"],
  };
}

// GET /api/users - Get all users (admin)
const getUsers: RequestHandler = async (req, res) => {
  try {
    const { role, isActive, search, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let result = await db.select().from(users).orderBy(desc(users.createdAt));

    // Filter by role
    if (role) {
      result = result.filter((u) => u.role === role);
    }

    // Filter by active status
    if (isActive !== undefined) {
      result = result.filter((u) => u.isActive === (isActive === "true"));
    }

    // Search by name, email, or mobile
    if (search) {
      const searchLower = (search as string).toLowerCase();
      result = result.filter((u) =>
        u.firstName.toLowerCase().includes(searchLower) ||
        u.familyName.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.mobile.includes(search as string)
      );
    }

    // Pagination
    const total = result.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = result.slice(startIndex, startIndex + limitNum).map(toApiUser);

    const response: PaginatedResponse<User> = {
      success: true,
      data: paginatedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching users:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
    res.status(500).json(response);
  }
};

// GET /api/users/:id - Get user by ID
const getUserById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(users).where(eq(users.id, id));

    if (result.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<User> = {
      success: true,
      data: toApiUser(result[0]),
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching user:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch user",
    };
    res.status(500).json(response);
  }
};

// POST /api/users - Create new staff user (admin only)
const createUser: RequestHandler = async (req, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;

    // Only allow staff roles (admin, staff, delivery)
    const allowedRoles = ["admin", "staff", "delivery"];
    const role = data.role || "staff";
    if (!allowedRoles.includes(role)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid role. Staff users can only have roles: admin, staff, or delivery. Use /api/customers/register for customer registration.",
      };
      return res.status(400).json(response);
    }

    // Check if username already exists
    const existingByUsername = await db.select().from(users).where(eq(users.username, data.username.toLowerCase()));
    if (existingByUsername.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Username already taken",
      };
      return res.status(400).json(response);
    }

    // Check if email already exists
    const existingByEmail = await db.select().from(users).where(eq(users.email, data.email.toLowerCase()));
    if (existingByEmail.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Email already registered",
      };
      return res.status(400).json(response);
    }

    // Check if mobile already exists
    const normalizedMobile = data.mobile.replace(/\s/g, "");
    const existingByMobile = await db.select().from(users).where(eq(users.mobile, normalizedMobile));
    if (existingByMobile.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Phone number already registered",
      };
      return res.status(400).json(response);
    }

    const newUser = {
      id: generateId("user"),
      username: data.username,
      email: data.email,
      mobile: data.mobile,
      password: data.password, // In production, hash the password!
      firstName: data.firstName,
      familyName: data.familyName,
      role: role as "admin" | "staff" | "delivery",
      isActive: true,
      isVerified: false,
      emirate: data.emirate,
      address: data.address || null,
      preferences: {
        language: "en" as const,
        currency: "AED" as const,
        emailNotifications: true,
        smsNotifications: true,
        marketingEmails: true,
      },
    };

    await db.insert(users).values(newUser);

    const result = await db.select().from(users).where(eq(users.id, newUser.id));

    const response: ApiResponse<User> = {
      success: true,
      data: toApiUser(result[0]),
      message: "Staff user created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating user:", error);
    // Provide more helpful error messages
    let errorMessage = "Failed to create user";
    if (error instanceof Error) {
      if (error.message.includes("connection") || error.message.includes("ECONNREFUSED")) {
        errorMessage = "Database connection failed. Please try again later.";
      } else if (error.message.includes("duplicate") || error.message.includes("unique")) {
        errorMessage = "An account with this information already exists.";
      } else {
        errorMessage = error.message;
      }
    }
    const response: ApiResponse<null> = {
      success: false,
      error: errorMessage,
    };
    res.status(500).json(response);
  }
};

// PUT /api/users/:id - Update user
const updateUser: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(users).where(eq(users.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    const validation = updateUserSchema.safeParse(req.body);
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
      const emailCheck = await db.select().from(users).where(eq(users.email, data.email.toLowerCase()));
      if (emailCheck.length > 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: "Email already in use",
        };
        return res.status(400).json(response);
      }
    }

    // Build update object
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) updateData.email = data.email;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.familyName !== undefined) updateData.familyName = data.familyName;
    if (data.emirate !== undefined) updateData.emirate = data.emirate;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Update preferences
    if (data.preferences) {
      const currentPrefs = existing[0].preferences as User["preferences"] || {
        language: "en",
        currency: "AED",
        emailNotifications: true,
        smsNotifications: true,
        marketingEmails: false,
      };
      updateData.preferences = { 
        language: data.preferences.language ?? currentPrefs.language,
        currency: data.preferences.currency ?? currentPrefs.currency,
        emailNotifications: data.preferences.emailNotifications ?? currentPrefs.emailNotifications,
        smsNotifications: data.preferences.smsNotifications ?? currentPrefs.smsNotifications,
        marketingEmails: data.preferences.marketingEmails ?? currentPrefs.marketingEmails,
      };
    }

    await db.update(users).set(updateData).where(eq(users.id, id));

    const result = await db.select().from(users).where(eq(users.id, id));

    const response: ApiResponse<User> = {
      success: true,
      data: toApiUser(result[0]),
      message: "User updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating user:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/users/:id - Deactivate user
const deleteUser: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(users).where(eq(users.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    // Soft delete - just deactivate
    await db.update(users).set({ 
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(users.id, id));

    const response: ApiResponse<null> = {
      success: true,
      message: "User deactivated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting user:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/login - Login
const login: RequestHandler = async (req, res) => {
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

    // Find user by username OR email (case-insensitive)
    const result = await db.select().from(users);
    const usernameOrEmail = username.toLowerCase();
    const user = result.find(u => 
      u.username.toLowerCase() === usernameOrEmail || 
      u.email.toLowerCase() === usernameOrEmail
    );

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        error: "No account found with this username or email",
      };
      return res.status(401).json(response);
    }

    if (!user.isActive) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Account is deactivated. Please contact support.",
      };
      return res.status(401).json(response);
    }

    // Check password (in production, compare hashed passwords!)
    if (user.password !== password) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Incorrect password",
      };
      return res.status(401).json(response);
    }

    // Generate token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store session
    await db.insert(sessions).values({
      id: generateId("sess"),
      userId: user.id,
      token,
      expiresAt,
    });

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const loginResponse: LoginResponse = {
      user: toApiUser(user),
      token,
      expiresAt: expiresAt.toISOString(),
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: loginResponse,
      message: "Login successful",
    };
    res.json(response);
  } catch (error) {
    console.error("Error logging in:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/admin-login - Staff login (admin, staff, delivery)
const adminLogin: RequestHandler = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("[Staff Login] Attempt with username:", username);

    if (!username || !password) {
      console.log("[Staff Login] Missing username or password");
      const response: ApiResponse<null> = {
        success: false,
        error: "Username and password are required",
      };
      return res.status(400).json(response);
    }

    // Find staff user by username (admin, staff, or delivery roles)
    const allUsers = await db.select().from(users);
    console.log("[Staff Login] Total users in DB:", allUsers.length);
    console.log("[Staff Login] Staff users:", allUsers.filter(u => ["admin", "staff", "delivery"].includes(u.role)).map(u => ({ username: u.username, role: u.role })));
    
    const user = allUsers.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && ["admin", "staff", "delivery"].includes(u.role)
    );

    if (!user) {
      console.log("[Staff Login] No staff user found with username:", username);
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid staff credentials",
      };
      return res.status(401).json(response);
    }

    console.log("[Staff Login] Found user:", user.username, "role:", user.role, "checking password...");
    
    if (user.password !== password) {
      console.log("[Staff Login] Password mismatch");
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid staff credentials",
      };
      return res.status(401).json(response);
    }

    console.log("[Staff Login] Login successful for:", user.username);

    // Generate token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours for admin

    // Store session
    await db.insert(sessions).values({
      id: generateId("sess"),
      userId: user.id,
      token,
      expiresAt,
    });

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const loginResponse: LoginResponse = {
      user: toApiUser(user),
      token,
      expiresAt: expiresAt.toISOString(),
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: loginResponse,
      message: "Admin login successful",
    };
    res.json(response);
  } catch (error) {
    console.error("Error in admin login:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/logout - Logout
const logout: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      await db.delete(sessions).where(eq(sessions.token, token));
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "Logged out successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error logging out:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Logout failed",
    };
    res.status(500).json(response);
  }
};

// GET /api/users/me - Get current user
const getCurrentUser: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    const sessionResult = await db.select().from(sessions).where(eq(sessions.token, token));
    
    if (sessionResult.length === 0 || new Date(sessionResult[0].expiresAt) < new Date()) {
      if (sessionResult.length > 0) {
        await db.delete(sessions).where(eq(sessions.token, token));
      }
      const response: ApiResponse<null> = {
        success: false,
        error: "Session expired",
      };
      return res.status(401).json(response);
    }

    const userResult = await db.select().from(users).where(eq(users.id, sessionResult[0].userId));
    
    if (userResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<User> = {
      success: true,
      data: toApiUser(userResult[0]),
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting current user:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get current user",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/:id/change-password - Change password
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

    const userResult = await db.select().from(users).where(eq(users.id, id));
    
    if (userResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    const user = userResult[0];

    // Verify current password
    if (user.password !== currentPassword) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Current password is incorrect",
      };
      return res.status(400).json(response);
    }

    // Update password
    await db.update(users).set({ 
      password: newPassword,
      updatedAt: new Date(),
    }).where(eq(users.id, id));

    const response: ApiResponse<null> = {
      success: true,
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

// POST /api/users/:id/verify - Verify user (admin)
const verifyUser: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await db.select().from(users).where(eq(users.id, id));

    if (userResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    await db.update(users).set({ 
      isVerified: true,
      updatedAt: new Date(),
    }).where(eq(users.id, id));

    const result = await db.select().from(users).where(eq(users.id, id));

    const response: ApiResponse<User> = {
      success: true,
      data: toApiUser(result[0]),
      message: "User verified successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error verifying user:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify user",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/:id/admin-reset-password - Admin reset/set user password
const adminResetPassword: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const validation = adminResetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { newPassword } = validation.data;

    const userResult = await db.select().from(users).where(eq(users.id, id));
    
    if (userResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    // Update password
    await db.update(users).set({ 
      password: newPassword,
      updatedAt: new Date(),
    }).where(eq(users.id, id));

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: "Password reset successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error resetting password:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset password",
    };
    res.status(500).json(response);
  }
};

// GET /api/users/stats - Get user statistics
const getUserStats: RequestHandler = async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: allUsers.length,
      active: allUsers.filter((u) => u.isActive).length,
      verified: allUsers.filter((u) => u.isVerified).length,
      byRole: {
        customer: allUsers.filter((u) => u.role === "customer").length,
        admin: allUsers.filter((u) => u.role === "admin").length,
        staff: allUsers.filter((u) => u.role === "staff").length,
        delivery: allUsers.filter((u) => u.role === "delivery").length,
      },
      byEmirate: {} as Record<string, number>,
      newThisMonth: allUsers.filter((u) => new Date(u.createdAt) >= monthAgo).length,
      activeThisMonth: allUsers.filter(
        (u) => u.lastLoginAt && new Date(u.lastLoginAt) >= monthAgo
      ).length,
    };

    // Count by emirate
    allUsers.forEach((u) => {
      const emirate = u.emirate || "Unknown";
      stats.byEmirate[emirate] = (stats.byEmirate[emirate] || 0) + 1;
    });

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting user stats:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch user stats",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getUsers);
router.get("/stats", getUserStats);
router.get("/me", getCurrentUser);
router.get("/:id", getUserById);
router.post("/", createUser);
router.post("/login", login);
router.post("/admin-login", adminLogin);
router.post("/logout", logout);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.post("/:id/change-password", changePassword);
router.post("/:id/verify", verifyUser);
router.post("/:id/admin-reset-password", adminResetPassword);

export default router;
