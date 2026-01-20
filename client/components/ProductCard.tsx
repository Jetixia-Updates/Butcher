import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { BasketItem } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";
import { X, Plus, Minus, ShoppingCart, Check, Star, Eye, ExternalLink } from "lucide-react";

// Product options types
interface ProductOptions {
  boneType: string[];
  cutType: string[];
}

const BONE_OPTIONS = [
  { id: "bone", label: "Bone", labelAr: "بالعظم" },
  { id: "boneless", label: "Boneless", labelAr: "بدون عظم" },
];

const CUT_OPTIONS = [
  { id: "curry-cut", label: "Curry Cut", labelAr: "قطع كاري" },
  { id: "cubes", label: "Cubes", labelAr: "مكعبات" },
  { id: "whole", label: "Whole", labelAr: "كامل" },
];

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
    discount?: number;
    rating?: number;
    badges?: ("halal" | "organic" | "grass-fed" | "premium" | "fresh" | "local")[];
  };
  onAddToBasket?: (item: BasketItem) => void;
  isVisitor?: boolean;
  onLoginRequired?: () => void;
  compact?: boolean;
  showDiscount?: boolean;
}

// Badge configuration
const BADGE_CONFIG: Record<string, { icon: string; label: string; labelAr: string; color: string }> = {
  halal: { icon: "☪️", label: "Halal", labelAr: "حلال", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  organic: { icon: "🌿", label: "Organic", labelAr: "عضوي", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  "grass-fed": { icon: "🌾", label: "Grass-Fed", labelAr: "تغذية طبيعية", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400" },
  premium: { icon: "⭐", label: "Premium", labelAr: "ممتاز", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  fresh: { icon: "❄️", label: "Fresh", labelAr: "طازج", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  local: { icon: "📍", label: "Local", labelAr: "محلي", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToBasket,
  isVisitor,
  onLoginRequired,
  compact = false,
  showDiscount = false,
}) => {
  const { t, language } = useLanguage();
  const [quantity, setQuantity] = useState(0.250);
  const [isAdding, setIsAdding] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [quickViewQuantity, setQuickViewQuantity] = useState(0.250);
  const [quickViewOptions, setQuickViewOptions] = useState<ProductOptions>({
    boneType: [],
    cutType: [],
  });
  const [selectedOptions, setSelectedOptions] = useState<ProductOptions>({
    boneType: [],
    cutType: [],
  });

  // Format weight to 3 decimal places (for internal use)
  const formatWeight = (weight: number) => weight.toFixed(3);

  // Smart weight display - converts to Kg when >= 1 Kg
  const formatWeightDisplay = (weight: number) => {
    if (weight >= 1) {
      // Convert to Kg
      const kgValue = weight.toFixed(3);
      const kgUnit = language === "ar" ? "كجم" : "Kg";
      return `${kgValue} ${kgUnit}`;
    } else {
      // Display as grams (multiply by 1000 for display)
      const gramsValue = Math.round(weight * 1000);
      const grUnit = language === "ar" ? "جرام" : "gr";
      return `${gramsValue} ${grUnit}`;
    }
  };

  // Get localized product name and description
  const productName = language === "ar" && product.nameAr ? product.nameAr : product.name;
  const productDescription = language === "ar" && product.descriptionAr ? product.descriptionAr : product.description;
  
  // Unit labels - gr for weight button, Kg for price
  const weightUnit = language === "ar" ? "جرام" : "gr";
  const priceUnit = language === "ar" ? "كجم" : "Kg";

  const handleAddToCartClick = () => {
    // Allow visitors to add to cart - they'll be prompted at checkout
    // Show options modal
    setShowOptionsModal(true);
  };

  const handleOptionToggle = (type: "boneType" | "cutType", optionId: string) => {
    setSelectedOptions(prev => {
      const current = prev[type];
      if (current.includes(optionId)) {
        return { ...prev, [type]: current.filter(id => id !== optionId) };
      } else {
        return { ...prev, [type]: [...current, optionId] };
      }
    });
  };

  const handleConfirmAddToBasket = () => {
    setIsAdding(true);
    
    // Build notes from selected options
    const boneLabels = selectedOptions.boneType.map(id => {
      const opt = BONE_OPTIONS.find(o => o.id === id);
      return language === "ar" ? opt?.labelAr : opt?.label;
    }).filter(Boolean);
    
    const cutLabels = selectedOptions.cutType.map(id => {
      const opt = CUT_OPTIONS.find(o => o.id === id);
      return language === "ar" ? opt?.labelAr : opt?.label;
    }).filter(Boolean);
    
    const notes = [
      boneLabels.length > 0 ? boneLabels.join(", ") : null,
      cutLabels.length > 0 ? cutLabels.join(", ") : null,
    ].filter(Boolean).join(" | ");

    if (onAddToBasket) {
      // Calculate discounted price for basket
      const effectivePrice = product.discount ? product.price * (1 - product.discount / 100) : product.price;
      onAddToBasket({
        id: product.id,
        productId: product.id, // Original product ID for API calls
        name: product.name,
        nameAr: product.nameAr,
        price: Math.round(effectivePrice * 100) / 100, // Use discounted price
        quantity,
        image: product.image,
        category: product.category,
        notes: notes || undefined,
      });
    }

    // Reset after animation
    setTimeout(() => {
      setIsAdding(false);
      setQuantity(0.250);
      setSelectedOptions({ boneType: [], cutType: [] });
      setShowOptionsModal(false);
    }, 300);
  };

  const handleCloseModal = () => {
    setShowOptionsModal(false);
    setSelectedOptions({ boneType: [], cutType: [] });
  };

  // Quick view handlers
  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowQuickView(true);
    setQuickViewQuantity(0.250);
    setQuickViewOptions({ boneType: [], cutType: [] });
  };

  const handleQuickViewOptionToggle = (type: "boneType" | "cutType", optionId: string) => {
    setQuickViewOptions(prev => {
      const current = prev[type];
      if (current.includes(optionId)) {
        return { ...prev, [type]: current.filter(id => id !== optionId) };
      } else {
        return { ...prev, [type]: [...current, optionId] };
      }
    });
  };

  const handleQuickViewAddToBasket = () => {
    setIsAdding(true);
    
    // Build notes from selected options
    const boneLabels = quickViewOptions.boneType.map(id => {
      const opt = BONE_OPTIONS.find(o => o.id === id);
      return language === "ar" ? opt?.labelAr : opt?.label;
    }).filter(Boolean);
    
    const cutLabels = quickViewOptions.cutType.map(id => {
      const opt = CUT_OPTIONS.find(o => o.id === id);
      return language === "ar" ? opt?.labelAr : opt?.label;
    }).filter(Boolean);
    
    const notes = [
      boneLabels.length > 0 ? boneLabels.join(", ") : null,
      cutLabels.length > 0 ? cutLabels.join(", ") : null,
    ].filter(Boolean).join(" | ");

    if (onAddToBasket) {
      // Calculate discounted price for basket
      const effectivePrice = product.discount ? product.price * (1 - product.discount / 100) : product.price;
      onAddToBasket({
        id: product.id,
        productId: product.id,
        name: product.name,
        nameAr: product.nameAr,
        price: Math.round(effectivePrice * 100) / 100, // Use discounted price
        quantity: quickViewQuantity,
        image: product.image,
        category: product.category,
        notes: notes || undefined,
      });
    }

    // Reset after animation
    setTimeout(() => {
      setIsAdding(false);
      setShowQuickView(false);
      setQuickViewQuantity(0.250);
      setQuickViewOptions({ boneType: [], cutType: [] });
    }, 800);
  };

  const handleCloseQuickView = () => {
    setShowQuickView(false);
    setQuickViewQuantity(0.250);
    setQuickViewOptions({ boneType: [], cutType: [] });
  };

  // Calculate discounted price
  const discountedPrice = product.discount ? product.price * (1 - product.discount / 100) : product.price;

  return (
    <>
      <div className="card-premium overflow-hidden group h-full flex flex-col">
        {/* Product Image - Clickable for Quick View */}
        <div 
          className={`relative overflow-hidden bg-muted ${compact ? "h-24 sm:h-32" : "h-32 sm:h-48"} w-full flex items-center justify-center cursor-pointer`}
          onClick={handleImageClick}
        >
          {product.image ? (
            <img
              src={product.image}
              alt={productName}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className={`${compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"}`}>🥩</div>
          )}
          
          {/* Quick View Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/90 dark:bg-gray-800/90 rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Eye className="w-5 h-5 text-primary" />
            </div>
          </div>
          
          {/* Discount Badge */}
          {product.discount !== undefined && product.discount > 0 && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
              -{product.discount}%
            </div>
          )}
          
          {/* Dietary Badges */}
          {product.badges && product.badges.length > 0 && (
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              {product.badges.slice(0, 2).map((badge) => {
                const config = BADGE_CONFIG[badge];
                if (!config) return null;
                return (
                  <span
                    key={badge}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${config.color}`}
                  >
                    <span>{config.icon}</span>
                    <span className="hidden sm:inline">{language === "ar" ? config.labelAr : config.label}</span>
                  </span>
                );
              })}
            </div>
          )}
          
          {!product.available && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <p className="text-white font-semibold text-sm sm:text-base">{t("product.outOfStock")}</p>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-2 sm:p-4 flex-1 flex flex-col">
          {/* Category */}
          <p className="text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wide">
            {t(`category.${product.category.toLowerCase()}`)}
          </p>

          {/* Name */}
          <h3 className="text-sm sm:text-lg font-bold text-foreground mt-1 line-clamp-2">
            {productName}
          </h3>

          {/* Description - hidden on mobile */}
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2 flex-1 line-clamp-2 sm:line-clamp-3 hidden xs:block">
            {productDescription}
          </p>

          {/* Price */}
          <div className={`${compact ? "mt-1 mb-1" : "mt-2 sm:mt-4 mb-2 sm:mb-4"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`${compact ? "text-sm sm:text-lg" : "text-lg sm:text-2xl"} font-bold text-primary`}>
                <PriceDisplay price={product.discount ? product.price * (1 - product.discount / 100) : product.price} size={compact ? "md" : "lg"} />
                <span className="text-[10px] sm:text-sm text-muted-foreground font-normal"> / {priceUnit}</span>
              </p>
              {product.discount !== undefined && product.discount > 0 && (
                <span className="text-xs text-muted-foreground line-through">
                  <PriceDisplay price={product.price} size="sm" />
                </span>
              )}
            </div>
            {/* Rating */}
            {product.rating !== undefined && product.rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-yellow-500 text-sm">★</span>
                <span className="text-xs text-muted-foreground">{product.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Quantity & Button - Now available for all users including visitors */}
          {product.available && (
            <div className="flex gap-1 sm:gap-2 items-center mt-auto">
              <div className="flex items-center border border-border rounded-md flex-1">
                <button
                  onClick={() => setQuantity(Math.max(0.250, parseFloat((quantity - 0.250).toFixed(3))))}
                  className="p-1 sm:p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 13H5v-2h14v2z" />
                  </svg>
                </button>
                <div className="flex items-center justify-center flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">
                    {formatWeightDisplay(quantity)}
                  </span>
                </div>
                <button
                  onClick={() => setQuantity(parseFloat((quantity + 0.250).toFixed(3)))}
                  className="p-1 sm:p-2 text-muted-foreground hover:text-foreground transition-colors"
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
              <button
                onClick={handleAddToCartClick}
                disabled={isAdding}
                className="btn-primary p-1.5 sm:p-2.5 disabled:opacity-50 transition-all flex items-center justify-center rounded-md"
              >
                {isAdding ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10-8l2 8m-6 8a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Out of Stock Message */}
          {!product.available && (
            <button
              className="btn-outline w-full mt-auto text-sm sm:text-base py-1.5 sm:py-2"
              disabled
            >
              {t("product.outOfStock")}
            </button>
          )}
        </div>
      </div>

      {/* Product Options Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-border bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={productName} 
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">🥩</div>
                  )}
                  <div>
                    <h3 className="font-bold text-foreground">{productName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatWeightDisplay(quantity)} • <PriceDisplay price={product.price * quantity} size="sm" />
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Options Content */}
            <div className="p-4 space-y-6">
              {/* Product Details - Bone Type */}
              <div>
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-lg">🦴</span>
                  {language === "ar" ? "تفاصيل المنتج" : "Product Details"}
                </h4>
                <div className="space-y-2">
                  {BONE_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedOptions.boneType.includes(option.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOptions.boneType.includes(option.id)}
                        onChange={() => handleOptionToggle("boneType", option.id)}
                        className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="font-medium text-foreground">
                        {language === "ar" ? option.labelAr : option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cut Type */}
              <div>
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-lg">🔪</span>
                  {language === "ar" ? "نوع القطع" : "Cut Type"}
                </h4>
                <div className="space-y-2">
                  {CUT_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedOptions.cutType.includes(option.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOptions.cutType.includes(option.id)}
                        onChange={() => handleOptionToggle("cutType", option.id)}
                        className="w-5 h-5 text-primary border-border rounded focus:ring-primary"
                      />
                      <span className="font-medium text-foreground">
                        {language === "ar" ? option.labelAr : option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Selected Summary */}
              {(selectedOptions.boneType.length > 0 || selectedOptions.cutType.length > 0) && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {language === "ar" ? "الخيارات المحددة:" : "Selected:"}
                    </span>{" "}
                    {[
                      ...selectedOptions.boneType.map(id => {
                        const opt = BONE_OPTIONS.find(o => o.id === id);
                        return language === "ar" ? opt?.labelAr : opt?.label;
                      }),
                      ...selectedOptions.cutType.map(id => {
                        const opt = CUT_OPTIONS.find(o => o.id === id);
                        return language === "ar" ? opt?.labelAr : opt?.label;
                      }),
                    ].join(", ")}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/30 flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleConfirmAddToBasket}
                disabled={isAdding}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAdding ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {language === "ar" ? "تمت الإضافة!" : "Added!"}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10-8l2 8m-6 8a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                    {language === "ar" ? "أضف للسلة" : "Add to Cart"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {showQuickView && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleCloseQuickView}
        >
          <div 
            className="bg-background rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseQuickView}
              className="absolute top-4 right-4 z-10 p-2 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-full transition-colors shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col md:flex-row max-h-[90vh]">
              {/* Product Image */}
              <div className="relative w-full md:w-1/2 h-64 md:h-auto bg-muted flex-shrink-0">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl">🥩</div>
                )}
                
                {/* Discount Badge */}
                {product.discount !== undefined && product.discount > 0 && (
                  <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-full">
                    -{product.discount}% {language === "ar" ? "خصم" : "OFF"}
                  </div>
                )}

                {/* Badges */}
                {product.badges && product.badges.length > 0 && (
                  <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                    {product.badges.map((badge) => {
                      const config = BADGE_CONFIG[badge];
                      if (!config) return null;
                      return (
                        <span
                          key={badge}
                          className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${config.color}`}
                        >
                          <span>{config.icon}</span>
                          <span>{language === "ar" ? config.labelAr : config.label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 p-6 overflow-y-auto">
                {/* Category */}
                <p className="text-xs font-semibold text-secondary dark:text-secondary uppercase tracking-wide">
                  {t(`category.${product.category.toLowerCase()}`)}
                </p>

                {/* Name */}
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {productName}
                </h2>

                {/* Rating */}
                {product.rating !== undefined && product.rating > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < Math.round(product.rating!) ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">({product.rating.toFixed(1)})</span>
                  </div>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-3 mt-4">
                  <span className="text-3xl font-bold text-primary">
                    <PriceDisplay price={discountedPrice} size="lg" />
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">/ {priceUnit}</span>
                  {product.discount !== undefined && product.discount > 0 && (
                    <span className="text-lg text-gray-500 dark:text-gray-500 line-through">
                      <PriceDisplay price={product.price} size="md" />
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-700 dark:text-gray-300 mt-4 leading-relaxed">
                  {productDescription}
                </p>

                {/* Stock Status */}
                <div className="flex items-center gap-2 mt-4">
                  <div className={`w-3 h-3 rounded-full ${product.available ? "bg-green-500" : "bg-red-500"}`} />
                  <span className={`font-medium ${product.available ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {product.available ? (language === "ar" ? "متوفر" : "In Stock") : (language === "ar" ? "غير متوفر" : "Out of Stock")}
                  </span>
                </div>

                {/* Options Section */}
                {product.available && (
                  <div className="mt-6 space-y-4 border-t border-border pt-6">
                    {/* Bone Options */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <span>🦴</span>
                        {language === "ar" ? "تفاصيل المنتج" : "Product Details"}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {BONE_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => handleQuickViewOptionToggle("boneType", option.id)}
                            className={`px-4 py-2 rounded-lg border-2 font-medium transition-all text-sm ${
                              quickViewOptions.boneType.includes(option.id)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-gray-700 dark:text-gray-300 hover:border-primary/50"
                            }`}
                          >
                            {language === "ar" ? option.labelAr : option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cut Options */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <span>🔪</span>
                        {language === "ar" ? "نوع القطع" : "Cut Type"}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {CUT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => handleQuickViewOptionToggle("cutType", option.id)}
                            className={`px-4 py-2 rounded-lg border-2 font-medium transition-all text-sm ${
                              quickViewOptions.cutType.includes(option.id)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-gray-700 dark:text-gray-300 hover:border-primary/50"
                            }`}
                          >
                            {language === "ar" ? option.labelAr : option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quantity */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {language === "ar" ? "الكمية" : "Quantity"}
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center border border-border rounded-lg">
                          <button
                            onClick={() => setQuickViewQuantity(Math.max(0.25, parseFloat((quickViewQuantity - 0.25).toFixed(3))))}
                            className="p-3 hover:bg-muted transition-colors text-gray-700 dark:text-gray-300"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-24 text-center font-semibold text-gray-900 dark:text-white">
                            {formatWeightDisplay(quickViewQuantity)}
                          </span>
                          <button
                            onClick={() => setQuickViewQuantity(parseFloat((quickViewQuantity + 0.25).toFixed(3)))}
                            className="p-3 hover:bg-muted transition-colors text-gray-700 dark:text-gray-300"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-gray-600 dark:text-gray-400">
                          = <PriceDisplay price={discountedPrice * quickViewQuantity} size="md" className="font-bold text-gray-900 dark:text-white" />
                        </span>
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <button
                      onClick={handleQuickViewAddToBasket}
                      disabled={isAdding}
                      className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-3 mt-4"
                    >
                      {isAdding ? (
                        <>
                          <Check className="w-6 h-6" />
                          {language === "ar" ? "تمت الإضافة!" : "Added to Cart!"}
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-6 h-6" />
                          {language === "ar" ? "أضف للسلة" : "Add to Cart"}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Out of Stock */}
                {!product.available && (
                  <button
                    className="w-full btn-outline py-4 text-lg font-semibold mt-6"
                    disabled
                  >
                    {language === "ar" ? "غير متوفر" : "Out of Stock"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductCard;