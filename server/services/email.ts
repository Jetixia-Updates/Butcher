/**
 * Email Notification Service
 * In production, integrate with SendGrid, Mailgun, AWS SES, or similar
 * Uses PostgreSQL for persistence
 */

import type { EmailNotificationPayload, Notification, NotificationType, Order } from "../../shared/api";
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
  customer_welcome: {
    subject: {
      en: "Welcome to Butcher - Fresh Meat Delivered! 🥩",
      ar: "مرحباً بك في الجزار - لحوم طازجة توصل لباب منزلك! 🥩"
    },
    body: {
      en: `
        <h2>Welcome to Butcher!</h2>
        <p>Thank you for joining us! We're excited to bring premium quality fresh meat right to your doorstep.</p>
        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
          <h3 style="color: #C41E3A; margin-top: 0;">Special Welcome Offer!</h3>
          <p style="font-size: 18px; margin: 10px 0;">Use promo code <strong style="font-size: 24px; color: #C41E3A;">WELCOME10</strong></p>
          <p>Get <strong>10% OFF</strong> on your first order!</p>
        </div>
        <p><strong>Why choose Butcher?</strong></p>
        <ul>
          <li>Premium quality fresh meat</li>
          <li>Expert butchers with years of experience</li>
          <li>Fast delivery across UAE</li>
          <li>Halal certified products</li>
        </ul>
        <p style="text-align: center; margin-top: 30px;">
          <a href="https://butcher.ae" style="background: #C41E3A; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Start Shopping</a>
        </p>
      `,
      ar: `
        <h2 dir="rtl">مرحباً بك في الجزار!</h2>
        <p dir="rtl">شكراً لانضمامك إلينا! نحن متحمسون لتوصيل أجود أنواع اللحوم الطازجة إلى باب منزلك.</p>
        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;" dir="rtl">
          <h3 style="color: #C41E3A; margin-top: 0;">عرض ترحيبي خاص!</h3>
          <p style="font-size: 18px; margin: 10px 0;">استخدم الرمز الترويجي <strong style="font-size: 24px; color: #C41E3A;">WELCOME10</strong></p>
          <p>احصل على خصم <strong>10%</strong> على طلبك الأول!</p>
        </div>
        <p dir="rtl"><strong>لماذا تختار الجزار؟</strong></p>
        <ul dir="rtl">
          <li>لحوم طازجة عالية الجودة</li>
          <li>جزارون خبراء بسنوات من الخبرة</li>
          <li>توصيل سريع في جميع أنحاء الإمارات</li>
          <li>منتجات حلال معتمدة</li>
        </ul>
        <p style="text-align: center; margin-top: 30px;">
          <a href="https://butcher.ae" style="background: #C41E3A; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">ابدأ التسوق</a>
        </p>
      `,
    },
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

export async function sendWelcomeEmail(
  email: string,
  userId: string,
  language: "en" | "ar" = "en"
): Promise<Notification> {
  return sendEmail(email, "customer_welcome", { userId }, language);
}

/**
 * Send invoice email for an order
 * This function generates and sends a professional invoice email with order details
 */
export async function sendInvoiceEmail(
  customerEmail: string,
  order: {
    id: string;
    orderNumber: string;
    userId: string;
    customerName: string;
    customerMobile: string;
    subtotal: number;
    discount: number;
    vatAmount: number;
    deliveryFee: number;
    total: number;
    paymentMethod: string;
    deliveryAddress?: any;
    createdAt?: Date | string;
  },
  items: Array<{
    productName: string;
    productNameAr?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>,
  language: "en" | "ar" = "en"
): Promise<Notification> {
  const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${order.orderNumber.replace('ORD-', '')}`;
  const shopTRN = "100567890123456"; // UAE TRN format
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();

  // Format items list
  const itemsListHTML = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${language === 'ar' && item.productNameAr ? item.productNameAr : item.productName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">AED ${item.unitPrice.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;"><strong>AED ${item.totalPrice.toFixed(2)}</strong></td>
    </tr>
  `).join('');

  const addressText = order.deliveryAddress
    ? `${order.deliveryAddress.building || ''}, ${order.deliveryAddress.street || ''}, ${order.deliveryAddress.area || ''}, ${order.deliveryAddress.emirate || ''}`
    : 'N/A';

  const subject = language === 'ar'
    ? `فاتورة ضريبية #${invoiceNumber} - طلبك ${order.orderNumber}`
    : `Tax Invoice #${invoiceNumber} - Order ${order.orderNumber}`;

  const emailBody = language === 'ar' ? `
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
      <h2 style="color: #C41E3A; text-align: center; margin-top: 0;" dir="rtl">📄 فاتورة ضريبية</h2>
      <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" dir="rtl">
        <div style="border-bottom: 2px solid #C41E3A; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #C41E3A; margin: 0;">🥩 جزاري</h1>
          <p style="margin: 5px 0; color: #666;">الرقم الضريبي: ${shopTRN}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0;"><strong>رقم الفاتورة:</strong></td>
              <td style="padding: 5px 0; text-align: left;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>رقم الطلب:</strong></td>
              <td style="padding: 5px 0; text-align: left;">${order.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>التاريخ:</strong></td>
              <td style="padding: 5px 0; text-align: left;">${orderDate.toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">الفاتورة إلى:</h3>
          <p style="margin: 5px 0;"><strong>العميل:</strong> ${order.customerName}</p>
          <p style="margin: 5px 0;"><strong>الهاتف:</strong> ${order.customerMobile}</p>
          <p style="margin: 5px 0;"><strong>العنوان:</strong> ${addressText}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #C41E3A; color: white;">
              <th style="padding: 12px 8px; text-align: right;">المنتج</th>
              <th style="padding: 12px 8px; text-align: center;">الكمية</th>
              <th style="padding: 12px 8px; text-align: right;">السعر</th>
              <th style="padding: 12px 8px; text-align: right;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsListHTML}
          </tbody>
        </table>

        <div style="border-top: 2px solid #eee; padding-top: 15px; margin-top: 20px;">
          <table style="width: 100%; max-width: 300px; margin-left: auto;">
            <tr>
              <td style="padding: 5px 0;">الإجمالي الجزئي:</td>
              <td style="padding: 5px 0; text-align: left;"><strong>AED ${order.subtotal.toFixed(2)}</strong></td>
            </tr>
            ${order.discount > 0 ? `
            <tr style="color: #28a745;">
              <td style="padding: 5px 0;">الخصم (-):</td>
              <td style="padding: 5px 0; text-align: left;"><strong>AED ${order.discount.toFixed(2)}</strong></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 5px 0;">الضريبة (5%):</td>
              <td style="padding: 5px 0; text-align: left;"><strong>AED ${order.vatAmount.toFixed(2)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 5px 0;">رسوم التوصيل:</td>
              <td style="padding: 5px 0; text-align: left;"><strong>AED ${order.deliveryFee.toFixed(2)}</strong></td>
            </tr>
            <tr style="border-top: 2px solid #C41E3A; font-size: 18px;">
              <td style="padding: 10px 0;"><strong>الإجمالي:</strong></td>
              <td style="padding: 10px 0; text-align: left;"><strong style="color: #C41E3A;">AED ${order.total.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; text-align: center;">
          <p style="margin: 5px 0;"><strong>طريقة الدفع:</strong> ${order.paymentMethod === 'card' ? 'بطاقة ائتمان' : order.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'الدفع عند الاستلام'}</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 5px 0;">شكراً لتسوقك معنا!</p>
          <p style="color: #999; font-size: 12px; margin: 5px 0;">هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع</p>
        </div>
      </div>
    </div>
  ` : `
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
      <h2 style="color: #C41E3A; text-align: center; margin-top: 0;">📄 Tax Invoice</h2>
      <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="border-bottom: 2px solid #C41E3A; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #C41E3A; margin: 0;">🥩 Butcher</h1>
          <p style="margin: 5px 0; color: #666;">TRN: ${shopTRN}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0; width: 40%;"><strong>Invoice Number:</strong></td>
              <td style="padding: 5px 0;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Order Number:</strong></td>
              <td style="padding: 5px 0;">${order.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Date:</strong></td>
              <td style="padding: 5px 0;">${orderDate.toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
          </table>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Bill To:</h3>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${order.customerName}</p>
          <p style="margin: 5px 0;"><strong>Mobile:</strong> ${order.customerMobile}</p>
          <p style="margin: 5px 0;"><strong>Address:</strong> ${addressText}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #C41E3A; color: white;">
              <th style="padding: 12px 8px; text-align: left;">Product</th>
              <th style="padding: 12px 8px; text-align: center;">Qty</th>
              <th style="padding: 12px 8px; text-align: right;">Price</th>
              <th style="padding: 12px 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsListHTML}
          </tbody>
        </table>

        <div style="border-top: 2px solid #eee; padding-top: 15px; margin-top: 20px;">
          <table style="width: 100%; max-width: 300px; margin-left: auto;">
            <tr>
              <td style="padding: 5px 0;">Subtotal:</td>
              <td style="padding: 5px 0; text-align: right;"><strong>AED ${order.subtotal.toFixed(2)}</strong></td>
            </tr>
            ${order.discount > 0 ? `
            <tr style="color: #28a745;">
              <td style="padding: 5px 0;">Discount (-):</td>
              <td style="padding: 5px 0; text-align: right;"><strong>AED ${order.discount.toFixed(2)}</strong></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 5px 0;">VAT (5%):</td>
              <td style="padding: 5px 0; text-align: right;"><strong>AED ${order.vatAmount.toFixed(2)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 5px 0;">Delivery Fee:</td>
              <td style="padding: 5px 0; text-align: right;"><strong>AED ${order.deliveryFee.toFixed(2)}</strong></td>
            </tr>
            <tr style="border-top: 2px solid #C41E3A; font-size: 18px;">
              <td style="padding: 10px 0;"><strong>Total:</strong></td>
              <td style="padding: 10px 0; text-align: right;"><strong style="color: #C41E3A;">AED ${order.total.toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; text-align: center;">
          <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${order.paymentMethod === 'card' ? 'Credit Card' : order.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Cash on Delivery'}</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; margin: 5px 0;">Thank you for your purchase!</p>
          <p style="color: #999; font-size: 12px; margin: 5px 0;">This is an electronic invoice and does not require a stamp or signature</p>
        </div>
      </div>
    </div>
  `;

  const fullHtml = wrapEmailInTemplate(emailBody, language);

  // Send email via gateway
  const result = await sendEmailViaGateway({
    to: customerEmail,
    subject,
    body: fullHtml,
  });

  const notifId = generateId("notif");
  const status = result.success ? "sent" : "failed";
  const sentAt = result.success ? new Date() : null;
  const failureReason = result.error || null;

  // Store in notifications table
  await db.insert(notifications).values({
    id: notifId,
    userId: order.userId,
    type: "payment_received", // Using existing type for invoice
    channel: "email",
    title: subject,
    message: subject,
    status,
    sentAt,
    failureReason,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, invoiceNumber },
  });

  return {
    id: notifId,
    userId: order.userId,
    type: "payment_received",
    channel: "email",
    title: subject,
    message: subject,
    status,
    sentAt: sentAt?.toISOString(),
    failureReason,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, invoiceNumber },
    createdAt: new Date().toISOString(),
  };
}
