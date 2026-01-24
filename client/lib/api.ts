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
// AUTH API - Staff (Admin, Staff, Delivery)
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

  logout: () =>
    fetchApi<null>("/users/logout", {
      method: "POST",
    }),

  getCurrentUser: () => fetchApi<User>("/users/me"),

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
    fetchApi<{ userId: string }>("/users/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),
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

    const query = searchParams.toString();
    return fetchApi<Order[]>(query ? `/orders?${query}` : "/orders");
  },

  getById: async (id: string): Promise<ApiResponse<Order>> => {
    return fetchApi<Order>(`/orders/${id}`);
  },

  getByOrderNumber: async (orderNumber: string): Promise<ApiResponse<Order>> => {
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
    return fetchApi<{
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
  },

  updateStatus: async (id: string, status: OrderStatus, notes?: string): Promise<ApiResponse<Order>> => {
    return fetchApi<Order>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    });
  },

  delete: (id: string) =>
    fetchApi<null>(`/orders/${id}`, { method: "DELETE" }),

  create: async (orderData: {
    userId: string;
    items: { productId: string; quantity: number; unitPrice: number; notes?: string }[];
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
    discountAmount?: number;
    deliveryFee: number;
    isExpressDelivery?: boolean;
    driverTip?: number;
    subtotal: number;
    vatAmount: number;
    total: number;
  }): Promise<ApiResponse<Order>> => {
    return fetchApi<Order>("/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
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
    username: string;
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

// =====================================================
// NOTIFICATIONS API
// =====================================================

export interface InAppNotification {
  id: string;
  userId: string;
  type: string; // Flexible type to support various notification types like order_placed, order_confirmed, etc.
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  link?: string | null;
  linkTab?: string | null;
  linkId?: string | null;
  unread: boolean;
  createdAt: string;
}

export const notificationsApi = {
  // Get all notifications for current user (or specific userId/customerId if provided)
  // Pass undefined to use Bearer token from header instead of query params
  getAll: (userId?: string | null) => {
    // Don't pass userId query param - let the server use the Bearer token to determine user type
    return fetchApi<InAppNotification[]>(`/notifications`);
  },

  // Create a notification for a user (used by admin/system)
  create: (data: {
    userId: string;
    type: string;
    title: string;
    titleAr: string;
    message: string;
    messageAr: string;
    link?: string;
    linkTab?: string;
    linkId?: string;
  }) =>
    fetchApi<InAppNotification>("/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Mark a notification as read
  markAsRead: (id: string) =>
    fetchApi<null>(`/notifications/${id}/read`, { method: "PATCH" }),

  // Mark all notifications as read
  markAllAsRead: (userId: string) =>
    fetchApi<null>("/notifications/read-all", { 
      method: "PATCH",
      body: JSON.stringify({ userId }),
    }),

  // Delete a notification
  delete: (id: string) =>
    fetchApi<null>(`/notifications/${id}`, { method: "DELETE" }),

  // Clear all notifications
  clearAll: (userId: string) =>
    fetchApi<null>(`/notifications?userId=${userId}`, { method: "DELETE" }),
};

// =====================================================
// WALLET API
// =====================================================

export interface WalletTransaction {
  id: string;
  userId: string;
  type: "topup" | "debit" | "credit" | "refund" | "cashback";
  amount: string;
  description: string;
  descriptionAr: string;
  reference?: string | null;
  createdAt: string;
}

export interface WalletData {
  balance: string;
  transactions: WalletTransaction[];
}

export const walletApi = {
  // Get wallet balance and transactions (optionally for a specific user - admin)
  get: (userId?: string) => fetchApi<WalletData>("/wallet", userId ? {
    headers: { "x-user-id": userId }
  } : undefined),

  // Top up wallet
  topUp: (amount: number, paymentMethod: string) =>
    fetchApi<{ balance: number }>("/wallet/topup", {
      method: "POST",
      body: JSON.stringify({ amount, paymentMethod }),
    }),

  // Deduct from wallet (for payments)
  deduct: (userId: string, amount: number, description: string, descriptionAr?: string, reference?: string) =>
    fetchApi<{ balance: string }>("/wallet/deduct", {
      method: "POST",
      headers: { "x-user-id": userId },
      body: JSON.stringify({ amount, description, descriptionAr: descriptionAr || description, reference }),
    }),

  // Add credit (refunds, cashback, admin adjustments)
  addCredit: (userId: string, amount: number, description: string, type: string = "credit") =>
    fetchApi<{ balance: string }>("/wallet/credit", {
      method: "POST",
      headers: { "x-user-id": userId },
      body: JSON.stringify({ 
        amount, 
        type, 
        description, 
        descriptionAr: description 
      }),
    }),
};

// =====================================================
// WISHLIST API
// =====================================================

export interface WishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    nameAr: string;
    price: string;
    image: string | null;
    category: string;
    discount: number | null;
  } | null;
}

export const wishlistApi = {
  // Get user's wishlist
  getAll: () => fetchApi<WishlistItem[]>("/wishlist"),

  // Add item to wishlist
  add: (productId: string) =>
    fetchApi<WishlistItem>("/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),

  // Remove item from wishlist
  remove: (productId: string) =>
    fetchApi<null>(`/wishlist/${productId}`, { method: "DELETE" }),

  // Clear wishlist
  clear: () =>
    fetchApi<null>("/wishlist", { method: "DELETE" }),
};

// =====================================================
// REVIEWS API
// =====================================================

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[] | null;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export const reviewsApi = {
  // Get all reviews (optionally filtered by productId)
  getAll: (productId?: string) => {
    const params = productId ? `?productId=${productId}` : "";
    return fetchApi<ProductReview[]>(`/reviews${params}`);
  },

  // Get reviews for a product with stats
  getProductReviews: (productId: string) =>
    fetchApi<{ reviews: ProductReview[]; stats: ProductReviewStats }>(
      `/reviews/product/${productId}`
    ),

  // Create a review
  create: (data: {
    productId: string;
    rating: number;
    title: string;
    comment: string;
    userName?: string;
    images?: string[];
    isVerifiedPurchase?: boolean;
  }) =>
    fetchApi<ProductReview>("/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update a review (supports status for admin moderation)
  update: (id: string, data: {
    rating?: number;
    title?: string;
    comment?: string;
    images?: string[];
    status?: "pending" | "approved" | "rejected";
  }) =>
    fetchApi<ProductReview>(`/reviews/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Delete a review
  delete: (id: string) =>
    fetchApi<null>(`/reviews/${id}`, { method: "DELETE" }),

  // Mark review as helpful
  markHelpful: (id: string) =>
    fetchApi<null>(`/reviews/${id}/helpful`, { method: "POST" }),
};

// =====================================================
// LOYALTY API
// =====================================================

export interface LoyaltyTier {
  id: string;
  name: string;
  nameAr: string;
  minPoints: number;
  multiplier: string;
  benefits: string[];
  benefitsAr: string[];
  icon: string;
  sortOrder: number;
}

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  type: "earn" | "redeem" | "bonus" | "expire" | "adjustment";
  points: number;
  description: string;
  orderId?: string | null;
  createdAt: string;
}

export interface LoyaltyData {
  points: number;
  totalEarned: number;
  referralCode: string;
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number;
  transactions: LoyaltyTransaction[];
}

export const loyaltyApi = {
  // Get user's loyalty points and tier (optionally for a specific user - admin)
  get: (userId?: string) => fetchApi<LoyaltyData>("/loyalty", userId ? {
    headers: { "x-user-id": userId }
  } : undefined),

  // Earn points from an order (admin can specify userId)
  earn: (userId: string, points: number, description: string, orderId?: string) =>
    fetchApi<{ points: number; totalEarned: number; tier: string }>("/loyalty/earn", {
      method: "POST",
      headers: { "x-user-id": userId },
      body: JSON.stringify({ points, orderId: orderId || "admin_bonus", description }),
    }),

  // Redeem points (admin can specify userId)
  redeem: (userId: string, points: number, description?: string) =>
    fetchApi<{ points: number; tier: string }>("/loyalty/redeem", {
      method: "POST",
      headers: { "x-user-id": userId },
      body: JSON.stringify({ points, description: description || "Points redeemed" }),
    }),

  // Apply referral code
  applyReferral: (code: string) =>
    fetchApi<{ points: number }>("/loyalty/referral", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  // Get all loyalty tiers
  getTiers: () => fetchApi<LoyaltyTier[]>("/loyalty/tiers"),
};

// =====================================================
// SETTINGS API
// =====================================================

export interface AppSettings {
  id: string;
  vatRate: string;
  deliveryFee: string;
  freeDeliveryThreshold: string;
  expressDeliveryFee: string;
  minimumOrderAmount: string;
  maxOrdersPerDay: number;
  enableCashOnDelivery: boolean;
  enableCardPayment: boolean;
  enableWallet: boolean;
  enableLoyalty: boolean;
  enableReviews: boolean;
  enableWishlist: boolean;
  enableExpressDelivery: boolean;
  enableScheduledDelivery: boolean;
  enableWelcomeBonus: boolean;
  welcomeBonus: string;
  cashbackPercentage: string;
  loyaltyPointsPerAed: string;
  loyaltyPointValue: string;
  storePhone: string;
  storeEmail: string;
  storeAddress: string;
  storeAddressAr: string;
  workingHoursStart: string;
  workingHoursEnd: string;
}

export interface Banner {
  id: string;
  titleEn: string;
  titleAr: string;
  subtitleEn?: string | null;
  subtitleAr?: string | null;
  image?: string | null;
  bgColor: string;
  link?: string | null;
  badge?: string | null;
  badgeAr?: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface DeliveryTimeSlot {
  id: string;
  label: string;
  labelAr: string;
  startTime: string;
  endTime: string;
  isExpressSlot: boolean;
  maxOrders: number;
  enabled: boolean;
  sortOrder: number;
}

export interface PromoCode {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: string;
  minimumOrder: string;
  maximumDiscount?: string | null;
  usageLimit: number;
  usageCount: number;
  userLimit: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  applicableProducts?: string[] | null;
  applicableCategories?: string[] | null;
}

export interface SettingsData {
  settings: AppSettings;
  banners: Banner[];
  timeSlots: DeliveryTimeSlot[];
  promoCodes: PromoCode[];
}

export const settingsApi = {
  // Get all settings
  getAll: () => fetchApi<SettingsData>("/settings"),

  // Update settings
  update: (settings: Partial<AppSettings>) =>
    fetchApi<AppSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  // Banner management
  createBanner: (banner: Omit<Banner, "id" | "sortOrder">) =>
    fetchApi<Banner>("/settings/banners", {
      method: "POST",
      body: JSON.stringify(banner),
    }),

  updateBanner: (id: string, banner: Partial<Banner>) =>
    fetchApi<Banner>(`/settings/banners/${id}`, {
      method: "PUT",
      body: JSON.stringify(banner),
    }),

  deleteBanner: (id: string) =>
    fetchApi<null>(`/settings/banners/${id}`, { method: "DELETE" }),

  // Time slot management
  createTimeSlot: (slot: Omit<DeliveryTimeSlot, "id" | "sortOrder">) =>
    fetchApi<DeliveryTimeSlot>("/settings/time-slots", {
      method: "POST",
      body: JSON.stringify(slot),
    }),

  updateTimeSlot: (id: string, slot: Partial<DeliveryTimeSlot>) =>
    fetchApi<DeliveryTimeSlot>(`/settings/time-slots/${id}`, {
      method: "PUT",
      body: JSON.stringify(slot),
    }),

  deleteTimeSlot: (id: string) =>
    fetchApi<null>(`/settings/time-slots/${id}`, { method: "DELETE" }),

  // Promo code management
  createPromoCode: (code: Omit<PromoCode, "id" | "usageCount">) =>
    fetchApi<PromoCode>("/settings/promo-codes", {
      method: "POST",
      body: JSON.stringify(code),
    }),

  updatePromoCode: (id: string, code: Partial<PromoCode>) =>
    fetchApi<PromoCode>(`/settings/promo-codes/${id}`, {
      method: "PUT",
      body: JSON.stringify(code),
    }),

  deletePromoCode: (id: string) =>
    fetchApi<null>(`/settings/promo-codes/${id}`, { method: "DELETE" }),

  validatePromoCode: (code: string, orderTotal: number) =>
    fetchApi<{
      valid: true;
      code: string;
      type: string;
      value: number;
      discount: number;
    }>("/settings/promo-codes/validate", {
      method: "POST",
      body: JSON.stringify({ code, orderTotal }),
    }),
};

// ============================================================
// ADDRESSES API
// ============================================================

export interface UserAddress {
  id: string;
  userId: string;
  label: string;
  fullName: string;
  mobile: string;
  emirate: string;
  area: string;
  street: string;
  building: string;
  floor?: string | null;
  apartment?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressInput {
  label: string;
  fullName: string;
  mobile: string;
  emirate: string;
  area: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

// Helper to determine if ID is a customer ID (starts with 'cust_') or user ID
const getOwnerHeader = (id: string): Record<string, string> => {
  // Customer IDs start with 'cust_', staff user IDs start with 'user_'
  if (id.startsWith('cust_')) {
    return { "x-customer-id": id };
  }
  return { "x-user-id": id };
};

export const addressesApi = {
  // Get all addresses for user/customer
  getAll: (ownerId: string) =>
    fetchApi<UserAddress[]>("/addresses", {
      headers: getOwnerHeader(ownerId),
    }),

  // Create new address
  create: (ownerId: string, address: CreateAddressInput) =>
    fetchApi<UserAddress>("/addresses", {
      method: "POST",
      headers: getOwnerHeader(ownerId),
      body: JSON.stringify(address),
    }),

  // Update address
  update: (ownerId: string, id: string, address: Partial<CreateAddressInput>) =>
    fetchApi<UserAddress>(`/addresses/${id}`, {
      method: "PUT",
      headers: getOwnerHeader(ownerId),
      body: JSON.stringify(address),
    }),

  // Delete address
  delete: (ownerId: string, id: string) =>
    fetchApi<null>(`/addresses/${id}`, {
      method: "DELETE",
      headers: getOwnerHeader(ownerId),
    }),

  // Set address as default
  setDefault: (ownerId: string, id: string) =>
    fetchApi<UserAddress>(`/addresses/${id}/default`, {
      method: "PUT",
      headers: getOwnerHeader(ownerId),
    }),
};
