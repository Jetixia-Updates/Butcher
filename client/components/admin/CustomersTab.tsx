/**
 * Customers Management Tab
 * Manage customer wallets, loyalty points, and review moderation
 */

import React, { useState, useEffect } from "react";
import {
  Wallet,
  Award,
  Star,
  Search,
  Plus,
  Minus,
  RefreshCw,
  Users,
  Eye,
  Trash2,
  Check,
  X,
  MessageSquare,
  DollarSign,
  Gift,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { usersApi } from "@/lib/api";
import type { User as UserType } from "@shared/api";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

// Wallet transaction for admin
interface WalletTransaction {
  id: string;
  type: "credit" | "debit" | "refund" | "topup" | "cashback" | "admin_adjustment";
  amount: number;
  description: string;
  descriptionAr: string;
  reference?: string;
  createdAt: string;
}

// Review interface
interface Review {
  id: string;
  productId: string;
  productName: string;
  productNameAr?: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const translations = {
  en: {
    customersManagement: "Customers Management",
    wallets: "Wallets",
    loyalty: "Loyalty Points",
    reviews: "Reviews",
    searchCustomers: "Search customers by name, email...",
    customer: "Customer",
    balance: "Balance",
    totalEarned: "Total Earned",
    tier: "Tier",
    points: "Points",
    actions: "Actions",
    adjustBalance: "Adjust Balance",
    adjustPoints: "Adjust Points",
    viewHistory: "View History",
    add: "Add",
    deduct: "Deduct",
    amount: "Amount",
    reason: "Reason",
    cancel: "Cancel",
    confirm: "Confirm",
    transactionHistory: "Transaction History",
    noTransactions: "No transactions found",
    noCustomers: "No customers found",
    noReviews: "No reviews to moderate",
    refresh: "Refresh",
    totalCustomers: "Total Customers",
    totalWalletBalance: "Total Wallet Balance",
    totalLoyaltyPoints: "Total Loyalty Points",
    pendingReviews: "Pending Reviews",
    product: "Product",
    rating: "Rating",
    status: "Status",
    approve: "Approve",
    reject: "Reject",
    delete: "Delete",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    all: "All",
    verified: "Verified Purchase",
    helpful: "helpful",
    reviewDetails: "Review Details",
    adminAdjustment: "Admin adjustment",
    bonusAdded: "Bonus added by admin",
    pointsDeducted: "Points deducted by admin",
    walletCredited: "Wallet credited by admin",
    walletDebited: "Wallet debited by admin",
    aed: "AED",
    pts: "pts",
  },
  ar: {
    customersManagement: "إدارة العملاء",
    wallets: "المحافظ",
    loyalty: "نقاط الولاء",
    reviews: "التقييمات",
    searchCustomers: "البحث عن العملاء بالاسم أو البريد...",
    customer: "العميل",
    balance: "الرصيد",
    totalEarned: "إجمالي المكتسب",
    tier: "المستوى",
    points: "النقاط",
    actions: "الإجراءات",
    adjustBalance: "تعديل الرصيد",
    adjustPoints: "تعديل النقاط",
    viewHistory: "عرض السجل",
    add: "إضافة",
    deduct: "خصم",
    amount: "المبلغ",
    reason: "السبب",
    cancel: "إلغاء",
    confirm: "تأكيد",
    transactionHistory: "سجل المعاملات",
    noTransactions: "لا توجد معاملات",
    noCustomers: "لا يوجد عملاء",
    noReviews: "لا توجد تقييمات للمراجعة",
    refresh: "تحديث",
    totalCustomers: "إجمالي العملاء",
    totalWalletBalance: "إجمالي رصيد المحافظ",
    totalLoyaltyPoints: "إجمالي نقاط الولاء",
    pendingReviews: "التقييمات المعلقة",
    product: "المنتج",
    rating: "التقييم",
    status: "الحالة",
    approve: "موافقة",
    reject: "رفض",
    delete: "حذف",
    pending: "معلق",
    approved: "مقبول",
    rejected: "مرفوض",
    all: "الكل",
    verified: "شراء موثق",
    helpful: "مفيد",
    reviewDetails: "تفاصيل التقييم",
    adminAdjustment: "تعديل إداري",
    bonusAdded: "مكافأة مضافة من المدير",
    pointsDeducted: "نقاط مخصومة من المدير",
    walletCredited: "رصيد مضاف من المدير",
    walletDebited: "رصيد مخصوم من المدير",
    aed: "د.إ",
    pts: "نقطة",
  },
};

const TIER_CONFIG = {
  bronze: { color: "bg-amber-100 text-amber-700", icon: "🥉" },
  silver: { color: "bg-slate-100 text-slate-700", icon: "🥈" },
  gold: { color: "bg-yellow-100 text-yellow-700", icon: "🥇" },
  platinum: { color: "bg-purple-100 text-purple-700", icon: "💎" },
};

export function CustomersTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const t = translations[language];

  const [activeSection, setActiveSection] = useState<"wallets" | "loyalty" | "reviews">("wallets");
  const [customers, setCustomers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustModal, setAdjustModal] = useState<{ user: UserType; type: "wallet" | "loyalty" } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ user: UserType; type: "wallet" | "loyalty" } | null>(null);
  const [reviewModal, setReviewModal] = useState<Review | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Stats
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalWalletBalance: 0,
    totalLoyaltyPoints: 0,
    pendingReviews: 0,
  });

  // Load data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch customers
      const response = await usersApi.getAll({ role: "customer" });
      if (response.success && response.data) {
        setCustomers(response.data);
        
        // Calculate stats from localStorage data
        let totalBalance = 0;
        let totalPoints = 0;
        
        response.data.forEach((user: UserType) => {
          const walletBalance = parseFloat(localStorage.getItem(`aljazira_wallet_${user.id}`) || "0");
          const loyaltyPoints = parseInt(localStorage.getItem(`loyalty_points_${user.id}`) || "0");
          totalBalance += walletBalance;
          totalPoints += loyaltyPoints;
        });
        
        setStats({
          totalCustomers: response.data.length,
          totalWalletBalance: totalBalance,
          totalLoyaltyPoints: totalPoints,
          pendingReviews: reviews.filter(r => r.status === "pending").length,
        });
      }
      
      // Load reviews
      loadReviews();
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = () => {
    try {
      const stored = localStorage.getItem("product_reviews");
      if (stored) {
        const allReviews = JSON.parse(stored);
        // Add status to reviews if missing
        const reviewsWithStatus = allReviews.map((r: any) => ({
          ...r,
          status: r.status || "approved",
          productName: r.productName || "Product",
        }));
        setReviews(reviewsWithStatus);
      }
    } catch {
      setReviews([]);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.firstName?.toLowerCase().includes(query) ||
      customer.familyName?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  const filteredReviews = reviews.filter((review) => {
    if (reviewFilter === "all") return true;
    return review.status === reviewFilter;
  });

  // Get wallet balance for a user
  const getWalletBalance = (userId: string): number => {
    return parseFloat(localStorage.getItem(`aljazira_wallet_${userId}`) || "0");
  };

  // Get loyalty points for a user
  const getLoyaltyPoints = (userId: string): number => {
    return parseInt(localStorage.getItem(`loyalty_points_${userId}`) || "0");
  };

  // Get loyalty tier for a user
  const getLoyaltyTier = (userId: string): string => {
    const totalEarned = parseInt(localStorage.getItem(`loyalty_total_${userId}`) || "0");
    if (totalEarned >= 5000) return "platinum";
    if (totalEarned >= 2000) return "gold";
    if (totalEarned >= 500) return "silver";
    return "bronze";
  };

  // Adjust wallet balance
  const adjustWalletBalance = (userId: string, amount: number, reason: string) => {
    const currentBalance = getWalletBalance(userId);
    const newBalance = currentBalance + amount;
    
    if (newBalance < 0) {
      alert(isRTL ? "الرصيد غير كافٍ" : "Insufficient balance");
      return false;
    }
    
    localStorage.setItem(`aljazira_wallet_${userId}`, newBalance.toString());
    
    // Add transaction
    const transactionsKey = `aljazira_wallet_transactions_${userId}`;
    const existingTransactions = JSON.parse(localStorage.getItem(transactionsKey) || "[]");
    const newTransaction: WalletTransaction = {
      id: `txn_admin_${Date.now()}`,
      type: amount >= 0 ? "credit" : "debit",
      amount: amount,
      description: reason || (amount >= 0 ? t.walletCredited : t.walletDebited),
      descriptionAr: reason || (amount >= 0 ? "رصيد مضاف من المدير" : "رصيد مخصوم من المدير"),
      reference: "admin",
      createdAt: new Date().toISOString(),
    };
    existingTransactions.unshift(newTransaction);
    localStorage.setItem(transactionsKey, JSON.stringify(existingTransactions));
    
    return true;
  };

  // Adjust loyalty points
  const adjustLoyaltyPoints = (userId: string, points: number, reason: string) => {
    const currentPoints = getLoyaltyPoints(userId);
    const newPoints = currentPoints + points;
    
    if (newPoints < 0) {
      alert(isRTL ? "النقاط غير كافية" : "Insufficient points");
      return false;
    }
    
    localStorage.setItem(`loyalty_points_${userId}`, newPoints.toString());
    
    if (points > 0) {
      const totalEarned = parseInt(localStorage.getItem(`loyalty_total_${userId}`) || "0");
      localStorage.setItem(`loyalty_total_${userId}`, (totalEarned + points).toString());
    }
    
    // Add transaction
    const transactionsKey = `loyalty_transactions_${userId}`;
    const existingTransactions = JSON.parse(localStorage.getItem(transactionsKey) || "[]");
    const newTransaction = {
      id: `trans_admin_${Date.now()}`,
      userId,
      type: points >= 0 ? "bonus" : "redeem",
      points,
      description: reason || (points >= 0 ? t.bonusAdded : t.pointsDeducted),
      createdAt: new Date().toISOString(),
    };
    existingTransactions.unshift(newTransaction);
    localStorage.setItem(transactionsKey, JSON.stringify(existingTransactions));
    
    return true;
  };

  // Update review status
  const updateReviewStatus = (reviewId: string, status: "approved" | "rejected") => {
    const updated = reviews.map((r) =>
      r.id === reviewId ? { ...r, status } : r
    );
    setReviews(updated);
    localStorage.setItem("product_reviews", JSON.stringify(updated));
  };

  // Delete review
  const deleteReview = (reviewId: string) => {
    if (!confirm(isRTL ? "هل أنت متأكد من حذف هذا التقييم؟" : "Are you sure you want to delete this review?")) return;
    const updated = reviews.filter((r) => r.id !== reviewId);
    setReviews(updated);
    localStorage.setItem("product_reviews", JSON.stringify(updated));
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.customersManagement}</h3>
          <p className="text-sm text-slate-500">
            {stats.totalCustomers} {t.totalCustomers}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {t.refresh}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.totalCustomers}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.totalCustomers}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.totalWalletBalance}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.totalWalletBalance.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.totalLoyaltyPoints}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.totalLoyaltyPoints.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{t.pendingReviews}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{reviews.filter(r => r.status === "pending").length}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-2">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: "wallets", icon: Wallet, label: t.wallets },
            { id: "loyalty", icon: Award, label: t.loyalty },
            { id: "reviews", icon: Star, label: t.reviews },
          ].map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  activeSection === section.id
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="w-4 h-4" />
                {section.label}
                {section.id === "reviews" && reviews.filter(r => r.status === "pending").length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {reviews.filter(r => r.status === "pending").length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Wallets Section */}
      {activeSection === "wallets" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400", isRTL ? "right-3" : "left-3")} />
              <input
                type="text"
                placeholder={t.searchCustomers}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none",
                  isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                )}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t.noCustomers}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>{t.customer}</th>
                    <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>{t.balance}</th>
                    <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center")}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCustomers.map((customer) => {
                    const balance = getWalletBalance(customer.id);
                    return (
                      <tr key={customer.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                              <span className="font-bold text-slate-600">{customer.firstName?.[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{customer.firstName} {customer.familyName}</p>
                              <p className="text-xs text-slate-500">{customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("font-bold text-lg", balance >= 0 ? "text-green-600" : "text-red-600")}>
                            {balance.toFixed(2)} {t.aed}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setAdjustModal({ user: customer, type: "wallet" })}
                              className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20"
                            >
                              {t.adjustBalance}
                            </button>
                            <button
                              onClick={() => setHistoryModal({ user: customer, type: "wallet" })}
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Loyalty Section */}
      {activeSection === "loyalty" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400", isRTL ? "right-3" : "left-3")} />
              <input
                type="text"
                placeholder={t.searchCustomers}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none",
                  isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                )}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t.noCustomers}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>{t.customer}</th>
                    <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>{t.points}</th>
                    <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>{t.tier}</th>
                    <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center")}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCustomers.map((customer) => {
                    const points = getLoyaltyPoints(customer.id);
                    const tier = getLoyaltyTier(customer.id);
                    const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
                    return (
                      <tr key={customer.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                              <span className="font-bold text-slate-600">{customer.firstName?.[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{customer.firstName} {customer.familyName}</p>
                              <p className="text-xs text-slate-500">{customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-lg text-purple-600">
                            {points.toLocaleString()} {t.pts}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium", tierConfig.color)}>
                            <span>{tierConfig.icon}</span>
                            {tier.charAt(0).toUpperCase() + tier.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setAdjustModal({ user: customer, type: "loyalty" })}
                              className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
                            >
                              {t.adjustPoints}
                            </button>
                            <button
                              onClick={() => setHistoryModal({ user: customer, type: "loyalty" })}
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reviews Section */}
      {activeSection === "reviews" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setReviewFilter(filter)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    reviewFilter === filter
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {t[filter]}
                  {filter !== "all" && (
                    <span className="ml-1.5 text-xs">
                      ({reviews.filter(r => r.status === filter).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{t.noReviews}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredReviews.map((review) => (
                <div key={review.id} className="p-4 hover:bg-slate-50">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900">{review.userName}</span>
                        {review.isVerifiedPurchase && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {t.verified}
                          </span>
                        )}
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          review.status === "pending" && "bg-yellow-100 text-yellow-700",
                          review.status === "approved" && "bg-green-100 text-green-700",
                          review.status === "rejected" && "bg-red-100 text-red-700"
                        )}>
                          {t[review.status]}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{t.product}: {review.productName}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "w-4 h-4",
                              i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-slate-300"
                            )}
                          />
                        ))}
                      </div>
                      <p className="font-medium text-slate-800 mt-2">{review.title}</p>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{review.comment}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(review.createdAt).toLocaleDateString(isRTL ? "ar-AE" : "en-AE")}
                        {review.helpfulCount > 0 && (
                          <span className="ml-2">• {review.helpfulCount} {t.helpful}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {review.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateReviewStatus(review.id, "approved")}
                            className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                            title={t.approve}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateReviewStatus(review.id, "rejected")}
                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                            title={t.reject}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteReview(review.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title={t.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Adjust Modal */}
      {adjustModal && (
        <AdjustModal
          user={adjustModal.user}
          type={adjustModal.type}
          onClose={() => setAdjustModal(null)}
          onConfirm={(amount, reason) => {
            if (adjustModal.type === "wallet") {
              if (adjustWalletBalance(adjustModal.user.id, amount, reason)) {
                fetchData();
                setAdjustModal(null);
              }
            } else {
              if (adjustLoyaltyPoints(adjustModal.user.id, amount, reason)) {
                fetchData();
                setAdjustModal(null);
              }
            }
          }}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* History Modal */}
      {historyModal && (
        <HistoryModal
          user={historyModal.user}
          type={historyModal.type}
          onClose={() => setHistoryModal(null)}
          isRTL={isRTL}
          t={t}
        />
      )}
    </div>
  );
}

// Adjust Modal Component
function AdjustModal({
  user,
  type,
  onClose,
  onConfirm,
  isRTL,
  t,
}: {
  user: UserType;
  type: "wallet" | "loyalty";
  onClose: () => void;
  onConfirm: (amount: number, reason: string) => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    onConfirm(mode === "add" ? numAmount : -numAmount, reason);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {type === "wallet" ? t.adjustBalance : t.adjustPoints}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {user.firstName} {user.familyName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("add")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors",
                mode === "add"
                  ? "bg-green-100 text-green-700 border-2 border-green-500"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              <Plus className="w-4 h-4" />
              {t.add}
            </button>
            <button
              type="button"
              onClick={() => setMode("deduct")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors",
                mode === "deduct"
                  ? "bg-red-100 text-red-700 border-2 border-red-500"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              <Minus className="w-4 h-4" />
              {t.deduct}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.amount} *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
              required
              placeholder={type === "wallet" ? "0.00" : "0"}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.reason}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isRTL ? "سبب التعديل (اختياري)" : "Reason for adjustment (optional)"}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className={cn(
                "flex-1 py-2 rounded-lg font-medium text-white",
                mode === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
              )}
            >
              {t.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// History Modal Component
function HistoryModal({
  user,
  type,
  onClose,
  isRTL,
  t,
}: {
  user: UserType;
  type: "wallet" | "loyalty";
  onClose: () => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const key = type === "wallet"
      ? `aljazira_wallet_transactions_${user.id}`
      : `loyalty_transactions_${user.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setTransactions(JSON.parse(stored));
    }
  }, [user.id, type]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t.transactionHistory}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {user.firstName} {user.familyName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">{t.noTransactions}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {isRTL ? tx.descriptionAr || tx.description : tx.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.createdAt).toLocaleDateString(isRTL ? "ar-AE" : "en-AE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className={cn(
                    "font-bold",
                    (tx.amount || tx.points) >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {(tx.amount || tx.points) >= 0 ? "+" : ""}
                    {type === "wallet" ? `${tx.amount?.toFixed(2)} ${t.aed}` : `${tx.points} ${t.pts}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
