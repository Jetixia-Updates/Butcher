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
            period: period,
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
            itemsSold: (data as any).itemsSold || 0,
            averageOrderValue: data.averageOrderValue || 0,
            taxCollected: data.totalVat || 0,
            totalDiscounts: data.totalDiscount || 0,
            totalRefunds: 0,
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

    const dateStr = `${startDate.toISOString().split("T")[0]}_to_${endDate.toISOString().split("T")[0]}`;
    const periodLabel = periodLabels[period];

    if (reportType === "sales") {
      if (format === "csv") {
        // Generate Sales Report CSV
        let csvContent = "Butcher Shop - Sales Report\n";
        csvContent += `Period: ${periodLabel}\n`;
        csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
        
        // Summary section
        csvContent += "=== SUMMARY ===\n";
        csvContent += "Metric,Value\n";
        csvContent += `Total Revenue,AED ${salesReport?.totalRevenue?.toFixed(2) || 0}\n`;
        csvContent += `Total Orders,${salesReport?.totalOrders || 0}\n`;
        csvContent += `Items Sold,${salesReport?.itemsSold || 0}\n`;
        csvContent += `Average Order Value,AED ${salesReport?.averageOrderValue?.toFixed(2) || 0}\n`;
        csvContent += `Tax Collected,AED ${salesReport?.taxCollected?.toFixed(2) || 0}\n`;
        csvContent += `Total Discounts,AED ${salesReport?.totalDiscounts?.toFixed(2) || 0}\n`;
        csvContent += `Total Refunds,AED ${salesReport?.totalRefunds?.toFixed(2) || 0}\n`;
        csvContent += `Net Revenue,AED ${((salesReport?.totalRevenue || 0) - (salesReport?.totalRefunds || 0)).toFixed(2)}\n\n`;
        
        // Top Products
        if (topProducts.length > 0) {
          csvContent += "=== TOP SELLING PRODUCTS ===\n";
          csvContent += "Product Name,Quantity Sold,Sales (AED)\n";
          topProducts.forEach(p => {
            csvContent += `"${p.productName}",${p.quantity},${(p.sales || 0).toFixed(2)}\n`;
          });
          csvContent += "\n";
        }
        
        // Sales by Category
        if (categorySales.length > 0) {
          csvContent += "=== SALES BY CATEGORY ===\n";
          csvContent += "Category,Quantity,Revenue (AED)\n";
          categorySales.forEach(c => {
            csvContent += `"${c.category}",${c.totalQuantity},${(c.totalSales || 0).toFixed(2)}\n`;
          });
          csvContent += "\n";
        }
        
        // Daily Sales
        if (salesReport?.dailySales && salesReport.dailySales.length > 0) {
          csvContent += "=== DAILY SALES ===\n";
          csvContent += "Date,Orders,Revenue (AED)\n";
          salesReport.dailySales.forEach(d => {
            csvContent += `${d.date},${d.orders},${(d.revenue || 0).toFixed(2)}\n`;
          });
        }
        
        // Download CSV
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `sales_report_${dateStr}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        
      } else if (format === "pdf") {
        // Generate Sales Report PDF using HTML and print
        const printContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Sales Report - ${periodLabel}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h1 { color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
              h2 { color: #64748b; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin: 15px 0; }
              th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
              th { background-color: #f8fafc; font-weight: bold; }
              .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
              .summary-card { background: #f8fafc; padding: 15px; border-radius: 8px; }
              .summary-card h3 { margin: 0; color: #64748b; font-size: 14px; }
              .summary-card p { margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #0f172a; }
              .text-right { text-align: right; }
              .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <h1>🥩 Butcher Shop - Sales Report</h1>
            <p><strong>Period:</strong> ${periodLabel} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            
            <h2>Summary</h2>
            <div class="summary-grid">
              <div class="summary-card">
                <h3>Total Revenue</h3>
                <p>AED ${salesReport?.totalRevenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div class="summary-card">
                <h3>Total Orders</h3>
                <p>${salesReport?.totalOrders || 0}</p>
              </div>
              <div class="summary-card">
                <h3>Items Sold</h3>
                <p>${salesReport?.itemsSold || 0}</p>
              </div>
              <div class="summary-card">
                <h3>Avg. Order Value</h3>
                <p>AED ${salesReport?.averageOrderValue?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            
            <table>
              <tr><th>Metric</th><th class="text-right">Value</th></tr>
              <tr><td>Tax Collected</td><td class="text-right">AED ${salesReport?.taxCollected?.toFixed(2) || '0.00'}</td></tr>
              <tr><td>Total Discounts</td><td class="text-right">AED ${salesReport?.totalDiscounts?.toFixed(2) || '0.00'}</td></tr>
              <tr><td>Total Refunds</td><td class="text-right">AED ${salesReport?.totalRefunds?.toFixed(2) || '0.00'}</td></tr>
              <tr style="font-weight: bold;"><td>Net Revenue</td><td class="text-right">AED ${((salesReport?.totalRevenue || 0) - (salesReport?.totalRefunds || 0)).toFixed(2)}</td></tr>
            </table>
            
            ${topProducts.length > 0 ? `
              <h2>Top Selling Products</h2>
              <table>
                <tr><th>Product</th><th class="text-right">Quantity Sold</th><th class="text-right">Revenue (AED)</th></tr>
                ${topProducts.map(p => `<tr><td>${p.productName}</td><td class="text-right">${p.quantity}</td><td class="text-right">${(p.sales || 0).toFixed(2)}</td></tr>`).join('')}
              </table>
            ` : ''}
            
            ${categorySales.length > 0 ? `
              <h2>Sales by Category</h2>
              <table>
                <tr><th>Category</th><th class="text-right">Quantity</th><th class="text-right">Revenue (AED)</th></tr>
                ${categorySales.map(c => `<tr><td>${c.category}</td><td class="text-right">${c.totalQuantity}</td><td class="text-right">${(c.totalSales || 0).toFixed(2)}</td></tr>`).join('')}
              </table>
            ` : ''}
            
            ${salesReport?.dailySales && salesReport.dailySales.length > 0 ? `
              <h2>Daily Sales</h2>
              <table>
                <tr><th>Date</th><th class="text-right">Orders</th><th class="text-right">Revenue (AED)</th></tr>
                ${salesReport.dailySales.slice(0, 30).map(d => `<tr><td>${d.date}</td><td class="text-right">${d.orders}</td><td class="text-right">${(d.revenue || 0).toFixed(2)}</td></tr>`).join('')}
              </table>
            ` : ''}
            
            <div class="footer">
              <p>Generated by Butcher Shop Admin Dashboard</p>
            </div>
          </body>
          </html>
        `;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(printContent);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
    } else if (reportType === "customers") {
      // Customer Report Export
      if (format === "csv") {
        let csvContent = "Butcher Shop - Customer Orders Report\n";
        csvContent += `Period: ${periodLabel}\n`;
        csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
        
        csvContent += "Customer Name,Email,Total Orders,Completed,Canceled,Pending,Total Spent (AED)\n";
        customerStats.forEach(c => {
          csvContent += `"${c.customerName}","${c.customerEmail}",${c.totalOrders},${c.completedOrders},${c.canceledOrders},${c.pendingOrders},${(c.totalSpent || 0).toFixed(2)}\n`;
        });
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `customer_report_${dateStr}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        
      } else if (format === "pdf") {
        const totalCustomers = customerStats.length;
        const totalSpentAll = customerStats.reduce((sum, c) => sum + c.totalSpent, 0);
        const totalOrdersAll = customerStats.reduce((sum, c) => sum + c.totalOrders, 0);
        
        const printContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Customer Report - ${periodLabel}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h1 { color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
              h2 { color: #64748b; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin: 15px 0; }
              th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f8fafc; font-weight: bold; }
              .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
              .summary-card { background: #f8fafc; padding: 15px; border-radius: 8px; }
              .summary-card h3 { margin: 0; color: #64748b; font-size: 14px; }
              .summary-card p { margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #0f172a; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <h1>🥩 Butcher Shop - Customer Orders Report</h1>
            <p><strong>Period:</strong> ${periodLabel} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            
            <div class="summary-grid">
              <div class="summary-card">
                <h3>Total Customers</h3>
                <p>${totalCustomers}</p>
              </div>
              <div class="summary-card">
                <h3>Total Orders</h3>
                <p>${totalOrdersAll}</p>
              </div>
              <div class="summary-card">
                <h3>Total Revenue</h3>
                <p>AED ${(totalSpentAll || 0).toFixed(2)}</p>
              </div>
            </div>
            
            <h2>Customer Details</h2>
            <table>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th class="text-center">Orders</th>
                <th class="text-center">Completed</th>
                <th class="text-center">Canceled</th>
                <th class="text-right">Total Spent</th>
              </tr>
              ${customerStats.map(c => `
                <tr>
                  <td>${c.customerName}</td>
                  <td>${c.customerEmail}</td>
                  <td class="text-center">${c.totalOrders}</td>
                  <td class="text-center">${c.completedOrders}</td>
                  <td class="text-center">${c.canceledOrders}</td>
                  <td class="text-right">AED ${(c.totalSpent || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </table>
            
            <div class="footer">
              <p>Generated by Butcher Shop Admin Dashboard</p>
            </div>
          </body>
          </html>
        `;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(printContent);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
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
          <h3 className="text-lg font-semibold text-white">
            {reportType === "sales" ? t.salesReports : t.customerReports}
          </h3>
          <p className="text-sm text-slate-400">
            {reportType === "sales" ? t.comprehensiveAnalytics : t.customerAnalytics}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-slate-300 text-xs sm:text-sm transition-all duration-200"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            <span className="hidden sm:inline">{t.refresh}</span>
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 text-xs sm:text-sm transition-all duration-200 shadow-lg shadow-red-500/20">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t.export}</span>
            </button>
            <div className={cn(
              "absolute mt-2 w-40 bg-slate-800 rounded-xl shadow-xl border border-white/10 hidden group-hover:block z-10",
              isRTL ? "left-0" : "right-0"
            )}>
              <button
                onClick={() => handleExport("csv")}
                className={cn(
                  "w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/5 rounded-t-xl transition-colors",
                  isRTL ? "text-right" : "text-left"
                )}
              >
                {t.exportCsv}
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className={cn(
                  "w-full px-4 py-2 text-sm text-slate-300 hover:bg-white/5 rounded-b-xl transition-colors",
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
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setReportType("sales")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              reportType === "sales"
                ? "bg-red-600 text-white shadow-lg shadow-red-500/20"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            {t.salesReports}
          </button>
          <button
            onClick={() => setReportType("customers")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
              reportType === "customers"
                ? "bg-red-600 text-white shadow-lg shadow-red-500/20"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Users className="w-4 h-4" />
            {t.customerReports}
          </button>
        </div>
      </div>

      {/* Period Selector - Only for Sales Report */}
      {reportType === "sales" && (
        <div className="flex gap-2 bg-slate-800/50 backdrop-blur-sm rounded-xl p-1.5 border border-white/5 overflow-x-auto max-w-full">
          {(Object.keys(periodLabels) as ReportPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0",
                period === p
                  ? "bg-red-600 text-white shadow-lg shadow-red-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500/20 border-t-red-500"></div>
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
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-white text-sm sm:text-base">{t.topSellingProducts}</h4>
                <BarChart3 className="w-5 h-5 text-slate-500" />
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
                      <span className="w-6 h-6 rounded-full bg-red-500/10 text-red-400 text-xs font-bold flex items-center justify-center ring-1 ring-red-500/20">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-white">{product.productName}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span>{product.quantity} {t.sold}</span>
                          <span className="flex items-center gap-1"><CurrencySymbol size="xs" /> {(product.sales || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="w-24 bg-white/5 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-red-500 to-red-400 h-2 rounded-full"
                          style={{
                            width: `${((product.sales || 0) / (topProducts[0]?.sales || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales by Category */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-white text-sm sm:text-base">{t.salesByCategory}</h4>
                <PieChart className="w-5 h-5 text-slate-500" />
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
                      "bg-emerald-500",
                      "bg-amber-500",
                      "bg-violet-500",
                      "bg-pink-500",
                    ];
                    const totalRevenue = categorySales.reduce(
                      (sum, c) => sum + (c.totalSales || 0),
                      0
                    );
                    const displayPercentage = category.percentage || (totalRevenue
                      ? (((category.totalSales || 0) / totalRevenue) * 100).toFixed(1)
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
                            <span className="text-sm font-medium text-white">
                              {category.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-white flex items-center justify-end gap-1">
                              <CurrencySymbol size="xs" /> {(category.totalSales || 0).toFixed(2)}
                            </span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({displayPercentage}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
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
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h4 className="font-semibold text-white text-sm sm:text-base">{t.revenueTrend}</h4>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="w-4 h-4" />
                {periodLabels[period]}
              </div>
            </div>

            {/* Simplified bar chart visualization */}
            <div className="h-64 flex items-end justify-between gap-2">
              {(salesReport?.dailySales || []).slice(-14).map((day, index) => {
                const maxRevenue = Math.max(
                  ...(salesReport?.dailySales || []).map((d) => d.revenue || 0)
                );
                const height = maxRevenue ? ((day.revenue || 0) / maxRevenue) * 100 : 0;

                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-gradient-to-t from-red-600/80 to-red-400/60 rounded-t-lg transition-all duration-300 hover:from-red-500 hover:to-red-300/80"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${day.date}: AED ${(day.revenue || 0).toFixed(2)}`}
                    />
                    <span className="text-[10px] text-slate-500 truncate w-full text-center">
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
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h4 className="font-semibold text-white">{t.detailedBreakdown}</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
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
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">{t.grossRevenue}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium text-white flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" /> {salesReport?.totalRevenue?.toFixed(2) || "0.00"}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={12.5} />
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">{t.totalTaxCollected}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium text-white flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" /> {salesReport?.taxCollected?.toFixed(2) || "0.00"}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={8.3} />
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">{t.totalDiscounts}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium text-white flex items-center gap-1",
                      isRTL ? "justify-start" : "justify-end"
                    )}>
                      <CurrencySymbol size="sm" /> {salesReport?.totalDiscounts?.toFixed(2) || "0.00"}
                    </td>
                    <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                      <ChangeIndicator value={-5.2} />
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">{t.netRevenue}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium text-white flex items-center gap-1",
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
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">{t.totalRefunds}</td>
                    <td className={cn(
                      "px-4 py-3 text-sm font-medium text-white flex items-center gap-1",
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
    green: { bg: "bg-emerald-500/10 ring-1 ring-emerald-500/20", text: "text-emerald-400" },
    blue: { bg: "bg-blue-500/10 ring-1 ring-blue-500/20", text: "text-blue-400" },
    purple: { bg: "bg-violet-500/10 ring-1 ring-violet-500/20", text: "text-violet-400" },
    orange: { bg: "bg-amber-500/10 ring-1 ring-amber-500/20", text: "text-amber-400" },
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-3 sm:p-6 transition-all duration-300 hover:bg-slate-800/80 hover:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-slate-400 truncate">{label}</p>
          <p className="text-base sm:text-2xl font-bold text-white mt-1 truncate">{value}</p>
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
        isPositive ? "text-emerald-400" : "text-red-400"
      )}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(value || 0).toFixed(1)}%
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
      pending: { color: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20", icon: Clock, label: t.pending },
      processing: { color: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20", icon: Clock, label: t.processing },
      confirmed: { color: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20", icon: CheckCircle, label: t.confirmed },
      preparing: { color: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20", icon: Package, label: t.preparing },
      ready: { color: "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20", icon: Package, label: t.ready },
      out_for_delivery: { color: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20", icon: Truck, label: t.outForDelivery },
      delivered: { color: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20", icon: CheckCircle, label: t.delivered },
      cancelled: { color: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20", icon: Ban, label: t.canceled },
    };
    return configs[status] || configs.pending;
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-400">{t.totalCustomers}</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{totalCustomers}</p>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center ring-1 ring-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-400">{t.activeCustomers}</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{activeCustomers}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center ring-1 ring-emerald-500/20">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-400">{t.completedOrdersTotal}</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400">{totalCompleted}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center ring-1 ring-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-400">{t.canceledOrdersTotal}</p>
              <p className="text-xl sm:text-2xl font-bold text-red-400">{totalCanceled}</p>
            </div>
            <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center ring-1 ring-red-500/20">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500",
              isRTL ? "right-3" : "left-3"
            )} />
            <input
              type="text"
              placeholder={t.searchCustomers}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 outline-none text-white placeholder-slate-500",
                isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
              )}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 outline-none text-white"
          >
            <option value="all" className="bg-slate-800">{t.allStatuses}</option>
            <option value="pending" className="bg-slate-800">{t.pending}</option>
            <option value="processing" className="bg-slate-800">{t.processing}</option>
            <option value="confirmed" className="bg-slate-800">{t.confirmed}</option>
            <option value="preparing" className="bg-slate-800">{t.preparing}</option>
            <option value="delivered" className="bg-slate-800">{t.delivered}</option>
            <option value="cancelled" className="bg-slate-800">{t.canceled}</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">{t.noCustomersFound}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
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
                      "p-4 cursor-pointer hover:bg-white/[0.02] transition-colors",
                      isExpanded && "bg-white/[0.02]"
                    )}
                    onClick={() => setExpandedCustomer(isExpanded ? null : customer.customerId)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white/10">
                          <span className="font-bold text-white text-sm">
                            {customer.customerName[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{customer.customerName}</p>
                          <p className="text-xs text-slate-500 truncate">{customer.customerEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                        <div className="text-center hidden sm:block">
                          <p className="text-lg font-bold text-white">{customer.totalOrders}</p>
                          <p className="text-xs text-slate-500">{t.orders}</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className="text-lg font-bold text-emerald-400">{customer.completedOrders}</p>
                          <p className="text-xs text-slate-500">{t.completed}</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className="text-lg font-bold text-red-400">{customer.canceledOrders}</p>
                          <p className="text-xs text-slate-500">{t.canceled}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-white flex items-center gap-1">
                            <CurrencySymbol size="sm" /> {(customer.totalSpent || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-slate-500">{t.totalSpent}</p>
                        </div>
                        <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Orders Table */}
                  {isExpanded && (
                    <div className="bg-slate-900/50 px-4 pb-4">
                      <div className="bg-slate-800/80 rounded-xl border border-white/5 overflow-hidden">
                        {filteredOrders.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            {t.noOrders}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-slate-900/50">
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
                              <tbody className="divide-y divide-white/5">
                                {filteredOrders.map((order) => {
                                  const statusConfig = getStatusConfig(order.status);
                                  const StatusIcon = statusConfig.icon;
                                  return (
                                    <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                                      <td className="px-4 py-3">
                                        <span className="font-mono text-sm text-red-400">
                                          {order.orderNumber || order.id.slice(-8)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-400">
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
                                      <td className="px-4 py-3 text-sm text-slate-400">
                                        {order.items?.length || 0} {t.items}
                                      </td>
                                      <td className={cn("px-4 py-3 text-sm font-medium text-white", isRTL ? "text-left" : "text-right")}>
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
                                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
