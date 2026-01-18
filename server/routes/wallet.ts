/**
 * Wallet API Routes
 * User wallet balance and transactions management
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { ApiResponse } from "../../shared/api";
import { db, sessions, wallets, walletTransactions } from "../db/connection";

const router = Router();

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to get user ID from token
async function getUserIdFromToken(token: string | undefined): Promise<string | null> {
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
const topUpSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string(),
});

const deductSchema = z.object({
  amount: z.number().positive(),
  description: z.string(),
  descriptionAr: z.string(),
  reference: z.string().optional(),
});

const addCreditSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["credit", "refund", "cashback", "topup"]),
  description: z.string(),
  descriptionAr: z.string(),
  reference: z.string().optional(),
});

// GET /api/wallet - Get wallet balance and transactions
const getWallet: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = await getUserIdFromToken(token);

    if (!userId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    // Get or create wallet
    let walletResult = await db.select().from(wallets).where(eq(wallets.userId, userId));
    
    if (walletResult.length === 0) {
      // Create wallet with welcome bonus
      const welcomeBonus = 50; // Default welcome bonus
      const newWallet = {
        id: generateId("wallet"),
        userId,
        balance: welcomeBonus.toString(),
      };
      await db.insert(wallets).values(newWallet);
      
      // Add welcome bonus transaction
      const welcomeTransaction = {
        id: generateId("wtxn"),
        userId,
        type: "credit" as const,
        amount: welcomeBonus.toString(),
        description: "Welcome bonus! Start shopping with us",
        descriptionAr: "مكافأة ترحيبية! ابدأ التسوق معنا",
      };
      await db.insert(walletTransactions).values(welcomeTransaction);
      
      walletResult = await db.select().from(wallets).where(eq(wallets.userId, userId));
    }

    // Get transactions
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    const response: ApiResponse<{
      balance: number;
      transactions: typeof transactions;
    }> = {
      success: true,
      data: {
        balance: parseFloat(walletResult[0].balance),
        transactions,
      },
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching wallet:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch wallet",
    };
    res.status(500).json(response);
  }
};

// POST /api/wallet/topup - Top up wallet
const topUp: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = await getUserIdFromToken(token);

    if (!userId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const validation = topUpSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { amount, paymentMethod } = validation.data;

    // Get current wallet
    let walletResult = await db.select().from(wallets).where(eq(wallets.userId, userId));
    
    if (walletResult.length === 0) {
      // Create wallet
      const newWallet = {
        id: generateId("wallet"),
        userId,
        balance: "0",
      };
      await db.insert(wallets).values(newWallet);
      walletResult = await db.select().from(wallets).where(eq(wallets.userId, userId));
    }

    const currentBalance = parseFloat(walletResult[0].balance);
    const newBalance = currentBalance + amount;

    // Update balance
    await db.update(wallets).set({ 
      balance: newBalance.toString(),
      updatedAt: new Date(),
    }).where(eq(wallets.userId, userId));

    // Add transaction
    const transaction = {
      id: generateId("wtxn"),
      userId,
      type: "topup" as const,
      amount: amount.toString(),
      description: `Top up via ${paymentMethod}`,
      descriptionAr: `شحن عبر ${paymentMethod === 'card' ? 'البطاقة' : paymentMethod}`,
    };
    await db.insert(walletTransactions).values(transaction);

    const response: ApiResponse<{ balance: number }> = {
      success: true,
      data: { balance: newBalance },
      message: "Wallet topped up successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error topping up wallet:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to top up wallet",
    };
    res.status(500).json(response);
  }
};

// POST /api/wallet/deduct - Deduct from wallet
const deduct: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = await getUserIdFromToken(token);

    if (!userId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const validation = deductSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { amount, description, descriptionAr, reference } = validation.data;

    // Get current wallet
    const walletResult = await db.select().from(wallets).where(eq(wallets.userId, userId));
    
    if (walletResult.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "Wallet not found" };
      return res.status(404).json(response);
    }

    const currentBalance = parseFloat(walletResult[0].balance);
    if (currentBalance < amount) {
      const response: ApiResponse<null> = { success: false, error: "Insufficient balance" };
      return res.status(400).json(response);
    }

    const newBalance = currentBalance - amount;

    // Update balance
    await db.update(wallets).set({ 
      balance: newBalance.toString(),
      updatedAt: new Date(),
    }).where(eq(wallets.userId, userId));

    // Add transaction
    const transaction = {
      id: generateId("wtxn"),
      userId,
      type: "debit" as const,
      amount: amount.toString(),
      description,
      descriptionAr,
      reference,
    };
    await db.insert(walletTransactions).values(transaction);

    const response: ApiResponse<{ balance: number }> = {
      success: true,
      data: { balance: newBalance },
      message: "Payment successful",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deducting from wallet:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process payment",
    };
    res.status(500).json(response);
  }
};

// POST /api/wallet/credit - Add credit (refund, cashback, etc.)
const addCredit: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = req.body.userId || await getUserIdFromToken(token);

    if (!userId) {
      const response: ApiResponse<null> = { success: false, error: "User ID required" };
      return res.status(400).json(response);
    }

    const validation = addCreditSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { amount, type, description, descriptionAr, reference } = validation.data;

    // Get or create wallet
    let walletResult = await db.select().from(wallets).where(eq(wallets.userId, userId));
    
    if (walletResult.length === 0) {
      const newWallet = {
        id: generateId("wallet"),
        userId,
        balance: "0",
      };
      await db.insert(wallets).values(newWallet);
      walletResult = await db.select().from(wallets).where(eq(wallets.userId, userId));
    }

    const currentBalance = parseFloat(walletResult[0].balance);
    const newBalance = currentBalance + amount;

    // Update balance
    await db.update(wallets).set({ 
      balance: newBalance.toString(),
      updatedAt: new Date(),
    }).where(eq(wallets.userId, userId));

    // Add transaction
    const transaction = {
      id: generateId("wtxn"),
      userId,
      type: type as "credit" | "refund" | "cashback" | "topup",
      amount: amount.toString(),
      description,
      descriptionAr,
      reference,
    };
    await db.insert(walletTransactions).values(transaction);

    const response: ApiResponse<{ balance: number }> = {
      success: true,
      data: { balance: newBalance },
      message: "Credit added successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error adding credit:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add credit",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getWallet);
router.post("/topup", topUp);
router.post("/deduct", deduct);
router.post("/credit", addCredit);

export default router;
