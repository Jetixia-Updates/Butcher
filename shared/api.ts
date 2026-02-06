/**
 * Shared types between client and server
 * Comprehensive API interfaces for the Butcher Shop management system
 */

// =====================================================
// COMMON TYPES
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type Currency = "AED" | "USD" | "EUR";
export type Language = "en" | "ar";

// =====================================================
// USER MANAGEMENT TYPES
// =====================================================

export type UserRole = "customer" | "admin" | "staff" | "delivery";

// Staff permissions for backend access control
export interface StaffPermissions {
  // Products
  canViewProducts: boolean;
  canEditProducts: boolean;
  canEditPrices: boolean;
  canManageStock: boolean;
  // Orders
  canViewOrders: boolean;
  canManageOrders: boolean;
  canCancelOrders: boolean;
  // Customers
  canViewCustomers: boolean;
  canManageCustomers: boolean;
  // Payments
  canViewPayments: boolean;
  canProcessRefunds: boolean;
  // Delivery
  canViewDelivery: boolean;
  canManageDelivery: boolean;
  canAssignDrivers: boolean;
  // Reports
  canViewReports: boolean;
  // Settings
  canViewSettings: boolean;
  canManageSettings: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  mobile: string;
  firstName: string;
  familyName: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  emirate: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences: UserPreferences;
  permissions?: StaffPermissions;
}

export interface UserPreferences {
  language: Language;
  currency: Currency;
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  mobile: string;
  password: string;
  firstName: string;
  familyName: string;
  emirate: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  email?: string;
  mobile?: string;
  firstName?: string;
  familyName?: string;
  emirate?: string;
  role?: UserRole;
  isActive?: boolean;
  preferences?: Partial<UserPreferences>;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expiresAt: string;
}

// =====================================================
// ADDRESS MANAGEMENT TYPES
// =====================================================

export interface Address {
  id: string;
  userId: string;
  label: string; // "Home", "Office", "Custom"
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
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressRequest {
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

export interface DeliveryZone {
  id: string;
  name: string;
  nameAr: string;
  emirate: string;
  areas: string[];
  deliveryFee: number;
  minimumOrder: number;
  estimatedMinutes: number;
  isActive: boolean;
  // Express delivery settings
  expressEnabled?: boolean;
  expressFee?: number;
  expressHours?: number;
}

// =====================================================
// PRODUCT & STOCK MANAGEMENT TYPES
// =====================================================

export interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  nameAr?: string;
  sku: string;
  barcode?: string;
  price: number;
  costPrice: number;
  discount?: number; // Discount percentage (0-100)
  category: string;
  description: string;
  descriptionAr?: string;
  image?: string;
  unit: "kg" | "piece" | "gram";
  minOrderQuantity: number;
  maxOrderQuantity: number;
  isActive: boolean;
  isFeatured: boolean;
  isPremium?: boolean; // Whether this product appears in Premium category
  rating?: number; // Product rating (0-5)
  tags: string[];
  badges?: ("halal" | "organic" | "grass-fed" | "premium" | "fresh" | "local")[];
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  id: string;
  productId: string;
  productName?: string;
  productNameAr?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastRestockedAt?: string;
  expiryDate?: string;
  batchNumber?: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: "in" | "out" | "adjustment" | "reserved" | "released";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  referenceType?: "order" | "return" | "waste" | "transfer" | "manual";
  referenceId?: string;
  performedBy: string;
  createdAt: string;
}

export interface UpdateStockRequest {
  productId: string;
  quantity: number;
  type: "in" | "out" | "adjustment";
  reason: string;
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  currentQuantity: number;
  threshold: number;
  reorderPoint: number;
  suggestedReorderQuantity: number;
}

// =====================================================
// ORDER MANAGEMENT TYPES
// =====================================================

export type OrderStatus = 
  | "pending"
  | "confirmed"
  | "processing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus = 
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "partially_refunded";

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productNameAr?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  
  // Items
  items: OrderItem[];
  
  // Pricing
  subtotal: number;
  discount: number;
  discountCode?: string;
  deliveryFee: number;
  vatAmount: number;
  vatRate: number;
  total: number;
  
  // Status
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "card" | "cod" | "bank_transfer";
  
