/**
 * Admin Analytics Dashboard Routes
 * Real-time dashboard metrics and analytics (PostgreSQL version)
 */

import { Router, RequestHandler } from "express";
import { eq, ne, gte, lte, and, sql, count, sum } from "drizzle-orm";
import type { 
  DashboardStats, 
  RecentOrder, 
  LowStockItem,
  ApiResponse 
} from "@shared/api";
import { db, orders, orderItems, users, stock, products, addresses } from "../db/connection";

const router = Router();

// Helper to convert decimal strings to numbers
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value) || 0;
}

// GET /api/analytics/dashboard - Get dashboard stats
const getDashboardStats: RequestHandler = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all orders
    const allOrders = await db.select().from(orders);
    const allUsers = await db.select().from(users);
    const allStock = await db.select().from(stock);
    const allProducts = await db.select().from(products);

    // Filter orders
    const todayOrders = allOrders.filter((o) => new Date(o.createdAt) >= today && o.status !== "cancelled");
    const yesterdayOrders = allOrders.filter((o) => 
      new Date(o.createdAt) >= yesterday && 
      new Date(o.createdAt) < today && 
      o.status !== "cancelled"
    );
    const thisWeekOrders = allOrders.filter((o) => new Date(o.createdAt) >= thisWeek && o.status !== "cancelled");
    const lastWeekOrders = allOrders.filter((o) => 
      new Date(o.createdAt) >= lastWeek && 
      new Date(o.createdAt) < thisWeek && 
      o.status !== "cancelled"
    );
    const thisMonthOrders = allOrders.filter((o) => new Date(o.createdAt) >= thisMonth && o.status !== "cancelled");
    const lastMonthOrders = allOrders.filter((o) => 
      new Date(o.createdAt) >= lastMonth && 
      new Date(o.createdAt) <= lastMonthEnd && 
      o.status !== "cancelled"
    );

    // Calculate revenue
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const weekRevenue = thisWeekOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const lastWeekRevenue = lastWeekOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const monthRevenue = thisMonthOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Calculate changes
    const revenueChangeDaily = yesterdayRevenue > 0 
      ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 10000) / 100 
      : 0;
    const revenueChangeWeekly = lastWeekRevenue > 0 
      ? Math.round(((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 10000) / 100 
      : 0;
    const revenueChangeMonthly = lastMonthRevenue > 0 
      ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 10000) / 100 
      : 0;

    // Order counts
    const orderChangeDaily = yesterdayOrders.length > 0 
      ? Math.round(((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 10000) / 100 
      : 0;

    // Average order value
    const averageOrderValue = thisMonthOrders.length > 0 
      ? Math.round((monthRevenue / thisMonthOrders.length) * 100) / 100 
      : 0;
    const lastMonthAOV = lastMonthOrders.length > 0 
      ? lastMonthRevenue / lastMonthOrders.length 
      : 0;
    const averageOrderValueChange = lastMonthAOV > 0 
      ? Math.round(((averageOrderValue - lastMonthAOV) / lastMonthAOV) * 10000) / 100 
      : 0;

    // Customers
    const totalCustomers = allUsers.filter((u) => u.role === "customer").length;
    const newCustomers = allUsers.filter(
      (u) => u.role === "customer" && new Date(u.createdAt) >= thisMonth
    ).length;

    // Low stock items
    const lowStockItems: LowStockItem[] = allStock
      .filter((s) => toNumber(s.availableQuantity) <= s.lowStockThreshold)
      .map((s) => {
        const product = allProducts.find((p) => p.id === s.productId);
        return {
          productId: s.productId,
          productName: product?.name || "Unknown",
          currentQuantity: toNumber(s.availableQuantity),
          threshold: s.lowStockThreshold,
          reorderPoint: s.reorderPoint,
          suggestedReorderQuantity: s.reorderQuantity,
        };
      })
      .sort((a, b) => a.currentQuantity - b.currentQuantity);

    // Pending orders
    const pendingOrders = allOrders.filter(
      (o) => o.status === "pending" || o.status === "confirmed"
    ).length;

    // Get order items for recent orders
    const allOrderItems = await db.select().from(orderItems);

    // Recent orders
    const recentOrders: RecentOrder[] = allOrders
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((o) => {
        const items = allOrderItems.filter((i) => i.orderId === o.id);
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          total: Number(o.total),
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          itemCount: items.length,
          paymentStatus: o.paymentStatus,
        };
      });

    const stats: DashboardStats = {
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      weekRevenue: Math.round(weekRevenue * 100) / 100,
      monthRevenue: Math.round(monthRevenue * 100) / 100,
      todayOrders: todayOrders.length,
      weekOrders: thisWeekOrders.length,
      monthOrders: thisMonthOrders.length,
      totalCustomers,
      newCustomers,
      averageOrderValue,
      pendingOrders,
      lowStockCount: lowStockItems.length,
      revenueChange: {
        daily: revenueChangeDaily,
        weekly: revenueChangeWeekly,
        monthly: revenueChangeMonthly,
      },
      ordersChange: {
        daily: orderChangeDaily,
        weekly: 0,
        monthly: 0,
      },
      averageOrderValueChange,
      recentOrders,
      lowStockItems,
    };

    const response: ApiResponse<DashboardStats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get dashboard stats",
    };
    res.status(500).json(response);
  }
};

