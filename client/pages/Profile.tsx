import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Settings, 
  Bell, 
  CreditCard,
  Gift,
  Heart,
  Package,
  LogOut,
  ChevronRight,
  Edit2,
  Save,
  X,
  Globe,
  Star,
  Award,
  Copy,
  Check
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useWishlist } from "@/context/WishlistContext";
import { useLoyalty } from "@/context/LoyaltyContext";
import { useOrders } from "@/context/OrdersContext";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { cn } from "@/lib/utils";

type TabType = "profile" | "addresses" | "preferences" | "loyalty" | "wishlist";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, updateUser, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { items: wishlistItems, removeFromWishlist } = useWishlist();
  const { points, currentTier, nextTier, pointsToNextTier, transactions, referralCode, applyReferral } = useLoyalty();
  const { orders } = useOrders();
  const isRTL = language === "ar";

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || "",
    familyName: user?.familyName || "",
    email: user?.email || "",
    mobile: user?.mobile || "",
  });
  const [referralInput, setReferralInput] = useState("");
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralMessage, setReferralMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login");
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (user) {
      setEditForm({
        firstName: user.firstName,
        familyName: user.familyName,
        email: user.email,
        mobile: user.mobile,
      });
    }
  }, [user]);

  const translations = {
    en: {
      myAccount: "My Account",
      subtitle: "Manage your profile and preferences",
      profile: "Profile",
      addresses: "Addresses",
      preferences: "Preferences",
      loyalty: "Loyalty",
      wishlist: "Wishlist",
      personalInfo: "Personal Information",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      mobile: "Mobile",
      emirate: "Emirate",
      logout: "Logout",
      savedAddresses: "Saved Addresses",
      addAddress: "Add Address",
      noAddresses: "No saved addresses",
      defaultAddress: "Default",
      settings: "Settings",
      language: "Language",
      notifications: "Notifications",
      emailNotifications: "Email Notifications",
      smsNotifications: "SMS Notifications",
      loyaltyProgram: "Loyalty Program",
      yourPoints: "Your Points",
      currentTier: "Current Tier",
      pointsToNextTier: "Points to next tier",
      earnedPoints: "Total Earned",
      recentActivity: "Recent Activity",
      noActivity: "No activity yet",
      referralCode: "Your Referral Code",
      copyCode: "Copy",
      copied: "Copied!",
      applyReferral: "Have a referral code?",
      apply: "Apply",
      wishlistEmpty: "Your wishlist is empty",
      addToCart: "Add to Cart",
      remove: "Remove",
      viewOrders: "View Orders",
      totalOrders: "Total Orders",
      memberSince: "Member Since",
    },
    ar: {
      myAccount: "حسابي",
      subtitle: "إدارة ملفك الشخصي وإعداداتك",
      profile: "الملف الشخصي",
      addresses: "العناوين",
      preferences: "الإعدادات",
      loyalty: "الولاء",
      wishlist: "المفضلة",
      personalInfo: "المعلومات الشخصية",
      edit: "تعديل",
      save: "حفظ",
      cancel: "إلغاء",
      firstName: "الاسم الأول",
      lastName: "اسم العائلة",
      email: "البريد الإلكتروني",
      mobile: "الجوال",
      emirate: "الإمارة",
      logout: "تسجيل الخروج",
      savedAddresses: "العناوين المحفوظة",
      addAddress: "إضافة عنوان",
      noAddresses: "لا توجد عناوين محفوظة",
      defaultAddress: "الافتراضي",
      settings: "الإعدادات",
      language: "اللغة",
      notifications: "الإشعارات",
      emailNotifications: "إشعارات البريد الإلكتروني",
      smsNotifications: "إشعارات SMS",
      loyaltyProgram: "برنامج الولاء",
      yourPoints: "نقاطك",
      currentTier: "المستوى الحالي",
      pointsToNextTier: "نقاط للمستوى التالي",
      earnedPoints: "إجمالي المكتسب",
      recentActivity: "النشاط الأخير",
      noActivity: "لا يوجد نشاط حتى الآن",
      referralCode: "كود الإحالة الخاص بك",
      copyCode: "نسخ",
      copied: "تم النسخ!",
      applyReferral: "هل لديك كود إحالة؟",
      apply: "تطبيق",
      wishlistEmpty: "قائمة المفضلة فارغة",
      addToCart: "أضف للسلة",
      remove: "حذف",
      viewOrders: "عرض الطلبات",
      totalOrders: "إجمالي الطلبات",
      memberSince: "عضو منذ",
    },
  };

  const t = translations[language];

  const handleSaveProfile = () => {
    updateUser({
      firstName: editForm.firstName,
      familyName: editForm.familyName,
      email: editForm.email,
      mobile: editForm.mobile,
    });
    setIsEditing(false);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const handleApplyReferral = () => {
    if (!referralInput.trim()) return;
    const result = applyReferral(referralInput.trim().toUpperCase());
    setReferralMessage({ type: result.success ? "success" : "error", text: result.message });
    if (result.success) {
      setReferralInput("");
    }
    setTimeout(() => setReferralMessage(null), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!isLoggedIn || !user) {
    return null;
  }

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: t.profile, icon: User },
    { id: "addresses", label: t.addresses, icon: MapPin },
    { id: "preferences", label: t.preferences, icon: Settings },
    { id: "loyalty", label: t.loyalty, icon: Award },
    { id: "wishlist", label: t.wishlist, icon: Heart },
  ];

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2">{t.myAccount}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card-premium p-4 space-y-2">
              {/* User Info */}
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {user.firstName.charAt(0)}{user.familyName.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {user.firstName} {user.familyName}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              {/* Tabs */}
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                    {tab.id === "wishlist" && wishlistItems.length > 0 && (
                      <span className={cn(
                        "ml-auto text-xs px-2 py-0.5 rounded-full",
                        activeTab === tab.id ? "bg-white/20" : "bg-primary text-primary-foreground"
                      )}>
                        {wishlistItems.length}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Orders Link */}
              <button
                onClick={() => navigate("/orders")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <Package className="w-5 h-5" />
                <span className="font-medium">{t.viewOrders}</span>
                <ChevronRight className={cn("w-4 h-4 ml-auto", isRTL && "rotate-180")} />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors mt-4"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">{t.logout}</span>
              </button>
            </div>

            {/* Quick Stats */}
            <div className="card-premium p-4 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.totalOrders}</span>
                <span className="font-bold text-foreground">{orders.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.yourPoints}</span>
                <span className="font-bold text-primary">{points.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.memberSince}</span>
                <span className="font-medium text-foreground">2025</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">{t.personalInfo}</h2>
                  {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="btn-outline flex items-center gap-2">
                      <Edit2 className="w-4 h-4" />
                      {t.edit}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleSaveProfile} className="btn-primary flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        {t.save}
                      </button>
                      <button onClick={() => setIsEditing(false)} className="btn-outline flex items-center gap-2">
                        <X className="w-4 h-4" />
                        {t.cancel}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.firstName}</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.lastName}</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.familyName}
                        onChange={(e) => setEditForm({ ...editForm, familyName: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.familyName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.email}</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.mobile}</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editForm.mobile}
                        onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{user.mobile}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t.emirate}</label>
                    <p className="text-foreground font-medium">{user.emirate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === "addresses" && (
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-foreground">{t.savedAddresses}</h2>
                  <button onClick={() => navigate("/checkout")} className="btn-primary flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {t.addAddress}
                  </button>
                </div>
                <p className="text-muted-foreground text-center py-8">{t.noAddresses}</p>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === "preferences" && (
              <div className="card-premium p-6 space-y-6">
                <h2 className="text-xl font-bold text-foreground">{t.settings}</h2>

                <div className="space-y-4">
                  {/* Language */}
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t.language}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLanguage("en")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-medium transition-colors",
                          language === "en" ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}
                      >
                        English
                      </button>
                      <button
                        onClick={() => setLanguage("ar")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-medium transition-colors",
                          language === "ar" ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}
                      >
                        العربية
                      </button>
                    </div>
                  </div>

                  {/* Email Notifications */}
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t.emailNotifications}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* SMS Notifications */}
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">{t.smsNotifications}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Loyalty Tab */}
            {activeTab === "loyalty" && (
              <div className="space-y-6">
                {/* Loyalty Summary */}
                <div className="card-premium p-6">
                  <h2 className="text-xl font-bold text-foreground mb-6">{t.loyaltyProgram}</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-primary/10 rounded-xl">
                      <div className="text-4xl mb-2">{currentTier.icon}</div>
                      <p className="text-sm text-muted-foreground">{t.currentTier}</p>
                      <p className="font-bold text-lg text-foreground">
                        {isRTL ? currentTier.nameAr : currentTier.name}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-xl">
                      <Star className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t.yourPoints}</p>
                      <p className="font-bold text-2xl text-primary">{points.toLocaleString()}</p>
                    </div>
                    {nextTier && (
                      <div className="text-center p-4 bg-muted rounded-xl">
                        <div className="text-4xl mb-2">{nextTier.icon}</div>
                        <p className="text-sm text-muted-foreground">{t.pointsToNextTier}</p>
                        <p className="font-bold text-lg text-foreground">{pointsToNextTier.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Tier Progress */}
                  {nextTier && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>{isRTL ? currentTier.nameAr : currentTier.name}</span>
                        <span>{isRTL ? nextTier.nameAr : nextTier.name}</span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((points + (nextTier.minPoints - pointsToNextTier - points)) / nextTier.minPoints) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Referral Code */}
                  <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                    <p className="font-medium text-foreground">{t.referralCode}</p>
                    <div className="flex gap-2">
                      <code className="flex-1 px-4 py-2 bg-background rounded-lg font-mono text-lg">
                        {referralCode}
                      </code>
                      <button
                        onClick={handleCopyReferral}
                        className="btn-primary flex items-center gap-2"
                      >
                        {referralCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {referralCopied ? t.copied : t.copyCode}
                      </button>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">{t.applyReferral}</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                          placeholder="REF..."
                          className="flex-1 px-3 py-2 border border-border rounded-lg focus:border-primary outline-none font-mono"
                        />
                        <button onClick={handleApplyReferral} className="btn-outline">
                          {t.apply}
                        </button>
                      </div>
                      {referralMessage && (
                        <p className={cn("text-sm mt-2", referralMessage.type === "success" ? "text-green-600" : "text-destructive")}>
                          {referralMessage.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="card-premium p-6">
                  <h3 className="font-bold text-foreground mb-4">{t.recentActivity}</h3>
                  {transactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">{t.noActivity}</p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-foreground">{tx.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={cn(
                            "font-bold",
                            tx.points > 0 ? "text-green-600" : "text-destructive"
                          )}>
                            {tx.points > 0 ? "+" : ""}{tx.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Wishlist Tab */}
            {activeTab === "wishlist" && (
              <div className="card-premium p-6">
                <h2 className="text-xl font-bold text-foreground mb-6">{t.wishlist}</h2>

                {wishlistItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t.wishlistEmpty}</p>
                    <button onClick={() => navigate("/products")} className="btn-primary mt-4">
                      {language === "ar" ? "تصفح المنتجات" : "Browse Products"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {wishlistItems.map((item) => (
                      <div key={item.id} className="flex gap-3 p-3 border border-border rounded-lg">
                        <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🥩</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate">
                            {isRTL && item.nameAr ? item.nameAr : item.name}
                          </h4>
                          <p className="text-primary font-bold">
                            <PriceDisplay price={item.price} size="sm" />
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => navigate(`/products/${item.productId}`)}
                              className="text-xs text-primary hover:underline"
                            >
                              {language === "ar" ? "عرض" : "View"}
                            </button>
                            <button
                              onClick={() => removeFromWishlist(item.productId)}
                              className="text-xs text-destructive hover:underline"
                            >
                              {t.remove}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
