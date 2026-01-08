/**
 * API Client for Backend Integration
 * Centralized API calls for all backend endpoints
 */

import type {
  ApiResponse,
  PaginatedResponse,
  DashboardStats,
  Order,
  OrderStatus,
  StockItem,
  StockMovement,
  LowStockAlert,
  User,
  Address,
  DeliveryZone,
  DeliveryTracking,
  Payment,
  SalesReportData,
  SalesByCategory,
  SalesByProduct,
  CustomerAnalytics,
  InventoryReport,
  LoginResponse,
  Product,
  CreateOrderRequest,
} from "@shared/api";

const API_BASE = "/api";

// Token management for authenticated requests
let authToken: string | null = localStorage.getItem("auth_token");

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
};

export const getAuthToken = () => authToken;

// Generic fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    };

    // Add auth token if available
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle empty responses (204 No Content, or empty body)
    const text = await response.text();
    
    if (!text) {
      // Empty response - return success/failure based on status code
      if (response.ok) {
        return { success: true, data: null as T };
      } else {
        return { success: false, error: `Request failed with status ${response.status}` };
      }
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      // Response is not JSON
      if (response.ok) {
        return { success: true, data: text as T };
      } else {
        return { success: false, error: text || `Request failed with status ${response.status}` };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// =====================================================
// AUTH API
// =====================================================

export const authApi = {
  login: (mobile: string, password: string) =>
    fetchApi<LoginResponse>("/users/login", {
      method: "POST",
      body: JSON.stringify({ mobile, password }),
    }),

  adminLogin: (email: string, password: string) =>
    fetchApi<LoginResponse>("/users/admin-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (userData: {
    email: string;
    mobile: string;
    password: string;
    firstName: string;
    familyName: string;
    emirate: string;
  }) =>
    fetchApi<User>("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  logout: () =>
    fetchApi<null>("/users/logout", {
      method: "POST",
    }),

  getCurrentUser: () => fetchApi<User>("/users/me"),
};

// =====================================================
// ANALYTICS API
// =====================================================

export const analyticsApi = {
  getDashboard: () => fetchApi<DashboardStats>("/analytics/dashboard"),

  getRevenueChart: (period: string = "week") =>
    fetchApi<{ date: string; revenue: number; orders: number }[]>(
      `/analytics/charts/revenue?period=${period}`
    ),

  getOrdersByStatus: () =>
    fetchApi<{ status: string; count: number; percentage: number }[]>(
      "/analytics/charts/orders-by-status"
    ),

  getTopProducts: (period: string = "month", limit: number = 10) =>
    fetchApi<{ productId: string; productName: string; sales: number; quantity: number }[]>(
      `/analytics/charts/top-products?period=${period}&limit=${limit}`
    ),

  getSalesByEmirate: (period: string = "month") =>
    fetchApi<{ emirate: string; orders: number; revenue: number }[]>(
      `/analytics/charts/sales-by-emirate?period=${period}`
    ),

  getPaymentMethods: (period: string = "month") =>
    fetchApi<{ method: string; count: number; revenue: number; percentage: number }[]>(
      `/analytics/charts/payment-methods?period=${period}`
    ),

  getRealTime: () =>
    fetchApi<{
      timestamp: string;
      lastHour: { orders: number; revenue: number };
      today: { orders: number; revenue: number };
      activeOrders: number;
      outForDelivery: number;
      processing: number;
      pendingOrders: number;
    }>("/analytics/real-time"),
};

// =====================================================
// ORDERS API
// =====================================================

export const ordersApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.userId) searchParams.set("userId", params.userId);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);

    return fetchApi<Order[]>(`/orders?${searchParams.toString()}`);
  },

  getById: (id: string) => fetchApi<Order>(`/orders/${id}`),

  getByOrderNumber: (orderNumber: string) =>
    fetchApi<Order>(`/orders/number/${orderNumber}`),

  getStats: () =>
    fetchApi<{
      total: number;
      pending: number;
      confirmed: number;
      processing: number;
      outForDelivery: number;
      delivered: number;
      cancelled: number;
      todayOrders: number;
      todayRevenue: number;
    }>("/orders/stats"),

  updateStatus: (id: string, status: OrderStatus, notes?: string) =>
    fetchApi<Order>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),

  delete: (id: string) =>
    fetchApi<null>(`/orders/${id}`, { method: "DELETE" }),

  create: (orderData: {
    userId: string;
    items: { productId: string; quantity: number; notes?: string }[];
    addressId: string;
    paymentMethod: "card" | "cod" | "bank_transfer";
    deliveryNotes?: string;
    discountCode?: string;
  }) =>
    fetchApi<Order>("/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    }),
};

