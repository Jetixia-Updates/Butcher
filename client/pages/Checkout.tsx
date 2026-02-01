import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useBasket } from "@/context/BasketContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { useNotifications, createOrderNotification, createUserOrderNotification, createUserPaymentNotification, createDetailedInvoiceNotification, generateInvoiceNumber, type InvoiceData } from "@/context/NotificationContext";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { ordersApi, deliveryApi, addressesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Address, DeliveryZone } from "@shared/api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon issue
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type PaymentMethod = "card" | "cod" | null;

// Delivery time slot types
interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  labelAr: string;
}

interface DeliveryDate {
  date: Date;
  dayLabel: string;
  dayLabelAr: string;
  dateLabel: string;
  dateLabelAr: string;
  slots: TimeSlot[];
}

// Generate time slots for delivery
const generateTimeSlots = (): TimeSlot[] => [
  { id: "morning", startTime: "09:00", endTime: "12:00", label: "Morning (9 AM - 12 PM)", labelAr: "صباحاً (9 ص - 12 م)" },
  { id: "afternoon", startTime: "12:00", endTime: "15:00", label: "Afternoon (12 PM - 3 PM)", labelAr: "ظهراً (12 م - 3 م)" },
  { id: "evening", startTime: "15:00", endTime: "18:00", label: "Evening (3 PM - 6 PM)", labelAr: "مساءً (3 م - 6 م)" },
  { id: "night", startTime: "18:00", endTime: "21:00", label: "Night (6 PM - 9 PM)", labelAr: "ليلاً (6 م - 9 م)" },
];

// Generate delivery dates (today + next 6 days)
const generateDeliveryDates = (): DeliveryDate[] => {
  const dates: DeliveryDate[] = [];
  const today = new Date();
  const currentHour = today.getHours();

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayNamesAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const isToday = i === 0;
    const isTomorrow = i === 1;

    // Filter available slots for today based on current time
    let availableSlots = generateTimeSlots();
    if (isToday) {
      availableSlots = availableSlots.filter(slot => {
        const slotStartHour = parseInt(slot.startTime.split(":")[0]);
        // Only show slots that start at least 2 hours from now
        return slotStartHour > currentHour + 2;
      });
    }

    // Skip days with no available slots
    if (availableSlots.length === 0) continue;

    dates.push({
      date,
      dayLabel: isToday ? "Today" : isTomorrow ? "Tomorrow" : dayNames[date.getDay()],
      dayLabelAr: isToday ? "اليوم" : isTomorrow ? "غداً" : dayNamesAr[date.getDay()],
      dateLabel: `${monthNames[date.getMonth()]} ${date.getDate()}`,
      dateLabelAr: `${date.getDate()} ${monthNamesAr[date.getMonth()]}`,
      slots: availableSlots,
    });
  }

  return dates;
};

interface AddressFormData {
  label: string;
  fullName: string;
  mobile: string;
  emirate: string;
  area: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
}

const EMPTY_ADDRESS_FORM: AddressFormData = {
  label: "Home",
  fullName: "",
  mobile: "",
  emirate: "",
  area: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  isDefault: false,
  latitude: undefined,
  longitude: undefined,
};

// UAE center coordinates
const UAE_CENTER: [number, number] = [25.2048, 55.2708]; // Dubai

// Map Picker Component using Leaflet + OpenStreetMap (FREE)
function MapPicker({
  latitude,
  longitude,
  onLocationSelect
}: {
  latitude?: number;
  longitude?: number;
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Reverse geocode using Nominatim (free)
  const reverseGeocode = async (lat: number, lng: number): Promise<string | undefined> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await response.json();
      return data.display_name;
    } catch {
      return undefined;
    }
  };

  // Auto-locate user's position
  const autoLocate = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        if (leafletMapRef.current) {
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng], { draggable: true })
              .addTo(leafletMapRef.current);

            markerRef.current.on("dragend", async () => {
              const pos = markerRef.current?.getLatLng();
              if (pos) {
                const address = await reverseGeocode(pos.lat, pos.lng);
                onLocationSelect(pos.lat, pos.lng, address);
              }
            });
          }
          leafletMapRef.current.setView([lat, lng], 16);
        }

        const address = await reverseGeocode(lat, lng);
        onLocationSelect(lat, lng, address);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location access denied. Please enable location permissions.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError("Location unavailable. Please try again.");
        } else {
          setLocationError("Unable to get location. You can click on the map to set it manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Initialize map and auto-locate
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const initialCenter: [number, number] = latitude && longitude
      ? [latitude, longitude]
      : UAE_CENTER;
    const initialZoom = latitude && longitude ? 16 : 12;

    leafletMapRef.current = L.map(mapRef.current).setView(initialCenter, initialZoom);

    // Add OpenStreetMap tiles (FREE)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    // Add marker if coordinates exist
    if (latitude && longitude) {
      markerRef.current = L.marker([latitude, longitude], { draggable: true })
        .addTo(leafletMapRef.current);

      markerRef.current.on("dragend", async () => {
        const pos = markerRef.current?.getLatLng();
        if (pos) {
          const address = await reverseGeocode(pos.lat, pos.lng);
          onLocationSelect(pos.lat, pos.lng, address);
        }
      });
    }

    // Handle map clicks
    leafletMapRef.current.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true })
          .addTo(leafletMapRef.current!);

        markerRef.current.on("dragend", async () => {
          const pos = markerRef.current?.getLatLng();
          if (pos) {
            const address = await reverseGeocode(pos.lat, pos.lng);
            onLocationSelect(pos.lat, pos.lng, address);
          }
        });
      }

      const address = await reverseGeocode(lat, lng);
      onLocationSelect(lat, lng, address);
    });

    setIsMapReady(true);

    // Auto-locate if no coordinates provided
    if (!latitude || !longitude) {
      setTimeout(() => autoLocate(), 500);
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update marker when coordinates change externally
  useEffect(() => {
    if (!leafletMapRef.current || !isMapReady) return;

    if (latitude && longitude) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = L.marker([latitude, longitude], { draggable: true })
          .addTo(leafletMapRef.current);
      }
      leafletMapRef.current.setView([latitude, longitude], 16);
    }
  }, [latitude, longitude, isMapReady]);

  return (
    <div className="space-y-3">
      {/* Location Status */}
      {isLocating && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-sm text-blue-700 dark:text-blue-400">Detecting your location...</span>
        </div>
      )}

      {locationError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-400">{locationError}</p>
          <button
            type="button"
            onClick={autoLocate}
            className="mt-2 text-sm text-primary font-medium hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Relocate Button */}
      {!isLocating && !locationError && (
        <button
          type="button"
          onClick={autoLocate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          <span>📍</span>
          <span>Use my current location</span>
        </button>
      )}

      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-64 rounded-lg border border-input overflow-hidden z-0"
      />

      <p className="text-xs text-muted-foreground text-center">
        Your location is detected automatically. Click on the map or drag the marker to adjust.
      </p>
    </div>
  );
}

