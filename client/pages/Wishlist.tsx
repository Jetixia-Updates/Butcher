import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Heart, ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import { useBasket } from "@/context/BasketContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { cn } from "@/lib/utils";

export default function WishlistPage() {
  const navigate = useNavigate();
  const { items, removeFromWishlist, clearWishlist, ensureLoaded } = useWishlist();
  const { addItem } = useBasket();
  const { isLoggedIn } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  // Load wishlist data when page mounts
  useEffect(() => {
    if (isLoggedIn) {
      ensureLoaded();
    }
  }, [isLoggedIn, ensureLoaded]);

  const translations = {
    en: {
      wishlist: "My Wishlist",
      subtitle: "Your saved items",
      empty: "Your wishlist is empty",
      emptyDesc: "Save products you love for later!",
      browseProducts: "Browse Products",
      moveToCart: "Move to Cart",
      remove: "Remove",
      clearAll: "Clear All",
      addedOn: "Added on",
      viewProduct: "View Product",
      continueShopping: "Continue Shopping",
      itemsCount: "items",
    },
    ar: {
      wishlist: "قائمة المفضلة",
      subtitle: "المنتجات المحفوظة",
      empty: "قائمة المفضلة فارغة",
      emptyDesc: "احفظ المنتجات التي تحبها لوقت لاحق!",
      browseProducts: "تصفح المنتجات",
      moveToCart: "نقل للسلة",
      remove: "حذف",
      clearAll: "مسح الكل",
      addedOn: "تمت الإضافة في",
      viewProduct: "عرض المنتج",
      continueShopping: "متابعة التسوق",
      itemsCount: "منتجات",
    },
  };

  const t = translations[language];

  const handleAddToCart = (item: typeof items[0]) => {
    addItem({
      id: item.productId,
      productId: item.productId,
      name: item.name,
      nameAr: item.nameAr,
      price: item.price,
      quantity: 0.5,
      image: item.image,
      category: item.category,
    });
    // Remove from wishlist after adding to cart
    removeFromWishlist(item.productId);
  };

  if (!isLoggedIn) {
    navigate("/login");
    return null;
  }

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Heart className="w-8 h-8 text-primary" />
              {t.wishlist}
            </h1>
            <p className="text-muted-foreground">
              {items.length > 0 ? `${items.length} ${t.itemsCount}` : t.subtitle}
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(language === "ar" ? "هل أنت متأكد من مسح جميع المنتجات؟" : "Are you sure you want to clear all items?")) {
                  clearWishlist();
                }
              }}
              className="btn-outline text-destructive border-destructive hover:bg-destructive hover:text-white flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t.clearAll}
            </button>
          )}
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">{t.empty}</h2>
            <p className="text-muted-foreground mb-6">{t.emptyDesc}</p>
            <button onClick={() => navigate("/products")} className="btn-primary">
              {t.browseProducts}
            </button>
          </div>
        ) : (
          <>
            {/* Wishlist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {items.map((item) => (
                <div key={item.id} className="card-premium overflow-hidden group">
                  {/* Image */}
                  <Link to={`/products/${item.productId}`} className="block relative">
                    <div className="aspect-square bg-muted overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={isRTL && item.nameAr ? item.nameAr : item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl">🥩</div>
                      )}
                    </div>
                    {/* Remove button overlay */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        removeFromWishlist(item.productId);
                      }}
                      className="absolute top-3 right-3 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                    >
                      <Heart className="w-5 h-5 fill-current" />
                    </button>
                  </Link>

                  {/* Content */}
                  <div className="p-4">
                    <Link to={`/products/${item.productId}`}>
                      <h3 className="font-semibold text-foreground mb-1 hover:text-primary transition-colors line-clamp-1">
                        {isRTL && item.nameAr ? item.nameAr : item.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t.addedOn} {new Date(item.addedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xl font-bold text-primary mb-4">
                      <PriceDisplay price={item.price} size="lg" />
                      <span className="text-sm text-muted-foreground font-normal"> / {isRTL ? "كجم" : "Kg"}</span>
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {t.moveToCart}
                      </button>
                      <button
                        onClick={() => removeFromWishlist(item.productId)}
                        className="p-2 border border-destructive text-destructive rounded-lg hover:bg-destructive hover:text-white transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Continue Shopping */}
            <div className="text-center mt-8">
              <button
                onClick={() => navigate("/products")}
                className="btn-outline flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className={cn("w-4 h-4", isRTL && "rotate-180")} />
                {t.continueShopping}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
