import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Settings, 
  Bell, 
  CreditCard,
  Gift,
  Heart,
  Package,
  LogOut,
  ChevronRight,
  Edit2,
  Save,
  X,
  Globe,
  Star,
  Award,
  Copy,
  Check,
  Navigation,
  Loader2,
  RefreshCw
} from "lucide-react";
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
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useWishlist } from "@/context/WishlistContext";
import { useLoyalty } from "@/context/LoyaltyContext";
import { useOrders } from "@/context/OrdersContext";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { cn } from "@/lib/utils";
import { addressesApi, UserAddress } from "@/lib/api";

type TabType = "profile" | "addresses" | "preferences" | "loyalty" | "wishlist";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, isAuthLoading, updateUser, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { items: wishlistItems, removeFromWishlist, ensureLoaded: ensureWishlistLoaded } = useWishlist();
  const { points, currentTier, nextTier, pointsToNextTier, transactions, referralCode, applyReferral, ensureLoaded: ensureLoyaltyLoaded } = useLoyalty();
  const { orders } = useOrders();
  const isRTL = language === "ar";

  // Lazy load wishlist and loyalty data when needed
  useEffect(() => {
    if (isLoggedIn) {
      ensureWishlistLoaded();
      ensureLoyaltyLoaded();
    }
  }, [isLoggedIn, ensureWishlistLoaded, ensureLoyaltyLoaded]);

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || "",
    familyName: user?.familyName || "",
    email: user?.email || "",
    mobile: user?.mobile || "",
  });
  const [referralInput, setReferralInput] = useState("");
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralMessage, setReferralMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Array<{
    id: string;
    label: string;
    fullName: string;
    mobile: string;
    emirate: string;
    area: string;
    street: string;
    building: string;
    floor?: string;
    apartment?: string;
    isDefault: boolean;
  }>>([]);
  const [addressForm, setAddressForm] = useState({
    label: "Home",
    fullName: user?.firstName && user?.familyName ? `${user.firstName} ${user.familyName}` : "",
    mobile: user?.mobile || "",
    emirate: user?.emirate || "",
    area: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    isDefault: true,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Load saved addresses from database
  useEffect(() => {
    const loadAddresses = async () => {
      if (user?.id) {
        try {
          const response = await addressesApi.getAll(user.id);
          if (response.success && response.data) {
            setSavedAddresses(response.data);
          }
        } catch (error) {
          console.error("Error loading addresses:", error);
          setSavedAddresses([]);
        }
      }
    };
    loadAddresses();
  }, [user?.id]);

  // Initialize map when form is shown and location is set
  useEffect(() => {
    if (!showAddressForm || !mapContainerRef.current) return;
    if (leafletMapRef.current) return; // Already initialized

    // Default to Dubai if no location set
    const lat = addressForm.latitude || 25.2048;
    const lng = addressForm.longitude || 55.2708;

    leafletMapRef.current = L.map(mapContainerRef.current).setView([lat, lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(leafletMapRef.current);

    // Handle marker drag
    markerRef.current.on("dragend", async () => {
      const pos = markerRef.current?.getLatLng();
      if (pos) {
        setAddressForm(prev => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
        await reverseGeocodeAndFillAddress(pos.lat, pos.lng);
      }
    });

    // Handle map click
    leafletMapRef.current.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      setAddressForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
      await reverseGeocodeAndFillAddress(lat, lng);
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [showAddressForm]);

  // Update marker when location changes externally
  useEffect(() => {
    if (markerRef.current && addressForm.latitude && addressForm.longitude) {
      markerRef.current.setLatLng([addressForm.latitude, addressForm.longitude]);
      leafletMapRef.current?.setView([addressForm.latitude, addressForm.longitude], 15);
    }
  }, [addressForm.latitude, addressForm.longitude]);

  // Reverse geocode to get address components
  const reverseGeocodeAndFillAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await response.json();
      
      if (data.address) {
        const addr = data.address;
        const area = addr.suburb || addr.neighbourhood || addr.district || addr.city_district || "";
        const street = addr.road || addr.street || "";
        const building = addr.house_number || "";
        
        let emirate = "";
        const city = (addr.city || addr.town || addr.state || "").toLowerCase();
        if (city.includes("dubai")) emirate = "Dubai";
        else if (city.includes("abu dhabi")) emirate = "Abu Dhabi";
        else if (city.includes("sharjah")) emirate = "Sharjah";
        else if (city.includes("ajman")) emirate = "Ajman";
        else if (city.includes("ras al")) emirate = "Ras Al Khaimah";
        else if (city.includes("fujairah")) emirate = "Fujairah";
        else if (city.includes("umm al")) emirate = "Umm Al Quwain";

        setAddressForm(prev => ({
          ...prev,
          area: area || prev.area,
          street: street || prev.street,
          building: building || prev.building,
          emirate: emirate || prev.emirate,
        }));
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    }
  };

  // Auto-detect user's current location
  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(isRTL ? "المتصفح لا يدعم تحديد الموقع" : "Geolocation is not supported by your browser");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setAddressForm(prev => ({ ...prev, latitude, longitude }));
        setIsDetectingLocation(false);
        
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([latitude, longitude], 16);
        }
        
        await reverseGeocodeAndFillAddress(latitude, longitude);
      },
      (error) => {
        console.error("Location detection failed:", error);
        setIsDetectingLocation(false);
        alert(isRTL ? "فشل تحديد الموقع. يرجى المحاولة مرة أخرى" : "Failed to detect location. Please try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Close address form and cleanup map
  const closeAddressForm = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      markerRef.current = null;
    }
    setAddressForm({
      label: "Home",
      fullName: user?.firstName && user?.familyName ? `${user.firstName} ${user.familyName}` : "",
      mobile: user?.mobile || "",
      emirate: user?.emirate || "",
      area: "",
      street: "",
      building: "",
      floor: "",
      apartment: "",
      isDefault: false,
      latitude: undefined,
      longitude: undefined,
    });
    setShowAddressForm(false);
  };

  // Save address handler
  const handleSaveAddress = async () => {
    if (!addressForm.fullName || !addressForm.mobile || !addressForm.emirate || !addressForm.area || !addressForm.street || !addressForm.building) {
      alert(isRTL ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill in all required fields");
      return;
    }
    
    if (!user?.id) {
      alert(isRTL ? "يرجى تسجيل الدخول أولاً" : "Please log in first");
      return;
    }
    
    try {
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
        latitude: addressForm.latitude,
        longitude: addressForm.longitude,
        isDefault: addressForm.isDefault,
      });
      
      if (response.success && response.data) {
        // Reload addresses from server to get updated list
        const refreshed = await addressesApi.getAll(user.id);
        if (refreshed.success && refreshed.data) {
          setSavedAddresses(refreshed.data);
        }
        // Only close form on success
        closeAddressForm();
      } else {
        // Show error message from server
        alert(isRTL ? (response.error || "فشل حفظ العنوان") : (response.error || "Failed to save address"));
      }
    } catch (error) {
      console.error("Error saving address:", error);
      alert(isRTL ? "حدث خطأ أثناء حفظ العنوان" : "An error occurred while saving the address");
    }
  };

  // Delete address handler
  const handleDeleteAddress = async (addressId: string) => {
    if (!user?.id) return;
    try {
      await addressesApi.delete(user.id, addressId);
      setSavedAddresses(prev => prev.filter(addr => addr.id !== addressId));
    } catch (error) {
      console.error("Error deleting address:", error);
    }
  };

  // Set default address handler
  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user?.id) return;
    try {
      await addressesApi.setDefault(user.id, addressId);
      setSavedAddresses(prev => prev.map(addr => ({
        ...addr,
        isDefault: addr.id === addressId,
      })));
    } catch (error) {
      console.error("Error setting default address:", error);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      navigate("/login");
    }
  }, [isLoggedIn, isAuthLoading, navigate]);

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

  useEffect(() => {
    if (user) {
      setEditForm({
        firstName: user.firstName,
        familyName: user.familyName,
        email: user.email,
        mobile: user.mobile,
      });
    }
  }, [user]);

  const translations = {
    en: {
      myAccount: "My Account",
      subtitle: "Manage your profile and preferences",
      profile: "Profile",
      addresses: "Addresses",
      preferences: "Preferences",
      loyalty: "Loyalty",
      wishlist: "Wishlist",
      personalInfo: "Personal Information",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      mobile: "Mobile",
      emirate: "Emirate",
      logout: "Logout",
      savedAddresses: "Saved Addresses",
      addAddress: "Add Address",
      noAddresses: "No saved addresses",
      defaultAddress: "Default",
      settings: "Settings",
      language: "Language",
      notifications: "Notifications",
      emailNotifications: "Email Notifications",
      smsNotifications: "SMS Notifications",
      loyaltyProgram: "Loyalty Program",
      yourPoints: "Your Points",
      currentTier: "Current Tier",
      pointsToNextTier: "Points to next tier",
      earnedPoints: "Total Earned",
      recentActivity: "Recent Activity",
      noActivity: "No activity yet",
      referralCode: "Your Referral Code",
      copyCode: "Copy",
      copied: "Copied!",
      applyReferral: "Have a referral code?",
      apply: "Apply",
      wishlistEmpty: "Your wishlist is empty",
      addToCart: "Add to Cart",
      remove: "Remove",
      viewOrders: "View Orders",
      totalOrders: "Total Orders",
      memberSince: "Member Since",
      addNewAddress: "Add New Address",
      addressLabel: "Address Label",
      fullName: "Full Name",
      area: "Area",
      street: "Street Address",
      building: "Building Name/Number",
      floor: "Floor (Optional)",
      apartment: "Apartment (Optional)",
      setAsDefault: "Set as default address",
      saveAddress: "Save Address",
      home: "Home",
      work: "Work",
      other: "Other",
      selectEmirate: "Select Emirate",
      detectLocation: "Detect My Location",
      detectingLocation: "Detecting...",
      pinLocation: "Pin Your Location",
      pinLocationHint: "Click on the map or drag the marker to set your exact location",
    },
    ar: {
      myAccount: "حسابي",
      subtitle: "إدارة ملفك الشخصي وإعداداتك",
      profile: "الملف الشخصي",
      addresses: "العناوين",
      preferences: "الإعدادات",
      loyalty: "الولاء",
      wishlist: "المفضلة",
      personalInfo: "المعلومات الشخصية",
      edit: "تعديل",
      save: "حفظ",
      cancel: "إلغاء",
      firstName: "الاسم الأول",
      lastName: "اسم العائلة",
      email: "البريد الإلكتروني",
      mobile: "الجوال",
      emirate: "الإمارة",
      logout: "تسجيل الخروج",
      savedAddresses: "العناوين المحفوظة",
      addAddress: "إضافة عنوان",
      noAddresses: "لا توجد عناوين محفوظة",
      defaultAddress: "الافتراضي",
      settings: "الإعدادات",
      language: "اللغة",
      notifications: "الإشعارات",
      emailNotifications: "إشعارات البريد الإلكتروني",
      smsNotifications: "إشعارات SMS",
      loyaltyProgram: "برنامج الولاء",
      yourPoints: "نقاطك",
      currentTier: "المستوى الحالي",
      pointsToNextTier: "نقاط للمستوى التالي",
      earnedPoints: "إجمالي المكتسب",
      recentActivity: "النشاط الأخير",
      noActivity: "لا يوجد نشاط حتى الآن",
      referralCode: "كود الإحالة الخاص بك",
      copyCode: "نسخ",
      copied: "تم النسخ!",
      applyReferral: "هل لديك كود إحالة؟",
      apply: "تطبيق",
      wishlistEmpty: "قائمة المفضلة فارغة",
      addToCart: "أضف للسلة",
      remove: "حذف",
      viewOrders: "عرض الطلبات",
      totalOrders: "إجمالي الطلبات",
      memberSince: "عضو منذ",
      addNewAddress: "إضافة عنوان جديد",
      addressLabel: "تسمية العنوان",
      fullName: "الاسم الكامل",
      area: "المنطقة",
      street: "عنوان الشارع",
      building: "اسم/رقم المبنى",
      floor: "الطابق (اختياري)",
      apartment: "الشقة (اختياري)",
      setAsDefault: "تعيين كعنوان افتراضي",
      saveAddress: "حفظ العنوان",
      home: "المنزل",
      work: "العمل",
      other: "آخر",
      selectEmirate: "اختر الإمارة",
      detectLocation: "تحديد موقعي",
      detectingLocation: "جاري التحديد...",
      pinLocation: "حدد موقعك",
      pinLocationHint: "انقر على الخريطة أو اسحب العلامة لتحديد موقعك الدقيق",
    },
  };

  const t = translations[language];

  const handleSaveProfile = () => {
    updateUser({
      firstName: editForm.firstName,
      familyName: editForm.familyName,
      email: editForm.email,
      mobile: editForm.mobile,
    });
    setIsEditing(false);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const handleApplyReferral = async () => {
    if (!referralInput.trim()) return;
    const result = await applyReferral(referralInput.trim().toUpperCase());
    setReferralMessage({ type: result.success ? "success" : "error", text: result.message });
    if (result.success) {
      setReferralInput("");
    }
    setTimeout(() => setReferralMessage(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!isLoggedIn || !user) {
    return null;
  }

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: t.profile, icon: User },
    { id: "addresses", label: t.addresses, icon: MapPin },
    { id: "preferences", label: t.preferences, icon: Settings },
    { id: "loyalty", label: t.loyalty, icon: Award },
    { id: "wishlist", label: t.wishlist, icon: Heart },
  ];

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2">{t.myAccount}</h1>
            <p className="text-muted-foreground">{t.subtitle}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            title={language === "ar" ? "تحديث" : "Refresh"}
          >
            <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card-premium p-4 space-y-2">
              {/* User Info */}
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {user.firstName.charAt(0)}{user.familyName.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {user.firstName} {user.familyName}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              {/* Tabs */}
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                    {tab.id === "wishlist" && wishlistItems.length > 0 && (
                      <span className={cn(
                        "ml-auto text-xs px-2 py-0.5 rounded-full",
                        activeTab === tab.id ? "bg-white/20" : "bg-primary text-primary-foreground"
                      )}>
                        {wishlistItems.length}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Orders Link */}
              <button
                onClick={() => navigate("/orders")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <Package className="w-5 h-5" />
                <span className="font-medium">{t.viewOrders}</span>
                <ChevronRight className={cn("w-4 h-4 ml-auto", isRTL && "rotate-180")} />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors mt-4"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">{t.logout}</span>
              </button>
            </div>

            {/* Quick Stats */}
            <div className="card-premium p-4 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.totalOrders}</span>
                <span className="font-bold text-foreground">{orders.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.yourPoints}</span>
                <span className="font-bold text-primary">{points.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.memberSince}</span>
                <span className="font-medium text-foreground">2025</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">{t.personalInfo}</h2>
                  {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="btn-outline flex items-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      {t.edit}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleSaveProfile} className="btn-primary flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        {t.save}
                      </button>
                      <button onClick={() => setIsEditing(false)} className="btn-outline flex items-center gap-2">
                        <X className="w-4 h-4" />
                        {t.cancel}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.firstName}</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.lastName}</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.familyName}
                        onChange={(e) => setEditForm({ ...editForm, familyName: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.familyName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.email}</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.mobile}</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editForm.mobile}
                        onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.mobile}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.emirate}</label>
                    <p className="text-foreground font-medium">{user.emirate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === "addresses" && (
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">{t.savedAddresses}</h2>
                  {!showAddressForm && (
                    <button onClick={() => setShowAddressForm(true)} className="btn-primary flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {t.addAddress}
                    </button>
                  )}
                </div>

                {/* Add New Address Form */}
                {showAddressForm && (
                  <div className="border border-border rounded-xl p-4 mb-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{t.addNewAddress}</h3>
                      <button
                        onClick={closeAddressForm}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Address Label */}
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">{t.addressLabel}</label>
                      <div className="flex gap-2">
                        {["Home", "Work", "Other"].map((label) => (
                          <button
                            key={label}
                            onClick={() => setAddressForm({ ...addressForm, label })}
                            className={cn(
                              "px-4 py-2 rounded-lg font-medium transition-colors",
                              addressForm.label === label
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            {label === "Home" ? t.home : label === "Work" ? t.work : t.other}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Map Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-muted-foreground">{t.pinLocation}</label>
                        <button
                          type="button"
                          onClick={detectCurrentLocation}
                          disabled={isDetectingLocation}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {isDetectingLocation ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t.detectingLocation}
                            </>
                          ) : (
                            <>
                              <Navigation className="w-4 h-4" />
                              {t.detectLocation}
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{t.pinLocationHint}</p>
                      <div 
                        ref={mapContainerRef} 
                        className="h-[250px] rounded-lg border border-border overflow-hidden"
                        style={{ zIndex: 0 }}
                      />
                    </div>

                    {/* Full Name & Mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.fullName} *</label>
                        <input
                          type="text"
                          value={addressForm.fullName}
                          onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.mobile} *</label>
                        <input
                          type="tel"
                          value={addressForm.mobile}
                          onChange={(e) => setAddressForm({ ...addressForm, mobile: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Emirate & Area */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.emirate} *</label>
                        <select
                          value={addressForm.emirate}
                          onChange={(e) => setAddressForm({ ...addressForm, emirate: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none bg-background"
                          required
                        >
                          <option value="">{t.selectEmirate}</option>
                          <option value="Abu Dhabi">Abu Dhabi</option>
                          <option value="Dubai">Dubai</option>
                          <option value="Sharjah">Sharjah</option>
                          <option value="Ajman">Ajman</option>
                          <option value="Umm Al Quwain">Umm Al Quwain</option>
                          <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                          <option value="Fujairah">Fujairah</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.area} *</label>
                        <input
                          type="text"
                          value={addressForm.area}
                          onChange={(e) => setAddressForm({ ...addressForm, area: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Street & Building */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.street} *</label>
                        <input
                          type="text"
                          value={addressForm.street}
                          onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.building} *</label>
                        <input
                          type="text"
                          value={addressForm.building}
                          onChange={(e) => setAddressForm({ ...addressForm, building: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Floor & Apartment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.floor}</label>
                        <input
                          type="text"
                          value={addressForm.floor}
                          onChange={(e) => setAddressForm({ ...addressForm, floor: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">{t.apartment}</label>
                        <input
                          type="text"
                          value={addressForm.apartment}
                          onChange={(e) => setAddressForm({ ...addressForm, apartment: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    {/* Default Address Checkbox */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={addressForm.isDefault}
                        onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                        className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                      />
                      <label htmlFor="isDefault" className="text-sm font-medium text-muted-foreground">
                        {t.setAsDefault}
                      </label>
                    </div>

                    {/* Save Button */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleSaveAddress}
                        className="btn-primary flex-1"
                        disabled={!addressForm.fullName || !addressForm.mobile || !addressForm.emirate || !addressForm.area || !addressForm.street || !addressForm.building}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {t.saveAddress}
                      </button>
                      <button
                        onClick={closeAddressForm}
                        className="btn-outline flex-1"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                )}

                {/* Saved Addresses List */}
                {savedAddresses.length > 0 ? (
                  <div className="space-y-4">
                    {savedAddresses.map((address) => (
                      <div
                        key={address.id}
                        className={cn(
                          "border rounded-xl p-4 relative",
                          address.isDefault ? "border-primary bg-primary/5" : "border-border"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-muted rounded text-xs font-medium">
                              {address.label === "Home" ? t.home : address.label === "Work" ? t.work : t.other}
                            </span>
                            {address.isDefault && (
                              <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs font-medium">
                                {t.defaultAddress}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteAddress(address.id)}
                            className="text-destructive hover:text-destructive/80 text-sm font-medium"
                          >
                            {t.remove}
                          </button>
                        </div>
                        <p className="font-medium text-foreground">{address.fullName}</p>
                        <p className="text-muted-foreground text-sm">
                          {address.building}, {address.street}
                          {address.floor && `, Floor ${address.floor}`}
                          {address.apartment && `, Apt ${address.apartment}`}
                        </p>
                        <p className="text-muted-foreground text-sm">{address.area}, {address.emirate}</p>
                        <p className="text-muted-foreground text-sm">{address.mobile}</p>
                        {!address.isDefault && (
                          <button
                            onClick={() => handleSetDefaultAddress(address.id)}
                            className="text-primary hover:text-primary/80 text-sm font-medium mt-2"
                          >
                            {t.setAsDefault}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !showAddressForm && (
                    <p className="text-muted-foreground text-center py-8">{t.noAddresses}</p>
                  )
                )}
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === "preferences" && (
              <div className="card-premium p-6 space-y-6">
                <h2 className="text-xl font-bold text-foreground">{t.settings}</h2>

                <div className="space-y-4">
                  {/* Language */}
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t.language}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLanguage("en")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-medium transition-colors",
                          language === "en" ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}
                      >
                        English
                      </button>
                      <button
                        onClick={() => setLanguage("ar")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-medium transition-colors",
                          language === "ar" ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}
                      >
                        العربية
                      </button>
                    </div>
                  </div>

                  {/* Email Notifications */}
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t.emailNotifications}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* SMS Notifications */}
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t.smsNotifications}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Loyalty Tab */}
            {activeTab === "loyalty" && (
              <div className="space-y-6">
                {/* Loyalty Summary */}
                <div className="card-premium p-6">
                  <h2 className="text-xl font-bold text-foreground mb-6">{t.loyaltyProgram}</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-primary/10 rounded-xl">
                      <div className="text-4xl mb-2">{currentTier.icon}</div>
                      <p className="text-sm text-muted-foreground">{t.currentTier}</p>
                      <p className="font-bold text-lg text-foreground">
                        {isRTL ? currentTier.nameAr : currentTier.name}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-xl">
                      <Star className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t.yourPoints}</p>
                      <p className="font-bold text-2xl text-primary">{points.toLocaleString()}</p>
                    </div>
                    {nextTier && (
                      <div className="text-center p-4 bg-muted rounded-xl">
                        <div className="text-4xl mb-2">{nextTier.icon}</div>
                        <p className="text-sm text-muted-foreground">{t.pointsToNextTier}</p>
                        <p className="font-bold text-lg text-foreground">{pointsToNextTier.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Tier Progress */}
                  {nextTier && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>{isRTL ? currentTier.nameAr : currentTier.name}</span>
                        <span>{isRTL ? nextTier.nameAr : nextTier.name}</span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((points + (nextTier.minPoints - pointsToNextTier - points)) / nextTier.minPoints) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Referral Code */}
                  <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                    <p className="font-medium text-foreground">{t.referralCode}</p>
                    <div className="flex gap-2">
                      <code className="flex-1 px-4 py-2 bg-background rounded-lg font-mono text-lg">
                        {referralCode}
                      </code>
                      <button
                        onClick={handleCopyReferral}
                        className="btn-primary flex items-center gap-2"
                      >
                        {referralCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {referralCopied ? t.copied : t.copyCode}
                      </button>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">{t.applyReferral}</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                          placeholder="REF..."
                          className="flex-1 px-3 py-2 border border-border rounded-lg focus:border-primary outline-none font-mono"
                        />
                        <button onClick={handleApplyReferral} className="btn-outline">
                          {t.apply}
                        </button>
                      </div>
                      {referralMessage && (
                        <p className={cn("text-sm mt-2", referralMessage.type === "success" ? "text-green-600" : "text-destructive")}>
                          {referralMessage.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="card-premium p-6">
                  <h3 className="font-bold text-foreground mb-4">{t.recentActivity}</h3>
                  {transactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">{t.noActivity}</p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-foreground">{tx.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={cn(
                            "font-bold",
                            tx.points > 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {tx.points > 0 ? "+" : ""}{tx.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Wishlist Tab */}
            {activeTab === "wishlist" && (
              <div className="card-premium p-6">
                <h2 className="text-xl font-bold text-foreground mb-6">{t.wishlist}</h2>

                {wishlistItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t.wishlistEmpty}</p>
                    <button onClick={() => navigate("/products")} className="btn-primary mt-4">
                      {language === "ar" ? "تصفح المنتجات" : "Browse Products"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {wishlistItems.map((item) => (
                      <div key={item.id} className="flex gap-3 p-3 border border-border rounded-lg">
                        <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🥩</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate">
                            {isRTL && item.nameAr ? item.nameAr : item.name}
                          </h4>
                          <p className="text-primary font-bold">
                            <PriceDisplay price={item.price} size="sm" />
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => navigate(`/products/${item.productId}`)}
                              className="text-xs text-primary hover:underline"
                            >
                              {language === "ar" ? "عرض" : "View"}
                            </button>
                            <button
                              onClick={() => removeFromWishlist(item.productId)}
                              className="text-xs text-destructive hover:underline"
                            >
                              {t.remove}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
