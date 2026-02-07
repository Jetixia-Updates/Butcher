/**
 * Dashboard Tab Component
 * Real-time analytics and stats overview
 */

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  Clock,
  RefreshCw,
  Eye,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { analyticsApi } from "@/lib/api";
import type { DashboardStats } from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  change?: number;
  changeText?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  onClick?: () => void;
  viewDetailsText?: string;
  isRTL?: boolean;
}

function StatCard({ title, value, change, changeText, icon: Icon, iconColor, iconBg, onClick, viewDetailsText, isRTL }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4 sm:p-6 transition-all duration-300",
        onClick && "cursor-pointer hover:bg-slate-800/80 hover:border-white/10 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-slate-400 text-xs sm:text-sm truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-white mt-1 truncate">{value}</p>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs sm:text-sm font-medium",
              change >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {change >= 0 ? (
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              )}
              <span className="truncate">{Math.abs(change)}% {changeText}</span>
            </div>
          )}
        </div>
        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
          <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", iconColor)} />
        </div>
      </div>
      {onClick && (
        <div className={cn("mt-3 pt-3 border-t border-white/5 flex items-center text-xs sm:text-sm text-red-400 font-medium", isRTL ? "justify-start" : "justify-end")}>
          {viewDetailsText} {isRTL ? <ArrowLeft className="w-4 h-4 me-1" /> : <ArrowRight className="w-4 h-4 ms-1" />}
        </div>
      )}
    </div>
  );
}

