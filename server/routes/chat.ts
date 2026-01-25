/**
 * Chat Support Routes
 * Messaging between customers and admin
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, desc, and, or } from "drizzle-orm";
import { db, chatMessages, users, inAppNotifications } from "../db/connection";
import { generateId } from "../db/connection";

const router = Router();

// Validation schemas
const sendMessageSchema = z.object({
    userId: z.string(), // This is the customerId
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    text: z.string().min(1),
    sender: z.enum(["user", "admin"]),
    attachments: z.array(z.any()).optional(),
});

const notifySchema = z.object({
    userId: z.string(),
    userName: z.string().optional(),
    message: z.string(),
});

// GET /api/chat/all - Get all chats for admin
const getAllChats: RequestHandler = async (req, res) => {
    try {
        // Get all messages ordered by time
        const allMessages = await db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt));

        // Group by customer
        const chatsMap = new Map<string, any>();

        for (const msg of allMessages) {
            if (!chatsMap.has(msg.customerId)) {
                chatsMap.set(msg.customerId, {
                    userId: msg.customerId,
                    userName: msg.customerName,
                    userEmail: msg.customerEmail,
                    messages: [],
                    lastMessageAt: msg.createdAt,
                    unreadCount: 0,
                });
            }

            const chat = chatsMap.get(msg.customerId);
            chat.messages.push(msg); // Add to list (desc order)

            // Update unread count (messages from user that are not read by admin)
            if (msg.sender === "user" && !msg.readByAdmin) {
                chat.unreadCount++;
            }
        }

        // Convert to array and reverse messages to be chrono order
        const chats = Array.from(chatsMap.values()).map(chat => ({
            ...chat,
            messages: chat.messages.reverse()
        }));

        res.json({ success: true, data: chats });
    } catch (error) {
        console.error("Error fetching chats:", error);
        res.status(500).json({ success: false, error: "Failed to fetch chats" });
    }
};

// GET /api/chat/:userId - Get messages for a specific user
const getUserMessages: RequestHandler = async (req, res) => {
    try {
        const { userId } = req.params;
        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.customerId, userId))
            .orderBy(desc(chatMessages.createdAt));

        res.json({ success: true, data: messages.reverse() });
    } catch (error) {
        console.error("Error fetching user messages:", error);
        res.status(500).json({ success: false, error: "Failed to fetch messages" });
    }
};

// POST /api/chat/send - Send a message
const sendMessage: RequestHandler = async (req, res) => {
    try {
        const validation = sendMessageSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ success: false, error: validation.error.errors[0].message });
        }

        const data = validation.data;

        // If sender is admin, we need customer details if not provided
        let customerName = data.userName || "Customer";
        let customerEmail = data.userEmail || "";

        // If sender is admin and we don't have details, try to fetch from DB (optional)
        // For now, assume provided or fallback

        const newMessage = {
            id: generateId("msg"),
            customerId: data.userId,
            customerName: customerName,
            customerEmail: customerEmail,
            text: data.text,
            sender: data.sender,
            attachments: data.attachments || [],
            readByAdmin: data.sender === "admin" ? true : false,
            readByCustomer: data.sender === "user" ? true : false,
            createdAt: new Date(),
        };

        await db.insert(chatMessages).values(newMessage);

        res.json({ success: true, data: newMessage });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ success: false, error: "Failed to send message" });
    }
};

// POST /api/chat/notify-admin - Notify admin of new message
const notifyAdmin: RequestHandler = async (req, res) => {
    try {
        const { userId, userName, message } = req.body;

        await db.insert(inAppNotifications).values({
            id: generateId("notif"),
            userId: "admin", // Target admin
            type: "chat",
            title: `New Message from ${userName || "Customer"}`,
            titleAr: `رسالة جديدة من ${userName || "عميل"}`,
            message: message,
            messageAr: message,
            link: "/admin/chat",
            linkId: userId,
            unread: true,
            createdAt: new Date(),
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error notifying admin:", error);
        res.status(500).json({ success: false });
    }
};

// POST /api/chat/notify-user - Notify user of new message
const notifyUser: RequestHandler = async (req, res) => {
    try {
        const { userId, message } = req.body;

        await db.insert(inAppNotifications).values({
            id: generateId("notif"),
            customerId: userId, // Target customer
            type: "chat",
            title: "New Message from Support",
            titleAr: "رسالة جديدة من الدعم",
            message: message,
            messageAr: message,
            link: "/support",
            unread: true,
            createdAt: new Date(),
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error notifying user:", error);
        res.status(500).json({ success: false });
    }
};

// POST /api/chat/:userId/read-user - Mark messages as read by user
const markReadByUser: RequestHandler = async (req, res) => {
    try {
        const { userId } = req.params;
        await db.update(chatMessages)
            .set({ readByCustomer: true })
            .where(and(eq(chatMessages.customerId, userId), eq(chatMessages.sender, "admin")));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// POST /api/chat/:userId/read-admin - Mark messages as read by admin
const markReadByAdmin: RequestHandler = async (req, res) => {
    try {
        const { userId } = req.params;
        await db.update(chatMessages)
            .set({ readByAdmin: true })
            .where(and(eq(chatMessages.customerId, userId), eq(chatMessages.sender, "user")));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// Register routes
router.get("/all", getAllChats);
router.post("/send", sendMessage);
router.post("/notify-admin", notifyAdmin);
router.post("/notify-user", notifyUser);
router.get("/:userId", getUserMessages);
router.post("/:userId/read-user", markReadByUser);
router.post("/:userId/read-admin", markReadByAdmin);

export default router;
