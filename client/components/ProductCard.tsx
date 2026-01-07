import React, { useState } from "react";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { BasketItem } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    nameAr?: string;
    price: number;
    category: string;
    description: string;
    descriptionAr?: string;
    image?: string;
    available: boolean;
  };
  onAddToBasket?: (item: BasketItem) => void;
  isVisitor?: boolean;
  onLoginRequired?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToBasket,
  isVisitor,
  onLoginRequired,
}) => {
  const { t, language } = useLanguage();
  const [quantity, setQuantity] = useState(0.500);
  const [isAdding, setIsAdding] = useState(false);

  // Format weight to 3 decimal places
  const formatWeight = (weight: number) => weight.toFixed(3);

  // Get localized product name and description
  const productName = language === "ar" && product.nameAr ? product.nameAr : product.name;
  const productDescription = language === "ar" && product.descriptionAr ? product.descriptionAr : product.description;
  
  // Unit labels - gr for weight button, Kg for price
  const weightUnit = language === "ar" ? "جرام" : "gr";
  const priceUnit = language === "ar" ? "كجم" : "Kg";

  const handleAddToBasket = () => {
    if (isVisitor) {
      if (onLoginRequired) onLoginRequired();
      return;
    }

    setIsAdding(true);
    if (onAddToBasket) {
      onAddToBasket({
        id: product.id,
        name: product.name,
        nameAr: product.nameAr,
        price: product.price,
        quantity,
        image: product.image,
        category: product.category,
      });
    }

    // Reset after animation
    setTimeout(() => {
      setIsAdding(false);
      setQuantity(0.500);
    }, 300);
  };

  return (
    <div className="card-premium overflow-hidden group h-full flex flex-col">
      {/* Product Image */}
      <div className="relative overflow-hidden bg-muted h-48 w-full flex items-center justify-center">
        {product.image ? (
          <img
            src={product.image}
            alt={productName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="text-6xl">🥩</div>
        )}
        {!product.available && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <p className="text-white font-semibold">{t("product.outOfStock")}</p>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Category */}
        <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
          {t(`category.${product.category.toLowerCase()}`)}
        </p>

        {/* Name */}
        <h3 className="text-lg font-bold text-foreground mt-1 line-clamp-2">
          {productName}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mt-2 flex-1 line-clamp-3">
          {productDescription}
        </p>

        {/* Price */}
        <div className="mt-4 mb-4">
          <p className="text-2xl font-bold text-primary">
            <PriceDisplay price={product.price} size="lg" />
            <span className="text-sm text-muted-foreground font-normal"> / {priceUnit}</span>
          </p>
        </div>

        {/* Quantity & Button */}
        {product.available && !isVisitor && (
          <div className="flex gap-2 items-center mt-auto">
            <div className="flex items-center border border-border rounded-md flex-1">
              <button
                onClick={() => setQuantity(Math.max(0.250, parseFloat((quantity - 0.250).toFixed(3))))}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 13H5v-2h14v2z" />
                </svg>
              </button>
              <div className="flex items-center justify-center flex-1 min-w-0">
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                  {formatWeight(quantity)} {weightUnit}
                </span>
              </div>
              <button
                onClick={() => setQuantity(parseFloat((quantity + 0.250).toFixed(3)))}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
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
            <button
              onClick={handleAddToBasket}
              disabled={isAdding}
              className="btn-primary p-2.5 disabled:opacity-50 transition-all flex items-center justify-center rounded-md"
            >
              {isAdding ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10-8l2 8m-6 8a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Visitor/Login Required */}
        {isVisitor || !product.available ? (
          <button
            onClick={onLoginRequired}
            className="btn-outline w-full mt-auto"
            disabled={!product.available}
          >
            {isVisitor ? t("product.login") : t("product.outOfStock")}
          </button>
        ) : null}
      </div>
    </div>
  );
};
