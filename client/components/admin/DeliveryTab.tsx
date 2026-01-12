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
} from "lucide-react";
import { deliveryApi, ordersApi, usersApi } from "@/lib/api";
import type { DeliveryZone, DeliveryTracking, Order, User as UserType } from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";

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
    deliveryZonesTab: "Delivery Zones",
    noActiveDeliveries: "No active deliveries",
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
  },
  ar: {
    deliveryManagement: "إدارة التوصيل",
    zones: "مناطق",
    activeDeliveries: "توصيلات نشطة",
    drivers: "سائقين",
    refresh: "تحديث",
    activeDeliveriesTab: "التوصيلات النشطة",
    deliveryZonesTab: "مناطق التوصيل",
    noActiveDeliveries: "لا توجد توصيلات نشطة",
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
  },
};

export function DeliveryTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = translations[language] || translations.en;
  const { toast } = useToast();

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Order[]>([]);
  const [trackingInfo, setTrackingInfo] = useState<Record<string, DeliveryTracking>>({});
  const [drivers, setDrivers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"zones" | "deliveries">("deliveries");
  const [zoneModal, setZoneModal] = useState<DeliveryZone | null>(null);
  const [createZoneModal, setCreateZoneModal] = useState(false);
  const [assignModal, setAssignModal] = useState<Order | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [zonesRes, ordersRes, usersRes] = await Promise.all([
      deliveryApi.getZones(),
      ordersApi.getAll({ status: "out_for_delivery" }),
      usersApi.getAll({ role: "delivery" }),
    ]);

    if (zonesRes.success && zonesRes.data) setZones(zonesRes.data);
    if (ordersRes.success && ordersRes.data) {
      setPendingDeliveries(ordersRes.data);
      
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
      const response = await deliveryApi.assignDriver(orderId, driverId);
      if (response.success) {
        await fetchData();
        setAssignModal(null);
        toast({ title: t.assignSuccess });
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
          <div className="flex gap-1 p-1">
            {[
              { id: "deliveries", label: t.activeDeliveriesTab, icon: Truck },
              { id: "zones", label: t.deliveryZonesTab, icon: MapPin },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as typeof activeView)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeView === tab.id
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
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
                  <p className="font-medium text-slate-900 text-sm sm:text-base">{order.orderNumber}</p>
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
                </div>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{t.assignDriver}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500">{t.order}</p>
            <p className="font-medium">{order.orderNumber}</p>
            <p className="text-sm text-slate-500 mt-2">{t.deliveryTo}</p>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-sm text-slate-500">
              {order.deliveryAddress.area}, {order.deliveryAddress.emirate}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.selectDriver} *
            </label>
            {drivers.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {t.noDriversAvailable}
              </p>
            ) : (
              <div className="space-y-2">
                {drivers.map((driver) => (
                  <label
                    key={driver.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors",
                      selectedDriver === driver.id
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-slate-300"
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
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <Truck className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {driver.firstName} {driver.familyName}
                      </p>
                      <p className="text-sm text-slate-500">{driver.mobile}</p>
                    </div>
                    {selectedDriver === driver.id && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </label>
                ))}
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
              disabled={submitting || !selectedDriver}
              className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t.assigning : t.assignDriver}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
