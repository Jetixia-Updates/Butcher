import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { loyaltyApi, LoyaltyTier as ApiLoyaltyTier, LoyaltyTransaction as ApiLoyaltyTransaction } from "@/lib/api";

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  type: "earn" | "redeem" | "bonus" | "expire";
  points: number;
  description: string;
  orderId?: string;
  createdAt: string;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  nameAr: string;
  minPoints: number;
  multiplier: number; // Points earned per AED
  benefits: string[];
  benefitsAr: string[];
  icon: string;
}

interface LoyaltyContextType {
  points: number;
  totalEarned: number;
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number;
  transactions: LoyaltyTransaction[];
  earnPoints: (amount: number, orderId: string, description: string) => Promise<void>;
  redeemPoints: (points: number, description: string) => Promise<boolean>;
  calculatePointsValue: (points: number) => number; // AED value
  calculatePointsFromOrder: (orderTotal: number) => number;
  referralCode: string;
  applyReferral: (code: string) => Promise<{ success: boolean; message: string }>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

// Default tier for when not loaded yet
const DEFAULT_TIER: LoyaltyTier = {
  id: "bronze",
  name: "Bronze",
  nameAr: "برونزي",
  minPoints: 0,
  multiplier: 1,
  benefits: ["1 point per AED spent", "Birthday bonus"],
  benefitsAr: ["1 نقطة لكل درهم", "مكافأة عيد ميلاد"],
  icon: "🥉",
};

export const LoyaltyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [currentTier, setCurrentTier] = useState<LoyaltyTier>(DEFAULT_TIER);
  const [nextTier, setNextTier] = useState<LoyaltyTier | null>(null);
  const [pointsToNextTier, setPointsToNextTier] = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Points to AED rate (10 points = 1 AED)
  const pointsToAedRate = 0.1;

  // Convert API tier to local format
  const mapTier = (t: ApiLoyaltyTier): LoyaltyTier => ({
    id: t.id,
    name: t.name,
    nameAr: t.nameAr,
    minPoints: t.minPoints,
    multiplier: parseFloat(t.multiplier),
    benefits: t.benefits,
    benefitsAr: t.benefitsAr,
    icon: t.icon,
  });

  // Convert API transaction to local format
  const mapTransaction = (t: ApiLoyaltyTransaction): LoyaltyTransaction => ({
    id: t.id,
    userId: t.userId,
    type: t.type as LoyaltyTransaction["type"],
    points: t.points,
    description: t.description,
    orderId: t.orderId || undefined,
    createdAt: t.createdAt,
  });

  // Fetch loyalty data from API
  const fetchLoyalty = useCallback(async () => {
    if (!user?.id) {
      setPoints(0);
      setTotalEarned(0);
      setTransactions([]);
      setCurrentTier(DEFAULT_TIER);
      setNextTier(null);
      setPointsToNextTier(0);
      setReferralCode("");
      return;
    }

    try {
      const response = await loyaltyApi.get();
      if (response.success && response.data) {
        setPoints(response.data.points);
        setTotalEarned(response.data.totalEarned);
        setReferralCode(response.data.referralCode);
        setCurrentTier(mapTier(response.data.currentTier));
        setNextTier(response.data.nextTier ? mapTier(response.data.nextTier) : null);
        setPointsToNextTier(response.data.pointsToNextTier);
        setTransactions(response.data.transactions.map(mapTransaction));
      }
    } catch (error) {
      console.error("Error fetching loyalty data:", error);
    }
  }, [user?.id]);

  // Load loyalty data on mount and user change
  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  // Refresh loyalty data
  const refresh = async () => {
    await fetchLoyalty();
  };

  const earnPoints = useCallback(async (amount: number, orderId: string, description: string) => {
    if (!user?.id) return;

    try {
      const earnedPoints = Math.floor(amount * currentTier.multiplier);
      await loyaltyApi.earn(user.id, earnedPoints, description, orderId);
      await fetchLoyalty();
    } catch (error) {
      console.error("Error earning points:", error);
    }
  }, [user?.id, currentTier.multiplier, fetchLoyalty]);

  const redeemPoints = useCallback(async (pointsToRedeem: number, description: string): Promise<boolean> => {
    if (!user?.id || pointsToRedeem > points) return false;

    setIsLoading(true);
    try {
      const response = await loyaltyApi.redeem(user.id, pointsToRedeem, description);
      if (response.success) {
        await fetchLoyalty();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error redeeming points:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, points, fetchLoyalty]);

  const calculatePointsValue = useCallback((pointsAmount: number): number => {
    return parseFloat((pointsAmount * pointsToAedRate).toFixed(2));
  }, []);

  const calculatePointsFromOrder = useCallback((orderTotal: number): number => {
    return Math.floor(orderTotal * currentTier.multiplier);
  }, [currentTier.multiplier]);

  const applyReferral = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!user?.id) {
      return { success: false, message: "Please login first" };
    }

    setIsLoading(true);
    try {
      const response = await loyaltyApi.applyReferral(code);
      if (response.success) {
        await fetchLoyalty();
        return { success: true, message: response.message || "Referral applied successfully!" };
      }
      return { success: false, message: response.error || "Failed to apply referral code" };
    } catch (error) {
      console.error("Error applying referral:", error);
      return { success: false, message: "Failed to apply referral code" };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, fetchLoyalty]);

  return (
    <LoyaltyContext.Provider
      value={{
        points,
        totalEarned,
        currentTier,
        nextTier,
        pointsToNextTier,
        transactions,
        earnPoints,
        redeemPoints,
        calculatePointsValue,
        calculatePointsFromOrder,
        referralCode,
        applyReferral,
        isLoading,
        refresh,
      }}
    >
      {children}
    </LoyaltyContext.Provider>
  );
};

export const useLoyalty = () => {
  const context = useContext(LoyaltyContext);
  if (!context) {
    throw new Error("useLoyalty must be used within a LoyaltyProvider");
  }
  return context;
};
