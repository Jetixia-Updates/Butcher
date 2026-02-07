import React, { useState, useMemo } from "react";
import {
  Percent,
  Flame,
  Gift,
  Tag,
  Star,
  Sparkles,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProducts } from "@/context/ProductsContext";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";

type DealCategory = "all" | "flash" | "bundle" | "seasonal" | "clearance";

export default function DealsPage() {
  const { t, language } = useLanguage();
  const { products } = useProducts();
  const { promoCodes: adminPromoCodes } = useSettings();
  const isRTL = language === "ar";

  const [activeCategory, setActiveCategory] = useState<DealCategory>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Convert admin promo codes to display format
  const promoCodes = useMemo(() => {
    const bgColors = [
      "from-purple-500 to-indigo-600",
      "from-red-500 to-pink-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-600",
      "from-blue-500 to-cyan-600",
    ];

    return adminPromoCodes
      .filter((p) => p.enabled)
      .map((p, index) => ({
        id: p.id,
        code: p.code,
        titleEn: p.description || `${p.discount}${p.type === "percent" ? "%" : " AED"} Off`,
        titleAr: p.descriptionAr || `خصم ${p.discount}${p.type === "percent" ? "%" : " درهم"}`,
        descriptionEn: p.minOrder
          ? `${p.discount}${p.type === "percent" ? "%" : " AED"} off on orders above ${p.minOrder} AED`
          : `${p.discount}${p.type === "percent" ? "%" : " AED"} off your order`,
        descriptionAr: p.minOrder
          ? `خصم ${p.discount}${p.type === "percent" ? "%" : " درهم"} على الطلبات فوق ${p.minOrder} درهم`
          : `خصم ${p.discount}${p.type === "percent" ? "%" : " درهم"} على طلبك`,
        discount: p.discount,
        discountType: p.type === "percent" ? "percentage" as const : "fixed" as const,
        minOrder: p.minOrder,
        expiresAt: p.expiryDate,
        bgColor: bgColors[index % bgColors.length],
      }));
  }, [adminPromoCodes]);

  // Filter categories
  const dealCategories: { id: DealCategory; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: t("deals.filterAll"), icon: <Tag className="w-4 h-4" /> },
    { id: "flash", label: t("deals.filterFlash"), icon: <Zap className="w-4 h-4" /> },
    { id: "bundle", label: t("deals.filterBundle"), icon: <Gift className="w-4 h-4" /> },
    { id: "seasonal", label: t("deals.filterSeasonal"), icon: <Sparkles className="w-4 h-4" /> },
    { id: "clearance", label: t("deals.filterClearance"), icon: <Percent className="w-4 h-4" /> },
  ];

  // Get products with discounts
  const dealsProducts = useMemo(() => {
    return products.filter((p) => p.discount && p.discount > 0);
  }, [products]);

  // Filter products based on category
  const filteredProducts = useMemo(() => {
    if (activeCategory === "all") return dealsProducts;
    if (activeCategory === "flash") return dealsProducts.filter((p) => (p.discount || 0) >= 20);
    if (activeCategory === "bundle") return dealsProducts.filter((p) => (p.discount || 0) >= 10 && (p.discount || 0) < 20);
    if (activeCategory === "seasonal") return dealsProducts.filter((p) => ["lamb", "beef"].includes(p.category.toLowerCase()));
    if (activeCategory === "clearance") return dealsProducts.filter((p) => (p.discount || 0) >= 30);
    return dealsProducts;
  }, [dealsProducts, activeCategory]);

  // Copy promo code to clipboard
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm mb-4">
            <Flame className="w-4 h-4" />
            <span>{t("deals.limited")}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("deals.title")}</h1>
          <p className="text-primary-foreground/80">{t("deals.subtitle")}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Promo Codes Section - Hidden from users */}
        {/* 
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {t("deals.promoCodes")}
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {promoCodes.map((promo) => (
              <div
                key={promo.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl bg-gradient-to-r p-4 text-white",
                  promo.bgColor
                )}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <h3 className="font-bold text-lg">
                    {isRTL ? promo.titleAr : promo.titleEn}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">
                    {isRTL ? promo.descriptionAr : promo.descriptionEn}
                  </p>
                  {promo.minOrder && (
                    <p className="text-white/60 text-xs mt-2">
                      {t("deals.minOrder")}: AED {promo.minOrder}
                    </p>
                  )}
                  {promo.expiresAt && (
                    <p className="text-white/60 text-xs mt-1">
                      {t("deals.expiresIn")} {getDaysUntilExpiry(promo.expiresAt)} {t("deals.days")}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="bg-white/20 rounded-lg px-3 py-2 font-mono font-bold text-sm">
                      {promo.code}
                    </div>
                    <button
                      onClick={() => handleCopyCode(promo.code)}
                      className="bg-white text-gray-900 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                      {copiedCode === promo.code ? t("deals.copied") : t("deals.copyCode")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        */}

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {dealCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === category.id
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {category.icon}
              {category.label}
            </button>
          ))}
        </div>

        {/* Deals Grid */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Percent className="w-5 h-5 text-primary" />
            {t("deals.todaysDeals")}
          </h2>
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} showDiscount />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t("deals.noDeals")}</p>
            </div>
          )}
        </section>

        {/* Weekly Specials */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              {t("deals.weeklySpecials")}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {dealsProducts.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
