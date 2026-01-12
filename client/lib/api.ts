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
  Supplier,
  SupplierProduct,
  PurchaseOrder,
  SupplierStats,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  CreatePurchaseOrderRequest,
  SupplierStatus,
  PurchaseOrderStatus,
  SupplierContact,
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

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generic fetch wrapper with retry logic for cold starts
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  retries: number = 2,
  retryDelay: number = 1000
): Promise<ApiResponse<T>> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
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
          // Retry on 5xx errors (server errors, often cold start issues)
          if (response.status >= 500 && attempt < retries) {
            lastError = new Error(`Server error: ${response.status}`);
            await delay(retryDelay * (attempt + 1));
            continue;
          }
          return { success: false, error: `Request failed with status ${response.status}` };
        }
      }

      // Try to parse as JSON
      try {
        const data = JSON.parse(text);
        
        // If server returned an error and it's a 5xx, retry
        if (!data.success && response.status >= 500 && attempt < retries) {
          lastError = new Error(data.error || 'Server error');
          await delay(retryDelay * (attempt + 1));
          continue;
        }
        
        return data;
      } catch {
        // Response is not JSON
        if (response.ok) {
          return { success: true, data: text as T };
        } else {
          // Retry on 5xx errors
          if (response.status >= 500 && attempt < retries) {
            lastError = new Error(text || `Server error: ${response.status}`);
            await delay(retryDelay * (attempt + 1));
            continue;
          }
          return { success: false, error: text || `Request failed with status ${response.status}` };
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Network error");
      
      // Retry on network errors (common during cold starts)
      if (attempt < retries) {
        await delay(retryDelay * (attempt + 1));
        continue;
      }
    }
  }
  
  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || "Network error after retries",
  };
}

// =====================================================
// AUTH API
// =====================================================

