import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { notificationsApi, InAppNotification } from "@/lib/api";
import { safeISOString, safeDate } from "@/lib/utils";

// Allow any notification type string for flexibility with server-side generated types
export type NotificationType = string;

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  link?: string | null; // Optional link to navigate to
  linkTab?: string | null; // Optional admin tab to navigate to
  linkId?: string | null; // Optional ID (e.g., orderId, productId) to navigate to
  unread: boolean;
  createdAt: string;
  userId?: string; // Optional user ID for user-specific notifications
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "unread">) => void;
  addUserNotification: (userId: string, notification: Omit<Notification, "id" | "createdAt" | "unread" | "userId">) => void;
  addAdminNotification: (notification: Omit<Notification, "id" | "createdAt" | "unread">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Admin user ID constant for admin notifications
const ADMIN_USER_ID = "admin";

// Helper to generate unique ID (for local fallback)
const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to format relative time
export function formatRelativeTime(dateString: string, language: "en" | "ar" = "en"): string {
  const date = safeDate(dateString);
  if (!date) return language === "ar" ? "غير معروف" : "Unknown";
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return language === "ar" ? "الآن" : "Just now";
  } else if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return language === "ar" ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return language === "ar" ? `منذ ${hours} ساعة` : `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return language === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
  } else {
    return date.toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

// Convert API notification to local Notification type
function toNotification(apiNotif: InAppNotification): Notification {
  return {
    id: apiNotif.id,
    type: apiNotif.type,
    title: apiNotif.title,
    titleAr: apiNotif.titleAr,
    message: apiNotif.message,
    messageAr: apiNotif.messageAr,
    link: apiNotif.link,
    linkTab: apiNotif.linkTab,
    linkId: apiNotif.linkId,
    unread: apiNotif.unread,
    createdAt: typeof apiNotif.createdAt === 'string' ? apiNotif.createdAt : safeISOString(apiNotif.createdAt),
    userId: apiNotif.userId,
  };
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get user ID for notifications
  const getUserId = useCallback(() => {
    return user?.id || null;
  }, [user?.id]);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    const userId = getUserId();
    if (!userId || !isLoggedIn) {
      setNotifications([]);
      return;
    }

    try {
      // Notifications endpoint may return 400 if server is not properly deployed
      const response = await notificationsApi.getAll(userId);
      if (response.success && response.data) {
        const sorted = response.data
          .map(toNotification)
          .sort((a, b) => (safeDate(b.createdAt)?.getTime() ?? 0) - (safeDate(a.createdAt)?.getTime() ?? 0));
        setNotifications(sorted);
      } else {
        console.warn(`[Notifications] Fetch failed for ${userId}:`, response.error);
      }
    } catch (error) {
      console.error(`[Notifications] Network error for ${userId}:`, error);
    }
  }, [getUserId, isLoggedIn]);

  // Public refresh method
  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // Load notifications on mount and when user changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll for new notifications every 5 seconds (works on both web and mobile)
  useEffect(() => {
    const userId = getUserId();
    if (!userId || !isLoggedIn) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Start polling (10 seconds for a more real-time feel)
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [getUserId, isLoggedIn, fetchNotifications]);

  // Add notification for current user
  const addNotification = useCallback(async (notification: Omit<Notification, "id" | "createdAt" | "unread">) => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await notificationsApi.create({
        userId,
        type: notification.type,
        title: notification.title,
        titleAr: notification.titleAr,
        message: notification.message,
        messageAr: notification.messageAr,
        link: notification.link || undefined,
        linkTab: notification.linkTab || undefined,
        linkId: notification.linkId || undefined,
      });

      if (response.success && response.data) {
        setNotifications((prev) => [toNotification(response.data!), ...prev].slice(0, 50));
      }
    } catch (error) {
      console.error("Failed to add notification:", error);
    }
  }, [getUserId]);

  // Add notification for a specific user (called from admin actions)
  const addUserNotification = useCallback(async (userId: string, notification: Omit<Notification, "id" | "createdAt" | "unread" | "userId">) => {
    try {
      await notificationsApi.create({
        userId,
        type: notification.type,
        title: notification.title,
        titleAr: notification.titleAr,
        message: notification.message,
        messageAr: notification.messageAr,
        link: notification.link || undefined,
        linkTab: notification.linkTab || undefined,
        linkId: notification.linkId || undefined,
      });
    } catch (error) {
      console.error("Failed to add user notification:", error);
    }
  }, []);

  // Add notification to admin (called from customer actions like placing an order)
  const addAdminNotification = useCallback(async (notification: Omit<Notification, "id" | "createdAt" | "unread">) => {
    try {
      await notificationsApi.create({
        userId: ADMIN_USER_ID,
        type: notification.type,
        title: notification.title,
        titleAr: notification.titleAr,
        message: notification.message,
        messageAr: notification.messageAr,
        link: notification.link || undefined,
        linkTab: notification.linkTab || undefined,
        linkId: notification.linkId || undefined,
      });
    } catch (error) {
      console.error("Failed to add admin notification:", error);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );

    try {
      await notificationsApi.markAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Refresh to get actual state
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

    try {
      await notificationsApi.markAllAsRead(userId);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      // Refresh to get actual state
      fetchNotifications();
    }
  }, [fetchNotifications, getUserId]);

  const deleteNotification = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await notificationsApi.delete(id);
    } catch (error) {
      console.error("Failed to delete notification:", error);
      // Refresh to get actual state
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const clearAllNotifications = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;

    // Optimistic update
    setNotifications([]);

    try {
      await notificationsApi.clearAll(userId);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
      // Refresh to get actual state
      fetchNotifications();
    }
  }, [fetchNotifications, getUserId]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        addUserNotification,
        addAdminNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

// =====================================================
// NOTIFICATION HELPERS - Use these to create notifications
// =====================================================

export const createOrderNotification = (orderNumber: string, action: "new" | "confirmed" | "delivered" | "cancelled", orderId?: string) => {
  const notifications: Record<string, { title: string; titleAr: string; message: string; messageAr: string }> = {
    new: {
      title: "New Order",
      titleAr: "طلب جديد",
      message: `Order ${orderNumber} has been placed`,
      messageAr: `تم تقديم الطلب ${orderNumber}`,
    },
    confirmed: {
      title: "Order Confirmed",
      titleAr: "تم تأكيد الطلب",
      message: `Order ${orderNumber} has been confirmed`,
      messageAr: `تم تأكيد الطلب ${orderNumber}`,
    },
    delivered: {
      title: "Order Delivered",
      titleAr: "تم تسليم الطلب",
      message: `Order ${orderNumber} has been delivered`,
      messageAr: `تم تسليم الطلب ${orderNumber}`,
    },
    cancelled: {
      title: "Order Cancelled",
      titleAr: "تم إلغاء الطلب",
      message: `Order ${orderNumber} has been cancelled`,
      messageAr: `تم إلغاء الطلب ${orderNumber}`,
    },
  };

  return {
    type: "order" as NotificationType,
    ...notifications[action],
    linkTab: "orders",
    linkId: orderId,
  };
};

export const createStockNotification = (productName: string, currentStock: number) => ({
  type: "stock" as NotificationType,
  title: "Low Stock Alert",
  titleAr: "تنبيه مخزون منخفض",
  message: `${productName} is running low (${currentStock} kg remaining)`,
  messageAr: `${productName} المخزون منخفض (${currentStock} كجم متبقي)`,
  linkTab: "stock",
});

// Notification for drivers when order is assigned
export const createDriverAssignedNotification = (orderNumber: string, customerName: string, deliveryAddress: string) => ({
  type: "delivery" as NotificationType,
  title: "New Delivery Assigned",
  titleAr: "تم تعيين توصيل جديد",
  message: `Order ${orderNumber} assigned to you. Customer: ${customerName}. Address: ${deliveryAddress}`,
  messageAr: `تم تعيين الطلب ${orderNumber} لك. العميل: ${customerName}. العنوان: ${deliveryAddress}`,
});

export const createPaymentNotification = (orderNumber: string, amount: number, status: "received" | "failed" | "refunded") => {
  const notifications: Record<string, { title: string; titleAr: string; message: string; messageAr: string }> = {
    received: {
      title: "Payment Received",
      titleAr: "تم استلام الدفع",
      message: `Payment of ${amount} AED for ${orderNumber} received`,
      messageAr: `تم استلام دفعة ${amount} درهم للطلب ${orderNumber}`,
    },
    failed: {
      title: "Payment Failed",
      titleAr: "فشل الدفع",
      message: `Payment for ${orderNumber} failed`,
      messageAr: `فشل الدفع للطلب ${orderNumber}`,
    },
    refunded: {
      title: "Payment Refunded",
      titleAr: "تم استرداد الدفع",
      message: `${amount} AED refunded for ${orderNumber}`,
      messageAr: `تم استرداد ${amount} درهم للطلب ${orderNumber}`,
    },
  };

  return {
    type: "payment" as NotificationType,
    ...notifications[status],
    linkTab: "payments",
  };
};

export const createDeliveryNotification = (orderNumber: string, driverName: string, action: "assigned" | "pickedUp" | "delivered") => {
  const notifications: Record<string, { title: string; titleAr: string; message: string; messageAr: string }> = {
    assigned: {
      title: "Driver Assigned",
      titleAr: "تم تعيين السائق",
      message: `${driverName} assigned to ${orderNumber}`,
      messageAr: `تم تعيين ${driverName} للطلب ${orderNumber}`,
    },
    pickedUp: {
      title: "Order Picked Up",
      titleAr: "تم استلام الطلب",
      message: `${orderNumber} picked up by ${driverName}`,
      messageAr: `تم استلام الطلب ${orderNumber} بواسطة ${driverName}`,
    },
    delivered: {
      title: "Delivery Complete",
      titleAr: "اكتمل التوصيل",
      message: `${orderNumber} delivered successfully`,
      messageAr: `تم توصيل الطلب ${orderNumber} بنجاح`,
    },
  };

  return {
    type: "delivery" as NotificationType,
    ...notifications[action],
    linkTab: "delivery",
  };
};

// =====================================================
// USER-FACING NOTIFICATION HELPERS
// =====================================================

export const createUserOrderNotification = (orderNumber: string, status: "placed" | "confirmed" | "preparing" | "ready" | "outForDelivery" | "delivered" | "cancelled") => {
  const notifications: Record<string, { title: string; titleAr: string; message: string; messageAr: string; link?: string }> = {
    placed: {
      title: "Order Placed Successfully",
      titleAr: "تم تقديم الطلب بنجاح",
      message: `Your order ${orderNumber} has been placed and is being processed`,
      messageAr: `تم تقديم طلبك ${orderNumber} وجاري معالجته`,
      link: "/basket",
    },
    confirmed: {
      title: "Order Confirmed",
      titleAr: "تم تأكيد الطلب",
      message: `Great news! Your order ${orderNumber} has been confirmed`,
      messageAr: `أخبار سارة! تم تأكيد طلبك ${orderNumber}`,
    },
    preparing: {
      title: "Order Being Prepared",
      titleAr: "جاري تحضير الطلب",
      message: `Your order ${orderNumber} is now being prepared`,
      messageAr: `جاري تحضير طلبك ${orderNumber} الآن`,
    },
    ready: {
      title: "Order Ready",
      titleAr: "الطلب جاهز",
      message: `Your order ${orderNumber} is ready for pickup/delivery`,
      messageAr: `طلبك ${orderNumber} جاهز للاستلام/التوصيل`,
    },
    outForDelivery: {
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

  return {
    type: "order" as NotificationType,
    ...notifications[status],
  };
};

export const createUserPaymentNotification = (orderNumber: string, amount: number, status: "success" | "failed" | "refunded") => {
  const notifications: Record<string, { title: string; titleAr: string; message: string; messageAr: string }> = {
    success: {
      title: "Payment Successful",
      titleAr: "تم الدفع بنجاح",
      message: `Payment of ${amount} AED for order ${orderNumber} was successful`,
      messageAr: `تم دفع ${amount} درهم للطلب ${orderNumber} بنجاح`,
    },
    failed: {
      title: "Payment Failed",
      titleAr: "فشل الدفع",
      message: `Payment for order ${orderNumber} failed. Please try again`,
      messageAr: `فشل الدفع للطلب ${orderNumber}. يرجى المحاولة مرة أخرى`,
    },
    refunded: {
      title: "Refund Processed",
      titleAr: "تم الاسترداد",
      message: `${amount} AED has been refunded for order ${orderNumber}`,
      messageAr: `تم استرداد ${amount} درهم للطلب ${orderNumber}`,
    },
  };

  return {
    type: "payment" as NotificationType,
    ...notifications[status],
  };
};

export const createUserDeliveryNotification = (orderNumber: string, driverName: string, action: "assigned" | "arriving" | "arrived") => {
  const notifications: Record<string, { title: string; titleAr: string; message: string; messageAr: string }> = {
    assigned: {
      title: "Driver Assigned",
      titleAr: "تم تعيين السائق",
      message: `${driverName} will deliver your order ${orderNumber}`,
      messageAr: `${driverName} سيقوم بتوصيل طلبك ${orderNumber}`,
    },
    arriving: {
      title: "Driver Arriving Soon",
      titleAr: "السائق في الطريق",
      message: `${driverName} is nearby with your order ${orderNumber}`,
      messageAr: `${driverName} قريب منك مع طلبك ${orderNumber}`,
    },
    arrived: {
      title: "Driver Has Arrived",
      titleAr: "وصل السائق",
      message: `${driverName} has arrived with your order ${orderNumber}`,
      messageAr: `وصل ${driverName} مع طلبك ${orderNumber}`,
    },
  };

  return {
    type: "delivery" as NotificationType,
    ...notifications[action],
  };
};

export const createPromoNotification = (title: string, titleAr: string, message: string, messageAr: string, link?: string) => ({
  type: "system" as NotificationType,
  title,
  titleAr,
  message,
  messageAr,
  link,
});

// =====================================================
// TAX INVOICE NOTIFICATION HELPERS
// =====================================================

export interface InvoiceItem {
  name: string;
  nameAr?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  discountCode?: string;
  vatRate: number;
  vatAmount: number;
  deliveryFee?: number; // Total delivery fee (base + express)
  expressDeliveryFee?: number; // Express delivery fee only (legacy, kept for compatibility)
  isExpressDelivery?: boolean; // Whether express delivery was selected
  deliveryDate?: string;
  deliveryTime?: string;
  driverTip?: number;
  total: number;
  paymentMethod: "card" | "cod";
  vatReference?: string;
}

/**
 * Generate a unique invoice number based on order number and timestamp
 */
export const generateInvoiceNumber = (orderNumber: string): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${orderNumber.replace('ORD-', '')}`;
};

