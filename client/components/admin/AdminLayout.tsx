/**
 * Admin Layout Component
 * Sidebar navigation with tabs for all admin features
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications, formatRelativeTime, createOrderNotification, createStockNotification } from "@/context/NotificationContext";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Store,
  Menu,
  X,
  Check,
  CheckCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminTab =
  | "dashboard"
  | "orders"
  | "stock"
  | "users"
  | "delivery"
  | "payments"
  | "reports"
  | "settings";

interface AdminLayoutProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  children: React.ReactNode;
  notifications?: number;
}

const tabConfig: { id: AdminTab; labelKey: string; icon: React.ElementType }[] = [
  { id: "dashboard", labelKey: "admin.dashboard", icon: LayoutDashboard },
  { id: "orders", labelKey: "admin.orders", icon: ShoppingCart },
  { id: "stock", labelKey: "admin.inventory", icon: Package },
  { id: "users", labelKey: "admin.users", icon: Users },
  { id: "delivery", labelKey: "admin.delivery", icon: Truck },
  { id: "payments", labelKey: "admin.payments", icon: CreditCard },
  { id: "reports", labelKey: "admin.reports", icon: BarChart3 },
  { id: "settings", labelKey: "admin.settings", icon: Settings },
];

export function AdminLayout({
  activeTab,
  onTabChange,
  children,
  notifications: orderNotifications = 0,
}: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAllNotifications,
    addNotification 
  } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Seed some initial demo notifications if none exist
  useEffect(() => {
    if (notifications.length === 0) {
      // Add demo notifications
      addNotification(createOrderNotification("ORD-2026-0015", "new"));
      setTimeout(() => {
        addNotification(createStockNotification("Premium Beef Steak", 2.5));
      }, 100);
      setTimeout(() => {
        addNotification(createOrderNotification("ORD-2026-0012", "delivered"));
      }, 200);
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markAsRead(notif.id);
    if (notif.linkTab) {
      onTabChange(notif.linkTab as AdminTab);
    }
    setNotificationOpen(false);
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingCart className="w-4 h-4 text-blue-500" />;
      case "stock":
        return <Package className="w-4 h-4 text-orange-500" />;
      case "delivery":
        return <Truck className="w-4 h-4 text-green-500" />;
      case "payment":
        return <CreditCard className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:transform-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{t("admin.title")}</h1>
              <p className="text-xs text-slate-400">{t("admin.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                {t(tab.labelKey)}
                {tab.id === "orders" && orderNotifications > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {orderNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">
                {user?.firstName?.[0] || "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.firstName} {user?.familyName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/products")}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              <Store className="w-4 h-4" />
              {t("admin.viewStore")}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-900">
              {activeTab === "dashboard" ? t("admin.dashboardOverview") : t(`admin.${activeTab}`)}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex gap-1 items-center bg-slate-100 border border-slate-200 rounded-md p-1">
              <button
                onClick={() => setLanguage("en")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                  language === "en"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-200"
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("ar")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                  language === "ar"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-200"
                )}
              >
                AR
              </button>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notificationOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setNotificationOpen(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">{t("admin.notifications")}</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsRead()}
                          className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            className={cn(
                              "p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group",
                              notif.unread && "bg-blue-50/50"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className="mt-0.5 flex-shrink-0">
                                {getNotificationIcon(notif.type)}
                              </div>
                              {/* Content */}
                              <div 
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => handleNotificationClick(notif)}
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {language === 'ar' ? notif.titleAr : notif.title}
                                </p>
                                <p className="text-sm text-slate-600 mt-0.5">
                                  {language === 'ar' ? notif.messageAr : notif.message}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {formatRelativeTime(notif.createdAt, language)}
                                </p>
                              </div>
                              {/* Actions */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {notif.unread && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                    className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 hover:text-green-600"
                                    title={language === 'ar' ? 'تحديد كمقروء' : 'Mark as read'}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                                  className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 hover:text-red-600"
                                  title={language === 'ar' ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              {/* Unread indicator */}
                              {notif.unread && (
                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">{t("admin.noNotifications")}</p>
                        </div>
                      )}
                    </div>
                    {/* Footer with clear all */}
                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <button
                          onClick={() => clearAllNotifications()}
                          className="w-full text-center text-sm text-slate-500 hover:text-red-600 font-medium py-1"
                        >
                          {language === 'ar' ? 'مسح جميع الإشعارات' : 'Clear all notifications'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
