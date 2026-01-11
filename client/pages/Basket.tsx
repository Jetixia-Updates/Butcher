import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { useBasket } from "@/context/BasketContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { PriceDisplay } from "@/components/CurrencySymbol";

export default function BasketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, vat, total, removeItem, updateQuantity, saveBasket, clearBasket } =
    useBasket();
  const { addToWishlist, isInWishlist } = useWishlist();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const [savedBasketName, setSavedBasketName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Helper function to get localized item name
  const getItemName = (item: typeof items[0]) => {
    return language === "ar" && item.nameAr ? item.nameAr : item.name;
  };

  // Helper function to get localized category
  const getItemCategory = (item: typeof items[0]) => {
    return item.category ? t(`category.${item.category.toLowerCase()}`) : "";
  };

  // Handle save for later - move item to wishlist
  const handleSaveForLater = (item: typeof items[0]) => {
    // Add to wishlist
    addToWishlist({
      productId: item.productId,
      name: item.name,
      nameAr: item.nameAr,
      price: item.price,
      image: item.image,
      category: item.category || "",
    });
    // Remove from basket
    removeItem(item.id);
  };

  const handleSaveBasket = () => {
    if (savedBasketName.trim()) {
      saveBasket(savedBasketName);
      setSavedBasketName("");
      setShowSaveDialog(false);
      alert("Basket saved successfully!");
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full text-center">
          <div className="text-5xl sm:text-6xl mb-4">🛒</div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            {t("basket.empty")}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            {t("basket.emptyDesc")}
          </p>
          <button
            onClick={() => navigate("/products")}
            className="btn-primary inline-block text-sm sm:text-base"
          >
            {t("basket.continueShopping")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-4 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground">{t("basket.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t("basket.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Basket Items */}
            <div className="lg:col-span-2">
              <div className="space-y-3 sm:space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="card-premium p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* Top Row: Image + Details */}
                    <div className="flex gap-3 sm:gap-4">
                      {/* Product Image */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-2xl sm:text-3xl">🥩</span>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base line-clamp-1">
                          {getItemName(item)}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {getItemCategory(item)}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-primary mt-1 flex items-center gap-1 line-clamp-1">
                            <span>🔪</span>
                            {item.notes}
                          </p>
                        )}
                        <p className="font-semibold text-primary mt-1 sm:mt-2 text-sm sm:text-base">
                          <PriceDisplay price={item.price} size="md" />
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: Quantity + Total - stacks on mobile */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 mt-2 sm:mt-0">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 sm:gap-2 border border-border rounded-md p-1">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, Math.max(0.250, parseFloat((item.quantity - 0.250).toFixed(3))))
                          }
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M19 13H5v-2h14v2z" />
                          </svg>
                        </button>
                        <span className="w-16 sm:w-20 text-center font-semibold text-xs sm:text-sm">
                          {item.quantity.toFixed(3)} {language === "ar" ? "جرام" : "gr"}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, parseFloat((item.quantity + 0.250).toFixed(3)))
                          }
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                          </svg>
                        </button>
                      </div>

                      {/* Item Total & Actions */}
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="font-bold text-foreground text-sm sm:text-base">
                          <PriceDisplay price={item.price * item.quantity} size="md" />
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveForLater(item)}
                            className={`text-primary hover:text-primary/80 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1 ${isInWishlist(item.productId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isInWishlist(item.productId)}
                            title={isInWishlist(item.productId) ? (language === 'ar' ? 'موجود في المفضلة' : 'Already in wishlist') : (language === 'ar' ? 'حفظ لوقت لاحق' : 'Save for later')}
                          >
                            <Heart className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">{language === 'ar' ? 'حفظ' : 'Save'}</span>
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-destructive hover:text-destructive/80 text-xs sm:text-sm font-semibold transition-colors"
                          >
                            {t("basket.remove")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Continue Shopping */}
              <button
                onClick={() => navigate("/products")}
                className="mt-4 sm:mt-6 btn-outline w-full py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base"
              >
                {t("basket.continueShopping")}
              </button>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="card-premium p-4 sm:p-6 sticky top-24 space-y-3 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {t("basket.summary")}
                </h2>

                <div className="space-y-2 sm:space-y-3 border-b border-border pb-3 sm:pb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm sm:text-base text-muted-foreground">{t("basket.subtotal")}</span>
                    <span className="font-semibold text-sm sm:text-base"><PriceDisplay price={subtotal} size="md" /></span>
                  </div>
                  <div className="flex justify-between items-center bg-secondary/10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 rounded-lg">
                    <span className="text-sm sm:text-base text-muted-foreground">VAT (5%)</span>
                    <span className="font-semibold text-secondary text-sm sm:text-base">
                      <PriceDisplay price={vat} size="md" />
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 sm:pt-4">
                  <span className="text-base sm:text-lg font-bold text-foreground">{t("basket.total")}</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">
                    <PriceDisplay price={total} size="lg" />
                  </span>
                </div>

                <button
                  onClick={() => navigate("/checkout")}
                  className="w-full btn-primary py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base"
                >
                  {t("basket.checkout")}
                </button>

                {/* Save Basket */}
                <div className="pt-3 sm:pt-4 border-t border-border">
                  {!showSaveDialog ? (
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="w-full btn-outline py-2 rounded-lg text-xs sm:text-sm font-semibold"
                    >
                      Save for Later
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={savedBasketName}
                        onChange={(e) => setSavedBasketName(e.target.value)}
                        placeholder="e.g., Weekend BBQ"
                        className="w-full px-3 py-2 border border-input rounded-lg text-xs sm:text-sm focus:border-primary outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveBasket}
                          className="flex-1 bg-secondary text-secondary-foreground text-xs sm:text-sm font-semibold py-2 rounded-lg hover:bg-secondary/90 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowSaveDialog(false);
                            setSavedBasketName("");
                          }}
                          className="flex-1 bg-muted text-foreground text-xs sm:text-sm font-semibold py-2 rounded-lg hover:bg-muted/80 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear Basket */}
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to clear your basket?")) {
                      clearBasket();
                    }
                  }}
                  className="w-full text-destructive text-xs sm:text-sm font-semibold py-2 hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  Clear Basket
                </button>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
