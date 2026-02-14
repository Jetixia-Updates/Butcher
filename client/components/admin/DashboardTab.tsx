/**
 * Dashboard Tab Component
 * Clean analytics dashboard with charts
 */

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { analyticsApi, reportsApi } from "@/lib/api";
import type { DashboardStats, SalesByCategory } from "@shared/api";
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
        "bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 transition-all duration-200 shadow-sm",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-slate-500 text-xs sm:text-sm truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs sm:text-sm font-medium",
              change >= 0 ? "text-emerald-600" : "text-red-500"
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
        <div className={cn("mt-3 pt-3 border-t border-slate-100 flex items-center text-xs sm:text-sm text-slate-500 font-medium", isRTL ? "justify-start" : "justify-end")}>
          {viewDetailsText} {isRTL ? <ArrowLeft className="w-4 h-4 me-1" /> : <ArrowRight className="w-4 h-4 ms-1" />}
        </div>
      )}
    </div>
  );
}

// Pie chart colors matching screenshot style
const PIE_COLORS = ["#d4a843", "#e8927c", "#6dbf67", "#5fa8d3", "#a78bfa", "#f59e0b"];

// Custom tooltip for area chart
function SalesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-lg rounded-lg border border-slate-200 px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-slate-600">
          {p.name}: <span className="font-semibold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

// Custom pie chart label
function renderPieLabel({ cx, cy, midAngle, outerRadius, name, value }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" className="text-xs">
      {name}: {value}
    </text>
  );
}

export function DashboardTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chart data states
  const [revenueChart, setRevenueChart] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<{ status: string; count: number; percentage: number }[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([]);

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
    salesTrend30Days: isRTL ? 'اتجاه المبيعات (30 يوم)' : 'Sales Trend (30 Days)',
    salesByCategory: isRTL ? 'المبيعات حسب الفئة' : 'Sales by Category',
    orderStatusDistribution: isRTL ? 'توزيع حالة الطلبات' : 'Order Status Distribution',
    categoryPerformance: isRTL ? 'أداء الفئات' : 'Category Performance',
    orders: isRTL ? 'طلب' : 'orders',
    failedToLoad: isRTL ? 'فشل تحميل بيانات لوحة التحكم' : 'Failed to load dashboard data',
    retry: isRTL ? 'إعادة المحاولة' : 'Retry',
  };

  // Status label map
  const statusLabels: Record<string, string> = isRTL
    ? { pending: 'قيد الانتظار', new: 'جديد', confirmed: 'مؤكد', accepted: 'مقبول', processing: 'قيد التحضير', preparing: 'قيد التحضير', ready: 'جاهز', out_for_delivery: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغي' }
    : { pending: 'Pending', new: 'New', confirmed: 'Confirmed', accepted: 'Accepted', processing: 'Processing', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, revRes, statusRes, catRes] = await Promise.all([
        analyticsApi.getDashboard(),
        analyticsApi.getRevenueChart("month"),
        analyticsApi.getOrdersByStatus(),
        reportsApi.getSalesByCategory("month"),
      ]);
      if (dashRes.success && dashRes.data) setStats(dashRes.data);
      if (revRes.success && revRes.data) setRevenueChart(revRes.data);
      if (statusRes.success && statusRes.data) setOrdersByStatus(statusRes.data);
      if (catRes.success && catRes.data) setSalesByCategory(catRes.data);
    } catch (e) { /* ignore */ }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) =>
    amount.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Format revenue chart dates
  const formattedRevenueData = revenueChart.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }),
  }));

  // Pie chart data
  const pieData = ordersByStatus.map(s => ({
    name: statusLabels[s.status] || s.status.replace(/_/g, ' '),
    value: s.count,
  }));

  // Horizontal bar data
  const categoryBarData = salesByCategory.map(c => ({ name: c.category, sales: c.totalSales }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-300 border-t-slate-700"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">{t.failedToLoad}</p>
        <button onClick={() => fetchData()} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
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
          <h3 className="text-lg font-semibold text-slate-900">{t.todaysOverview}</h3>
          <p className="text-sm text-slate-500">{t.realtimeMetrics}</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-slate-600 transition-all duration-200 shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          {t.refresh}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <StatCard
          title={t.todaysRevenue}
          value={<span className="inline-flex items-center gap-1"><CurrencySymbol size="md" />{formatCurrency(stats.todayRevenue)}</span>}
          change={stats.revenueChange.daily}
          changeText={t.fromYesterday}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
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
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          onClick={() => onNavigate?.("orders")}
          viewDetailsText={t.viewDetails}
          isRTL={isRTL}
        />
        <StatCard
          title={t.totalCustomers}
          value={stats.totalCustomers}
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          onClick={() => onNavigate?.("users")}
          viewDetailsText={t.viewDetails}
          isRTL={isRTL}
        />
        <StatCard
          title={t.pendingOrders}
          value={stats.pendingOrders}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          onClick={() => onNavigate?.("orders")}
          viewDetailsText={t.viewDetails}
          isRTL={isRTL}
        />
      </div>

      {/* Charts Row 1: Sales Trend + Sales by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Sales Trend (30 Days) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <h4 className="font-bold text-slate-900 text-base mb-4">{t.salesTrend30Days}</h4>
          <div className="h-[280px]">
            {formattedRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedRevenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d4a843" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d4a843" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<SalesTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#d4a843" strokeWidth={2} fill="url(#salesGradient)" name={isRTL ? "الإيرادات" : "Revenue"} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
            )}
          </div>
        </div>

        {/* Sales by Category - Horizontal Bar */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <h4 className="font-bold text-slate-900 text-base mb-4">{t.salesByCategory}</h4>
          <div className="h-[280px]">
            {categoryBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBarData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), isRTL ? "المبيعات" : "Sales"]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="sales" fill="#d4a843" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Order Status + Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Order Status Distribution - Pie */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <h4 className="font-bold text-slate-900 text-base mb-4">{t.orderStatusDistribution}</h4>
          <div className="h-[300px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="40%" cy="50%" outerRadius={100} innerRadius={0} paddingAngle={1} dataKey="value" label={renderPieLabel} labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}>
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
            )}
          </div>
        </div>

        {/* Category Performance List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <h4 className="font-bold text-slate-900 text-base mb-4">{t.categoryPerformance}</h4>
          <div className="space-y-4">
            {salesByCategory.length > 0 ? (
              salesByCategory.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="text-sm font-medium text-slate-700">{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(cat.totalSales)} AED</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
                      {cat.totalQuantity} {t.orders}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
