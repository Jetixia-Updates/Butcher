/**
 * Settings Context
 * Manages all admin-configurable settings: VAT, delivery, promo codes, banners, loyalty, etc.
 * Now uses database API instead of localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { 
  settingsApi, 
  AppSettings as ApiAppSettings, 
  Banner as ApiBanner,
  DeliveryTimeSlot as ApiTimeSlot,
  PromoCode as ApiPromoCode,
} from "@/lib/api";

// Promo Code Type
export interface PromoCode {
  id: string;
  code: string;
  discount: number;
  type: "percent" | "fixed";
  minOrder?: number;
  maxDiscount?: number; // Maximum discount cap for percentage discounts
  maxUses?: number;
  usedCount: number;
  expiryDate?: string;
  enabled: boolean;
  description?: string;
  descriptionAr?: string;
}

// Banner Type
export interface Banner {
  id: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  image: string;
  bgColor: string;
  link: string;
  badge?: string;
  badgeAr?: string;
  enabled: boolean;
  order: number;
}

// Time Slot Type
export interface TimeSlot {
  id: string;
  start: string; // e.g., "09:00"
  end: string; // e.g., "12:00"
  enabled: boolean;
}

// Loyalty Tier Type
export interface LoyaltyTier {
  id: string;
  name: string;
  nameAr: string;
  minPoints: number;
  multiplier: number;
  color: string;
  icon: string;
  benefits: string[];
  benefitsAr: string[];
}

// Store Settings Type
export interface StoreSettings {
  // Store Info
  storeName: string;
  storeNameAr: string;
  contactEmail: string;
  contactPhone: string;
  
  // Tax Settings
  vatRate: number;
  taxRegistrationNumber: string;
  showVatOnInvoice: boolean;
  
  // Order Settings
  minOrderValue: number;
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;
  expressDeliveryFee: number;
  enableCOD: boolean;
  enableCardPayment: boolean;
  enableWalletPayment: boolean;
  
  // Tip Settings
  tipOptions: number[];
  enableTipping: boolean;
  
  // Wallet Settings
  welcomeBonus: number;
  enableWelcomeBonus: boolean;
  
  // Loyalty Settings
  pointsPerAed: number; // Points earned per AED spent
  pointsToAedRate: number; // How many points = 1 AED
  referralBonus: number;
  birthdayBonus: number;
  
  // Delivery Settings
  sameDayCutoffHours: number; // Hours before delivery for same-day cutoff
  maxAdvanceOrderDays: number;
  
  // Notifications
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  enablePushNotifications: boolean;
  enableLowStockAlerts: boolean;
}

interface SettingsContextType {
  // Store Settings
  settings: StoreSettings;
  updateSettings: (updates: Partial<StoreSettings>) => Promise<void>;
  
  // Promo Codes
  promoCodes: PromoCode[];
  addPromoCode: (code: Omit<PromoCode, "id" | "usedCount">) => Promise<void>;
  updatePromoCode: (id: string, updates: Partial<PromoCode>) => Promise<void>;
  deletePromoCode: (id: string) => Promise<void>;
  validatePromoCode: (code: string, orderTotal: number) => Promise<{ valid: boolean; error?: string; promo?: PromoCode; discount?: number }>;
  
  // Banners
  banners: Banner[];
  addBanner: (banner: Omit<Banner, "id">) => Promise<void>;
  updateBanner: (id: string, updates: Partial<Banner>) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  reorderBanners: (bannerIds: string[]) => void;
  
  // Time Slots
  timeSlots: TimeSlot[];
  addTimeSlot: (slot: Omit<TimeSlot, "id">) => Promise<void>;
  updateTimeSlot: (id: string, updates: Partial<TimeSlot>) => Promise<void>;
  deleteTimeSlot: (id: string) => Promise<void>;
  
  // Loyalty Tiers
  loyaltyTiers: LoyaltyTier[];
  updateLoyaltyTier: (id: string, updates: Partial<LoyaltyTier>) => void;
  
  // Export/Import for syncing
  exportSettings: () => string;
  importSettings: (jsonData: string) => boolean;
  resetToDefaults: () => void;
  
  // Loading and refresh
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

// Default Settings
const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Butcher Shop",
  storeNameAr: "متجر اللحوم",
  contactEmail: "contact@butcher.ae",
  contactPhone: "+971 4 123 4567",
  
  vatRate: 5,
  taxRegistrationNumber: "100123456700003",
  showVatOnInvoice: true,
  
  minOrderValue: 50,
  defaultDeliveryFee: 15,
  freeDeliveryThreshold: 200,
  expressDeliveryFee: 25,
  enableCOD: true,
  enableCardPayment: true,
  enableWalletPayment: true,
  
  tipOptions: [5, 10, 15, 20],
  enableTipping: true,
  
  welcomeBonus: 50,
  enableWelcomeBonus: true,
  
  pointsPerAed: 1,
  pointsToAedRate: 10, // 10 points = 1 AED
  referralBonus: 100,
  birthdayBonus: 50,
  
  sameDayCutoffHours: 2,
  maxAdvanceOrderDays: 7,
  
  enableEmailNotifications: true,
  enableSmsNotifications: true,
  enablePushNotifications: true,
  enableLowStockAlerts: true,
};

// Default Loyalty Tiers (kept in memory, can be extended to API later)
const DEFAULT_LOYALTY_TIERS: LoyaltyTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    nameAr: "برونزي",
    minPoints: 0,
    multiplier: 1,
    color: "#CD7F32",
    icon: "🥉",
    benefits: ["Earn 1 point per AED spent", "Birthday bonus points"],
    benefitsAr: ["اكسب 1 نقطة لكل درهم", "نقاط إضافية في عيد ميلادك"],
  },
  {
    id: "silver",
    name: "Silver",
    nameAr: "فضي",
    minPoints: 500,
    multiplier: 1.5,
    color: "#C0C0C0",
    icon: "🥈",
    benefits: ["1.5x points multiplier", "Free delivery on orders over 150 AED", "Early access to deals"],
    benefitsAr: ["مضاعف النقاط 1.5x", "توصيل مجاني للطلبات فوق 150 درهم", "وصول مبكر للعروض"],
  },
  {
    id: "gold",
    name: "Gold",
    nameAr: "ذهبي",
    minPoints: 1500,
    multiplier: 2,
    color: "#FFD700",
    icon: "🥇",
    benefits: ["2x points multiplier", "Free delivery always", "Priority support", "Exclusive offers"],
    benefitsAr: ["مضاعف النقاط 2x", "توصيل مجاني دائماً", "دعم أولوي", "عروض حصرية"],
  },
  {
    id: "platinum",
    name: "Platinum",
    nameAr: "بلاتيني",
    minPoints: 5000,
    multiplier: 3,
    color: "#E5E4E2",
    icon: "💎",
    benefits: ["3x points multiplier", "Free express delivery", "VIP support", "Exclusive platinum offers", "Free gift on every order over 500 AED"],
    benefitsAr: ["مضاعف النقاط 3x", "توصيل سريع مجاني", "دعم VIP", "عروض بلاتينية حصرية", "هدية مجانية لكل طلب فوق 500 درهم"],
  },
];

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>(DEFAULT_LOYALTY_TIERS);
  const [isLoading, setIsLoading] = useState(true);

  // Convert API settings to local format
  const mapSettings = (apiSettings: ApiAppSettings): StoreSettings => ({
    storeName: "Butcher Shop",
    storeNameAr: "متجر اللحوم",
    contactEmail: apiSettings.storeEmail,
    contactPhone: apiSettings.storePhone,
    vatRate: parseFloat(apiSettings.vatRate) * 100, // Convert from decimal to percent
    taxRegistrationNumber: "100123456700003",
    showVatOnInvoice: true,
    minOrderValue: parseFloat(apiSettings.minimumOrderAmount),
    defaultDeliveryFee: parseFloat(apiSettings.deliveryFee),
    freeDeliveryThreshold: parseFloat(apiSettings.freeDeliveryThreshold),
    expressDeliveryFee: parseFloat(apiSettings.expressDeliveryFee),
    enableCOD: apiSettings.enableCashOnDelivery,
    enableCardPayment: apiSettings.enableCardPayment,
    enableWalletPayment: apiSettings.enableWallet,
    tipOptions: [5, 10, 15, 20],
    enableTipping: true,
    welcomeBonus: parseFloat(apiSettings.welcomeBonus),
    enableWelcomeBonus: apiSettings.enableWelcomeBonus,
    pointsPerAed: parseFloat(apiSettings.loyaltyPointsPerAed),
    pointsToAedRate: parseFloat(apiSettings.loyaltyPointValue) * 10,
    referralBonus: 100,
    birthdayBonus: 50,
    sameDayCutoffHours: 2,
    maxAdvanceOrderDays: 7,
    enableEmailNotifications: true,
    enableSmsNotifications: true,
    enablePushNotifications: true,
    enableLowStockAlerts: true,
  });

  // Convert API banner to local format
  const mapBanner = (b: ApiBanner): Banner => ({
    id: b.id,
    titleEn: b.titleEn,
    titleAr: b.titleAr,
    subtitleEn: b.subtitleEn || "",
    subtitleAr: b.subtitleAr || "",
    image: b.image || "",
    bgColor: b.bgColor,
    link: b.link || "/products",
    badge: b.badge || undefined,
    badgeAr: b.badgeAr || undefined,
    enabled: b.enabled,
    order: b.sortOrder,
  });

  // Convert API time slot to local format
  const mapTimeSlot = (s: ApiTimeSlot): TimeSlot => ({
    id: s.id,
    start: s.startTime,
    end: s.endTime,
    enabled: s.enabled,
  });

  // Convert API promo code to local format
  const mapPromoCode = (p: ApiPromoCode): PromoCode => ({
    id: p.id,
    code: p.code,
    discount: parseFloat(p.value),
    type: p.type === "percentage" ? "percent" : "fixed",
    minOrder: parseFloat(p.minimumOrder) || undefined,
    maxDiscount: p.maximumDiscount ? parseFloat(p.maximumDiscount) : undefined,
    maxUses: p.usageLimit || undefined,
    usedCount: p.usageCount,
    expiryDate: p.validTo,
    enabled: p.isActive,
  });

  // Fetch all settings from API
  const fetchSettings = useCallback(async () => {
    try {
      const response = await settingsApi.getAll();
      if (response.success && response.data) {
        setSettings(mapSettings(response.data.settings));
        setBanners(response.data.banners.map(mapBanner));
        setTimeSlots(response.data.timeSlots.map(mapTimeSlot));
        setPromoCodes(response.data.promoCodes.map(mapPromoCode));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Refresh settings
  const refresh = async () => {
    setIsLoading(true);
    await fetchSettings();
  };

  // Update settings
  const updateSettings = async (updates: Partial<StoreSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
    
    // Convert to API format and save
    try {
      await settingsApi.update({
        vatRate: ((updates.vatRate ?? settings.vatRate) / 100).toString(),
        deliveryFee: (updates.defaultDeliveryFee ?? settings.defaultDeliveryFee).toString(),
        freeDeliveryThreshold: (updates.freeDeliveryThreshold ?? settings.freeDeliveryThreshold).toString(),
        minimumOrderAmount: (updates.minOrderValue ?? settings.minOrderValue).toString(),
        expressDeliveryFee: (updates.expressDeliveryFee ?? settings.expressDeliveryFee).toString(),
        enableCashOnDelivery: updates.enableCOD ?? settings.enableCOD,
        enableCardPayment: updates.enableCardPayment ?? settings.enableCardPayment,
        enableWallet: updates.enableWalletPayment ?? settings.enableWalletPayment,
        welcomeBonus: (updates.welcomeBonus ?? settings.welcomeBonus).toString(),
        enableWelcomeBonus: updates.enableWelcomeBonus ?? settings.enableWelcomeBonus,
        storePhone: updates.contactPhone ?? settings.contactPhone,
        storeEmail: updates.contactEmail ?? settings.contactEmail,
      });
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  };

  // Promo Code functions
  const addPromoCode = async (code: Omit<PromoCode, "id" | "usedCount">) => {
    try {
      const response = await settingsApi.createPromoCode({
        code: code.code,
        type: code.type === "percent" ? "percentage" : "fixed",
        value: code.discount.toString(),
        minimumOrder: (code.minOrder || 0).toString(),
        maximumDiscount: code.maxDiscount?.toString() || null,
        usageLimit: code.maxUses || 0,
        userLimit: 1,
        validFrom: new Date().toISOString(),
        validTo: code.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: code.enabled,
      });
      if (response.success) {
        await fetchSettings();
      }
    } catch (error) {
      console.error("Error adding promo code:", error);
    }
  };

  const updatePromoCode = async (id: string, updates: Partial<PromoCode>) => {
    try {
      await settingsApi.updatePromoCode(id, {
        code: updates.code,
        type: updates.type === "percent" ? "percentage" : updates.type === "fixed" ? "fixed" : undefined,
        value: updates.discount?.toString(),
        minimumOrder: updates.minOrder?.toString(),
        maximumDiscount: updates.maxDiscount?.toString(),
        usageLimit: updates.maxUses,
        validTo: updates.expiryDate,
        isActive: updates.enabled,
      });
      await fetchSettings();
    } catch (error) {
      console.error("Error updating promo code:", error);
    }
  };

  const deletePromoCode = async (id: string) => {
    try {
      await settingsApi.deletePromoCode(id);
      setPromoCodes((prev) => prev.filter((code) => code.id !== id));
    } catch (error) {
      console.error("Error deleting promo code:", error);
    }
  };

  const validatePromoCode = async (code: string, orderTotal: number) => {
    try {
      const response = await settingsApi.validatePromoCode(code, orderTotal);
      if (response.success && response.data) {
        const promo = promoCodes.find((p) => p.code.toUpperCase() === code.toUpperCase());
        return { valid: true, promo, discount: response.data.discount };
      }
      return { valid: false, error: response.error || "Invalid promo code" };
    } catch (error) {
      return { valid: false, error: "Failed to validate promo code" };
    }
  };

  // Banner functions
  const addBanner = async (banner: Omit<Banner, "id">) => {
    try {
      await settingsApi.createBanner({
        titleEn: banner.titleEn,
        titleAr: banner.titleAr,
        subtitleEn: banner.subtitleEn,
        subtitleAr: banner.subtitleAr,
        image: banner.image,
        bgColor: banner.bgColor,
        link: banner.link,
        badge: banner.badge,
        badgeAr: banner.badgeAr,
        enabled: banner.enabled,
      });
      await fetchSettings();
    } catch (error) {
      console.error("Error adding banner:", error);
    }
  };

  const updateBanner = async (id: string, updates: Partial<Banner>) => {
    try {
      await settingsApi.updateBanner(id, {
        titleEn: updates.titleEn,
        titleAr: updates.titleAr,
        subtitleEn: updates.subtitleEn,
        subtitleAr: updates.subtitleAr,
        image: updates.image,
        bgColor: updates.bgColor,
        link: updates.link,
        badge: updates.badge,
        badgeAr: updates.badgeAr,
        enabled: updates.enabled,
        sortOrder: updates.order,
      });
      await fetchSettings();
    } catch (error) {
      console.error("Error updating banner:", error);
    }
  };

  const deleteBanner = async (id: string) => {
    try {
      await settingsApi.deleteBanner(id);
      setBanners((prev) => prev.filter((banner) => banner.id !== id));
    } catch (error) {
      console.error("Error deleting banner:", error);
    }
  };

  const reorderBanners = (bannerIds: string[]) => {
    setBanners((prev) => {
      const reordered = bannerIds
        .map((id, index) => {
          const banner = prev.find((b) => b.id === id);
          return banner ? { ...banner, order: index + 1 } : null;
        })
        .filter((b): b is Banner => b !== null);
      return reordered;
    });
  };

  // Time Slot functions
  const addTimeSlot = async (slot: Omit<TimeSlot, "id">) => {
    try {
      await settingsApi.createTimeSlot({
        label: `${slot.start} - ${slot.end}`,
        labelAr: `${slot.start} - ${slot.end}`,
        startTime: slot.start,
        endTime: slot.end,
        isExpressSlot: false,
        maxOrders: 20,
        enabled: slot.enabled,
      });
      await fetchSettings();
    } catch (error) {
      console.error("Error adding time slot:", error);
    }
  };

  const updateTimeSlot = async (id: string, updates: Partial<TimeSlot>) => {
    try {
      await settingsApi.updateTimeSlot(id, {
        startTime: updates.start,
        endTime: updates.end,
        enabled: updates.enabled,
      });
      await fetchSettings();
    } catch (error) {
      console.error("Error updating time slot:", error);
    }
  };

  const deleteTimeSlot = async (id: string) => {
    try {
      await settingsApi.deleteTimeSlot(id);
      setTimeSlots((prev) => prev.filter((slot) => slot.id !== id));
    } catch (error) {
      console.error("Error deleting time slot:", error);
    }
  };

  // Loyalty Tier functions (kept local for now)
  const updateLoyaltyTier = (id: string, updates: Partial<LoyaltyTier>) => {
    setLoyaltyTiers((prev) =>
      prev.map((tier) => (tier.id === id ? { ...tier, ...updates } : tier))
    );
  };

  // Export/Import functions
  const exportSettings = () => {
    return JSON.stringify({
      settings,
      promoCodes,
      banners,
      timeSlots,
      loyaltyTiers,
    }, null, 2);
  };

  const importSettings = (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      if (data.settings) setSettings(data.settings);
      if (data.promoCodes) setPromoCodes(data.promoCodes);
      if (data.banners) setBanners(data.banners);
      if (data.timeSlots) setTimeSlots(data.timeSlots);
      if (data.loyaltyTiers) setLoyaltyTiers(data.loyaltyTiers);
      return true;
    } catch {
      return false;
    }
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setLoyaltyTiers(DEFAULT_LOYALTY_TIERS);
    // Keep API data as-is or refetch
    fetchSettings();
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        promoCodes,
        addPromoCode,
        updatePromoCode,
        deletePromoCode,
        validatePromoCode,
        banners,
        addBanner,
        updateBanner,
        deleteBanner,
        reorderBanners,
        timeSlots,
        addTimeSlot,
        updateTimeSlot,
        deleteTimeSlot,
        loyaltyTiers,
        updateLoyaltyTier,
        exportSettings,
        importSettings,
        resetToDefaults,
        isLoading,
        refresh,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
