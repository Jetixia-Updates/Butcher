/**
 * SMS Notification Service
 * In production, integrate with Twilio, MessageBird, or local UAE providers
 * Uses PostgreSQL for persistence
 */

import type { SMSNotificationPayload, Notification, NotificationType, Order } from "@shared/api";
import { db, notifications, users, generateId } from "../db/connection";
import { eq } from "drizzle-orm";

// SMS Templates
const SMS_TEMPLATES: Record<NotificationType, { en: string; ar: string }> = {
  order_placed: {
    en: "Order #{orderNumber} confirmed! Total: AED {total}. We'll prepare your fresh meat soon. Track: {trackingUrl}",
    ar: "تم تأكيد الطلب #{orderNumber}! المجموع: {total} درهم. سنحضر لحومكم الطازجة قريباً. تتبع: {trackingUrl}",
  },
  order_confirmed: {
    en: "Great news! Your order #{orderNumber} has been confirmed and is being prepared. Est. delivery: {estimatedTime}",
    ar: "خبر رائع! تم تأكيد طلبك #{orderNumber} وجاري تحضيره. وقت التسليم المتوقع: {estimatedTime}",
  },
  order_processing: {
    en: "Your order #{orderNumber} is now being prepared by our expert butchers. Fresh and quality guaranteed!",
    ar: "جاري تحضير طلبك #{orderNumber} من قبل جزارينا المحترفين. نضمن لكم الطزاجة والجودة!",
  },
  order_ready: {
    en: "Your order #{orderNumber} is ready! Our delivery team will pick it up shortly.",
    ar: "طلبك #{orderNumber} جاهز! فريق التوصيل سيستلمه قريباً.",
  },
  order_shipped: {
    en: "Your order #{orderNumber} is on its way! Driver: {driverName}, Phone: {driverPhone}. Track: {trackingUrl}",
    ar: "طلبك #{orderNumber} في الطريق إليك! السائق: {driverName}، الهاتف: {driverPhone}. تتبع: {trackingUrl}",
  },
  order_delivered: {
    en: "Your order #{orderNumber} has been delivered! Thank you for choosing Butcher Shop. Enjoy your meal! 🥩",
    ar: "تم تسليم طلبك #{orderNumber}! شكراً لاختياركم الجزار. بالعافية! 🥩",
  },
  order_cancelled: {
    en: "Your order #{orderNumber} has been cancelled. Refund will be processed within 3-5 business days.",
    ar: "تم إلغاء طلبك #{orderNumber}. سيتم استرداد المبلغ خلال 3-5 أيام عمل.",
  },
  payment_received: {
    en: "Payment of AED {amount} received for order #{orderNumber}. Thank you!",
    ar: "تم استلام دفعة {amount} درهم للطلب #{orderNumber}. شكراً لكم!",
  },
  payment_failed: {
    en: "Payment failed for order #{orderNumber}. Please update your payment method or try again.",
    ar: "فشل الدفع للطلب #{orderNumber}. يرجى تحديث طريقة الدفع أو المحاولة مرة أخرى.",
  },
  refund_processed: {
    en: "Refund of AED {amount} processed for order #{orderNumber}. It will reflect in your account within 5-7 days.",
    ar: "تم معالجة استرداد {amount} درهم للطلب #{orderNumber}. سيظهر في حسابك خلال 5-7 أيام.",
  },
  low_stock: {
    en: "Alert: {productName} is running low on stock ({quantity} remaining). Consider restocking soon.",
    ar: "تنبيه: المخزون منخفض لـ {productName} (المتبقي: {quantity}). يرجى إعادة التوريد قريباً.",
  },
  promotional: {
    en: "{message}",
    ar: "{messageAr}",
  },
};