// GET /api/analytics/charts/revenue - Get revenue chart data
const getRevenueChart: RequestHandler = async (req, res) => {
  try {
    const { period = "week" } = req.query;
    const now = new Date();
    let days: number;

    switch (period) {
      case "week":
        days = 7;
        break;
      case "month":
        days = 30;
        break;
      case "quarter":
        days = 90;
        break;
      case "year":
        days = 365;
        break;
      default:
        days = 7;
    }

    const allOrders = await db.select().from(orders).where(ne(orders.status, "cancelled"));
    const chartData: { date: string; revenue: number; orders: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().slice(0, 10);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayOrders = allOrders.filter(
        (o) => new Date(o.createdAt) >= dayStart && new Date(o.createdAt) < dayEnd
      );

      chartData.push({
        date: dateStr,
        revenue: Math.round(dayOrders.reduce((sum, o) => sum + Number(o.total), 0) * 100) / 100,
        orders: dayOrders.length,
      });
    }

    const response: ApiResponse<typeof chartData> = {
      success: true,
      data: chartData,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get revenue chart",
    };
    res.status(500).json(response);
  }
};

// GET /api/analytics/charts/orders-by-status - Get orders by status chart
const getOrdersByStatusChart: RequestHandler = async (req, res) => {
  try {
    const allOrders = await db.select().from(orders);
    
    const statusCounts = {
      pending: allOrders.filter((o) => o.status === "pending").length,
      confirmed: allOrders.filter((o) => o.status === "confirmed").length,
      processing: allOrders.filter((o) => o.status === "processing").length,
      out_for_delivery: allOrders.filter((o) => o.status === "out_for_delivery").length,
      delivered: allOrders.filter((o) => o.status === "delivered").length,
      cancelled: allOrders.filter((o) => o.status === "cancelled").length,
    };

    const chartData = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: allOrders.length > 0 ? Math.round((count / allOrders.length) * 10000) / 100 : 0,
    }));

    const response: ApiResponse<typeof chartData> = {
      success: true,
      data: chartData,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get orders by status chart",
    };
    res.status(500).json(response);
  }
};

// GET /api/analytics/charts/top-products - Get top products chart
const getTopProductsChart: RequestHandler = async (req, res) => {
  try {
    const { limit = "10", period = "month" } = req.query;
    const now = new Date();
    let days: number;

    switch (period) {
      case "week":
        days = 7;
        break;
      case "month":
        days = 30;
        break;
      case "quarter":
        days = 90;
        break;
      default:
        days = 30;
    }

    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const allOrders = await db.select().from(orders).where(
      and(
        gte(orders.createdAt, startDate),
        ne(orders.status, "cancelled")
      )
    );

    const orderIds = allOrders.map((o) => o.id);
    const allOrderItems = await db.select().from(orderItems);
    const relevantItems = allOrderItems.filter((i) => orderIds.includes(i.orderId));

    const productSales: Record<string, { name: string; sales: number; quantity: number }> = {};

    relevantItems.forEach((item) => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = {
          name: item.productName,
          sales: 0,
          quantity: 0,
        };
      }
      productSales[item.productId].sales += Number(item.totalPrice);
      productSales[item.productId].quantity += Number(item.quantity);
    });

    const chartData = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        sales: Math.round(data.sales * 100) / 100,
        quantity: Math.round(data.quantity * 100) / 100,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, parseInt(limit as string));

    const response: ApiResponse<typeof chartData> = {
      success: true,
      data: chartData,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get top products chart",
    };
    res.status(500).json(response);
  }
};

