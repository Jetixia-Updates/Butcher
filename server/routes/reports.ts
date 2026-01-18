/**
 * Sales Reports Routes
 * Comprehensive reporting with export functionality (PostgreSQL version)
 */

import { Router, RequestHandler } from "express";
import { eq, ne, gte, lte, and } from "drizzle-orm";
import type { 
  SalesReportData, 
  SalesByCategory, 
  SalesByProduct, 
  SalesTimeSeries, 
  InventoryReport,
  CustomerAnalytics,
  ApiResponse 
} from "../../shared/api";
import { db, orders, orderItems, products, users, stock, stockMovements } from "../db/connection";

const router = Router();

// Helper to convert decimal strings to numbers
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value) || 0;
}

// Helper to get date range
function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start: Date;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "week":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter":
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

// GET /api/reports/sales - Get sales report
const getSalesReport: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    // Get orders in date range (excluding cancelled)
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => 
        new Date(o.createdAt) >= start && 
        new Date(o.createdAt) <= end &&
        o.status !== "cancelled"
    );

    // Get products for cost calculation
    const allProducts = await db.select().from(products);
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // Get order items
    const allOrderItems = await db.select().from(orderItems);

    // Calculate metrics
    const totalSales = filteredOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const totalDiscount = filteredOrders.reduce((sum, o) => sum + Number(o.discount || 0), 0);
    const totalVat = filteredOrders.reduce((sum, o) => sum + Number(o.vatAmount), 0);
    const totalDeliveryFees = filteredOrders.reduce((sum, o) => sum + Number(o.deliveryFee), 0);
    const netRevenue = totalSales - totalVat - totalDeliveryFees;

    // Calculate cost of goods
    let costOfGoods = 0;
    const orderIds = filteredOrders.map((o) => o.id);
    const relevantItems = allOrderItems.filter((i) => orderIds.includes(i.orderId));
    
    relevantItems.forEach((item) => {
      const product = productMap.get(item.productId);
      if (product) {
        costOfGoods += Number(product.costPrice) * Number(item.quantity);
      }
    });

    const grossProfit = netRevenue - costOfGoods;
    const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const report: SalesReportData = {
      period: period as string,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      costOfGoods: Math.round(costOfGoods * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
    };

    const response: ApiResponse<SalesReportData> = {
      success: true,
      data: report,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate sales report",
    };
    res.status(500).json(response);
  }
};

// GET /api/reports/sales-by-category - Get sales by category
const getSalesByCategory: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    // Get orders in date range
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => 
        new Date(o.createdAt) >= start && 
        new Date(o.createdAt) <= end &&
        o.status !== "cancelled"
    );

    // Get products and order items
    const allProducts = await db.select().from(products);
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    const allOrderItems = await db.select().from(orderItems);

    // Aggregate by category
    const categoryMap: Record<string, { sales: number; quantity: number }> = {};
    const orderIds = filteredOrders.map((o) => o.id);
    const relevantItems = allOrderItems.filter((i) => orderIds.includes(i.orderId));

    relevantItems.forEach((item) => {
      const product = productMap.get(item.productId);
      const category = product?.category || "Other";

      if (!categoryMap[category]) {
        categoryMap[category] = { sales: 0, quantity: 0 };
      }

      categoryMap[category].sales += Number(item.totalPrice);
      categoryMap[category].quantity += Number(item.quantity);
    });

    const totalSales = Object.values(categoryMap).reduce((sum, c) => sum + c.sales, 0);

    const salesByCategory: SalesByCategory[] = Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        totalSales: Math.round(data.sales * 100) / 100,
        totalQuantity: Math.round(data.quantity * 100) / 100,
        percentage: totalSales > 0 ? Math.round((data.sales / totalSales) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    const response: ApiResponse<SalesByCategory[]> = {
      success: true,
      data: salesByCategory,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate category report",
    };
    res.status(500).json(response);
  }
};

