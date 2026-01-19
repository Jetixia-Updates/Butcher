import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { productsApi } from "@/lib/api";

export interface Product {
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
  isPremium?: boolean;
  badges?: ("halal" | "organic" | "grass-fed" | "premium" | "fresh" | "local")[];
}

interface ProductsContextType {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  refreshProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  resetToDefaults: () => void;
  exportProducts: () => string;
  importProducts: (jsonData: string) => boolean;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod_1",
    name: "Premium Beef Steak",
    nameAr: "ستيك لحم بقري ممتاز",
    price: 89.99,
    category: "Beef",
    description: "Aged premium ribeye steak, perfect for grilling",
    descriptionAr: "ستيك ريب آي معتق ممتاز، مثالي للشوي",
    image: "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&h=300&fit=crop",
    available: true,
    discount: 15,
    rating: 4.8,
    badges: ["premium", "halal", "grass-fed"],
  },
  {
    id: "prod_2",
    name: "Lamb Chops",
    nameAr: "ريش لحم ضأن",
    price: 74.5,
    category: "Lamb",
    description: "Fresh lamb chops, ideal for Mediterranean cuisine",
    descriptionAr: "ريش لحم ضأن طازجة، مثالية للمطبخ المتوسطي",
    image: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop",
    available: true,
    discount: 10,
    rating: 4.6,
    badges: ["halal", "fresh", "local"],
  },
  {
    id: "prod_6",
    name: "Goat Leg",
    nameAr: "فخذ ماعز",
    price: 125,
    category: "Goat",
    description: "Whole goat leg, perfect for traditional dishes",
    descriptionAr: "فخذ ماعز كامل، مثالي للأطباق التقليدية",
    image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop",
    available: true,
    discount: 20,
    rating: 4.9,
    badges: ["halal", "premium", "fresh"],
  },
  {
    id: "prod_3",
    name: "Chicken Breast",
    nameAr: "صدر دجاج",
    price: 34.99,
    category: "Chicken",
    description: "Boneless, skinless chicken breasts - versatile and healthy",
    descriptionAr: "صدور دجاج بدون عظم وجلد - متعددة الاستخدامات وصحية",
    image: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop",
    available: true,
    rating: 4.5,
    badges: ["halal", "fresh"],
  },
  {
    id: "prod_4",
    name: "Ground Beef",
    nameAr: "لحم بقري مفروم",
    price: 45.0,
    category: "Beef",
    description: "Lean ground beef for burgers and meatballs",
    descriptionAr: "لحم بقري مفروم قليل الدهن للبرغر وكرات اللحم",
    image: "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop",
    available: true,
    discount: 5,
    rating: 4.4,
    badges: ["halal", "local"],
  },
  {
    id: "prod_5",
    name: "Beef Brisket",
    nameAr: "صدر لحم بقري",
    price: 95.0,
    category: "Beef",
    description: "Slow-cooked perfection for your BBQ",
    descriptionAr: "مثالي للطهي البطيء والشواء",
    image: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=400&h=300&fit=crop",
    available: true,
    rating: 4.7,
    badges: ["halal", "grass-fed"],
  },
  {
    id: "prod_7",
    name: "Lamb Leg",
    nameAr: "فخذ ضأن",
    price: 125.0,
    category: "Lamb",
    description: "Whole lamb leg, perfect for family dinners",
    descriptionAr: "فخذ ضأن كامل، مثالي لعشاء العائلة",
    image: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop",
    available: false,
    rating: 4.6,
    badges: ["halal", "premium"],
  },
  {
    id: "prod_8",
    name: "Goat Ribs",
    nameAr: "ريش ماعز",
    price: 95,
    category: "Goat",
    description: "Premium goat ribs, perfect for grilling",
    descriptionAr: "ريش ماعز ممتازة، مثالية للشوي",
    image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop",
    available: true,
    discount: 25,
    rating: 4.8,
    badges: ["halal", "organic", "local"],
  },
  {
    id: "prod_9",
    name: "Wagyu Ribeye",
    nameAr: "واغيو ريب آي",
    price: 249.99,
    category: "Beef",
    description: "Premium Australian Wagyu A5, melt-in-your-mouth texture",
    descriptionAr: "واغيو أسترالي ممتاز A5، قوام يذوب في الفم",
    image: "https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=400&h=300&fit=crop",
    available: true,
    discount: 30,
    rating: 5.0,
    badges: ["premium", "halal", "grass-fed"],
  },
  {
    id: "prod_10",
    name: "Organic Chicken Thighs",
    nameAr: "أفخاذ دجاج عضوي",
    price: 42.99,
    category: "Chicken",
    description: "Free-range organic chicken thighs, extra juicy",
    descriptionAr: "أفخاذ دجاج عضوي حر، طرية وغنية بالعصارة",
    image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop",
    available: true,
    rating: 4.7,
    badges: ["organic", "halal", "fresh"],
  },
];

