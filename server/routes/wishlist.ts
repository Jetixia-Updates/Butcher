/**
 * Wishlist API Routes
 * Customer wishlist management
 */

import { Router, RequestHandler } from "express";
import { eq, and } from "drizzle-orm";
import type { ApiResponse } from "../../shared/api";
import { db, sessions, wishlists, products } from "../db/connection";

const router = Router();

// Helper to generate unique IDs
const generateId = () => `wishlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

// GET /api/wishlist - Get customer's wishlist
const getWishlist: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    // Get wishlist items with product details
    const wishlistItems = await db
      .select({
        id: wishlists.id,
        productId: wishlists.productId,
        createdAt: wishlists.createdAt,
        product: {
          id: products.id,
          name: products.name,
          nameAr: products.nameAr,
          price: products.price,
          image: products.image,
          category: products.category,
          discount: products.discount,
        },
      })
      .from(wishlists)
      .leftJoin(products, eq(wishlists.productId, products.id))
      .where(eq(wishlists.customerId, customerId));

    const response: ApiResponse<typeof wishlistItems> = {
      success: true,
      data: wishlistItems,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch wishlist",
    };
    res.status(500).json(response);
  }
};

// POST /api/wishlist - Add item to wishlist
const addToWishlist: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const { productId } = req.body;
    if (!productId) {
      const response: ApiResponse<null> = { success: false, error: "Product ID required" };
      return res.status(400).json(response);
    }

    // Check if already in wishlist
    const existing = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.customerId, customerId), eq(wishlists.productId, productId)));

    if (existing.length > 0) {
      const response: ApiResponse<null> = { success: true, message: "Already in wishlist" };
      return res.json(response);
    }

    // Add to wishlist
    const newItem = {
      id: generateId(),
      customerId,
      productId,
    };
    await db.insert(wishlists).values(newItem);

    const response: ApiResponse<typeof newItem> = {
      success: true,
      data: newItem,
      message: "Added to wishlist",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add to wishlist",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/wishlist/:productId - Remove from wishlist
const removeFromWishlist: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const { productId } = req.params;

    await db
      .delete(wishlists)
      .where(and(eq(wishlists.customerId, customerId), eq(wishlists.productId, productId)));

    const response: ApiResponse<null> = {
      success: true,
      message: "Removed from wishlist",
    };
    res.json(response);
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove from wishlist",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/wishlist - Clear wishlist
const clearWishlist: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const customerId = await getCustomerIdFromToken(token);

    if (!customerId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    await db.delete(wishlists).where(eq(wishlists.customerId, customerId));

    const response: ApiResponse<null> = {
      success: true,
      message: "Wishlist cleared",
    };
    res.json(response);
  } catch (error) {
    console.error("Error clearing wishlist:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear wishlist",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getWishlist);
router.post("/", addToWishlist);
router.delete("/:productId", removeFromWishlist);
router.delete("/", clearWishlist);

export default router;