  // Delivery
  addressId: string;
  deliveryAddress: Address;
  deliveryNotes?: string;
  deliveryZoneId?: string;
  estimatedDeliveryAt?: string;
  actualDeliveryAt?: string;
  
  // Tracking
  statusHistory: OrderStatusHistory[];
  
  // Metadata
  source: "web" | "mobile" | "phone" | "admin";
  ipAddress?: string;
  userAgent?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  changedBy: string;
  changedAt: string;
  notes?: string;
}

export interface CreateOrderRequest {
  userId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number; // Price per unit (already with discount applied)
    notes?: string;
  }[];
  addressId: string;
  deliveryAddress?: {
    fullName?: string;
    mobile?: string;
    emirate?: string;
    area?: string;
    street?: string;
    building?: string;
    floor?: string;
    apartment?: string;
    latitude?: number;
    longitude?: number;
  };
  paymentMethod: "card" | "cod" | "bank_transfer";
  deliveryNotes?: string;
  discountCode?: string;
  discountAmount?: number; // Promo code discount amount
  deliveryFee: number; // Zone delivery fee or express delivery fee
  isExpressDelivery?: boolean;
  driverTip?: number;
  subtotal: number; // Subtotal from checkout
  vatAmount: number; // VAT from checkout
  total: number; // Total from checkout
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  notes?: string;
}

// =====================================================
// PAYMENT TYPES
// =====================================================

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: Currency;
  method: "card" | "cod" | "bank_transfer";
  status: PaymentStatus;
  
  // Card details (masked)
  cardBrand?: string;
  cardLast4?: string;
  cardExpiryMonth?: number;
  cardExpiryYear?: number;
  
  // Gateway details
  gatewayTransactionId?: string;
  gatewayResponse?: string;
  
  // Refund details
  refundedAmount: number;
  refunds: PaymentRefund[];
  
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRefund {
  id: string;
  amount: number;
  reason: string;
  status: "pending" | "completed" | "failed";
  processedBy: string;
  createdAt: string;
}

export interface ProcessPaymentRequest {
  orderId: string;
  amount: number;
  method: "card" | "cod" | "bank_transfer";
  cardToken?: string;
  saveCard?: boolean;
}

export interface RefundPaymentRequest {
  paymentId: string;
  amount: number;
  reason: string;
}

export interface SavedCard {
  id: string;
  userId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  token: string;
  createdAt: string;
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export type NotificationType = 
  | "order_placed"
  | "order_confirmed"
  | "order_processing"
  | "order_ready"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "payment_received"
  | "payment_failed"
  | "refund_processed"
  | "low_stock"
  | "promotional";

export type NotificationChannel = "sms" | "email" | "push";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  messageAr?: string;
  status: "pending" | "sent" | "delivered" | "failed";
  sentAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  data: Record<string, unknown>;
}

export interface SMSNotificationPayload {
  to: string;
  message: string;
  messageAr?: string;
}

export interface EmailNotificationPayload {
  to: string;
  subject: string;
  subjectAr?: string;
  body: string;
  bodyAr?: string;
  template?: string;
  templateData?: Record<string, unknown>;
}

// =====================================================
// ANALYTICS & REPORTS TYPES
// =====================================================

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  itemCount: number;
  paymentStatus: PaymentStatus;
}

export interface LowStockItem {
  productId: string;
  productName: string;
  currentQuantity: number;
  threshold: number;
  reorderPoint: number;
  suggestedReorderQuantity: number;
}

export interface DashboardStats {
  // Revenue
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  
  // Orders
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  pendingOrders: number;
  
  // Customers
  totalCustomers: number;
  newCustomers: number;
  
  // Metrics
  averageOrderValue: number;
  lowStockCount: number;
  
  // Change percentages
  revenueChange: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  ordersChange: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  averageOrderValueChange: number;
  
  // Recent data
  recentOrders: RecentOrder[];
  lowStockItems: LowStockItem[];
}

export interface SalesReportData {
  period: string;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  totalDiscount: number;
  totalVat: number;
  totalDeliveryFees: number;
  netRevenue: number;
  costOfGoods: number;
  grossProfit: number;
  grossProfitMargin: number;
}

export interface SalesByCategory {
  category: string;
  totalSales: number;
  totalQuantity: number;
  percentage: number;
}