// Create a map of default images by product id - RAW MEAT IMAGES
const DEFAULT_IMAGES: Record<string, string> = {
  prod_1: "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&h=300&fit=crop", // Raw beef steak
  prod_2: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop", // Raw lamb chops
  prod_3: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop", // Raw chicken breast
  prod_4: "https://images.unsplash.com/photo-1551028150-64b9f398f678?w=400&h=300&fit=crop", // Raw ground beef
  prod_5: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=400&h=300&fit=crop", // Raw beef brisket
  prod_6: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop", // Raw goat/sheep leg
  prod_7: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=300&fit=crop", // Raw lamb leg
  prod_8: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=300&fit=crop", // Raw ribs
  prod_9: "https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=400&h=300&fit=crop", // Raw wagyu
  prod_10: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&h=300&fit=crop", // Raw chicken thighs
};

// Category-based fallback images - RAW MEAT
const CATEGORY_IMAGES: Record<string, string> = {
  beef: "https://images.unsplash.com/photo-1588347818036-558601350947?w=400&h=300&fit=crop", // Raw beef
  lamb: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop", // Raw lamb
  chicken: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=300&fit=crop", // Raw chicken
  goat: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop", // Raw goat
  sheep: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop", // Raw sheep
  marinated: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&h=300&fit=crop", // Marinated meat
  premium: "https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=400&h=300&fit=crop", // Premium raw meat
};

// Version number - increment this to add new default products (not to override admin changes)
const PRODUCTS_VERSION = 2;

// Helper function to ensure product has the correct image
const ensureProductImage = (product: Product): Product => {
  // If product already has an image, keep it (respect admin changes)
  if (product.image) return product;
  
  // For known product IDs without images, use the default image
  const defaultImage = DEFAULT_IMAGES[product.id];
  if (defaultImage) {
    return { ...product, image: defaultImage };
  }
  
  // Fallback to category-based image
  const categoryImage = CATEGORY_IMAGES[product.category.toLowerCase()];
  if (categoryImage) {
    return { ...product, image: categoryImage };
  }
  
  // Final fallback - use beef image
  return { ...product, image: CATEGORY_IMAGES.beef };
};

// Helper to merge saved products with any new INITIAL_PRODUCTS (adds new products, respects admin changes)
const mergeWithInitialProducts = (savedProducts: Product[]): Product[] => {
  const savedProductsMap = new Map(savedProducts.map(p => [p.id, p]));
  const result: Product[] = [];
  
  // Keep all saved products (with their admin-modified values)
  savedProducts.forEach(saved => {
    result.push(ensureProductImage(saved));
  });
  
  // Add any new products from INITIAL_PRODUCTS that don't exist in saved
  INITIAL_PRODUCTS.forEach(initial => {
    if (!savedProductsMap.has(initial.id)) {
      result.push(initial);
    }
  });
  
  return result;
};

