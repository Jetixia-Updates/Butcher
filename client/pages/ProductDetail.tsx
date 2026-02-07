import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Star, 
  ShoppingCart, 
  Plus, 
  Minus,
  ChevronRight,
  Check,
  ThumbsUp,
  User,
  AlertCircle
} from "lucide-react";
import { useProducts } from "@/context/ProductsContext";
import { useBasket } from "@/context/BasketContext";
import { useWishlist } from "@/context/WishlistContext";
import { useReviews } from "@/context/ReviewsContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { cn } from "@/lib/utils";

// Product options
const BONE_OPTIONS = [
  { id: "bone", label: "Bone", labelAr: "بالعظم" },
  { id: "boneless", label: "Boneless", labelAr: "بدون عظم" },
];

const CUT_OPTIONS = [
  { id: "curry-cut", label: "Curry Cut", labelAr: "قطع كاري" },
  { id: "cubes", label: "Cubes", labelAr: "مكعبات" },
  { id: "whole", label: "Whole", labelAr: "كامل" },
];

// Nutritional info per 100g (example data)
const NUTRITIONAL_INFO: Record<string, { calories: number; protein: number; fat: number; carbs: number }> = {
  Beef: { calories: 250, protein: 26, fat: 17, carbs: 0 },
  Lamb: { calories: 294, protein: 25, fat: 21, carbs: 0 },
  Goat: { calories: 143, protein: 27, fat: 3, carbs: 0 },
  Chicken: { calories: 239, protein: 27, fat: 14, carbs: 0 },
  Marinated: { calories: 180, protein: 22, fat: 8, carbs: 5 },
  Premium: { calories: 270, protein: 28, fat: 18, carbs: 0 },
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProductById, products } = useProducts();
  const { addItem } = useBasket();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { getProductReviews, getProductRating, addReview, markHelpful, hasUserReviewed } = useReviews();
  const { user, isLoggedIn } = useAuth();
  const { language, t } = useLanguage();
  const isRTL = language === "ar";

  const [quantity, setQuantity] = useState(0.25);
  const [selectedBone, setSelectedBone] = useState<string[]>([]);
  const [selectedCut, setSelectedCut] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "nutrition" | "reviews">("description");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [selectedImage, setSelectedImage] = useState(0);

  const product = id ? getProductById(id) : undefined;
  const reviews = id ? getProductReviews(id) : [];
  const rating = id ? getProductRating(id) : null;
  const isWishlisted = product ? isInWishlist(product.id) : false;
  const userHasReviewed = id ? hasUserReviewed(id) : false;
  const nutrition = product ? NUTRITIONAL_INFO[product.category] : null;

  // Get related products (same category, exclude current)
  const relatedProducts = products
    .filter((p) => p.category === product?.category && p.id !== product?.id)
    .slice(0, 4);

  // Use product images array if available, otherwise single image
  const productImages = product?.image 
    ? [product.image] 
    : [];

  const formatWeight = (weight: number) => weight.toFixed(3);
  const weightUnit = isRTL ? "جرام" : "gr";

  // Smart weight display - converts to Kg when >= 1 Kg
  const formatWeightDisplay = (weight: number) => {
    if (weight >= 1) {
      // Display as Kg
      const kgValue = weight.toFixed(3);
      const kgUnit = isRTL ? "كجم" : "Kg";
      return `${kgValue} ${kgUnit}`;
    } else {
      // Display as grams (multiply by 1000 for display)
      const gramsValue = Math.round(weight * 1000);
      const grUnit = isRTL ? "جرام" : "gr";
      return `${gramsValue} ${grUnit}`;
    }
  };

  const handleAddToCart = () => {
    if (!product || !product.available) return;
    
    setIsAdding(true);

    const boneLabels = selectedBone.map((id) => {
      const opt = BONE_OPTIONS.find((o) => o.id === id);
      return isRTL ? opt?.labelAr : opt?.label;
    }).filter(Boolean);

    const cutLabels = selectedCut.map((id) => {
      const opt = CUT_OPTIONS.find((o) => o.id === id);
      return isRTL ? opt?.labelAr : opt?.label;
    }).filter(Boolean);

    const notes = [
      boneLabels.length > 0 ? boneLabels.join(", ") : null,
      cutLabels.length > 0 ? cutLabels.join(", ") : null,
    ].filter(Boolean).join(" | ");

    // Calculate discounted price for basket
    const effectivePrice = product.discount ? product.price * (1 - product.discount / 100) : product.price;

    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: Math.round(effectivePrice * 100) / 100, // Use discounted price
      quantity,
      image: product.image,
      category: product.category,
      notes: notes || undefined,
    });

    setTimeout(() => {
      setIsAdding(false);
    }, 1500);
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    toggleWishlist({
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: product.price,
      image: product.image,
      category: product.category,
    });
  };

  const handleSubmitReview = () => {
    if (!product || !user || !reviewForm.title || !reviewForm.comment) return;

    addReview({
      productId: product.id,
      userId: user.id,
      userName: `${user.firstName} ${user.familyName.charAt(0)}.`,
      rating: reviewForm.rating,
      title: reviewForm.title,
      comment: reviewForm.comment,
      isVerifiedPurchase: true, // In production, check if user has purchased
    });

    setReviewForm({ rating: 5, title: "", comment: "" });
    setShowReviewForm(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: product?.description,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("product.notFound")}</h1>
          <button onClick={() => navigate("/products")} className="btn-primary mt-4">
            {t("payment.backToProducts")}
          </button>
        </div>
      </div>
    );
  }

  const productName = isRTL && product.nameAr ? product.nameAr : product.name;
  const productDescription = isRTL && product.descriptionAr ? product.descriptionAr : product.description;

  return (
    <div className="py-4 sm:py-8 px-3 sm:px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4 sm:mb-6">
          <Link to="/products" className="hover:text-primary transition-colors">
            {t("products.title")}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{t(`category.${product.category.toLowerCase()}`)}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium truncate">{productName}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-muted rounded-2xl overflow-hidden">
              {product.image ? (
                <img
                  src={productImages[selectedImage] || product.image}
                  alt={productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">🥩</div>
              )}
              
              {/* Stock Badge */}
              {!product.available && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="bg-destructive text-white px-4 py-2 rounded-full font-semibold">
                    {t("product.outOfStock")}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {productImages.length > 1 && (
              <div className="flex gap-2">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={cn(
                      "w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all",
                      selectedImage === idx ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category & Wishlist */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                {t(`category.${product.category.toLowerCase()}`)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleWishlist}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    isWishlisted 
                      ? "bg-red-100 text-red-500 dark:bg-red-900/30" 
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                  title={isWishlisted ? t("product.removeFromWishlist") : t("product.addToWishlist")}
                >
                  <Heart className={cn("w-5 h-5", isWishlisted && "fill-current")} />
                </button>
                <button
                  onClick={handleShare}
                  className="p-2 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  title={t("product.share")}
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Name */}
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground">{productName}</h1>

            {/* Rating */}
            {rating && rating.totalReviews > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "w-5 h-5",
                        star <= Math.round(rating.averageRating)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-300"
                      )}
                    />
                  ))}
                </div>
                <span className="font-semibold text-foreground">{rating.averageRating}</span>
                <span className="text-muted-foreground">({rating.totalReviews} {t("product.reviews")})</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-bold text-primary">
                <PriceDisplay price={Number(product.discount) > 0 ? product.price * (1 - product.discount / 100) : product.price} size="lg" />
              </span>
              <span className="text-muted-foreground">/ {isRTL ? "كجم" : "Kg"}</span>
              {Number(product.discount) > 0 && (
                <span className="text-lg text-muted-foreground line-through">
                  <PriceDisplay price={product.price} size="md" />
                </span>
              )}
            </div>
            {/* Discount Badge */}
            {Number(product.discount) > 0 && (
              <span className="inline-block bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                -{product.discount}% {isRTL ? "خصم" : "OFF"}
              </span>
            )}

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                product.available ? "bg-green-500" : "bg-red-500"
              )} />
              <span className={cn(
                "font-medium",
                product.available ? "text-green-600" : "text-red-600"
              )}>
                {product.available ? t("product.inStock") : t("product.outOfStock")}
              </span>
            </div>

            {/* Options */}
            {product.available && (
              <div className="space-y-4 border-t border-b border-border py-6">
                {/* Bone Options */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    🦴 {t("product.details")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BONE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setSelectedBone((prev) =>
                            prev.includes(option.id)
                              ? prev.filter((id) => id !== option.id)
                              : [...prev, option.id]
                          );
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg border-2 font-medium transition-all",
                          selectedBone.includes(option.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {isRTL ? option.labelAr : option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cut Options */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    🔪 {t("product.cutType")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CUT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setSelectedCut((prev) =>
                            prev.includes(option.id)
                              ? prev.filter((id) => id !== option.id)
                              : [...prev, option.id]
                          );
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg border-2 font-medium transition-all",
                          selectedCut.includes(option.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {isRTL ? option.labelAr : option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {t("product.quantity")}
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-border rounded-lg">
                      <button
                        onClick={() => setQuantity(Math.max(0.25, parseFloat((quantity - 0.25).toFixed(3))))}
                        className="p-3 hover:bg-muted transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-24 text-center font-semibold">
                        {formatWeightDisplay(quantity)}
                      </span>
                      <button
                        onClick={() => setQuantity(parseFloat((quantity + 0.25).toFixed(3)))}
                        className="p-3 hover:bg-muted transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-muted-foreground">
                      = <PriceDisplay price={(product.discount ? product.price * (1 - product.discount / 100) : product.price) * quantity} size="md" className="font-bold text-foreground" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Add to Cart Button */}
            {product.available && isLoggedIn && (
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-3"
              >
                {isAdding ? (
                  <>
                    <Check className="w-6 h-6" />
                    {t("product.addedToCart")}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-6 h-6" />
                    {t("product.addToCart")}
                  </>
                )}
              </button>
            )}

            {/* Login to Buy */}
            {product.available && !isLoggedIn && (
              <button
                onClick={() => navigate("/login")}
                className="w-full btn-outline py-4 text-lg font-semibold"
              >
                {t("product.login")}
              </button>
            )}
          </div>
        </div>

        {/* Tabs: Description / Nutrition / Reviews */}
        <div className="mt-12">
          <div className="flex border-b border-border">
            {(["description", "nutrition", "reviews"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 sm:px-6 py-3 font-semibold transition-colors border-b-2 -mb-px",
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "description" ? t("product.description") : tab === "nutrition" ? t("product.nutrition") : t("product.reviews")}
                {tab === "reviews" && rating && rating.totalReviews > 0 && (
                  <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                    {rating.totalReviews}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="py-6">
            {/* Description Tab */}
            {activeTab === "description" && (
              <div className="prose prose-lg max-w-none dark:prose-invert">
                <p className="text-muted-foreground text-lg leading-relaxed">{productDescription}</p>
              </div>
            )}

            {/* Nutrition Tab */}
            {activeTab === "nutrition" && nutrition && (
              <div className="max-w-md">
                <h3 className="text-lg font-bold mb-4">{t("product.nutritionFacts")} ({t("product.per100g")})</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("product.calories")}</span>
                    <span className="font-semibold">{nutrition.calories} kcal</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("product.protein")}</span>
                    <span className="font-semibold">{nutrition.protein}g</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("product.fat")}</span>
                    <span className="font-semibold">{nutrition.fat}g</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("product.carbs")}</span>
                    <span className="font-semibold">{nutrition.carbs}g</span>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <div className="space-y-6">
                {/* Rating Summary */}
                {rating && rating.totalReviews > 0 && (
                  <div className="flex flex-col sm:flex-row gap-6 p-4 bg-muted/50 rounded-xl">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-foreground">{rating.averageRating}</div>
                      <div className="flex items-center justify-center gap-1 my-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={cn(
                              "w-5 h-5",
                              star <= Math.round(rating.averageRating)
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300"
                            )}
                          />
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground">{rating.totalReviews} reviews</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {[5, 4, 3, 2, 1].map((stars) => (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-3 text-sm text-muted-foreground">{stars}</span>
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full"
                              style={{
                                width: `${rating.totalReviews > 0 ? (rating.ratingDistribution[stars as 1|2|3|4|5] / rating.totalReviews) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="w-8 text-sm text-muted-foreground text-right">
                            {rating.ratingDistribution[stars as 1|2|3|4|5]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Write Review Button */}
                {isLoggedIn && !userHasReviewed && !showReviewForm && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="btn-outline"
                  >
                    {t("product.writeReview")}
                  </button>
                )}

                {!isLoggedIn && (
                  <p className="text-muted-foreground">{t("product.loginToReview")}</p>
                )}

                {userHasReviewed && !showReviewForm && (
                  <p className="text-muted-foreground">{t("product.alreadyReviewed")}</p>
                )}

                {/* Review Form */}
                {showReviewForm && (
                  <div className="p-4 border border-border rounded-xl space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">{t("product.ratingLabel")}</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setReviewForm((prev) => ({ ...prev, rating: star }))}
                            className="p-1"
                          >
                            <Star
                              className={cn(
                                "w-8 h-8 transition-colors",
                                star <= reviewForm.rating
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-300 hover:text-yellow-300"
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">{t("product.reviewTitle")}</label>
                      <input
                        type="text"
                        value={reviewForm.title}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none"
                        placeholder="Great product!"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">{t("product.reviewComment")}</label>
                      <textarea
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:border-primary outline-none min-h-[100px]"
                        placeholder="Share your experience..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleSubmitReview} className="btn-primary">
                        {t("product.submitReview")}
                      </button>
                      <button onClick={() => setShowReviewForm(false)} className="btn-outline">
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Reviews List */}
                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t("product.noReviews")}. {t("product.beFirstReview")}</p>
                  ) : (
                    reviews.map((review) => (
                      <div key={review.id} className="p-4 border border-border rounded-xl">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{review.userName}</div>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={cn(
                                        "w-4 h-4",
                                        star <= review.rating
                                          ? "text-yellow-400 fill-yellow-400"
                                          : "text-gray-300"
                                      )}
                                    />
                                  ))}
                                </div>
                                {review.isVerifiedPurchase && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {t("product.verifiedPurchase")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-semibold text-foreground mb-1">{review.title}</h4>
                        <p className="text-muted-foreground">{review.comment}</p>
                        <button
                          onClick={() => markHelpful(review.id)}
                          className="mt-3 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          {t("product.helpful")} ({review.helpfulCount})
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">{t("product.relatedProducts")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="card-premium overflow-hidden group"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={isRTL && p.nameAr ? p.nameAr : p.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🥩</div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-foreground line-clamp-1">
                      {isRTL && p.nameAr ? p.nameAr : p.name}
                    </h3>
                    <p className="text-primary font-bold mt-1">
                      <PriceDisplay price={p.price} size="md" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
