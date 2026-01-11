import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

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
  addToWishlist: (item: Omit<WishlistItem, "id" | "addedAt">) => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (item: Omit<WishlistItem, "id" | "addedAt">) => void;
  clearWishlist: () => void;
  itemCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);

  // Load wishlist from localStorage on mount or user change
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`wishlist_${user.id}`);
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch {
          setItems([]);
        }
      }
    } else {
      setItems([]);
    }
  }, [user?.id]);

  // Save to localStorage whenever items change
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`wishlist_${user.id}`, JSON.stringify(items));
    }
  }, [items, user?.id]);

  const isInWishlist = useCallback((productId: string) => {
    return items.some((item) => item.productId === productId);
  }, [items]);

  const addToWishlist = useCallback((item: Omit<WishlistItem, "id" | "addedAt">) => {
    setItems((prev) => {
      // Check if already in wishlist using prev state to avoid stale closure
      const alreadyExists = prev.some((existing) => existing.productId === item.productId);
      if (alreadyExists) {
        return prev;
      }
      const newItem: WishlistItem = {
        ...item,
        id: `wishlist_${Date.now()}`,
        addedAt: new Date().toISOString(),
      };
      return [...prev, newItem];
    });
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const toggleWishlist = useCallback((item: Omit<WishlistItem, "id" | "addedAt">) => {
    if (isInWishlist(item.productId)) {
      removeFromWishlist(item.productId);
    } else {
      addToWishlist(item);
    }
  }, [isInWishlist, addToWishlist, removeFromWishlist]);

  const clearWishlist = useCallback(() => {
    setItems([]);
  }, []);

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
