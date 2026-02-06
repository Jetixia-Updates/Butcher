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
  User,
  Mail,
  Phone,
  MapPin,
  UserCheck,
  UserX,
  Edit2,
  Send,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { usersApi, walletApi, loyaltyApi, reviewsApi } from "@/lib/api";
import { useAdminChat } from "@/context/ChatContext";
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
    customersList: "Customers List",
    wallets: "Wallets",
    loyalty: "Loyalty Points",
    reviews: "Reviews",
    searchCustomers: "Search customers by name, email...",
    contact: "Contact",
    email: "Email",
    phone: "Phone",
    emirate: "Emirate",
    joined: "Joined",
    active: "Active",
    inactive: "Inactive",
    verifiedAccount: "Verified",
    viewDetails: "View Details",
    editCustomer: "Edit Customer",
    resetPassword: "Reset Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
    passwordMismatch: "Passwords do not match",
    passwordTooShort: "Password must be at least 6 characters",
    passwordResetSuccess: "Password reset successfully",
    passwordResetFailed: "Failed to reset password",
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
    deleteCustomer: "Delete Customer",
    confirmDeleteCustomer: "Are you sure you want to delete this customer? This action cannot be undone.",
    save: "Save",
    firstName: "First Name",
    lastName: "Last Name",
    updateSuccess: "Customer updated successfully",
    updateFailed: "Failed to update customer",
    deleteSuccess: "Customer deleted successfully",
    deleteFailed: "Failed to delete customer",
    toggleActive: "Toggle Active Status",
    sendMessage: "Send Message",
    messageCustomer: "Message Customer",
    typeMessage: "Type your message...",
    send: "Send",
    messageSent: "Message sent successfully",
    messageFailed: "Failed to send message",
  },
  ar: {
    customersManagement: "إدارة العملاء",
    customersList: "قائمة العملاء",
    wallets: "المحافظ",
    loyalty: "نقاط الولاء",
    reviews: "التقييمات",
    searchCustomers: "البحث عن العملاء بالاسم أو البريد...",
    contact: "التواصل",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    emirate: "الإمارة",
    joined: "تاريخ الانضمام",
    active: "نشط",
    inactive: "غير نشط",
    verifiedAccount: "موثق",
    viewDetails: "عرض التفاصيل",
    editCustomer: "تعديل العميل",
    resetPassword: "إعادة تعيين كلمة المرور",
    newPassword: "كلمة المرور الجديدة",
    confirmNewPassword: "تأكيد كلمة المرور الجديدة",
    passwordMismatch: "كلمات المرور غير متطابقة",
    passwordTooShort: "يجب أن تكون كلمة المرور 6 أحرف على الأقل",
    passwordResetSuccess: "تم إعادة تعيين كلمة المرور بنجاح",
    passwordResetFailed: "فشل في إعادة تعيين كلمة المرور",
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
    deleteCustomer: "حذف العميل",
    confirmDeleteCustomer: "هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.",
    save: "حفظ",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    updateSuccess: "تم تحديث العميل بنجاح",
    updateFailed: "فشل تحديث العميل",
    deleteSuccess: "تم حذف العميل بنجاح",
    deleteFailed: "فشل حذف العميل",
    toggleActive: "تغيير حالة النشاط",
    sendMessage: "إرسال رسالة",
    messageCustomer: "مراسلة العميل",
    typeMessage: "اكتب رسالتك...",
    send: "إرسال",
    messageSent: "تم إرسال الرسالة بنجاح",
    messageFailed: "فشل إرسال الرسالة",
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

  // Admin chat hook
  const { sendMessage: sendAdminMessage } = useAdminChat();

  const [activeSection, setActiveSection] = useState<"customers" | "wallets" | "loyalty" | "reviews">("customers");
  const [customers, setCustomers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustModal, setAdjustModal] = useState<{ user: UserType; type: "wallet" | "loyalty" } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ user: UserType; type: "wallet" | "loyalty" } | null>(null);
  const [reviewModal, setReviewModal] = useState<Review | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [editModal, setEditModal] = useState<UserType | null>(null);
  const [messageModal, setMessageModal] = useState<UserType | null>(null);
  
  // Customer wallet/loyalty data cache
  const [customerData, setCustomerData] = useState<Record<string, { balance: number; points: number; tier: string }>>({});

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
        
        // Fetch wallet and loyalty data for each customer from API
        const dataCache: Record<string, { balance: number; points: number; tier: string }> = {};
        let totalBalance = 0;
        let totalPoints = 0;
        
        // Fetch in batches to avoid too many parallel requests
        for (const user of response.data) {
          try {
            const [walletRes, loyaltyRes] = await Promise.all([
              walletApi.get(user.id),
              loyaltyApi.get(user.id),
            ]);
            
            const balance = walletRes.success && walletRes.data ? parseFloat(walletRes.data.balance) : 0;
            const points = loyaltyRes.success && loyaltyRes.data ? loyaltyRes.data.points : 0;
            const tier = loyaltyRes.success && loyaltyRes.data && loyaltyRes.data.currentTier ? loyaltyRes.data.currentTier.name.toLowerCase() : "bronze";
            
            dataCache[user.id] = { balance, points, tier };
            totalBalance += balance;
            totalPoints += points;
          } catch (e) {
            dataCache[user.id] = { balance: 0, points: 0, tier: "bronze" };
          }
        }
        
        setCustomerData(dataCache);
        
        setStats({
          totalCustomers: response.data.length,
          totalWalletBalance: totalBalance,
          totalLoyaltyPoints: totalPoints,
          pendingReviews: reviews.filter(r => r.status === "pending").length,
        });
      }
      
      // Load reviews from API
      await loadReviews();
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await reviewsApi.getAll();
      if (response.success && response.data) {
        const reviewsWithStatus = response.data.map((r: any) => ({
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

  // Get wallet balance for a user (from cache)
  const getWalletBalance = (userId: string): number => {
    return customerData[userId]?.balance || 0;
  };

  // Get loyalty points for a user (from cache)
  const getLoyaltyPoints = (userId: string): number => {
    return customerData[userId]?.points || 0;
  };

  // Get loyalty tier for a user (from cache)
  const getLoyaltyTier = (userId: string): string => {
    return customerData[userId]?.tier || "bronze";
  };

  // Adjust wallet balance via API
  const adjustWalletBalance = async (userId: string, amount: number, reason: string) => {
    try {
      let response;
      if (amount >= 0) {
        response = await walletApi.addCredit(userId, amount, reason || (isRTL ? "تعديل من المدير" : "Admin adjustment"));
      } else {
        response = await walletApi.deduct(userId, Math.abs(amount), reason || (isRTL ? "خصم من المدير" : "Admin deduction"));
      }
      
      if (response.success && response.data) {
        // Update cache
        setCustomerData(prev => ({
          ...prev,
          [userId]: { ...prev[userId], balance: parseFloat(response.data!.balance) },
        }));
        return true;
      } else {
        alert(response.error || (isRTL ? "فشلت العملية" : "Operation failed"));
        return false;
      }
    } catch (error) {
      console.error("Error adjusting wallet:", error);
      alert(isRTL ? "حدث خطأ" : "An error occurred");
      return false;
    }
  };

  // Adjust loyalty points via API
  const adjustLoyaltyPoints = async (userId: string, points: number, reason: string) => {
    try {
      let response;
      if (points >= 0) {
        response = await loyaltyApi.earn(userId, points, reason || (isRTL ? "نقاط إضافية من المدير" : "Bonus from admin"));
      } else {
        response = await loyaltyApi.redeem(userId, Math.abs(points));
      }
      
      if (response.success && response.data) {
        // Update cache
        setCustomerData(prev => ({
          ...prev,
          [userId]: { ...prev[userId], points: response.data!.points, tier: response.data!.tier },
        }));
        return true;
      } else {
        alert(response.error || (isRTL ? "فشلت العملية" : "Operation failed"));
        return false;
      }
    } catch (error) {
      console.error("Error adjusting loyalty:", error);
      alert(isRTL ? "حدث خطأ" : "An error occurred");
      return false;
    }
  };

  // Update review status via API
  const updateReviewStatus = async (reviewId: string, status: "approved" | "rejected") => {
    try {
      const response = await reviewsApi.update(reviewId, { status });
      if (response.success) {
        setReviews(prev => prev.map((r) =>
          r.id === reviewId ? { ...r, status } : r
        ));
      }
    } catch (error) {
      console.error("Error updating review:", error);
    }
  };

  // Delete review via API
  const deleteReview = async (reviewId: string) => {
    if (!confirm(isRTL ? "هل أنت متأكد من حذف هذا التقييم؟" : "Are you sure you want to delete this review?")) return;
    try {
      const response = await reviewsApi.delete(reviewId);
      if (response.success) {
        setReviews(prev => prev.filter((r) => r.id !== reviewId));
      }
    } catch (error) {
      console.error("Error deleting review:", error);
    }
  };

  // Update customer via API
  const updateCustomer = async (userId: string, data: Partial<UserType>) => {
    try {
      const response = await usersApi.update(userId, data);
      if (response.success && response.data) {
        setCustomers(prev => prev.map(c => c.id === userId ? { ...c, ...response.data } : c));
        setEditModal(null);
        alert(t.updateSuccess);
        return true;
      } else {
        alert(response.error || t.updateFailed);
        return false;
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      alert(t.updateFailed);
      return false;
    }
  };

  // Delete customer via API
  const deleteCustomer = async (userId: string) => {
    if (!confirm(t.confirmDeleteCustomer)) return;
    try {
      const response = await usersApi.delete(userId);
      if (response.success) {
        setCustomers(prev => prev.filter(c => c.id !== userId));
        alert(t.deleteSuccess);
      } else {
        alert(response.error || t.deleteFailed);
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert(t.deleteFailed);
    }
  };

  // Toggle customer active status
  const toggleCustomerActive = async (userId: string, currentStatus: boolean) => {
    try {
      // Update customer active status - would need custom API endpoint
      // For now, just toggle in UI
      setCustomers(prev => prev.map(c => c.id === userId ? { ...c, isActive: !currentStatus } : c));
    } catch (error) {
      console.error("Error toggling customer status:", error);
    }
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
            { id: "customers", icon: Users, label: t.customersList },
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

      {/* Customers List Section */}
      {activeSection === "customers" && (
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
                    <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-right" : "text-left")}>
                      {t.customer}
                    </th>
                    <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:table-cell", isRTL ? "text-right" : "text-left")}>
                      {t.contact}
                    </th>
                    <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden lg:table-cell", isRTL ? "text-right" : "text-left")}>
                      {t.emirate}
                    </th>
                    <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden md:table-cell", isRTL ? "text-right" : "text-left")}>
                      {t.status}
                    </th>
                    <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden lg:table-cell", isRTL ? "text-right" : "text-left")}>
                      {t.joined}
                    </th>
                    <th className={cn("px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap", isRTL ? "text-left" : "text-right")}>
                      {t.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm sm:text-lg font-bold text-blue-600">
                              {customer.firstName?.[0] || "?"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm sm:text-base truncate">
                              {customer.firstName} {customer.familyName}
                            </p>
                            <p className="text-xs text-slate-500 truncate sm:hidden">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                        <div className="space-y-1">
                          <p className="text-sm text-slate-900 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {customer.email}
                          </p>
                          <p className="text-sm text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {customer.mobile}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {customer.emirate || "-"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium w-fit",
                            customer.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}>
                            {customer.isActive ? t.active : t.inactive}
                          </span>
                          {customer.isVerified && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium w-fit">
                              {t.verifiedAccount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-500 hidden lg:table-cell">
                        {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString(isRTL ? "ar-AE" : "en-AE") : "-"}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className={cn(
                          "flex items-center gap-1 sm:gap-2 flex-wrap",
                          isRTL ? "justify-start" : "justify-end"
                        )}>
                          <button
                            onClick={() => setMessageModal(customer)}
                            className="p-1.5 sm:p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg flex-shrink-0"
                            title={t.sendMessage}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditModal(customer)}
                            className="p-1.5 sm:p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                            title={t.editCustomer}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleCustomerActive(customer.id, customer.isActive)}
                            className={cn(
                              "p-1.5 sm:p-2 rounded-lg flex-shrink-0",
                              customer.isActive
                                ? "text-green-600 hover:text-orange-600 hover:bg-orange-50"
                                : "text-slate-500 hover:text-green-600 hover:bg-green-50"
                            )}
                            title={t.toggleActive}
                          >
                            {customer.isActive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setActiveSection("wallets")}
                            className="p-1.5 sm:p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0 hidden sm:flex"
                            title={t.wallets}
                          >
                            <Wallet className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveSection("loyalty")}
                            className="p-1.5 sm:p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg flex-shrink-0 hidden sm:flex"
                            title={t.loyalty}
                          >
                            <Award className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCustomer(customer.id)}
                            className="p-1.5 sm:p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                            title={t.deleteCustomer}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

      {/* Edit Customer Modal */}
      {editModal && (
        <EditCustomerModal
          customer={editModal}
          onClose={() => setEditModal(null)}
          onSave={(data) => updateCustomer(editModal.id, data)}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* Message Customer Modal */}
      {messageModal && (
        <MessageCustomerModal
          customer={messageModal}
          onClose={() => setMessageModal(null)}
          onSend={(message) => {
            sendAdminMessage(messageModal.id, message);
            setMessageModal(null);
            alert(t.messageSent);
          }}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        if (type === "wallet") {
          const response = await walletApi.get(user.id);
          if (response.success && response.data?.transactions) {
            setTransactions(response.data.transactions);
          }
        } else {
          const response = await loyaltyApi.get(user.id);
          if (response.success && response.data?.transactions) {
            setTransactions(response.data.transactions);
          }
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
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

// Edit Customer Modal Component
function EditCustomerModal({
  customer,
  onClose,
  onSave,
  isRTL,
  t,
}: {
  customer: UserType;
  onClose: () => void;
  onSave: (data: Partial<UserType>) => Promise<boolean>;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const [formData, setFormData] = useState({
    firstName: customer.firstName || "",
    familyName: customer.familyName || "",
    email: customer.email || "",
    mobile: customer.mobile || "",
    emirate: customer.emirate || "",
    isActive: customer.isActive,
    isVerified: customer.isVerified,
  });
  const [saving, setSaving] = useState(false);

  // Password reset state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const handleResetPassword = async () => {
    setPasswordError("");

    if (newPassword.length < 6) {
      setPasswordError(t.passwordTooShort);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError(t.passwordMismatch);
      return;
    }

    setResettingPassword(true);
    try {
      const response = await usersApi.adminResetPassword(customer.id, newPassword);
      if (response.success) {
        alert(t.passwordResetSuccess);
        setShowResetPassword(false);
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setPasswordError(response.error || t.passwordResetFailed);
      }
    } catch (err) {
      setPasswordError(t.passwordResetFailed);
    }
    setResettingPassword(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{t.editCustomer}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.firstName}
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.lastName}
              </label>
              <input
                type="text"
                value={formData.familyName}
                onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.email}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.phone}
            </label>
            <input
              type="tel"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.emirate}
            </label>
            <select
              value={formData.emirate}
              onChange={(e) => setFormData({ ...formData, emirate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">-</option>
              <option value="Dubai">Dubai</option>
              <option value="Abu Dhabi">Abu Dhabi</option>
              <option value="Sharjah">Sharjah</option>
              <option value="Ajman">Ajman</option>
              <option value="Fujairah">Fujairah</option>
              <option value="Ras Al Khaimah">Ras Al Khaimah</option>
              <option value="Umm Al Quwain">Umm Al Quwain</option>
            </select>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-slate-700">{t.active}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isVerified}
                onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-slate-700">{t.verifiedAccount}</span>
            </label>
          </div>

          {/* Reset Password Section */}
          <div className="border-t border-slate-200 pt-4">
            {!showResetPassword ? (
              <button
                type="button"
                onClick={() => setShowResetPassword(true)}
                className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                <Key className="w-4 h-4" />
                {t.resetPassword}
              </button>
            ) : (
              <div className="space-y-3 bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                    <Key className="w-4 h-4" />
                    {t.resetPassword}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPassword(false);
                      setNewPassword("");
                      setConfirmNewPassword("");
                      setPasswordError("");
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.newPassword}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.confirmNewPassword}
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(e.target.value);
                      setPasswordError("");
                    }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                  />
                </div>
                {passwordError && (
                  <p className="text-xs text-red-600">{passwordError}</p>
                )}
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || !newPassword || !confirmNewPassword}
                  className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {resettingPassword ? "..." : t.resetPassword}
                </button>
              </div>
            )}
          </div>
        </form>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "..." : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// Message Customer Modal Component
function MessageCustomerModal({
  customer,
  onClose,
  onSend,
  isRTL,
  t,
}: {
  customer: UserType;
  onClose: () => void;
  onSend: (message: string) => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    onSend(message.trim());
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t.messageCustomer}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {customer.firstName} {customer.familyName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t.sendMessage}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.typeMessage}
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending ? "..." : t.send}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
