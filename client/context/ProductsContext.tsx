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

// Helper function to ensure product has the correct image
const ensureProductImage = (product: Product): Product => {
  // If product already has an image, keep it
  if (product.image) return product;

  // Fallback to category-based image
  const categoryImage = CATEGORY_IMAGES[product.category.toLowerCase()];
  if (categoryImage) {
    return { ...product, image: categoryImage };
  }

  // Final fallback - use beef image
  return { ...product, image: CATEGORY_IMAGES.beef };
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
    // Only save to localStorage after we've fetched from API or manually added/updated data
    // Also save if we have products even if hasFetchedFromApi is false (e.g. initial add)
    if ((hasFetchedFromApi || products.length > 0)) {
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
      if (response.success && response.data) {
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
          discount: p.discount,
          rating: p.rating,
          isPremium: p.isPremium || false,
          badges: p.badges,
        }));

        setProducts(mappedProducts);
        setHasFetchedFromApi(true);
        localStorage.setItem("butcher_products", JSON.stringify(mappedProducts));
      } else {
        // API failed or returned no data - try localStorage as cache fallback
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
            // Continue
          }
        }

        // If we already have products (manual adds), don't clear them if API fails
        setProducts(prev => prev.length > 0 ? prev : []);
        setHasFetchedFromApi(true);
        if (products.length === 0) {
          setError("No products available. Please add products in the admin panel.");
        }
      }
    } catch (err) {
      console.error("Failed to fetch products from API:", err);
      setError("Failed to fetch products from server");
      // Try localStorage as cache fallback
      const saved = localStorage.getItem("butcher_products");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            setHasFetchedFromApi(true);
          } else {
            setProducts([]);
            setHasFetchedFromApi(true);
          }
        } catch {
          setProducts([]);
          setHasFetchedFromApi(true);
        }
      } else {
        setProducts([]);
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
      // Generate a unique SKU with timestamp and random string to avoid collisions
      const uniqueSku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      
      const response = await productsApi.create({
        name: product.name,
        nameAr: product.nameAr,
        sku: uniqueSku,
        price: product.price,
        costPrice: product.price * 0.6,
        category: product.category,
        description: product.description || "No description", // Ensure description is never empty
        descriptionAr: product.descriptionAr,
        image: product.image,
        unit: "kg",
        minOrderQuantity: 0.25,
        maxOrderQuantity: 10,
        isActive: product.available,
        isFeatured: false,
        isPremium: product.isPremium || false,
        tags: [],
        discount: product.discount,
        rating: product.rating,
        badges: product.badges,
      });

      if (response.success && response.data) {
        // Product was successfully created in the database
        // Immediately refresh from API to ensure consistency across all tabs/views
        await fetchProducts();
      } else {
        console.error("Failed to add product: API returned", response.error);
        throw new Error(response.error || "Failed to add product");
      }
    } catch (err) {
      console.error("Failed to add product:", err);
      throw err; // Re-throw so the caller knows it failed
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
        isPremium: updates.isPremium,
        discount: updates.discount,
        rating: updates.rating,
        badges: updates.badges,
      });

      if (response.success) {
        // Refresh from API to ensure consistency
        await fetchProducts();
      } else {
        console.error("Failed to update product: API returned", response.error);
        throw new Error(response.error || "Failed to update product");
      }
    } catch (err) {
      console.error("Failed to update product:", err);
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const response = await productsApi.delete(id);
      if (response.success) {
        // Refresh from API to ensure consistency
        await fetchProducts();
      } else {
        console.error("Failed to delete product: API returned", response.error);
        throw new Error(response.error || "Failed to delete product");
      }
    } catch (err) {
      console.error("Failed to delete product:", err);
      throw err;
    }
  };

  const getProductById = (id: string) => {
    return products.find((product) => product.id === id);
  };

  // Reset products by refetching from database
  const resetToDefaults = () => {
    // Clear local cache and refetch from API
    localStorage.removeItem("butcher_products");
    fetchProducts();
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
