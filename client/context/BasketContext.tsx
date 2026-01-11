import React, { createContext, useContext, useState, useEffect } from "react";
import { calculateVAT } from "@/utils/vat";

export interface BasketItem {
  id: string; // Unique basket item key (for local basket management)
  productId: string; // Original product ID (for API calls)
  name: string;
  nameAr?: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
  notes?: string; // Product options like Bone/Boneless, Cut Type
}

export interface BasketContextType {
  items: BasketItem[];
  subtotal: number;
  vat: number;
  total: number;
  itemCount: number;
  addItem: (item: BasketItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearBasket: () => void;
  getSavedBaskets: () => SavedBasket[];
  saveBasket: (name: string) => void;
  loadBasket: (id: string) => void;
}

export interface SavedBasket {
  id: string;
  name: string;
  items: BasketItem[];
  savedAt: string;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export const BasketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [vat, setVat] = useState(0);
  const [total, setTotal] = useState(0);

  // Load basket from localStorage on mount
  useEffect(() => {
    const savedBasket = localStorage.getItem("basket");
    if (savedBasket) {
      try {
        const parsedItems: BasketItem[] = JSON.parse(savedBasket);
        // Migrate old items that don't have productId set
        const migratedItems = parsedItems.map((item) => {
          if (!item.productId) {
            // Extract original product ID from modified ID (e.g., "prod_2_1736438400000" -> "prod_2")
            const timestampMatch = item.id.match(/^(.+)_(\d{13,})$/);
            if (timestampMatch) {
              item.productId = timestampMatch[1];
            } else {
              item.productId = item.id;
            }
          }
          return item;
        });
        setItems(migratedItems);
      } catch (error) {
        console.error("Failed to parse basket from localStorage:", error);
      }
    }
  }, []);

  // Recalculate totals whenever items change
  useEffect(() => {
    const newSubtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const { vat: newVat, total: newTotal } = calculateVAT(newSubtotal);

    setSubtotal(parseFloat(newSubtotal.toFixed(2)));
    setVat(newVat);
    setTotal(newTotal);

    localStorage.setItem("basket", JSON.stringify(items));
  }, [items]);

  const addItem = (item: BasketItem) => {
    setItems((prevItems) => {
      // Find existing item with same product ID AND same notes (product options)
      const existingItem = prevItems.find(
        (i) => i.productId === item.productId && i.notes === item.notes
      );
      if (existingItem) {
        return prevItems.map((i) =>
          i.productId === item.productId && i.notes === item.notes
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      // Add as new basket item with unique basket item ID
      const itemWithKey = {
        ...item,
        // Create a unique basket item ID for differentiation
        id: item.notes ? `${item.productId}_${Date.now()}` : item.productId,
        // Ensure productId is set (for backward compatibility)
        productId: item.productId || item.id,
      };
      return [...prevItems, itemWithKey];
    });
  };

  const removeItem = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
    } else {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    }
  };

  const clearBasket = () => {
    setItems([]);
    localStorage.removeItem("basket");
  };

  const getSavedBaskets = (): SavedBasket[] => {
    const saved = localStorage.getItem("savedBaskets");
    return saved ? JSON.parse(saved) : [];
  };

  const saveBasket = (name: string) => {
    const savedBaskets = getSavedBaskets();
    const newSavedBasket: SavedBasket = {
      id: `basket_${Date.now()}`,
      name,
      items,
      savedAt: new Date().toISOString(),
    };
    savedBaskets.push(newSavedBasket);
    localStorage.setItem("savedBaskets", JSON.stringify(savedBaskets));
  };

  const loadBasket = (id: string) => {
    const savedBaskets = getSavedBaskets();
    const basketToLoad = savedBaskets.find((b) => b.id === id);
    if (basketToLoad) {
      setItems(basketToLoad.items);
    }
  };

  // Count the number of unique items in the basket (not the weight)
  const itemCount = items.length;

  return (
    <BasketContext.Provider
      value={{
        items,
        subtotal,
        vat,
        total,
        itemCount,
        addItem,
        removeItem,
        updateQuantity,
        clearBasket,
        getSavedBaskets,
        saveBasket,
        loadBasket,
      }}
    >
      {children}
    </BasketContext.Provider>
  );
};

export const useBasket = () => {
  const context = useContext(BasketContext);
  if (context === undefined) {
    throw new Error("useBasket must be used within a BasketProvider");
  }
  return context;
};