/**
 * Format invoice for display in notification
 */
export const formatInvoiceForNotification = (invoice: InvoiceData, language: "en" | "ar" = "en"): string => {
  const separator = "─".repeat(30);
  const doubleSeparator = "═".repeat(30);

  if (language === "ar") {
    const itemsList = invoice.items.map(item =>
      `• ${item.nameAr || item.name} × ${item.quantity.toFixed(3)} جم\n  ${item.totalPrice.toFixed(2)} د.إ`
    ).join('\n');

    // Build breakdown lines
    const breakdownLines: string[] = [];
    breakdownLines.push(`المجموع الفرعي: ${Number(invoice.subtotal).toFixed(2)} د.إ`);
    if (invoice.discount && Number(invoice.discount) > 0) {
      breakdownLines.push(`الخصم${invoice.discountCode ? ` (${invoice.discountCode})` : ''}: -${Number(invoice.discount).toFixed(2)} د.إ`);
    }
    breakdownLines.push(`ضريبة القيمة المضافة (${invoice.vatRate}%): ${Number(invoice.vatAmount).toFixed(2)} د.إ`);
    const deliveryFeeAmount = Number(invoice.deliveryFee ?? invoice.expressDeliveryFee ?? 0);
    if (deliveryFeeAmount > 0) {
      const deliveryLabel = invoice.isExpressDelivery ? '⚡ توصيل سريع' : '🚚 رسوم التوصيل';
      breakdownLines.push(`${deliveryLabel}: ${deliveryFeeAmount.toFixed(2)} د.إ`);
    }
    if (invoice.driverTip && Number(invoice.driverTip) > 0) {
      breakdownLines.push(`💚 إكرامية السائق: ${Number(invoice.driverTip).toFixed(2)} د.إ`);
    }

    // Build address section with optional delivery date/time
    let addressSection = `العميل: ${invoice.customerName}\nالهاتف: ${invoice.customerMobile}\nالعنوان: ${invoice.customerAddress}`;
    if (invoice.deliveryDate) addressSection += `\nتاريخ التوصيل: ${invoice.deliveryDate}`;
    if (invoice.deliveryTime) addressSection += `\nوقت التوصيل: ${invoice.deliveryTime}`;

    return `
${doubleSeparator}
      فاتورة ضريبية
${doubleSeparator}
رقم الفاتورة: ${invoice.invoiceNumber}
رقم الطلب: ${invoice.orderNumber}
التاريخ: ${invoice.date}
${separator}
${addressSection}
${separator}
المنتجات:
${itemsList}
${separator}
${breakdownLines.join('\n')}
${doubleSeparator}
الإجمالي: ${Number(invoice.total).toFixed(2)} د.إ
${doubleSeparator}
طريقة الدفع: ${invoice.paymentMethod === 'card' ? 'بطاقة ائتمان' : 'الدفع عند الاستلام'}
${invoice.vatReference ? `رقم التسجيل الضريبي: ${invoice.vatReference}` : ''}

شكراً لتسوقكم معنا!
    `.trim();
  }

  const itemsList = invoice.items.map(item =>
    `• ${item.name} × ${Number(item.quantity).toFixed(3)} gr\n  AED ${Number(item.totalPrice).toFixed(2)}`
  ).join('\n');

  // Build breakdown lines
  const breakdownLines: string[] = [];
  breakdownLines.push(`Subtotal: AED ${Number(invoice.subtotal).toFixed(2)}`);
  if (invoice.discount && Number(invoice.discount) > 0) {
    breakdownLines.push(`Discount${invoice.discountCode ? ` (${invoice.discountCode})` : ''}: -AED ${Number(invoice.discount).toFixed(2)}`);
  }
  breakdownLines.push(`VAT (${invoice.vatRate}%): AED ${Number(invoice.vatAmount).toFixed(2)}`);
  const deliveryFeeAmountEn = Number(invoice.deliveryFee ?? invoice.expressDeliveryFee ?? 0);
  if (deliveryFeeAmountEn > 0) {
    const deliveryLabelEn = invoice.isExpressDelivery ? '⚡ Express Delivery' : '🚚 Delivery Fee';
    breakdownLines.push(`${deliveryLabelEn}: AED ${deliveryFeeAmountEn.toFixed(2)}`);
  }
  if (invoice.driverTip && Number(invoice.driverTip) > 0) {
    breakdownLines.push(`💚 Driver Tip: AED ${Number(invoice.driverTip).toFixed(2)}`);
  }

  // Build address section with optional delivery date/time
  let addressSectionEn = `Customer: ${invoice.customerName}\nMobile: ${invoice.customerMobile}\nAddress: ${invoice.customerAddress}`;
  if (invoice.deliveryDate) addressSectionEn += `\nDelivery Date: ${invoice.deliveryDate}`;
  if (invoice.deliveryTime) addressSectionEn += `\nDelivery Time: ${invoice.deliveryTime}`;

  return `
${doubleSeparator}
      TAX INVOICE
${doubleSeparator}
Invoice No: ${invoice.invoiceNumber}
Order No: ${invoice.orderNumber}
Date: ${invoice.date}
${separator}
${addressSectionEn}
${separator}
Items:
${itemsList}
${separator}
${breakdownLines.join('\n')}
${doubleSeparator}
TOTAL: AED ${Number(invoice.total).toFixed(2)}
${doubleSeparator}
Payment Method: ${invoice.paymentMethod === 'card' ? 'Credit Card' : 'Cash on Delivery'}
${invoice.vatReference ? `VAT Reference: ${invoice.vatReference}` : ''}

Thank you for shopping with us!
  `.trim();
};

/**
 * Create a TAX invoice notification for the user
 */
export const createInvoiceNotification = (invoice: InvoiceData) => ({
  type: "payment" as NotificationType,
  title: "TAX Invoice Ready",
  titleAr: "الفاتورة الضريبية جاهزة",
  message: `Your TAX invoice ${invoice.invoiceNumber} for order ${invoice.orderNumber} is ready. Total: AED ${Number(invoice.total).toFixed(2)}`,
  messageAr: `فاتورتك الضريبية ${invoice.invoiceNumber} للطلب ${invoice.orderNumber} جاهزة. الإجمالي: ${Number(invoice.total).toFixed(2)} د.إ`,
});

/**
 * Create a detailed TAX invoice notification with full invoice text
 */
export const createDetailedInvoiceNotification = (invoice: InvoiceData) => ({
  type: "payment" as NotificationType,
  title: `📄 TAX Invoice #${invoice.invoiceNumber}`,
  titleAr: `📄 فاتورة ضريبية #${invoice.invoiceNumber}`,
  message: formatInvoiceForNotification(invoice, "en"),
  messageAr: formatInvoiceForNotification(invoice, "ar"),
});
