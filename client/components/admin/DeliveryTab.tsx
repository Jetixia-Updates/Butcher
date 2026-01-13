/**
 * Delivery Management Tab
 * Manage delivery zones, tracking, and driver assignments
 */

import React, { useEffect, useState } from "react";
import {
  MapPin,
  Truck,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Check,
  Clock,
  Package,
  User,
  Calendar,
  Phone,
  Navigation,
  Eye,
  Zap,
  Settings,
} from "lucide-react";
import { deliveryApi, ordersApi, usersApi } from "@/lib/api";
import type { DeliveryZone, DeliveryTracking, Order, User as UserType } from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useNotifications, createDriverAssignedNotification, createUserOrderNotification } from "@/context/NotificationContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

// Translations object
const translations = {
  en: {
    deliveryManagement: "Delivery Management",
    zones: "zones",
    activeDeliveries: "active deliveries",
    drivers: "drivers",
    refresh: "Refresh",
    activeDeliveriesTab: "Active Deliveries",
    orderTrackingTab: "Order Tracking",
    deliveryZonesTab: "Delivery Zones",
    noActiveDeliveries: "No active deliveries",
    noActiveTracking: "No active tracking",
    noTrackingDesc: "Orders with assigned drivers will appear here",
    items: "items",
    assignDriver: "Assign Driver",
    addZone: "Add Zone",
    noDeliveryZones: "No delivery zones configured",
    active: "Active",
    inactive: "Inactive",
    emirate: "Emirate",
    deliveryFee: "Delivery Fee",
    minOrder: "Min. Order",
    estTime: "Est. Time",
    mins: "mins",
    edit: "Edit",
    delete: "Delete",
    editDeliveryZone: "Edit Delivery Zone",
    createDeliveryZone: "Create Delivery Zone",
    zoneNameEnglish: "Zone Name (English)",
    zoneNameArabic: "Zone Name (Arabic)",
    areasCommaSeparated: "Areas (comma-separated)",
    areasPlaceholder: "Downtown, Marina, JBR",
    estTimeLabel: "Est. Time (mins)",
    zoneIsActive: "Zone is active",
    cancel: "Cancel",
    saving: "Saving...",
    saveChanges: "Save Changes",
    createZone: "Create Zone",
    order: "Order",
    deliveryTo: "Delivery to",
    selectDriver: "Select Driver",
    noDriversAvailable: "No drivers available",
    assigning: "Assigning...",
    confirmDeleteZone: "Are you sure you want to delete this zone?",
    dubai: "Dubai",
    abuDhabi: "Abu Dhabi",
    sharjah: "Sharjah",
    ajman: "Ajman",
    fujairah: "Fujairah",
    rasAlKhaimah: "Ras Al Khaimah",
    ummAlQuwain: "Umm Al Quwain",
    assignedDriver: "Assigned Driver",
    assignedAt: "Assigned at",
    mobile: "Mobile",
    reassign: "Reassign",
    notAssigned: "Not Assigned",
    assignSuccess: "Driver assigned successfully",
    assignFailed: "Failed to assign driver",
    expressDeliverySettings: "Express Delivery Settings",
    expressDeliveryFee: "Express Delivery Fee",
    expressDeliveryDesc: "Additional fee for express delivery option",
    expressDeliveryTime: "Express Delivery Time",
    expressDeliveryTimeDesc: "Estimated delivery time for express orders (hours)",
    expressDeliveryEnabled: "Enable Express Delivery",
    expressDeliveryEnabledDesc: "Allow customers to choose express delivery at checkout",
    saveSettings: "Save Settings",
    settingsSaved: "Settings saved successfully",
  },
  ar: {
    deliveryManagement: "إدارة التوصيل",
    zones: "مناطق",
    activeDeliveries: "توصيلات نشطة",
    drivers: "سائقين",
    refresh: "تحديث",
    activeDeliveriesTab: "التوصيلات النشطة",
    orderTrackingTab: "تتبع الطلبات",
    deliveryZonesTab: "مناطق التوصيل",
    noActiveDeliveries: "لا توجد توصيلات نشطة",
    noActiveTracking: "لا يوجد تتبع نشط",
    noTrackingDesc: "الطلبات المعينة للسائقين ستظهر هنا",
    items: "عناصر",
    assignDriver: "تعيين سائق",
    addZone: "إضافة منطقة",
    noDeliveryZones: "لم يتم تكوين مناطق توصيل",
    active: "نشط",
    inactive: "غير نشط",
    emirate: "الإمارة",
    deliveryFee: "رسوم التوصيل",
    minOrder: "الحد الأدنى",
    estTime: "الوقت المقدر",
    mins: "دقيقة",
    edit: "تعديل",
    delete: "حذف",
    editDeliveryZone: "تعديل منطقة التوصيل",
    createDeliveryZone: "إنشاء منطقة توصيل",
    zoneNameEnglish: "اسم المنطقة (إنجليزي)",
    zoneNameArabic: "اسم المنطقة (عربي)",
    areasCommaSeparated: "المناطق (مفصولة بفواصل)",
    areasPlaceholder: "وسط المدينة، المارينا، جي بي آر",
    estTimeLabel: "الوقت المقدر (دقائق)",
    zoneIsActive: "المنطقة نشطة",
    cancel: "إلغاء",
    saving: "جاري الحفظ...",
    saveChanges: "حفظ التغييرات",
    createZone: "إنشاء منطقة",
    order: "الطلب",
    deliveryTo: "التوصيل إلى",
    selectDriver: "اختر سائق",
    noDriversAvailable: "لا يوجد سائقين متاحين",
    assigning: "جاري التعيين...",
    confirmDeleteZone: "هل أنت متأكد من حذف هذه المنطقة؟",
    dubai: "دبي",
    abuDhabi: "أبوظبي",
    sharjah: "الشارقة",
    ajman: "عجمان",
    fujairah: "الفجيرة",
    rasAlKhaimah: "رأس الخيمة",
    ummAlQuwain: "أم القيوين",
    assignedDriver: "السائق المعين",
    assignedAt: "تم التعيين في",
    mobile: "الجوال",
    reassign: "إعادة تعيين",
    notAssigned: "غير معين",
    assignSuccess: "تم تعيين السائق بنجاح",
    assignFailed: "فشل تعيين السائق",
    expressDeliverySettings: "إعدادات التوصيل السريع",
    expressDeliveryFee: "رسوم التوصيل السريع",
    expressDeliveryDesc: "رسوم إضافية لخيار التوصيل السريع",
    expressDeliveryTime: "وقت التوصيل السريع",
    expressDeliveryTimeDesc: "الوقت المقدر للطلبات السريعة (ساعات)",
    expressDeliveryEnabled: "تفعيل التوصيل السريع",
    expressDeliveryEnabledDesc: "السماح للعملاء باختيار التوصيل السريع عند الدفع",
    saveSettings: "حفظ الإعدادات",
    settingsSaved: "تم حفظ الإعدادات بنجاح",
  },
};

