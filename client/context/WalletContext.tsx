import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { walletApi, WalletTransaction as ApiWalletTransaction } from "@/lib/api";

export interface WalletTransaction {
  id: string;
  type: "credit" | "debit" | "refund" | "topup" | "cashback";
  amount: number;
  description: string;
  descriptionAr: string;
  reference?: string;
  createdAt: string;
}

interface WalletContextType {
  balance: number;
  transactions: WalletTransaction[];
  isLoading: boolean;
  topUp: (amount: number, paymentMethod: string) => Promise<boolean>;
  deduct: (amount: number, description: string, descriptionAr: string, reference?: string) => Promise<boolean>;
  addCashback: (amount: number, orderNumber: string) => Promise<void>;
  addRefund: (amount: number, orderNumber: string) => Promise<void>;
  canPay: (amount: number) => boolean;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Convert API transaction to local format
  const mapTransaction = (t: ApiWalletTransaction): WalletTransaction => ({
    id: t.id,
    type: t.type as WalletTransaction["type"],
    amount: parseFloat(t.amount),
    description: t.description,
    descriptionAr: t.descriptionAr,
    reference: t.reference || undefined,
    createdAt: t.createdAt,
  });

  // Fetch wallet data from API
  const fetchWallet = useCallback(async () => {
    if (!user?.id) {
      setBalance(0);
      setTransactions([]);
      return;
    }

    try {
      const response = await walletApi.get();
      if (response.success && response.data) {
        setBalance(parseFloat(response.data.balance));
        setTransactions(response.data.transactions.map(mapTransaction));
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
    }
  }, [user?.id]);

  // Load wallet data when user changes (login/logout)
  // Only fetch if user is logged in
  useEffect(() => {
    if (user?.id) {
      fetchWallet();
    } else {
      setBalance(0);
      setTransactions([]);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Removed excessive polling - fetch on-demand instead via refresh()

  // Refresh wallet data
  const refresh = async () => {
    await fetchWallet();
  };

  // Top up wallet
  const topUp = async (amount: number, paymentMethod: string): Promise<boolean> => {
    if (amount <= 0 || !user?.id) return false;

    setIsLoading(true);
    try {
      const response = await walletApi.topUp(amount, paymentMethod);
      if (response.success && response.data) {
        // Refresh to get updated transactions
        await fetchWallet();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Top-up failed:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Deduct from wallet
  const deduct = async (
    amount: number,
    description: string,
    descriptionAr: string,
    reference?: string
  ): Promise<boolean> => {
    if (amount <= 0 || amount > balance || !user?.id) return false;

    setIsLoading(true);
    try {
      const response = await walletApi.deduct(user.id, amount, description, descriptionAr, reference);
      if (response.success && response.data) {
        // Refresh to get updated transactions
        await fetchWallet();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Deduct failed:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Add cashback
  const addCashback = async (amount: number, orderNumber: string) => {
    if (amount <= 0 || !user?.id) return;

    try {
      await walletApi.addCredit(
        user.id,
        amount,
        `Cashback from order #${orderNumber}`,
        "cashback"
      );
      await fetchWallet();
    } catch (error) {
      console.error("Add cashback failed:", error);
    }
  };

  // Add refund
  const addRefund = async (amount: number, orderNumber: string) => {
    if (amount <= 0 || !user?.id) return;

    try {
      await walletApi.addCredit(
        user.id,
        amount,
        `Refund for order #${orderNumber}`,
        "refund"
      );
      await fetchWallet();
    } catch (error) {
      console.error("Add refund failed:", error);
    }
  };

  // Check if can pay
  const canPay = (amount: number): boolean => {
    return balance >= amount;
  };

  return (
    <WalletContext.Provider
      value={{
        balance,
        transactions,
        isLoading,
        topUp,
        deduct,
        addCashback,
        addRefund,
        canPay,
        refresh,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
