/**
 * Product Reviews API Routes
 * Product reviews and ratings management
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import type { ApiResponse } from "../../shared/api";
import { db, sessions, productReviews, products } from "../db/connection";

const router = Router();

// Helper to generate unique IDs
const generateId = () => `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
const createReviewSchema = z.object({
  productId: z.string(),
  rating: z.number().min(1).max(5),
  title: z.string().min(1),
  comment: z.string().min(1),
  images: z.array(z.string()).optional(),
  isVerifiedPurchase: z.boolean().optional(),
});

const updateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  title: z.string().min(1).optional(),
  comment: z.string().min(1).optional(),
  images: z.array(z.string()).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

// GET /api/reviews - Get all reviews (with optional productId filter)
const getReviews: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.query;

    let query = db.select().from(productReviews).orderBy(desc(productReviews.createdAt));
    
    let reviews;
    if (productId) {
      reviews = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.productId, productId as string))
        .orderBy(desc(productReviews.createdAt));
    } else {
      reviews = await db.select().from(productReviews).orderBy(desc(productReviews.createdAt));
    }

    const response: ApiResponse<typeof reviews> = {
      success: true,
      data: reviews,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reviews",
    };
    res.status(500).json(response);
  }
};

// GET /api/reviews/product/:productId - Get reviews for a product with stats
const getProductReviews: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, productId))
      .orderBy(desc(productReviews.createdAt));

    // Calculate rating stats
    const totalReviews = reviews.length;
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;

    reviews.forEach((review) => {
      totalRating += review.rating;
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });

    const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

    const response: ApiResponse<{
      reviews: typeof reviews;
      stats: {
        averageRating: number;
        totalReviews: number;
        ratingDistribution: typeof ratingDistribution;
      };
    }> = {
      success: true,
      data: {
        reviews,
        stats: {
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews,
          ratingDistribution,
        },
      },
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reviews",
    };
    res.status(500).json(response);
  }
};

// POST /api/reviews - Create a review
const createReview: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = await getUserIdFromToken(token);

    if (!userId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const validation = createReviewSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { productId, rating, title, comment, images, isVerifiedPurchase } = validation.data;
    const { userName } = req.body;

    // Check if user already reviewed this product
    const existing = await db
      .select()
      .from(productReviews)
      .where(and(eq(productReviews.userId, userId), eq(productReviews.productId, productId)));

    if (existing.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "You have already reviewed this product",
      };
      return res.status(400).json(response);
    }

    const newReview = {
      id: generateId(),
      productId,
      userId,
      userName: userName || "Anonymous",
      rating,
      title,
      comment,
      images: images || null,
      isVerifiedPurchase: isVerifiedPurchase || false,
      helpfulCount: 0,
      isApproved: true,
    };

    await db.insert(productReviews).values(newReview);

    // Update product rating
    await updateProductRating(productId);

    const response: ApiResponse<typeof newReview> = {
      success: true,
      data: newReview,
      message: "Review submitted successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating review:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create review",
    };
    res.status(500).json(response);
  }
};

// PUT /api/reviews/:id - Update a review
const updateReview: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = await getUserIdFromToken(token);
    const { id } = req.params;

    const existing = await db.select().from(productReviews).where(eq(productReviews.id, id));
    if (existing.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "Review not found" };
      return res.status(404).json(response);
    }

    // Check if this is a status update (admin operation) or user update
    const isStatusUpdate = req.body.status !== undefined;
    
    // For non-status updates, require authentication and ownership
    if (!isStatusUpdate) {
      if (!userId) {
        const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
        return res.status(401).json(response);
      }
      
      if (existing[0].userId !== userId) {
        const response: ApiResponse<null> = { success: false, error: "Not authorized" };
        return res.status(403).json(response);
      }
    }

    const validation = updateReviewSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const updates: Partial<typeof productReviews.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (validation.data.rating !== undefined) updates.rating = validation.data.rating;
    if (validation.data.title !== undefined) updates.title = validation.data.title;
    if (validation.data.comment !== undefined) updates.comment = validation.data.comment;
    if (validation.data.images !== undefined) updates.images = validation.data.images;
    if (validation.data.status !== undefined) {
      updates.isApproved = validation.data.status === "approved";
    }

    await db.update(productReviews).set(updates).where(eq(productReviews.id, id));

    // Update product rating
    await updateProductRating(existing[0].productId);

    const updated = await db.select().from(productReviews).where(eq(productReviews.id, id));

    const response: ApiResponse<typeof updated[0]> = {
      success: true,
      data: updated[0],
      message: "Review updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating review:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update review",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/reviews/:id - Delete a review
const deleteReview: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = await getUserIdFromToken(token);
    const { id } = req.params;

    if (!userId) {
      const response: ApiResponse<null> = { success: false, error: "Not authenticated" };
      return res.status(401).json(response);
    }

    const existing = await db.select().from(productReviews).where(eq(productReviews.id, id));
    if (existing.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "Review not found" };
      return res.status(404).json(response);
    }

    // Allow user to delete own review or admin to delete any
    // For now, just check if it's the user's review
    if (existing[0].userId !== userId) {
      const response: ApiResponse<null> = { success: false, error: "Not authorized" };
      return res.status(403).json(response);
    }

    const productId = existing[0].productId;
    await db.delete(productReviews).where(eq(productReviews.id, id));

    // Update product rating
    await updateProductRating(productId);

    const response: ApiResponse<null> = {
      success: true,
      message: "Review deleted successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting review:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete review",
    };
    res.status(500).json(response);
  }
};

// POST /api/reviews/:id/helpful - Mark review as helpful
const markHelpful: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(productReviews).where(eq(productReviews.id, id));
    if (existing.length === 0) {
      const response: ApiResponse<null> = { success: false, error: "Review not found" };
      return res.status(404).json(response);
    }

    await db.update(productReviews).set({
      helpfulCount: existing[0].helpfulCount + 1,
    }).where(eq(productReviews.id, id));

    const response: ApiResponse<null> = {
      success: true,
      message: "Marked as helpful",
    };
    res.json(response);
  } catch (error) {
    console.error("Error marking helpful:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark as helpful",
    };
    res.status(500).json(response);
  }
};

// Helper to update product average rating
async function updateProductRating(productId: string) {
  try {
    const reviews = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, productId));

    if (reviews.length === 0) {
      await db.update(products).set({ rating: "0" }).where(eq(products.id, productId));
      return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await db.update(products).set({ 
      rating: avgRating.toFixed(2),
    }).where(eq(products.id, productId));
  } catch (error) {
    console.error("Error updating product rating:", error);
  }
}

// Register routes
router.get("/", getReviews);
router.get("/product/:productId", getProductReviews);
router.post("/", createReview);
router.put("/:id", updateReview);
router.delete("/:id", deleteReview);
router.post("/:id/helpful", markHelpful);

export default router;
