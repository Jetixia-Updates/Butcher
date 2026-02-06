/**
 * Orders Management Tab
 * View, filter, and manage all orders
 */

import React, { useCallback, useEffect, useState } from "react";
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
  UserPlus,
  DollarSign,
} from "lucide-react";
import { ordersApi, deliveryApi } from "@/lib/api";
import type { Order, OrderStatus } from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications, createUserOrderNotification, createDeliveryNotification } from "@/context/NotificationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

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
    estimatedDelivery: "Estimated Delivery",
    orderTime: "Order Time",
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
    assignDriver: "Assign Driver",
    paymentReceived: "Payment Received",
    confirmPayment: "Confirm Payment",
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
    estimatedDelivery: "التوصيل المتوقع",
    orderTime: "وقت الطلب",
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
    assignDriver: "تعيين سائق",
    paymentReceived: "تم استلام الدفع",
    confirmPayment: "تأكيد الدفع",
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
    assign_driver: "assignDriver",
    payment_received: "paymentReceived",
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
  { value: "ready_for_pickup", labelKey: "readyForPickup" },
  { value: "out_for_delivery", labelKey: "outForDelivery" },
  { value: "delivered", labelKey: "delivered" },
  { value: "cancelled", labelKey: "cancelled" },
];

const STATUS_ACTIONS: Record<OrderStatus, (OrderStatus | "assign_driver")[]> = {
  pending: ["confirmed", "processing", "ready_for_pickup", "cancelled"],
  confirmed: ["processing", "ready_for_pickup", "cancelled"],
  processing: ["ready_for_pickup", "out_for_delivery", "delivered", "cancelled"],
  ready_for_pickup: ["assign_driver", "out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "ready_for_pickup", "cancelled"],
  delivered: ["refunded"],
  cancelled: ["pending"],
  refunded: [],
};

// Define the natural order flow - one step at a time
const NEXT_STATUS_MAP: Record<OrderStatus, OrderStatus | "assign_driver" | null> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "ready_for_pickup",
  ready_for_pickup: "assign_driver", // Goes to delivery assignment
  out_for_delivery: "delivered",
  delivered: null, // Final state
  cancelled: null,
  refunded: null,
};

