import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";

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
  addCashback: (amount: number, orderNumber: string) => void;
  addRefund: (amount: number, orderNumber: string) => void;
  canPay: (amount: number) => boolean;
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

  // Storage key based on user
  const getStorageKey = () => `aljazira_wallet_${user?.id || "guest"}`;
  const getTransactionsKey = () => `aljazira_wallet_transactions_${user?.id || "guest"}`;

  // Load wallet data on mount and user change
  useEffect(() => {
    if (user?.id) {
      const savedBalance = localStorage.getItem(getStorageKey());
      const savedTransactions = localStorage.getItem(getTransactionsKey());
      
      if (savedBalance) {
        setBalance(parseFloat(savedBalance));
      } else {
        // Demo: Give new users AED 50 welcome bonus
        const welcomeBonus = 50;
        setBalance(welcomeBonus);
        localStorage.setItem(getStorageKey(), welcomeBonus.toString());
        
        const welcomeTransaction: WalletTransaction = {
          id: `txn_welcome_${Date.now()}`,
          type: "credit",
          amount: welcomeBonus,
          description: "Welcome bonus! Start shopping with Al Jazira",
          descriptionAr: "مكافأة ترحيبية! ابدأ التسوق مع الجزيرة",
          createdAt: new Date().toISOString(),
        };
        setTransactions([welcomeTransaction]);
        localStorage.setItem(getTransactionsKey(), JSON.stringify([welcomeTransaction]));
      }
      
      if (savedTransactions) {
        setTransactions(JSON.parse(savedTransactions));
      }
    } else {
      setBalance(0);
      setTransactions([]);
    }
  }, [user?.id]);

  // Save to storage when balance or transactions change
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(getStorageKey(), balance.toString());
      localStorage.setItem(getTransactionsKey(), JSON.stringify(transactions));
    }
  }, [balance, transactions, user?.id]);

  // Top up wallet
  const topUp = async (amount: number, paymentMethod: string): Promise<boolean> => {
    if (amount <= 0) return false;

    setIsLoading(true);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const transaction: WalletTransaction = {
        id: `txn_topup_${Date.now()}`,
        type: "topup",
        amount,
        description: `Wallet top-up via ${paymentMethod}`,
        descriptionAr: `شحن المحفظة عبر ${paymentMethod === "card" ? "البطاقة" : paymentMethod === "apple_pay" ? "Apple Pay" : paymentMethod}`,
        createdAt: new Date().toISOString(),
      };

      setBalance((prev) => prev + amount);
      setTransactions((prev) => [transaction, ...prev]);

      return true;
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
    if (amount <= 0 || amount > balance) return false;

    setIsLoading(true);
    try {
      const transaction: WalletTransaction = {
        id: `txn_debit_${Date.now()}`,
        type: "debit",
        amount: -amount,
        description,
        descriptionAr,
        reference,
        createdAt: new Date().toISOString(),
      };

      setBalance((prev) => prev - amount);
      setTransactions((prev) => [transaction, ...prev]);

      return true;
    } finally {
      setIsLoading(false);
    }
  };

  // Add cashback
  const addCashback = (amount: number, orderNumber: string) => {
    if (amount <= 0) return;

    const transaction: WalletTransaction = {
      id: `txn_cashback_${Date.now()}`,
      type: "cashback",
      amount,
      description: `Cashback from order #${orderNumber}`,
      descriptionAr: `استرداد نقدي من الطلب #${orderNumber}`,
      reference: orderNumber,
      createdAt: new Date().toISOString(),
    };

    setBalance((prev) => prev + amount);
    setTransactions((prev) => [transaction, ...prev]);
  };

  // Add refund
  const addRefund = (amount: number, orderNumber: string) => {
    if (amount <= 0) return;

    const transaction: WalletTransaction = {
      id: `txn_refund_${Date.now()}`,
      type: "refund",
      amount,
      description: `Refund for order #${orderNumber}`,
      descriptionAr: `استرداد للطلب #${orderNumber}`,
      reference: orderNumber,
      createdAt: new Date().toISOString(),
    };

    setBalance((prev) => prev + amount);
    setTransactions((prev) => [transaction, ...prev]);
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
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