export const ProductsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with empty products - will be fetched from API
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetchedFromApi, setHasFetchedFromApi] = useState(false);

  // Check if running on native mobile platform
  const isNative = Capacitor.isNativePlatform();

  // Sync products across browser tabs using storage event (web only)
  useEffect(() => {
    if (isNative) return; // Skip on mobile - no cross-tab sync needed
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "butcher_products" && e.newValue) {
        try {
          const newProducts = JSON.parse(e.newValue);
          setProducts(newProducts);
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isNative]);

  // Save to localStorage whenever products change (as cache, not source of truth)
  useEffect(() => {
    // Only save to localStorage after we've fetched from API at least once
    if (hasFetchedFromApi && products.length > 0) {
      try {
        localStorage.setItem("butcher_products", JSON.stringify(products));
      } catch (err) {
        console.error("Failed to save products to localStorage:", err);
      }
    }
  }, [products, hasFetchedFromApi]);

  // Fetch products - API is the source of truth for consistency across devices
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Always fetch from API first to ensure consistency between web and mobile
      const response = await productsApi.getAll();
      if (response.success && response.data && response.data.length > 0) {
        const mappedProducts: Product[] = response.data.map((p) => ({
          id: p.id,
          name: p.name,
          nameAr: p.nameAr,
          price: p.price,
          category: p.category,
          description: p.description,
          descriptionAr: p.descriptionAr,
          image: p.image,
          available: p.isActive,
          discount: (p as any).discount,
          rating: (p as any).rating,
          isPremium: (p as any).isPremium,
          badges: (p as any).badges,
        }));
        setProducts(mappedProducts);
        setHasFetchedFromApi(true);
        localStorage.setItem("butcher_products", JSON.stringify(mappedProducts));
      } else {
        // API returned empty/failed - try localStorage as cache
        const saved = localStorage.getItem("butcher_products");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProducts(parsed);
              setHasFetchedFromApi(true);
              setIsLoading(false);
              return;
            }
          } catch {
            // Continue to fallback
          }
        }
        // Use initial products as last resort
        setProducts(INITIAL_PRODUCTS);
        setHasFetchedFromApi(true);
        localStorage.setItem("butcher_products", JSON.stringify(INITIAL_PRODUCTS));
      }
    } catch (err) {
      console.error("Failed to fetch products from API:", err);
      setError("Failed to fetch products");
      // Try localStorage as cache fallback
      const saved = localStorage.getItem("butcher_products");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            setHasFetchedFromApi(true);
          } else {
            setProducts(INITIAL_PRODUCTS);
            setHasFetchedFromApi(true);
          }
        } catch {
          setProducts(INITIAL_PRODUCTS);
          setHasFetchedFromApi(true);
        }
      } else {
        setProducts(INITIAL_PRODUCTS);
        setHasFetchedFromApi(true);
      }
    }
    setIsLoading(false);
  }, []);

  // Always fetch from API on initial mount to ensure consistency
  useEffect(() => {
    // First, load from localStorage for instant display (optimistic)
    const saved = localStorage.getItem("butcher_products");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
        }
      } catch {
        // Ignore
      }
    }
    // Then always fetch from API to get latest data
    fetchProducts();
  }, [fetchProducts]);

  // Refresh products from API
  const refreshProducts = useCallback(async () => {
    await fetchProducts();
  }, [fetchProducts]);

  const addProduct = async (product: Omit<Product, "id">) => {
    try {
      const response = await productsApi.create({
        name: product.name,
        nameAr: product.nameAr,
        sku: `SKU-${Date.now()}`,
        price: product.price,
        costPrice: product.price * 0.6,
        category: product.category,
        description: product.description,
        descriptionAr: product.descriptionAr,
        image: product.image,
        unit: "kg",
        minOrderQuantity: 0.25,
        maxOrderQuantity: 10,
        isActive: product.available,
        isFeatured: false,
        tags: [],
        discount: product.discount,
        rating: product.rating,
        badges: product.badges,
      });

      if (response.success && response.data) {
        const newProduct: Product = {
          id: response.data.id,
          name: response.data.name,
          nameAr: response.data.nameAr,
          price: response.data.price,
          category: response.data.category,
          description: response.data.description,
          descriptionAr: response.data.descriptionAr,
          image: response.data.image,
          available: response.data.isActive,
          discount: response.data.discount,
          rating: response.data.rating,
          badges: response.data.badges,
        };
        setProducts((prev) => [...prev, newProduct]);
      } else {
        // Fallback to local add
        const newProduct: Product = {
          ...product,
          id: `prod_${Date.now()}`,
        };
        setProducts((prev) => [...prev, newProduct]);
      }
    } catch {
      // Fallback to local add
      const newProduct: Product = {
        ...product,
        id: `prod_${Date.now()}`,
      };
      setProducts((prev) => [...prev, newProduct]);
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const response = await productsApi.update(id, {
        name: updates.name,
        nameAr: updates.nameAr,
        price: updates.price,
        category: updates.category,
        description: updates.description,
        descriptionAr: updates.descriptionAr,
        image: updates.image,
        isActive: updates.available,
        discount: updates.discount,
        rating: updates.rating,
        badges: updates.badges,
      });

      if (response.success) {
        setProducts((prev) =>
          prev.map((product) =>
            product.id === id ? { ...product, ...updates } : product
          )
        );
      } else {
        // Still update locally
        setProducts((prev) =>
          prev.map((product) =>
            product.id === id ? { ...product, ...updates } : product
          )
        );
      }
    } catch {
      // Fallback to local update
      setProducts((prev) =>
        prev.map((product) =>
          product.id === id ? { ...product, ...updates } : product
        )
      );
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productsApi.delete(id);
      setProducts((prev) => prev.filter((product) => product.id !== id));
    } catch {
      // Fallback to local delete
      setProducts((prev) => prev.filter((product) => product.id !== id));
    }
  };

  const getProductById = (id: string) => {
    return products.find((product) => product.id === id);
  };

  // Reset products to initial defaults
  const resetToDefaults = () => {
    const productsWithImages = INITIAL_PRODUCTS.map(ensureProductImage);
    setProducts(productsWithImages);
    localStorage.setItem("butcher_products", JSON.stringify(productsWithImages));
    localStorage.setItem("butcher_products_version", String(PRODUCTS_VERSION));
  };

  // Export products as JSON string for syncing
  const exportProducts = (): string => {
    return JSON.stringify(products, null, 2);
  };

  // Import products from JSON string
  const importProducts = (jsonData: string): boolean => {
    try {
      const importedProducts = JSON.parse(jsonData);
      if (!Array.isArray(importedProducts)) {
        return false;
      }
      // Validate that each item looks like a product
      const validProducts = importedProducts.filter(
        (p: unknown) =>
          typeof p === 'object' &&
          p !== null &&
          'id' in p &&
          'name' in p &&
          'price' in p
      );
      if (validProducts.length === 0) {
        return false;
      }
      const productsWithImages = validProducts.map(ensureProductImage);
      setProducts(productsWithImages);
      localStorage.setItem("butcher_products", JSON.stringify(productsWithImages));
      localStorage.setItem("butcher_products_version", String(PRODUCTS_VERSION));
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ProductsContext.Provider
      value={{
        products,
        isLoading,
        error,
        refreshProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        getProductById,
        resetToDefaults,
        exportProducts,
        importProducts,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductsProvider");
  }
  return context;
};