export function OrdersTab({ onNavigate, selectedOrderId, onClearSelection }: AdminTabProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const t = translations[language];
  const { addUserNotification } = useNotifications();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Fetch orders with optional status filter
  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const params: { status?: string } = {};
    if (statusFilter !== "all") params.status = statusFilter;

    try {
      const response = await ordersApi.getAll(params);
      if (response.success && response.data) {
        setOrders(response.data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [statusFilter]);

  // Initial fetch and polling
  useEffect(() => {
    fetchOrders(true);

    // Set up polling for real-time updates (every 5 seconds)
    const interval = setInterval(() => {
      fetchOrders(false); // Fetch silently in background
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

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

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus | "assign_driver") => {
    console.log(`[OrdersTab] handleStatusUpdate called: orderId=${orderId}, newStatus=${newStatus}, user=${user?.id}`);

    if (!user?.id) {
      console.error(`[OrdersTab] ❌ No user ID available. Cannot update order.`);
      toast({
        title: "Error",
        description: "User not logged in. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    // Handle special "assign_driver" action - navigate to delivery tab
    if (newStatus === "assign_driver") {
      setUpdating(orderId);
      const response = await ordersApi.updateStatus(orderId, "ready_for_pickup", user.id);

      if (response.success && response.data) {
        toast({
          title: "Status Updated",
          description: "Order marked as ready for pickup",
        });

        // Update local state immediately with the updated order
        const updatedOrder = response.data;
        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

        // Close modal and navigate to delivery tab
        setSelectedOrder(null);
        if (onNavigate) {
          onNavigate("delivery", orderId);
        }
      } else {
        toast({
          title: "Update Failed",
          description: response.error || "Failed to update order status",
          variant: "destructive",
        });
      }
      setUpdating(null);
      return;
    }

    setUpdating(orderId);
    console.log(`[OrdersTab] Updating order ${orderId} to status: ${newStatus}, user: ${user.id}`);

    try {
      const response = await ordersApi.updateStatus(orderId, newStatus, user.id);

      if (response.success && response.data) {
        // Show success notification
        toast({
          title: "Status Updated",
          description: `Order status changed to ${getStatusLabel(newStatus, t)}`,
        });

        // Update local state immediately with the response data
        // This is more robust than refetching all orders and avoids race conditions
        const updatedOrder = response.data;
        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

        // Send notification to the customer about the status change
        const order = orders.find(o => o.id === orderId);
        if (order?.userId) {
          const statusToNotifMap: Record<string, "placed" | "confirmed" | "preparing" | "ready" | "outForDelivery" | "delivered" | "cancelled"> = {
            confirmed: "confirmed",
            processing: "preparing",
            ready_for_pickup: "ready",
            out_for_delivery: "outForDelivery",
            delivered: "delivered",
            cancelled: "cancelled",
          };
          const notifStatus = statusToNotifMap[newStatus];
          if (notifStatus) {
            addUserNotification(order.userId, createUserOrderNotification(order.orderNumber || orderId, notifStatus));
          }
        }

        // Close modal immediately
        setSelectedOrder(null);
      } else {
        toast({
          title: "Update Failed",
          description: response.error || "Failed to update order status",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Exception during status update:", err);
      toast({
        title: "Update Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
    setUpdating(null);
  };

  // Handle COD payment confirmation
  const handleConfirmPayment = async (orderId: string) => {
    setUpdating(orderId);
    try {
      const response = await ordersApi.updatePaymentStatus(orderId, "captured", user?.id);

      if (response.success) {
        toast({
          title: t.paymentReceived,
          description: `${t.confirmPayment} ✅`,
        });
        await fetchOrders();
        if (selectedOrder?.id === orderId) {
          const orderResponse = await ordersApi.getById(orderId);
          if (orderResponse.success && orderResponse.data) {
            setSelectedOrder(orderResponse.data);
          }
        }
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to confirm payment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast({
        title: "Error",
        description: "Failed to confirm payment",
        variant: "destructive",
      });
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
          onClick={() => fetchOrders(true)}
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
          <div className="flex gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap">
            {ORDER_STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={cn(
                  "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
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
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-right" : "text-left")}>
                    {t.order}
                  </th>
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:table-cell", isRTL ? "text-right" : "text-left")}>
                    {t.customer}
                  </th>
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden lg:table-cell", isRTL ? "text-right" : "text-left")}>
                    {t.items}
                  </th>
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-right" : "text-left")}>
                    {t.total}
                  </th>
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-right" : "text-left")}>
                    {t.status}
                  </th>
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden md:table-cell", isRTL ? "text-right" : "text-left")}>
                    {t.payment}
                  </th>
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden md:table-cell", isRTL ? "text-right" : "text-left")}>
                    {t.date}
                  </th>
                  <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-left" : "text-right")}>
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div>
                        <span className="font-mono text-xs sm:text-sm font-medium text-blue-600">
                          {order.orderNumber}
                        </span>
                        <p className="text-xs text-slate-400 mt-0.5 md:hidden">
                          {new Date(order.createdAt).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE')} • {new Date(order.createdAt).toLocaleTimeString(isRTL ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {order.customerMobile}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-500 hidden lg:table-cell">
                      {order.items.length} {t.items.toLowerCase()}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-slate-900">
                      <span className="flex items-center gap-1">
                        <CurrencySymbol size="sm" />
                        {Number(order.total).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <OrderStatusBadge status={order.status} t={t} />
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <div>
                        <PaymentStatusBadge status={order.paymentStatus} t={t} />
                        <p className="text-xs text-slate-500 mt-1 capitalize">
                          {order.paymentMethod}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-500 hidden md:table-cell">
                      <div>
                        <p>{new Date(order.createdAt).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE')}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString(isRTL ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className={cn("flex items-center gap-1 sm:gap-2", isRTL ? "justify-start" : "justify-end")}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 sm:p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title={t.viewDetails}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {NEXT_STATUS_MAP[order.status] && (
                          <NextStepButton
                            orderId={order.id}
                            currentStatus={order.status}
                            nextStatus={NEXT_STATUS_MAP[order.status]!}
                            onUpdate={handleStatusUpdate}
                            updating={updating === order.id}
                            t={t}
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
          onConfirmPayment={() => handleConfirmPayment(selectedOrder.id)}
          updating={updating === selectedOrder.id}
          t={t}
          isRTL={isRTL}
        />
      )}
    </div>
  );
}

// Simple Next Step button - automatically advances to the next status
function NextStepButton({
  orderId,
  currentStatus,
  nextStatus,
  onUpdate,
  updating,
  t,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  nextStatus: OrderStatus | "assign_driver";
  onUpdate: (orderId: string, status: OrderStatus | "assign_driver") => void;
  updating: boolean;
  t: typeof translations.en;
}) {
  const getNextStatusLabel = () => {
    // Show what the button will do
    switch (nextStatus) {
      case "confirmed":
        return t.confirmed;
      case "processing":
        return t.processing;
      case "ready_for_pickup":
        return t.readyForPickup;
      case "assign_driver":
        return t.assignDriver;
      case "out_for_delivery":
        return t.outForDelivery;
      case "delivered":
        return t.delivered;
      default:
        return getStatusLabel(nextStatus, t);
    }
  };

  const getButtonIcon = () => {
    switch (nextStatus) {
      case "confirmed":
        return <Check className="w-4 h-4" />;
      case "processing":
        return <Package className="w-4 h-4" />;
      case "ready_for_pickup":
        return <Package className="w-4 h-4" />;
      case "assign_driver":
        return <UserPlus className="w-4 h-4" />;
      case "out_for_delivery":
        return <Truck className="w-4 h-4" />;
      case "delivered":
        return <Check className="w-4 h-4" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  return (
    <button
      onClick={() => onUpdate(orderId, nextStatus)}
      disabled={updating}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs sm:text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {updating ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {getButtonIcon()}
          <span className="hidden sm:inline">{getNextStatusLabel()}</span>
        </>
      )}
    </button>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  onStatusUpdate,
  onConfirmPayment,
  updating,
  t,
  isRTL,
}: {
  order: Order;
  onClose: () => void;
  onStatusUpdate: (status: OrderStatus | "assign_driver") => void;
  onConfirmPayment?: () => void;
  updating: boolean;
  t: typeof translations.en;
  isRTL: boolean;
}) {
  // Check if COD payment confirmation should be shown
  // Show when order is delivered, payment method is COD, and payment is still pending
  const showCodPaymentConfirmation =
    order.status === "delivered" &&
    order.paymentMethod === "cod" &&
    order.paymentStatus === "pending";

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
            <div>
              <p className="text-xs text-slate-500 mb-1">{t.orderTime}</p>
              <span className="text-sm font-medium">
                {new Date(order.createdAt).toLocaleTimeString(isRTL ? 'ar-AE' : 'en-AE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            </div>
            {order.estimatedDeliveryAt && (
              <div>
                <p className="text-xs text-slate-500 mb-1">{t.estimatedDelivery}</p>
                <span className="text-sm font-medium">
                  {new Date(order.estimatedDeliveryAt).toLocaleString(isRTL ? 'ar-AE' : 'en-AE', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </span>
              </div>
            )}
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
                  {Number(order.subtotal).toFixed(2)}
                </span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span>{t.discount}</span>
                  <span className="flex items-center gap-1">
                    -<CurrencySymbol size="sm" />
                    {Number(order.discount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t.deliveryFee}</span>
                <span className="flex items-center gap-1">
                  <CurrencySymbol size="sm" />
                  {Number(order.deliveryFee).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{t.vat} ({(Number(order.vatRate) * 100).toFixed(0)}%)</span>
                <span className="flex items-center gap-1">
                  <CurrencySymbol size="sm" />
                  {Number(order.vatAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-slate-300">
                <span>{t.total}</span>
                <span className="flex items-center gap-1">
                  <CurrencySymbol size="md" />
                  {Number(order.total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Status Actions - Single Next Step Button */}
          {NEXT_STATUS_MAP[order.status] && (
            <div className="flex flex-wrap gap-3">
              {/* Next Step Button */}
              <button
                onClick={() => onStatusUpdate(NEXT_STATUS_MAP[order.status]!)}
                disabled={updating}
                className={cn(
                  "flex-1 min-w-[200px] py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2",
                  NEXT_STATUS_MAP[order.status] === "assign_driver"
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-primary text-white hover:bg-primary/90"
                )}
              >
                {NEXT_STATUS_MAP[order.status] === "confirmed" && <Check className="w-4 h-4" />}
                {NEXT_STATUS_MAP[order.status] === "processing" && <Package className="w-4 h-4" />}
                {NEXT_STATUS_MAP[order.status] === "ready_for_pickup" && <Package className="w-4 h-4" />}
                {NEXT_STATUS_MAP[order.status] === "assign_driver" && <UserPlus className="w-4 h-4" />}
                {NEXT_STATUS_MAP[order.status] === "out_for_delivery" && <Truck className="w-4 h-4" />}
                {NEXT_STATUS_MAP[order.status] === "delivered" && <Check className="w-4 h-4" />}
                {updating ? t.updating : (
                  NEXT_STATUS_MAP[order.status] === "assign_driver"
                    ? t.assignDriver
                    : `${t.markAs} ${getStatusLabel(NEXT_STATUS_MAP[order.status]!, t)}`
                )}
              </button>

              {/* Cancel Button - Only show for non-final statuses */}
              {!["delivered", "cancelled", "refunded"].includes(order.status) && (
                <button
                  onClick={() => onStatusUpdate("cancelled")}
                  disabled={updating}
                  className="min-w-[120px] py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 bg-red-100 text-red-700 hover:bg-red-200"
                >
                  <X className="w-4 h-4" />
                  {updating ? t.updating : `${t.markAs} ${t.cancelled}`}
                </button>
              )}
            </div>
          )}

          {/* COD Payment Confirmation - Only admin can confirm after delivery */}
          {showCodPaymentConfirmation && onConfirmPayment && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">{t.confirmPayment}</p>
                    <p className="text-sm text-amber-600">COD - {Number(order.total).toFixed(2)} AED</p>
                  </div>
                </div>
                <button
                  onClick={onConfirmPayment}
                  disabled={updating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {t.paymentReceived}
                </button>
              </div>
            </div>
          )}

          {/* Status History */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">{t.statusHistory}</h3>
            <div className="space-y-2">
              {order.statusHistory.map((history, idx) => (
                <div key={idx} className="text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                    <span className="font-medium">
                      {getStatusLabel(history.status, t)}
                    </span>
                    <span className="text-slate-500">
                      {new Date(history.changedAt).toLocaleString(isRTL ? 'ar-AE' : 'en-AE')}
                    </span>
                    <span className="text-slate-400">{t.by} {history.changedBy}</span>
                  </div>
                  {history.notes && (
                    <p className="text-xs text-slate-500 mt-0.5" style={{ marginLeft: isRTL ? 0 : '1.25rem', marginRight: isRTL ? '1.25rem' : 0 }}>
                      📝 {history.notes}
                    </p>
                  )}
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
