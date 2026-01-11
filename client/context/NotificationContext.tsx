/**
 * Notification Context
 * Manages admin notifications for orders, stock alerts, and system events
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type NotificationType = "order" | "stock" | "delivery" | "payment" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  link?: string; // Optional link to navigate to
  linkTab?: string; // Optional admin tab to navigate to
  linkId?: string; // Optional ID (e.g., orderId, productId) to navigate to
  unread: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "unread">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = "butcher_admin_notifications";

// Helper to generate unique ID
const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to format relative time
export function formatRelativeTime(dateString: string, language: "en" | "ar" = "en"): string {
  const date = new Date(dateString);
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

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Notification[];
        // Sort by date (newest first) and limit to 50
        const sorted = parsed.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 50);
        setNotifications(sorted);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore storage errors
    }
  }, [notifications]);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "createdAt" | "unread">) => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      createdAt: new Date().toISOString(),
      unread: true,
    };

    setNotifications((prev) => {
      // Add new notification at the beginning
      const updated = [newNotification, ...prev];
      // Keep only the latest 50
      return updated.slice(0, 50);
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
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
  vatRate: number;
  vatAmount: number;
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

    return `
${doubleSeparator}
      فاتورة ضريبية
${doubleSeparator}
رقم الفاتورة: ${invoice.invoiceNumber}
رقم الطلب: ${invoice.orderNumber}
التاريخ: ${invoice.date}
${separator}
العميل: ${invoice.customerName}
الهاتف: ${invoice.customerMobile}
العنوان: ${invoice.customerAddress}
${separator}
المنتجات:
${itemsList}
${separator}
المجموع الفرعي: ${invoice.subtotal.toFixed(2)} د.إ
ضريبة القيمة المضافة (${invoice.vatRate}%): ${invoice.vatAmount.toFixed(2)} د.إ
${doubleSeparator}
الإجمالي: ${invoice.total.toFixed(2)} د.إ
${doubleSeparator}
طريقة الدفع: ${invoice.paymentMethod === 'card' ? 'بطاقة ائتمان' : 'الدفع عند الاستلام'}
${invoice.vatReference ? `رقم التسجيل الضريبي: ${invoice.vatReference}` : ''}

شكراً لتسوقكم معنا!
    `.trim();
  }

  const itemsList = invoice.items.map(item => 
    `• ${item.name} × ${item.quantity.toFixed(3)} gr\n  AED ${item.totalPrice.toFixed(2)}`
  ).join('\n');

  return `
${doubleSeparator}
      TAX INVOICE
${doubleSeparator}
Invoice No: ${invoice.invoiceNumber}
Order No: ${invoice.orderNumber}
Date: ${invoice.date}
${separator}
Customer: ${invoice.customerName}
Mobile: ${invoice.customerMobile}
Address: ${invoice.customerAddress}
${separator}
Items:
${itemsList}
${separator}
Subtotal: AED ${invoice.subtotal.toFixed(2)}
VAT (${invoice.vatRate}%): AED ${invoice.vatAmount.toFixed(2)}
${doubleSeparator}
TOTAL: AED ${invoice.total.toFixed(2)}
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
  message: `Your TAX invoice ${invoice.invoiceNumber} for order ${invoice.orderNumber} is ready. Total: AED ${invoice.total.toFixed(2)}`,
  messageAr: `فاتورتك الضريبية ${invoice.invoiceNumber} للطلب ${invoice.orderNumber} جاهزة. الإجمالي: ${invoice.total.toFixed(2)} د.إ`,
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