// GET /api/reports/sales-by-product - Get sales by product
const getSalesByProduct: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate, limit = "20" } = req.query;

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    // Get orders in date range
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => 
        new Date(o.createdAt) >= start && 
        new Date(o.createdAt) <= end &&
        o.status !== "cancelled"
    );

    // Get order items
    const allOrderItems = await db.select().from(orderItems);
    const orderIds = filteredOrders.map((o) => o.id);
    const relevantItems = allOrderItems.filter((i) => orderIds.includes(i.orderId));

    // Aggregate by product
    const productMap: Record<string, { name: string; sales: number; quantity: number }> = {};

    relevantItems.forEach((item) => {
      if (!productMap[item.productId]) {
        productMap[item.productId] = {
          name: item.productName,
          sales: 0,
          quantity: 0,
        };
      }

      productMap[item.productId].sales += Number(item.totalPrice);
      productMap[item.productId].quantity += Number(item.quantity);
    });

    const salesByProduct: SalesByProduct[] = Object.entries(productMap)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        totalSales: Math.round(data.sales * 100) / 100,
        totalQuantity: Math.round(data.quantity * 100) / 100,
        averagePrice: data.quantity > 0 ? Math.round((data.sales / data.quantity) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, parseInt(limit as string));

    const response: ApiResponse<SalesByProduct[]> = {
      success: true,
      data: salesByProduct,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate product report",
    };
    res.status(500).json(response);
  }
};

// GET /api/reports/sales-timeseries - Get sales time series
const getSalesTimeSeries: RequestHandler = async (req, res) => {
  try {
    const { period = "month", groupBy = "day" } = req.query;
    const range = getDateRange(period as string);

    // Get orders in date range
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => 
        new Date(o.createdAt) >= range.start && 
        new Date(o.createdAt) <= range.end &&
        o.status !== "cancelled"
    );

    // Group by date
    const dateMap: Record<string, { sales: number; orders: number; customers: Set<string> }> = {};

    filteredOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      let key: string;

      switch (groupBy) {
        case "hour":
          key = `${date.toISOString().slice(0, 13)}:00`;
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().slice(0, 10);
          break;
        case "month":
          key = date.toISOString().slice(0, 7);
          break;
        default: // day
          key = date.toISOString().slice(0, 10);
      }

      if (!dateMap[key]) {
        dateMap[key] = { sales: 0, orders: 0, customers: new Set() };
      }

      dateMap[key].sales += Number(order.total);
      dateMap[key].orders += 1;
      dateMap[key].customers.add(order.userId);
    });

    const timeSeries: SalesTimeSeries[] = Object.entries(dateMap)
      .map(([date, data]) => ({
        date,
        sales: Math.round(data.sales * 100) / 100,
        orders: data.orders,
        customers: data.customers.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const response: ApiResponse<SalesTimeSeries[]> = {
      success: true,
      data: timeSeries,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate time series",
    };
    res.status(500).json(response);
  }
};

// GET /api/reports/customers - Get customer analytics
const getCustomerAnalytics: RequestHandler = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const range = getDateRange(period as string);

    // Get orders in date range
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => 
        new Date(o.createdAt) >= range.start && 
        new Date(o.createdAt) <= range.end &&
        o.status !== "cancelled"
    );

    // Aggregate by customer
    const customerMap: Record<string, { 
      name: string; 
      orders: number; 
      spent: number; 
      lastOrder: string 
    }> = {};

    filteredOrders.forEach((order) => {
      if (!customerMap[order.userId]) {
        customerMap[order.userId] = {
          name: order.customerName,
          orders: 0,
          spent: 0,
          lastOrder: order.createdAt.toISOString(),
        };
      }

      customerMap[order.userId].orders += 1;
      customerMap[order.userId].spent += Number(order.total);

      if (order.createdAt.toISOString() > customerMap[order.userId].lastOrder) {
        customerMap[order.userId].lastOrder = order.createdAt.toISOString();
      }
    });

    // Top customers
    const topCustomers = Object.entries(customerMap)
      .map(([userId, data]) => ({
        userId,
        name: data.name,
        totalOrders: data.orders,
        totalSpent: Math.round(data.spent * 100) / 100,
        averageOrderValue: Math.round((data.spent / data.orders) * 100) / 100,
        lastOrderDate: data.lastOrder,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Customers by emirate
    const allUsers = await db.select().from(users).where(eq(users.role, "customer"));
    const emirateMap: Record<string, number> = {};

    allUsers.forEach((u) => {
      const emirate = u.emirate || "Unknown";
      emirateMap[emirate] = (emirateMap[emirate] || 0) + 1;
    });

    const totalCustomers = allUsers.length;
    const customersByEmirate = Object.entries(emirateMap)
      .map(([emirate, count]) => ({
        emirate,
        count,
        percentage: Math.round((count / totalCustomers) * 10000) / 100,
      }))
      .sort((a, b) => b.count - a.count);

    // Customer retention
    const returningCustomers = new Set(
      Object.entries(customerMap)
        .filter(([_, data]) => data.orders > 1)
        .map(([userId]) => userId)
    ).size;

    const customerRetention = [
      {
        period: period as string,
        newCustomers: Object.keys(customerMap).length,
        returningCustomers,
        churnedCustomers: 0,
      },
    ];

    const analytics: CustomerAnalytics = {
      topCustomers,
      customersByEmirate,
      customerRetention,
    };

    const response: ApiResponse<CustomerAnalytics> = {
      success: true,
      data: analytics,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate customer analytics",
    };
    res.status(500).json(response);
  }
};

// GET /api/reports/inventory - Get inventory report
const getInventoryReport: RequestHandler = async (req, res) => {
  try {
    const allProducts = await db.select().from(products);
    const allStock = await db.select().from(stock);
    const allMovements = await db.select().from(stockMovements);
    const allOrders = await db.select().from(orders).where(ne(orders.status, "cancelled"));
    const allOrderItems = await db.select().from(orderItems);

    // Total stock value
    let totalStockValue = 0;
    allStock.forEach((s) => {
      const product = allProducts.find((p) => p.id === s.productId);
      if (product) {
        totalStockValue += toNumber(s.quantity) * toNumber(product.costPrice);
      }
    });

    // Low stock items
    const lowStockItems = allStock
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

    // Top selling products
    const productSales: Record<string, { name: string; quantity: number; sales: number }> = {};
    const orderIds = allOrders.map((o) => o.id);
    const relevantItems = allOrderItems.filter((i) => orderIds.includes(i.orderId));

    relevantItems.forEach((item) => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = {
          name: item.productName,
          quantity: 0,
          sales: 0,
        };
      }
      productSales[item.productId].quantity += Number(item.quantity);
      productSales[item.productId].sales += Number(item.totalPrice);
    });

    const topSellingProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        totalSales: Math.round(data.sales * 100) / 100,
        totalQuantity: Math.round(data.quantity * 100) / 100,
        averagePrice: data.quantity > 0 ? Math.round((data.sales / data.quantity) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    // Slow moving products
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = allOrders.filter((o) => new Date(o.createdAt) >= thirtyDaysAgo);
    const recentOrderIds = recentOrders.map((o) => o.id);
    const recentItems = allOrderItems.filter((i) => recentOrderIds.includes(i.orderId));
    const recentProductIds = new Set(recentItems.map((i) => i.productId));

    const slowMovingProducts = allProducts
      .filter((p) => !recentProductIds.has(p.id) && p.isActive)
      .map((p) => {
        const stockItem = allStock.find((s) => s.productId === p.id);
        const stockQty = stockItem ? toNumber(stockItem.quantity) : 0;
        return {
          productId: p.id,
          productName: p.name,
          daysSinceLastSale: 30,
          currentStock: stockQty,
          stockValue: stockQty * toNumber(p.costPrice),
        };
      })
      .filter((p) => p.currentStock > 0)
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 10);

    // Stock movement summary
    const movementSummary: Record<string, { count: number; quantity: number }> = {};

    allMovements.forEach((m) => {
      if (!movementSummary[m.type]) {
        movementSummary[m.type] = { count: 0, quantity: 0 };
      }
      movementSummary[m.type].count += 1;
      movementSummary[m.type].quantity += toNumber(m.quantity);
    });

    const stockMovementSummary = Object.entries(movementSummary).map(([type, data]) => ({
      type,
      count: data.count,
      totalQuantity: Math.round(data.quantity * 100) / 100,
    }));

    const report: InventoryReport = {
      totalProducts: allProducts.length,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      lowStockItems,
      topSellingProducts,
      slowMovingProducts,
      stockMovementSummary,
    };

    const response: ApiResponse<InventoryReport> = {
      success: true,
      data: report,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate inventory report",
    };
    res.status(500).json(response);
  }
};