// GET /api/analytics/charts/sales-by-emirate - Get sales by emirate
const getSalesByEmirateChart: RequestHandler = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const now = new Date();
    let days: number;

    switch (period) {
      case "week":
        days = 7;
        break;
      case "month":
        days = 30;
        break;
      case "quarter":
        days = 90;
        break;
      default:
        days = 30;
    }

    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const allOrders = await db.select().from(orders).where(
      and(
        gte(orders.createdAt, startDate),
        ne(orders.status, "cancelled")
      )
    );
    const allAddresses = await db.select().from(addresses);

    const emirateSales: Record<string, { orders: number; revenue: number }> = {};

    allOrders.forEach((order) => {
      const address = allAddresses.find((a) => a.id === order.addressId);
      const emirate = address?.emirate || "Unknown";

      if (!emirateSales[emirate]) {
        emirateSales[emirate] = { orders: 0, revenue: 0 };
      }

      emirateSales[emirate].orders += 1;
      emirateSales[emirate].revenue += Number(order.total);
    });

    const chartData = Object.entries(emirateSales)
      .map(([emirate, data]) => ({
        emirate,
        orders: data.orders,
        revenue: Math.round(data.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const response: ApiResponse<typeof chartData> = {
      success: true,
      data: chartData,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get sales by emirate chart",
    };
    res.status(500).json(response);
  }
};

// GET /api/analytics/charts/payment-methods - Get payment methods breakdown
const getPaymentMethodsChart: RequestHandler = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const now = new Date();
    let days: number;

    switch (period) {
      case "week":
        days = 7;
        break;
      case "month":
        days = 30;
        break;
      case "quarter":
        days = 90;
        break;
      default:
        days = 30;
    }

    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const allOrders = await db.select().from(orders).where(
      and(
        gte(orders.createdAt, startDate),
        ne(orders.status, "cancelled")
      )
    );

    const paymentMethods: Record<string, { count: number; revenue: number }> = {
      card: { count: 0, revenue: 0 },
      cod: { count: 0, revenue: 0 },
      bank_transfer: { count: 0, revenue: 0 },
    };

    allOrders.forEach((order) => {
      const method = order.paymentMethod;
      if (paymentMethods[method]) {
        paymentMethods[method].count += 1;
        paymentMethods[method].revenue += Number(order.total);
      }
    });

    const totalOrders = allOrders.length;
    const chartData = Object.entries(paymentMethods).map(([method, data]) => ({
      method,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
      percentage: totalOrders > 0 ? Math.round((data.count / totalOrders) * 10000) / 100 : 0,
    }));

    const response: ApiResponse<typeof chartData> = {
      success: true,
      data: chartData,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get payment methods chart",
    };
    res.status(500).json(response);
  }
};

// GET /api/analytics/charts/hourly-orders - Get orders by hour of day
const getHourlyOrdersChart: RequestHandler = async (req, res) => {
  try {
    const { period = "week" } = req.query;
    const now = new Date();
    let days: number;

    switch (period) {
      case "week":
        days = 7;
        break;
      case "month":
        days = 30;
        break;
      default:
        days = 7;
    }

    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const allOrders = await db.select().from(orders).where(
      and(
        gte(orders.createdAt, startDate),
        ne(orders.status, "cancelled")
      )
    );

    const hourlyData: number[] = Array(24).fill(0);

    allOrders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();
      hourlyData[hour] += 1;
    });

    const chartData = hourlyData.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      orders: count,
    }));

    const response: ApiResponse<typeof chartData> = {
      success: true,
      data: chartData,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get hourly orders chart",
    };
    res.status(500).json(response);
  }
};

// GET /api/analytics/real-time - Get real-time stats for live dashboard
const getRealTimeStats: RequestHandler = async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const allOrders = await db.select().from(orders);
    const recentOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= oneHourAgo && o.status !== "cancelled"
    );
    const todayOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= today && o.status !== "cancelled"
    );

    // Active orders (not delivered or cancelled)
    const activeOrders = allOrders.filter(
      (o) => !["delivered", "cancelled"].includes(o.status)
    );

    // Out for delivery
    const outForDelivery = allOrders.filter((o) => o.status === "out_for_delivery");

    // Processing
    const processing = allOrders.filter((o) => o.status === "processing");

    const stats = {
      timestamp: now.toISOString(),
      lastHour: {
        orders: recentOrders.length,
        revenue: Math.round(recentOrders.reduce((sum, o) => sum + Number(o.total), 0) * 100) / 100,
      },
      today: {
        orders: todayOrders.length,
        revenue: Math.round(todayOrders.reduce((sum, o) => sum + Number(o.total), 0) * 100) / 100,
      },
      activeOrders: activeOrders.length,
      outForDelivery: outForDelivery.length,
      processing: processing.length,
      pendingOrders: allOrders.filter((o) => o.status === "pending").length,
    };

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get real-time stats",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/dashboard", getDashboardStats);
router.get("/charts/revenue", getRevenueChart);
router.get("/charts/orders-by-status", getOrdersByStatusChart);
router.get("/charts/top-products", getTopProductsChart);
router.get("/charts/sales-by-emirate", getSalesByEmirateChart);
router.get("/charts/payment-methods", getPaymentMethodsChart);
router.get("/charts/hourly-orders", getHourlyOrdersChart);
router.get("/real-time", getRealTimeStats);

export default router;
