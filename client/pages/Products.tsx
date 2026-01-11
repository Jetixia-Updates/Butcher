import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, ChevronDown, Grid, List, Star, Heart, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/context/AuthContext";
import { useBasket } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProducts } from "@/context/ProductsContext";
import { useWishlist } from "@/context/WishlistContext";
import { useReviews } from "@/context/ReviewsContext";
import { PriceDisplay } from "@/components/CurrencySymbol";
import { cn } from "@/lib/utils";
import { PRODUCT_CATEGORIES, getCategoryName } from "@shared/categories";

type SortOption = "default" | "price-low" | "price-high" | "rating" | "name";
type ViewMode = "grid" | "list";

export default function ProductsPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { addItem } = useBasket();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const { products, refreshProducts } = useProducts();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { getProductRating } = useReviews();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial category from URL params
  const initialCategory = searchParams.get('category') || 'All';
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const translations = {
    en: {
      searchPlaceholder: "Search products...",
      filters: "Filters",
      sortBy: "Sort by",
      default: "Default",
      priceLowHigh: "Price: Low to High",
      priceHighLow: "Price: High to Low",
      rating: "Top Rated",
      name: "Name A-Z",
      priceRange: "Price Range",
      clearFilters: "Clear Filters",
      showingResults: "Showing",
      results: "results",
      noResults: "No products found",
      tryDifferent: "Try a different search or filter",
      inStock: "In Stock",
      outOfStock: "Out of Stock",
    },
    ar: {
      searchPlaceholder: "ابحث عن منتجات...",
      filters: "التصفية",
      sortBy: "ترتيب حسب",
      default: "الافتراضي",
      priceLowHigh: "السعر: من الأقل للأعلى",
      priceHighLow: "السعر: من الأعلى للأقل",
      rating: "الأعلى تقييماً",
      name: "الاسم أ-ي",
      priceRange: "نطاق السعر",
      clearFilters: "مسح الفلاتر",
      showingResults: "عرض",
      results: "نتيجة",
      noResults: "لم يتم العثور على منتجات",
      tryDifferent: "جرب بحثاً أو فلتراً مختلفاً",
      inStock: "متوفر",
      outOfStock: "غير متوفر",
    },
  };

  const tt = translations[language];

  // Auto-refresh products
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshProducts();
      }
    };

    refreshProducts();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [refreshProducts]);

  // Categories - use all shared categories
  const categories = [
    { id: "All", nameEn: "All", nameAr: "الكل" },
    ...PRODUCT_CATEGORIES
  ];

  // Sync category with URL params
  useEffect(() => {
    const urlCategory = searchParams.get('category');
    if (urlCategory && urlCategory !== selectedCategory) {
      // Check if it's a valid category
      const validCat = categories.find(c => c.id.toLowerCase() === urlCategory.toLowerCase());
      if (validCat) {
        setSelectedCategory(validCat.id);
      }
    }
  }, [searchParams]);

  // Get max price for range
  const maxPrice = useMemo(() => {
    return Math.max(...products.map(p => p.price), 10000);
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter - case-insensitive match
    // For Premium category, show all products marked as isPremium
    if (selectedCategory !== "All") {
      if (selectedCategory.toLowerCase() === "premium") {
        result = result.filter((p) => p.isPremium === true);
      } else {
        result = result.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const name = (isRTL && p.nameAr ? p.nameAr : p.name).toLowerCase();
        const desc = (isRTL && p.descriptionAr ? p.descriptionAr : p.description).toLowerCase();
        return name.includes(query) || desc.includes(query) || p.category.toLowerCase().includes(query);
      });
    }

    // Price range filter
    result = result.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Sort
    switch (sortBy) {
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        result.sort((a, b) => {
          const ratingA = getProductRating(a.id).averageRating;
          const ratingB = getProductRating(b.id).averageRating;
          return ratingB - ratingA;
        });
        break;
      case "name":
        result.sort((a, b) => {
          const nameA = isRTL && a.nameAr ? a.nameAr : a.name;
          const nameB = isRTL && b.nameAr ? b.nameAr : b.name;
          return nameA.localeCompare(nameB);
        });
        break;
      default:
        // Available products first
        result.sort((a, b) => {
          if (a.available && !b.available) return -1;
          if (!a.available && b.available) return 1;
          return 0;
        });
    }

    return result;
  }, [products, selectedCategory, searchQuery, priceRange, sortBy, isRTL, getProductRating]);

  const isVisitor = !!user && user.isVisitor;

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

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSortBy("default");
    setPriceRange([0, maxPrice]);
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "default", label: tt.default },
    { value: "price-low", label: tt.priceLowHigh },
    { value: "price-high", label: tt.priceHighLow },
    { value: "rating", label: tt.rating },
    { value: "name", label: tt.name },
  ];

  const hasActiveFilters = searchQuery || selectedCategory !== "All" || sortBy !== "default" || priceRange[0] > 0 || priceRange[1] < maxPrice;

  return (
    <div className="py-6 sm:py-12 px-3 sm:px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2">
            {t("products.title")}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isLoggedIn
              ? t("products.welcome", { name: user?.firstName || "" })
              : isVisitor
              ? `${t("products.guestMessage")} (${user?.firstName})`
              : t("products.guestMessage")}
          </p>
        </div>

        {/* Search & Filters Bar */}
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
              <input
                type="text"
                placeholder={tt.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full py-3 border border-border rounded-xl focus:border-primary outline-none transition-colors",
                  isRTL ? "pr-11 pl-4" : "pl-11 pr-4"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className={cn("absolute top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded", isRTL ? "left-3" : "right-3")}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Filter Toggle Button (Mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "sm:hidden p-3 border border-border rounded-xl transition-colors",
                showFilters && "bg-primary text-primary-foreground border-primary"
              )}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>

            {/* Sort Dropdown */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-4 py-3 border border-border rounded-xl hover:bg-muted transition-colors min-w-[180px]"
              >
                <span className="text-sm">{tt.sortBy}:</span>
                <span className="font-medium text-sm flex-1 text-left">
                  {sortOptions.find(o => o.value === sortBy)?.label}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showSortDropdown && "rotate-180")} />
              </button>
              {showSortDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                  <div className="absolute top-full mt-2 right-0 bg-background border border-border rounded-xl shadow-lg z-20 min-w-[180px] py-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors",
                          sortBy === option.value && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-3 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-3 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Filters Panel */}
          {showFilters && (
            <div className="sm:hidden p-4 bg-muted/50 rounded-xl space-y-4">
              {/* Sort */}
              <div>
                <label className="block text-sm font-medium mb-2">{tt.sortBy}</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full p-2 border border-border rounded-lg bg-background"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {tt.priceRange}: <PriceDisplay price={priceRange[0]} size="sm" /> - <PriceDisplay price={priceRange[1]} size="sm" />
                </label>
                <input
                  type="range"
                  min={0}
                  max={maxPrice}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  if (category.id === 'All') {
                    searchParams.delete('category');
                  } else {
                    searchParams.set('category', category.id);
                  }
                  setSearchParams(searchParams);
                }}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold whitespace-nowrap transition-all text-sm sm:text-base ${
                  selectedCategory === category.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                {isRTL ? category.nameAr : category.nameEn}
              </button>
            ))}
          </div>

          {/* Active Filters & Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {tt.showingResults} <span className="font-semibold text-foreground">{filteredProducts.length}</span> {tt.results}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                {tt.clearFilters}
              </button>
            )}
          </div>
        </div>

        {/* Products Grid/List */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">{tt.noResults}</h2>
            <p className="text-muted-foreground mb-4">{tt.tryDifferent}</p>
            <button onClick={handleClearFilters} className="btn-primary">
              {tt.clearFilters}
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="relative group">
                {/* Wishlist Button */}
                {isLoggedIn && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleWishlist({
                        productId: product.id,
                        name: product.name,
                        nameAr: product.nameAr,
                        price: product.price,
                        image: product.image,
                        category: product.category,
                      });
                    }}
                    className={cn(
                      "absolute top-2 right-2 z-10 p-2 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-sm transition-colors opacity-0 group-hover:opacity-100",
                      isInWishlist(product.id) ? "text-red-500 opacity-100" : "text-muted-foreground hover:text-red-500"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", isInWishlist(product.id) && "fill-current")} />
                  </button>
                )}
                
                {/* Rating Badge */}
                {(() => {
                  const rating = getProductRating(product.id);
                  return rating.totalReviews > 0 ? (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 px-2 py-1 rounded-full text-xs font-medium">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {rating.averageRating}
                    </div>
                  ) : null;
                })()}

                <ProductCard
                  product={product}
                  onAddToBasket={handleAddToBasket}
                  isVisitor={!isLoggedIn || isVisitor}
                  onLoginRequired={handleLoginRequired}
                />
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="space-y-4">
            {filteredProducts.map((product) => {
              const rating = getProductRating(product.id);
              const productName = isRTL && product.nameAr ? product.nameAr : product.name;
              const productDesc = isRTL && product.descriptionAr ? product.descriptionAr : product.description;

              return (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="card-premium p-4 flex gap-4 hover:shadow-lg transition-shadow"
                >
                  {/* Image */}
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={productName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🥩</div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                          {t(`category.${product.category.toLowerCase()}`)}
                        </p>
                        <h3 className="font-bold text-foreground text-lg">{productName}</h3>
                      </div>
                      {isLoggedIn && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            toggleWishlist({
                              productId: product.id,
                              name: product.name,
                              nameAr: product.nameAr,
                              price: product.price,
                              image: product.image,
                              category: product.category,
                            });
                          }}
                          className={cn(
                            "p-2 rounded-full transition-colors",
                            isInWishlist(product.id) ? "text-red-500 bg-red-50" : "text-muted-foreground hover:text-red-500"
                          )}
                        >
                          <Heart className={cn("w-5 h-5", isInWishlist(product.id) && "fill-current")} />
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{productDesc}</p>

                    <div className="flex items-center gap-4 mt-2">
                      {rating.totalReviews > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-medium">{rating.averageRating}</span>
                          <span className="text-sm text-muted-foreground">({rating.totalReviews})</span>
                        </div>
                      )}
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        product.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        {product.available ? tt.inStock : tt.outOfStock}
                      </span>
                    </div>

                    <p className="text-xl font-bold text-primary mt-2">
                      <PriceDisplay price={product.price} size="lg" />
                      <span className="text-sm text-muted-foreground font-normal"> / {isRTL ? "كجم" : "Kg"}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
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
    </div>
  );
}