export interface SalesByProduct {
  productId: string;
  productName: string;
  totalSales: number;
  totalQuantity: number;
  averagePrice: number;
}

export interface SalesTimeSeries {
  date: string;
  sales: number;
  orders: number;
  customers: number;
}

export interface CustomerAnalytics {
  topCustomers: {
    userId: string;
    name: string;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate: string;
  }[];
  customersByEmirate: {
    emirate: string;
    count: number;
    percentage: number;
  }[];
  customerRetention: {
    period: string;
    newCustomers: number;
    returningCustomers: number;
    churnedCustomers: number;
  }[];
}

export interface InventoryReport {
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: LowStockAlert[];
  topSellingProducts: SalesByProduct[];
  slowMovingProducts: {
    productId: string;
    productName: string;
    daysSinceLastSale: number;
    currentStock: number;
    stockValue: number;
  }[];
  stockMovementSummary: {
    type: string;
    count: number;
    totalQuantity: number;
  }[];
}

export interface ReportExportRequest {
  reportType: "sales" | "orders" | "customers" | "inventory" | "products";
  format: "csv" | "excel" | "pdf";
  startDate: string;
  endDate: string;
  filters?: Record<string, unknown>;
}

// =====================================================
// DELIVERY TRACKING TYPES
// =====================================================

