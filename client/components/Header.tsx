import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Package, Truck, CreditCard, CheckCircle, X, Trash2, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBasket } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications, formatRelativeTime, Notification } from "@/context/NotificationContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  showBasketIcon?: boolean;
}

// User notification types with icons
const getNotificationIcon = (type: string, title?: string) => {
  // Check if it's an invoice notification
  if (title && (title.includes("TAX Invoice") || title.includes("فاتورة ضريبية"))) {
    return <FileText className="w-4 h-4 text-emerald-500" />;
  }
  
  switch (type) {
    case "order":
      return <Package className="w-4 h-4 text-blue-500" />;
    case "delivery":
      return <Truck className="w-4 h-4 text-green-500" />;
    case "payment":
      return <CreditCard className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

export const Header: React.FC<HeaderProps> = ({ showBasketIcon = true }) => {
  const navigate = useNavigate();
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { itemCount } = useBasket();
  const { t, language } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useNotifications();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Notification | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Filter notifications for user (exclude admin-only types like stock)
  const userNotifications = notifications.filter(n => 
    ["order", "delivery", "payment", "system"].includes(n.type)
  ).slice(0, 10);

  const userUnreadCount = userNotifications.filter(n => n.unread).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Check if this is a TAX invoice notification (title contains "TAX Invoice" or "فاتورة ضريبية")
    if (notification.title.includes("TAX Invoice") || notification.title.includes("فاتورة ضريبية")) {
      setSelectedInvoice(notification);
      setShowNotifications(false);
      return;
    }
    
    if (notification.link) {
      navigate(notification.link);
    }
    setShowNotifications(false);
  };

  // Check if a notification is an invoice
  const isInvoiceNotification = (notification: Notification) => {
    return notification.title.includes("TAX Invoice") || notification.title.includes("فاتورة ضريبية");
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Left: Language Switcher */}
          <div className="flex-1">
            <LanguageSwitcher variant="compact" />
          </div>

          {/* Center: Logo */}
          <Link
            to="/"
            className="flex-1 text-center"
          >
            <div className="inline-block">
              <h1 className="text-2xl font-bold text-primary">
                🥩 {t("header.title")}
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                {t("header.subtitle")}
              </p>
            </div>
          </Link>

          {/* Right: Auth & Basket */}
          <div className="flex-1 flex justify-end items-center gap-4">
            {/* Notification Bell - Only for logged in users */}
            {isLoggedIn && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-primary" />
                  {userUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {userUnreadCount > 9 ? "9+" : userUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                      <h3 className="font-semibold text-gray-900">
                        {language === "ar" ? "الإشعارات" : "Notifications"}
                      </h3>
                      <div className="flex items-center gap-2">
                        {userUnreadCount > 0 && (
                          <button
                            onClick={() => markAllAsRead()}
                            className="text-xs text-primary hover:underline"
                          >
                            {language === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto">
                      {userNotifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>{language === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
                        </div>
                      ) : (
                        userNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                              notification.unread ? "bg-blue-50/50" : ""
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notification.type, notification.title)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm ${notification.unread ? "font-semibold" : "font-medium"} text-gray-900`}>
                                  {language === "ar" ? notification.titleAr : notification.title}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                  className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
                                >
                                  <X className="w-3 h-3 text-gray-400" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                {isInvoiceNotification(notification) 
                                  ? (language === "ar" ? "اضغط لعرض الفاتورة الكاملة" : "Click to view full invoice")
                                  : (language === "ar" ? notification.messageAr : notification.message)
                                }
                              </p>
                              {isInvoiceNotification(notification) && (
                                <span className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600 font-medium">
                                  <FileText className="w-3 h-3" />
                                  {language === "ar" ? "عرض الفاتورة" : "View Invoice"}
                                </span>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {formatRelativeTime(notification.createdAt, language)}
                              </p>
                            </div>
                            {notification.unread && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    {userNotifications.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-t">
                        <button
                          onClick={() => {
                            clearAllNotifications();
                            setShowNotifications(false);
                          }}
                          className="w-full text-center text-xs text-red-500 hover:text-red-600 py-1 flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          {language === "ar" ? "مسح جميع الإشعارات" : "Clear all notifications"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {showBasketIcon && isLoggedIn && (
              <Link to="/basket" className="relative group">
                <svg
                  className="w-6 h-6 text-primary group-hover:text-primary/80 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10-8l2 8m-6 8a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z"
                  />
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
            )}

            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {user?.firstName}
                </span>
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    className="btn-outline text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t("header.adminPanel")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    window.location.href = "/";
                  }}
                  className="btn-outline text-sm"
                >
                  {t("login.logout")}
                </button>
              </div>
            ) : (
              <Link to="/" className="btn-primary text-sm">
                {t("login.loginLink")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-white">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <div>
                  <h2 className="font-bold text-lg">
                    {language === "ar" ? "فاتورة ضريبية" : "TAX Invoice"}
                  </h2>
                  <p className="text-sm opacity-90">
                    {formatRelativeTime(selectedInvoice.createdAt, language)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Invoice Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 leading-relaxed">
                {language === "ar" ? selectedInvoice.messageAr : selectedInvoice.message}
              </pre>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex gap-3">
              <button
                onClick={() => {
                  // Copy invoice to clipboard
                  const invoiceText = language === "ar" ? selectedInvoice.messageAr : selectedInvoice.message;
                  navigator.clipboard.writeText(invoiceText);
                  alert(language === "ar" ? "تم نسخ الفاتورة!" : "Invoice copied to clipboard!");
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {language === "ar" ? "نسخ الفاتورة" : "Copy Invoice"}
              </button>
              <button
                onClick={() => {
                  // Print invoice
                  const invoiceText = language === "ar" ? selectedInvoice.messageAr : selectedInvoice.message;
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>${language === "ar" ? "فاتورة ضريبية" : "TAX Invoice"}</title>
                          <style>
                            body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
                            @media print { body { padding: 0; } }
                          </style>
                        </head>
                        <body>${invoiceText}</body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {language === "ar" ? "طباعة" : "Print"}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
