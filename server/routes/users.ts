/**
 * User Management Routes
 * User CRUD, authentication, and role management
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import type { User, CreateUserRequest, UpdateUserRequest, LoginRequest, LoginResponse, ApiResponse, PaginatedResponse } from "@shared/api";
import { db, generateId, generateToken } from "../db";

const router = Router();

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

// Helper to exclude password from user
function sanitizeUser(user: User & { password?: string }): User {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword as User;
}

// GET /api/users - Get all users (admin)
const getUsers: RequestHandler = (req, res) => {
  try {
    const { role, isActive, search, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let users = Array.from(db.users.values()).map(sanitizeUser);

    // Filter by role
    if (role) {
      users = users.filter((u) => u.role === role);
    }

    // Filter by active status
    if (isActive !== undefined) {
      users = users.filter((u) => u.isActive === (isActive === "true"));
    }

    // Search by name, email, or mobile
    if (search) {
      const searchLower = (search as string).toLowerCase();
      users = users.filter((u) =>
        u.firstName.toLowerCase().includes(searchLower) ||
        u.familyName.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        u.mobile.includes(search as string)
      );
    }

    // Sort by creation date (newest first)
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const total = users.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = users.slice(startIndex, startIndex + limitNum);

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
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
    res.status(500).json(response);
  }
};

// GET /api/users/:id - Get user by ID
const getUserById: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const user = db.users.get(id);

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<User> = {
      success: true,
      data: sanitizeUser(user),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch user",
    };
    res.status(500).json(response);
  }
};

// POST /api/users - Create new user (register)
const createUser: RequestHandler = (req, res) => {
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

    // Check if username already exists
    const existingByUsername = Array.from(db.users.values()).find(
      (u) => u.username?.toLowerCase() === data.username.toLowerCase()
    );
    if (existingByUsername) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Username already taken",
      };
      return res.status(400).json(response);
    }

    // Check if email already exists
    const existingByEmail = Array.from(db.users.values()).find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase()
    );
    if (existingByEmail) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Email already registered",
      };
      return res.status(400).json(response);
    }

    // Check if mobile already exists
    const normalizedMobile = data.mobile.replace(/\s/g, "");
    const existingByMobile = Array.from(db.users.values()).find(
      (u) => u.mobile.replace(/\s/g, "") === normalizedMobile
    );
    if (existingByMobile) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Phone number already registered",
      };
      return res.status(400).json(response);
    }

    const user: User & { password: string } = {
      id: generateId("user"),
      username: data.username,
      email: data.email,
      mobile: data.mobile,
      password: data.password, // In production, hash the password!
      firstName: data.firstName,
      familyName: data.familyName,
      role: data.role || "customer",
      isActive: true,
      isVerified: false,
      emirate: data.emirate,
      address: data.address,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        language: "en",
        currency: "AED",
        emailNotifications: true,
        smsNotifications: true,
        marketingEmails: true,
      },
    };

    db.users.set(user.id, user);

    const response: ApiResponse<User> = {
      success: true,
      data: sanitizeUser(user),
      message: "User registered successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
    res.status(500).json(response);
  }
};

// PUT /api/users/:id - Update user
const updateUser: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const user = db.users.get(id);

    if (!user) {
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
    if (data.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = Array.from(db.users.values()).find(
        (u) => u.id !== id && u.email.toLowerCase() === data.email!.toLowerCase()
      );
      if (existing) {
        const response: ApiResponse<null> = {
          success: false,
          error: "Email already in use",
        };
        return res.status(400).json(response);
      }
    }

    // Update user fields
    if (data.email !== undefined) user.email = data.email;
    if (data.mobile !== undefined) user.mobile = data.mobile;
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.familyName !== undefined) user.familyName = data.familyName;
    if (data.emirate !== undefined) user.emirate = data.emirate;
    if (data.address !== undefined) user.address = data.address;
    if (data.role !== undefined) user.role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;

    // Update preferences
    if (data.preferences) {
      user.preferences = { ...user.preferences, ...data.preferences };
    }

    user.updatedAt = new Date().toISOString();

    const response: ApiResponse<User> = {
      success: true,
      data: sanitizeUser(user),
      message: "User updated successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/users/:id - Deactivate user
const deleteUser: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const user = db.users.get(id);

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    // Soft delete - just deactivate
    user.isActive = false;
    user.updatedAt = new Date().toISOString();

    const response: ApiResponse<null> = {
      success: true,
      message: "User deactivated successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/login - Login
const login: RequestHandler = (req, res) => {
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

    // Find user by username
    const user = Array.from(db.users.values()).find(
      (u) => u.username?.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        error: "No account found with this username",
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Store session
    db.sessions.set(token, {
      userId: user.id,
      expiresAt,
    });

    // Update last login
    user.lastLoginAt = new Date().toISOString();

    const loginResponse: LoginResponse = {
      user: sanitizeUser(user),
      token,
      expiresAt,
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: loginResponse,
      message: "Login successful",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/admin-login - Admin login
const adminLogin: RequestHandler = (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("[Admin Login] Attempt with username:", username);

    if (!username || !password) {
      console.log("[Admin Login] Missing username or password");
      const response: ApiResponse<null> = {
        success: false,
        error: "Username and password are required",
      };
      return res.status(400).json(response);
    }

    // Find admin user by username
    const allUsers = Array.from(db.users.values());
    console.log("[Admin Login] Total users in DB:", allUsers.length);
    console.log("[Admin Login] Admin users:", allUsers.filter(u => u.role === "admin").map(u => ({ username: u.username, role: u.role })));
    
    const user = allUsers.find(
      (u) => u.username?.toLowerCase() === username.toLowerCase() && u.role === "admin"
    );

    if (!user) {
      console.log("[Admin Login] No admin user found with username:", username);
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid admin credentials",
      };
      return res.status(401).json(response);
    }

    console.log("[Admin Login] Found user:", user.username, "checking password...");
    
    if (user.password !== password) {
      console.log("[Admin Login] Password mismatch");
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid admin credentials",
      };
      return res.status(401).json(response);
    }

    console.log("[Admin Login] Login successful for:", user.username);

    // Generate token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours for admin

    // Store session
    db.sessions.set(token, {
      userId: user.id,
      expiresAt,
    });

    // Update last login
    user.lastLoginAt = new Date().toISOString();

    const loginResponse: LoginResponse = {
      user: sanitizeUser(user),
      token,
      expiresAt,
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: loginResponse,
      message: "Admin login successful",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/logout - Logout
const logout: RequestHandler = (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      db.sessions.delete(token);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "Logged out successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Logout failed",
    };
    res.status(500).json(response);
  }
};

// GET /api/users/me - Get current user
const getCurrentUser: RequestHandler = (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    const session = db.sessions.get(token);
    if (!session || new Date(session.expiresAt) < new Date()) {
      db.sessions.delete(token);
      const response: ApiResponse<null> = {
        success: false,
        error: "Session expired",
      };
      return res.status(401).json(response);
    }

    const user = db.users.get(session.userId);
    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<User> = {
      success: true,
      data: sanitizeUser(user),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get current user",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/:id/change-password - Change password
const changePassword: RequestHandler = (req, res) => {
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

    const user = db.users.get(id);
    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    // Verify current password
    if (user.password !== currentPassword) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Current password is incorrect",
      };
      return res.status(400).json(response);
    }

    // Update password
    user.password = newPassword;
    user.updatedAt = new Date().toISOString();

    const response: ApiResponse<null> = {
      success: true,
      message: "Password changed successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change password",
    };
    res.status(500).json(response);
  }
};

// POST /api/users/:id/verify - Verify user (admin)
const verifyUser: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const user = db.users.get(id);

    if (!user) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User not found",
      };
      return res.status(404).json(response);
    }

    user.isVerified = true;
    user.updatedAt = new Date().toISOString();

    const response: ApiResponse<User> = {
      success: true,
      data: sanitizeUser(user),
      message: "User verified successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify user",
    };
    res.status(500).json(response);
  }
};

// GET /api/users/stats - Get user statistics
const getUserStats: RequestHandler = (req, res) => {
  try {
    const users = Array.from(db.users.values());
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      verified: users.filter((u) => u.isVerified).length,
      byRole: {
        customer: users.filter((u) => u.role === "customer").length,
        admin: users.filter((u) => u.role === "admin").length,
        staff: users.filter((u) => u.role === "staff").length,
        delivery: users.filter((u) => u.role === "delivery").length,
      },
      byEmirate: {} as Record<string, number>,
      newThisMonth: users.filter((u) => new Date(u.createdAt) >= monthAgo).length,
      activeThisMonth: users.filter(
        (u) => u.lastLoginAt && new Date(u.lastLoginAt) >= monthAgo
      ).length,
    };

    // Count by emirate
    users.forEach((u) => {
      const emirate = u.emirate || "Unknown";
      stats.byEmirate[emirate] = (stats.byEmirate[emirate] || 0) + 1;
    });

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
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

export default router;
