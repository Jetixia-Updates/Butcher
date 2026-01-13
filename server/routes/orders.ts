/**
 * Order Management Routes
 * Full CRUD operations for orders with status management and notifications
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import type { Order, OrderItem, CreateOrderRequest, UpdateOrderStatusRequest, ApiResponse, PaginatedResponse } from "@shared/api";
import { db, generateId, generateOrderNumber } from "../db";
import { sendOrderNotification } from "../services/notifications";
import { reduceStockForOrder, releaseStockForOrder } from "./stock";

const router = Router();

// Validation schemas
const createOrderSchema = z.object({
  userId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    notes: z.string().optional(),
  })).min(1),
  addressId: z.string(),
  paymentMethod: z.enum(["card", "cod", "bank_transfer"]),
  deliveryNotes: z.string().optional(),
  discountCode: z.string().optional(),
  expressDeliveryFee: z.number().min(0).optional(),
  driverTip: z.number().min(0).optional(),
  // Fallback delivery address for when user/address not in server memory
  deliveryAddress: z.object({
    id: z.string().optional(),
    userId: z.string().optional(),
    label: z.string(),
    street: z.string(),
    building: z.string().optional(),
    apartment: z.string().optional(),
    city: z.string(),
    emirate: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    phone: z.string(),
    isDefault: z.boolean().optional(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
  }).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled", "refunded"]),
  notes: z.string().optional(),
});

// GET /api/orders - Get all orders (admin) or user orders
const getOrders: RequestHandler = (req, res) => {
  try {
    const { userId, status, page = "1", limit = "20", startDate, endDate } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let orders = Array.from(db.orders.values());

    // Filter by user if specified
    if (userId) {
      orders = orders.filter((o) => o.userId === userId);
    }

    // Filter by status
    if (status) {
      orders = orders.filter((o) => o.status === status);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate as string);
      orders = orders.filter((o) => new Date(o.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      orders = orders.filter((o) => new Date(o.createdAt) <= end);
    }

    // Sort by date (newest first)
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const total = orders.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedOrders = orders.slice(startIndex, startIndex + limitNum);

    const response: PaginatedResponse<Order> = {
      success: true,
      data: paginatedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch orders",
    };
    res.status(500).json(response);
  }
};

// GET /api/orders/:id - Get order by ID
const getOrderById: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const order = db.orders.get(id);

    if (!order) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Order> = {
      success: true,
      data: order,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch order",
    };
    res.status(500).json(response);
  }
};

// GET /api/orders/number/:orderNumber - Get order by order number
const getOrderByNumber: RequestHandler = (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = Array.from(db.orders.values()).find((o) => o.orderNumber === orderNumber);

    if (!order) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Order> = {
      success: true,
      data: order,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch order",
    };
    res.status(500).json(response);
  }
};

// POST /api/orders - Create new order
const createOrder: RequestHandler = async (req, res) => {
  try {
    const validation = createOrderSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { userId, items, addressId, paymentMethod, deliveryNotes, discountCode, deliveryAddress, expressDeliveryFee, driverTip } = validation.data;

    // Validate user - create minimal user if not found but deliveryAddress provided
    let user = db.users.get(userId);
    if (!user) {
      if (deliveryAddress) {
        // Create a minimal user object from the delivery address
        user = {
          id: userId,
          email: `user-${userId}@temp.local`,
          username: deliveryAddress.label || 'Customer',
          password: '', // Empty password for temp users
          mobile: deliveryAddress.phone || '',
          firstName: deliveryAddress.label?.split(' ')[0] || 'Customer',
          familyName: deliveryAddress.label?.split(' ').slice(1).join(' ') || '',
          emirate: deliveryAddress.emirate || 'Dubai',
          role: 'customer' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
          isVerified: false,
          preferences: {
            language: 'en' as const,
            currency: 'AED' as const,
            emailNotifications: true,
            smsNotifications: true,
            marketingEmails: false,
          },
        };
        db.users.set(userId, user);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: "User not found",
        };
        return res.status(404).json(response);
      }
    }

    // Validate address - use deliveryAddress as fallback
    let address = db.addresses.get(addressId);
    if (!address) {
      if (deliveryAddress) {
        // Create address from the provided delivery address data
        address = {
          id: addressId || generateId("addr"),
          userId: userId,
          label: deliveryAddress.label || 'Delivery Address',
          fullName: deliveryAddress.label || 'Customer',
          mobile: deliveryAddress.phone || '',
          street: deliveryAddress.street || '',
          building: deliveryAddress.building || '',
          floor: '',
          apartment: deliveryAddress.apartment || '',
          area: deliveryAddress.city || '',
          emirate: deliveryAddress.emirate || 'Dubai',
          landmark: '',
          latitude: deliveryAddress.location?.lat,
          longitude: deliveryAddress.location?.lng,
          isDefault: deliveryAddress.isDefault || true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.addresses.set(address.id, address);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: "Address not found",
        };
        return res.status(404).json(response);
      }
    }

    // Build order items and calculate totals
    const orderItems: OrderItem[] = [];
    let subtotal = 0;

    for (const item of items) {
      const product = db.products.get(item.productId);
      if (!product) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Product ${item.productId} not found`,
        };
        return res.status(404).json(response);
      }

      if (!product.isActive) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Product ${product.name} is not available`,
        };
        return res.status(400).json(response);
      }

      const totalPrice = product.price * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        id: generateId("item"),
        productId: product.id,
        productName: product.name,
        productNameAr: product.nameAr,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: Math.round(totalPrice * 100) / 100,
        notes: item.notes,
      });
    }

    // Calculate discount
    let discount = 0;
    if (discountCode) {
      const code = Array.from(db.discountCodes.values()).find(
        (c) => c.code.toUpperCase() === discountCode.toUpperCase() && c.isActive
      );
      if (code && subtotal >= code.minimumOrder) {
        if (code.type === "percentage") {
          discount = subtotal * (code.value / 100);
          if (code.maximumDiscount) {
            discount = Math.min(discount, code.maximumDiscount);
          }
        } else {
          discount = code.value;
        }
        // Increment usage
        code.usageCount++;
      }
    }

    // Get delivery zone and fee
    const zone = Array.from(db.deliveryZones.values()).find(
      (z) => z.emirate === address.emirate && z.isActive
    );
    const baseDeliveryFee = zone?.deliveryFee || 0;
    // Include express delivery fee if provided
    const deliveryFee = baseDeliveryFee + (expressDeliveryFee || 0);
    // Driver tip (not included in taxable amount)
    const tipAmount = driverTip || 0;

    // Calculate VAT
    const vatRate = 0.05;
    const vatAmount = (subtotal - discount) * vatRate;
    const total = subtotal - discount + vatAmount + deliveryFee + tipAmount;

    // Create order
    const order: Order = {
      id: generateId("order"),
      orderNumber: generateOrderNumber(),
      userId,
      customerName: `${user.firstName} ${user.familyName}`,
      customerEmail: user.email,
      customerMobile: user.mobile,
      items: orderItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      discountCode,
      deliveryFee,
      vatAmount: Math.round(vatAmount * 100) / 100,
      vatRate,
      total: Math.round(total * 100) / 100,
      status: "pending",
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      paymentMethod,
      addressId,
      deliveryAddress: address,
      deliveryNotes,
      deliveryZoneId: zone?.id,
      estimatedDeliveryAt: new Date(Date.now() + (zone?.estimatedMinutes || 60) * 60 * 1000).toISOString(),
      statusHistory: [
        {
          status: "pending",
          changedBy: "system",
          changedAt: new Date().toISOString(),
        },
      ],
      source: "web",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Reduce stock (reserve inventory)
    const stockResult = reduceStockForOrder(order);
    if (!stockResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: stockResult.error || "Failed to reserve inventory",
      };
      return res.status(400).json(response);
    }

    // Save order
    db.orders.set(order.id, order);

    // Send notifications (async, don't wait)
    sendOrderNotification(order, "order_placed").catch(console.error);

    const response: ApiResponse<Order> = {
      success: true,
      data: order,
      message: "Order created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create order",
    };
    res.status(500).json(response);
  }
};

// PATCH /api/orders/:id/status - Update order status
const updateOrderStatus: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const changedBy = req.headers["x-user-id"] as string || "admin";

    const validation = updateStatusSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { status, notes } = validation.data;
    const order = db.orders.get(id);

    if (!order) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const previousStatus = order.status;

    // Update order
    order.status = status;
    order.updatedAt = new Date().toISOString();
    order.statusHistory.push({
      status,
      changedBy,
      changedAt: new Date().toISOString(),
      notes,
    });

    // Handle status-specific logic
    if (status === "delivered") {
      order.actualDeliveryAt = new Date().toISOString();
      order.paymentStatus = "captured";
    }

    if (status === "cancelled" && previousStatus !== "cancelled") {
      // Release reserved stock
      releaseStockForOrder(order);
    }

    // Send appropriate notification
    const notificationTypeMap: Record<string, string> = {
      confirmed: "order_confirmed",
      processing: "order_processing",
      ready_for_pickup: "order_ready",
      out_for_delivery: "order_shipped",
      delivered: "order_delivered",
      cancelled: "order_cancelled",
    };

    const notificationType = notificationTypeMap[status];
    if (notificationType) {
      sendOrderNotification(order, notificationType as any).catch(console.error);
    }

    const response: ApiResponse<Order> = {
      success: true,
      data: order,
      message: `Order status updated to ${status}`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update order status",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/orders/:id - Cancel order
const cancelOrder: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cancelledBy = req.headers["x-user-id"] as string || "admin";

    const order = db.orders.get(id);

    if (!order) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    // Check if order can be cancelled
    if (["delivered", "cancelled", "refunded"].includes(order.status)) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Cannot cancel order with status: ${order.status}`,
      };
      return res.status(400).json(response);
    }

    // Update order
    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    order.statusHistory.push({
      status: "cancelled",
      changedBy: cancelledBy,
      changedAt: new Date().toISOString(),
      notes: reason,
    });

    // Release reserved stock
    releaseStockForOrder(order);

    // Send notification
    sendOrderNotification(order, "order_cancelled").catch(console.error);

    const response: ApiResponse<Order> = {
      success: true,
      data: order,
      message: "Order cancelled successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel order",
    };
    res.status(500).json(response);
  }
};

// GET /api/orders/stats - Get order statistics
const getOrderStats: RequestHandler = (req, res) => {
  try {
    const orders = Array.from(db.orders.values());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      confirmed: orders.filter((o) => o.status === "confirmed").length,
      processing: orders.filter((o) => o.status === "processing").length,
      outForDelivery: orders.filter((o) => o.status === "out_for_delivery").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
      todayOrders: orders.filter((o) => new Date(o.createdAt) >= today).length,
      weekOrders: orders.filter((o) => new Date(o.createdAt) >= weekAgo).length,
      monthOrders: orders.filter((o) => new Date(o.createdAt) >= monthAgo).length,
      todaySales: orders
        .filter((o) => new Date(o.createdAt) >= today && o.status !== "cancelled")
        .reduce((sum, o) => sum + o.total, 0),
      weekSales: orders
        .filter((o) => new Date(o.createdAt) >= weekAgo && o.status !== "cancelled")
        .reduce((sum, o) => sum + o.total, 0),
      monthSales: orders
        .filter((o) => new Date(o.createdAt) >= monthAgo && o.status !== "cancelled")
        .reduce((sum, o) => sum + o.total, 0),
      averageOrderValue: orders.length > 0
        ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length
        : 0,
    };

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch order stats",
    };
    res.status(500).json(response);
  }
};

// POST /api/orders/:id/payment - Update payment status
const updatePaymentStatus: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = db.orders.get(id);

    if (!order) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    // Validate payment status
    const validStatuses = ["pending", "authorized", "captured", "failed", "refunded", "partially_refunded"];
    if (!validStatuses.includes(status)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid payment status",
      };
      return res.status(400).json(response);
    }

    // Update payment status
    order.paymentStatus = status;
    order.updatedAt = new Date().toISOString();

    const response: ApiResponse<Order> = {
      success: true,
      data: order,
      message: `Payment status updated to ${status}`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update payment status",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getOrders);
router.get("/stats", getOrderStats);
router.get("/:id", getOrderById);
router.get("/number/:orderNumber", getOrderByNumber);
router.post("/", createOrder);
router.patch("/:id/status", updateOrderStatus);
router.post("/:id/payment", updatePaymentStatus);
router.delete("/:id", cancelOrder);

export default router;
