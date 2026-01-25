/**
 * Unified Notification Service
 * Orchestrates SMS, Email, and Push notifications
 * Uses PostgreSQL for persistence
 */

import type { NotificationType, NotificationChannel, Order, Notification } from "../../shared/api";
import { db, notifications, users } from "../db/connection";
import { eq, desc, sql } from "drizzle-orm";
import {
  sendSMS,
  sendOrderPlacedSMS,
  sendOrderConfirmedSMS,
  sendOrderProcessingSMS,
  sendOrderOutForDeliverySMS,
  sendOrderDeliveredSMS,
  sendOrderCancelledSMS,
  sendPaymentReceivedSMS,
  sendLowStockAlertSMS,
} from "./sms";
import {
  sendEmail,
  sendOrderPlacedEmail,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail,
  sendPaymentReceivedEmail,
  sendRefundEmail,
  sendLowStockAlertEmail,
} from "./email";

export interface NotificationResult {
  sms?: Notification;
  email?: Notification;
  push?: Notification;
}

// Check if user has notifications enabled for a channel
async function isChannelEnabled(userId: string, channel: NotificationChannel): Promise<boolean> {
  try {
    const result = await db.select().from(users).where(eq(users.id, userId));
    if (result.length === 0) return false;
    const user = result[0];
    const prefs = user.preferences as { smsNotifications?: boolean; emailNotifications?: boolean } || {};

    switch (channel) {
      case "sms":
        return prefs.smsNotifications ?? true;
      case "email":
        return prefs.emailNotifications ?? true;
      case "push":
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// Send order status notifications
export async function sendOrderNotification(
  order: Order,
  type: NotificationType,
  options?: {
    driverName?: string;
    driverPhone?: string;
    amount?: number;
  }
): Promise<NotificationResult> {
  const result: NotificationResult = {};

  // Determine which channels to use based on user preferences
  const channels: NotificationChannel[] = [];

  if (await isChannelEnabled(order.userId, "sms")) {
    channels.push("sms");
  }
  if (await isChannelEnabled(order.userId, "email")) {
    channels.push("email");
  }

  // Send notifications in parallel
  const promises: Promise<void>[] = [];

  if (channels.includes("sms")) {
    const smsPromise = (async () => {
      switch (type) {
        case "order_placed":
          result.sms = await sendOrderPlacedSMS(order);
          break;
        case "order_confirmed":
          result.sms = await sendOrderConfirmedSMS(order);
          break;
        case "order_processing":
          result.sms = await sendOrderProcessingSMS(order);
          break;
        case "order_shipped":
          result.sms = await sendOrderOutForDeliverySMS(order, options?.driverName, options?.driverPhone);
          break;
        case "order_delivered":
          result.sms = await sendOrderDeliveredSMS(order);
          break;
        case "order_cancelled":
          result.sms = await sendOrderCancelledSMS(order);
          break;
        case "payment_received":
          result.sms = await sendPaymentReceivedSMS(order);
          break;
      }
    })();
    promises.push(smsPromise);
  }

  if (channels.includes("email")) {
    const emailPromise = (async () => {
      switch (type) {
        case "order_placed":
          result.email = await sendOrderPlacedEmail(order);
          break;
        case "order_confirmed":
          result.email = await sendOrderConfirmedEmail(order);
          break;
        case "order_delivered":
          result.email = await sendOrderDeliveredEmail(order);
          break;
        case "order_cancelled":
          result.email = await sendOrderCancelledEmail(order);
          break;
        case "payment_received":
          result.email = await sendPaymentReceivedEmail(order);
          break;
        case "refund_processed":
          result.email = await sendRefundEmail(order, options?.amount || 0);
          break;
      }
    })();
    promises.push(emailPromise);
  }

  await Promise.all(promises);

  console.log(`📬 Sent ${type} notifications for order ${order.orderNumber}:`, {
    sms: result.sms?.status,
    email: result.email?.status,
  });

  return result;
}

// Send low stock alerts to admins
export async function sendLowStockNotifications(
  productName: string,
  quantity: number,
  threshold: number
): Promise<NotificationResult[]> {
  // Get all admin users from PostgreSQL
  const admins = await db.select().from(users).where(eq(users.role, "admin"));
  const activeAdmins = admins.filter(u => u.isActive);

  const results: NotificationResult[] = [];

  for (const admin of activeAdmins) {
    const result: NotificationResult = {};
    const prefs = admin.preferences as { smsNotifications?: boolean; emailNotifications?: boolean } || {};

    if (prefs.smsNotifications) {
      result.sms = await sendLowStockAlertSMS(admin.mobile, productName, quantity);
    }

    if (prefs.emailNotifications) {
      result.email = await sendLowStockAlertEmail(admin.email, productName, quantity, threshold);
    }

    results.push(result);
  }

  return results;
}

// Get notification history for a user from PostgreSQL
export async function getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const result = await db.select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return result.map(n => ({
    id: n.id,
    userId: n.userId,
    type: n.type,
    channel: n.channel,
    title: n.title,
    message: n.message,
    messageAr: n.messageAr || undefined,
    status: n.status,
    sentAt: n.sentAt?.toISOString(),
    deliveredAt: n.deliveredAt?.toISOString(),
    failureReason: n.failureReason || undefined,
    metadata: n.metadata || undefined,
    createdAt: n.createdAt.toISOString(),
  }));
}

// Get all notifications (admin) from PostgreSQL
export async function getAllNotifications(limit = 100): Promise<Notification[]> {
  const result = await db.select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return result.map(n => ({
    id: n.id,
    userId: n.userId,
    type: n.type,
    channel: n.channel,
    title: n.title,
    message: n.message,
    messageAr: n.messageAr || undefined,
    status: n.status,
    sentAt: n.sentAt?.toISOString(),
    deliveredAt: n.deliveredAt?.toISOString(),
    failureReason: n.failureReason || undefined,
    metadata: n.metadata || undefined,
    createdAt: n.createdAt.toISOString(),
  }));
}

// Get notification stats from PostgreSQL
export async function getNotificationStats(): Promise<{
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byType: Record<NotificationType, number>;
  byChannel: Record<NotificationChannel, number>;
}> {
  const allNotifications = await db.select().from(notifications);

  const byType: Record<string, number> = {};
  const byChannel: Record<string, number> = {};

  allNotifications.forEach((n) => {
    byType[n.type] = (byType[n.type] || 0) + 1;
    byChannel[n.channel] = (byChannel[n.channel] || 0) + 1;
  });

  return {
    total: allNotifications.length,
    sent: allNotifications.filter((n) => n.status === "sent" || n.status === "delivered").length,
    failed: allNotifications.filter((n) => n.status === "failed").length,
    pending: allNotifications.filter((n) => n.status === "pending").length,
    byType: byType as Record<NotificationType, number>,
    byChannel: byChannel as Record<NotificationChannel, number>,
  };
}

// Get localized content for in-app notifications
export function getInAppNotificationContent(
  orderNumber: string,
  status: string
): {
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
} | null {
  const notifications: Record<string, {
    title: string;
    titleAr: string;
    message: string;
    messageAr: string;
  }> = {
    confirmed: {
      title: "Order Confirmed",
      titleAr: "تم تأكيد الطلب",
      message: `Great news! Your order ${orderNumber} has been confirmed`,
      messageAr: `أخبار سارة! تم تأكيد طلبك ${orderNumber}`,
    },
    processing: {
      title: "Order Being Prepared",
      titleAr: "جاري تحضير الطلب",
      message: `Your order ${orderNumber} is now being prepared`,
      messageAr: `جاري تحضير طلبك ${orderNumber} الآن`,
    },
    ready_for_pickup: {
      title: "Order Ready",
      titleAr: "الطلب جاهز",
      message: `Your order ${orderNumber} is ready for pickup/delivery`,
      messageAr: `طلبك ${orderNumber} جاهز للاستلام/التوصيل`,
    },
    out_for_delivery: {
      title: "Out for Delivery",
      titleAr: "في الطريق إليك",
      message: `Your order ${orderNumber} is on its way to you!`,
      messageAr: `طلبك ${orderNumber} في الطريق إليك!`,
    },
    delivered: {
      title: "Order Delivered",
      titleAr: "تم تسليم الطلب",
      message: `Your order ${orderNumber} has been delivered. Enjoy!`,
      messageAr: `تم تسليم طلبك ${orderNumber}. بالهناء والشفاء!`,
    },
    cancelled: {
      title: "Order Cancelled",
      titleAr: "تم إلغاء الطلب",
      message: `Your order ${orderNumber} has been cancelled`,
      messageAr: `تم إلغاء طلبك ${orderNumber}`,
    },
  };

  return notifications[status] || null;
}

