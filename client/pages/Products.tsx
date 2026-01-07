import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/context/AuthContext";
import { useBasket } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProducts } from "@/context/ProductsContext";

export default function ProductsPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { addItem } = useBasket();
  const { t } = useLanguage();
  const { products } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Define categories in the desired order
  const categoryOrder = ["All", "Beef", "Lamb", "Sheep", "Chicken"];
  const productCategories = new Set(products.map((p) => p.category));
  const categories = categoryOrder.filter(
    (cat) => cat === "All" || productCategories.has(cat)
  );

  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  // Determine if user is a visitor or not logged in at all
  const isVisitor = !!user && user.isVisitor;
  const isGuest = !user;

  const handleAddToBasket = (item: any) => {
    if (!isLoggedIn) {
      navigate("/");
      return;
    }
    addItem(item);
  };

  const handleLoginRequired = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showBasketIcon={true} />

      <main className="flex-1 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              {t("products.title")}
            </h1>
            <p className="text-muted-foreground">
              {isLoggedIn
                ? t("products.welcome", { name: user?.firstName || "" })
                : isVisitor
                ? `${t("products.guestMessage")} (${user?.firstName})`
                : t("products.guestMessage")}
            </p>
          </div>

          {/* Category Filter */}
          <div className="mb-8">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  {t(`category.${category.toLowerCase()}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToBasket={handleAddToBasket}
                isVisitor={!isLoggedIn || isVisitor}
                onLoginRequired={handleLoginRequired}
              />
            ))}
          </div>

          {/* No Products Message */}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                {t("products.noProducts")}
              </p>
            </div>
          )}

          {/* Visitor Mode Notice */}
          {!isLoggedIn && (
            <div className="mt-12 bg-secondary/10 border border-secondary rounded-lg p-6 text-center">
              <p className="text-foreground font-semibold mb-2">
                {t("products.loginPrompt")}
              </p>
              <p className="text-muted-foreground mb-4">
                {t("products.loginPromptDesc")}
              </p>
              <button
                onClick={() => navigate("/")}
                className="btn-primary inline-block"
              >
                {t("products.loginNow")}
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
