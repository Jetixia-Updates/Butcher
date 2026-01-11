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

// Helper function to ensure product has an image
const ensureProductImage = (product: Product): Product => {
  if (product.image) return product;
  
  // Try to get default image by product ID
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

export const ProductsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with INITIAL_PRODUCTS for consistency across all platforms
  const [products, setProducts] = useState<Product[]>(() => {
    // Try to load from localStorage first (works on both web and Capacitor WebView)
    try {
      const saved = localStorage.getItem("butcher_products");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure all products have images
          return parsed.map(ensureProductImage);
        }
      }
    } catch {
      // Ignore parse errors
    }
    return INITIAL_PRODUCTS;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Save to localStorage whenever products change (works on both web and mobile WebView)
  useEffect(() => {
    try {
      localStorage.setItem("butcher_products", JSON.stringify(products));
    } catch (err) {
      console.error("Failed to save products to localStorage:", err);
    }
  }, [products]);

  // Fetch products - localStorage is the source of truth for this demo
  // API is stateless (serverless), so we use localStorage for persistence
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try to load from localStorage first
      const saved = localStorage.getItem("butcher_products");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            setIsLoading(false);
            return;
          }
        } catch {
          // Continue to API fallback
        }
      }
      
      // Fallback to API if localStorage is empty
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
        localStorage.setItem("butcher_products", JSON.stringify(mappedProducts));
      } else {
        // Use initial products as last resort
        setProducts(INITIAL_PRODUCTS);
        localStorage.setItem("butcher_products", JSON.stringify(INITIAL_PRODUCTS));
      }
    } catch (err) {
      setError("Failed to fetch products");
      // Use initial products as fallback
      if (products.length === 0) {
        setProducts(INITIAL_PRODUCTS);
      }
    }
    setIsLoading(false);
  }, [products.length]);

  // Fetch on initial mount if localStorage is empty
  useEffect(() => {
    const saved = localStorage.getItem("butcher_products");
    if (!saved) {
      fetchProducts();
    }
  }, [fetchProducts]);

  // Refresh products from localStorage
  const refreshProducts = useCallback(async () => {
    const saved = localStorage.getItem("butcher_products");
    if (saved) {
      try {
        const parsedProducts = JSON.parse(saved);
        setProducts(parsedProducts);
      } catch {
        await fetchProducts();
      }
    } else {
      await fetchProducts();
    }
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
