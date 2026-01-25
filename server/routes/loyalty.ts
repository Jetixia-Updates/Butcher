/**
 * Loyalty Points API Routes
 * Customer loyalty points and rewards management
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { ApiResponse } from "../../shared/api";
import { db, sessions, loyaltyPoints, loyaltyTransactions, loyaltyTiers } from "../db/connection";

const router = Router();

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Generate referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Helper to get customer ID from token
async function getCustomerIdFromToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  
  try {
    const sessionResult = await db.select().from(sessions).where(eq(sessions.token, token));
    if (sessionResult.length === 0 || new Date(sessionResult[0].expiresAt) < new Date()) {
      return null;
    }
    return sessionResult[0].userId;
  } catch {
    return null;
  }
}

// Validation schemas
const earnPointsSchema = z.object({
  points: z.number().positive(),
  orderId: z.string(),
  description: z.string(),
});

const redeemPointsSchema = z.object({
  points: z.number().positive(),
  description: z.string(),
});

const applyReferralSchema = z.object({
  code: z.string().min(6),
});

// Default tiers (will be loaded from DB if available)
const DEFAULT_TIERS = [
  { id: "bronze", name: "Bronze", nameAr: "برونزي", minPoints: 0, multiplier: "1", benefits: ["1 point per AED spent", "Birthday bonus"], benefitsAr: ["1 نقطة لكل درهم", "مكافأة عيد ميلاد"], icon: "🥉", sortOrder: 0 },
  { id: "silver", name: "Silver", nameAr: "فضي", minPoints: 500, multiplier: "1.5", benefits: ["1.5 points per AED spent", "Birthday bonus", "Early access to sales"], benefitsAr: ["1.5 نقطة لكل درهم", "مكافأة عيد ميلاد", "وصول مبكر للتخفيضات"], icon: "🥈", sortOrder: 1 },
  { id: "gold", name: "Gold", nameAr: "ذهبي", minPoints: 2000, multiplier: "2", benefits: ["2 points per AED spent", "Birthday bonus", "Early access to sales", "Free delivery"], benefitsAr: ["2 نقطة لكل درهم", "مكافأة عيد ميلاد", "وصول مبكر للتخفيضات", "توصيل مجاني"], icon: "🥇", sortOrder: 2 },
  { id: "platinum", name: "Platinum", nameAr: "بلاتيني", minPoints: 5000, multiplier: "3", benefits: ["3 points per AED spent", "Birthday bonus", "Early access to sales", "Free delivery", "VIP support"], benefitsAr: ["3 نقطة لكل درهم", "مكافأة عيد ميلاد", "وصول مبكر للتخفيضات", "توصيل مجاني", "دعم VIP"], icon: "💎", sortOrder: 3 },
];

// GET /api/loyalty - Get customer's loyalty points and tier
const getLoyalty: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    // Get or create loyalty record
    let pointsResult = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.customerId, customerId));
    
    if (pointsResult.length === 0) {
      // Create loyalty record
      const newRecord = {
        id: generateId("loyalty"),
        customerId,
        points: 0,
        totalEarned: 0,
        referralCode: generateReferralCode(),
      };
      await db.insert(loyaltyPoints).values(newRecord);
      pointsResult = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.customerId, customerId));
    }

    // Get transactions
    const transactions = await db
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customerId))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(50);

    // Get tiers
    let tiers = await db.select().from(loyaltyTiers).orderBy(loyaltyTiers.sortOrder);
    if (tiers.length === 0) {
      // Use default tiers
      tiers = DEFAULT_TIERS as typeof tiers;
    }

    // Determine current tier
    const customerPoints = pointsResult[0].totalEarned;
    let currentTier = tiers[0];
    let nextTier = tiers[1] || null;

    for (let i = 0; i < tiers.length; i++) {
      if (customerPoints >= tiers[i].minPoints) {
        currentTier = tiers[i];
        nextTier = tiers[i + 1] || null;
      }
    }

    const response: ApiResponse<{
      points: number;
      totalEarned: number;
      referralCode: string;
      currentTier: typeof currentTier;
      nextTier: typeof nextTier | null;
      pointsToNextTier: number;
      transactions: typeof transactions;
    }> = {
      success: true,
      data: {
        points: pointsResult[0].points,
        totalEarned: pointsResult[0].totalEarned,
        referralCode: pointsResult[0].referralCode || generateReferralCode(),
        currentTier,
        nextTier,
        pointsToNextTier: nextTier ? nextTier.minPoints - customerPoints : 0,
        transactions,
      },
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching loyalty:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch loyalty data",
    };
    res.status(500).json(response);
  }
};

// POST /api/loyalty/earn - Earn points
const earnPoints: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = req.body.customerId || await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Customer ID required" };
      return res.status(400).json(response);
    }

    const validation = earnPointsSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { points, orderId, description } = validation.data;

    // Get or create loyalty record
    let pointsResult = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.customerId, customerId));
    
    if (pointsResult.length === 0) {
      const newRecord = {
        id: generateId("loyalty"),
        customerId,
        points: 0,
        totalEarned: 0,
        referralCode: generateReferralCode(),
      };
      await db.insert(loyaltyPoints).values(newRecord);
      pointsResult = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.customerId, customerId));
    }

    const newPoints = pointsResult[0].points + points;
    const newTotalEarned = pointsResult[0].totalEarned + points;

    // Update points
    await db.update(loyaltyPoints).set({
      points: newPoints,
      totalEarned: newTotalEarned,
      updatedAt: new Date(),
    }).where(eq(loyaltyPoints.customerId, customerId));

    // Add transaction
    await db.insert(loyaltyTransactions).values({
      id: generateId("ltxn"),
      customerId,
      type: "earn",
      points,
      description,
      orderId,
    });

    const response: ApiResponse<{ points: number; totalEarned: number }> = {
      success: true,
      data: { points: newPoints, totalEarned: newTotalEarned },
      message: `Earned ${points} points`,
    };
    res.json(response);
  } catch (error) {
    console.error("Error earning points:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to earn points",
    };
    res.status(500).json(response);
  }
};

// POST /api/loyalty/redeem - Redeem points
const redeemPoints: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const validation = redeemPointsSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { points, description } = validation.data;

    // Get current points
    const pointsResult = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.customerId, customerId));
    
    if (pointsResult.length === 0 || pointsResult[0].points < points) {
      const response: ApiResponse<null> = { success: false, error: "Insufficient points" };
      return res.status(400).json(response);
    }

    const newPoints = pointsResult[0].points - points;

    // Update points
    await db.update(loyaltyPoints).set({
      points: newPoints,
      updatedAt: new Date(),
    }).where(eq(loyaltyPoints.customerId, customerId));

    // Add transaction
    await db.insert(loyaltyTransactions).values({
      id: generateId("ltxn"),
      customerId,
      type: "redeem",
      points: -points,
      description,
    });

    const response: ApiResponse<{ points: number }> = {
      success: true,
      data: { points: newPoints },
      message: `Redeemed ${points} points`,
    };
    res.json(response);
  } catch (error) {
    console.error("Error redeeming points:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to redeem points",
    };
    res.status(500).json(response);
  }
};

// POST /api/loyalty/referral - Apply referral code
const applyReferral: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const validation = applyReferralSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { code } = validation.data;

    // Check if customer already used a referral
    const customerPoints = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.customerId, customerId));
    if (customerPoints.length > 0 && customerPoints[0].referredBy) {
      const response: ApiResponse<null> = { success: false, error: "You have already used a referral code" };
      return res.status(400).json(response);
    }

    // Find referrer by code
    const referrer = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.referralCode, code.toUpperCase()));
    if (referrer.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "Invalid referral code" };
      return res.status(400).json(response);
    }

    if (referrer[0].customerId === customerId) {
      const response: ApiResponse<null> = { success: false, error: "Cannot use your own referral code" };
      return res.status(400).json(response);
    }

    const bonusPoints = 100; // Referral bonus

    // Update customer's record
    if (customerPoints.length === 0) {
      await db.insert(loyaltyPoints).values({
        id: generateId("loyalty"),
        customerId,
        points: bonusPoints,
        totalEarned: bonusPoints,
        referralCode: generateReferralCode(),
        referredBy: referrer[0].customerId,
      });
    } else {
      await db.update(loyaltyPoints).set({
        points: customerPoints[0].points + bonusPoints,
        totalEarned: customerPoints[0].totalEarned + bonusPoints,
        referredBy: referrer[0].customerId,
        updatedAt: new Date(),
      }).where(eq(loyaltyPoints.customerId, customerId));
    }

    // Add transaction for customer
    await db.insert(loyaltyTransactions).values({
      id: generateId("ltxn"),
      customerId,
      type: "bonus",
      points: bonusPoints,
      description: "Referral bonus",
    });

    // Award referrer too
    await db.update(loyaltyPoints).set({
      points: referrer[0].points + bonusPoints,
      totalEarned: referrer[0].totalEarned + bonusPoints,
      updatedAt: new Date(),
    }).where(eq(loyaltyPoints.customerId, referrer[0].customerId));

    await db.insert(loyaltyTransactions).values({
      id: generateId("ltxn"),
      customerId: referrer[0].customerId,
      type: "bonus",
      points: bonusPoints,
      description: "Referral reward",
    });

    const response: ApiResponse<{ points: number }> = {
      success: true,
      data: { points: bonusPoints },
      message: `Successfully applied referral code! You earned ${bonusPoints} points`,
    };
    res.json(response);
  } catch (error) {
    console.error("Error applying referral:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply referral code",
    };
    res.status(500).json(response);
  }
};

// GET /api/loyalty/tiers - Get all loyalty tiers
const getTiers: RequestHandler = async (req, res) => {
  try {
    let tiers = await db.select().from(loyaltyTiers).orderBy(loyaltyTiers.sortOrder);
    
    if (tiers.length === 0) {
      // Seed default tiers
      for (const tier of DEFAULT_TIERS) {
        await db.insert(loyaltyTiers).values(tier);
      }
      tiers = await db.select().from(loyaltyTiers).orderBy(loyaltyTiers.sortOrder);
    }

    const response: ApiResponse<typeof tiers> = {
      success: true,
      data: tiers,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching tiers:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch tiers",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getLoyalty);
router.post("/earn", earnPoints);
router.post("/redeem", redeemPoints);
router.post("/referral", applyReferral);
router.get("/tiers", getTiers);

export default router;
