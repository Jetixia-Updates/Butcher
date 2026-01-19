/**
 * Reports Tab
 * Sales reports, analytics charts, and data export
 */

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Package,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  PieChart,
  ArrowUp,
  ArrowDown,
  Users,
  User,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  XCircle,
  CheckCircle,
  Clock,
  Truck,
  Ban,
} from "lucide-react";
import { reportsApi, analyticsApi, ordersApi, usersApi } from "@/lib/api";
import type { SalesReportData, SalesByCategory, SalesByProduct, Order, User as UserType } from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

type ReportPeriod = "today" | "week" | "month" | "year";
type ReportType = "sales" | "customers";

// Local types for the component
interface TopProduct {
  productId: string;
  productName: string;
  sales: number;
  quantity: number;
}

interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  itemsSold: number;
  averageOrderValue: number;
  taxCollected: number;
  totalDiscounts: number;
  totalRefunds: number;
  dailySales: { date: string; revenue: number; orders: number }[];
}

interface CustomerOrderStats {
  customerId: string;
  customerName: string;
  customerEmail: string;
  totalOrders: number;
  completedOrders: number;
  canceledOrders: number;
  pendingOrders: number;
  totalSpent: number;
  orders: Order[];
}

export function ReportsTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const t = {
    salesReports: isRTL ? "تقارير المبيعات" : "Sales Reports",
    customerReports: isRTL ? "تقارير العملاء" : "Customer Orders Report",
    comprehensiveAnalytics: isRTL ? "تحليلات وتقارير المبيعات الشاملة" : "Comprehensive sales analytics and reporting",
    customerAnalytics: isRTL ? "تقارير طلبات العملاء التفصيلية" : "Detailed customer orders report",
    refresh: isRTL ? "تحديث" : "Refresh",
    export: isRTL ? "تصدير" : "Export",
    exportCsv: isRTL ? "تصدير كـ CSV" : "Export as CSV",
    exportPdf: isRTL ? "تصدير كـ PDF" : "Export as PDF",
    today: isRTL ? "اليوم" : "Today",
    lastWeek: isRTL ? "آخر 7 أيام" : "Last 7 Days",
    lastMonth: isRTL ? "آخر 30 يوم" : "Last 30 Days",
    lastYear: isRTL ? "السنة الماضية" : "Last Year",
    totalRevenue: isRTL ? "إجمالي الإيرادات" : "Total Revenue",
    totalOrders: isRTL ? "إجمالي الطلبات" : "Total Orders",
    itemsSold: isRTL ? "العناصر المباعة" : "Items Sold",
    avgOrderValue: isRTL ? "متوسط قيمة الطلب" : "Avg. Order Value",
    topSellingProducts: isRTL ? "المنتجات الأكثر مبيعاً" : "Top Selling Products",
    noSalesData: isRTL ? "لا تتوفر بيانات مبيعات" : "No sales data available",
    sold: isRTL ? "مباع" : "sold",
    salesByCategory: isRTL ? "المبيعات حسب الفئة" : "Sales by Category",
    noCategoryData: isRTL ? "لا تتوفر بيانات الفئات" : "No category data available",
    revenueTrend: isRTL ? "اتجاه الإيرادات" : "Revenue Trend",
    noDailySalesData: isRTL ? "لا تتوفر بيانات مبيعات يومية لهذه الفترة" : "No daily sales data available for this period",
    detailedBreakdown: isRTL ? "التفاصيل" : "Detailed Breakdown",
    metric: isRTL ? "المقياس" : "Metric",
    value: isRTL ? "القيمة" : "Value",
    change: isRTL ? "التغيير" : "Change",
    grossRevenue: isRTL ? "إجمالي الإيرادات" : "Gross Revenue",
    totalTaxCollected: isRTL ? "إجمالي الضرائب المحصلة" : "Total Tax Collected",
    totalDiscounts: isRTL ? "إجمالي الخصومات" : "Total Discounts",
    netRevenue: isRTL ? "صافي الإيرادات" : "Net Revenue",
    totalRefunds: isRTL ? "إجمالي المبالغ المستردة" : "Total Refunds",
    vsPreviousPeriod: isRTL ? "مقارنة بالفترة السابقة" : "vs previous period",
    // Customer report translations
    customer: isRTL ? "العميل" : "Customer",
    orders: isRTL ? "الطلبات" : "Orders",
    completed: isRTL ? "مكتمل" : "Completed",
    canceled: isRTL ? "ملغي" : "Canceled",
    pending: isRTL ? "قيد الانتظار" : "Pending",
    totalSpent: isRTL ? "إجمالي الإنفاق" : "Total Spent",
    viewOrders: isRTL ? "عرض الطلبات" : "View Orders",
    hideOrders: isRTL ? "إخفاء الطلبات" : "Hide Orders",
    searchCustomers: isRTL ? "البحث عن العملاء..." : "Search customers...",
    noCustomersFound: isRTL ? "لم يتم العثور على عملاء" : "No customers found",
    orderNumber: isRTL ? "رقم الطلب" : "Order #",
    date: isRTL ? "التاريخ" : "Date",
    status: isRTL ? "الحالة" : "Status",
    items: isRTL ? "العناصر" : "Items",
    amount: isRTL ? "المبلغ" : "Amount",
    noOrders: isRTL ? "لا توجد طلبات" : "No orders",
    allStatuses: isRTL ? "كل الحالات" : "All Statuses",
    processing: isRTL ? "قيد المعالجة" : "Processing",
    confirmed: isRTL ? "مؤكد" : "Confirmed",
    preparing: isRTL ? "قيد التحضير" : "Preparing",
    ready: isRTL ? "جاهز" : "Ready",
    outForDelivery: isRTL ? "في الطريق" : "Out for Delivery",
    delivered: isRTL ? "تم التوصيل" : "Delivered",
    totalCustomers: isRTL ? "إجمالي العملاء" : "Total Customers",
    activeCustomers: isRTL ? "عملاء نشطون" : "Active Customers",
    canceledOrdersTotal: isRTL ? "الطلبات الملغية" : "Canceled Orders",
    completedOrdersTotal: isRTL ? "الطلبات المكتملة" : "Completed Orders",
  };

  const [reportType, setReportType] = useState<ReportType>("sales");
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categorySales, setCategorySales] = useState<SalesByCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Customer orders report state
  const [customerStats, setCustomerStats] = useState<CustomerOrderStats[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      if (reportType === "sales") {
        const [reportRes, topRes, categoryRes, revenueRes] = await Promise.all([
          reportsApi.getSales({
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
          }),
          analyticsApi.getTopProducts(period, 10),
          reportsApi.getSalesByCategory(period),
          analyticsApi.getRevenueChart(period),
        ]);

        if (reportRes.success && reportRes.data) {
          const data = reportRes.data;
          setSalesReport({
            totalRevenue: data.totalSales || 0,
            totalOrders: data.totalOrders || 0,
            itemsSold: 0, // Not in the API response
            averageOrderValue: data.averageOrderValue || 0,
            taxCollected: data.totalVat || 0,
            totalDiscounts: data.totalDiscount || 0,
            totalRefunds: 0, // Not in the API response
            dailySales: revenueRes.success && revenueRes.data 
              ? revenueRes.data.map(d => ({ date: d.date, revenue: d.revenue, orders: d.orders }))
              : [],
          });
        }
        
        if (topRes.success && topRes.data) {
          setTopProducts(topRes.data.map(p => ({
            productId: p.productId,
            productName: p.productName,
            sales: p.sales,
            quantity: p.quantity,
          })));
        }
        
        if (categoryRes.success && categoryRes.data) setCategorySales(categoryRes.data);
      } else {
        // Fetch customer orders report
        const [customersRes, ordersRes] = await Promise.all([
          usersApi.getAll({ role: "customer" }),
          ordersApi.getAll({ limit: 1000 }), // Get all orders
        ]);

        if (customersRes.success && customersRes.data && ordersRes.success && ordersRes.data) {
          const customers = customersRes.data;
          const orders = ordersRes.data;

          // Group orders by customer
          const customerOrderMap = new Map<string, Order[]>();
          orders.forEach(order => {
            const customerId = order.userId;
            if (!customerOrderMap.has(customerId)) {
              customerOrderMap.set(customerId, []);
            }
            customerOrderMap.get(customerId)!.push(order);
          });

          // Build customer stats
          const stats: CustomerOrderStats[] = customers.map(customer => {
            const customerOrders = customerOrderMap.get(customer.id) || [];
            const completedOrders = customerOrders.filter(o => o.status === "delivered").length;
            const canceledOrders = customerOrders.filter(o => o.status === "cancelled").length;
            const pendingOrders = customerOrders.filter(o => 
              !["delivered", "cancelled"].includes(o.status)
            ).length;
            const totalSpent = customerOrders
              .filter(o => o.status !== "cancelled")
              .reduce((sum, o) => sum + (o.total || 0), 0);

            return {
              customerId: customer.id,
              customerName: `${customer.firstName} ${customer.familyName}`,
            customerEmail: customer.email,
            totalOrders: customerOrders.length,
            completedOrders,
            canceledOrders,
            pendingOrders,
            totalSpent,
            orders: customerOrders.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
          };
        });

        // Sort by total orders descending
        stats.sort((a, b) => b.totalOrders - a.totalOrders);
        setCustomerStats(stats);
      }
    }
    } catch (err) {
      console.error("Failed to fetch reports data:", err);
      setError("Failed to load reports. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, reportType]);

  const handleExport = async (format: "csv" | "pdf") => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const response = await reportsApi.export(
      "sales",
      format,
      startDate.toISOString().split("T")[0],
      endDate.toISOString().split("T")[0]
    );

    if (response.success && response.data) {
      // In a real implementation, handle the download
      console.log("Export successful:", response.data);
    }
  };

  const periodLabels: Record<ReportPeriod, string> = {
    today: t.today,
    week: t.lastWeek,
    month: t.lastMonth,
    year: t.lastYear,
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {reportType === "sales" ? t.salesReports : t.customerReports}
          </h3>
          <p className="text-sm text-slate-500">
            {reportType === "sales" ? t.comprehensiveAnalytics : t.customerAnalytics}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs sm:text-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            <span className="hidden sm:inline">{t.refresh}</span>
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-xs sm:text-sm">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t.export}</span>
            </button>
            <div className={cn(
              "absolute mt-2 w-40 bg-white rounded-lg shadow-lg border border-slate-200 hidden group-hover:block z-10",
              isRTL ? "left-0" : "right-0"
            )}>
              <button
                onClick={() => handleExport("csv")}
                className={cn(
                  "w-full px-4 py-2 text-sm hover:bg-slate-50 rounded-t-lg",
                  isRTL ? "text-right" : "text-left"
                )}
              >
                {t.exportCsv}
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className={cn(
                  "w-full px-4 py-2 text-sm hover:bg-slate-50 rounded-b-lg",
                  isRTL ? "text-right" : "text-left"
                )}
              >
                {t.exportPdf}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setReportType("sales")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              reportType === "sales"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            {t.salesReports}
          </button>
          <button
            onClick={() => setReportType("customers")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              reportType === "customers"
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Users className="w-4 h-4" />
            {t.customerReports}
          </button>
        </div>
      </div>

      {/* Period Selector - Only for Sales Report */}
      {reportType === "sales" && (
        <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm overflow-x-auto max-w-full">
          {(Object.keys(periodLabels) as ReportPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                period === p
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : reportType === "customers" ? (
        <CustomerOrdersReport
          customerStats={customerStats}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          expandedCustomer={expandedCustomer}
          setExpandedCustomer={setExpandedCustomer}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          isRTL={isRTL}
          t={t}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <SummaryCard
              icon={DollarSign}
              label={t.totalRevenue}
              value={<span className="flex items-center gap-1"><CurrencySymbol size="md" /> {salesReport?.totalRevenue?.toFixed(2) || "0.00"}</span>}
              change={12.5}
              color="green"
              vsPreviousPeriod={t.vsPreviousPeriod}
            />
            <SummaryCard
              icon={ShoppingCart}
              label={t.totalOrders}
              value={salesReport?.totalOrders?.toString() || "0"}
              change={8.2}
              color="blue"
              vsPreviousPeriod={t.vsPreviousPeriod}
            />
            <SummaryCard
              icon={Package}
              label={t.itemsSold}
              value={salesReport?.itemsSold?.toString() || "0"}
              change={-3.1}
              color="purple"
              vsPreviousPeriod={t.vsPreviousPeriod}
            />
            <SummaryCard
              icon={TrendingUp}
              label={t.avgOrderValue}
              value={<span className="flex items-center gap-1"><CurrencySymbol size="md" /> {salesReport?.averageOrderValue?.toFixed(2) || "0.00"}</span>}
              change={5.7}
              color="orange"
              vsPreviousPeriod={t.vsPreviousPeriod}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-900 text-sm sm:text-base">{t.topSellingProducts}</h4>
                <BarChart3 className="w-5 h-5 text-slate-400" />
              </div>

              {topProducts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {t.noSalesData}
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.slice(0, 5).map((product, index) => (
                    <div
                      key={product.productId}
                      className="flex items-center gap-4"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{product.productName}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>{product.quantity} {t.sold}</span>
                          <span className="flex items-center gap-1"><CurrencySymbol size="xs" /> {product.sales.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="w-24 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${(product.sales / (topProducts[0]?.sales || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales by Category */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-900 text-sm sm:text-base">{t.salesByCategory}</h4>
                <PieChart className="w-5 h-5 text-slate-400" />
              </div>

              {categorySales.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {t.noCategoryData}
                </div>
              ) : (
                <div className="space-y-4">
                  {categorySales.map((category, index) => {
                    const colors = [
                      "bg-red-500",
                      "bg-blue-500",
                      "bg-green-500",
                      "bg-yellow-500",
                      "bg-purple-500",
                      "bg-pink-500",
                    ];
                    const totalRevenue = categorySales.reduce(
                      (sum, c) => sum + c.totalSales,
                      0
                    );
                    const displayPercentage = category.percentage || (totalRevenue
                      ? ((category.totalSales / totalRevenue) * 100).toFixed(1)
                      : "0");

                    return (
                      <div key={category.category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-3 h-3 rounded-full",
                                colors[index % colors.length]
                              )}
                            />
                            <span className="text-sm font-medium text-slate-900">
                              {category.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium flex items-center justify-end gap-1">
                              <CurrencySymbol size="xs" /> {category.totalSales.toFixed(2)}
                            </span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({displayPercentage}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full",
                              colors[index % colors.length]
                            )}
                            style={{ width: `${displayPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Daily Sales Chart Placeholder */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h4 className="font-semibold text-slate-900 text-sm sm:text-base">{t.revenueTrend}</h4>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar className="w-4 h-4" />
                {periodLabels[period]}
              </div>
            </div>

            {/* Simplified bar chart visualization */}
            <div className="h-64 flex items-end justify-between gap-2">
              {(salesReport?.dailySales || []).slice(-14).map((day, index) => {
                const maxRevenue = Math.max(
                  ...(salesReport?.dailySales || []).map((d) => d.revenue)
                );
                const height = maxRevenue ? (day.revenue / maxRevenue) * 100 : 0;

                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-primary/80 rounded-t-lg transition-all hover:bg-primary"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${day.date}: AED ${day.revenue.toFixed(2)}`}
                    />
                    <span className="text-xs text-slate-500 truncate w-full text-center">
                      {new Date(day.date).toLocaleDateString(isRTL ? "ar-AE" : "en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                );
              })}
              {(!salesReport?.dailySales || salesReport.dailySales.length === 0) && (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  {t.noDailySalesData}
                </div>
              )}
            </div>
          </div>

          {/* Detailed Stats Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h4 className="font-semibold text-slate-900">{t.detailedBreakdown}</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={cn(
                      "px-4 py-3 text-xs font-medium text-slate-500 uppercase",
                      isRTL ? "text-right" : "text-left"
                    )}>
                      {t.metric}
                    </th>
                    <th className={cn(
                      "px-4 py-3 text-xs font-medium text-slate-500 uppercase",
                      isRTL ? "text-left" : "text-right"
                    )}>
                      {t.value}
                    </th>
                    <th className={cn(
                      "px-4 py-3 text-xs font-medium text-slate-500 uppercase",
                      isRTL ? "text-left" : "text-right"
                    )}>
                      {t.change}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{t.grossRevenue}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" /> {salesReport?.totalRevenue?.toFixed(2) || "0.00"}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={12.5} />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{t.totalTaxCollected}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" /> {salesReport?.taxCollected?.toFixed(2) || "0.00"}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={8.3} />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{t.totalDiscounts}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" /> {salesReport?.totalDiscounts?.toFixed(2) || "0.00"}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={-5.2} />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{t.netRevenue}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" />{" "}
                      {(
                        (salesReport?.totalRevenue || 0) -
                        (salesReport?.totalDiscounts || 0)
                      ).toFixed(2)}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={10.1} />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{t.totalRefunds}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" /> {salesReport?.totalRefunds?.toFixed(2) || "0.00"}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={-15.3} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  change,
  color,
  vsPreviousPeriod,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  change: number;
  color: "green" | "blue" | "purple" | "orange";
  vsPreviousPeriod: string;
}) {
  const colorClasses = {
    green: { bg: "bg-green-100", text: "text-green-600" },
    blue: { bg: "bg-blue-100", text: "text-blue-600" },
    purple: { bg: "bg-purple-100", text: "text-purple-600" },
    orange: { bg: "bg-orange-100", text: "text-orange-600" },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-slate-500 truncate">{label}</p>
          <p className="text-base sm:text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
        </div>
        <div
          className={cn(
            "w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            colorClasses[color].bg
          )}
        >
          <Icon className={cn("w-4 h-4 sm:w-6 sm:h-6", colorClasses[color].text)} />
        </div>
      </div>
      <div className="mt-3 sm:mt-4">
        <ChangeIndicator value={change} showLabel labelText={vsPreviousPeriod} />
      </div>
    </div>
  );
}

function ChangeIndicator({
  value,
  showLabel = false,
  labelText = "vs previous period",
}: {
  value: number;
  showLabel?: boolean;
  labelText?: string;
}) {
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        isPositive ? "text-green-600" : "text-red-600"
      )}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(value).toFixed(1)}%
      {showLabel && (
        <span className="text-slate-500 font-normal ml-1">{labelText}</span>
      )}
    </span>
  );
}

// Customer Orders Report Component
function CustomerOrdersReport({
  customerStats,
  searchQuery,
  setSearchQuery,
  expandedCustomer,
  setExpandedCustomer,
  statusFilter,
  setStatusFilter,
  isRTL,
  t,
  onNavigate,
}: {
  customerStats: CustomerOrderStats[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  expandedCustomer: string | null;
  setExpandedCustomer: (id: string | null) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  isRTL: boolean;
  t: Record<string, string>;
  onNavigate?: (tab: string, id?: string) => void;
}) {
  // Filter customers based on search query
  const filteredCustomers = customerStats.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.customerName.toLowerCase().includes(query) ||
      customer.customerEmail.toLowerCase().includes(query)
    );
  });

  // Calculate totals
  const totalCustomers = customerStats.length;
  const activeCustomers = customerStats.filter(c => c.totalOrders > 0).length;
  const totalCanceled = customerStats.reduce((sum, c) => sum + c.canceledOrders, 0);
  const totalCompleted = customerStats.reduce((sum, c) => sum + c.completedOrders, 0);

  // Status config for badges
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: React.ElementType; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-700", icon: Clock, label: t.pending },
      processing: { color: "bg-blue-100 text-blue-700", icon: Clock, label: t.processing },
      confirmed: { color: "bg-blue-100 text-blue-700", icon: CheckCircle, label: t.confirmed },
      preparing: { color: "bg-orange-100 text-orange-700", icon: Package, label: t.preparing },
      ready: { color: "bg-purple-100 text-purple-700", icon: Package, label: t.ready },
      out_for_delivery: { color: "bg-indigo-100 text-indigo-700", icon: Truck, label: t.outForDelivery },
      delivered: { color: "bg-green-100 text-green-700", icon: CheckCircle, label: t.delivered },
      cancelled: { color: "bg-red-100 text-red-700", icon: Ban, label: t.canceled },
    };
    return configs[status] || configs.pending;
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.totalCustomers}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{totalCustomers}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.activeCustomers}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{activeCustomers}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.completedOrdersTotal}</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{totalCompleted}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.canceledOrdersTotal}</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">{totalCanceled}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400",
              isRTL ? "right-3" : "left-3"
            )} />
            <input
              type="text"
              placeholder={t.searchCustomers}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none",
                isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
              )}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="all">{t.allStatuses}</option>
            <option value="pending">{t.pending}</option>
            <option value="processing">{t.processing}</option>
            <option value="confirmed">{t.confirmed}</option>
            <option value="preparing">{t.preparing}</option>
            <option value="delivered">{t.delivered}</option>
            <option value="cancelled">{t.canceled}</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t.noCustomersFound}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredCustomers.map((customer) => {
              const isExpanded = expandedCustomer === customer.customerId;
              const filteredOrders = statusFilter === "all" 
                ? customer.orders 
                : customer.orders.filter(o => o.status === statusFilter);

              return (
                <div key={customer.customerId}>
                  {/* Customer Row */}
                  <div
                    className={cn(
                      "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
                      isExpanded && "bg-slate-50"
                    )}
                    onClick={() => setExpandedCustomer(isExpanded ? null : customer.customerId)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-blue-600">
                            {customer.customerName[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{customer.customerName}</p>
                          <p className="text-xs text-slate-500 truncate">{customer.customerEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                        <div className="text-center hidden sm:block">
                          <p className="text-lg font-bold text-slate-900">{customer.totalOrders}</p>
                          <p className="text-xs text-slate-500">{t.orders}</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className="text-lg font-bold text-green-600">{customer.completedOrders}</p>
                          <p className="text-xs text-slate-500">{t.completed}</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className="text-lg font-bold text-red-600">{customer.canceledOrders}</p>
                          <p className="text-xs text-slate-500">{t.canceled}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-900 flex items-center gap-1">
                            <CurrencySymbol size="sm" /> {customer.totalSpent.toFixed(2)}
                          </p>
                          <p className="text-xs text-slate-500">{t.totalSpent}</p>
                        </div>
                        <button className="p-2 hover:bg-slate-200 rounded-lg">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Orders Table */}
                  {isExpanded && (
                    <div className="bg-slate-50 px-4 pb-4">
                      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        {filteredOrders.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            {t.noOrders}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className={cn("px-4 py-2 text-xs font-medium text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                                    {t.orderNumber}
                                  </th>
                                  <th className={cn("px-4 py-2 text-xs font-medium text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                                    {t.date}
                                  </th>
                                  <th className={cn("px-4 py-2 text-xs font-medium text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                                    {t.status}
                                  </th>
                                  <th className={cn("px-4 py-2 text-xs font-medium text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                                    {t.items}
                                  </th>
                                  <th className={cn("px-4 py-2 text-xs font-medium text-slate-500 uppercase", isRTL ? "text-left" : "text-right")}>
                                    {t.amount}
                                  </th>
                                  <th className="px-4 py-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {filteredOrders.map((order) => {
                                  const statusConfig = getStatusConfig(order.status);
                                  const StatusIcon = statusConfig.icon;
                                  return (
                                    <tr key={order.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-3">
                                        <span className="font-mono text-sm text-primary">
                                          {order.orderNumber || order.id.slice(-8)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-600">
                                        {new Date(order.createdAt).toLocaleDateString(isRTL ? "ar-AE" : "en-AE", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={cn(
                                          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                          statusConfig.color
                                        )}>
                                          <StatusIcon className="w-3 h-3" />
                                          {statusConfig.label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-600">
                                        {order.items?.length || 0} {t.items}
                                      </td>
                                      <td className={cn("px-4 py-3 text-sm font-medium", isRTL ? "text-left" : "text-right")}>
                                        <span className="flex items-center gap-1 justify-end">
                                          <CurrencySymbol size="xs" /> {(order.total || 0).toFixed(2)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate?.("orders", order.id);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg"
                                          title={t.viewOrders}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
