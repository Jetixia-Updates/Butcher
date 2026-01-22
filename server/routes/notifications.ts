/**
 * In-App Notifications Routes
 * CRUD operations for notifications stored in PostgreSQL
 * Supports both customers and staff (admin) users
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, and, desc, or } from "drizzle-orm";
import type { ApiResponse } from "../../shared/api";
import { db, sessions, customerSessions, inAppNotifications, users } from "../db/connection";

const router = Router();

// Constant for admin notifications - must match client-side ADMIN_USER_ID
const ADMIN_USER_ID = "admin";

// Helper to generate unique IDs
const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Validation schemas
const createNotificationSchema = z.object({
  type: z.enum(["order", "stock", "delivery", "payment", "system"]),
  title: z.string().min(1),
  titleAr: z.string().min(1),
  message: z.string().min(1),
  messageAr: z.string().min(1),
  link: z.string().optional(),
  linkTab: z.string().optional(),
  linkId: z.string().optional(),
  userId: z.string().optional(),
  customerId: z.string().optional(),
});

// Helper to get staff user ID from token
async function getUserIdFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  
  try {
    const sessionResult = await db.select().from(sessions).where(eq(sessions.token, token));
    if (sessionResult.length === 0 || new Date(sessionResult[0].expiresAt) < new Date()) {
      return null;
    }
    return sessionResult[0].userId;
  } catch {
    return null;
  }
}

// Helper to get customer ID from token
async function getCustomerIdFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  
  try {
    const sessionResult = await db.select().from(customerSessions).where(eq(customerSessions.token, token));
    if (sessionResult.length === 0 || new Date(sessionResult[0].expiresAt) < new Date()) {
      return null;
    }
    return sessionResult[0].customerId;
  } catch {
    return null;
  }
}

// Helper to get the notification target (staff user ID or customer ID)
async function getNotificationTarget(token: string | undefined): Promise<{ userId?: string; customerId?: string } | null> {
  // Try staff session first
  const userId = await getUserIdFromToken(token);
  if (userId) {
    // Check if user is admin - use special admin ID for notifications
    try {
      const userResult = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
      if (userResult.length > 0 && userResult[0].role === "admin") {
        return { userId: ADMIN_USER_ID };
      }
      return { userId };
    } catch {
      return { userId };
    }
  }
  
  // Try customer session
  const customerId = await getCustomerIdFromToken(token);
  if (customerId) {
    return { customerId };
  }
  
  return null;
}

// GET /api/notifications - Get notifications for current user/customer
const getNotifications: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const target = await getNotificationTarget(token);
    
    // Also support query params for fetching specific user/customer notifications
    const queryUserId = req.query.userId as string;
    const queryCustomerId = req.query.customerId as string;
    
    // Determine which ID to use
    let targetUserId = queryUserId || target?.userId;
    let targetCustomerId = queryCustomerId || target?.customerId;
    
    console.log(`[Notifications] Fetching notifications for userId=${targetUserId}, customerId=${targetCustomerId}`);
    
    if (!targetUserId && !targetCustomerId) {
      console.log(`[Notifications] ❌ Not authenticated - no ID found`);
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    let result;
    if (targetCustomerId) {
      result = await db
        .select()
        .from(inAppNotifications)
        .where(eq(inAppNotifications.customerId, targetCustomerId))
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(50);
    } else {
      result = await db
        .select()
        .from(inAppNotifications)
        .where(eq(inAppNotifications.userId, targetUserId!))
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(50);
    }

    console.log(`[Notifications] ✅ Found ${result.length} notifications`);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch notifications",
    };
    res.status(500).json(response);
  }
};

// POST /api/notifications - Create notification for a user or customer
const createNotification: RequestHandler = async (req, res) => {
  try {
    const { userId, customerId } = req.body;
    
    if (!userId && !customerId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "userId or customerId is required",
      };
      return res.status(400).json(response);
    }

    const validation = createNotificationSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;

    const newNotification = {
      id: generateId(),
      userId: userId || null,
      customerId: customerId || null,
      type: data.type,
      title: data.title,
      titleAr: data.titleAr,
      message: data.message,
      messageAr: data.messageAr,
      link: data.link || null,
      linkTab: data.linkTab || null,
      linkId: data.linkId || null,
      unread: true,
      createdAt: new Date(),
    };

    await db.insert(inAppNotifications).values(newNotification);

    const response: ApiResponse<typeof newNotification> = {
      success: true,
      data: newNotification,
      message: "Notification created",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating notification:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create notification",
    };
    res.status(500).json(response);
  }
};

// PATCH /api/notifications/:id/read - Mark notification as read
const markAsRead: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace("Bearer ", "");
    const target = await getNotificationTarget(token);

    if (!target) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    if (target.customerId) {
      await db
        .update(inAppNotifications)
        .set({ unread: false })
        .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.customerId, target.customerId)));
    } else {
      await db
        .update(inAppNotifications)
        .set({ unread: false })
        .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, target.userId!)));
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "Notification marked as read",
    };
    res.json(response);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark as read",
    };
    res.status(500).json(response);
  }
};

// PATCH /api/notifications/read-all - Mark all notifications as read
const markAllAsRead: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const target = await getNotificationTarget(token);

    if (!target) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    if (target.customerId) {
      await db
        .update(inAppNotifications)
        .set({ unread: false })
        .where(eq(inAppNotifications.customerId, target.customerId));
    } else {
      await db
        .update(inAppNotifications)
        .set({ unread: false })
        .where(eq(inAppNotifications.userId, target.userId!));
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "All notifications marked as read",
    };
    res.json(response);
  } catch (error) {
    console.error("Error marking all as read:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark all as read",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/notifications/:id - Delete notification
const deleteNotification: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace("Bearer ", "");
    const target = await getNotificationTarget(token);

    if (!target) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    if (target.customerId) {
      await db
        .delete(inAppNotifications)
        .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.customerId, target.customerId)));
    } else {
      await db
        .delete(inAppNotifications)
        .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, target.userId!)));
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "Notification deleted",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting notification:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete notification",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/notifications - Clear all notifications
const clearAllNotifications: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const target = await getNotificationTarget(token);

    if (!target) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    if (target.customerId) {
      await db.delete(inAppNotifications).where(eq(inAppNotifications.customerId, target.customerId));
    } else {
      await db.delete(inAppNotifications).where(eq(inAppNotifications.userId, target.userId!));
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "All notifications cleared",
    };
    res.json(response);
  } catch (error) {
    console.error("Error clearing notifications:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear notifications",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getNotifications);
router.post("/", createNotification);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/:id", deleteNotification);
router.delete("/", clearAllNotifications);

export default router;
