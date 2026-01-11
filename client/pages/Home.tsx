import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ChevronRight, 
  ChevronLeft,
  Flame,
  Sparkles,
  Clock,
  Truck,
  Shield,
  Star,
  TrendingUp,
  Gift,
  Percent,
  ShoppingBag,
  Heart,
  ArrowRight
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProducts } from "@/context/ProductsContext";
import { useOrders } from "@/context/OrdersContext";
import { useAuth } from "@/context/AuthContext";
import { useBasket, BasketItem } from "@/context/BasketContext";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/ProductCard";

// Banner Carousel Component
interface Banner {
  id: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  image: string;
  bgColor: string;
  link: string;
  badge?: string;
}

const banners: Banner[] = [
  {
    id: "1",
    titleEn: "Fresh Premium Cuts",
    titleAr: "قطع طازجة ممتازة",
    subtitleEn: "Up to 30% off on Australian Wagyu",
    subtitleAr: "خصم يصل إلى 30% على واغيو الأسترالي",
    image: "/photos/hero-meat.jpg",
    bgColor: "from-red-600 to-red-800",
    link: "/products?category=premium",
    badge: "HOT DEAL",
  },
  {
    id: "2",
    titleEn: "Eid Special",
    titleAr: "عروض العيد",
    subtitleEn: "Premium lamb cuts for your celebrations",
    subtitleAr: "قطع لحم الضأن الممتازة لاحتفالاتكم",
    image: "/photos/eid-special.jpg",
    bgColor: "from-emerald-600 to-emerald-800",
    link: "/products?category=lamb",
    badge: "LIMITED",
  },
  {
    id: "3",
    titleEn: "Free Delivery",
    titleAr: "توصيل مجاني",
    subtitleEn: "On orders above AED 150",
    subtitleAr: "للطلبات فوق 150 درهم",
    image: "/photos/delivery.jpg",
    bgColor: "from-blue-600 to-blue-800",
    link: "/products",
  },
];

