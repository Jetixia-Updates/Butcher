import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useBasket } from "@/context/BasketContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { PriceDisplay } from "@/components/CurrencySymbol";

export default function BasketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, vat, total, removeItem, updateQuantity, saveBasket, clearBasket } =
    useBasket();
  const { t, language } = useLanguage();
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
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t("basket.empty")}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t("basket.emptyDesc")}
            </p>
            <button
              onClick={() => navigate("/products")}
              className="btn-primary inline-block"
            >
              {t("basket.continueShopping")}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">{t("basket.title")}</h1>
            <p className="text-muted-foreground">
              {t("basket.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Basket Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="card-premium p-4 flex gap-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-3xl">🥩</span>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {getItemName(item)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {getItemCategory(item)}
                      </p>
                      <p className="font-semibold text-primary mt-2">
                        <PriceDisplay price={item.price} size="md" />
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 border border-border rounded-md p-1">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, Math.max(0.250, parseFloat((item.quantity - 0.250).toFixed(3))))
                        }
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 13H5v-2h14v2z" />
                        </svg>
                      </button>
                      <span className="w-20 text-center font-semibold">
                        {item.quantity.toFixed(3)} {language === "ar" ? "جرام" : "gr"}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, parseFloat((item.quantity + 0.250).toFixed(3)))
                        }
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                      </button>
                    </div>

                    {/* Item Total & Remove */}
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        <PriceDisplay price={item.price * item.quantity} size="md" />
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-destructive hover:text-destructive/80 text-sm font-semibold mt-2 transition-colors"
                      >
                        {t("basket.remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Continue Shopping */}
              <button
                onClick={() => navigate("/products")}
                className="mt-6 btn-outline w-full py-3 rounded-lg font-semibold"
              >
                {t("basket.continueShopping")}
              </button>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="card-premium p-6 sticky top-24 space-y-4">
                <h2 className="text-xl font-bold text-foreground">
                  {t("basket.summary")}
                </h2>

                <div className="space-y-3 border-b border-border pb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("basket.subtotal")}</span>
                    <span className="font-semibold"><PriceDisplay price={subtotal} size="md" /></span>
                  </div>
                  <div className="flex justify-between items-center bg-secondary/10 -mx-6 px-6 py-2 rounded-lg">
                    <span className="text-muted-foreground">VAT (5%)</span>
                    <span className="font-semibold text-secondary">
                      <PriceDisplay price={vat} size="md" />
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <span className="text-lg font-bold text-foreground">{t("basket.total")}</span>
                  <span className="text-2xl font-bold text-primary">
                    <PriceDisplay price={total} size="lg" />
                  </span>
                </div>

                <button
                  onClick={() => navigate("/checkout")}
                  className="w-full btn-primary py-3 rounded-lg font-semibold text-base"
                >
                  {t("basket.checkout")}
                </button>

                {/* Save Basket */}
                <div className="pt-4 border-t border-border">
                  {!showSaveDialog ? (
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="w-full btn-outline py-2 rounded-lg text-sm font-semibold"
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
                        className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:border-primary outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveBasket}
                          className="flex-1 bg-secondary text-secondary-foreground text-sm font-semibold py-2 rounded-lg hover:bg-secondary/90 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowSaveDialog(false);
                            setSavedBasketName("");
                          }}
                          className="flex-1 bg-muted text-foreground text-sm font-semibold py-2 rounded-lg hover:bg-muted/80 transition-colors"
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
                  className="w-full text-destructive text-sm font-semibold py-2 hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  Clear Basket
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
