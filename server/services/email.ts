/**
 * Email Notification Service
 * In production, integrate with SendGrid, Mailgun, AWS SES, or similar
 * Uses PostgreSQL for persistence
 */

import type { EmailNotificationPayload, Notification, NotificationType, Order } from "@shared/api";
import { db, notifications, users, generateId } from "../db/connection";
import { eq } from "drizzle-orm";

// Email Templates
const EMAIL_TEMPLATES: Record<NotificationType, { subject: { en: string; ar: string }; body: { en: string; ar: string } }> = {
  order_placed: {
    subject: { en: "Order Confirmed - #{orderNumber}", ar: "تم تأكيد الطلب - #{orderNumber}" },
    body: {
      en: `<h2>Thank you for your order!</h2><p>Your order <strong>#{orderNumber}</strong> has been received.</p><p><strong>Total:</strong> AED {total}</p><p>Track your order: <a href="{trackingUrl}">{trackingUrl}</a></p>`,
      ar: `<h2 dir="rtl">شكراً لطلبك!</h2><p dir="rtl">تم استلام طلبك <strong>#{orderNumber}</strong>.</p><p dir="rtl"><strong>الإجمالي:</strong> {total} درهم</p>`,
    },
  },
  order_confirmed: {
    subject: { en: "Order #{orderNumber} Confirmed", ar: "تم تأكيد الطلب #{orderNumber}" },
    body: {
      en: `<h2>Your order is confirmed!</h2><p>Order <strong>#{orderNumber}</strong> is being prepared.</p><p><strong>Estimated Delivery:</strong> {estimatedTime}</p>`,
      ar: `<h2 dir="rtl">تم تأكيد طلبك!</h2><p dir="rtl">طلبك <strong>#{orderNumber}</strong> قيد التحضير.</p>`,
    },
  },
  order_processing: {
    subject: { en: "Order #{orderNumber} - Being Prepared", ar: "الطلب #{orderNumber} - جاري التحضير" },
    body: {
      en: `<h2>Your order is being prepared!</h2><p>Our expert butchers are preparing order <strong>#{orderNumber}</strong>.</p>`,
      ar: `<h2 dir="rtl">جاري تحضير طلبك!</h2><p dir="rtl">جزارونا يحضرون طلبك <strong>#{orderNumber}</strong>.</p>`,
    },
  },
  order_ready: {
    subject: { en: "Order #{orderNumber} - Ready", ar: "الطلب #{orderNumber} - جاهز" },
    body: {
      en: `<h2>Your order is ready!</h2><p>Order <strong>#{orderNumber}</strong> is ready for delivery.</p>`,
      ar: `<h2 dir="rtl">طلبك جاهز!</h2><p dir="rtl">الطلب <strong>#{orderNumber}</strong> جاهز للتوصيل.</p>`,
    },
  },
  order_shipped: {
    subject: { en: "Order #{orderNumber} - On The Way", ar: "الطلب #{orderNumber} - في الطريق" },
    body: {
      en: `<h2>Your order is on the way!</h2><p>Order <strong>#{orderNumber}</strong> is being delivered.</p><p>Driver: {driverName}</p>`,
      ar: `<h2 dir="rtl">طلبك في الطريق!</h2><p dir="rtl">الطلب <strong>#{orderNumber}</strong> قيد التوصيل.</p>`,
    },
  },
  order_delivered: {
    subject: { en: "Order #{orderNumber} Delivered!", ar: "تم تسليم الطلب #{orderNumber}!" },
    body: {
      en: `<h2>Your order has been delivered!</h2><p>Order <strong>#{orderNumber}</strong> is complete. Enjoy your meal! 🥩</p>`,
      ar: `<h2 dir="rtl">تم تسليم طلبك!</h2><p dir="rtl">الطلب <strong>#{orderNumber}</strong> مكتمل. بالعافية! 🥩</p>`,
    },
  },
  order_cancelled: {
    subject: { en: "Order #{orderNumber} Cancelled", ar: "تم إلغاء الطلب #{orderNumber}" },
    body: {
      en: `<h2>Order Cancelled</h2><p>Order <strong>#{orderNumber}</strong> has been cancelled. Refund will be processed within 3-5 days.</p>`,
      ar: `<h2 dir="rtl">تم إلغاء الطلب</h2><p dir="rtl">تم إلغاء الطلب <strong>#{orderNumber}</strong>. سيتم الاسترداد خلال 3-5 أيام.</p>`,
    },
  },
  payment_received: {
    subject: { en: "Payment Received - #{orderNumber}", ar: "تم استلام الدفع - #{orderNumber}" },
    body: {
      en: `<h2>Payment Received</h2><p>We received AED {amount} for order <strong>#{orderNumber}</strong>.</p>`,
      ar: `<h2 dir="rtl">تم استلام الدفع</h2><p dir="rtl">استلمنا {amount} درهم للطلب <strong>#{orderNumber}</strong>.</p>`,
    },
  },
  payment_failed: {
    subject: { en: "Payment Failed - #{orderNumber}", ar: "فشل الدفع - #{orderNumber}" },
    body: {
      en: `<h2>Payment Failed</h2><p>Payment for order <strong>#{orderNumber}</strong> failed. Please try again.</p>`,
      ar: `<h2 dir="rtl">فشل الدفع</h2><p dir="rtl">فشل دفع الطلب <strong>#{orderNumber}</strong>. يرجى المحاولة مجدداً.</p>`,
    },
  },
  refund_processed: {
    subject: { en: "Refund Processed - #{orderNumber}", ar: "تم الاسترداد - #{orderNumber}" },
    body: {
      en: `<h2>Refund Processed</h2><p>AED {amount} has been refunded for order <strong>#{orderNumber}</strong>.</p>`,
      ar: `<h2 dir="rtl">تم الاسترداد</h2><p dir="rtl">تم استرداد {amount} درهم للطلب <strong>#{orderNumber}</strong>.</p>`,
    },
  },
  low_stock: {
    subject: { en: "Low Stock Alert - {productName}", ar: "تنبيه مخزون منخفض - {productName}" },
    body: {
      en: `<h2>Low Stock Alert</h2><p><strong>{productName}</strong> has only {quantity} units remaining (threshold: {threshold}).</p>`,
      ar: `<h2 dir="rtl">تنبيه مخزون منخفض</h2><p dir="rtl">المنتج <strong>{productName}</strong> متبقي منه {quantity} وحدات فقط.</p>`,
    },
  },
  promotional: {
    subject: { en: "{subject}", ar: "{subjectAr}" },
    body: { en: "{message}", ar: "{messageAr}" },
  },
};

