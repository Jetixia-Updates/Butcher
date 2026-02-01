import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { wishlistApi, WishlistItem as ApiWishlistItem } from "@/lib/api";

export interface WishlistItem {
  id: string;
  productId: string;
  name: string;
  nameAr?: string;
  price: number;
  image?: string;
  category: string;
  addedAt: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  isInWishlist: (productId: string) => boolean;
  addToWishlist: (item: Omit<WishlistItem, "id" | "addedAt">) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  toggleWishlist: (item: Omit<WishlistItem, "id" | "addedAt">) => Promise<void>;
  clearWishlist: () => Promise<void>;
  itemCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  ensureLoaded: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Convert API item to local format
  const mapWishlistItem = (item: ApiWishlistItem): WishlistItem => ({
    id: item.id,
    productId: item.productId,
    name: item.product?.name || "",
    nameAr: item.product?.nameAr || "",
    price: item.product ? parseFloat(item.product.price) : 0,
    image: item.product?.image || undefined,
    category: item.product?.category || "",
    addedAt: item.createdAt,
  });

  // Fetch wishlist from API
  const fetchWishlist = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setHasLoaded(false);
      return;
    }

    try {
      const response = await wishlistApi.getAll();
      if (response.success && response.data) {
        setItems(response.data.map(mapWishlistItem));
      }
      setHasLoaded(true);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
    }
  }, [user?.id]);

  // Lazy load - only fetch when needed (called by pages that use wishlist)
  const ensureLoaded = useCallback(async () => {
    if (!hasLoaded && user?.id) {
      await fetchWishlist();
    }
  }, [hasLoaded, user?.id, fetchWishlist]);

  // Clear loaded state on user change (but don't auto-fetch)
  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      setHasLoaded(false);
    }
  }, [user?.id]);

  // Refresh wishlist data
  const refresh = async () => {
    await fetchWishlist();
  };

  const isInWishlist = useCallback((productId: string) => {
    return items.some((item) => item.productId === productId);
  }, [items]);

  const addToWishlist = useCallback(async (item: Omit<WishlistItem, "id" | "addedAt">) => {
    if (!user?.id) return;
    
    // Optimistic update
    const tempItem: WishlistItem = {
      ...item,
      id: `temp_${Date.now()}`,
      addedAt: new Date().toISOString(),
    };
    setItems((prev) => {
      if (prev.some((existing) => existing.productId === item.productId)) {
        return prev;
      }
      return [...prev, tempItem];
    });

    try {
      await wishlistApi.add(item.productId);
      await fetchWishlist();
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      // Revert on error
      setItems((prev) => prev.filter((i) => i.id !== tempItem.id));
    }
  }, [user?.id, fetchWishlist]);

  const removeFromWishlist = useCallback(async (productId: string) => {
    if (!user?.id) return;
    
    // Optimistic update
    const removedItems = items.filter((item) => item.productId === productId);
    setItems((prev) => prev.filter((item) => item.productId !== productId));

    try {
      await wishlistApi.remove(productId);
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      // Revert on error
      setItems((prev) => [...prev, ...removedItems]);
    }
  }, [user?.id, items]);

  const toggleWishlist = useCallback(async (item: Omit<WishlistItem, "id" | "addedAt">) => {
    if (isInWishlist(item.productId)) {
      await removeFromWishlist(item.productId);
    } else {
      await addToWishlist(item);
    }
  }, [isInWishlist, addToWishlist, removeFromWishlist]);

  const clearWishlist = useCallback(async () => {
    if (!user?.id) return;
    
    // Optimistic update
    const oldItems = [...items];
    setItems([]);

    try {
      await wishlistApi.clear();
    } catch (error) {
      console.error("Error clearing wishlist:", error);
      // Revert on error
      setItems(oldItems);
    }
  }, [user?.id, items]);

  return (
    <WishlistContext.Provider
      value={{
        items,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        clearWishlist,
        itemCount: items.length,
        isLoading,
        refresh,
        ensureLoaded,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
