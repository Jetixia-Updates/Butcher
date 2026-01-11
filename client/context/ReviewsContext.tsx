import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

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
  addReview: (review: Omit<Review, "id" | "createdAt" | "updatedAt" | "helpfulCount">) => void;
  updateReview: (reviewId: string, updates: Partial<Pick<Review, "rating" | "title" | "comment" | "images">>) => void;
  deleteReview: (reviewId: string) => void;
  markHelpful: (reviewId: string) => void;
  hasUserReviewed: (productId: string) => boolean;
  getUserReview: (productId: string) => Review | undefined;
}

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

// Initial demo reviews
const INITIAL_REVIEWS: Review[] = [
  {
    id: "review_1",
    productId: "prod_1",
    userId: "user_1",
    userName: "Ahmed M.",
    rating: 5,
    title: "Excellent quality!",
    comment: "The best beef steak I've ever had. Very tender and flavorful. Will definitely order again!",
    isVerifiedPurchase: true,
    helpfulCount: 12,
    createdAt: "2025-12-15T10:30:00Z",
    updatedAt: "2025-12-15T10:30:00Z",
  },
  {
    id: "review_2",
    productId: "prod_1",
    userId: "user_2",
    userName: "Sara K.",
    rating: 4,
    title: "Great but pricey",
    comment: "Quality is amazing, but a bit expensive. Still worth it for special occasions.",
    isVerifiedPurchase: true,
    helpfulCount: 5,
    createdAt: "2025-12-10T14:20:00Z",
    updatedAt: "2025-12-10T14:20:00Z",
  },
  {
    id: "review_3",
    productId: "prod_2",
    userId: "user_3",
    userName: "Mohammed A.",
    rating: 5,
    title: "Perfect lamb chops",
    comment: "Fresh and perfectly cut. My family loved them!",
    isVerifiedPurchase: true,
    helpfulCount: 8,
    createdAt: "2025-12-08T18:45:00Z",
    updatedAt: "2025-12-08T18:45:00Z",
  },
  {
    id: "review_4",
    productId: "prod_3",
    userId: "user_4",
    userName: "Fatima H.",
    rating: 5,
    title: "Best chicken in town",
    comment: "Fresh, well-cleaned, and delicious. Fast delivery too!",
    isVerifiedPurchase: true,
    helpfulCount: 15,
    createdAt: "2025-12-05T09:15:00Z",
    updatedAt: "2025-12-05T09:15:00Z",
  },
  {
    id: "review_5",
    productId: "prod_4",
    userId: "user_5",
    userName: "Omar S.",
    rating: 4,
    title: "Good ground beef",
    comment: "Nice lean ground beef. Perfect for burgers and keema.",
    isVerifiedPurchase: true,
    helpfulCount: 3,
    createdAt: "2025-12-01T11:30:00Z",
    updatedAt: "2025-12-01T11:30:00Z",
  },
];

export const ReviewsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem("product_reviews");
    return saved ? JSON.parse(saved) : INITIAL_REVIEWS;
  });

  // Save to localStorage whenever reviews change
  useEffect(() => {
    localStorage.setItem("product_reviews", JSON.stringify(reviews));
  }, [reviews]);

  const getProductReviews = useCallback((productId: string): Review[] => {
    return reviews
      .filter((r) => r.productId === productId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews]);

  const getProductRating = useCallback((productId: string): ProductRating => {
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
  }, [reviews]);

  const addReview = useCallback((review: Omit<Review, "id" | "createdAt" | "updatedAt" | "helpfulCount">) => {
    const newReview: Review = {
      ...review,
      id: `review_${Date.now()}`,
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setReviews((prev) => [newReview, ...prev]);
  }, []);

  const updateReview = useCallback((reviewId: string, updates: Partial<Pick<Review, "rating" | "title" | "comment" | "images">>) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, ...updates, updatedAt: new Date().toISOString() }
          : r
      )
    );
  }, []);

  const deleteReview = useCallback((reviewId: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  }, []);

  const markHelpful = useCallback((reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, helpfulCount: r.helpfulCount + 1 }
          : r
      )
    );
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
