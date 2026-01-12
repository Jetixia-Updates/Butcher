import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

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

// Demo orders
const INITIAL_ORDERS: CustomerOrder[] = [
  {
    id: "order_demo_1",
    orderNumber: "ORD-2026-0001",
    items: [
      {
        id: "item_1",
        productId: "prod_1",
        name: "Premium Beef Steak",
        nameAr: "ستيك لحم بقري ممتاز",
        quantity: 1,
        price: 89.99,
        notes: "Boneless | Curry Cut",
      },
      {
        id: "item_2",
        productId: "prod_3",
        name: "Chicken Breast",
        nameAr: "صدر دجاج",
        quantity: 2,
        price: 34.99,
      },
    ],
    subtotal: 159.97,
    vat: 8.0,
    deliveryFee: 15,
    discount: 0,
    total: 182.97,
    status: "delivered",
    paymentStatus: "paid",
    paymentMethod: "card",
    deliveryAddress: {
      fullName: "Mohamed Ali",
      mobile: "+971501234567",
      emirate: "Dubai",
      area: "Downtown",
      street: "Sheikh Mohammed Bin Rashid Blvd",
      building: "Burj Vista",
      floor: "25",
      apartment: "2501",
    },
    estimatedDelivery: "2025-12-20T14:00:00Z",
    createdAt: "2025-12-19T10:30:00Z",
    updatedAt: "2025-12-20T14:15:00Z",
  },
  {
    id: "order_demo_2",
    orderNumber: "ORD-2026-0002",
    items: [
      {
        id: "item_3",
        productId: "prod_2",
        name: "Lamb Chops",
        nameAr: "ريش لحم ضأن",
        quantity: 1.5,
        price: 74.5,
        notes: "Bone | Whole",
      },
    ],
    subtotal: 111.75,
    vat: 5.59,
    deliveryFee: 0,
    discount: 10,
    total: 107.34,
    status: "out_for_delivery",
    paymentStatus: "paid",
    paymentMethod: "cod",
    deliveryAddress: {
      fullName: "Mohamed Ali",
      mobile: "+971501234567",
      emirate: "Abu Dhabi",
      area: "Corniche",
      street: "Corniche Road",
      building: "Marina Tower",
      floor: "10",
    },
    deliveryTimeSlot: "2:00 PM - 4:00 PM",
    estimatedDelivery: "2026-01-12T14:00:00Z",
    createdAt: "2026-01-10T08:00:00Z",
    updatedAt: "2026-01-10T10:00:00Z",
  },
  {
    id: "order_demo_3",
    orderNumber: "ORD-2026-0003",
    items: [
      {
        id: "item_4",
        productId: "prod_6",
        name: "Goat Leg",
        nameAr: "فخذ ماعز",
        quantity: 1,
        price: 125.0,
        notes: "Whole",
      },
      {
        id: "item_5",
        productId: "prod_4",
        name: "Ground Beef",
        nameAr: "لحم بقري مفروم",
        quantity: 0.5,
        price: 45.0,
      },
    ],
    subtotal: 147.5,
    vat: 7.38,
    deliveryFee: 15,
    discount: 0,
    total: 169.88,
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "card",
    deliveryAddress: {
      fullName: "Mohamed Ali",
      mobile: "+971501234567",
      emirate: "Dubai",
      area: "Marina",
      street: "Marina Walk",
      building: "Trident Grand",
      floor: "15",
      apartment: "1502",
    },
    deliveryTimeSlot: "10:00 AM - 12:00 PM",
    estimatedDelivery: "2026-01-15T11:00:00Z",
    createdAt: "2026-01-14T09:00:00Z",
    updatedAt: "2026-01-14T09:30:00Z",
  },
];

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load orders from localStorage on mount
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`customer_orders_${user.id}`);
      if (saved) {
        try {
          setOrders(JSON.parse(saved));
        } catch {
          setOrders(INITIAL_ORDERS);
        }
      } else {
        // Load demo orders for first time
        setOrders(INITIAL_ORDERS);
      }
      // Also fetch from API to get latest updates
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [user?.id]);

  // Poll for order updates every 30 seconds
  useEffect(() => {
    if (!user?.id) return;
    
    const interval = setInterval(() => {
      fetchOrders();
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, [user?.id, fetchOrders]);

  // Save to localStorage
  useEffect(() => {
    if (user?.id && orders.length > 0) {
      localStorage.setItem(`customer_orders_${user.id}`, JSON.stringify(orders));
    }
  }, [orders, user?.id]);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch orders from API
      const response = await fetch(`/api/orders?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Transform API orders to CustomerOrder format
          const apiOrders: CustomerOrder[] = data.data.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            items: order.items.map((item: any) => ({
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
          
          // Merge with localStorage orders (for demo purposes)
          const localOrders = orders.filter(o => !apiOrders.find(ao => ao.id === o.id));
          const mergedOrders = [...apiOrders, ...localOrders];
          setOrders(mergedOrders);
        }
      }
    } catch (error) {
      console.error("Failed to fetch orders from API:", error);
      // Keep using localStorage orders as fallback
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, orders]);

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

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: "cancelled", updatedAt: new Date().toISOString() }
          : o
      )
    );
    return true;
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