// GET /api/reports/orders - Get orders report
const getOrdersReport: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end
    );

    // Status breakdown
    const statusBreakdown = {
      pending: filteredOrders.filter((o) => o.status === "pending").length,
      confirmed: filteredOrders.filter((o) => o.status === "confirmed").length,
      processing: filteredOrders.filter((o) => o.status === "processing").length,
      outForDelivery: filteredOrders.filter((o) => o.status === "out_for_delivery").length,
      delivered: filteredOrders.filter((o) => o.status === "delivered").length,
      cancelled: filteredOrders.filter((o) => o.status === "cancelled").length,
    };

    // Payment method breakdown
    const paymentBreakdown = {
      card: filteredOrders.filter((o) => o.paymentMethod === "card").length,
      cod: filteredOrders.filter((o) => o.paymentMethod === "cod").length,
      bankTransfer: filteredOrders.filter((o) => o.paymentMethod === "bank_transfer").length,
    };

    // Delivery performance
    const deliveredOrders = filteredOrders.filter(
      (o) => o.status === "delivered" && o.actualDeliveryAt && o.estimatedDeliveryAt
    );
    let onTimeDeliveries = 0;
    let totalDeliveryTime = 0;

    deliveredOrders.forEach((o) => {
      const actual = new Date(o.actualDeliveryAt!).getTime();
      const estimated = new Date(o.estimatedDeliveryAt!).getTime();
      const created = new Date(o.createdAt).getTime();

      if (actual <= estimated) {
        onTimeDeliveries++;
      }
      totalDeliveryTime += (actual - created) / (1000 * 60);
    });

    const averageDeliveryTime = deliveredOrders.length > 0
      ? Math.round(totalDeliveryTime / deliveredOrders.length)
      : 0;

    const onTimeDeliveryRate = deliveredOrders.length > 0
      ? Math.round((onTimeDeliveries / deliveredOrders.length) * 10000) / 100
      : 0;

    // Source breakdown
    const sourceBreakdown = {
      web: filteredOrders.filter((o) => o.source === "web").length,
      mobile: filteredOrders.filter((o) => o.source === "mobile").length,
      phone: filteredOrders.filter((o) => o.source === "phone").length,
      admin: filteredOrders.filter((o) => o.source === "admin").length,
    };

    const report = {
      period: period as string,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalOrders: filteredOrders.length,
      statusBreakdown,
      paymentBreakdown,
      sourceBreakdown,
      deliveryPerformance: {
        totalDelivered: deliveredOrders.length,
        onTimeDeliveries,
        onTimeDeliveryRate,
        averageDeliveryTime,
      },
      cancellationRate: filteredOrders.length > 0
        ? Math.round((statusBreakdown.cancelled / filteredOrders.length) * 10000) / 100
        : 0,
    };

    const response: ApiResponse<typeof report> = {
      success: true,
      data: report,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate orders report",
    };
    res.status(500).json(response);
  }
};

