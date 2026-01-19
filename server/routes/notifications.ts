/**
 * In-App Notifications Routes
 * CRUD operations for user notifications stored in PostgreSQL
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { ApiResponse } from "../../shared/api";
import { db, sessions, inAppNotifications, users } from "../db/connection";

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
});

// Helper to get user ID from token
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

// Helper to get the notification userId (returns "admin" for admin users)
async function getNotificationUserId(token: string | undefined): Promise<string | null> {
  const userId = await getUserIdFromToken(token);
  if (!userId) return null;
  
  try {
    // Check if user is admin
    const userResult = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (userResult.length > 0 && userResult[0].role === "admin") {
      return ADMIN_USER_ID;
    }
    return userId;
  } catch {
    return userId;
  }
}

// GET /api/notifications - Get notifications for current user
const getNotifications: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = await getUserIdFromToken(token);
    
    // Also support query param for userId (for admin fetching user notifications)
    const targetUserId = (req.query.userId as string) || userId;
    
    if (!targetUserId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    const result = await db
      .select()
      .from(inAppNotifications)
      .where(eq(inAppNotifications.userId, targetUserId))
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(50);

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

// POST /api/notifications - Create notification for a user
const createNotification: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "userId is required",
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
      userId,
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
    const notificationUserId = await getNotificationUserId(token);

    if (!notificationUserId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    await db
      .update(inAppNotifications)
      .set({ unread: false })
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, notificationUserId)));

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
    const notificationUserId = await getNotificationUserId(token);

    if (!notificationUserId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    await db
      .update(inAppNotifications)
      .set({ unread: false })
      .where(eq(inAppNotifications.userId, notificationUserId));

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
    const notificationUserId = await getNotificationUserId(token);

    if (!notificationUserId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    await db
      .delete(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, notificationUserId)));

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
    const notificationUserId = await getNotificationUserId(token);

    if (!notificationUserId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Not authenticated",
      };
      return res.status(401).json(response);
    }

    await db.delete(inAppNotifications).where(eq(inAppNotifications.userId, notificationUserId));

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