export interface DeliveryTracking {
  id: string;
  orderId: string;
  orderNumber: string;
  driverId?: string;
  driverName?: string;
  driverMobile?: string;
  status: "assigned" | "picked_up" | "in_transit" | "nearby" | "delivered" | "failed";
  currentLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  };
  estimatedArrival?: string;
  actualArrival?: string;
  deliveryProof?: {
    signature?: string;
    photo?: string;
    notes?: string;
  };
  timeline: {
    status: string;
    timestamp: string;
    location?: string;
    notes?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignDeliveryRequest {
  orderId: string;
  driverId: string;
  estimatedArrival?: string;
}

export interface UpdateDeliveryLocationRequest {
  trackingId: string;
  latitude: number;
  longitude: number;
}

export interface CompleteDeliveryRequest {
  trackingId: string;
  signature?: string;
  photo?: string;
  notes?: string;
}

// =====================================================
// DISCOUNT & PROMOTIONS TYPES
// =====================================================

export interface DiscountCode {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minimumOrder: number;
  maximumDiscount?: number;
  usageLimit: number;
  usageCount: number;
  userLimit: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  applicableProducts?: string[];
  applicableCategories?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ValidateDiscountRequest {
  code: string;
  orderTotal: number;
  productIds: string[];
}

export interface ValidateDiscountResponse {
  valid: boolean;
  discountAmount: number;
  message?: string;
}

// =====================================================
// SUPPLIER MANAGEMENT TYPES
// =====================================================

export type SupplierStatus = "active" | "inactive" | "pending" | "suspended";

export type SupplierPaymentTerms = "net_7" | "net_15" | "net_30" | "net_60" | "cod" | "prepaid";

export type PurchaseOrderStatus = 
  | "draft"
  | "pending"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export interface SupplierContact {
  id: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface SupplierAddress {
  street: string;
  city: string;
  emirate: string;
  country: string;
  postalCode: string;
}

export interface Supplier {
  id: string;
  code: string; // Unique supplier code (e.g., SUP-001)
  name: string;
  nameAr?: string;
  email: string;
  phone: string;
  website?: string;
  taxNumber?: string; // TRN or VAT number
  
  // Address
  address: SupplierAddress;
  
  // Contacts
  contacts: SupplierContact[];
  
  // Business Terms
  paymentTerms: SupplierPaymentTerms;
  currency: Currency;
  creditLimit: number;
  currentBalance: number;
  
  // Categories they supply
  categories: string[];
  
  // Ratings and Performance
  rating: number; // 1-5 stars
  onTimeDeliveryRate: number; // Percentage
  qualityScore: number; // Percentage
  totalOrders: number;
  totalSpent: number;
  
  // Status
  status: SupplierStatus;
  notes?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastOrderAt?: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  productName: string;
  supplierSku: string; // Supplier's own SKU
  unitCost: number;
  minimumOrderQuantity: number;
  leadTimeDays: number;
  isPreferred: boolean; // If this is the preferred supplier for this product
  lastPurchasePrice: number;
  lastPurchaseDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  supplierSku?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string; // PO-2026-0001
  supplierId: string;
  supplierName: string;
  
  // Items
  items: PurchaseOrderItem[];
  
  // Pricing
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  shippingCost: number;
  discount: number;
  total: number;
  
  // Status
  status: PurchaseOrderStatus;
  paymentStatus: "pending" | "partial" | "paid";
  
  // Dates
  orderDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  
  // Delivery
  deliveryAddress: string;
  deliveryNotes?: string;
  
  // Tracking
  trackingNumber?: string;
  
  // Approvals
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  
  // Notes
  internalNotes?: string;
  supplierNotes?: string;
  
  // History
  statusHistory: {
    status: PurchaseOrderStatus;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }[];
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  name: string;
  nameAr?: string;
  email: string;
  phone: string;
  website?: string;
  taxNumber?: string;
  address: SupplierAddress;
  contacts: Omit<SupplierContact, "id">[];
  paymentTerms: SupplierPaymentTerms;
  currency?: Currency;
  creditLimit?: number;
  categories: string[];
  notes?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxNumber?: string;
  address?: Partial<SupplierAddress>;
  paymentTerms?: SupplierPaymentTerms;
  currency?: Currency;
  creditLimit?: number;
  categories?: string[];
  status?: SupplierStatus;
  notes?: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  items: {
    productId: string;
    quantity: number;
    unitCost: number;
    notes?: string;
  }[];
  expectedDeliveryDate: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  shippingCost?: number;
  discount?: number;
  internalNotes?: string;
  supplierNotes?: string;
}

export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  pendingSuppliers: number;
  totalPurchaseOrders: number;
  pendingOrders: number;
  totalSpent: number;
  averageLeadTime: number;
  topCategories: { category: string; count: number }[];
}

// =====================================================
// FINANCE TYPES
// =====================================================

export type TransactionType = "sale" | "refund" | "expense" | "purchase" | "adjustment" | "payout";
export type TransactionStatus = "pending" | "completed" | "failed" | "cancelled";

// IFRS/IAS 1 Compliant Expense Categories (Nature-based)
export type ExpenseCategory =
  // Cost of Sales (COGS)
  | "inventory"           // Raw materials and goods
  | "direct_labor"        // Direct wages
  | "freight_in"          // Inbound shipping
  // Operating Expenses - Selling & Distribution
  | "marketing"           // Advertising, promotions
  | "delivery"            // Outbound shipping, delivery costs
  | "sales_commission"    // Sales commissions
  // Operating Expenses - Administrative
  | "salaries"            // Admin salaries & wages
  | "rent"                // Office/warehouse rent
  | "utilities"           // Electric, water, internet
  | "office_supplies"     // Stationery, supplies
  | "insurance"           // Business insurance
  | "professional_fees"   // Legal, accounting, consulting
  | "licenses_permits"    // Business licenses
  | "bank_charges"        // Bank fees, transaction costs
  // Fixed Asset Related
  | "equipment"           // Equipment purchases
  | "maintenance"         // Repairs & maintenance
  | "depreciation"        // Asset depreciation
  | "amortization"        // Intangible amortization
  // Finance Costs
  | "interest_expense"    // Loan interest
  | "finance_charges"     // Late fees, finance costs
  // Taxes & Government
  | "taxes"               // Non-VAT taxes
  | "government_fees"     // Govt charges, fines
  // Employee Benefits (IAS 19)
  | "employee_benefits"   // Health, pension, end of service
  | "training"            // Staff training
  | "travel"              // Business travel
  | "meals_entertainment" // Client entertainment
  // Other
  | "other";              // Miscellaneous

// Expense Function Classification (IAS 1 - By Function)
export type ExpenseFunction = "cost_of_sales" | "selling" | "administrative" | "finance" | "other_operating";

// Approval Status
export type ApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected" | "cancelled";

// Payment Terms
export type PaymentTerms = "immediate" | "net_7" | "net_15" | "net_30" | "net_45" | "net_60" | "net_90" | "eom" | "custom";

export type AccountType = "cash" | "bank" | "card_payments" | "cod_collections" | "petty_cash";

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: Currency;
  description: string;
  descriptionAr?: string;
  category?: ExpenseCategory;
  reference?: string;
  referenceType?: "order" | "payment" | "refund" | "purchase_order" | "expense" | "manual";
  referenceId?: string;
  accountId: string;
  accountName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}

export interface FinanceAccount {
  id: string;
  name: string;
  nameAr: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  isActive: boolean;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  lastReconciled?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceExpense {
  id: string;
  expenseNumber: string;
  
  // Classification (IFRS/IAS 1)
  category: ExpenseCategory;
  function?: ExpenseFunction;
  
  // Amounts
  grossAmount: number;
  vatAmount: number;
  vatRate: number;
  isVatRecoverable: boolean;
  withholdingTax: number;
  amount: number; // Net amount
  currency: Currency;
  exchangeRate?: number;
  baseCurrencyAmount?: number;
  
  // Description
  description: string;
  descriptionAr?: string;
  
  // Vendor/Supplier
  vendorId?: string;
  vendor?: string;
  vendorTrn?: string;
  
  // Invoice Details
  invoiceNumber?: string;
  invoiceDate?: string;
  receivedDate?: string;
  
  // Payment Terms
  paymentTerms?: PaymentTerms;
  dueDate?: string;
  earlyPaymentDiscount?: number;
  earlyPaymentDays?: number;
  daysOverdue?: number; // Computed field for aging
  
  // Payment Info
  paidAt?: string;
  paidAmount?: number;
  paymentReference?: string;
  paymentMethod?: "bank_transfer" | "cash" | "card" | "cheque";
  
  // Status & Workflow
  status: "pending" | "approved" | "paid" | "overdue" | "cancelled" | "reimbursed";
  approvalStatus?: ApprovalStatus;
  
  // Cost Allocation
  costCenterId?: string;
  costCenterName?: string;
  projectId?: string;
  projectName?: string;
  departmentId?: string;
  departmentName?: string;
  
  // GL Integration
  accountId?: string;
  glAccountCode?: string;
  journalEntryId?: string;
  
  // Approval Workflow
  createdBy: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  // Reimbursement
  isReimbursement?: boolean;
  employeeId?: string;
  reimbursedAt?: string;
  
  // Documentation
  attachments?: string[];
  notes?: string;
  internalNotes?: string;
  
  // Recurring
  isRecurring?: boolean;
  recurringFrequency?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  recurringEndDate?: string;
  parentExpenseId?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

// Cost Center
export interface CostCenter {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  parentId?: string;
  managerId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Expense Budget
export interface ExpenseBudget {
  id: string;
  name: string;
  periodType: "monthly" | "quarterly" | "yearly";
  startDate: string;
  endDate: string;
  category?: ExpenseCategory;
  costCenterId?: string;
  departmentId?: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentUsed: number; // Computed
  alertThreshold: number;
  isAlertSent: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Vendor/Supplier
export interface Vendor {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  city?: string;
  emirate?: string;
  country: string;
  trn?: string;
  tradeLicense?: string;
  defaultPaymentTerms: PaymentTerms;
  bankName?: string;
  bankAccountNumber?: string;
  bankIban?: string;
  bankSwift?: string;
  category?: "supplier" | "contractor" | "service_provider";
  expenseCategories?: ExpenseCategory[];
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Expense Approval Rule
export interface ExpenseApprovalRule {
  id: string;
  name: string;
  minAmount: number;
  maxAmount?: number;
  category?: ExpenseCategory;
  costCenterId?: string;
  approverLevel: number;
  approverId?: string;
  approverRole?: string;
  requiresAllApprovers: boolean;
  autoApproveBelow?: number;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// Aging Report
export interface AgingReport {
  asOfDate: string;
  summary: {
    current: number;    // Not yet due
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90Days: number;
    total: number;
  };
  byVendor: {
    vendorId: string;
    vendorName: string;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90Days: number;
    total: number;
  }[];
  details: {
    expenseId: string;
    expenseNumber: string;
    vendorName: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    paidAmount: number;
    balance: number;
    daysOverdue: number;
    agingBucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
  }[];
}

export interface FinanceSummary {
  period: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossProfitMargin: number;
  totalExpenses: number;
  netProfit: number;
  netProfitMargin: number;
  totalRefunds: number;
  totalVAT: number;
  vatCollected: number;
  vatPaid: number;
  vatDue: number;
  cashFlow: {
    inflow: number;
    outflow: number;
    net: number;
  };
  revenueByPaymentMethod: {
    method: string;
    amount: number;
    count: number;
  }[];
  expensesByCategory: {
    category: ExpenseCategory;
    amount: number;
    count: number;
  }[];
  accountBalances: {
    accountId: string;
    accountName: string;
    balance: number;
  }[];
}

export interface ProfitLossReport {
  period: string;
  startDate: string;
  endDate: string;
  revenue: {
    sales: number;
    otherIncome: number;
    totalRevenue: number;
  };
  costOfGoodsSold: {
    inventoryCost: number;
    supplierPurchases: number;
    totalCOGS: number;
  };
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: {
    category: ExpenseCategory;
    amount: number;
  }[];
  totalOperatingExpenses: number;
  operatingProfit: number;
  otherExpenses: {
    vatPaid: number;
    refunds: number;
    totalOther: number;
  };
  netProfit: number;
  netProfitMargin: number;
}

export interface CashFlowReport {
  period: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  operatingActivities: {
    cashFromSales: number;
    cashFromCOD: number;
    cashFromRefunds: number;
    cashToSuppliers: number;
    cashToExpenses: number;
    netOperating: number;
  };
  investingActivities: {
    equipmentPurchases: number;
    netInvesting: number;
  };
  financingActivities: {
    ownerDrawings: number;
    capitalInjection: number;
    netFinancing: number;
  };
  netCashFlow: number;
  dailyCashFlow: {
    date: string;
    inflow: number;
    outflow: number;
    net: number;
    balance: number;
  }[];
}

export interface VATReport {
  period: string;
  startDate: string;
  endDate: string;
  salesVAT: {
    taxableAmount: number;
    vatAmount: number;
    exemptAmount: number;
  };
  purchasesVAT: {
    taxableAmount: number;
    vatAmount: number;
  };
  vatDue: number;
  vatRefund: number;
  netVAT: number;
  transactionDetails: {
    date: string;
    type: "sale" | "purchase";
    reference: string;
    taxableAmount: number;
    vatAmount: number;
    vatRate: number;
  }[];
}

export interface CreateExpenseRequest {
  // Required fields
  category: ExpenseCategory;
  grossAmount: number;
  description: string;
  
  // Classification
  function?: ExpenseFunction;
  
  // VAT
  vatAmount?: number;
  vatRate?: number;
  isVatRecoverable?: boolean;
  withholdingTax?: number;
  
  // Optional fields
  descriptionAr?: string;
  vendorId?: string;
  vendor?: string;
  vendorTrn?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  receivedDate?: string;
  
  // Payment Terms
  paymentTerms?: PaymentTerms;
  dueDate?: string;
  
  // Cost Allocation
  costCenterId?: string;
  costCenterName?: string;
  projectId?: string;
  projectName?: string;
  departmentId?: string;
  departmentName?: string;
  
  // GL
  accountId?: string;
  glAccountCode?: string;
  
  // Reimbursement
  isReimbursement?: boolean;
  employeeId?: string;
  
  // Documentation
  notes?: string;
  attachments?: string[];
  
  // Recurring
  isRecurring?: boolean;
  recurringFrequency?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  recurringEndDate?: string;
}

// Create Vendor Request
export interface CreateVendorRequest {
  name: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  emirate?: string;
  country?: string;
  trn?: string;
  tradeLicense?: string;
  defaultPaymentTerms?: PaymentTerms;
  bankName?: string;
  bankAccountNumber?: string;
  bankIban?: string;
  bankSwift?: string;
  category?: "supplier" | "contractor" | "service_provider";
  openingBalance?: number;
  notes?: string;
}

// Create Budget Request
export interface CreateBudgetRequest {
  name: string;
  periodType: "monthly" | "quarterly" | "yearly";
  startDate: string;
  endDate: string;
  category?: ExpenseCategory;
  costCenterId?: string;
  departmentId?: string;
  budgetAmount: number;
  alertThreshold?: number;
}

// Create Cost Center Request
export interface CreateCostCenterRequest {
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  parentId?: string;
  managerId?: string;
}

// =====================================================
// DEMO RESPONSE (backward compatibility)
// =====================================================

export interface DemoResponse {
  message: string;
}
