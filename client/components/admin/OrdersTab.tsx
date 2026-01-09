/**
 * Orders Management Tab
 * View, filter, and manage all orders
 */

import React, { useEffect, useState } from "react";
import {
  Search,
  Filter,
  Eye,
  Check,
  X,
  Truck,
  ChevronDown,
  RefreshCw,
  Package,
} from "lucide-react";
import { ordersApi } from "@/lib/api";
import type { Order, OrderStatus } from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
  selectedOrderId?: string | null;
  onClearSelection?: () => void;
}

const translations = {
  en: {
    ordersManagement: "Orders Management",
    totalOrders: "total orders",
    refresh: "Refresh",
    searchPlaceholder: "Search by order #, customer name, or phone...",
    noOrdersFound: "No orders found",
    order: "Order",
    customer: "Customer",
    items: "Items",
    total: "Total",
    status: "Status",
    payment: "Payment",
    date: "Date",
    actions: "Actions",
    viewDetails: "View Details",
    update: "Update",
    updating: "Updating...",
    markAs: "Mark as",
    createdOn: "Created on",
    orderStatus: "Order Status",
    paymentStatus: "Payment Status",
    paymentMethod: "Payment Method",
    customerInformation: "Customer Information",
    name: "Name",
    mobile: "Mobile",
    email: "Email",
    deliveryAddress: "Delivery Address",
    landmark: "Landmark",
    notes: "Notes",
    orderItems: "Order Items",
    product: "Product",
    qty: "Qty",
    price: "Price",
    subtotal: "Subtotal",
    discount: "Discount",
    deliveryFee: "Delivery Fee",
    vat: "VAT",
    statusHistory: "Status History",
    by: "by",
    // Status labels
    allOrders: "All Orders",
    pending: "Pending",
    confirmed: "Confirmed",
    processing: "Processing",
    readyForPickup: "Ready for Pickup",
    outForDelivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
    // Payment status labels
    authorized: "Authorized",
    captured: "Captured",
    failed: "Failed",
    partiallyRefunded: "Partially Refunded",
  },
  ar: {
    ordersManagement: "إدارة الطلبات",
    totalOrders: "إجمالي الطلبات",
    refresh: "تحديث",
    searchPlaceholder: "البحث برقم الطلب، اسم العميل، أو الهاتف...",
    noOrdersFound: "لم يتم العثور على طلبات",
    order: "الطلب",
    customer: "العميل",
    items: "العناصر",
    total: "المجموع",
    status: "الحالة",
    payment: "الدفع",
    date: "التاريخ",
    actions: "الإجراءات",
    viewDetails: "عرض التفاصيل",
    update: "تحديث",
    updating: "جاري التحديث...",
    markAs: "تحديد كـ",
    createdOn: "تم الإنشاء في",
    orderStatus: "حالة الطلب",
    paymentStatus: "حالة الدفع",
    paymentMethod: "طريقة الدفع",
    customerInformation: "معلومات العميل",
    name: "الاسم",
    mobile: "الجوال",
    email: "البريد الإلكتروني",
    deliveryAddress: "عنوان التوصيل",
    landmark: "علامة مميزة",
    notes: "ملاحظات",
    orderItems: "عناصر الطلب",
    product: "المنتج",
    qty: "الكمية",
    price: "السعر",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    deliveryFee: "رسوم التوصيل",
    vat: "ضريبة القيمة المضافة",
    statusHistory: "سجل الحالات",
    by: "بواسطة",
    // Status labels
    allOrders: "جميع الطلبات",
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    processing: "قيد المعالجة",
    readyForPickup: "جاهز للاستلام",
    outForDelivery: "في الطريق للتوصيل",
    delivered: "تم التوصيل",
    cancelled: "ملغي",
    refunded: "مسترد",
    // Payment status labels
    authorized: "مصرح",
    captured: "تم الدفع",
    failed: "فشل",
    partiallyRefunded: "مسترد جزئياً",
  },
};

const getStatusLabel = (status: string, t: typeof translations.en): string => {
  const statusMap: Record<string, keyof typeof translations.en> = {
    all: "allOrders",
    pending: "pending",
    confirmed: "confirmed",
    processing: "processing",
    ready_for_pickup: "readyForPickup",
    out_for_delivery: "outForDelivery",
    delivered: "delivered",
    cancelled: "cancelled",
    refunded: "refunded",
    authorized: "authorized",
    captured: "captured",
    failed: "failed",
    partially_refunded: "partiallyRefunded",
  };
  const key = statusMap[status];
  return key ? (t[key] as string) : status.replace(/_/g, " ");
};

const ORDER_STATUSES: { value: OrderStatus | "all"; labelKey: keyof typeof translations.en }[] = [
  { value: "all", labelKey: "allOrders" },
  { value: "pending", labelKey: "pending" },
  { value: "confirmed", labelKey: "confirmed" },
  { value: "processing", labelKey: "processing" },
  { value: "out_for_delivery", labelKey: "outForDelivery" },
  { value: "delivered", labelKey: "delivered" },
  { value: "cancelled", labelKey: "cancelled" },
];

