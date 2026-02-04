import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck,
  ChevronRight,
  ChevronDown,
  Download,
  RotateCcw,
  Search,
  Filter,
  MapPin,
  RefreshCw
} from "lucide-react";
import { useOrders, CustomerOrder } from "@/context/OrdersContext";
import { useBasket } from "@/context/BasketContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { cn } from "@/lib/utils";

export default function OrdersPage() {
  const navigate = useNavigate();
  const { orders, isLoading, cancelOrder, fetchOrders } = useOrders();
  const { addItem } = useBasket();
  const { user, isLoggedIn, isAuthLoading } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      navigate("/login");
    }
  }, [isLoggedIn, isAuthLoading, navigate]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchOrders();
    }
  }, [fetchOrders, isLoggedIn]);

  const translations = {
    en: {
      myOrders: "My Orders",
      subtitle: "Track and manage your orders",
      noOrders: "No orders yet",
      startShopping: "Start Shopping",
      orderNumber: "Order",
      placedOn: "Placed on",
      items: "items",
      total: "Total",
      status: "Status",
      viewDetails: "View Details",
      hideDetails: "Hide Details",
      reorder: "Reorder",
      cancelOrder: "Cancel Order",
      downloadInvoice: "Download Invoice",
      trackOrder: "Track Order",
      deliveryAddress: "Delivery Address",
      paymentMethod: "Payment Method",
      orderItems: "Order Items",
      searchPlaceholder: "Search by order number...",
      allOrders: "All Orders",
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      outForDelivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
      card: "Credit Card",
      cod: "Cash on Delivery",
      bank_transfer: "Bank Transfer",
      estimatedDelivery: "Estimated Delivery",
      cancelConfirm: "Are you sure you want to cancel this order?",
      orderCancelled: "Order cancelled successfully",
      cannotCancel: "This order cannot be cancelled",
      subtotal: "Subtotal",
      vat: "VAT",
      deliveryFee: "Delivery Fee",
      discount: "Discount",
    },
    ar: {
      myOrders: "طلباتي",
      subtitle: "تتبع وإدارة طلباتك",
      noOrders: "لا توجد طلبات حتى الآن",
      startShopping: "ابدأ التسوق",
      orderNumber: "الطلب",
      placedOn: "تم الطلب في",
      items: "منتجات",
      total: "المجموع",
      status: "الحالة",
      viewDetails: "عرض التفاصيل",
      hideDetails: "إخفاء التفاصيل",
      reorder: "إعادة الطلب",
      cancelOrder: "إلغاء الطلب",
      downloadInvoice: "تحميل الفاتورة",
      trackOrder: "تتبع الطلب",
      deliveryAddress: "عنوان التوصيل",
      paymentMethod: "طريقة الدفع",
      orderItems: "منتجات الطلب",
      searchPlaceholder: "البحث برقم الطلب...",
      allOrders: "جميع الطلبات",
      pending: "قيد الانتظار",
      confirmed: "تم التأكيد",
      processing: "قيد التجهيز",
      outForDelivery: "في الطريق",
      delivered: "تم التوصيل",
      cancelled: "ملغي",
      card: "بطاقة ائتمان",
      cod: "الدفع عند الاستلام",
      bank_transfer: "تحويل بنكي",
      estimatedDelivery: "التوصيل المتوقع",
      cancelConfirm: "هل أنت متأكد من إلغاء هذا الطلب؟",
      orderCancelled: "تم إلغاء الطلب بنجاح",
      cannotCancel: "لا يمكن إلغاء هذا الطلب",
      subtotal: "المجموع الفرعي",
      vat: "ضريبة القيمة المضافة",
      deliveryFee: "رسوم التوصيل",
      discount: "الخصم",
    },
  };

  const t = translations[language];

  // Smart weight display - converts to Kg when >= 1 Kg
  const formatWeightDisplay = (weight: number) => {
    if (weight >= 1) {
      // Display as Kg
      const kgValue = weight.toFixed(3);
      const kgUnit = isRTL ? "كجم" : "Kg";
      return `${kgValue} ${kgUnit}`;
    } else {
      // Display as grams (multiply by 1000 for display)
      const gramsValue = Math.round(weight * 1000);
      const grUnit = isRTL ? "جرام" : "gr";
      return `${gramsValue} ${grUnit}`;
    }
  };

  const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
    pending: { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
    confirmed: { icon: CheckCircle, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
    processing: { icon: Package, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
    out_for_delivery: { icon: Truck, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
    delivered: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" },
    cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" },
  };

  const getStatusLabel = (status: string) => {
    const statusKey = status.replace(/_/g, "") as keyof typeof t;
    return t[statusKey] || status;
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleReorder = (order: CustomerOrder) => {
    order.items.forEach((item) => {
      addItem({
        id: item.productId,
        productId: item.productId,
        name: item.name,
        nameAr: item.nameAr,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        notes: item.notes,
      });
    });
    navigate("/basket");
  };

  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm(t.cancelConfirm)) {
      const success = await cancelOrder(orderId);
      if (success) {
        alert(t.orderCancelled);
      } else {
        alert(t.cannotCancel);
      }
    }
  };

  const handleDownloadInvoice = (order: CustomerOrder) => {
    // Generate a professional PDF invoice
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #dc2626; }
          .logo-sub { font-size: 12px; color: #64748b; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { font-size: 32px; color: #0f172a; margin-bottom: 5px; }
          .invoice-title p { color: #64748b; font-size: 14px; }
          .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-box h3 { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 1px; }
          .info-box p { font-size: 14px; line-height: 1.6; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .items-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
          .items-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .items-table .text-right { text-align: right; }
          .totals { margin-left: auto; width: 300px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .totals-row.border-top { border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 12px; }
          .totals-row.total { font-size: 18px; font-weight: bold; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; }
          .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .status-delivered { background: #dcfce7; color: #166534; }
          .status-processing { background: #fef3c7; color: #92400e; }
          .status-pending { background: #f1f5f9; color: #475569; }
          @media print { 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">🥩 Butcher Shop</div>
            <div class="logo-sub">Premium Quality Meats</div>
          </div>
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <p>${order.orderNumber}</p>
          </div>
        </div>
        
        <div class="info-section">
          <div class="info-box">
            <h3>Invoice Details</h3>
            <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${order.status}">${order.status.replace(/_/g, ' ')}</span></p>
            <p><strong>Payment:</strong> ${order.paymentMethod}</p>
          </div>
          <div class="info-box">
            <h3>Delivery Address</h3>
            <p>${order.deliveryAddress ? 
              `${(order.deliveryAddress as any).building || ''}, ${(order.deliveryAddress as any).street || ''}<br/>
               ${(order.deliveryAddress as any).area || ''}, ${(order.deliveryAddress as any).emirate || ''}` 
              : 'N/A'}</p>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">AED ${Number(item.price).toFixed(2)}</td>
                <td class="text-right">AED ${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>AED ${Number(order.subtotal).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>VAT (5%)</span>
            <span>AED ${Number(order.vat).toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Delivery Fee</span>
            <span>AED ${Number(order.deliveryFee).toFixed(2)}</span>
          </div>
          ${Number(order.discount) > 0 ? `
            <div class="totals-row" style="color: #dc2626;">
              <span>Discount</span>
              <span>-AED ${Number(order.discount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="totals-row total">
            <span>Total</span>
            <span>AED ${Number(order.total).toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for your order!</p>
          <p style="margin-top: 10px;">Butcher Shop • Premium Quality Meats • UAE</p>
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
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2">{t.myOrders}</h1>
            <p className="text-muted-foreground">{t.subtitle}</p>
          </div>
          <button
            onClick={() => fetchOrders()}
            className={cn("p-2 hover:bg-muted rounded-full transition-colors", isLoading && "animate-spin")}
            title={language === "ar" ? "تحديث" : "Refresh"}
          >
            <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("w-full py-2 border border-border rounded-lg focus:border-primary outline-none", isRTL ? "pr-10 pl-4" : "pl-10 pr-4")}
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Filter className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            {["all", "pending", "processing", "out_for_delivery", "delivered", "cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {status === "all" ? t.allOrders : getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-premium p-4 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">{t.noOrders}</h2>
            <button onClick={() => navigate("/products")} className="btn-primary mt-4">
              {t.startShopping}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrder === order.id;
              const statusInfo = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = statusInfo.icon;

              return (
                <div key={order.id} className="card-premium overflow-hidden">
                  {/* Order Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-full", statusInfo.bgColor)}>
                          <StatusIcon className={cn("w-5 h-5", statusInfo.color)} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {t.orderNumber} #{order.orderNumber}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t.placedOn} {new Date(order.createdAt).toLocaleDateString(language === "ar" ? "ar-AE" : "en-AE", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })} • {new Date(order.createdAt).toLocaleTimeString(language === "ar" ? "ar-AE" : "en-AE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-foreground">
                            <PriceDisplay price={order.total} size="md" />
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.items.length} {t.items}
                          </p>
                        </div>
                        <span className={cn("px-3 py-1 rounded-full text-sm font-medium", statusInfo.bgColor, statusInfo.color)}>
                          {getStatusLabel(order.status)}
                        </span>
                        <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4 bg-muted/30">
                      {/* Progress Bar */}
                      <div className="flex items-center justify-between mb-6">
                        {["pending", "confirmed", "processing", "out_for_delivery", "delivered"].map((status, idx, arr) => {
                          const currentIdx = arr.indexOf(order.status);
                          const isActive = idx <= currentIdx && order.status !== "cancelled";
                          const isCurrent = status === order.status;

                          return (
                            <React.Fragment key={status}>
                              <div className="flex flex-col items-center">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                                  isCurrent && "ring-2 ring-primary ring-offset-2"
                                )}>
                                  {isActive ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                                </div>
                                <span className="text-xs text-muted-foreground mt-1 hidden sm:block">
                                  {getStatusLabel(status)}
                                </span>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={cn("flex-1 h-1 mx-2", isActive && idx < currentIdx ? "bg-primary" : "bg-muted")} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Order Items */}
                      <div>
                        <h4 className="font-semibold text-foreground mb-3">{t.orderItems}</h4>
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 p-2 bg-background rounded-lg">
                              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                                {item.image ? (
                                  <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                  <span className="text-2xl">🥩</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {isRTL && item.nameAr ? item.nameAr : item.name}
                                </p>
                                {item.notes && <p className="text-xs text-muted-foreground truncate">🔪 {item.notes}</p>}
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">x{formatWeightDisplay(item.quantity)}</p>
                                <p className="font-medium text-foreground">
                                  <PriceDisplay price={item.price * item.quantity} size="sm" />
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 bg-background rounded-lg">
                          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {t.deliveryAddress}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {order.deliveryAddress.fullName}<br />
                            {order.deliveryAddress.building}, {order.deliveryAddress.street}<br />
                            {order.deliveryAddress.area}, {order.deliveryAddress.emirate}
                          </p>
                        </div>

                        <div className="p-3 bg-background rounded-lg">
                          <h4 className="font-semibold text-foreground mb-2">{t.paymentMethod}</h4>
                          <p className="text-sm text-muted-foreground">{t[order.paymentMethod as keyof typeof t]}</p>
                          
                          <div className="mt-3 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t.subtotal}</span>
                              <span><PriceDisplay price={order.subtotal} size="sm" /></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t.vat}</span>
                              <span><PriceDisplay price={order.vat} size="sm" /></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t.deliveryFee}</span>
                              <span><PriceDisplay price={order.deliveryFee} size="sm" /></span>
                            </div>
                            {order.discount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>{t.discount}</span>
                                <span>-<PriceDisplay price={order.discount} size="sm" /></span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold pt-2 border-t border-border">
                              <span>{t.total}</span>
                              <span><PriceDisplay price={order.total} size="sm" /></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                        {["out_for_delivery", "processing"].includes(order.status) && (
                          <Link
                            to={`/track/${order.orderNumber}`}
                            className="btn-primary flex items-center gap-2 text-sm"
                          >
                            <MapPin className="w-4 h-4" />
                            {t.trackOrder}
                          </Link>
                        )}
                        <button
                          onClick={() => handleReorder(order)}
                          className="btn-primary flex items-center gap-2 text-sm"
                        >
                          <RotateCcw className="w-4 h-4" />
                          {t.reorder}
                        </button>
                        <button
                          onClick={() => handleDownloadInvoice(order)}
                          className="btn-outline flex items-center gap-2 text-sm"
                        >
                          <Download className="w-4 h-4" />
                          {t.downloadInvoice}
                        </button>
                        {["pending", "confirmed"].includes(order.status) && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="btn-outline text-destructive border-destructive hover:bg-destructive hover:text-white flex items-center gap-2 text-sm"
                          >
                            <XCircle className="w-4 h-4" />
                            {t.cancelOrder}
                          </button>
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
