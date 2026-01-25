/**
 * Order Management Routes
 * Full CRUD operations for orders with status management using PostgreSQL
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { Order, OrderItem, ApiResponse, PaginatedResponse } from "../../shared/api";
import { db, orders, orderItems, products, users, addresses, discountCodes, deliveryZones, stock, payments, inAppNotifications } from "../db/connection";
import { getInAppNotificationContent } from "../services/notifications";

const router = Router();

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

let orderCounter = 1000;
const generateOrderNumber = () => `ORD-${String(++orderCounter).padStart(6, "0")}`;

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



// Helper to create invoice notification when order is confirmed
async function createInvoiceNotificationForConfirmedOrder(order: typeof orders.$inferSelect, items: (typeof orderItems.$inferSelect)[]): Promise<void> {
  if (!order.customerId && !order.userId) {
    console.log(`[Invoice Notification] Skipped - no customerId or userId`);
    return;
  }

  try {
    const customerId = order.customerId || order.userId;
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${order.orderNumber.replace('ORD-', '')}`;
    const shopTRN = "100567890123456"; // UAE TRN format

    // Format items
    const itemsList = items.map(item =>
      `• ${item.productName} × ${item.quantity}\n  AED ${Number(item.totalPrice).toFixed(2)}`
    ).join('\n');

    // Create invoice text - ENGLISH
    const invoiceText = `
════════════════════════════════════════
         🥩 BUTCHER
════════════════════════════════════════
TRN: ${shopTRN}
📄 TAX Invoice #${invoiceNumber}
════════════════════════════════════════
Order No: ${order.orderNumber}
Date: ${new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
────────────────────────────────────────
BILL TO:
Customer: ${order.customerName}
Mobile: ${order.customerMobile}
Address: ${order.deliveryAddress ? `${(order.deliveryAddress as any).building || ''}, ${(order.deliveryAddress as any).street || ''}, ${(order.deliveryAddress as any).area || ''}, ${(order.deliveryAddress as any).emirate || ''}` : 'N/A'}
────────────────────────────────────────
ITEMS:
${itemsList}
────────────────────────────────────────
Subtotal:           AED ${Number(order.subtotal).toFixed(2)}
${Number(order.discount) > 0 ? `Discount (-):        AED ${Number(order.discount).toFixed(2)}` : ''}
VAT (5%):           AED ${Number(order.vatAmount).toFixed(2)}
Delivery Fee:       AED ${Number(order.deliveryFee).toFixed(2)}
════════════════════════════════════════
TOTAL:              AED ${Number(order.total).toFixed(2)}
════════════════════════════════════════
Payment Method: ${order.paymentMethod === 'card' ? 'Credit Card' : order.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Cash on Delivery'}

Thank you for your purchase!
════════════════════════════════════════`;

    // Create invoice text - ARABIC
    const invoiceTextAr = `
════════════════════════════════════════
         🥩 جزاري
════════════════════════════════════════
الرقم الضريبي: ${shopTRN}
📄 فاتورة ضريبية #${invoiceNumber}
════════════════════════════════════════
رقم الطلب: ${order.orderNumber}
التاريخ: ${new Date().toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
────────────────────────────────────────
الفاتورة إلى:
العميل: ${order.customerName}
الهاتف: ${order.customerMobile}
العنوان: ${order.deliveryAddress ? `${(order.deliveryAddress as any).building || ''}, ${(order.deliveryAddress as any).street || ''}, ${(order.deliveryAddress as any).area || ''}, ${(order.deliveryAddress as any).emirate || ''}` : 'N/A'}
────────────────────────────────────────
المنتجات:
${itemsList}
────────────────────────────────────────
الإجمالي الجزئي:        ${Number(order.subtotal).toFixed(2)} د.إ
${Number(order.discount) > 0 ? `الخصم (-):             ${Number(order.discount).toFixed(2)} د.إ` : ''}
الضريبة (5%):          ${Number(order.vatAmount).toFixed(2)} د.إ
رسوم التوصيل:          ${Number(order.deliveryFee).toFixed(2)} د.إ
════════════════════════════════════════
الإجمالي:              ${Number(order.total).toFixed(2)} د.إ
════════════════════════════════════════
طريقة الدفع: ${order.paymentMethod === 'card' ? 'بطاقة ائتمان' : order.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'الدفع عند الاستلام'}

شكراً لتسوقك معنا!
════════════════════════════════════════`;

    await db.insert(inAppNotifications).values({
      id: generateId("notif"),
      customerId: order.customerId || undefined,
      userId: !order.customerId ? order.userId : undefined,
      type: "payment",
      title: `📄 TAX Invoice #${invoiceNumber}`,
      titleAr: `📄 فاتورة ضريبية #${invoiceNumber}`,
      message: invoiceText,
      messageAr: invoiceTextAr,
      link: "/orders",
      linkTab: undefined,
      linkId: order.id,
      unread: true,
    });

    console.log(`[Invoice Notification] ✅ Invoice notification created for customer ${customerId}: Order ${order.orderNumber}, Invoice ${invoiceNumber}`);
  } catch (error) {
    console.error(`[Invoice Notification] ❌ Failed to create invoice notification:`, error);
  }
}

// Helper to create notification for a customer (server-side)
async function createCustomerOrderNotification(customerId: string, orderNumber: string, status: string): Promise<void> {
  const content = getInAppNotificationContent(orderNumber, status);
  if (!content || !customerId) {
    console.log(`[Notification] Skipped - no content or customerId. customerId=${customerId}, status=${status}`);
    return;
  }

  try {
    const newNotification = {
      id: generateId("notif"),
      customerId,
      userId: undefined,
      type: "order",
      title: content.title,
      titleAr: content.titleAr,
      message: content.message,
      messageAr: content.messageAr,
      link: "/orders",
      linkTab: undefined,
      linkId: undefined,
      unread: true,
    };

    await db.insert(inAppNotifications).values(newNotification);
    console.log(`[Notification] ✅ Created order notification for customer ${customerId}: ${status} (Order: ${orderNumber})`);
  } catch (error) {
    console.error(`[Notification] ❌ Failed to create notification for customer ${customerId}:`, error);
  }
}

// Helper to convert DB order to API order
function toApiOrder(dbOrder: typeof orders.$inferSelect, items: OrderItem[]): Order {
  return {
    id: dbOrder.id,
    orderNumber: dbOrder.orderNumber,
    userId: dbOrder.userId,
    customerName: dbOrder.customerName,
    customerEmail: dbOrder.customerEmail,
    customerMobile: dbOrder.customerMobile,
    items,
    subtotal: parseFloat(dbOrder.subtotal),
    discount: parseFloat(dbOrder.discount),
    discountCode: dbOrder.discountCode || undefined,
    deliveryFee: parseFloat(dbOrder.deliveryFee),
    vatAmount: parseFloat(dbOrder.vatAmount),
    vatRate: parseFloat(dbOrder.vatRate),
    total: parseFloat(dbOrder.total),
    status: dbOrder.status,
    paymentStatus: dbOrder.paymentStatus,
    paymentMethod: dbOrder.paymentMethod,
    addressId: dbOrder.addressId,
    deliveryAddress: dbOrder.deliveryAddress as Order["deliveryAddress"],
    deliveryNotes: dbOrder.deliveryNotes || undefined,
    deliveryZoneId: dbOrder.deliveryZoneId || undefined,
    estimatedDeliveryAt: dbOrder.estimatedDeliveryAt?.toISOString(),
    actualDeliveryAt: dbOrder.actualDeliveryAt?.toISOString(),
    statusHistory: (dbOrder.statusHistory as Order["statusHistory"]) || [],
    source: dbOrder.source as Order["source"],
    ipAddress: dbOrder.ipAddress || undefined,
    userAgent: dbOrder.userAgent || undefined,
    createdAt: dbOrder.createdAt.toISOString(),
    updatedAt: dbOrder.updatedAt.toISOString(),
  };
}

// GET /api/orders - Get all orders
const getOrders: RequestHandler = async (req, res) => {
  try {
    const { userId, status, page = "1", limit = "20", startDate, endDate } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let ordersResult = await db.select().from(orders).orderBy(desc(orders.createdAt));

    // Filter by user if specified
    if (userId) {
      ordersResult = ordersResult.filter((o) => o.userId === userId);
    }

    // Filter by status
    if (status) {
      ordersResult = ordersResult.filter((o) => o.status === status);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate as string);
      ordersResult = ordersResult.filter((o) => new Date(o.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      ordersResult = ordersResult.filter((o) => new Date(o.createdAt) <= end);
    }

    // Get items for each order
    const allItems = await db.select().from(orderItems);
    const itemsByOrderId = new Map<string, OrderItem[]>();
    allItems.forEach(item => {
      const items = itemsByOrderId.get(item.orderId) || [];
      items.push({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productNameAr: item.productNameAr || undefined,
        sku: item.sku,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        totalPrice: parseFloat(item.totalPrice),
        notes: item.notes || undefined,
      });
      itemsByOrderId.set(item.orderId, items);
    });

    // Pagination
    const total = ordersResult.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedOrders = ordersResult.slice(startIndex, startIndex + limitNum);

    const apiOrders = paginatedOrders.map(o => toApiOrder(o, itemsByOrderId.get(o.id) || []));

    const response: PaginatedResponse<Order> = {
      success: true,
      data: apiOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching orders:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch orders",
    };
    res.status(500).json(response);
  }
};

// GET /api/orders/:id - Get order by ID
const getOrderById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await db.select().from(orders).where(eq(orders.id, id));

    if (orderResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const itemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const items: OrderItem[] = itemsResult.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productNameAr: item.productNameAr || undefined,
      sku: item.sku,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      notes: item.notes || undefined,
    }));

    const response: ApiResponse<Order> = {
      success: true,
      data: toApiOrder(orderResult[0], items),
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching order:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch order",
    };
    res.status(500).json(response);
  }
};

// GET /api/orders/number/:orderNumber - Get order by order number
const getOrderByNumber: RequestHandler = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const orderResult = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));

    if (orderResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const itemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, orderResult[0].id));
    const items: OrderItem[] = itemsResult.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productNameAr: item.productNameAr || undefined,
      sku: item.sku,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      notes: item.notes || undefined,
    }));

    const response: ApiResponse<Order> = {
      success: true,
      data: toApiOrder(orderResult[0], items),
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching order:", error);
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

    const { userId, items, addressId, paymentMethod, deliveryNotes, discountCode: discountCodeStr, deliveryAddress, expressDeliveryFee, driverTip } = validation.data;

    // Get customer (orders are for customers, not staff users)
    let customerResult = await db.select().from(users).where(eq(users.id, userId));
    let customer = customerResult[0];

    if (!customer && deliveryAddress) {
      // Create a minimal customer for guest checkout
      const newCustomer = {
        id: userId,
        email: `guest-${userId}@temp.local`,
        username: `guest_${Date.now()}`,
        password: '',
        mobile: deliveryAddress.phone || '',
        firstName: deliveryAddress.label?.split(' ')[0] || 'Guest',
        familyName: deliveryAddress.label?.split(' ').slice(1).join(' ') || 'Customer',
        emirate: deliveryAddress.emirate || 'Dubai',
        isActive: true,
        isVerified: false,
        role: 'customer' as const,
        preferences: {
          language: 'en' as const,
          currency: 'AED' as const,
          emailNotifications: false,
          smsNotifications: false,
          marketingEmails: false,
        },
      };
      await db.insert(users).values(newCustomer);
      customerResult = await db.select().from(users).where(eq(users.id, userId));
      customer = customerResult[0];
    }

    if (!customer) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    // Get address
    let addressResult = await db.select().from(addresses).where(eq(addresses.id, addressId));
    let address = addressResult[0];

    if (!address && deliveryAddress) {
      // Create address from the provided delivery address data
      const newAddress = {
        id: addressId || generateId("addr"),
        userId: userId,
        label: deliveryAddress.label || 'Delivery Address',
        fullName: deliveryAddress.label || 'Customer',
        mobile: deliveryAddress.phone || '',
        street: deliveryAddress.street || '',
        building: deliveryAddress.building || '',
        apartment: deliveryAddress.apartment || '',
        area: deliveryAddress.city || '',
        emirate: deliveryAddress.emirate || 'Dubai',
        latitude: deliveryAddress.location?.lat,
        longitude: deliveryAddress.location?.lng,
        isDefault: deliveryAddress.isDefault || true,
      };
      await db.insert(addresses).values(newAddress);
      addressResult = await db.select().from(addresses).where(eq(addresses.id, newAddress.id));
      address = addressResult[0];
    }

    if (!address) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    // Build order items and calculate totals
    const orderItemsData: { id: string; productId: string; productName: string; productNameAr?: string; sku: string; quantity: string; unitPrice: string; totalPrice: string; notes?: string; }[] = [];
    let subtotal = 0;

    const allProducts = await db.select().from(products);
    const productsMap = new Map(allProducts.map(p => [p.id, p]));

    for (const item of items) {
      const product = productsMap.get(item.productId);
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

      // Calculate discounted price if product has a discount
      const basePrice = parseFloat(product.price);
      const discountPercent = product.discount ? parseFloat(product.discount) : 0;
      const unitPrice = discountPercent > 0
        ? Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100
        : basePrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItemsData.push({
        id: generateId("item"),
        productId: product.id,
        productName: product.name,
        productNameAr: product.nameAr || undefined,
        sku: product.sku,
        quantity: String(item.quantity),
        unitPrice: String(unitPrice),
        totalPrice: String(Math.round(totalPrice * 100) / 100),
        notes: item.notes,
      });
    }

    // Calculate discount
    let discount = 0;
    if (discountCodeStr) {
      const codes = await db.select().from(discountCodes);
      const code = codes.find(c => c.code.toUpperCase() === discountCodeStr.toUpperCase() && c.isActive);
      if (code && subtotal >= parseFloat(code.minimumOrder)) {
        if (code.type === "percentage") {
          discount = subtotal * (parseFloat(code.value) / 100);
          if (code.maximumDiscount) {
            discount = Math.min(discount, parseFloat(code.maximumDiscount));
          }
        } else {
          discount = parseFloat(code.value);
        }
        // Increment usage
        await db.update(discountCodes).set({ usageCount: code.usageCount + 1 }).where(eq(discountCodes.id, code.id));
      }
    }

    // Get delivery zone and fee
    // Express delivery replaces zone fee (not added to it)
    const zones = await db.select().from(deliveryZones);
    const zone = zones.find(z => z.emirate === address.emirate && z.isActive);
    const baseDeliveryFee = zone ? parseFloat(zone.deliveryFee) : 0;
    const deliveryFee = (expressDeliveryFee && expressDeliveryFee > 0) ? expressDeliveryFee : baseDeliveryFee;
    const tipAmount = driverTip || 0;

    // Calculate VAT
    const vatRate = 0.05;
    const vatAmount = (subtotal - discount) * vatRate;
    const total = subtotal - discount + vatAmount + deliveryFee + tipAmount;

    // Create order
    const orderId = generateId("order");
    const orderNumber = generateOrderNumber();

    const deliveryAddressData = {
      id: address.id,
      customerId: address.customerId || undefined,
      userId: address.userId || undefined,
      label: address.label,
      fullName: address.fullName,
      mobile: address.mobile,
      emirate: address.emirate,
      area: address.area,
      street: address.street,
      building: address.building,
      floor: address.floor || undefined,
      apartment: address.apartment || undefined,
      landmark: address.landmark || undefined,
      latitude: address.latitude || undefined,
      longitude: address.longitude || undefined,
      isDefault: address.isDefault,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    };

    const newOrder = {
      id: orderId,
      orderNumber,
      customerId: userId,
      customerName: `${customer.firstName} ${customer.familyName}`,
      customerEmail: customer.email,
      customerMobile: customer.mobile,
      subtotal: String(Math.round(subtotal * 100) / 100),
      discount: String(Math.round(discount * 100) / 100),
      discountCode: discountCodeStr || null,
      deliveryFee: String(deliveryFee),
      vatAmount: String(Math.round(vatAmount * 100) / 100),
      vatRate: String(vatRate),
      total: String(Math.round(total * 100) / 100),
      status: "pending" as const,
      paymentStatus: "pending" as const,
      paymentMethod,
      addressId,
      deliveryAddress: deliveryAddressData,
      deliveryNotes: deliveryNotes || null,
      deliveryZoneId: zone?.id || null,
      estimatedDeliveryAt: zone ? new Date(Date.now() + zone.estimatedMinutes * 60 * 1000) : null,
      statusHistory: [
        {
          status: "pending",
          changedBy: "system",
          changedAt: new Date().toISOString(),
        },
      ],
      source: "web",
    };

    await db.insert(orders).values(newOrder);

    // Insert order items
    for (const item of orderItemsData) {
      await db.insert(orderItems).values({
        ...item,
        orderId,
      });
    }

    // Get the created order
    const createdOrderResult = await db.select().from(orders).where(eq(orders.id, orderId));
    const createdItemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    const apiItems: OrderItem[] = createdItemsResult.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productNameAr: item.productNameAr || undefined,
      sku: item.sku,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      notes: item.notes || undefined,
    }));

    // === SERVER-SIDE NOTIFICATIONS ===
    // Create notification for customer (order placed)
    try {
      const customerNotification = {
        id: generateId("notif"),
        customerId: userId,
        userId: undefined,
        type: "order",
        title: "Order Placed Successfully",
        titleAr: "تم تقديم الطلب بنجاح",
        message: `Your order ${orderNumber} has been placed and is being processed`,
        messageAr: `تم تقديم طلبك ${orderNumber} وجاري معالجته`,
        link: `/orders`,
        linkTab: undefined,
        linkId: orderId,
        unread: true,
      };
      await db.insert(inAppNotifications).values(customerNotification);
      console.log(`[Order Notification] ✅ Customer notification created for order ${orderNumber} (customerId: ${userId})`);
    } catch (notifError) {
      console.error(`[Order Notification] ❌ Failed to create customer notification:`, notifError);
    }

    // === UPDATE CUSTOMER STATS ===
    try {
      // Simple last login/order timestamp update for user tracking
      await db.update(users)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      console.log(`[Order] ✅ Updated user record for order ${orderNumber}`);
    } catch (customerError) {
      console.error(`[Order] ❌ Failed to update user stats:`, customerError);
    }
    // === END CUSTOMER STATS ===

    // Create notification for admin (new order received)
    try {
      const adminNotification = {
        id: generateId("notif"),
        userId: "admin", // Admin user constant
        type: "order_placed",
        title: "New Order Received",
        titleAr: "تم استلام طلب جديد",
        message: `New order ${orderNumber} from ${customer.firstName} ${customer.familyName} - Total: ${total.toFixed(2)} AED`,
        messageAr: `طلب جديد ${orderNumber} من ${customer.firstName} ${customer.familyName} - المجموع: ${total.toFixed(2)} درهم`,
        link: `/admin/dashboard`,
        linkTab: "orders",
        linkId: orderId,
        unread: true,
        createdAt: new Date(),
      };
      await db.insert(inAppNotifications).values(adminNotification);
      console.log(`[Order Notification] ✅ Admin notification created for order ${orderNumber}`);
    } catch (notifError) {
      console.error(`[Order Notification] Failed to create admin notification:`, notifError);
    }
    // === END SERVER-SIDE NOTIFICATIONS ===

    const response: ApiResponse<Order> = {
      success: true,
      data: toApiOrder(createdOrderResult[0], apiItems),
      message: "Order created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating order:", error);
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

    console.log(`[UpdateStatus] Received request for order ${id}. Payload:`, req.body);

    const validation = updateStatusSchema.safeParse(req.body);
    if (!validation.success) {
      console.error(`[UpdateStatus] Validation failed for order ${id}:`, validation.error.errors);
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { status, notes } = validation.data;
    console.log(`[UpdateStatus] Validated: status=${status}, notes=${notes}, by=${changedBy}`);

    const orderResult = await db.select().from(orders).where(eq(orders.id, id));

    if (orderResult.length === 0) {
      console.error(`[UpdateStatus] Order ${id} not found`);
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const order = orderResult[0];
    // Robustly handle statusHistory initialization
    let statusHistory = (order.statusHistory as Order["statusHistory"]) || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }

    statusHistory.push({
      status,
      changedBy,
      changedAt: new Date().toISOString(),
      notes,
    });

    const updateData: Partial<typeof orders.$inferInsert> = {
      status,
      statusHistory,
      updatedAt: new Date(),
    };

    // Handle status-specific logic
    if (status === "delivered") {
      updateData.actualDeliveryAt = new Date();
      updateData.paymentStatus = "captured";
    }

    console.log(`[UpdateStatus] Executing DB update for order ${id}...`);
    try {
      await db.update(orders).set(updateData).where(eq(orders.id, id));
    } catch (dbError) {
      console.error(`[UpdateStatus] DB Update Failed for order ${id}:`, dbError);
      throw new Error(`Database update failed: ${(dbError as Error).message}`);
    }

    console.log(`[UpdateStatus] Database updated successfully for order ${id}`);

    const updatedOrderResult = await db.select().from(orders).where(eq(orders.id, id));
    const itemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

    const items: OrderItem[] = itemsResult.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productNameAr: item.productNameAr || undefined,
      sku: item.sku,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      notes: item.notes || undefined,
    }));

    // Create notification for customer (server-side to ensure it's always created)
    // Orders can be for customers (customerId) or staff (userId) - check both
    try {
      if (order.customerId) {
        console.log(`[UpdateStatus] Creating notification for customer ${order.customerId}, order ${order.orderNumber}, status ${status}`);
        await createCustomerOrderNotification(order.customerId, order.orderNumber, status);

        // When order is confirmed, also send invoice notification
        if (status === "confirmed") {
          console.log(`[UpdateStatus] Creating invoice notification for confirmed order ${order.orderNumber}`);
          await createInvoiceNotificationForConfirmedOrder(order, itemsResult);
        }
      } else if (order.userId) {
        // For staff/internal orders, create notification with userId
        console.log(`[UpdateStatus] Creating notification for userId ${order.userId}, order ${order.orderNumber}, status ${status}`);
        try {
          const content = getInAppNotificationContent(order.orderNumber, status);
          if (content) {
            await db.insert(inAppNotifications).values({
              id: generateId("notif"),
              userId: order.userId,
              customerId: undefined,
              type: "order",
              title: content.title,
              titleAr: content.titleAr,
              message: content.message,
              messageAr: content.messageAr,
              link: "/orders",
              linkTab: undefined,
              linkId: undefined,
              unread: true,
            });
            console.log(`[UpdateStatus] ✅ Created notification for user ${order.userId}: ${status}`);
          }

          // For staff orders, also send invoice if confirmed
          if (status === "confirmed") {
            await createInvoiceNotificationForConfirmedOrder(order, itemsResult);
          }
        } catch (err) {
          console.error(`[UpdateStatus] Failed to create user notification:`, err);
        }
      } else {
        console.warn(`[UpdateStatus] No customerId or userId found for order ${id}`);
      }
    } catch (notifWarn) {
      console.warn(`[UpdateStatus] Notification creation failed but order updated (non-critical):`, notifWarn);
    }

    const response: ApiResponse<Order> = {
      success: true,
      data: toApiOrder(updatedOrderResult[0], items),
      message: `Order status updated to ${status}`,
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating order status:", error);
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

    const orderResult = await db.select().from(orders).where(eq(orders.id, id));

    if (orderResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const order = orderResult[0];

    // Check if order can be cancelled
    if (["delivered", "cancelled", "refunded"].includes(order.status)) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Cannot cancel order with status: ${order.status}`,
      };
      return res.status(400).json(response);
    }

    const statusHistory = (order.statusHistory as Order["statusHistory"]) || [];
    statusHistory.push({
      status: "cancelled",
      changedBy: cancelledBy,
      changedAt: new Date().toISOString(),
      notes: reason,
    });

    await db.update(orders).set({
      status: "cancelled",
      statusHistory,
      updatedAt: new Date(),
    }).where(eq(orders.id, id));

    const updatedOrderResult = await db.select().from(orders).where(eq(orders.id, id));
    const itemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

    const items: OrderItem[] = itemsResult.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productNameAr: item.productNameAr || undefined,
      sku: item.sku,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      notes: item.notes || undefined,
    }));

    const response: ApiResponse<Order> = {
      success: true,
      data: toApiOrder(updatedOrderResult[0], items),
      message: "Order cancelled successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error cancelling order:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel order",
    };
    res.status(500).json(response);
  }
};

// GET /api/orders/stats - Get order statistics
const getOrderStats: RequestHandler = async (req, res) => {
  try {
    const allOrders = await db.select().from(orders);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: allOrders.length,
      pending: allOrders.filter((o) => o.status === "pending").length,
      confirmed: allOrders.filter((o) => o.status === "confirmed").length,
      processing: allOrders.filter((o) => o.status === "processing").length,
      outForDelivery: allOrders.filter((o) => o.status === "out_for_delivery").length,
      delivered: allOrders.filter((o) => o.status === "delivered").length,
      cancelled: allOrders.filter((o) => o.status === "cancelled").length,
      todayOrders: allOrders.filter((o) => new Date(o.createdAt) >= today).length,
      weekOrders: allOrders.filter((o) => new Date(o.createdAt) >= weekAgo).length,
      monthOrders: allOrders.filter((o) => new Date(o.createdAt) >= monthAgo).length,
      todaySales: allOrders
        .filter((o) => new Date(o.createdAt) >= today && o.status !== "cancelled")
        .reduce((sum, o) => sum + parseFloat(o.total), 0),
      weekSales: allOrders
        .filter((o) => new Date(o.createdAt) >= weekAgo && o.status !== "cancelled")
        .reduce((sum, o) => sum + parseFloat(o.total), 0),
      monthSales: allOrders
        .filter((o) => new Date(o.createdAt) >= monthAgo && o.status !== "cancelled")
        .reduce((sum, o) => sum + parseFloat(o.total), 0),
      averageOrderValue: allOrders.length > 0
        ? allOrders.reduce((sum, o) => sum + parseFloat(o.total), 0) / allOrders.length
        : 0,
    };

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting order stats:", error);
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

    const orderResult = await db.select().from(orders).where(eq(orders.id, id));

    if (orderResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const order = orderResult[0];

    // Validate payment status
    const validStatuses = ["pending", "authorized", "captured", "failed", "refunded", "partially_refunded"];
    if (!validStatuses.includes(status)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid payment status",
      };
      return res.status(400).json(response);
    }

    const now = new Date();

    await db.update(orders).set({
      paymentStatus: status,
      updatedAt: now,
    }).where(eq(orders.id, id));

    // If payment is captured, update/create payment record
    if (status === "captured") {
      const existingPayment = await db.select().from(payments).where(eq(payments.orderId, id));

      if (existingPayment.length > 0) {
        // Update existing payment
        await db.update(payments).set({
          status: "captured",
          updatedAt: now,
        }).where(eq(payments.orderId, id));
      } else {
        // Create new payment record for COD
        const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(payments).values({
          id: paymentId,
          orderId: id,
          orderNumber: order.orderNumber,
          amount: order.total,
          currency: "AED",
          method: (order.paymentMethod as "card" | "cod" | "bank_transfer") || "cod",
          status: "captured",
          createdAt: now,
          updatedAt: now,
        });
      }

      console.log(`[Payment Confirmed] Order ${order.orderNumber} payment marked as captured`);
    }

    const updatedOrderResult = await db.select().from(orders).where(eq(orders.id, id));
    const itemsResult = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

    const items: OrderItem[] = itemsResult.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productNameAr: item.productNameAr || undefined,
      sku: item.sku,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      notes: item.notes || undefined,
    }));

    const response: ApiResponse<Order> = {
      success: true,
      data: toApiOrder(updatedOrderResult[0], items),
      message: `Payment status updated to ${status}`,
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating payment status:", error);
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