const STATUS_ACTIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["out_for_delivery", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function OrdersTab({ onNavigate, selectedOrderId, onClearSelection }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = translations[language];
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const params: { status?: string } = {};
    if (statusFilter !== "all") params.status = statusFilter;

    const response = await ordersApi.getAll(params);
    if (response.success && response.data) {
      setOrders(response.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  // Auto-select order when selectedOrderId is provided (e.g., from notification click)
  useEffect(() => {
    if (selectedOrderId && orders.length > 0) {
      const order = orders.find((o) => o.id === selectedOrderId);
      if (order) {
        setSelectedOrder(order);
        if (onClearSelection) {
          onClearSelection(); // Clear the selection after opening
        }
      }
    }
  }, [selectedOrderId, orders, onClearSelection]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(orderId);
    const response = await ordersApi.updateStatus(orderId, newStatus);
    if (response.success) {
      await fetchOrders();
      if (selectedOrder?.id === orderId && response.data) {
        setSelectedOrder(response.data);
      }
    }
    setUpdating(null);
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.customerMobile.includes(query)
    );
  });

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.ordersManagement}</h3>
          <p className="text-sm text-slate-500">
            {orders.length} {t.totalOrders}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {t.refresh}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400", isRTL ? "right-3" : "left-3")} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none", isRTL ? "pr-10 pl-4" : "pl-10 pr-4")}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {ORDER_STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  statusFilter === status.value
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {t[status.labelKey]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t.noOrdersFound}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.order}
                  </th>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.customer}
                  </th>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.items}
                  </th>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.total}
                  </th>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.status}
                  </th>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.payment}
                  </th>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.date}
                  </th>
                  <th className={cn("px-6 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-left" : "text-right")}>
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-blue-600">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {order.customerMobile}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {order.items.length} {t.items.toLowerCase()}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      <span className="flex items-center gap-1">
                        <CurrencySymbol size="sm" />
                        {order.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <OrderStatusBadge status={order.status} t={t} />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <PaymentStatusBadge status={order.paymentStatus} t={t} />
                        <p className="text-xs text-slate-500 mt-1 capitalize">
                          {order.paymentMethod}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE')}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn("flex items-center gap-2", isRTL ? "justify-start" : "justify-end")}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title={t.viewDetails}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {STATUS_ACTIONS[order.status]?.length > 0 && (
                          <StatusDropdown
                            orderId={order.id}
                            currentStatus={order.status}
                            availableStatuses={STATUS_ACTIONS[order.status]}
                            onUpdate={handleStatusUpdate}
                            updating={updating === order.id}
                            t={t}
                            isRTL={isRTL}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={(status) => handleStatusUpdate(selectedOrder.id, status)}
          updating={updating === selectedOrder.id}
          t={t}
          isRTL={isRTL}
        />
      )}
    </div>
  );
}

