import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Percent,
  Clock,
  Flame,
  Gift,
  Tag,
  ChevronRight,
  Star,
  Filter,
  Sparkles,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProducts } from "@/context/ProductsContext";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";

interface PromoCode {
  id: string;
  code: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  discount: number;
  discountType: "percentage" | "fixed";
  minOrder?: number;
  expiresAt?: string;
  bgColor: string;
}

const promoCodes: PromoCode[] = [
  {
    id: "1",
    code: "FRESH20",
    titleEn: "New Customer Offer",
    titleAr: "عرض العملاء الجدد",
    descriptionEn: "20% off your first order",
    descriptionAr: "خصم 20% على طلبك الأول",
    discount: 20,
    discountType: "percentage",
    bgColor: "from-purple-500 to-indigo-600",
  },
  {
    id: "2",
    code: "MEAT50",
    titleEn: "Weekend Special",
    titleAr: "عرض نهاية الأسبوع",
    descriptionEn: "AED 50 off on orders above AED 300",
    descriptionAr: "خصم 50 درهم على الطلبات فوق 300 درهم",
    discount: 50,
    discountType: "fixed",
    minOrder: 300,
    bgColor: "from-red-500 to-pink-600",
  },
  {
    id: "3",
    code: "EIDJOY",
    titleEn: "Eid Celebration",
    titleAr: "احتفال العيد",
    descriptionEn: "15% off on all lamb products",
    descriptionAr: "خصم 15% على جميع منتجات الضأن",
    discount: 15,
    discountType: "percentage",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    bgColor: "from-emerald-500 to-teal-600",
  },
];

type DealCategory = "all" | "flash" | "bundle" | "seasonal" | "clearance";

export default function DealsPage() {
  const { language } = useLanguage();
  const { products } = useProducts();
  const isRTL = language === "ar";

  const [activeCategory, setActiveCategory] = useState<DealCategory>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Translations
  const t = {
    en: {
      pageTitle: "Deals & Offers",
      pageSubtitle: "Fresh savings on premium cuts",
      promoCodes: "Promo Codes",
      copyCode: "Copy Code",
      copied: "Copied!",
      minOrder: "Min. order",
      expiresIn: "Expires in",
      days: "days",
      filterAll: "All Deals",
      filterFlash: "Flash Sale",
      filterBundle: "Bundles",
      filterSeasonal: "Seasonal",
      filterClearance: "Clearance",
      todaysDeals: "Today's Deals",
      off: "OFF",
      save: "Save",
      upTo: "Up to",
      viewProduct: "View",
      noDeals: "No deals available in this category",
      bundleDeals: "Bundle Deals",
      bundleDescription: "Save more when you buy together",
      weeklySpecials: "Weekly Specials",
      limitedTime: "Limited Time",
    },
    ar: {
      pageTitle: "العروض والخصومات",
      pageSubtitle: "توفيرات طازجة على القطع الممتازة",
      promoCodes: "أكواد الخصم",
      copyCode: "نسخ الكود",
      copied: "تم النسخ!",
      minOrder: "الحد الأدنى للطلب",
      expiresIn: "ينتهي خلال",
      days: "أيام",
      filterAll: "كل العروض",
      filterFlash: "تخفيضات سريعة",
      filterBundle: "حزم",
      filterSeasonal: "موسمية",
      filterClearance: "تصفية",
      todaysDeals: "عروض اليوم",
      off: "خصم",
      save: "وفر",
      upTo: "حتى",
      viewProduct: "عرض",
      noDeals: "لا توجد عروض في هذه الفئة",
      bundleDeals: "عروض الحزم",
      bundleDescription: "وفر أكثر عند الشراء معاً",
      weeklySpecials: "عروض الأسبوع",
      limitedTime: "لوقت محدود",
    },
  };

  const tt = t[language];

  // Filter categories
  const dealCategories: { id: DealCategory; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: tt.filterAll, icon: <Tag className="w-4 h-4" /> },
    { id: "flash", label: tt.filterFlash, icon: <Zap className="w-4 h-4" /> },
    { id: "bundle", label: tt.filterBundle, icon: <Gift className="w-4 h-4" /> },
    { id: "seasonal", label: tt.filterSeasonal, icon: <Sparkles className="w-4 h-4" /> },
    { id: "clearance", label: tt.filterClearance, icon: <Percent className="w-4 h-4" /> },
  ];

  // Get products with discounts
  const dealsProducts = useMemo(() => {
    return products.filter((p) => p.discount && p.discount > 0);
  }, [products]);

  // Filter products based on category (demo - in production would have actual categories)
  const filteredProducts = useMemo(() => {
    if (activeCategory === "all") return dealsProducts;
    if (activeCategory === "flash") return dealsProducts.filter((p) => (p.discount || 0) >= 20);
    if (activeCategory === "bundle") return dealsProducts.slice(0, 4);
    if (activeCategory === "seasonal") return dealsProducts.filter((p) => p.category === "lamb");
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
            <span>{tt.limitedTime}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{tt.pageTitle}</h1>
          <p className="text-primary-foreground/80">{tt.pageSubtitle}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Promo Codes Section */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {tt.promoCodes}
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
                      {tt.minOrder}: AED {promo.minOrder}
                    </p>
                  )}
                  {promo.expiresAt && (
                    <p className="text-white/60 text-xs mt-1">
                      {tt.expiresIn} {getDaysUntilExpiry(promo.expiresAt)} {tt.days}
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
                      {copiedCode === promo.code ? tt.copied : tt.copyCode}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

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
            {tt.todaysDeals}
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
              <p className="text-muted-foreground">{tt.noDeals}</p>
            </div>
          )}
        </section>

        {/* Bundle Deals Section */}
        <section className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Gift className="w-5 h-5 text-orange-500" />
                {tt.bundleDeals}
              </h2>
              <p className="text-sm text-muted-foreground">{tt.bundleDescription}</p>
            </div>
            <Link
              to="/products?filter=bundle"
              className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
            >
              {language === "en" ? "View All" : "عرض الكل"}
              <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Bundle Card 1 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-border">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center text-4xl">
                  🥩
                </div>
                <div className="flex-1">
                  <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full mb-2">
                    {tt.save} 25%
                  </span>
                  <h3 className="font-semibold text-foreground">
                    {isRTL ? "حزمة الشواء العائلية" : "Family BBQ Bundle"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isRTL
                      ? "ستيك ريب آي + كباب لحم + صدور دجاج"
                      : "Ribeye Steak + Lamb Kebab + Chicken Breast"}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-lg font-bold text-primary">AED 199</span>
                    <span className="text-sm text-muted-foreground line-through">AED 265</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bundle Card 2 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-border">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center text-4xl">
                  🍖
                </div>
                <div className="flex-1">
                  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-600 text-xs font-medium rounded-full mb-2">
                    {tt.save} 30%
                  </span>
                  <h3 className="font-semibold text-foreground">
                    {isRTL ? "حزمة العيد الخاصة" : "Eid Special Pack"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isRTL
                      ? "فخذ لحم ضأن + لحم مفروم + كستليته"
                      : "Lamb Leg + Minced Lamb + Lamb Chops"}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-lg font-bold text-primary">AED 349</span>
                    <span className="text-sm text-muted-foreground line-through">AED 499</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Weekly Specials */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              {tt.weeklySpecials}
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