export default function HomePage() {
  const { language } = useLanguage();
  const { products } = useProducts();
  const { orders } = useOrders();
  const { user, isLoggedIn } = useAuth();
  const { addItem } = useBasket();
  const navigate = useNavigate();
  const isRTL = language === "ar";
  
  const [currentBanner, setCurrentBanner] = useState(0);

  // Handler for adding items to basket
  const handleAddToBasket = (item: BasketItem) => {
    addItem(item);
  };

  // Handler when login is required (for visitors)
  const handleLoginRequired = () => {
    navigate("/login");
  };

  // Check if user is a visitor (not logged in)
  const isVisitor = !isLoggedIn;

  // Auto-rotate banners
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Translations
  const t = {
    en: {
      greeting: "Hello",
      welcomeBack: "Welcome back",
      whatWouldYouLike: "What would you like today?",
      shopNow: "Shop Now",
      categories: "Categories",
      allProducts: "All Products",
      viewAll: "View All",
      todaysDeals: "Today's Deals",
      flashSale: "Flash Sale",
      endsIn: "Ends in",
      bestSellers: "Best Sellers",
      newArrivals: "New Arrivals",
      reorderFavorites: "Reorder Your Favorites",
      orderAgain: "Order Again",
      whyChooseUs: "Why Choose Us",
      freshGuarantee: "Fresh Guarantee",
      freshGuaranteeDesc: "100% fresh or money back",
      fastDelivery: "Fast Delivery",
      fastDeliveryDesc: "Same-day delivery available",
      premiumQuality: "Premium Quality",
      premiumQualityDesc: "Hand-selected by experts",
      securePayment: "Secure Payment",
      securePaymentDesc: "100% secure checkout",
      beef: "Beef",
      lamb: "Lamb",
      chicken: "Chicken",
      marinated: "Marinated",
      premium: "Premium",
      quickReorder: "Quick Reorder",
      fromYourLastOrder: "From your last order",
    },
    ar: {
      greeting: "مرحباً",
      welcomeBack: "أهلاً بعودتك",
      whatWouldYouLike: "ماذا تريد اليوم؟",
      shopNow: "تسوق الآن",
      categories: "الفئات",
      allProducts: "جميع المنتجات",
      viewAll: "عرض الكل",
      todaysDeals: "عروض اليوم",
      flashSale: "تخفيضات سريعة",
      endsIn: "تنتهي خلال",
      bestSellers: "الأكثر مبيعاً",
      newArrivals: "وصل حديثاً",
      reorderFavorites: "أعد طلب المفضلة",
      orderAgain: "اطلب مرة أخرى",
      whyChooseUs: "لماذا تختارنا",
      freshGuarantee: "ضمان الطزاجة",
      freshGuaranteeDesc: "طازج 100% أو استرداد المال",
      fastDelivery: "توصيل سريع",
      fastDeliveryDesc: "توصيل في نفس اليوم",
      premiumQuality: "جودة ممتازة",
      premiumQualityDesc: "مختارة بعناية من الخبراء",
      securePayment: "دفع آمن",
      securePaymentDesc: "دفع آمن 100%",
      beef: "لحم بقري",
      lamb: "لحم ضأن",
      chicken: "دجاج",
      marinated: "متبل",
      premium: "فاخر",
      quickReorder: "إعادة طلب سريع",
      fromYourLastOrder: "من طلبك الأخير",
    },
  };

  const tt = t[language];

  // Categories
  const categories = [
    { id: "beef", nameEn: "Beef", nameAr: "لحم بقري", icon: "🥩", color: "bg-red-100 text-red-600" },
    { id: "lamb", nameEn: "Lamb", nameAr: "لحم ضأن", icon: "🍖", color: "bg-orange-100 text-orange-600" },
    { id: "chicken", nameEn: "Chicken", nameAr: "دجاج", icon: "🍗", color: "bg-yellow-100 text-yellow-600" },
    { id: "marinated", nameEn: "Marinated", nameAr: "متبل", icon: "🌿", color: "bg-green-100 text-green-600" },
    { id: "premium", nameEn: "Premium", nameAr: "فاخر", icon: "⭐", color: "bg-purple-100 text-purple-600" },
  ];

  // Get featured products (with discount or high rating)
  const dealsProducts = products
    .filter((p) => p.discount && p.discount > 0)
    .slice(0, 6);

  const bestSellers = products
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 6);

  const newArrivals = products.slice(-6).reverse();

  // Get last order items for quick reorder
  const lastOrder = orders[0];
  const reorderItems = lastOrder?.items.slice(0, 4) || [];

  // Countdown timer for flash sale
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const endTime = new Date();
    endTime.setHours(23, 59, 59, 999);

    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = endTime.getTime() - now;

      if (diff > 0) {
        setCountdown({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % banners.length);
  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Hero Banner Carousel */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${isRTL ? currentBanner * 100 : -currentBanner * 100}%)` }}
        >
          {banners.map((banner) => (
            <div key={banner.id} className="w-full flex-shrink-0">
              <Link to={banner.link}>
                <div className={cn("relative bg-gradient-to-r h-48 md:h-64", banner.bgColor)}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative max-w-7xl mx-auto px-4 h-full flex items-center">
                    <div className="text-white max-w-md">
                      {banner.badge && (
                        <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold mb-2">
                          {banner.badge}
                        </span>
                      )}
                      <h2 className="text-2xl md:text-4xl font-bold mb-2">
                        {isRTL ? banner.titleAr : banner.titleEn}
                      </h2>
                      <p className="text-sm md:text-base opacity-90">
                        {isRTL ? banner.subtitleAr : banner.subtitleEn}
                      </p>
                      <span className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white text-gray-900 rounded-full font-medium text-sm hover:bg-gray-100 transition-colors">
                        {tt.shopNow}
                        <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Banner Navigation */}
        <button
          onClick={prevBanner}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hover:bg-white transition-colors",
            isRTL ? "right-4" : "left-4"
          )}
        >
          <ChevronLeft className={cn("w-5 h-5", isRTL && "rotate-180")} />
        </button>
        <button
          onClick={nextBanner}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hover:bg-white transition-colors",
            isRTL ? "left-4" : "right-4"
          )}
        >
          <ChevronRight className={cn("w-5 h-5", isRTL && "rotate-180")} />
        </button>

        {/* Banner Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentBanner ? "bg-white w-6" : "bg-white/50"
              )}
            />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Greeting */}
        {user && (
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4">
            <p className="text-muted-foreground text-sm">{tt.greeting}</p>
            <h2 className="text-xl font-bold text-foreground">{user.firstName} 👋</h2>
            <p className="text-muted-foreground text-sm mt-1">{tt.whatWouldYouLike}</p>
          </div>
        )}

        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">{tt.categories}</h2>
            <Link
              to="/products"
              className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
            >
              {tt.viewAll}
              <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </Link>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.id}`}
                className={cn(
                  "flex flex-col items-center p-4 rounded-2xl transition-all hover:scale-105",
                  category.color
                )}
              >
                <span className="text-3xl mb-2">{category.icon}</span>
                <span className="text-sm font-medium">
                  {isRTL ? category.nameAr : category.nameEn}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Flash Sale */}
        {dealsProducts.length > 0 && (
          <section className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6" />
                <h2 className="text-lg font-bold">{tt.flashSale}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{tt.endsIn}</span>
                <div className="flex gap-1 font-mono text-sm font-bold">
                  <span className="bg-white/20 px-2 py-1 rounded">
                    {countdown.hours.toString().padStart(2, "0")}
                  </span>
                  :
                  <span className="bg-white/20 px-2 py-1 rounded">
                    {countdown.minutes.toString().padStart(2, "0")}
                  </span>
                  :
                  <span className="bg-white/20 px-2 py-1 rounded">
                    {countdown.seconds.toString().padStart(2, "0")}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {dealsProducts.map((product) => (
                <ProductCard key={product.id} product={product} compact onAddToBasket={handleAddToBasket} isVisitor={isVisitor} onLoginRequired={handleLoginRequired} />
              ))}
            </div>
          </section>
        )}

        {/* Quick Reorder */}
        {reorderItems.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  {tt.quickReorder}
                </h2>
                <p className="text-sm text-muted-foreground">{tt.fromYourLastOrder}</p>
              </div>
              <Link
                to="/orders"
                className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
              >
                {tt.viewAll}
                <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {reorderItems.map((item) => {
                const product = products.find((p) => p.id === item.id);
                return product ? (
                  <ProductCard key={item.id} product={product} onAddToBasket={handleAddToBasket} isVisitor={isVisitor} onLoginRequired={handleLoginRequired} />
                ) : null;
              })}
            </div>
          </section>
        )}

        {/* Best Sellers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {tt.bestSellers}
            </h2>
            <Link
              to="/products?sort=popular"
              className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
            >
              {tt.viewAll}
              <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} onAddToBasket={handleAddToBasket} isVisitor={isVisitor} onLoginRequired={handleLoginRequired} />
            ))}
          </div>
        </section>

        {/* New Arrivals */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {tt.newArrivals}
            </h2>
            <Link
              to="/products?sort=newest"
              className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
            >
              {tt.viewAll}
              <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} onAddToBasket={handleAddToBasket} isVisitor={isVisitor} onLoginRequired={handleLoginRequired} />
            ))}
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="bg-muted/50 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-foreground text-center mb-6">{tt.whyChooseUs}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{tt.freshGuarantee}</h3>
              <p className="text-xs text-muted-foreground mt-1">{tt.freshGuaranteeDesc}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{tt.fastDelivery}</h3>
              <p className="text-xs text-muted-foreground mt-1">{tt.fastDeliveryDesc}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{tt.premiumQuality}</h3>
              <p className="text-xs text-muted-foreground mt-1">{tt.premiumQualityDesc}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{tt.securePayment}</h3>
              <p className="text-xs text-muted-foreground mt-1">{tt.securePaymentDesc}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