function StatusDropdown({
  orderId,
  currentStatus,
  availableStatuses,
  onUpdate,
  updating,
  t,
  isRTL,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  availableStatuses: OrderStatus[];
  onUpdate: (orderId: string, status: OrderStatus) => void;
  updating: boolean;
  t: typeof translations.en;
  isRTL: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={updating}
        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
      >
        {updating ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {t.update}
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className={cn("absolute mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-20", isRTL ? "left-0" : "right-0")}>
            {availableStatuses.map((status) => (
              <button
                key={status}
                onClick={() => {
                  onUpdate(orderId, status);
                  setOpen(false);
                }}
                className={cn("w-full px-4 py-2 text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2", isRTL ? "text-right flex-row-reverse" : "text-left")}
              >
                {status === "cancelled" ? (
                  <X className="w-4 h-4 text-red-500" />
                ) : status === "delivered" ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : status === "out_for_delivery" ? (
                  <Truck className="w-4 h-4 text-blue-500" />
                ) : (
                  <Package className="w-4 h-4 text-slate-500" />
                )}
                <span>{getStatusLabel(status, t)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  onStatusUpdate,
  updating,
  t,
  isRTL,
}: {
  order: Order;
  onClose: () => void;
  onStatusUpdate: (status: OrderStatus) => void;
  updating: boolean;
  t: typeof translations.en;
  isRTL: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {t.order} {order.orderNumber}
            </h2>
            <p className="text-sm text-slate-500">
              {t.createdOn} {new Date(order.createdAt).toLocaleString(isRTL ? 'ar-AE' : 'en-AE')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Payment */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">{t.orderStatus}</p>
              <OrderStatusBadge status={order.status} t={t} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t.paymentStatus}</p>
              <PaymentStatusBadge status={order.paymentStatus} t={t} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t.paymentMethod}</p>
              <span className="text-sm font-medium capitalize">{order.paymentMethod}</span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">{t.customerInformation}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">{t.name}</p>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-slate-500">{t.mobile}</p>
                <p className="font-medium">{order.customerMobile}</p>
              </div>
              <div>
                <p className="text-slate-500">{t.email}</p>
                <p className="font-medium">{order.customerEmail}</p>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-3">{t.deliveryAddress}</h3>
            <p className="text-sm text-slate-700">
              {order.deliveryAddress.building}, {order.deliveryAddress.street}
              <br />
              {order.deliveryAddress.area}, {order.deliveryAddress.emirate}
              {order.deliveryAddress.landmark && (
                <>
                  <br />
                  <span className="text-slate-500">{t.landmark}: {order.deliveryAddress.landmark}</span>
                </>
              )}
            </p>
            {order.deliveryNotes && (
              <p className="text-sm text-slate-500 mt-2">
                <strong>{t.notes}:</strong> {order.deliveryNotes}
              </p>
            )}
          </div>

          {/* Order Items */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">{t.orderItems}</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={cn("px-4 py-2 text-xs font-semibold text-slate-500", isRTL ? "text-right" : "text-left")}>
                      {t.product}
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500">
                      {t.qty}
                    </th>
                    <th className={cn("px-4 py-2 text-xs font-semibold text-slate-500", isRTL ? "text-left" : "text-right")}>
                      {t.price}
                    </th>
                    <th className={cn("px-4 py-2 text-xs font-semibold text-slate-500", isRTL ? "text-left" : "text-right")}>
                      {t.total}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm">{item.productName}</td>
                      <td className="px-4 py-3 text-sm text-center">{item.quantity}</td>
                      <td className={cn("px-4 py-3 text-sm", isRTL ? "text-left" : "text-right")}>
                        <span className={cn("flex items-center gap-1", isRTL ? "justify-start" : "justify-end")}>
                          <CurrencySymbol size="sm" />
                          {item.unitPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className={cn("px-4 py-3 text-sm font-medium", isRTL ? "text-left" : "text-right")}>
                        <span className={cn("flex items-center gap-1", isRTL ? "justify-start" : "justify-end")}>
                          <CurrencySymbol size="sm" />
                          {item.totalPrice.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t.subtotal}</span>
                <span className="flex items-center gap-1">
                  <CurrencySymbol size="sm" />
                  {order.subtotal.toFixed(2)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span>{t.discount}</span>
                  <span className="flex items-center gap-1">
                    -<CurrencySymbol size="sm" />
                    {order.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t.deliveryFee}</span>
                <span className="flex items-center gap-1">
                  <CurrencySymbol size="sm" />
                  {order.deliveryFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t.vat} ({(order.vatRate * 100).toFixed(0)}%)</span>
                <span className="flex items-center gap-1">
                  <CurrencySymbol size="sm" />
                  {order.vatAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-slate-300">
                <span>{t.total}</span>
                <span className="flex items-center gap-1">
                  <CurrencySymbol size="md" />
                  {order.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Status Actions */}
          {STATUS_ACTIONS[order.status]?.length > 0 && (
            <div className="flex gap-3">
              {STATUS_ACTIONS[order.status].map((status) => (
                <button
                  key={status}
                  onClick={() => onStatusUpdate(status)}
                  disabled={updating}
                  className={cn(
                    "flex-1 py-3 rounded-lg font-medium transition-colors disabled:opacity-50",
                    status === "cancelled"
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {updating ? t.updating : `${t.markAs} ${getStatusLabel(status, t)}`}
                </button>
              ))}
            </div>
          )}

          {/* Status History */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">{t.statusHistory}</h3>
            <div className="space-y-2">
              {order.statusHistory.map((history, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="font-medium">
                    {getStatusLabel(history.status, t)}
                  </span>
                  <span className="text-slate-500">
                    {new Date(history.changedAt).toLocaleString(isRTL ? 'ar-AE' : 'en-AE')}
                  </span>
                  <span className="text-slate-400">{t.by} {history.changedBy}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderStatusBadge({ status, t }: { status: string; t: typeof translations.en }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    processing: "bg-purple-100 text-purple-700",
    ready_for_pickup: "bg-cyan-100 text-cyan-700",
    out_for_delivery: "bg-indigo-100 text-indigo-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    refunded: "bg-orange-100 text-orange-700",
  };

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-xs font-medium",
      styles[status] || "bg-slate-100 text-slate-700"
    )}>
      {getStatusLabel(status, t)}
    </span>
  );
}

function PaymentStatusBadge({ status, t }: { status: string; t: typeof translations.en }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    authorized: "bg-blue-100 text-blue-700",
    captured: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-orange-100 text-orange-700",
    partially_refunded: "bg-orange-100 text-orange-700",
  };

  return (
    <span className={cn(
      "px-2 py-1 rounded-full text-xs font-medium",
      styles[status] || "bg-slate-100 text-slate-700"
    )}>
      {getStatusLabel(status, t)}
    </span>
  );
}
