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

export const createOrderNotification = (orderNumber: string, action: "new" | "confirmed" | "delivered" | "cancelled") => {
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
