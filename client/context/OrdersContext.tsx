import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { fetchApi } from "@/lib/api";

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  items: {
    id: string;
    productId: string;
    name: string;
    nameAr?: string;
    quantity: number;
    price: number;
    image?: string;
    notes?: string;
  }[];
  subtotal: number;
  vat: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: "pending" | "confirmed" | "processing" | "out_for_delivery" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod: "card" | "cod" | "bank_transfer";
  deliveryAddress: {
    fullName: string;
    mobile: string;
    emirate: string;
    area: string;
    street: string;
    building: string;
    floor?: string;
    apartment?: string;
  };
  deliveryTimeSlot?: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrdersContextType {
  orders: CustomerOrder[];
  isLoading: boolean;
  fetchOrders: () => Promise<void>;
  getOrderById: (orderId: string) => CustomerOrder | undefined;
  addOrder: (order: CustomerOrder) => void;
  cancelOrder: (orderId: string) => Promise<boolean>;
  reorderItems: (orderId: string) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Define fetchOrders first so it can be used in effects
  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Fetch orders from API - database is the source of truth
      const data = await fetchApi<any[]>(`/orders?userId=${user.id}`);
      if (data.success && data.data) {
        // Transform API orders to CustomerOrder format
        const apiOrders: CustomerOrder[] = data.data.map((order: any) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          items: (order.items || []).map((item: any) => ({
            id: item.id,
            productId: item.productId,
            name: item.productName,
            nameAr: item.productNameAr,
            quantity: item.quantity,
            price: item.unitPrice,
            image: item.image,
            notes: item.notes,
          })),
          subtotal: order.subtotal,
          vat: order.vatAmount,
          deliveryFee: order.deliveryFee,
          discount: order.discount,
          total: order.total,
          status: order.status === "ready_for_pickup" ? "processing" : order.status,
          paymentStatus: order.paymentStatus === "captured" ? "paid" : order.paymentStatus,
          paymentMethod: order.paymentMethod,
          deliveryAddress: order.deliveryAddress ? {
            fullName: order.customerName || order.deliveryAddress.label,
            mobile: order.customerMobile || order.deliveryAddress.phone,
            emirate: order.deliveryAddress.emirate || order.deliveryAddress.city,
            area: order.deliveryAddress.city,
            street: order.deliveryAddress.street,
            building: order.deliveryAddress.building || "",
            floor: order.deliveryAddress.floor || "",
            apartment: order.deliveryAddress.apartment || "",
          } : {
            fullName: order.customerName || "",
            mobile: order.customerMobile || "",
            emirate: "",
            area: "",
            street: "",
            building: "",
          },
          deliveryTimeSlot: order.deliveryTimeSlot,
          estimatedDelivery: order.estimatedDeliveryAt,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        }));

        // Set orders from API (database is source of truth)
        setOrders(apiOrders);
        // Cache in localStorage
        localStorage.setItem(`customer_orders_${user.id}`, JSON.stringify(apiOrders));
      } else {
        // API error or no success - try localStorage cache
        const saved = localStorage.getItem(`customer_orders_${user.id}`);
        if (saved) {
          try {
            setOrders(JSON.parse(saved));
          } catch {
            setOrders([]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch orders from API:", error);
      // Try localStorage cache as fallback
      const saved = localStorage.getItem(`customer_orders_${user.id}`);
      if (saved) {
        try {
          setOrders(JSON.parse(saved));
        } catch {
          setOrders([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Initial load - fetch from API
  useEffect(() => {
    if (user?.id) {
      // Try localStorage cache first for instant display
      const saved = localStorage.getItem(`customer_orders_${user.id}`);
      if (saved) {
        try {
          setOrders(JSON.parse(saved));
        } catch {
          // Ignore parse errors
        }
      }
      // Then fetch from API to get latest data
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [user?.id, fetchOrders]);

  // Refresh orders when page becomes visible or window gains focus
  // This allows updates from admin/driver to be reflected when customer checks their orders
  useEffect(() => {
    if (!user?.id) return;

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };

    // Refresh when window gains focus
    const handleFocus = () => {
      fetchOrders();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, fetchOrders]);

  // Save to localStorage
  useEffect(() => {
    if (user?.id && orders.length > 0) {
      localStorage.setItem(`customer_orders_${user.id}`, JSON.stringify(orders));
    }
  }, [orders, user?.id]);

  const getOrderById = useCallback((orderId: string): CustomerOrder | undefined => {
    return orders.find((o) => o.id === orderId);
  }, [orders]);

  const addOrder = useCallback((order: CustomerOrder) => {
    setOrders((prev) => [order, ...prev]);
  }, []);

  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !["pending", "confirmed"].includes(order.status)) {
      return false;
    }

    try {
      // Call API to cancel order
      const response = await fetchApi(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (response.success) {
        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: "cancelled", updatedAt: new Date().toISOString() }
              : o
          )
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to cancel order:", error);
      return false;
    }
  }, [orders]);

  const reorderItems = useCallback((orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // This would integrate with BasketContext to add items
    // For now, just return the items that could be reordered
    console.log("Reorder items from order:", orderId, order.items);
  }, [orders]);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        isLoading,
        fetchOrders,
        getOrderById,
        addOrder,
        cancelOrder,
        reorderItems,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider");
  }
  return context;
};
