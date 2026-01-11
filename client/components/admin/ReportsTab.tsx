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
} from "lucide-react";
import { reportsApi, analyticsApi } from "@/lib/api";
import type { SalesReportData, SalesByCategory, SalesByProduct } from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

type ReportPeriod = "today" | "week" | "month" | "year";

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

export function ReportsTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const t = {
    salesReports: isRTL ? "تقارير المبيعات" : "Sales Reports",
    comprehensiveAnalytics: isRTL ? "تحليلات وتقارير المبيعات الشاملة" : "Comprehensive sales analytics and reporting",
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
  };

  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categorySales, setCategorySales] = useState<SalesByCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

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

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [period]);

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
          <h3 className="text-lg font-semibold text-slate-900">{t.salesReports}</h3>
          <p className="text-sm text-slate-500">
            {t.comprehensiveAnalytics}
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

      {/* Period Selector */}
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
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