export const authApi = {
  login: (username: string, password: string) =>
    fetchApi<LoginResponse>("/users/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  adminLogin: (username: string, password: string) =>
    fetchApi<LoginResponse>("/users/admin-login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  register: (userData: {
    username: string;
    email: string;
    mobile: string;
    password: string;
    firstName: string;
    familyName: string;
    emirate: string;
    address?: string;
    deliveryAddress?: {
      label: string;
      fullName: string;
      mobile: string;
      emirate: string;
      area: string;
      street: string;
      building: string;
      floor?: string;
      apartment?: string;
      latitude?: number;
      longitude?: number;
      isDefault: boolean;
    };
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
// LOCAL ORDERS STORAGE (for demo persistence)
// =====================================================

const LOCAL_ORDERS_KEY = 'butcher_local_orders';

function getLocalOrders(): Order[] {
  try {
    const stored = localStorage.getItem(LOCAL_ORDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalOrder(order: Order): void {
  try {
    const orders = getLocalOrders();
    // Add or update order
    const existingIndex = orders.findIndex(o => o.id === order.id);
    if (existingIndex >= 0) {
      orders[existingIndex] = order;
    } else {
      orders.unshift(order); // Add to beginning
    }
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage errors
  }
}

function updateLocalOrderStatus(orderId: string, status: OrderStatus): Order | null {
  try {
    const orders = getLocalOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.push({
        status,
        changedAt: new Date().toISOString(),
        changedBy: 'admin',
      });
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
      return order;
    }
    return null;
  } catch {
    return null;
  }
}

// =====================================================
// ORDERS API
// =====================================================

export const ordersApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<Order[]>> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.status) searchParams.set("status", params.status);
    if (params?.userId) searchParams.set("userId", params.userId);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);

    const response = await fetchApi<Order[]>(`/orders?${searchParams.toString()}`);
    
    // Merge with local orders for demo persistence
    const localOrders = getLocalOrders();
    if (response.success && response.data) {
      // Combine API orders with local orders, avoiding duplicates
      const apiOrderIds = new Set(response.data.map(o => o.id));
      const uniqueLocalOrders = localOrders.filter(o => !apiOrderIds.has(o.id));
      
      // Apply status filter to local orders if needed
      let filteredLocalOrders = uniqueLocalOrders;
      if (params?.status && params.status !== 'all') {
        filteredLocalOrders = uniqueLocalOrders.filter(o => o.status === params.status);
      }
      
      // Combine and sort by date
      const allOrders = [...filteredLocalOrders, ...response.data];
      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return { success: true, data: allOrders };
    }
    
    // If API fails, return local orders
    if (localOrders.length > 0) {
      let filteredOrders = localOrders;
      if (params?.status && params.status !== 'all') {
        filteredOrders = localOrders.filter(o => o.status === params.status);
      }
      return { success: true, data: filteredOrders };
    }
    
    return response;
  },

  getById: async (id: string): Promise<ApiResponse<Order>> => {
    // First check local orders
    const localOrders = getLocalOrders();
    const localOrder = localOrders.find(o => o.id === id);
    if (localOrder) {
      return { success: true, data: localOrder };
    }
    return fetchApi<Order>(`/orders/${id}`);
  },

  getByOrderNumber: async (orderNumber: string): Promise<ApiResponse<Order>> => {
    // First check local orders
    const localOrders = getLocalOrders();
    const localOrder = localOrders.find(o => o.orderNumber === orderNumber);
    if (localOrder) {
      return { success: true, data: localOrder };
    }
    return fetchApi<Order>(`/orders/number/${orderNumber}`);
  },

  getStats: async (): Promise<ApiResponse<{
    total: number;
    pending: number;
    confirmed: number;
    processing: number;
    outForDelivery: number;
    delivered: number;
    cancelled: number;
    todayOrders: number;
    todayRevenue: number;
  }>> => {
    const response = await fetchApi<{
      total: number;
      pending: number;
      confirmed: number;
      processing: number;
      outForDelivery: number;
      delivered: number;
      cancelled: number;
      todayOrders: number;
      todayRevenue: number;
    }>("/orders/stats");
    
    // Add local orders to stats
    const localOrders = getLocalOrders();
    if (response.success && response.data && localOrders.length > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayLocalOrders = localOrders.filter(o => new Date(o.createdAt) >= todayStart);
      
      return {
        success: true,
        data: {
          total: response.data.total + localOrders.length,
          pending: response.data.pending + localOrders.filter(o => o.status === 'pending').length,
          confirmed: response.data.confirmed + localOrders.filter(o => o.status === 'confirmed').length,
          processing: response.data.processing + localOrders.filter(o => o.status === 'processing').length,
          outForDelivery: response.data.outForDelivery + localOrders.filter(o => o.status === 'out_for_delivery').length,
          delivered: response.data.delivered + localOrders.filter(o => o.status === 'delivered').length,
          cancelled: response.data.cancelled + localOrders.filter(o => o.status === 'cancelled').length,
          todayOrders: response.data.todayOrders + todayLocalOrders.length,
          todayRevenue: response.data.todayRevenue + todayLocalOrders.reduce((sum, o) => sum + o.total, 0),
        },
      };
    }
    
    return response;
  },

  updateStatus: async (id: string, status: OrderStatus, notes?: string): Promise<ApiResponse<Order>> => {
    // First try to update in API
    const response = await fetchApi<Order>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    });
    
    // Also update local storage
    const updatedLocal = updateLocalOrderStatus(id, status);
    if (updatedLocal && !response.success) {
      return { success: true, data: updatedLocal };
    }
    
    // Save updated order to local storage
    if (response.success && response.data) {
      saveLocalOrder(response.data);
    }
    
    return response;
  },

  delete: (id: string) =>
    fetchApi<null>(`/orders/${id}`, { method: "DELETE" }),

  create: async (orderData: {
    userId: string;
    items: { productId: string; quantity: number; notes?: string }[];
    addressId: string;
    deliveryAddress?: {
      fullName: string;
      mobile: string;
      emirate: string;
      area: string;
      street: string;
      building: string;
      floor?: string;
      apartment?: string;
      latitude?: number;
      longitude?: number;
    };
    paymentMethod: "card" | "cod" | "bank_transfer";
    deliveryNotes?: string;
    discountCode?: string;
  }): Promise<ApiResponse<Order>> => {
    const response = await fetchApi<Order>("/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
    
    // Save to local storage for demo persistence
    if (response.success && response.data) {
      saveLocalOrder(response.data);
    }
    
    return response;
  },
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
    fetchApi<DeliveryTracking>(`/delivery/tracking/by-order/${orderId}`),

  assignDriver: (orderId: string, driverId: string, estimatedArrival?: string, orderData?: Order) =>
    fetchApi<DeliveryTracking>(`/delivery/tracking/assign`, {
      method: "POST",
      body: JSON.stringify({ orderId, driverId, estimatedArrival, orderData }),
    }),

  updateTracking: (orderId: string, status: string, notes?: string) =>
    fetchApi<DeliveryTracking>(`/delivery/tracking/${orderId}/update`, {
      method: "POST",
      body: JSON.stringify({ status, notes }),
    }),

  // Get all delivery drivers
  getDrivers: () =>
    fetchApi<{ id: string; name: string; mobile: string; email: string; activeDeliveries: number }[]>(
      "/delivery/drivers"
    ),
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

// =====================================================
// SUPPLIERS API
// =====================================================

export const suppliersApi = {
  // Suppliers CRUD
  getAll: (params?: { status?: string; category?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.category) searchParams.set("category", params.category);
    if (params?.search) searchParams.set("search", params.search);
    return fetchApi<Supplier[]>(`/suppliers?${searchParams.toString()}`);
  },

  getById: (id: string) => fetchApi<Supplier>(`/suppliers/${id}`),

  getStats: () => fetchApi<SupplierStats>("/suppliers/stats"),

  create: (data: CreateSupplierRequest) =>
    fetchApi<Supplier>("/suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateSupplierRequest) =>
    fetchApi<Supplier>(`/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<null>(`/suppliers/${id}`, { method: "DELETE" }),

  updateStatus: (id: string, status: SupplierStatus) =>
    fetchApi<Supplier>(`/suppliers/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Supplier Contacts
  addContact: (supplierId: string, contact: Omit<SupplierContact, "id">) =>
    fetchApi<SupplierContact>(`/suppliers/${supplierId}/contacts`, {
      method: "POST",
      body: JSON.stringify(contact),
    }),

  removeContact: (supplierId: string, contactId: string) =>
    fetchApi<null>(`/suppliers/${supplierId}/contacts/${contactId}`, {
      method: "DELETE",
    }),

  // Supplier Products
  getProducts: (supplierId: string) =>
    fetchApi<SupplierProduct[]>(`/suppliers/${supplierId}/products`),

  addProduct: (supplierId: string, product: Omit<SupplierProduct, "id" | "supplierId" | "createdAt" | "updatedAt" | "lastPurchasePrice" | "lastPurchaseDate">) =>
    fetchApi<SupplierProduct>(`/suppliers/${supplierId}/products`, {
      method: "POST",
      body: JSON.stringify(product),
    }),

  removeProduct: (productId: string) =>
    fetchApi<null>(`/suppliers/products/${productId}`, { method: "DELETE" }),

  // Purchase Orders
  getPurchaseOrders: (params?: { status?: string; supplierId?: string; startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.supplierId) searchParams.set("supplierId", params.supplierId);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    return fetchApi<PurchaseOrder[]>(`/suppliers/purchase-orders/list?${searchParams.toString()}`);
  },

  getPurchaseOrderById: (id: string) =>
    fetchApi<PurchaseOrder>(`/suppliers/purchase-orders/${id}`),

  createPurchaseOrder: (data: CreatePurchaseOrderRequest) =>
    fetchApi<PurchaseOrder>("/suppliers/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePurchaseOrderStatus: (id: string, status: PurchaseOrderStatus, notes?: string) =>
    fetchApi<PurchaseOrder>(`/suppliers/purchase-orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),

  receivePurchaseOrderItems: (id: string, items: { itemId: string; receivedQuantity: number }[]) =>
    fetchApi<PurchaseOrder>(`/suppliers/purchase-orders/${id}/receive`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  cancelPurchaseOrder: (id: string) =>
    fetchApi<PurchaseOrder>(`/suppliers/purchase-orders/${id}`, {
      method: "DELETE",
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

// =====================================================
// FINANCE API
// =====================================================

import type {
  FinanceTransaction,
  FinanceAccount,
  FinanceExpense,
  FinanceSummary,
  ProfitLossReport,
  CashFlowReport,
  VATReport,
  CreateExpenseRequest,
  TransactionType,
  TransactionStatus,
  ExpenseCategory,
} from "@shared/api";

export const financeApi = {
  // Summary & Dashboard
  getSummary: (params?: { period?: string; startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set("period", params.period);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    return fetchApi<FinanceSummary>(`/finance/summary?${searchParams.toString()}`);
  },

  // Transactions
  getTransactions: (params?: {
    type?: TransactionType;
    status?: TransactionStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set("type", params.type);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    return fetchApi<FinanceTransaction[]>(`/finance/transactions?${searchParams.toString()}`);
  },

  getTransactionById: (id: string) =>
    fetchApi<FinanceTransaction>(`/finance/transactions/${id}`),

  // Accounts
  getAccounts: () => fetchApi<FinanceAccount[]>("/finance/accounts"),

  getAccountById: (id: string) =>
    fetchApi<FinanceAccount>(`/finance/accounts/${id}`),

  createAccount: (data: Omit<FinanceAccount, "id" | "createdAt" | "updatedAt" | "balance">) =>
    fetchApi<FinanceAccount>("/finance/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAccount: (id: string, data: Partial<FinanceAccount>) =>
    fetchApi<FinanceAccount>(`/finance/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  transferBetweenAccounts: (fromAccountId: string, toAccountId: string, amount: number, notes?: string) =>
    fetchApi<{ from: FinanceAccount; to: FinanceAccount }>("/finance/accounts/transfer", {
      method: "POST",
      body: JSON.stringify({ fromAccountId, toAccountId, amount, notes }),
    }),

  // Expenses
  getExpenses: (params?: {
    category?: ExpenseCategory;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    return fetchApi<FinanceExpense[]>(`/finance/expenses?${searchParams.toString()}`);
  },

  createExpense: (data: CreateExpenseRequest) =>
    fetchApi<FinanceExpense>("/finance/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateExpense: (id: string, data: Partial<FinanceExpense>) =>
    fetchApi<FinanceExpense>(`/finance/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteExpense: (id: string) =>
    fetchApi<null>(`/finance/expenses/${id}`, { method: "DELETE" }),

  markExpensePaid: (id: string, accountId: string) =>
    fetchApi<FinanceExpense>(`/finance/expenses/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ accountId }),
    }),

  // Reports
  getProfitLoss: (params?: { period?: string; startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set("period", params.period);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    return fetchApi<ProfitLossReport>(`/finance/reports/profit-loss?${searchParams.toString()}`);
  },

  getCashFlow: (params?: { period?: string; startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set("period", params.period);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    return fetchApi<CashFlowReport>(`/finance/reports/cash-flow?${searchParams.toString()}`);
  },

  getVATReport: (params?: { period?: string; startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set("period", params.period);
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    return fetchApi<VATReport>(`/finance/reports/vat?${searchParams.toString()}`);
  },

  exportReport: (reportType: "profit-loss" | "cash-flow" | "vat" | "transactions", format: "pdf" | "csv" | "excel", startDate: string, endDate: string) =>
    fetchApi<{ url: string; filename: string }>("/finance/reports/export", {
      method: "POST",
      body: JSON.stringify({ reportType, format, startDate, endDate }),
    }),

  // Reconciliation
  reconcileAccount: (accountId: string, statementBalance: number, reconciliationDate: string) =>
    fetchApi<FinanceAccount>(`/finance/accounts/${accountId}/reconcile`, {
      method: "POST",
      body: JSON.stringify({ statementBalance, reconciliationDate }),
    }),
};