// Template variable replacer
function replaceTemplateVars(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

// SMS Gateway Integration (mock for demo)
async function sendSMSViaGateway(payload: SMSNotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`📱 SMS to ${payload.to}:`, payload.message);
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (Math.random() > 0.05) {
    return { success: true, messageId: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
  }
  return { success: false, error: "SMS gateway temporarily unavailable" };
}

// Helper to get user preferences from PostgreSQL
async function getUserPreferences(userId: string): Promise<{ language: "en" | "ar" } | null> {
  try {
    const result = await db.select().from(users).where(eq(users.id, userId));
    if (result.length === 0) return null;
    const user = result[0];
    return { language: (user.preferences as { language?: "en" | "ar" })?.language || "en" };
  } catch {
    return null;
  }
}

// Main SMS sending function
export async function sendSMS(
  to: string,
  type: NotificationType,
  data: Record<string, unknown>,
  language: "en" | "ar" = "en"
): Promise<Notification> {
  const template = SMS_TEMPLATES[type];
  const message = replaceTemplateVars(language === "ar" ? template.ar : template.en, data);
  const messageAr = replaceTemplateVars(template.ar, data);

  const notifId = generateId("notif");
  let status: "pending" | "sent" | "delivered" | "failed" = "pending";
  let sentAt: Date | undefined;
  let failureReason: string | undefined;

  try {
    const result = await sendSMSViaGateway({ to, message, messageAr });
    if (result.success) {
      status = "sent";
      sentAt = new Date();
    } else {
      status = "failed";
      failureReason = result.error;
    }
  } catch (error) {
    status = "failed";
    failureReason = error instanceof Error ? error.message : "Unknown error";
  }

  // Store notification in PostgreSQL
  try {
    await db.insert(notifications).values({
      id: notifId,
      userId: data.userId as string || "system",
      type: type as typeof notifications.$inferInsert.type,
      channel: "sms",
      title: "Order Update",
      message,
      messageAr,
      status,
      sentAt,
      failureReason,
      metadata: data,
    });
  } catch (err) {
    console.error("Failed to save notification to database:", err);
  }

  return {
    id: notifId,
    userId: data.userId as string || "",
    type,
    channel: "sms",
    title: "Order Update",
    message,
    messageAr,
    status,
    sentAt: sentAt?.toISOString(),
    failureReason,
    metadata: data,
    createdAt: new Date().toISOString(),
  };
}

// Order-specific SMS helpers
export async function sendOrderPlacedSMS(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendSMS(order.customerMobile, "order_placed", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    total: order.total.toFixed(2),
    trackingUrl: `https://butcher.ae/track/${order.orderNumber}`,
  }, prefs?.language || "en");
}

export async function sendOrderConfirmedSMS(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendSMS(order.customerMobile, "order_confirmed", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    estimatedTime: order.estimatedDeliveryAt || "45-60 minutes",
  }, prefs?.language || "en");
}

export async function sendOrderProcessingSMS(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendSMS(order.customerMobile, "order_processing", {
    userId: order.userId,
    orderNumber: order.orderNumber,
  }, prefs?.language || "en");
}

export async function sendOrderOutForDeliverySMS(order: Order, driverName?: string, driverPhone?: string): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendSMS(order.customerMobile, "order_shipped", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    driverName: driverName || "Driver",
    driverPhone: driverPhone || "N/A",
    trackingUrl: `https://butcher.ae/track/${order.orderNumber}`,
  }, prefs?.language || "en");
}

export async function sendOrderDeliveredSMS(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendSMS(order.customerMobile, "order_delivered", {
    userId: order.userId,
    orderNumber: order.orderNumber,
  }, prefs?.language || "en");
}

export async function sendOrderCancelledSMS(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendSMS(order.customerMobile, "order_cancelled", {
    userId: order.userId,
    orderNumber: order.orderNumber,
  }, prefs?.language || "en");
}

export async function sendPaymentReceivedSMS(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendSMS(order.customerMobile, "payment_received", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    amount: order.total.toFixed(2),
  }, prefs?.language || "en");
}

export async function sendLowStockAlertSMS(adminMobile: string, productName: string, quantity: number): Promise<Notification> {
  return sendSMS(adminMobile, "low_stock", { productName, quantity }, "en");
}
