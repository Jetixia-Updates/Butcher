import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

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
  earnPoints: (amount: number, orderId: string, description: string) => void;
  redeemPoints: (points: number, description: string) => boolean;
  calculatePointsValue: (points: number) => number; // AED value
  calculatePointsFromOrder: (orderTotal: number) => number;
  referralCode: string;
  applyReferral: (code: string) => { success: boolean; message: string };
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

// Loyalty tiers
const TIERS: LoyaltyTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    nameAr: "برونزي",
    minPoints: 0,
    multiplier: 1,
    benefits: ["1 point per AED spent", "Birthday bonus"],
    benefitsAr: ["1 نقطة لكل درهم", "مكافأة عيد ميلاد"],
    icon: "🥉",
  },
  {
    id: "silver",
    name: "Silver",
    nameAr: "فضي",
    minPoints: 500,
    multiplier: 1.5,
    benefits: ["1.5 points per AED spent", "Birthday bonus", "Early access to sales"],
    benefitsAr: ["1.5 نقطة لكل درهم", "مكافأة عيد ميلاد", "وصول مبكر للتخفيضات"],
    icon: "🥈",
  },
  {
    id: "gold",
    name: "Gold",
    nameAr: "ذهبي",
    minPoints: 2000,
    multiplier: 2,
    benefits: ["2 points per AED spent", "Birthday bonus", "Early access to sales", "Free delivery"],
    benefitsAr: ["2 نقطة لكل درهم", "مكافأة عيد ميلاد", "وصول مبكر للتخفيضات", "توصيل مجاني"],
    icon: "🥇",
  },
  {
    id: "platinum",
    name: "Platinum",
    nameAr: "بلاتيني",
    minPoints: 5000,
    multiplier: 3,
    benefits: ["3 points per AED spent", "Birthday bonus", "Early access to sales", "Free delivery", "VIP support"],
    benefitsAr: ["3 نقطة لكل درهم", "مكافأة عيد ميلاد", "وصول مبكر للتخفيضات", "توصيل مجاني", "دعم VIP"],
    icon: "💎",
  },
];

// Points conversion: 100 points = 10 AED
const POINTS_TO_AED = 0.1;

export const LoyaltyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);

  // Load loyalty data from localStorage
  useEffect(() => {
    if (user?.id) {
      const savedPoints = localStorage.getItem(`loyalty_points_${user.id}`);
      const savedTotal = localStorage.getItem(`loyalty_total_${user.id}`);
      const savedTransactions = localStorage.getItem(`loyalty_transactions_${user.id}`);

      if (savedPoints) setPoints(parseInt(savedPoints, 10));
      if (savedTotal) setTotalEarned(parseInt(savedTotal, 10));
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    } else {
      setPoints(0);
      setTotalEarned(0);
      setTransactions([]);
    }
  }, [user?.id]);

  // Save to localStorage
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`loyalty_points_${user.id}`, points.toString());
      localStorage.setItem(`loyalty_total_${user.id}`, totalEarned.toString());
      localStorage.setItem(`loyalty_transactions_${user.id}`, JSON.stringify(transactions));
    }
  }, [user?.id, points, totalEarned, transactions]);

  const currentTier = TIERS.reduce((acc, tier) => {
    if (totalEarned >= tier.minPoints) return tier;
    return acc;
  }, TIERS[0]);

  const nextTier = TIERS.find((tier) => tier.minPoints > totalEarned) || null;
  const pointsToNextTier = nextTier ? nextTier.minPoints - totalEarned : 0;

  const earnPoints = useCallback((amount: number, orderId: string, description: string) => {
    const earnedPoints = Math.floor(amount * currentTier.multiplier);
    
    const transaction: LoyaltyTransaction = {
      id: `trans_${Date.now()}`,
      userId: user?.id || "",
      type: "earn",
      points: earnedPoints,
      description,
      orderId,
      createdAt: new Date().toISOString(),
    };

    setPoints((prev) => prev + earnedPoints);
    setTotalEarned((prev) => prev + earnedPoints);
    setTransactions((prev) => [transaction, ...prev]);
  }, [currentTier.multiplier, user?.id]);

  const redeemPoints = useCallback((pointsToRedeem: number, description: string): boolean => {
    if (pointsToRedeem > points) return false;

    const transaction: LoyaltyTransaction = {
      id: `trans_${Date.now()}`,
      userId: user?.id || "",
      type: "redeem",
      points: -pointsToRedeem,
      description,
      createdAt: new Date().toISOString(),
    };

    setPoints((prev) => prev - pointsToRedeem);
    setTransactions((prev) => [transaction, ...prev]);
    return true;
  }, [points, user?.id]);

  const calculatePointsValue = useCallback((pointsAmount: number): number => {
    return parseFloat((pointsAmount * POINTS_TO_AED).toFixed(2));
  }, []);

  const calculatePointsFromOrder = useCallback((orderTotal: number): number => {
    return Math.floor(orderTotal * currentTier.multiplier);
  }, [currentTier.multiplier]);

  const referralCode = user?.id ? `REF${user.id.toUpperCase().slice(-6)}` : "";

  const applyReferral = useCallback((code: string): { success: boolean; message: string } => {
    if (!user?.id) {
      return { success: false, message: "Please login first" };
    }

    const appliedReferrals = localStorage.getItem(`applied_referrals_${user.id}`);
    const referralsList = appliedReferrals ? JSON.parse(appliedReferrals) : [];

    if (referralsList.includes(code)) {
      return { success: false, message: "You have already used this referral code" };
    }

    if (code === referralCode) {
      return { success: false, message: "You cannot use your own referral code" };
    }

    // Check if referral code exists (simplified check)
    if (!code.startsWith("REF") || code.length < 6) {
      return { success: false, message: "Invalid referral code" };
    }

    // Add bonus points for referral
    const bonusPoints = 100;
    const transaction: LoyaltyTransaction = {
      id: `trans_${Date.now()}`,
      userId: user.id,
      type: "bonus",
      points: bonusPoints,
      description: `Referral bonus from code ${code}`,
      createdAt: new Date().toISOString(),
    };

    setPoints((prev) => prev + bonusPoints);
    setTotalEarned((prev) => prev + bonusPoints);
    setTransactions((prev) => [transaction, ...prev]);

    referralsList.push(code);
    localStorage.setItem(`applied_referrals_${user.id}`, JSON.stringify(referralsList));

    return { success: true, message: `You earned ${bonusPoints} bonus points!` };
  }, [user?.id, referralCode]);

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