function replaceTemplateVars(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

function wrapEmailInTemplate(content: string, language: "en" | "ar" = "en"): string {
  return `<!DOCTYPE html><html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;}h2{color:#C41E3A;}</style></head>
<body><div style="text-align:center;margin-bottom:30px;"><h1 style="color:#C41E3A;">🥩 Butcher Shop</h1></div>${content}
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#666;"><p>Butcher Shop - Premium Fresh Meat</p></div></body></html>`;
}

async function sendEmailViaGateway(payload: EmailNotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`📧 Email to ${payload.to}:`, payload.subject);
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (Math.random() > 0.02) {
    return { success: true, messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
  }
  return { success: false, error: "Email service temporarily unavailable" };
}

async function getUserPreferences(userId: string): Promise<{ language: "en" | "ar" } | null> {
  try {
    const result = await db.select().from(users).where(eq(users.id, userId));
    if (result.length === 0) return null;
    return { language: (result[0].preferences as { language?: "en" | "ar" })?.language || "en" };
  } catch {
    return null;
  }
}

export async function sendEmail(
  to: string,
  type: NotificationType,
  data: Record<string, unknown>,
  language: "en" | "ar" = "en"
): Promise<Notification> {
  const template = EMAIL_TEMPLATES[type];
  const subject = replaceTemplateVars(language === "ar" ? template.subject.ar : template.subject.en, data);
  const bodyContent = replaceTemplateVars(language === "ar" ? template.body.ar : template.body.en, data);
  const body = wrapEmailInTemplate(bodyContent, language);

  const notifId = generateId("notif");
  let status: "pending" | "sent" | "delivered" | "failed" = "pending";
  let sentAt: Date | undefined;
  let failureReason: string | undefined;

  try {
    const result = await sendEmailViaGateway({ to, subject, body });
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

  try {
    await db.insert(notifications).values({
      id: notifId,
      userId: data.userId as string || "system",
      type: type as typeof notifications.$inferInsert.type,
      channel: "email",
      title: subject,
      message: bodyContent,
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
    channel: "email",
    title: subject,
    message: bodyContent,
    status,
    sentAt: sentAt?.toISOString(),
    failureReason,
    metadata: data,
    createdAt: new Date().toISOString(),
  };
}

export async function sendOrderPlacedEmail(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendEmail(order.customerEmail, "order_placed", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    total: order.total.toFixed(2),
    trackingUrl: `https://butcher.ae/track/${order.orderNumber}`,
  }, prefs?.language || "en");
}

export async function sendOrderConfirmedEmail(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendEmail(order.customerEmail, "order_confirmed", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    estimatedTime: order.estimatedDeliveryAt || "45-60 minutes",
  }, prefs?.language || "en");
}

export async function sendOrderDeliveredEmail(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendEmail(order.customerEmail, "order_delivered", {
    userId: order.userId,
    orderNumber: order.orderNumber,
  }, prefs?.language || "en");
}

export async function sendOrderCancelledEmail(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendEmail(order.customerEmail, "order_cancelled", {
    userId: order.userId,
    orderNumber: order.orderNumber,
  }, prefs?.language || "en");
}

export async function sendPaymentReceivedEmail(order: Order): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendEmail(order.customerEmail, "payment_received", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    amount: order.total.toFixed(2),
  }, prefs?.language || "en");
}

export async function sendRefundEmail(order: Order, amount: number): Promise<Notification> {
  const prefs = await getUserPreferences(order.userId);
  return sendEmail(order.customerEmail, "refund_processed", {
    userId: order.userId,
    orderNumber: order.orderNumber,
    amount: amount.toFixed(2),
  }, prefs?.language || "en");
}

export async function sendLowStockAlertEmail(adminEmail: string, productName: string, quantity: number, threshold: number): Promise<Notification> {
  return sendEmail(adminEmail, "low_stock", { productName, quantity, threshold }, "en");
}