// =====================================================
// PRODUCTS API
// =====================================================

export const productsApi = {
  getAll: () => fetchApi<Product[]>("/products"),

  getById: (id: string) => fetchApi<Product>(`/products/${id}`),

  create: (productData: Omit<Product, "id" | "createdAt" | "updatedAt">) =>
    fetchApi<Product>("/products", {
      method: "POST",
      body: JSON.stringify(productData),
    }),

  update: (id: string, productData: Partial<Product>) =>
    fetchApi<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(productData),
    }),

  delete: (id: string) =>
    fetchApi<null>(`/products/${id}`, { method: "DELETE" }),
};

// =====================================================
// STOCK API
// =====================================================

export const stockApi = {
  getAll: () => fetchApi<StockItem[]>("/stock"),

  getById: (productId: string) => fetchApi<StockItem>(`/stock/${productId}`),

  getAlerts: () => fetchApi<LowStockAlert[]>("/stock/alerts"),

  getMovements: (params?: { productId?: string; type?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.productId) searchParams.set("productId", params.productId);
    if (params?.type) searchParams.set("type", params.type);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    return fetchApi<StockMovement[]>(`/stock/movements?${searchParams.toString()}`);
  },

  update: (productId: string, quantity: number, type: string, reason: string) =>
    fetchApi<StockItem>("/stock/update", {
      method: "POST",
      body: JSON.stringify({ productId, quantity, type, reason }),
    }),

  restock: (productId: string, quantity: number, batchNumber?: string) =>
    fetchApi<StockItem>(`/stock/restock/${productId}`, {
      method: "POST",
      body: JSON.stringify({ quantity, batchNumber }),
    }),

  updateThresholds: (
    productId: string,
    lowStockThreshold: number,
    reorderPoint: number,
    reorderQuantity: number
  ) =>
    fetchApi<StockItem>(`/stock/${productId}/thresholds`, {
      method: "PATCH",
      body: JSON.stringify({ lowStockThreshold, reorderPoint, reorderQuantity }),
    }),
};

// =====================================================
// USERS API
// =====================================================

export const usersApi = {
  getAll: (params?: { page?: number; limit?: number; role?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.role) searchParams.set("role", params.role);
    if (params?.search) searchParams.set("search", params.search);

    return fetchApi<User[]>(`/users?${searchParams.toString()}`);
  },

  getById: (id: string) => fetchApi<User>(`/users/${id}`),

  getStats: () =>
    fetchApi<{
      total: number;
      customers: number;
      admins: number;
      staff: number;
      delivery: number;
      active: number;
      verified: number;
      newThisMonth: number;
    }>("/users/stats"),

  create: (userData: {
    email: string;
    mobile: string;
    password: string;
    firstName: string;
    familyName: string;
    emirate: string;
    role?: string;
  }) =>
    fetchApi<User>("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  update: (id: string, userData: Partial<User>) =>
    fetchApi<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    }),

  delete: (id: string) =>
    fetchApi<null>(`/users/${id}`, { method: "DELETE" }),

  toggleActive: (id: string, isActive: boolean) =>
    fetchApi<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive }),
    }),
};

// =====================================================
// DELIVERY API
// =====================================================

