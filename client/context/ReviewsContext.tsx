import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { reviewsApi, ProductReview as ApiProductReview, ProductReviewStats } from "@/lib/api";

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRating {
  productId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

interface ReviewsContextType {
  getProductReviews: (productId: string) => Review[];
  getProductRating: (productId: string) => ProductRating;
  addReview: (review: Omit<Review, "id" | "createdAt" | "updatedAt" | "helpfulCount">) => Promise<void>;
  updateReview: (reviewId: string, updates: Partial<Pick<Review, "rating" | "title" | "comment" | "images">>) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
  markHelpful: (reviewId: string) => Promise<void>;
  hasUserReviewed: (productId: string) => boolean;
  getUserReview: (productId: string) => Review | undefined;
  isLoading: boolean;
  fetchReviews: (productId: string) => Promise<void>;
}

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

export const ReviewsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productRatings, setProductRatings] = useState<Map<string, ProductRating>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Convert API review to local format
  const mapReview = (r: ApiProductReview): Review => ({
    id: r.id,
    productId: r.productId,
    userId: r.userId,
    userName: r.userName,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    images: r.images || undefined,
    isVerifiedPurchase: r.isVerifiedPurchase,
    helpfulCount: r.helpfulCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });

  // Track if we've loaded all reviews (to avoid double-fetching)
  const [hasLoadedAll, setHasLoadedAll] = useState(false);

  // Lazy load reviews - only fetch when needed, not on initial mount
  // This prevents blocking the initial page load
  const ensureReviewsLoaded = useCallback(async () => {
    if (hasLoadedAll) return;
    try {
      const response = await reviewsApi.getAll();
      if (response.success && response.data) {
        setReviews(response.data.map(mapReview));
        setHasLoadedAll(true);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    }
  }, [hasLoadedAll]);

  // Fetch reviews for a specific product
  const fetchReviews = useCallback(async (productId: string) => {
    setIsLoading(true);
    try {
      const response = await reviewsApi.getProductReviews(productId);
      if (response.success && response.data) {
        const fetchedReviews = response.data.reviews.map(mapReview);
        
        // Update reviews state
        setReviews((prev) => {
          const otherReviews = prev.filter((r) => r.productId !== productId);
          return [...otherReviews, ...fetchedReviews];
        });
        
        // Update ratings cache
        setProductRatings((prev) => {
          const newMap = new Map(prev);
          newMap.set(productId, {
            productId,
            ...response.data!.stats,
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getProductReviews = useCallback((productId: string): Review[] => {
    return reviews
      .filter((r) => r.productId === productId)
      .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
  }, [reviews]);

  const getProductRating = useCallback((productId: string): ProductRating => {
    // Check cache first
    const cached = productRatings.get(productId);
    if (cached) return cached;

    // Calculate from local reviews
    const productReviews = reviews.filter((r) => r.productId === productId);
    const totalReviews = productReviews.length;
    
    if (totalReviews === 0) {
      return {
        productId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = sum / totalReviews;

    const ratingDistribution = {
      5: productReviews.filter((r) => r.rating === 5).length,
      4: productReviews.filter((r) => r.rating === 4).length,
      3: productReviews.filter((r) => r.rating === 3).length,
      2: productReviews.filter((r) => r.rating === 2).length,
      1: productReviews.filter((r) => r.rating === 1).length,
    };

    return {
      productId,
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews,
      ratingDistribution,
    };
  }, [reviews, productRatings]);

  const addReview = useCallback(async (review: Omit<Review, "id" | "createdAt" | "updatedAt" | "helpfulCount">) => {
    try {
      const response = await reviewsApi.create({
        productId: review.productId,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        userName: review.userName,
        images: review.images,
        isVerifiedPurchase: review.isVerifiedPurchase,
      });
      
      if (response.success && response.data) {
        const newReview = mapReview(response.data);
        setReviews((prev) => [newReview, ...prev]);
        // Clear cached rating for this product
        setProductRatings((prev) => {
          const newMap = new Map(prev);
          newMap.delete(review.productId);
          return newMap;
        });
      }
    } catch (error) {
      console.error("Error adding review:", error);
      throw error;
    }
  }, []);

  const updateReview = useCallback(async (reviewId: string, updates: Partial<Pick<Review, "rating" | "title" | "comment" | "images">>) => {
    try {
      const response = await reviewsApi.update(reviewId, updates);
      if (response.success && response.data) {
        const updatedReview = mapReview(response.data);
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? updatedReview : r))
        );
        // Clear cached rating
        setProductRatings((prev) => {
          const newMap = new Map(prev);
          const review = reviews.find((r) => r.id === reviewId);
          if (review) newMap.delete(review.productId);
          return newMap;
        });
      }
    } catch (error) {
      console.error("Error updating review:", error);
      throw error;
    }
  }, [reviews]);

  const deleteReview = useCallback(async (reviewId: string) => {
    const review = reviews.find((r) => r.id === reviewId);
    
    try {
      await reviewsApi.delete(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      // Clear cached rating
      if (review) {
        setProductRatings((prev) => {
          const newMap = new Map(prev);
          newMap.delete(review.productId);
          return newMap;
        });
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      throw error;
    }
  }, [reviews]);

  const markHelpful = useCallback(async (reviewId: string) => {
    try {
      await reviewsApi.markHelpful(reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r
        )
      );
    } catch (error) {
      console.error("Error marking helpful:", error);
    }
  }, []);

  const hasUserReviewed = useCallback((productId: string): boolean => {
    if (!user?.id) return false;
    return reviews.some((r) => r.productId === productId && r.userId === user.id);
  }, [reviews, user?.id]);

  const getUserReview = useCallback((productId: string): Review | undefined => {
    if (!user?.id) return undefined;
    return reviews.find((r) => r.productId === productId && r.userId === user.id);
  }, [reviews, user?.id]);

  return (
    <ReviewsContext.Provider
      value={{
        getProductReviews,
        getProductRating,
        addReview,
        updateReview,
        deleteReview,
        markHelpful,
        hasUserReviewed,
        getUserReview,
        isLoading,
        fetchReviews,
      }}
    >
      {children}
    </ReviewsContext.Provider>
  );
};

export const useReviews = () => {
  const context = useContext(ReviewsContext);
  if (!context) {
    throw new Error("useReviews must be used within a ReviewsProvider");
  }
  return context;
};
