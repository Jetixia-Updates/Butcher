/**
 * App Settings API Routes
 * Application settings, banners, time slots management
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import type { ApiResponse } from "../../shared/api";
import { db, appSettings, banners, deliveryTimeSlots, discountCodes } from "../db/connection";

const router = Router();

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Default settings
const DEFAULT_SETTINGS = {
  id: "default",
  vatRate: "0.05",
  deliveryFee: "15",
  freeDeliveryThreshold: "200",
  expressDeliveryFee: "25",
  minimumOrderAmount: "50",
  maxOrdersPerDay: 100,
  enableCashOnDelivery: true,
  enableCardPayment: true,
  enableWallet: true,
  enableLoyalty: true,
  enableReviews: true,
  enableWishlist: true,
  enableExpressDelivery: true,
  enableScheduledDelivery: true,
  enableWelcomeBonus: true,
  welcomeBonus: "50",
  cashbackPercentage: "2",
  loyaltyPointsPerAed: "1",
  loyaltyPointValue: "0.1",
  storePhone: "+971 4 123 4567",
  storeEmail: "support@aljazirabutcher.ae",
  storeAddress: "Al Jazira Butcher Shop, Dubai, UAE",
  storeAddressAr: "ملحمة الجزيرة، دبي، الإمارات العربية المتحدة",
  workingHoursStart: "08:00",
  workingHoursEnd: "22:00",
};

// Default banners
const DEFAULT_BANNERS = [
  { id: "banner_1", titleEn: "Premium Quality Meat", titleAr: "لحوم عالية الجودة", subtitleEn: "Fresh from the farm to your table", subtitleAr: "طازج من المزرعة إلى مائدتك", bgColor: "from-red-800 to-red-900", badge: "Fresh", badgeAr: "طازج", enabled: true, sortOrder: 0 },
  { id: "banner_2", titleEn: "Free Delivery", titleAr: "توصيل مجاني", subtitleEn: "On orders above 200 AED", subtitleAr: "للطلبات فوق 200 درهم", bgColor: "from-green-700 to-green-900", badge: "Free Delivery", badgeAr: "توصيل مجاني", enabled: true, sortOrder: 1 },
];

// Default time slots
const DEFAULT_TIME_SLOTS = [
  { id: "slot_1", label: "Morning (8AM - 12PM)", labelAr: "صباحاً (8ص - 12م)", startTime: "08:00", endTime: "12:00", isExpressSlot: false, maxOrders: 20, enabled: true, sortOrder: 0 },
  { id: "slot_2", label: "Afternoon (12PM - 4PM)", labelAr: "ظهراً (12م - 4م)", startTime: "12:00", endTime: "16:00", isExpressSlot: false, maxOrders: 20, enabled: true, sortOrder: 1 },
  { id: "slot_3", label: "Evening (4PM - 8PM)", labelAr: "مساءً (4م - 8م)", startTime: "16:00", endTime: "20:00", isExpressSlot: false, maxOrders: 20, enabled: true, sortOrder: 2 },
  { id: "slot_4", label: "Night (8PM - 10PM)", labelAr: "ليلاً (8م - 10م)", startTime: "20:00", endTime: "22:00", isExpressSlot: false, maxOrders: 15, enabled: true, sortOrder: 3 },
  { id: "slot_express", label: "Express (Within 2 hours)", labelAr: "سريع (خلال ساعتين)", startTime: "00:00", endTime: "23:59", isExpressSlot: true, maxOrders: 10, enabled: true, sortOrder: 4 },
];

// GET /api/settings - Get all settings
const getSettings: RequestHandler = async (req, res) => {
  try {
    // Get settings
    let settingsResult = await db.select().from(appSettings).where(eq(appSettings.id, "default"));
    
    if (settingsResult.length === 0) {
      // Create default settings
      await db.insert(appSettings).values(DEFAULT_SETTINGS);
      settingsResult = await db.select().from(appSettings).where(eq(appSettings.id, "default"));
    }

    // Get banners
    let bannersResult = await db.select().from(banners).orderBy(asc(banners.sortOrder));
    if (bannersResult.length === 0) {
      for (const banner of DEFAULT_BANNERS) {
        await db.insert(banners).values(banner);
      }
      bannersResult = await db.select().from(banners).orderBy(asc(banners.sortOrder));
    }

    // Get time slots
    let timeSlotsResult = await db.select().from(deliveryTimeSlots).orderBy(asc(deliveryTimeSlots.sortOrder));
    if (timeSlotsResult.length === 0) {
      for (const slot of DEFAULT_TIME_SLOTS) {
        await db.insert(deliveryTimeSlots).values(slot);
      }
      timeSlotsResult = await db.select().from(deliveryTimeSlots).orderBy(asc(deliveryTimeSlots.sortOrder));
    }

    // Get promo codes
    const promoCodesResult = await db.select().from(discountCodes);

    const response: ApiResponse<{
      settings: typeof settingsResult[0];
      banners: typeof bannersResult;
      timeSlots: typeof timeSlotsResult;
      promoCodes: typeof promoCodesResult;
    }> = {
      success: true,
      data: {
        settings: settingsResult[0],
        banners: bannersResult,
        timeSlots: timeSlotsResult,
        promoCodes: promoCodesResult,
      },
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching settings:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch settings",
    };
    res.status(500).json(response);
  }
};

// PUT /api/settings - Update settings
const updateSettings: RequestHandler = async (req, res) => {
  try {
    const updates = req.body;
    
    await db.update(appSettings).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(appSettings.id, "default"));

    const updated = await db.select().from(appSettings).where(eq(appSettings.id, "default"));

    const response: ApiResponse<typeof updated[0]> = {
      success: true,
      data: updated[0],
      message: "Settings updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating settings:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update settings",
    };
    res.status(500).json(response);
  }
};

// =====================================================
// BANNERS
// =====================================================

// POST /api/settings/banners - Create banner
const createBanner: RequestHandler = async (req, res) => {
  try {
    const { titleEn, titleAr, subtitleEn, subtitleAr, image, bgColor, link, badge, badgeAr, enabled } = req.body;
    
    const existing = await db.select().from(banners);
    const sortOrder = existing.length;

    const newBanner = {
      id: generateId("banner"),
      titleEn,
      titleAr,
      subtitleEn,
      subtitleAr,
      image,
      bgColor: bgColor || "from-red-800 to-red-900",
      link,
      badge,
      badgeAr,
      enabled: enabled !== false,
      sortOrder,
    };

    await db.insert(banners).values(newBanner);

    const response: ApiResponse<typeof newBanner> = {
      success: true,
      data: newBanner,
      message: "Banner created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating banner:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create banner",
    };
    res.status(500).json(response);
  }
};

// PUT /api/settings/banners/:id - Update banner
const updateBanner: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await db.update(banners).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(banners.id, id));

    const updated = await db.select().from(banners).where(eq(banners.id, id));

    const response: ApiResponse<typeof updated[0]> = {
      success: true,
      data: updated[0],
      message: "Banner updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating banner:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update banner",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/settings/banners/:id - Delete banner
const deleteBanner: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(banners).where(eq(banners.id, id));

    const response: ApiResponse<null> = {
      success: true,
      message: "Banner deleted successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting banner:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete banner",
    };
    res.status(500).json(response);
  }
};

// =====================================================
// TIME SLOTS
// =====================================================

// POST /api/settings/time-slots - Create time slot
const createTimeSlot: RequestHandler = async (req, res) => {
  try {
    const { label, labelAr, startTime, endTime, isExpressSlot, maxOrders, enabled } = req.body;
    
    const existing = await db.select().from(deliveryTimeSlots);
    const sortOrder = existing.length;

    const newSlot = {
      id: generateId("slot"),
      label,
      labelAr,
      startTime,
      endTime,
      isExpressSlot: isExpressSlot || false,
      maxOrders: maxOrders || 20,
      enabled: enabled !== false,
      sortOrder,
    };

    await db.insert(deliveryTimeSlots).values(newSlot);

    const response: ApiResponse<typeof newSlot> = {
      success: true,
      data: newSlot,
      message: "Time slot created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating time slot:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create time slot",
    };
    res.status(500).json(response);
  }
};

// PUT /api/settings/time-slots/:id - Update time slot
const updateTimeSlot: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    await db.update(deliveryTimeSlots).set(updates).where(eq(deliveryTimeSlots.id, id));

    const updated = await db.select().from(deliveryTimeSlots).where(eq(deliveryTimeSlots.id, id));

    const response: ApiResponse<typeof updated[0]> = {
      success: true,
      data: updated[0],
      message: "Time slot updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating time slot:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update time slot",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/settings/time-slots/:id - Delete time slot
const deleteTimeSlot: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(deliveryTimeSlots).where(eq(deliveryTimeSlots.id, id));

    const response: ApiResponse<null> = {
      success: true,
      message: "Time slot deleted successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting time slot:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete time slot",
    };
    res.status(500).json(response);
  }
};

// =====================================================
// PROMO CODES
// =====================================================

// POST /api/settings/promo-codes - Create promo code
const createPromoCode: RequestHandler = async (req, res) => {
  try {
    const { code, type, value, minimumOrder, maximumDiscount, usageLimit, userLimit, validFrom, validTo, applicableProducts, applicableCategories } = req.body;

    const newCode = {
      id: generateId("promo"),
      code: code.toUpperCase(),
      type,
      value: value.toString(),
      minimumOrder: (minimumOrder || 0).toString(),
      maximumDiscount: maximumDiscount ? maximumDiscount.toString() : null,
      usageLimit: usageLimit || 0,
      usageCount: 0,
      userLimit: userLimit || 1,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      isActive: true,
      applicableProducts,
      applicableCategories,
    };

    await db.insert(discountCodes).values(newCode);

    const response: ApiResponse<typeof newCode> = {
      success: true,
      data: newCode,
      message: "Promo code created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating promo code:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create promo code",
    };
    res.status(500).json(response);
  }
};

// PUT /api/settings/promo-codes/:id - Update promo code
const updatePromoCode: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.value) updates.value = updates.value.toString();
    if (updates.minimumOrder) updates.minimumOrder = updates.minimumOrder.toString();
    if (updates.maximumDiscount) updates.maximumDiscount = updates.maximumDiscount.toString();
    if (updates.validFrom) updates.validFrom = new Date(updates.validFrom);
    if (updates.validTo) updates.validTo = new Date(updates.validTo);

    await db.update(discountCodes).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(discountCodes.id, id));

    const updated = await db.select().from(discountCodes).where(eq(discountCodes.id, id));

    const response: ApiResponse<typeof updated[0]> = {
      success: true,
      data: updated[0],
      message: "Promo code updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating promo code:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update promo code",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/settings/promo-codes/:id - Delete promo code
const deletePromoCode: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(discountCodes).where(eq(discountCodes.id, id));

    const response: ApiResponse<null> = {
      success: true,
      message: "Promo code deleted successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting promo code:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete promo code",
    };
    res.status(500).json(response);
  }
};

// POST /api/settings/promo-codes/validate - Validate promo code
const validatePromoCode: RequestHandler = async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    const promoCode = await db.select().from(discountCodes).where(eq(discountCodes.code, code.toUpperCase()));

    if (promoCode.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "Invalid promo code" };
      return res.status(400).json(response);
    }

    const promo = promoCode[0];

    // Check if active
    if (!promo.isActive) {
      const response: ApiResponse<null> = { success: false, error: "This promo code is no longer active" };
      return res.status(400).json(response);
    }

    // Check validity period
    const now = new Date();
    if (now < promo.validFrom || now > promo.validTo) {
      const response: ApiResponse<null> = { success: false, error: "This promo code has expired" };
      return res.status(400).json(response);
    }

    // Check usage limit
    if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
      const response: ApiResponse<null> = { success: false, error: "This promo code has reached its usage limit" };
      return res.status(400).json(response);
    }

    // Check minimum order
    if (orderTotal < parseFloat(promo.minimumOrder)) {
      const response: ApiResponse<null> = { 
        success: false, 
        error: `Minimum order of ${parseFloat(promo.minimumOrder)} AED required` 
      };
      return res.status(400).json(response);
    }

    // Calculate discount
    let discount = 0;
    if (promo.type === "percentage") {
      discount = orderTotal * (parseFloat(promo.value) / 100);
      if (promo.maximumDiscount && discount > parseFloat(promo.maximumDiscount)) {
        discount = parseFloat(promo.maximumDiscount);
      }
    } else {
      discount = parseFloat(promo.value);
    }

    const response: ApiResponse<{
      valid: true;
      code: string;
      type: string;
      value: number;
      discount: number;
    }> = {
      success: true,
      data: {
        valid: true,
        code: promo.code,
        type: promo.type,
        value: parseFloat(promo.value),
        discount: Math.round(discount * 100) / 100,
      },
    };
    res.json(response);
  } catch (error) {
    console.error("Error validating promo code:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to validate promo code",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getSettings);
router.put("/", updateSettings);

// Banners
router.post("/banners", createBanner);
router.put("/banners/:id", updateBanner);
router.delete("/banners/:id", deleteBanner);

// Time slots
router.post("/time-slots", createTimeSlot);
router.put("/time-slots/:id", updateTimeSlot);
router.delete("/time-slots/:id", deleteTimeSlot);

// Promo codes
router.post("/promo-codes", createPromoCode);
router.put("/promo-codes/:id", updatePromoCode);
router.delete("/promo-codes/:id", deletePromoCode);
router.post("/promo-codes/validate", validatePromoCode);

export default router;