export const deliveryApi = {
  // Addresses
  getAddresses: (userId?: string) => {
    const params = userId ? `?userId=${userId}` : "";
    return fetchApi<Address[]>(`/delivery/addresses${params}`);
  },

  createAddress: (userId: string, address: Omit<Address, "id" | "userId" | "createdAt" | "updatedAt">) =>
    fetchApi<Address>("/delivery/addresses", {
      method: "POST",
      body: JSON.stringify({ userId, ...address }),
    }),

  updateAddress: (id: string, address: Partial<Address>) =>
    fetchApi<Address>(`/delivery/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(address),
    }),

  deleteAddress: (id: string) =>
    fetchApi<null>(`/delivery/addresses/${id}`, { method: "DELETE" }),

  // Zones
  getZones: () => fetchApi<DeliveryZone[]>("/delivery/zones"),

  createZone: (zone: Omit<DeliveryZone, "id">) =>
    fetchApi<DeliveryZone>("/delivery/zones", {
      method: "POST",
      body: JSON.stringify(zone),
    }),

  updateZone: (id: string, zone: Partial<DeliveryZone>) =>
    fetchApi<DeliveryZone>(`/delivery/zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(zone),
    }),

  deleteZone: (id: string) =>
    fetchApi<null>(`/delivery/zones/${id}`, { method: "DELETE" }),

  // Tracking
  getTracking: (orderId: string) =>
    fetchApi<DeliveryTracking>(`/delivery/tracking/${orderId}`),

  assignDriver: (orderId: string, driverId: string, estimatedArrival?: string) =>
    fetchApi<DeliveryTracking>(`/delivery/tracking/${orderId}/assign`, {
      method: "POST",
      body: JSON.stringify({ driverId, estimatedArrival }),
    }),

  updateTracking: (orderId: string, status: string, notes?: string) =>
    fetchApi<DeliveryTracking>(`/delivery/tracking/${orderId}/update`, {
      method: "POST",
      body: JSON.stringify({ status, notes }),
    }),
};

// =====================================================
// PAYMENTS API
// =====================================================

export const paymentsApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string; method?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.method) searchParams.set("method", params.method);

    return fetchApi<Payment[]>(`/payments?${searchParams.toString()}`);
  },

  getById: (id: string) => fetchApi<Payment>(`/payments/${id}`),

  getByOrder: (orderId: string) => fetchApi<Payment>(`/payments/order/${orderId}`),

  getStats: () =>
    fetchApi<{
      totalPayments: number;
      totalRevenue: number;
      pendingAmount: number;
      refundedAmount: number;
      byMethod: { method: string; count: number; amount: number }[];
      byStatus: { status: string; count: number; amount: number }[];
    }>("/payments/stats"),

  refund: (paymentId: string, amount: number, reason: string) =>
    fetchApi<Payment>(`/payments/${paymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),
};

// =====================================================
// REPORTS API
// =====================================================

export const reportsApi = {
  getSales: (params?: { period?: string; startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set("period", params.period);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);

    return fetchApi<SalesReportData>(`/reports/sales?${searchParams.toString()}`);
  },

  getSalesByCategory: (period: string = "month") =>
    fetchApi<SalesByCategory[]>(`/reports/sales-by-category?period=${period}`),

  getSalesByProduct: (period: string = "month", limit: number = 20) =>
    fetchApi<SalesByProduct[]>(`/reports/sales-by-product?period=${period}&limit=${limit}`),

  getCustomers: (period: string = "month") =>
    fetchApi<CustomerAnalytics>(`/reports/customers?period=${period}`),

  getInventory: () => fetchApi<InventoryReport>("/reports/inventory"),

  getOrders: (period: string = "month") =>
    fetchApi<{
      period: string;
      startDate: string;
      endDate: string;
      totalOrders: number;
      statusBreakdown: Record<string, number>;
      paymentBreakdown: Record<string, number>;
      sourceBreakdown: Record<string, number>;
      deliveryPerformance: {
        totalDelivered: number;
        onTimeDeliveries: number;
        onTimeDeliveryRate: number;
        averageDeliveryTime: number;
      };
      cancellationRate: number;
    }>(`/reports/orders?period=${period}`),

  export: (reportType: string, format: string, startDate: string, endDate: string) =>
    fetchApi<{ data: unknown; format: string; generatedAt: string }>("/reports/export", {
      method: "POST",
      body: JSON.stringify({ reportType, format, startDate, endDate }),
    }),
};