export function DashboardTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Translations
  const t = {
    todaysOverview: isRTL ? 'نظرة عامة على اليوم' : "Today's Overview",
    realtimeMetrics: isRTL ? 'مقاييس الأعمال في الوقت الفعلي' : 'Real-time business metrics',
    refresh: isRTL ? 'تحديث' : 'Refresh',
    todaysRevenue: isRTL ? 'إيرادات اليوم' : "Today's Revenue",
    todaysOrders: isRTL ? 'طلبات اليوم' : "Today's Orders",
    totalCustomers: isRTL ? 'إجمالي العملاء' : 'Total Customers',
    pendingOrders: isRTL ? 'الطلبات المعلقة' : 'Pending Orders',
    fromYesterday: isRTL ? 'من الأمس' : 'from yesterday',
    viewDetails: isRTL ? 'عرض التفاصيل' : 'View Details',
    weeklyPerformance: isRTL ? 'الأداء الأسبوعي' : 'Weekly Performance',
    monthlyPerformance: isRTL ? 'الأداء الشهري' : 'Monthly Performance',
    revenue: isRTL ? 'الإيرادات' : 'Revenue',
    orders: isRTL ? 'الطلبات' : 'Orders',
    avgOrderValue: isRTL ? 'متوسط قيمة الطلب' : 'Avg. Order Value',
    newCustomers: isRTL ? 'عملاء جدد' : 'New Customers',
    lowStockAlerts: isRTL ? 'تنبيهات المخزون المنخفض' : 'Low Stock Alerts',
    left: isRTL ? 'متبقي' : 'left',
    viewAllAlerts: isRTL ? 'عرض جميع التنبيهات' : 'View all',
    alerts: isRTL ? 'تنبيهات' : 'alerts',
    allWellStocked: isRTL ? 'جميع المنتجات متوفرة بكميات جيدة' : 'All products are well stocked',
    recentOrders: isRTL ? 'الطلبات الأخيرة' : 'Recent Orders',
    viewAll: isRTL ? 'عرض الكل' : 'View All',
    order: isRTL ? 'الطلب' : 'Order',
    customer: isRTL ? 'العميل' : 'Customer',
    items: isRTL ? 'العناصر' : 'Items',
    total: isRTL ? 'المجموع' : 'Total',
    status: isRTL ? 'الحالة' : 'Status',
    payment: isRTL ? 'الدفع' : 'Payment',
    action: isRTL ? 'الإجراء' : 'Action',
    itemsCount: isRTL ? 'عناصر' : 'items',
    viewOrder: isRTL ? 'عرض الطلب' : 'View order',
    failedToLoad: isRTL ? 'فشل تحميل بيانات لوحة التحكم' : 'Failed to load dashboard data',
    retry: isRTL ? 'إعادة المحاولة' : 'Retry',
  };

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const response = await analyticsApi.getDashboard();
    if (response.success && response.data) {
      setStats(response.data);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 seconds
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-red-500/20 border-t-red-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{t.failedToLoad}</p>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{t.todaysOverview}</h3>
          <p className="text-sm text-slate-400">{t.realtimeMetrics}</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 disabled:opacity-50 text-slate-300 transition-all duration-200"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          {t.refresh}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard
          title={t.todaysRevenue}
          value={
            <span className="inline-flex items-center gap-1">
              <CurrencySymbol size="md" />
              {formatCurrency(stats.todayRevenue)}
            </span>
          }
          change={stats.revenueChange.daily}
          changeText={t.fromYesterday}
          icon={DollarSign}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 ring-1 ring-emerald-500/20"
          onClick={() => onNavigate?.("reports")}
          viewDetailsText={t.viewDetails}
          isRTL={isRTL}
        />
        <StatCard
          title={t.todaysOrders}
          value={stats.todayOrders}
          change={stats.ordersChange.daily}
          changeText={t.fromYesterday}
          icon={ShoppingCart}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10 ring-1 ring-blue-500/20"
          onClick={() => onNavigate?.("orders")}
          viewDetailsText={t.viewDetails}
          isRTL={isRTL}
        />
        <StatCard
          title={t.totalCustomers}
          value={stats.totalCustomers}
          icon={Users}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10 ring-1 ring-violet-500/20"
          onClick={() => onNavigate?.("users")}
          viewDetailsText={t.viewDetails}
          isRTL={isRTL}
        />
        <StatCard
          title={t.pendingOrders}
          value={stats.pendingOrders}
          icon={Clock}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 ring-1 ring-amber-500/20"
          onClick={() => onNavigate?.("orders")}
          viewDetailsText={t.viewDetails}
          isRTL={isRTL}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4 sm:p-6">
          <h4 className="font-semibold text-white mb-4 text-sm sm:text-base">{t.weeklyPerformance}</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">{t.revenue}</span>
              <span className="font-semibold text-white inline-flex items-center gap-1">
                <CurrencySymbol size="sm" />
                {formatCurrency(stats.weekRevenue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.orders}</span>
              <span className="font-semibold text-white">{stats.weekOrders}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">{t.avgOrderValue}</span>
              <span className="font-semibold text-white inline-flex items-center gap-1">
                <CurrencySymbol size="sm" />
                {formatCurrency(stats.averageOrderValue)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4 sm:p-6">
          <h4 className="font-semibold text-white mb-4 text-sm sm:text-base">{t.monthlyPerformance}</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">{t.revenue}</span>
              <span className="font-semibold text-white inline-flex items-center gap-1">
                <CurrencySymbol size="sm" />
                {formatCurrency(stats.monthRevenue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.orders}</span>
              <span className="font-semibold text-white">{stats.monthOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.newCustomers}</span>
              <span className="font-semibold text-white">{stats.newCustomers}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-white text-sm sm:text-base">{t.lowStockAlerts}</h4>
            {stats.lowStockCount > 0 && (
              <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded-full ring-1 ring-red-500/30">
                {stats.lowStockCount}
              </span>
            )}
          </div>
          {stats.lowStockItems.length > 0 ? (
            <div className="space-y-2">
              {stats.lowStockItems.slice(0, 3).map((item) => (
                <div
                  key={item.productId}
                  onClick={() => onNavigate?.("stock")}
                  className="flex items-center justify-between p-2 bg-red-500/5 border border-red-500/10 rounded-lg cursor-pointer hover:bg-red-500/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-slate-300 truncate max-w-[120px]">
                      {item.productName}
                    </span>
                  </div>
                  <span className="text-sm text-red-400 font-semibold">
                    {item.currentQuantity} {t.left}
                  </span>
                </div>
              ))}
              {stats.lowStockItems.length > 3 && (
                <button
                  onClick={() => onNavigate?.("stock")}
                  className="w-full text-xs text-red-400 font-medium text-center mt-2 hover:underline"
                >
                  {t.viewAllAlerts} {stats.lowStockItems.length} {t.alerts} →
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              {t.allWellStocked}
            </p>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between">
          <h4 className="font-semibold text-white text-sm sm:text-base">{t.recentOrders}</h4>
          <button
            onClick={() => onNavigate?.("orders")}
            className="text-sm text-red-400 font-medium hover:text-red-300 flex items-center gap-1 transition-colors"
          >
            {t.viewAll} {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-right" : "text-left")}>
                  {t.order}
                </th>
                <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:table-cell", isRTL ? "text-right" : "text-left")}>
                  {t.customer}
                </th>
                <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden md:table-cell", isRTL ? "text-right" : "text-left")}>
                  {t.items}
                </th>
                <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-right" : "text-left")}>
                  {t.total}
                </th>
                <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-right" : "text-left")}>
                  {t.status}
                </th>
                <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden lg:table-cell", isRTL ? "text-right" : "text-left")}>
                  {t.payment}
                </th>
                <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-left" : "text-right")}>
                  {t.action}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stats.recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <button
                      onClick={() => onNavigate?.("orders")}
                      className="font-mono text-xs sm:text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {order.orderNumber}
                    </button>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-300 hidden sm:table-cell">
                    {order.customerName}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-400 hidden md:table-cell">
                    {order.itemCount} {t.itemsCount}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-white">
                    <span className="inline-flex items-center gap-1">
                      <CurrencySymbol size="sm" />
                      {formatCurrency(order.total)}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <OrderStatusBadge status={order.status} isRTL={isRTL} />
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                    <PaymentStatusBadge status={order.paymentStatus} isRTL={isRTL} />
                  </td>
                  <td className={cn("px-3 sm:px-6 py-3 sm:py-4", isRTL ? "text-left" : "text-right")}>
                    <button
                      onClick={() => onNavigate?.("orders")}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title={t.viewOrder}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status, isRTL }: { status: string; isRTL?: boolean }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
    confirmed: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20",
    processing: "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20",
    out_for_delivery: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20",
    delivered: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
    cancelled: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
  };

  const labels: Record<string, { en: string; ar: string }> = {
    pending: { en: 'Pending', ar: 'قيد الانتظار' },
    confirmed: { en: 'Confirmed', ar: 'مؤكد' },
    processing: { en: 'Processing', ar: 'قيد المعالجة' },
    out_for_delivery: { en: 'Out for Delivery', ar: 'في الطريق' },
    delivered: { en: 'Delivered', ar: 'تم التسليم' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
  };

  const label = labels[status] || { en: status.replace(/_/g, ' '), ar: status };

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-xs font-medium",
      styles[status] || "bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20"
    )}>
      {isRTL ? label.ar : label.en}
    </span>
  );
}

function PaymentStatusBadge({ status, isRTL }: { status: string; isRTL?: boolean }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
    authorized: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20",
    captured: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
    failed: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
    refunded: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20",
  };

  const labels: Record<string, { en: string; ar: string }> = {
    pending: { en: 'Pending', ar: 'قيد الانتظار' },
    authorized: { en: 'Authorized', ar: 'مصرح' },
    captured: { en: 'Captured', ar: 'مكتمل' },
    failed: { en: 'Failed', ar: 'فشل' },
    refunded: { en: 'Refunded', ar: 'مسترد' },
  };

  const label = labels[status] || { en: status, ar: status };

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-xs font-medium",
      styles[status] || "bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20"
    )}>
      {isRTL ? label.ar : label.en}
    </span>
  );
}
