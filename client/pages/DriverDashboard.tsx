/**
 * Driver Dashboard
 * Allows delivery drivers to view and manage their assigned deliveries
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  Package,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  Navigation,
  User,
  LogOut,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Camera,
  FileSignature,
  Bell,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications, createUserOrderNotification, createUserDeliveryNotification, formatRelativeTime } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useToast } from "@/hooks/use-toast";

interface DeliveryOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  status: string;
  customerName: string;
  customerMobile: string;
  deliveryAddress: {
    area: string;
    emirate: string;
    street: string;
    building: string;
    floor?: string;
    apartment?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
  items: { name: string; quantity: number }[];
  total: number;
  estimatedArrival: string;
  timeline: { status: string; timestamp: string; notes?: string }[];
  createdAt: string;
}

const translations = {
  en: {
    driverDashboard: "Driver Dashboard",
    myDeliveries: "My Deliveries",
    noDeliveries: "No deliveries assigned",
    noDeliveriesDesc: "You'll see your assigned orders here",
    refresh: "Refresh",
    logout: "Logout",
    orderNumber: "Order",
    customer: "Customer",
    address: "Address",
    items: "items",
    total: "Total",
    status: "Status",
    updateStatus: "Update Status",
    pickUp: "Pick Up Order",
    startDelivery: "Start Delivery",
    arriving: "Arriving Soon",
    complete: "Complete Delivery",
    delivered: "Delivered",
    call: "Call",
    navigate: "Navigate",
    confirmPickup: "Confirm you've picked up the order?",
    confirmDelivery: "Confirm delivery completed?",
    deliveryNotes: "Delivery Notes (optional)",
    notesPlaceholder: "e.g., Left with security",
    confirm: "Confirm",
    cancel: "Cancel",
    timeline: "Timeline",
    estimatedArrival: "Est. Arrival",
    assigned: "Assigned",
    picked_up: "Picked Up",
    in_transit: "In Transit",
    nearby: "Nearby",
    welcome: "Welcome",
    todayDeliveries: "Today's Deliveries",
    completed: "Completed",
    pending: "Pending",
    loginRequired: "Please login to continue",
    login: "Login",
    username: "Username or Email",
    password: "Password",
    loginError: "Invalid credentials",
    loggingIn: "Logging in...",
    notifications: "Notifications",
    noNotifications: "No notifications",
    markAllRead: "Mark all read",
    newDeliveryAssigned: "New Delivery Assigned",
  },
  ar: {
    driverDashboard: "لوحة تحكم السائق",
    myDeliveries: "توصيلاتي",
    noDeliveries: "لا توجد توصيلات",
    noDeliveriesDesc: "ستظهر هنا الطلبات المعينة لك",
    refresh: "تحديث",
    logout: "تسجيل الخروج",
    orderNumber: "الطلب",
    customer: "العميل",
    address: "العنوان",
    items: "عناصر",
    total: "المجموع",
    status: "الحالة",
    updateStatus: "تحديث الحالة",
    pickUp: "استلام الطلب",
    startDelivery: "بدء التوصيل",
    arriving: "على وشك الوصول",
    complete: "إتمام التوصيل",
    delivered: "تم التوصيل",
    call: "اتصال",
    navigate: "الملاحة",
    confirmPickup: "تأكيد استلام الطلب؟",
    confirmDelivery: "تأكيد إتمام التوصيل؟",
    deliveryNotes: "ملاحظات التوصيل (اختياري)",
    notesPlaceholder: "مثال: تم تسليمه للأمن",
    confirm: "تأكيد",
    cancel: "إلغاء",
    timeline: "السجل",
    estimatedArrival: "الوصول المتوقع",
    assigned: "تم التعيين",
    picked_up: "تم الاستلام",
    in_transit: "في الطريق",
    nearby: "قريب",
    welcome: "مرحباً",
    todayDeliveries: "توصيلات اليوم",
    completed: "مكتمل",
    pending: "قيد الانتظار",
    loginRequired: "يرجى تسجيل الدخول للمتابعة",
    login: "تسجيل الدخول",
    username: "اسم المستخدم أو البريد",
    password: "كلمة المرور",
    loginError: "بيانات غير صحيحة",
    loggingIn: "جاري تسجيل الدخول...",
    notifications: "الإشعارات",
    noNotifications: "لا توجد إشعارات",
    markAllRead: "تحديد الكل كمقروء",
    newDeliveryAssigned: "توصيل جديد",
  },
};

// Status flow for driver actions
const STATUS_FLOW = ["assigned", "picked_up", "in_transit", "nearby", "delivered"];

export default function DriverDashboardPage() {
  const navigate = useNavigate();
  const { user, loginAdmin, logout, isLoggedIn, isAuthLoading } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { notifications, unreadCount, addUserNotification, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const isRTL = language === "ar";
  const t = translations[language];

  // Loading Screen for Auth Initialization
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOrder | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  // Login form state
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Check if user is a driver
  const isDriver = user?.role === "delivery";

  const fetchDeliveries = useCallback(async () => {
    if (!user || !isDriver) return;

    setLoading(true);
    try {
      // Fetch tracking assigned to this driver explicitly
      const query = new URLSearchParams({
        driverId: user.id,
        t: new Date().getTime().toString()
      }).toString();
      const response = await fetch(`/api/delivery/tracking?${query}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      const result = await response.json();

      if (result.success && result.data) {
        console.log(`[DriverDashboard] Fetched ${result.data.length} deliveries for driver ${user.id}`);
        // Map backend data to UI format
        // Backend returns enriched data with customerName etc.
        const myDeliveries = result.data.map((tracking: any) => ({
          id: tracking.id,
          orderId: tracking.orderId,
          orderNumber: tracking.orderNumber,
          status: tracking.status,
          customerName: tracking.customerName || "Customer",
          customerMobile: tracking.customerMobile || "",
          deliveryAddress: tracking.deliveryAddress || {
            area: "Dubai",
            emirate: "Dubai",
            street: "",
            building: "",
          },
          items: tracking.items || [],
          total: tracking.total || 0,
          estimatedArrival: tracking.estimatedArrival,
          timeline: tracking.timeline || [],
          createdAt: tracking.createdAt,
        }));
        setDeliveries(myDeliveries);
      } else {
        console.warn("[DriverDashboard] API error:", result.error);
      }
    } catch (error) {
      console.error("[DriverDashboard] Error fetching deliveries:", error);
    }
    setLoading(false);
  }, [user, isDriver]);

  useEffect(() => {
    if (isLoggedIn && isDriver) {
      fetchDeliveries();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, isDriver, fetchDeliveries]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    try {
      const result = await loginAdmin(loginForm.username, loginForm.password);
      if (!result.success) {
        setLoginError(result.error || t.loginError);
      }
    } catch (error) {
      setLoginError(t.loginError);
    }
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/driver");
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[currentIndex + 1];
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      assigned: t.assigned,
      picked_up: t.picked_up,
      in_transit: t.in_transit,
      nearby: t.nearby,
      delivered: t.delivered,
    };
    return labels[status] || status;
  };

  const getActionLabel = (nextStatus: string): string => {
    const actions: Record<string, string> = {
      picked_up: t.pickUp,
      in_transit: t.startDelivery,
      nearby: t.arriving,
      delivered: t.complete,
    };
    return actions[nextStatus] || t.updateStatus;
  };

  const handleStatusUpdate = (delivery: DeliveryOrder) => {
    const next = getNextStatus(delivery.status);
    if (!next) return;

    setSelectedDelivery(delivery);
    setNextStatus(next);
    setDeliveryNotes("");
    setShowConfirmModal(true);
  };

  const confirmStatusUpdate = async () => {
    if (!selectedDelivery) return;

    setUpdating(selectedDelivery.id);
    setShowConfirmModal(false);

    try {
      const endpoint = `/api/delivery/tracking/${selectedDelivery.orderId}/update`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          status: nextStatus,
          notes: deliveryNotes || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: isRTL ? "تم التحديث" : "Status Updated",
          description: isRTL
            ? `تم تغيير حالة الطلب إلى ${getStatusLabel(nextStatus)}`
            : `Order status changed to ${getStatusLabel(nextStatus)}`,
        });
        await fetchDeliveries();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        toast({
          title: isRTL ? "فشل التحديث" : "Update Failed",
          description: errorData.error || (isRTL ? "حدث خطأ أثناء تحديث الحالة" : "Failed to update order status"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: isRTL ? "خطأ في الشبكة" : "Network Error",
        description: isRTL ? "يرجى التحقق من الاتصال بالإنترنت" : "Please check your internet connection",
        variant: "destructive",
      });
    }

    setUpdating(null);
    setSelectedDelivery(null);
    setNextStatus("");
    setDeliveryNotes("");
  };

  const handleCall = (mobile: string) => {
    window.location.href = `tel:${mobile}`;
  };

  const handleNavigate = (address: DeliveryOrder["deliveryAddress"]) => {
    // If we have latitude and longitude, use them for precise navigation
    if (address.latitude && address.longitude) {
      // Use Google Maps directions with coordinates for precise navigation
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${address.latitude},${address.longitude}`,
        "_blank"
      );
    } else {
      // Fallback to text-based search
      const query = encodeURIComponent(
        `${address.building}, ${address.street}, ${address.area}, ${address.emirate}`
      );
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
    }
  };

  const formatTime = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString(isRTL ? "ar-AE" : "en-AE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{t.driverDashboard}</h1>
            <p className="text-slate-500 mt-2">{t.loginRequired}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.username}
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="driver1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.password}
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loggingIn ? t.loggingIn : t.login}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Not a driver
  if (!isDriver) {
    return (
      <div
        className="min-h-screen bg-slate-100 flex items-center justify-center p-4"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {isRTL ? "غير مصرح" : "Access Denied"}
          </h1>
          <p className="text-slate-500 mb-6">
            {isRTL
              ? "هذه الصفحة للسائقين فقط"
              : "This page is for delivery drivers only"}
          </p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
          >
            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  // Stats
  const completedCount = deliveries.filter((d) => d.status === "delivered").length;
  const pendingCount = deliveries.filter((d) => d.status !== "delivered").length;

  return (
    <div className="min-h-screen bg-slate-100" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="bg-primary text-white p-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm opacity-80">{t.welcome}</p>
              <h1 className="font-bold">{user?.firstName} {user?.familyName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className={`absolute top-full mt-2 ${isRTL ? "left-0" : "right-0"} w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden`}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {t.notifications}
                    </h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsRead()}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          {t.markAllRead}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>{t.noNotifications}</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`flex items-start gap-3 px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition-colors ${notification.unread ? "bg-blue-50/50" : ""
                            }`}
                          onClick={() => {
                            markAsRead(notification.id);
                            if (notification.link) {
                              navigate(notification.link);
                            }
                            setShowNotifications(false);
                          }}
                        >
                          <div className="flex-shrink-0 mt-1">
                            <Package className="w-4 h-4 text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm ${notification.unread ? "font-semibold" : "font-medium"} text-gray-900`}>
                                {isRTL ? notification.titleAr : notification.title}
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
                              {isRTL ? notification.messageAr : notification.message}
                            </p>
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
                </div>
              )}
            </div>
            <button
              onClick={fetchDeliveries}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-2xl mx-auto p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
                <p className="text-sm text-slate-500">{t.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
                <p className="text-sm text-slate-500">{t.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Deliveries List */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">{t.myDeliveries}</h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-900 font-medium">{t.noDeliveries}</p>
            <p className="text-sm text-slate-500 mt-1">{t.noDeliveriesDesc}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries
              .sort((a, b) => {
                // Show pending first, then completed
                if (a.status === "delivered" && b.status !== "delivered") return 1;
                if (a.status !== "delivered" && b.status === "delivered") return -1;
                return 0;
              })
              .map((delivery) => {
                const nextStatus = getNextStatus(delivery.status);
                const isCompleted = delivery.status === "delivered";

                return (
                  <div
                    key={delivery.id}
                    className={cn(
                      "bg-white rounded-xl shadow-sm overflow-hidden",
                      isCompleted && "opacity-60"
                    )}
                  >
                    {/* Order Header */}
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            #{delivery.orderNumber}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              isCompleted
                                ? "bg-green-100 text-green-700"
                                : "bg-primary/10 text-primary"
                            )}
                          >
                            {getStatusLabel(delivery.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <CurrencySymbol size="sm" />
                          <span className="font-medium">{Number(delivery.total).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-slate-600">
                          <User className="w-4 h-4" />
                          {delivery.customerName}
                        </div>
                        {delivery.customerMobile && (
                          <button
                            onClick={() => handleCall(delivery.customerMobile)}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Phone className="w-4 h-4" />
                            {t.call}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="p-4 bg-slate-50">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-900">
                            {delivery.deliveryAddress.building}
                            {delivery.deliveryAddress.floor &&
                              `, Floor ${delivery.deliveryAddress.floor}`}
                            {delivery.deliveryAddress.apartment &&
                              `, Apt ${delivery.deliveryAddress.apartment}`}
                          </p>
                          <p className="text-sm text-slate-600">
                            {delivery.deliveryAddress.street}, {delivery.deliveryAddress.area}
                          </p>
                          <p className="text-sm text-slate-500">
                            {delivery.deliveryAddress.emirate}
                          </p>
                          {delivery.deliveryAddress.landmark && (
                            <p className="text-xs text-slate-400 mt-1">
                              📍 {delivery.deliveryAddress.landmark}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleNavigate(delivery.deliveryAddress)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
                        >
                          <Navigation className="w-4 h-4" />
                          {t.navigate}
                        </button>
                      </div>
                    </div>

                    {/* Action Button */}
                    {!isCompleted && nextStatus && (
                      <div className="p-4">
                        <button
                          onClick={() => handleStatusUpdate(delivery)}
                          disabled={updating === delivery.id}
                          className={cn(
                            "w-full py-3 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-colors",
                            nextStatus === "delivered"
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-primary hover:bg-primary/90",
                            updating === delivery.id && "opacity-50"
                          )}
                        >
                          {updating === delivery.id ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : nextStatus === "delivered" ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                          {getActionLabel(nextStatus)}
                        </button>
                      </div>
                    )}

                    {/* Timeline (for completed) */}
                    {isCompleted && delivery.timeline.length > 0 && (
                      <div className="p-4 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-500 mb-2">{t.timeline}</p>
                        <div className="flex flex-wrap gap-2">
                          {delivery.timeline.map((event, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded"
                            >
                              <span className="text-slate-700 capitalize">
                                {event.status.replace("_", " ")}
                              </span>
                              <span className="text-slate-400">{formatTime(event.timestamp)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {nextStatus === "delivered" ? t.confirmDelivery : t.confirmPickup}
            </h3>

            <p className="text-sm text-slate-600 mb-4">
              {t.orderNumber}: <strong>#{selectedDelivery.orderNumber}</strong>
            </p>

            {nextStatus === "delivered" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t.deliveryNotes}
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmStatusUpdate}
                className={cn(
                  "flex-1 py-3 text-white rounded-lg font-medium",
                  nextStatus === "delivered"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