// Static Map Preview for saved addresses (using OpenStreetMap)
function AddressMapPreview({ latitude, longitude }: { latitude?: number; longitude?: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !latitude || !longitude) return;
    if (leafletMapRef.current) return; // Already initialized

    leafletMapRef.current = L.map(mapRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      attributionControl: false,
    }).setView([latitude, longitude], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    L.marker([latitude, longitude]).addTo(leafletMapRef.current);

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  if (!latitude || !longitude) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-border">
      <div ref={mapRef} className="w-full h-20" />
    </div>
  );
}

// Interactive map for viewing a specific address location
function AddressLocationViewer({
  address,
  onClose
}: {
  address: Address;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const [formattedAddress, setFormattedAddress] = useState<string>("");

  useEffect(() => {
    if (!mapRef.current || !address.latitude || !address.longitude) return;
    if (leafletMapRef.current) return; // Already initialized

    leafletMapRef.current = L.map(mapRef.current).setView(
      [address.latitude, address.longitude],
      16
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    L.marker([address.latitude, address.longitude])
      .bindPopup(address.label)
      .addTo(leafletMapRef.current);

    // Reverse geocode to get formatted address using Nominatim
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${address.latitude}&lon=${address.longitude}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then(res => res.json())
      .then(data => {
        if (data.display_name) {
          setFormattedAddress(data.display_name);
        }
      })
      .catch(() => { });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [address]);

  if (!address.latitude || !address.longitude) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-2xl shadow-xl max-w-lg w-full p-6">
          <div className="text-center">
            <p className="text-muted-foreground">No location data available for this address.</p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground text-lg">{address.label}</h3>
            <p className="text-sm text-muted-foreground">{address.fullName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map */}
        <div ref={mapRef} className="w-full h-80" />

        {/* Address Details */}
        <div className="p-4 bg-muted/30 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-lg">📍</span>
            <div>
              <p className="font-medium text-foreground">
                {address.building}, {address.street}
                {address.floor && `, Floor ${address.floor}`}
                {address.apartment && `, Apt ${address.apartment}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {address.area}, {address.emirate}
              </p>
              {formattedAddress && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Google Maps: {formattedAddress}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>📞</span>
            <span>{address.mobile}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>🌐</span>
            <span>Lat: {address.latitude.toFixed(6)}, Lng: {address.longitude.toFixed(6)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${address.latitude},${address.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"
          >
            🗺️ Open in Google Maps
          </a>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, vat, total, clearBasket } = useBasket();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const { addNotification, addAdminNotification } = useNotifications();
  const { validatePromoCode, settings, timeSlots: adminTimeSlots } = useSettings();

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number; type: "percent" | "fixed"; maxDiscount?: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  const handleApplyPromo = async () => {
    setPromoError(null);
    setIsApplyingPromo(true);

    try {
      // Validate promo code using SettingsContext
      const result = await validatePromoCode(promoCode, subtotal);

      if (result.valid && result.promo) {
        setPromoApplied({
          code: result.promo.code,
          discount: result.promo.discount,
          type: result.promo.type,
          maxDiscount: result.promo.maxDiscount
        });
        setPromoError(null);
      } else {
        setPromoError(
          isRTL
            ? (result.error === "Invalid promo code" ? "كود غير صالح" : result.error || "كود غير صالح")
            : (result.error || "Invalid promo code")
        );
      }
    } catch (error) {
      setPromoError(isRTL ? "حدث خطأ" : "An error occurred");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(null);
    setPromoCode("");
    setPromoError(null);
  };

  // Calculate discount amount (matching server logic with maxDiscount cap)
  const discountAmount = promoApplied
    ? promoApplied.type === "percent"
      ? Math.round(Math.min(
        subtotal * (promoApplied.discount / 100),
        promoApplied.maxDiscount ?? Infinity
      ) * 100) / 100
      : Math.round(promoApplied.discount * 100) / 100
    : 0;

  // Translations
  const t = {
    basket: isRTL ? 'السلة' : 'Basket',
    checkout: isRTL ? 'الدفع' : 'Checkout',
    confirmation: isRTL ? 'التأكيد' : 'Confirmation',
    deliveryAddress: isRTL ? 'عنوان التوصيل' : 'Delivery Address',
    addNewAddress: isRTL ? 'إضافة عنوان جديد' : 'Add New Address',
    editAddress: isRTL ? 'تعديل العنوان' : 'Edit Address',
    edit: isRTL ? 'تعديل' : 'Edit',
    delete: isRTL ? 'حذف' : 'Delete',
    setAsDefault: isRTL ? 'تعيين كافتراضي' : 'Set as Default',
    default: isRTL ? 'افتراضي' : 'Default',
    viewOnMap: isRTL ? 'عرض على الخريطة' : 'View on Map',
    noAddresses: isRTL ? 'لم تتم إضافة أي عناوين بعد' : 'No addresses added yet',
    addFirstAddress: isRTL ? 'أضف عنوانك الأول لمتابعة الطلب' : 'Add your first address to continue with your order',
    deliveryTime: isRTL ? 'وقت التوصيل' : 'Delivery Time',
    selectTimeSlot: isRTL ? 'اختر الموعد' : 'Select a Slot',
    paymentMethod: isRTL ? 'طريقة الدفع' : 'Payment Method',
    payWithCard: isRTL ? 'الدفع بالبطاقة' : 'Pay with Card',
    securePayment: isRTL ? 'دفع آمن وسريع' : 'Secure & fast payment',
    cashOnDelivery: isRTL ? 'الدفع عند الاستلام' : 'Cash on Delivery',
    payWhenReceive: isRTL ? 'ادفع عند استلام طلبك' : 'Pay when you receive your order',
    orderSummary: isRTL ? 'ملخص الطلب' : 'Order Summary',
    subtotal: isRTL ? 'المجموع الفرعي' : 'Subtotal',
    vat: isRTL ? 'ضريبة القيمة المضافة (5%)' : 'VAT (5%)',
    deliveryFee: isRTL ? 'رسوم التوصيل' : 'Delivery Fee',
    free: isRTL ? 'مجاني' : 'Free',
    total: isRTL ? 'الإجمالي' : 'Total',
    placeOrder: isRTL ? 'تأكيد الطلب' : 'Place Order',
    processing: isRTL ? 'جاري المعالجة...' : 'Processing...',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    saveAddress: isRTL ? 'حفظ العنوان' : 'Save Address',
    saving: isRTL ? 'جاري الحفظ...' : 'Saving...',
    addressLabel: isRTL ? 'اسم العنوان' : 'Address Label',
    home: isRTL ? 'المنزل' : 'Home',
    work: isRTL ? 'العمل' : 'Work',
    other: isRTL ? 'آخر' : 'Other',
    fullName: isRTL ? 'الاسم الكامل' : 'Full Name',
    mobileNumber: isRTL ? 'رقم الجوال' : 'Mobile Number',
    emirate: isRTL ? 'الإمارة' : 'Emirate',
    selectEmirate: isRTL ? 'اختر الإمارة' : 'Select Emirate',
    area: isRTL ? 'المنطقة' : 'Area',
    street: isRTL ? 'الشارع' : 'Street',
    building: isRTL ? 'المبنى' : 'Building',
    floor: isRTL ? 'الطابق' : 'Floor',
    apartment: isRTL ? 'الشقة' : 'Apartment',
    optional: isRTL ? 'اختياري' : 'optional',
    setDefault: isRTL ? 'تعيين كعنوان افتراضي' : 'Set as default address',
    selectLocation: isRTL ? 'اختر الموقع' : 'Select Location',
    emptyBasket: isRTL ? 'سلتك فارغة' : 'Your basket is empty',
    addItemsFirst: isRTL ? 'أضف منتجات قبل الدفع' : 'Add some items before checking out',
    browseProducts: isRTL ? 'تصفح المنتجات' : 'Browse Products',
    items: isRTL ? 'منتجات' : 'items',
    selectAddress: isRTL ? 'يرجى اختيار عنوان التوصيل' : 'Please select a delivery address',
    selectSlot: isRTL ? 'يرجى اختيار موعد التوصيل' : 'Please select a delivery time slot',
    selectPayment: isRTL ? 'يرجى اختيار طريقة الدفع' : 'Please select a payment method',
    close: isRTL ? 'إغلاق' : 'Close',
    locationOnMap: isRTL ? 'الموقع على الخريطة' : 'Location on Map',
    promoCode: isRTL ? 'كود الخصم' : 'Promo Code',
    promoPlaceholder: isRTL ? 'أدخل كود الخصم' : 'Enter promo code',
    apply: isRTL ? 'تطبيق' : 'Apply',
    applying: isRTL ? 'جاري التطبيق...' : 'Applying...',
    discount: isRTL ? 'الخصم' : 'Discount',
    remove: isRTL ? 'إزالة' : 'Remove',
  };

  // Emirates translations
  const emirates = {
    dubai: isRTL ? 'دبي' : 'Dubai',
    abuDhabi: isRTL ? 'أبوظبي' : 'Abu Dhabi',
    sharjah: isRTL ? 'الشارقة' : 'Sharjah',
    ajman: isRTL ? 'عجمان' : 'Ajman',
    rasAlKhaimah: isRTL ? 'رأس الخيمة' : 'Ras Al Khaimah',
    fujairah: isRTL ? 'الفجيرة' : 'Fujairah',
    ummAlQuwain: isRTL ? 'أم القيوين' : 'Umm Al Quwain',
  };

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);

  // Modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFormData>(EMPTY_ADDRESS_FORM);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // View location modal
  const [viewingAddress, setViewingAddress] = useState<Address | null>(null);

  // Delivery time slot state
  const [deliveryDates] = useState<DeliveryDate[]>(generateDeliveryDates);
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string | null>(null);

  // Express delivery state
  const [isExpressDelivery, setIsExpressDelivery] = useState(false);

  // Driver tip state
  const [driverTip, setDriverTip] = useState<number>(0);
  const tipOptions = [0, 5, 10, 15, 20];

  // Delivery zones state
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneDeliveryFee, setZoneDeliveryFee] = useState<number>(0);
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null);

  // Adjusted totals with delivery fee and tip (rounded to match server calculations)
  // Express delivery replaces zone delivery fee (not added to it)
  // Use zone's expressFee if available, fallback to 25 AED
  const expressDeliveryFee = matchedZone?.expressFee ? Number(matchedZone.expressFee) : 25;
  const expressEnabled = matchedZone?.expressEnabled ?? true;
  const expressHours = matchedZone?.expressHours ?? 3;
  const adjustedSubtotal = Math.round((Number(subtotal) - Number(discountAmount)) * 100) / 100;
  const adjustedVat = Math.round(adjustedSubtotal * 0.05 * 100) / 100;
  const deliveryFeeTotal = isExpressDelivery ? Number(expressDeliveryFee) : Number(zoneDeliveryFee);
  const adjustedTotal = Math.round((adjustedSubtotal + adjustedVat + deliveryFeeTotal + Number(driverTip)) * 100) / 100;

  // Helper function to get localized item name
  const getItemName = (item: typeof items[0]) => {
    return language === "ar" && item.nameAr ? item.nameAr : item.name;
  };

  // Smart weight display - converts to Kg when >= 1 Kg
  const formatWeightDisplay = (weight: number) => {
    if (weight >= 1) {
      // Display as Kg
      const kgValue = weight.toFixed(3);
      const kgUnit = language === "ar" ? "كجم" : "Kg";
      return `${kgValue} ${kgUnit}`;
    } else {
      // Display as grams (multiply by 1000 for display)
      const gramsValue = Math.round(weight * 1000);
      const grUnit = language === "ar" ? "جرام" : "gr";
      return `${gramsValue} ${grUnit}`;
    }
  };

  // Fetch user addresses on mount
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user?.id) {
        setIsLoadingAddresses(false);
        return;
      }

      try {
        // Get addresses from the shared addresses API (same as My Account > Saved Addresses)
        const response = await addressesApi.getAll(user.id);
        if (response.success && response.data) {
          setAddresses(response.data);

          // Select default address or first address
          const defaultAddress = response.data.find(a => a.isDefault) || response.data[0];
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch addresses:", err);
      }
      setIsLoadingAddresses(false);
    };

    fetchAddresses();
  }, [user?.id]);

  // Fetch delivery zones on mount
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await deliveryApi.getZones();
        if (response.success && response.data) {
          setZones(response.data.filter(z => z.isActive));
        }
      } catch (err) {
        console.error("Failed to fetch delivery zones:", err);
      }
    };
    fetchZones();
  }, []);

  // Calculate zone-based delivery fee when address changes
  useEffect(() => {
    const currentAddress = addresses.find(a => a.id === selectedAddressId);
    if (!currentAddress) {
      setZoneDeliveryFee(settings?.defaultDeliveryFee || 15);
      setMatchedZone(null);
      return;
    }

    // If no zones available, use default fee from settings
    if (zones.length === 0) {
      setZoneDeliveryFee(settings?.defaultDeliveryFee || 15);
      setMatchedZone(null);
      return;
    }

    // Find matching zone based on emirate and area
    const zone = zones.find((z) => {
      const emirateMatch = z.emirate.toLowerCase() === currentAddress.emirate.toLowerCase();
      const areaMatch = z.areas.some((a) =>
        a.toLowerCase().includes(currentAddress.area.toLowerCase()) ||
        currentAddress.area.toLowerCase().includes(a.toLowerCase())
      );
      return emirateMatch && areaMatch;
    });

    if (zone) {
      setZoneDeliveryFee(Number(zone.deliveryFee) || (settings?.defaultDeliveryFee || 15));
      setMatchedZone(zone);
    } else {
      // Fallback: try to match just by emirate
      const emirateZone = zones.find((z) =>
        z.emirate.toLowerCase() === currentAddress.emirate.toLowerCase()
      );
      if (emirateZone) {
        setZoneDeliveryFee(Number(emirateZone.deliveryFee) || (settings?.defaultDeliveryFee || 15));
        setMatchedZone(emirateZone);
      } else {
        // No matching zone found - use default delivery fee from settings
        setZoneDeliveryFee(settings?.defaultDeliveryFee || 15);
        setMatchedZone(null);
      }
    }
  }, [selectedAddressId, addresses, zones, settings]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t.emptyBasket}
          </h1>
          <button
            onClick={() => navigate("/products")}
            className="btn-primary mt-4"
          >
            {t.browseProducts}
          </button>
        </div>
      </div>
    );
  }

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };

  // Get selected delivery time slot info for order
  const getSelectedDeliverySlotInfo = (): string => {
    if (selectedDateIndex === null || !selectedTimeSlotId) return "";
    const selectedDate = deliveryDates[selectedDateIndex];
    const selectedSlot = selectedDate?.slots.find(s => s.id === selectedTimeSlotId);
    if (!selectedDate || !selectedSlot) return "";

    const dateStr = selectedDate.date.toLocaleDateString("en-AE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return `${dateStr}, ${selectedSlot.label}`;
  };

  const handleCardPayment = () => {
    if (!selectedAddressId) {
      setError(language === "ar" ? "يرجى اختيار عنوان التوصيل" : "Please select or add a delivery address");
      return;
    }
    // Skip time slot validation for express delivery
    if (!isExpressDelivery && !selectedTimeSlotId) {
      setError(language === "ar" ? "يرجى اختيار موعد التوصيل المفضل" : "Please select a preferred delivery time slot");
      return;
    }
    setIsProcessing(true);
    const deliverySlotInfo = isExpressDelivery
      ? (language === "ar" ? "توصيل سريع - خلال 3 ساعات" : "Express Delivery - Within 3 hours")
      : getSelectedDeliverySlotInfo();
    navigate("/payment/card", {
      state: {
        addressId: selectedAddressId,
        deliveryTimeSlot: deliverySlotInfo,
        promoCode: promoApplied?.code,
        discountAmount: discountAmount,
        isExpressDelivery: isExpressDelivery,
        expressDeliveryFee: isExpressDelivery ? expressDeliveryFee : 0,
        zoneDeliveryFee: zoneDeliveryFee,
        driverTip: driverTip,
      }
    });
  };

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setAddressForm({
      ...EMPTY_ADDRESS_FORM,
      fullName: `${user?.firstName || ""} ${user?.familyName || ""}`.trim(),
      mobile: user?.mobile || "",
      emirate: user?.emirate || "",
    });
    setShowAddressModal(true);
  };

  const handleOpenEditModal = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label,
      fullName: address.fullName,
      mobile: address.mobile,
      emirate: address.emirate,
      area: address.area,
      street: address.street,
      building: address.building,
      floor: address.floor || "",
      apartment: address.apartment || "",
      isDefault: address.isDefault,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    setShowAddressModal(true);
  };

  const handleCloseModal = () => {
    setShowAddressModal(false);
    setEditingAddress(null);
    setAddressForm(EMPTY_ADDRESS_FORM);
  };

  const handleLocationSelect = (lat: number, lng: number, formattedAddress?: string) => {
    setAddressForm(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));

    // Optionally auto-fill address fields from geocoded address
    if (formattedAddress) {
      // You could parse the address here to auto-fill fields
      console.log("Selected location:", formattedAddress);
    }
  };

  const handleSaveAddress = async () => {
    if (!user?.id) return;

    // Validation
    if (!addressForm.fullName || !addressForm.mobile || !addressForm.emirate ||
      !addressForm.area || !addressForm.street || !addressForm.building) {
      setError("Please fill in all required fields");
      return;
    }

    // Validate location
    if (!addressForm.latitude || !addressForm.longitude) {
      setError("Please select your location on the map");
      return;
    }

    setIsSavingAddress(true);
    setError(null);

    try {
      if (editingAddress) {
        // Update existing address using shared addresses API
        const response = await addressesApi.update(user.id, editingAddress.id, {
          label: addressForm.label,
          fullName: addressForm.fullName,
          mobile: addressForm.mobile,
          emirate: addressForm.emirate,
          area: addressForm.area,
          street: addressForm.street,
          building: addressForm.building,
          floor: addressForm.floor || undefined,
          apartment: addressForm.apartment || undefined,
          isDefault: addressForm.isDefault,
          latitude: addressForm.latitude,
          longitude: addressForm.longitude,
        });

        if (response.success && response.data) {
          // Update local state
          const updatedAddresses = addresses.map(a => a.id === editingAddress.id ? response.data! : a);
          setAddresses(updatedAddresses);
          handleCloseModal();
        } else {
          setError(response.error || "Failed to update address");
        }
      } else {
        // Create new address using shared addresses API
        const response = await addressesApi.create(user.id, {
          label: addressForm.label,
          fullName: addressForm.fullName,
          mobile: addressForm.mobile,
          emirate: addressForm.emirate,
          area: addressForm.area,
          street: addressForm.street,
          building: addressForm.building,
          floor: addressForm.floor || undefined,
          apartment: addressForm.apartment || undefined,
          isDefault: addressForm.isDefault || addresses.length === 0,
          latitude: addressForm.latitude,
          longitude: addressForm.longitude,
        });

        if (response.success && response.data) {
          // Add to local state and select it
          const updatedAddresses = [...addresses, response.data!];
          setAddresses(updatedAddresses);
          setSelectedAddressId(response.data.id);
          handleCloseModal();
        } else {
          setError(response.error || "Failed to create address");
        }
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }

    setIsSavingAddress(false);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    if (!user?.id) return;

    try {
      // Delete using shared addresses API
      const response = await addressesApi.delete(user.id, addressId);
      if (response.success) {
        const updatedAddresses = addresses.filter(a => a.id !== addressId);
        setAddresses(updatedAddresses);
        if (selectedAddressId === addressId) {
          setSelectedAddressId(updatedAddresses[0]?.id || null);
        }
      } else {
        setError(response.error || "Failed to delete address");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
  };

  const handleCODPayment = async () => {
    if (!selectedAddressId) {
      setError(language === "ar" ? "يرجى اختيار عنوان التوصيل" : "Please select or add a delivery address");
      return;
    }

    // Skip time slot validation for express delivery
    if (!isExpressDelivery && !selectedTimeSlotId) {
      setError(language === "ar" ? "يرجى اختيار موعد التوصيل المفضل" : "Please select a preferred delivery time slot");
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Build delivery notes with time slot or express delivery
    const deliverySlotInfo = isExpressDelivery
      ? (language === "ar" ? "توصيل سريع - خلال 3 ساعات" : "Express Delivery - Within 3 hours")
      : getSelectedDeliverySlotInfo();
    const deliveryNotes = `Preferred Delivery Time: ${deliverySlotInfo}`;

    try {
      // Create order in backend
      const response = await ordersApi.create({
        userId: user?.id || "",
        items: items.map((item) => {
          // Extract original product ID
          // Priority: 1) use productId if set, 2) extract from id by removing timestamp suffix
          let productId = item.productId;
          if (!productId) {
            // Check if ID ends with a timestamp (13+ digit number after last underscore)
            const timestampMatch = item.id.match(/^(.+)_(\d{13,})$/);
            if (timestampMatch) {
              productId = timestampMatch[1]; // Everything before the timestamp
            } else {
              productId = item.id; // Use as-is
            }
          }
          return {
            productId,
            quantity: item.quantity,
            unitPrice: item.price, // Send the price from basket (already has discounts applied)
            notes: item.notes,
          };
        }),
        addressId: selectedAddressId,
        // Also send full address data as fallback for cases where addressId is not on server
        deliveryAddress: selectedAddress ? {
          fullName: selectedAddress.fullName,
          mobile: selectedAddress.mobile,
          emirate: selectedAddress.emirate,
          area: selectedAddress.area,
          street: selectedAddress.street,
          building: selectedAddress.building,
          floor: selectedAddress.floor,
          apartment: selectedAddress.apartment,
          latitude: selectedAddress.latitude,
          longitude: selectedAddress.longitude,
        } : undefined,
        paymentMethod: "cod",
        deliveryNotes: deliveryNotes,
        discountCode: promoApplied?.code,
        discountAmount: discountAmount,
        deliveryFee: deliveryFeeTotal,
        isExpressDelivery: isExpressDelivery,
        driverTip: driverTip,
        // Send calculated totals from checkout
        subtotal: adjustedSubtotal,
        vatAmount: adjustedVat,
        total: adjustedTotal,
      });

      if (response.success && response.data) {
        // Notifications are now created server-side for reliability across all devices

        // Generate TAX invoice using server-calculated values for accuracy
        const invoiceNumber = generateInvoiceNumber(response.data.orderNumber);
        const orderData = response.data;

        const invoiceData: InvoiceData = {
          invoiceNumber,
          orderNumber: orderData.orderNumber,
          date: new Date().toLocaleDateString("en-AE", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          customerName: orderData.customerName || selectedAddress?.fullName || "Customer",
          customerMobile: orderData.customerMobile || selectedAddress?.mobile || user?.mobile || "",
          customerAddress: orderData.deliveryAddress
            ? `${orderData.deliveryAddress.building}, ${orderData.deliveryAddress.street}, ${orderData.deliveryAddress.area}, ${orderData.deliveryAddress.emirate}`
            : (selectedAddress
              ? `${selectedAddress.building}, ${selectedAddress.street}, ${selectedAddress.area}, ${selectedAddress.emirate}`
              : ""),
          items: orderData.items.map((item) => ({
            name: item.productName,
            nameAr: item.productNameAr,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          subtotal: orderData.subtotal,
          discount: orderData.discount > 0 ? orderData.discount : undefined,
          discountCode: orderData.discountCode,
          vatRate: 5,
          vatAmount: orderData.vatAmount,
          deliveryFee: orderData.deliveryFee > 0 ? orderData.deliveryFee : undefined,
          isExpressDelivery: isExpressDelivery,
          driverTip: driverTip > 0 ? driverTip : undefined,
          total: orderData.total,
          paymentMethod: "cod",
        };

        // Send TAX invoice notification to the user
        addNotification(createDetailedInvoiceNotification(invoiceData));

        // Clear basket after successful order
        clearBasket();
        alert(
          `Order ${response.data.orderNumber} placed successfully! Our team will contact you within 2 hours to confirm delivery.\n\nYour TAX invoice (${invoiceNumber}) has been sent to your notifications.`
        );
        navigate("/products");
      } else {
        setError(response.error || "Failed to create order. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }

    setIsProcessing(false);
  };

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <div className="flex items-center gap-3 sm:gap-8">
            <div className="text-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted text-foreground font-bold text-sm sm:text-base flex items-center justify-center mb-1 sm:mb-2">
                ✓
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t.basket}</p>
            </div>
            <div className="w-6 sm:w-12 h-1 bg-muted" />
            <div className="text-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground font-bold text-sm sm:text-base flex items-center justify-center mb-1 sm:mb-2">
                2
              </div>
              <p className="text-[10px] sm:text-xs text-foreground font-semibold">{t.checkout}</p>
            </div>
            <div className="w-6 sm:w-12 h-1 bg-muted" />
            <div className="text-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted text-muted-foreground font-bold text-sm sm:text-base flex items-center justify-center mb-1 sm:mb-2">
                3
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t.confirmation}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Checkout Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-8">
            {/* Error Display */}
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm">
                {error}
              </div>
            )}

            {/* Delivery Address Section */}
            <div className="card-premium p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-2xl font-bold text-foreground">
                  {t.deliveryAddress}
                </h2>
                <button
                  onClick={handleOpenAddModal}
                  className="text-primary hover:text-primary/80 text-xs sm:text-sm font-semibold flex items-center gap-1"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden xs:inline">{t.addNewAddress}</span>
                  <span className="xs:hidden">{isRTL ? 'إضافة' : 'Add'}</span>
                </button>
              </div>

              {isLoadingAddresses ? (
                <div className="text-center py-6 sm:py-8">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2 text-sm">{isRTL ? 'جاري تحميل العناوين...' : 'Loading addresses...'}</p>
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-6 sm:py-8 border-2 border-dashed border-border rounded-lg">
                  <div className="text-3xl sm:text-4xl mb-2">📍</div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">{t.noAddresses}</p>
                  <button
                    onClick={handleOpenAddModal}
                    className="btn-primary px-4 sm:px-6 py-2 text-sm"
                  >
                    {t.addFirstAddress}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      onClick={() => setSelectedAddressId(address.id)}
                      className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedAddressId === address.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                        }`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1 ${selectedAddressId === address.id
                              ? "border-primary bg-primary"
                              : "border-border"
                            }`}
                        >
                          {selectedAddressId === address.id && (
                            <svg className="w-2 h-2 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-foreground text-sm sm:text-base">{address.label}</span>
                            {address.isDefault && (
                              <span className="px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary text-[10px] sm:text-xs rounded-full font-medium">
                                {t.default}
                              </span>
                            )}
                            {address.latitude && address.longitude && (
                              <span className="px-1.5 sm:px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] sm:text-xs rounded-full font-medium flex items-center gap-0.5 sm:gap-1">
                                📍 <span className="hidden xs:inline">Located</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-foreground">{address.fullName}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
                            {address.building}, {address.street}
                            {address.floor && `, ${isRTL ? 'الطابق' : 'Floor'} ${address.floor}`}
                            {address.apartment && `, ${isRTL ? 'شقة' : 'Apt'} ${address.apartment}`}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {address.area}, {address.emirate}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{address.mobile}</p>

                          {/* Mini Map Preview - hidden on mobile */}
                          <div className="hidden sm:block">
                            <AddressMapPreview latitude={address.latitude} longitude={address.longitude} />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                          {/* View on Map button */}
                          {address.latitude && address.longitude && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingAddress(address);
                              }}
                              className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="View on Map"
                            >
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(address);
                            }}
                            className="p-1.5 sm:p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {addresses.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAddress(address.id);
                              }}
                              className="p-1.5 sm:p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preferred Delivery Time Slot Section */}
            <div className="card-premium p-4 sm:p-6">
              <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">
                {language === "ar" ? "وقت التوصيل المفضل" : "Preferred Delivery Time"}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                {language === "ar"
                  ? "اختر اليوم والوقت الأنسب لاستلام طلبك"
                  : "Choose your preferred date and time for delivery"}
              </p>

              {/* Date and Time Selection - Hidden when Express Delivery is selected */}
              {!isExpressDelivery && (
                <>
                  {/* Date Selection */}
                  <div className="mb-4 sm:mb-6">
                    <label className="block text-xs sm:text-sm font-semibold text-foreground mb-2 sm:mb-3">
                      {language === "ar" ? "📅 اختر اليوم" : "📅 Select Date"}
                    </label>
                    <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:-mx-2 sm:px-2">
                      {deliveryDates.map((dateInfo, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedDateIndex(index);
                            setSelectedTimeSlotId(null); // Reset time slot when date changes
                          }}
                          className={`flex-shrink-0 min-w-[80px] sm:min-w-[100px] p-2 sm:p-3 rounded-xl border-2 transition-all text-center ${selectedDateIndex === index
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:border-primary/50 text-foreground"
                            }`}
                        >
                          <div className="font-semibold text-xs sm:text-sm">
                            {language === "ar" ? dateInfo.dayLabelAr : dateInfo.dayLabel}
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            {language === "ar" ? dateInfo.dateLabelAr : dateInfo.dateLabel}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Slot Selection */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-foreground mb-2 sm:mb-3">
                      {language === "ar" ? "🕐 اختر الوقت" : "🕐 Select Time Slot"}
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {deliveryDates[selectedDateIndex]?.slots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedTimeSlotId(slot.id)}
                          className={`p-2.5 sm:p-4 rounded-xl border-2 transition-all text-left ${selectedTimeSlotId === slot.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50"
                            }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedTimeSlotId === slot.id
                                  ? "border-primary bg-primary"
                                  : "border-border"
                                }`}
                            >
                              {selectedTimeSlotId === slot.id && (
                                <svg className="w-2 h-2 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className={`font-medium text-xs sm:text-sm ${selectedTimeSlotId === slot.id ? "text-primary" : "text-foreground"}`}>
                                {language === "ar" ? slot.labelAr : slot.label}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Time Summary */}
                  {selectedTimeSlotId && (
                    <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs sm:text-sm font-medium">
                          {language === "ar" ? "موعد التوصيل المحدد:" : "Scheduled Delivery:"}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-green-600 dark:text-green-500 mt-1 mr-6 sm:mr-7">
                        {getSelectedDeliverySlotInfo()}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Express Delivery Option - only show if zone has express enabled */}
              {expressEnabled && (
                <div className="mt-4 sm:mt-6 pt-4 border-t border-border">
                  <div
                    onClick={() => setIsExpressDelivery(!isExpressDelivery)}
                    className={`p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all ${isExpressDelivery
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-border hover:border-orange-300"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isExpressDelivery
                            ? "border-orange-500 bg-orange-500"
                            : "border-border"
                          }`}
                      >
                        {isExpressDelivery && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚡</span>
                          <h3 className="font-semibold text-foreground text-sm sm:text-base">
                            {language === "ar" ? "توصيل سريع" : "Express Delivery"}
                          </h3>
                          <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                            {language === "ar" ? "سريع" : "FAST"}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          {language === "ar"
                            ? `احصل على طلبك خلال ${expressHours} ساعات! رسوم إضافية ${expressDeliveryFee} درهم`
                            : `Get your order within ${expressHours} hours! Additional AED ${expressDeliveryFee} fee`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-600 dark:text-orange-400">+AED {expressDeliveryFee}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Driver Tip Section */}
            <div className="card-premium p-4 sm:p-6">
              <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-2">
                {language === "ar" ? "إكرامية للسائق" : "Tip Your Driver"}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                {language === "ar"
                  ? "100% من الإكرامية تذهب للسائق 💚"
                  : "100% of your tip goes to the driver 💚"}
              </p>

              <div className="flex gap-2 flex-wrap">
                {tipOptions.map((tip) => (
                  <button
                    key={tip}
                    type="button"
                    onClick={() => setDriverTip(tip)}
                    className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${driverTip === tip
                        ? "bg-primary text-white"
                        : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                  >
                    {tip === 0
                      ? (language === "ar" ? "لا شكراً" : "No tip")
                      : `AED ${tip}`
                    }
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const customTip = prompt(language === "ar" ? "أدخل مبلغ الإكرامية:" : "Enter tip amount:");
                    if (customTip) {
                      const amount = parseFloat(customTip);
                      if (!isNaN(amount) && amount >= 0) {
                        setDriverTip(amount);
                      }
                    }
                  }}
                  className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${!tipOptions.includes(driverTip) && driverTip > 0
                      ? "bg-primary text-white"
                      : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                >
                  {!tipOptions.includes(driverTip) && driverTip > 0
                    ? `AED ${driverTip}`
                    : (language === "ar" ? "مبلغ آخر" : "Other")}
                </button>
              </div>

              {driverTip > 0 && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
                  <span className="text-xl">🙏</span>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    {language === "ar"
                      ? `شكراً لك! سيحصل السائق على ${driverTip} درهم إكرامية`
                      : `Thank you! Your driver will receive AED ${driverTip} tip`}
                  </p>
                </div>
              )}
            </div>

            {/* Payment Method Selection */}
            <div className="card-premium p-4 sm:p-6">
              <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">
                {language === "ar" ? "طريقة الدفع" : "Payment Method"}
              </h2>

              <div className="space-y-3 sm:space-y-4">
                {/* Credit Card Option */}
                <div
                  onClick={() => handlePaymentMethodSelect("card")}
                  className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === "card"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                    }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1 ${paymentMethod === "card"
                          ? "border-primary bg-primary"
                          : "border-border"
                        }`}
                    >
                      {paymentMethod === "card" && (
                        <svg
                          className="w-2 h-2 sm:w-3 sm:h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base">
                        {t.payWithCard}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                        {isRTL ? 'ادفع بأمان باستخدام فيزا، ماستركارد، أو أمريكان إكسبريس' : 'Pay securely with Visa, Mastercard, or American Express'}
                      </p>
                    </div>
                    <div className="text-xl sm:text-2xl">💳</div>
                  </div>
                </div>

                {/* Cash on Delivery Option */}
                <div
                  onClick={() => handlePaymentMethodSelect("cod")}
                  className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === "cod"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                    }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1 ${paymentMethod === "cod"
                          ? "border-primary bg-primary"
                          : "border-border"
                        }`}
                    >
                      {paymentMethod === "cod" && (
                        <svg
                          className="w-2 h-2 sm:w-3 sm:h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base">
                        {t.cashOnDelivery}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                        {t.payWhenReceive}
                      </p>
                    </div>
                    <div className="text-xl sm:text-2xl">💵</div>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              {paymentMethod && (
                <button
                  onClick={
                    paymentMethod === "card"
                      ? handleCardPayment
                      : handleCODPayment
                  }
                  disabled={isProcessing || !selectedAddressId || (!isExpressDelivery && !selectedTimeSlotId)}
                  className="w-full btn-primary py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base mt-4 sm:mt-6 disabled:opacity-50 transition-all"
                >
                  {isProcessing
                    ? (language === "ar" ? "جاري المعالجة..." : "Processing...")
                    : !selectedAddressId
                      ? (language === "ar" ? "اختر عنوان التوصيل" : "Select a Delivery Address")
                      : (!isExpressDelivery && !selectedTimeSlotId)
                        ? (language === "ar" ? "اختر موعد التوصيل" : "Select a Delivery Time")
                        : paymentMethod === "card"
                          ? (language === "ar" ? "المتابعة للدفع" : "Continue to Payment")
                          : (language === "ar" ? "تأكيد الطلب" : "Confirm Order")}
                </button>
              )}
            </div>

            {/* Order Info */}
            <div className="card-premium p-3 sm:p-6 bg-secondary/10">
              <p className="text-xs sm:text-sm text-muted-foreground">
                ℹ️ Your order will be processed securely. No card details are
                stored on our servers.
              </p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card-premium p-4 sm:p-6 sticky top-24 space-y-3 sm:space-y-4">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                {t.orderSummary}
              </h2>

              {/* Selected Address Preview */}
              {selectedAddress && (
                <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm">
                  <p className="font-medium text-foreground mb-1">{isRTL ? 'التوصيل إلى:' : 'Delivering to:'}</p>
                  <p className="text-muted-foreground">{selectedAddress.fullName}</p>
                  <p className="text-muted-foreground">{selectedAddress.area}, {selectedAddress.emirate}</p>
                </div>
              )}

              {/* Items */}
              <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto border-b border-border pb-3 sm:pb-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center text-xs sm:text-sm"
                  >
                    <span className="text-muted-foreground line-clamp-1 flex-1 mr-2">
                      {getItemName(item)} x {formatWeightDisplay(item.quantity)}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      <PriceDisplay price={item.price * item.quantity} size="sm" />
                    </span>
                  </div>
                ))}
              </div>

              {/* Promo Code Section */}
              <div className="border-b border-border pb-3 sm:pb-4">
                <label className="block text-xs sm:text-sm font-medium text-foreground mb-2">
                  {t.promoCode}
                </label>
                {promoApplied ? (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5 sm:p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">🎉</span>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-400">
                          {promoApplied.code}
                        </p>
                        <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-500">
                          {promoApplied.type === "percent"
                            ? `${promoApplied.discount}% ${isRTL ? 'خصم' : 'off'}`
                            : `${isRTL ? 'خصم' : 'AED'} ${promoApplied.discount} ${isRTL ? 'درهم' : 'off'}`
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemovePromo}
                      className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      {t.remove}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder={t.promoPlaceholder}
                      className="flex-1 px-3 py-2 text-xs sm:text-sm border border-border rounded-lg focus:border-primary outline-none"
                    />
                    <button
                      onClick={handleApplyPromo}
                      disabled={!promoCode.trim() || isApplyingPromo}
                      className="px-3 sm:px-4 py-2 bg-primary text-primary-foreground text-xs sm:text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {isApplyingPromo ? t.applying : t.apply}
                    </button>
                  </div>
                )}
                {promoError && (
                  <p className="text-[10px] sm:text-xs text-red-600 mt-1.5">{promoError}</p>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t.subtotal}</span>
                  <span className="font-semibold"><PriceDisplay price={subtotal} size="md" /></span>
                </div>
                {promoApplied && discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600 dark:text-green-400">{t.discount}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      -<PriceDisplay price={discountAmount} size="md" />
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center bg-secondary/10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 text-sm">
                  <span className="text-muted-foreground">{t.vat}</span>
                  <span className="font-semibold text-secondary">
                    <PriceDisplay price={adjustedVat} size="md" />
                  </span>
                </div>
                {/* Show either zone delivery fee OR express delivery fee, not both */}
                {isExpressDelivery ? (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      ⚡ {isRTL ? "توصيل سريع" : "Express Delivery"}
                    </span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                      +<PriceDisplay price={expressDeliveryFee} size="md" />
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      🚚 {t.deliveryFee}
                      {matchedZone && (
                        <span className="text-xs text-muted-foreground/70">
                          ({language === "ar" ? matchedZone.nameAr : matchedZone.name})
                        </span>
                      )}
                    </span>
                    <span className="font-semibold">
                      {zoneDeliveryFee === 0 ? (
                        <span className="text-green-600 dark:text-green-400">{isRTL ? 'مجاني' : 'FREE'}</span>
                      ) : (
                        <>+<PriceDisplay price={zoneDeliveryFee} size="md" /></>
                      )}
                    </span>
                  </div>
                )}
                {driverTip > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      💚 {isRTL ? "إكرامية السائق" : "Driver Tip"}
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      +<PriceDisplay price={driverTip} size="md" />
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-base sm:text-lg font-bold text-foreground">
                    {t.total}
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">
                    <PriceDisplay price={adjustedTotal} size="lg" />
                  </span>
                </div>
              </div>

              {/* Back to Basket */}
              <button
                onClick={() => navigate("/basket")}
                className="btn-outline w-full py-2 text-xs sm:text-sm rounded-lg"
              >
                {isRTL ? 'العودة للسلة' : 'Back to Basket'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">
                  {editingAddress ? t.editAddress : t.addNewAddress}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Address Label */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t.addressLabel} *
                </label>
                <div className="flex gap-2">
                  {[
                    { key: "Home", label: t.home },
                    { key: "Office", label: t.work },
                    { key: "Other", label: t.other }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setAddressForm({ ...addressForm, label: item.key })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${addressForm.label === item.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t.fullName}<span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.fullName}
                  onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground placeholder-muted-foreground focus:outline-none"
                  placeholder={isRTL ? "الاسم الكامل" : "John Doe"}
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t.mobileNumber}<span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  value={addressForm.mobile}
                  onChange={(e) => setAddressForm({ ...addressForm, mobile: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground placeholder-muted-foreground focus:outline-none"
                  placeholder="+971 50 123 4567"
                />
              </div>

              {/* Map Location Picker */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t.selectLocation}
                  {addressForm.latitude && addressForm.longitude && (
                    <span className={cn("text-green-600 font-normal", isRTL ? "mr-2" : "ml-2")}>✓ {isRTL ? 'تم التحديد' : 'Located'}</span>
                  )}
                </label>
                <MapPicker
                  latitude={addressForm.latitude}
                  longitude={addressForm.longitude}
                  onLocationSelect={handleLocationSelect}
                />
              </div>

              {/* Emirate */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t.emirate}<span className="text-destructive">*</span>
                </label>
                <select
                  value={addressForm.emirate}
                  onChange={(e) => setAddressForm({ ...addressForm, emirate: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground focus:outline-none"
                >
                  <option value="">{t.selectEmirate}</option>
                  <option value="Dubai">{emirates.dubai}</option>
                  <option value="Abu Dhabi">{emirates.abuDhabi}</option>
                  <option value="Sharjah">{emirates.sharjah}</option>
                  <option value="Ajman">{emirates.ajman}</option>
                  <option value="Ras Al Khaimah">{emirates.rasAlKhaimah}</option>
                  <option value="Fujairah">{emirates.fujairah}</option>
                  <option value="Umm Al Quwain">{emirates.ummAlQuwain}</option>
                </select>
              </div>

              {/* Area / Neighborhood */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t.area}<span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.area}
                  onChange={(e) => setAddressForm({ ...addressForm, area: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground placeholder-muted-foreground focus:outline-none"
                  placeholder={isRTL ? "مثال: البرشاء، جميرا، داون تاون" : "e.g., Al Barsha, Jumeirah, Downtown"}
                />
              </div>

              {/* Street */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t.street}<span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground placeholder-muted-foreground focus:outline-none"
                  placeholder={isRTL ? "اسم الشارع" : "Street name"}
                />
              </div>

              {/* Building Name / Number */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {t.building}<span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.building}
                  onChange={(e) => setAddressForm({ ...addressForm, building: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground placeholder-muted-foreground focus:outline-none"
                  placeholder={isRTL ? "اسم أو رقم المبنى" : "Building name or number"}
                />
              </div>

              {/* Floor and Apartment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t.floor}
                  </label>
                  <input
                    type="text"
                    value={addressForm.floor}
                    onChange={(e) => setAddressForm({ ...addressForm, floor: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground placeholder-muted-foreground focus:outline-none"
                    placeholder={t.optional}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t.apartment}
                  </label>
                  <input
                    type="text"
                    value={addressForm.apartment}
                    onChange={(e) => setAddressForm({ ...addressForm, apartment: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border-2 border-input bg-white focus:border-primary text-foreground placeholder-muted-foreground focus:outline-none"
                    placeholder={t.optional}
                  />
                </div>
              </div>

              {/* Set as Default */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  className="w-5 h-5 text-primary border-input rounded focus:ring-primary"
                />
                <label htmlFor="isDefault" className="text-sm font-medium text-foreground">
                  {t.setDefault}
                </label>
              </div>

              {/* Location Confirmation */}
              {addressForm.latitude && addressForm.longitude && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium">{isRTL ? 'تم تأكيد الموقع' : 'Location confirmed'}</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    {isRTL ? 'خط العرض' : 'Lat'}: {addressForm.latitude.toFixed(6)}, {isRTL ? 'خط الطول' : 'Lng'}: {addressForm.longitude.toFixed(6)}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAddress}
                  disabled={isSavingAddress}
                  className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSavingAddress ? t.saving : editingAddress ? (isRTL ? 'تحديث العنوان' : 'Update Address') : t.saveAddress}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Location Modal */}
      {viewingAddress && (
        <AddressLocationViewer
          address={viewingAddress}
          onClose={() => setViewingAddress(null)}
        />
      )}
    </div>
  );
}