// POST /api/reports/export - Export report
const exportReport: RequestHandler = async (req, res) => {
  try {
    const { reportType, format, startDate, endDate } = req.body;

    let data: unknown;

    switch (reportType) {
      case "sales":
        const allOrders = await db.select().from(orders);
        const filteredOrders = allOrders.filter(
          (o) => 
            new Date(o.createdAt) >= new Date(startDate) && 
            new Date(o.createdAt) <= new Date(endDate) &&
            o.status !== "cancelled"
        );
        
        const allOrderItems = await db.select().from(orderItems);
        
        data = filteredOrders.map((o) => {
          const items = allOrderItems.filter((i) => i.orderId === o.id);
          return {
            orderNumber: o.orderNumber,
            date: o.createdAt,
            customer: o.customerName,
            items: items.length,
            subtotal: Number(o.subtotal),
            vat: Number(o.vatAmount),
            total: Number(o.total),
            paymentMethod: o.paymentMethod,
            status: o.status,
          };
        });
        break;

      case "inventory":
        const allStock = await db.select().from(stock);
        const allProducts = await db.select().from(products);
        
        data = allStock.map((s) => {
          const product = allProducts.find((p) => p.id === s.productId);
          return {
            productId: s.productId,
            productName: product?.name || "Unknown",
            sku: product?.sku || "",
            quantity: s.quantity,
            reserved: s.reservedQuantity,
            available: s.availableQuantity,
            lowStockThreshold: s.lowStockThreshold,
            lastRestocked: s.lastRestockedAt,
          };
        });
        break;

      case "customers":
        const allUsers = await db.select().from(users).where(eq(users.role, "customer"));
        
        data = allUsers.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.familyName}`,
          email: u.email,
          mobile: u.mobile,
          emirate: u.emirate,
          createdAt: u.createdAt,
          lastLogin: u.lastLoginAt,
          isActive: u.isActive,
        }));
        break;

      default:
        const response: ApiResponse<null> = {
          success: false,
          error: "Invalid report type",
        };
        return res.status(400).json(response);
    }

    const response: ApiResponse<{ data: unknown; format: string; generatedAt: string }> = {
      success: true,
      data: {
        data,
        format,
        generatedAt: new Date().toISOString(),
      },
      message: `Report exported as ${format.toUpperCase()}`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export report",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/sales", getSalesReport);
router.get("/sales-by-category", getSalesByCategory);
router.get("/sales-by-product", getSalesByProduct);
router.get("/sales-timeseries", getSalesTimeSeries);
router.get("/customers", getCustomerAnalytics);
router.get("/inventory", getInventoryReport);
router.get("/orders", getOrdersReport);
router.post("/export", exportReport);

export default router;