export function DeliveryTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = translations[language] || translations.en;
  const { toast } = useToast();
  const { addUserNotification } = useNotifications();

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Order[]>([]);
  const [trackingInfo, setTrackingInfo] = useState<Record<string, DeliveryTracking>>({});
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"deliveries" | "tracking" | "zones">("deliveries");
  const [zoneModal, setZoneModal] = useState<DeliveryZone | null>(null);
  const [createZoneModal, setCreateZoneModal] = useState(false);
  const [assignModal, setAssignModal] = useState<Order | null>(null);

  const fetchData = async () => {
    setLoading(true);
    // Fetch orders that need delivery (confirmed, processing, ready_for_pickup, out_for_delivery)
    const [zonesRes, confirmedRes, processingRes, readyRes, outForDeliveryRes, usersRes] = await Promise.all([
      deliveryApi.getZones(),
      ordersApi.getAll({ status: "confirmed" }),
      ordersApi.getAll({ status: "processing" }),
      ordersApi.getAll({ status: "ready_for_pickup" }),
      ordersApi.getAll({ status: "out_for_delivery" }),
      usersApi.getAll({ role: "delivery" }),
    ]);
    
    // Combine all orders that need delivery management
    const allDeliveryOrders: Order[] = [];
    if (confirmedRes.success && confirmedRes.data) allDeliveryOrders.push(...confirmedRes.data);
    if (processingRes.success && processingRes.data) allDeliveryOrders.push(...processingRes.data);
    if (readyRes.success && readyRes.data) allDeliveryOrders.push(...readyRes.data);
    if (outForDeliveryRes.success && outForDeliveryRes.data) allDeliveryOrders.push(...outForDeliveryRes.data);
    
    const ordersRes = { success: true, data: allDeliveryOrders };

    if (zonesRes.success && zonesRes.data) setZones(zonesRes.data);
    if (ordersRes.success && ordersRes.data) {
      // Fetch tracking info for each order
      const trackingPromises = ordersRes.data.map(order => 
        deliveryApi.getTracking(order.id)
      );
      const trackingResults = await Promise.all(trackingPromises);
      
      const trackingMap: Record<string, DeliveryTracking> = {};
      trackingResults.forEach((result, index) => {
        if (result.success && result.data) {
          trackingMap[ordersRes.data[index].id] = result.data;
        }
      });
      setTrackingInfo(trackingMap);
      
      // Filter out orders where tracking status is 'delivered' - they should not appear in active deliveries
      const activeDeliveries = ordersRes.data.filter(order => {
        const tracking = trackingMap[order.id];
        // Keep orders that have no tracking yet, or tracking status is not 'delivered'
        return !tracking || tracking.status !== 'delivered';
      });
      setPendingDeliveries(activeDeliveries);
    }
    if (usersRes.success && usersRes.data) setDrivers(usersRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateZone = async (zone: Omit<DeliveryZone, "id">) => {
    const response = await deliveryApi.createZone(zone);
    if (response.success) {
      await fetchData();
      setCreateZoneModal(false);
    }
  };

  const handleUpdateZone = async (id: string, zone: Partial<DeliveryZone>) => {
    const response = await deliveryApi.updateZone(id, zone);
    if (response.success) {
      await fetchData();
      setZoneModal(null);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm(t.confirmDeleteZone)) return;
    await deliveryApi.deleteZone(id);
    await fetchData();
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      // Get the order to pass along with the request
      const order = pendingDeliveries.find(o => o.id === orderId);
      
      // Pass order data to ensure server has access even if order is from localStorage
      const response = await deliveryApi.assignDriver(orderId, driverId, undefined, order);
      if (response.success) {
        await fetchData();
        setAssignModal(null);
        toast({ title: t.assignSuccess });
        
        // Send notification to driver about the assignment
        if (order) {
          const addressStr = `${order.deliveryAddress.building}, ${order.deliveryAddress.street}, ${order.deliveryAddress.area}`;
          const notification = createDriverAssignedNotification(order.orderNumber, order.customerName, addressStr);
          addUserNotification(driverId, notification);
          
          // Also notify customer that their order is ready for delivery
          if (order.userId) {
            addUserNotification(order.userId, createUserOrderNotification(order.orderNumber, "ready"));
          }
        }
        
        return true;
      }

      toast({ title: t.assignFailed, description: response.error || undefined, variant: "destructive" });
      return false;
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);
      toast({ title: t.assignFailed, description, variant: "destructive" });
      return false;
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.deliveryManagement}</h3>
          <p className="text-sm text-slate-500">
            {zones.length} {t.zones} • {pendingDeliveries.length} {t.activeDeliveries} • {drivers.length} {t.drivers}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {t.refresh}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-1 overflow-x-auto">
            {[
              { id: "deliveries", label: t.activeDeliveriesTab, icon: Truck },
              { id: "tracking", label: t.orderTrackingTab, icon: Navigation },
              { id: "zones", label: t.deliveryZonesTab, icon: MapPin },
            ].map((tab) => {
              const Icon = tab.icon;
              const trackingCount = Object.keys(trackingInfo).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as typeof activeView)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    activeView === tab.id
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === "tracking" && trackingCount > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 text-xs rounded-full",
                      activeView === tab.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    )}>
                      {trackingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activeView === "deliveries" ? (
            <DeliveriesList
              deliveries={pendingDeliveries}
              drivers={drivers}
              trackingInfo={trackingInfo}
              onAssign={(order) => setAssignModal(order)}
              isRTL={isRTL}
              t={t}
            />
          ) : activeView === "tracking" ? (
            <TrackingList
              trackingInfo={trackingInfo}
              orders={pendingDeliveries}
              onViewOrder={(orderId) => onNavigate?.("orders", orderId)}
              isRTL={isRTL}
              t={t}
            />
          ) : (
            <ZonesList
              zones={zones}
              onEdit={(zone) => setZoneModal(zone)}
              onDelete={handleDeleteZone}
              onCreate={() => setCreateZoneModal(true)}
              isRTL={isRTL}
              t={t}
            />
          )}
        </div>
      </div>

      {/* Create Zone Modal */}
      {createZoneModal && (
        <ZoneFormModal
          onClose={() => setCreateZoneModal(false)}
          onSave={handleCreateZone}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* Edit Zone Modal */}
      {zoneModal && (
        <ZoneFormModal
          zone={zoneModal}
          onClose={() => setZoneModal(null)}
          onSave={(data) => handleUpdateZone(zoneModal.id, data)}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* Assign Driver Modal */}
      {assignModal && (
        <AssignDriverModal
          order={assignModal}
          drivers={drivers}
          onClose={() => setAssignModal(null)}
          onAssign={handleAssignDriver}
          isRTL={isRTL}
          t={t}
        />
      )}
    </div>
  );
}

// Tracking List Component - Shows all active order tracking
function TrackingList({
  trackingInfo,
  orders,
  onViewOrder,
  isRTL,
  t,
}: {
  trackingInfo: Record<string, DeliveryTracking>;
  orders: Order[];
  onViewOrder: (orderId: string) => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const trackingList = Object.values(trackingInfo);
  
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(isRTL ? 'ar-AE' : 'en-AE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    assigned: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    picked_up: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
    in_transit: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    nearby: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  };

  const statusLabels: Record<string, { en: string; ar: string }> = {
    assigned: { en: 'Assigned', ar: 'تم التعيين' },
    picked_up: { en: 'Picked Up', ar: 'تم الاستلام' },
    in_transit: { en: 'In Transit', ar: 'في الطريق' },
    nearby: { en: 'Nearby', ar: 'قريب' },
    delivered: { en: 'Delivered', ar: 'تم التوصيل' },
    failed: { en: 'Failed', ar: 'فشل' },
  };

  if (trackingList.length === 0) {
    return (
      <div className="text-center py-12">
        <Navigation className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-medium">{t.noActiveTracking}</p>
        <p className="text-sm text-slate-400 mt-1">{t.noTrackingDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trackingList.map((tracking) => {
        const order = orders.find(o => o.id === tracking.orderId);
        const statusColor = statusColors[tracking.status] || statusColors.assigned;
        const statusLabel = isRTL 
          ? statusLabels[tracking.status]?.ar 
          : statusLabels[tracking.status]?.en || tracking.status;

        return (
          <div
            key={tracking.id}
            className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{tracking.orderNumber}</p>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium border",
                      statusColor.bg,
                      statusColor.text,
                      statusColor.border
                    )}>
                      {statusLabel}
                    </span>
                  </div>
                  {order && (
                    <p className="text-sm text-slate-500">{order.customerName}</p>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => onViewOrder(tracking.orderId)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Eye className="w-4 h-4" />
                {isRTL ? 'عرض الطلب' : 'View Order'}
              </button>
            </div>

            {/* Driver & Tracking Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">{isRTL ? 'السائق' : 'Driver'}</p>
                  <p className="font-medium text-slate-900">{tracking.driverName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">{isRTL ? 'الهاتف' : 'Phone'}</p>
                  <p className="font-medium text-slate-900" dir="ltr">{tracking.driverMobile}</p>
                </div>
              </div>
              
              {tracking.estimatedArrival && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">{isRTL ? 'الوصول المتوقع' : 'Est. Arrival'}</p>
                    <p className="font-medium text-slate-900">{formatDateTime(tracking.estimatedArrival)}</p>
                  </div>
                </div>
              )}
              
              {order?.deliveryAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">{isRTL ? 'الوجهة' : 'Destination'}</p>
                    <p className="font-medium text-slate-900 truncate max-w-[200px]">
                      {order.deliveryAddress.area}, {order.deliveryAddress.emirate}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            {tracking.timeline && tracking.timeline.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-2">{isRTL ? 'سجل التتبع' : 'Tracking Timeline'}</p>
                <div className="flex flex-wrap gap-2">
                  {tracking.timeline.map((event, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border border-slate-100">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      <span className="text-slate-700 capitalize">{event.status.replace('_', ' ')}</span>
                      <span className="text-slate-400">
                        {new Date(event.timestamp).toLocaleTimeString(isRTL ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeliveriesList({
  deliveries,
  drivers,
  trackingInfo,
  onAssign,
  isRTL,
  t,
}: {
  deliveries: Order[];
  drivers: UserType[];
  trackingInfo: Record<string, DeliveryTracking>;
  onAssign: (order: Order) => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(isRTL ? 'ar-AE' : 'en-AE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">{t.noActiveDeliveries}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deliveries.map((order) => {
        const tracking = trackingInfo[order.id];
        const hasDriver = tracking?.driverId && tracking?.driverName;
        const assignedTime = tracking?.timeline?.find(t => t.status === 'assigned')?.timestamp;
        const trackingStatus = tracking?.status;
        
        // Status color mapping
        const statusColors: Record<string, { bg: string; text: string; border: string }> = {
          assigned: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
          picked_up: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
          in_transit: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
          nearby: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
          delivered: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
          failed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
        };
        
        const statusLabels: Record<string, { en: string; ar: string }> = {
          assigned: { en: 'Assigned', ar: 'تم التعيين' },
          picked_up: { en: 'Picked Up', ar: 'تم الاستلام' },
          in_transit: { en: 'In Transit', ar: 'في الطريق' },
          nearby: { en: 'Nearby', ar: 'قريب' },
          delivered: { en: 'Delivered', ar: 'تم التوصيل' },
          failed: { en: 'Failed', ar: 'فشل' },
        };
        
        const orderStatusLabels: Record<string, { en: string; ar: string }> = {
          confirmed: { en: 'Confirmed', ar: 'مؤكد' },
          processing: { en: 'Processing', ar: 'قيد التحضير' },
          ready_for_pickup: { en: 'Ready', ar: 'جاهز' },
          out_for_delivery: { en: 'Out for Delivery', ar: 'في الطريق' },
        };
        
        const currentStatus = trackingStatus || order.status;
        const statusColor = statusColors[currentStatus] || statusColors.assigned;
        const statusLabel = trackingStatus 
          ? (isRTL ? statusLabels[trackingStatus]?.ar : statusLabels[trackingStatus]?.en) || trackingStatus
          : (isRTL ? orderStatusLabels[order.status]?.ar : orderStatusLabels[order.status]?.en) || order.status;
        
        return (
          <div
            key={order.id}
            className="p-3 sm:p-4 bg-slate-50 rounded-lg"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 text-sm sm:text-base">{order.orderNumber}</p>
                    {/* Tracking Status Badge */}
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium border",
                      statusColor.bg,
                      statusColor.text,
                      statusColor.border
                    )}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">{order.customerName}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {order.deliveryAddress.area}, {order.deliveryAddress.emirate}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                <div className={cn(isRTL ? "text-left" : "text-right sm:text-right", "text-left")}>
                  <p className={cn("text-sm font-medium text-slate-900 flex items-center gap-1", isRTL ? "justify-start" : "justify-start sm:justify-end")}>
                    <CurrencySymbol size="sm" /> {order.total.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {order.items.length} {t.items}
                  </p>
                </div>
                <button
                  onClick={() => onAssign(order)}
                  className={cn(
                    "flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm flex-shrink-0",
                    hasDriver 
                      ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  <User className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{hasDriver ? t.reassign : t.assignDriver}</span>
                  <span className="sm:hidden">{hasDriver ? t.reassign : "Assign"}</span>
                </button>
              </div>
            </div>
            
            {/* Driver Assignment Info */}
            {hasDriver && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t.assignedDriver}</p>
                      <p className="text-sm font-medium text-slate-900">{tracking.driverName}</p>
                    </div>
                  </div>
                  
                  {tracking.driverMobile && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">{t.mobile}</p>
                        <p className="text-sm font-medium text-slate-900" dir="ltr">{tracking.driverMobile}</p>
                      </div>
                    </div>
                  )}
                  
                  {assignedTime && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">{t.assignedAt}</p>
                        <p className="text-sm font-medium text-slate-900">{formatDateTime(assignedTime)}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Estimated Arrival */}
                  {tracking.estimatedArrival && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">{isRTL ? 'الوصول المتوقع' : 'Est. Arrival'}</p>
                        <p className="text-sm font-medium text-slate-900">{formatDateTime(tracking.estimatedArrival)}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Tracking Timeline */}
                {tracking.timeline && tracking.timeline.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-2">{isRTL ? 'سجل التتبع' : 'Tracking History'}</p>
                    <div className="flex flex-wrap gap-2">
                      {tracking.timeline.map((event, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-xs">
                          <span className="w-2 h-2 rounded-full bg-primary"></span>
                          <span className="text-slate-600 capitalize">{event.status.replace('_', ' ')}</span>
                          <span className="text-slate-400">
                            {new Date(event.timestamp).toLocaleTimeString(isRTL ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {idx < tracking.timeline.length - 1 && <span className="text-slate-300 mx-1">→</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ZonesList({
  zones,
  onEdit,
  onDelete,
  onCreate,
  isRTL,
  t,
}: {
  zones: DeliveryZone[];
  onEdit: (zone: DeliveryZone) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  return (
    <div className="space-y-4">
      <div className={cn("flex", isRTL ? "justify-start" : "justify-end")}>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          {t.addZone}
        </button>
      </div>

      {zones.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t.noDeliveryZones}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={cn(
                "p-3 sm:p-4 rounded-lg border-2",
                zone.isActive
                  ? "bg-white border-slate-200"
                  : "bg-slate-50 border-slate-100 opacity-60"
              )}
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-slate-900 text-sm sm:text-base truncate">{isRTL ? zone.nameAr || zone.name : zone.name}</h4>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">{isRTL ? zone.name : zone.nameAr}</p>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                    zone.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-500"
                  )}
                >
                  {zone.isActive ? t.active : t.inactive}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.emirate}</span>
                  <span className="font-medium">{zone.emirate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{t.deliveryFee}</span>
                  <span className="font-medium flex items-center gap-1"><CurrencySymbol size="sm" /> {zone.deliveryFee}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{t.minOrder}</span>
                  <span className="font-medium flex items-center gap-1"><CurrencySymbol size="sm" /> {zone.minimumOrder}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.estTime}</span>
                  <span className="font-medium">{zone.estimatedMinutes} {t.mins}</span>
                </div>
                {/* Express Delivery Status */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-orange-500" />
                    {isRTL ? "توصيل سريع" : "Express"}
                  </span>
                  {(zone as any).expressEnabled ? (
                    <span className="font-medium text-orange-600 flex items-center gap-1">
                      <CurrencySymbol size="xs" /> {(zone as any).expressFee} • {(zone as any).expressHours}h
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">{isRTL ? "معطل" : "Disabled"}</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => onEdit(zone)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                  {t.edit}
                </button>
                <button
                  onClick={() => onDelete(zone.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ZoneFormModal({
  zone,
  onClose,
  onSave,
  isRTL,
  t,
}: {
  zone?: DeliveryZone;
  onClose: () => void;
  onSave: (data: any) => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const [formData, setFormData] = useState({
    name: zone?.name || "",
    nameAr: zone?.nameAr || "",
    emirate: zone?.emirate || "Dubai",
    areas: zone?.areas?.join(", ") || "",
    deliveryFee: zone?.deliveryFee?.toString() || "15",
    minimumOrder: zone?.minimumOrder?.toString() || "50",
    estimatedMinutes: zone?.estimatedMinutes?.toString() || "45",
    isActive: zone?.isActive ?? true,
    // Express delivery settings
    expressEnabled: (zone as any)?.expressEnabled ?? false,
    expressFee: (zone as any)?.expressFee?.toString() || "25",
    expressHours: (zone as any)?.expressHours?.toString() || "1",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const data = {
      name: formData.name,
      nameAr: formData.nameAr,
      emirate: formData.emirate,
      areas: formData.areas.split(",").map((a) => a.trim()).filter(Boolean),
      deliveryFee: parseFloat(formData.deliveryFee),
      minimumOrder: parseFloat(formData.minimumOrder),
      estimatedMinutes: parseInt(formData.estimatedMinutes),
      isActive: formData.isActive,
      // Express delivery settings
      expressEnabled: formData.expressEnabled,
      expressFee: parseFloat(formData.expressFee),
      expressHours: parseInt(formData.expressHours),
    };

    await onSave(data);
    setSubmitting(false);
  };

  const emirates = [
    { value: "Dubai", label: t.dubai },
    { value: "Abu Dhabi", label: t.abuDhabi },
    { value: "Sharjah", label: t.sharjah },
    { value: "Ajman", label: t.ajman },
    { value: "Fujairah", label: t.fujairah },
    { value: "Ras Al Khaimah", label: t.rasAlKhaimah },
    { value: "Umm Al Quwain", label: t.ummAlQuwain },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {zone ? t.editDeliveryZone : t.createDeliveryZone}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.zoneNameEnglish} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.zoneNameArabic}
              </label>
              <input
                type="text"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                dir="rtl"
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.emirate} *
            </label>
            <select
              value={formData.emirate}
              onChange={(e) => setFormData({ ...formData, emirate: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              {emirates.map((emirate) => (
                <option key={emirate.value} value={emirate.value}>
                  {emirate.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.areasCommaSeparated}
            </label>
            <input
              type="text"
              value={formData.areas}
              onChange={(e) => setFormData({ ...formData, areas: e.target.value })}
              placeholder={t.areasPlaceholder}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.deliveryFee}
              </label>
              <div className="relative">
                <div className={cn("absolute top-1/2 -translate-y-1/2", isRTL ? "right-3" : "left-3")}>
                  <CurrencySymbol size="sm" />
                </div>
                <input
                  type="number"
                  value={formData.deliveryFee}
                  onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                  min="0"
                  step="0.01"
                  className={cn(
                    "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base",
                    isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                  )}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.minOrder}
              </label>
              <div className="relative">
                <div className={cn("absolute top-1/2 -translate-y-1/2", isRTL ? "right-3" : "left-3")}>
                  <CurrencySymbol size="sm" />
                </div>
                <input
                  type="number"
                  value={formData.minimumOrder}
                  onChange={(e) => setFormData({ ...formData, minimumOrder: e.target.value })}
                  min="0"
                  step="0.01"
                  className={cn(
                    "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base",
                    isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                  )}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.estTimeLabel}
              </label>
              <input
                type="number"
                value={formData.estimatedMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
                min="1"
                className="w-full px-3 sm:px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5 text-primary border-slate-300 rounded focus:ring-primary"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
              {t.zoneIsActive}
            </label>
          </div>

          {/* Express Delivery Section */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-slate-900">
                {isRTL ? "إعدادات التوصيل السريع" : "Express Delivery Settings"}
              </h3>
            </div>
            
            {/* Enable Express Delivery */}
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="expressEnabled"
                checked={formData.expressEnabled}
                onChange={(e) => setFormData({ ...formData, expressEnabled: e.target.checked })}
                className="w-5 h-5 text-orange-500 border-slate-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="expressEnabled" className="text-sm font-medium text-slate-700">
                {isRTL ? "تفعيل التوصيل السريع لهذه المنطقة" : "Enable Express Delivery for this zone"}
              </label>
            </div>

            {formData.expressEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {isRTL ? "رسوم التوصيل السريع" : "Express Fee"}
                  </label>
                  <div className="relative">
                    <div className={cn("absolute top-1/2 -translate-y-1/2", isRTL ? "right-3" : "left-3")}>
                      <CurrencySymbol size="sm" />
                    </div>
                    <input
                      type="number"
                      value={formData.expressFee}
                      onChange={(e) => setFormData({ ...formData, expressFee: e.target.value })}
                      min="0"
                      step="1"
                      className={cn(
                        "w-full py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm sm:text-base bg-white",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                      )}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {isRTL ? "الوقت المقدر (ساعات)" : "Est. Time (hours)"}
                  </label>
                  <input
                    type="number"
                    value={formData.expressHours}
                    onChange={(e) => setFormData({ ...formData, expressHours: e.target.value })}
                    min="1"
                    max="24"
                    className="w-full px-3 sm:px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm sm:text-base bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t.saving : zone ? t.saveChanges : t.createZone}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignDriverModal({
  order,
  drivers,
  onClose,
  onAssign,
  isRTL,
  t,
}: {
  order: Order;
  drivers: UserType[];
  onClose: () => void;
  onAssign: (orderId: string, driverId: string) => Promise<boolean>;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const [selectedDriver, setSelectedDriver] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setSubmitting(true);
    const success = await onAssign(order.id, selectedDriver);
    setSubmitting(false);
    if (!success) return;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-auto max-h-[90vh] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">{t.assignDriver}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="bg-slate-50 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-slate-500">{t.order}</p>
            <p className="font-medium text-sm sm:text-base">{order.orderNumber}</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">{t.deliveryTo}</p>
            <p className="font-medium text-sm sm:text-base">{order.customerName}</p>
            <p className="text-xs sm:text-sm text-slate-500">
              {order.deliveryAddress.area}, {order.deliveryAddress.emirate}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t.selectDriver} *
            </label>
            {drivers.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {t.noDriversAvailable}
              </p>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {drivers.map((driver) => (
                  <label
                    key={driver.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors touch-manipulation",
                      selectedDriver === driver.id
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-slate-300 active:bg-slate-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="driver"
                      value={driver.id}
                      checked={selectedDriver === driver.id}
                      onChange={() => setSelectedDriver(driver.id)}
                      className="sr-only"
                    />
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {driver.firstName} {driver.familyName}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500" dir="ltr">{driver.mobile}</p>
                    </div>
                    {selectedDriver === driver.id && (
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </form>
        
        {/* Sticky Footer Buttons */}
        <div className="p-4 sm:p-6 border-t border-slate-200 flex-shrink-0 bg-white">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 active:bg-slate-100 text-sm sm:text-base"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedDriver}
              className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 text-sm sm:text-base"
            >
              {submitting ? t.assigning : t.assignDriver}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
