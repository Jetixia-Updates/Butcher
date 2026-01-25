/**
 * Delivery and Address Management Routes
 * Address CRUD, delivery zones, and delivery tracking (PostgreSQL version)
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type {
  Address,
  DeliveryZone,
  DeliveryTracking,
  ApiResponse
} from "../../shared/api";
import { db, addresses, deliveryZones, deliveryTracking, orders, orderItems, users, inAppNotifications } from "../db/connection";
import { sendOrderNotification, getInAppNotificationContent } from "../services/notifications";
import { randomUUID } from "crypto";
// Types are inferred within handlers; explicit DeliveryAvailabilityRequest not exported in shared api.

const router = Router();

// Helper to generate unique ID
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper to create driver assigned notification
// Supports both staff users (userId) and customers (customerId)
async function createDriverAssignedNotification(
  params: { userId?: string | null; customerId?: string | null },
  orderNumber: string,
  driverName: string,
  driverMobile: string
): Promise<void> {
  const { userId, customerId } = params;

  if (!userId && !customerId) {
    console.log(`[Driver Assigned Notification] Skipped - no userId or customerId`);
    return;
  }

  try {
    await db.insert(inAppNotifications).values({
      id: generateId("notif"),
      // Set customerId if available (customer orders), otherwise userId (staff orders)
      customerId: customerId || undefined,
      userId: customerId ? undefined : (userId || undefined),
      type: "driver_assigned",
      title: "Driver Assigned to Your Order",
      titleAr: "تم تعيين سائق لطلبك",
      message: `Driver: ${driverName} | Mobile: ${driverMobile}`,
      messageAr: `السائق: ${driverName} | الهاتف: ${driverMobile}`,
      link: "/orders",
      linkTab: null,
      linkId: null,
      unread: true,
      createdAt: new Date(),
    });
    console.log(`[Driver Assigned Notification] ✅ Created notification for ${customerId ? `customer ${customerId}` : `user ${userId}`}: Driver ${driverName} assigned to order ${orderNumber}`);
  } catch (error) {
    console.error(`[Driver Assigned Notification] ❌ Failed to create notification:`, error);
  }
}

// Helper to create order notification (for delivery status updates)
// Supports both staff users (userId) and customers (customerId)
async function createOrderNotification(
  params: { userId?: string | null; customerId?: string | null },
  orderNumber: string,
  status: string
): Promise<void> {
  const content = getInAppNotificationContent(orderNumber, status);
  const { userId, customerId } = params;

  if (!content || (!userId && !customerId)) {
    console.log(`[Delivery Notification] Skipped - no content or user ID. userId=${userId}, customerId=${customerId}, status=${status}`);
    return;
  }

  try {
    await db.insert(inAppNotifications).values({
      id: generateId("notif"),
      // Set customerId if available (customer orders), otherwise userId (staff orders)
      customerId: customerId || undefined,
      userId: customerId ? undefined : (userId || undefined),
      type: "order",
      title: content.title,
      titleAr: content.titleAr,
      message: content.message,
      messageAr: content.messageAr,
      link: "/orders",
      linkTab: null,
      linkId: null,
      unread: true,
      createdAt: new Date(),
    });
    console.log(`[Delivery Notification] ✅ Created notification for ${customerId ? `customer ${customerId}` : `user ${userId}`}: ${status} (Order: ${orderNumber})`);
  } catch (error) {
    console.error(`[Delivery Notification] ❌ Failed to create notification:`, error);
  }
}

// Helper to create driver notification
async function createDriverNotification(driverId: string, orderNumber: string, customerName: string, address: string): Promise<void> {
  try {
    await db.insert(inAppNotifications).values({
      id: generateId("notif"),
      userId: driverId,
      type: "delivery",
      title: "New Delivery Assigned",
      titleAr: "تم تعيين توصيل جديد",
      message: `Order ${orderNumber} assigned to you. Customer: ${customerName}. Address: ${address}`,
      messageAr: `تم تعيين الطلب ${orderNumber} لك. العميل: ${customerName}. العنوان: ${address}`,
      link: null,
      linkTab: null,
      linkId: null,
      unread: true,
      createdAt: new Date(),
    });
    console.log(`[Delivery Notification] Created driver notification for ${driverId}`);
  } catch (error) {
    console.error(`[Delivery Notification] Failed to create driver notification:`, error);
  }
}

// Validation schemas
const createAddressSchema = z.object({
  label: z.string().min(1),
  fullName: z.string().min(2),
  mobile: z.string().min(9),
  emirate: z.string().min(2),
  area: z.string().min(2),
  street: z.string().min(2),
  building: z.string().min(1),
  floor: z.string().optional(),
  apartment: z.string().optional(),
  landmark: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional(),
});

const assignDeliverySchema = z.object({
  orderId: z.string(),
  driverId: z.string(),
  estimatedArrival: z.string().optional(),
  orderData: z.object({
    orderNumber: z.string(),
    userId: z.string(),
    customerName: z.string(),
    customerEmail: z.string().optional(),
    customerMobile: z.string(),
    items: z.array(z.any()),
    subtotal: z.number(),
    discount: z.number().optional(),
    deliveryFee: z.number(),
    vatAmount: z.number(),
    vatRate: z.number().optional(),
    total: z.number(),
    status: z.string(),
    paymentStatus: z.string(),
    paymentMethod: z.enum(["card", "cod", "bank_transfer"]),
    addressId: z.string(),
    deliveryAddress: z.any(),
    deliveryNotes: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }).optional(),
});

// =====================================================
// ADDRESS MANAGEMENT
// =====================================================

// GET /api/addresses - Get all addresses for a user
const getUserAddresses: RequestHandler = async (req, res) => {
  try {
    const userId = req.query.userId as string || req.headers["x-user-id"] as string;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User ID is required",
      };
      return res.status(400).json(response);
    }

    const userAddresses = await db.select().from(addresses).where(eq(addresses.userId, userId));

    // Sort: default first, then by date
    userAddresses.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const response: ApiResponse<typeof userAddresses> = {
      success: true,
      data: userAddresses,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch addresses",
    };
    res.status(500).json(response);
  }
};

// GET /api/addresses/:id - Get address by ID
const getAddressById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(addresses).where(eq(addresses.id, id));

    if (result.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof result[0]> = {
      success: true,
      data: result[0],
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch address",
    };
    res.status(500).json(response);
  }
};

// POST /api/addresses - Create new address
const createAddress: RequestHandler = async (req, res) => {
  try {
    const userId = req.body.userId || req.headers["x-user-id"] as string;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User ID is required",
      };
      return res.status(400).json(response);
    }

    const validation = createAddressSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;

    // Check if this is the first address or is default
    const userAddresses = await db.select().from(addresses).where(eq(addresses.userId, userId));
    const isFirstAddress = userAddresses.length === 0;

    // If this is default or first, unset other defaults
    if (data.isDefault || isFirstAddress) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId));
    }

    const [newAddress] = await db.insert(addresses).values({
      id: generateId("addr"),
      userId,
      label: data.label,
      fullName: data.fullName,
      mobile: data.mobile,
      emirate: data.emirate,
      area: data.area,
      street: data.street,
      building: data.building,
      floor: data.floor,
      apartment: data.apartment,
      landmark: data.landmark,
      latitude: data.latitude,
      longitude: data.longitude,
      isDefault: data.isDefault || isFirstAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    const response: ApiResponse<typeof newAddress> = {
      success: true,
      data: newAddress,
      message: "Address created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create address",
    };
    res.status(500).json(response);
  }
};

// PUT /api/addresses/:id - Update address
const updateAddress: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(addresses).where(eq(addresses.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    const validation = createAddressSchema.partial().safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;
    const address = existing[0];

    // Handle default setting
    if (data.isDefault) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(and(eq(addresses.userId, address.userId), eq(addresses.id, id)));
    }

    const [updated] = await db.update(addresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(addresses.id, id))
      .returning();

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: "Address updated successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update address",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/addresses/:id - Delete address
const deleteAddress: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(addresses).where(eq(addresses.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    const address = existing[0];
    await db.delete(addresses).where(eq(addresses.id, id));

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const userAddresses = await db.select().from(addresses).where(eq(addresses.userId, address.userId));
      if (userAddresses.length > 0) {
        await db.update(addresses)
          .set({ isDefault: true })
          .where(eq(addresses.id, userAddresses[0].id));
      }
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "Address deleted successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete address",
    };
    res.status(500).json(response);
  }
};

// POST /api/addresses/:id/set-default - Set address as default
const setDefaultAddress: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(addresses).where(eq(addresses.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    const address = existing[0];

    // Unset other defaults
    await db.update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, address.userId));

    // Set this one as default
    const [updated] = await db.update(addresses)
      .set({ isDefault: true })
      .where(eq(addresses.id, id))
      .returning();

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: "Default address updated",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set default address",
    };
    res.status(500).json(response);
  }
};

// =====================================================
// DELIVERY ZONES
// =====================================================

// GET /api/delivery/zones - Get all delivery zones
const getDeliveryZones: RequestHandler = async (req, res) => {
  try {
    const { emirate, activeOnly } = req.query;
    let zones = await db.select().from(deliveryZones);

    if (emirate) {
      zones = zones.filter((z) => z.emirate === emirate);
    }

    if (activeOnly === "true") {
      zones = zones.filter((z) => z.isActive);
    }

    const response: ApiResponse<typeof zones> = {
      success: true,
      data: zones,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch delivery zones",
    };
    res.status(500).json(response);
  }
};

// GET /api/delivery/zones/:id - Get delivery zone by ID
const getDeliveryZoneById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const zones = await db.select().from(deliveryZones).where(eq(deliveryZones.id, id));

    if (zones.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Delivery zone not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof zones[0]> = {
      success: true,
      data: zones[0],
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch delivery zone",
    };
    res.status(500).json(response);
  }
};

// POST /api/delivery/zones - Create delivery zone
const createDeliveryZone: RequestHandler = async (req, res) => {
  try {
    const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive, expressEnabled, expressFee, expressHours } = req.body;

    const [zone] = await db.insert(deliveryZones).values({
      id: generateId("zone"),
      name,
      nameAr,
      emirate,
      areas: areas || [],
      deliveryFee: deliveryFee || 20,
      minimumOrder: minimumOrder || 50,
      estimatedMinutes: estimatedMinutes || 60,
      isActive: isActive ?? true,
      expressEnabled: expressEnabled ?? false,
      expressFee: expressFee || 25,
      expressHours: expressHours || 1,
    }).returning();

    const response: ApiResponse<typeof zone> = {
      success: true,
      data: zone,
      message: "Delivery zone created",
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create delivery zone",
    };
    res.status(500).json(response);
  }
};

// PUT /api/delivery/zones/:id - Update delivery zone
const updateDeliveryZone: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const zones = await db.select().from(deliveryZones).where(eq(deliveryZones.id, id));

    if (zones.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Delivery zone not found",
      };
      return res.status(404).json(response);
    }

    const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive, expressEnabled, expressFee, expressHours } = req.body;
    const updateData: Partial<typeof deliveryZones.$inferInsert> = {};

    if (name !== undefined) updateData.name = name;
    if (nameAr !== undefined) updateData.nameAr = nameAr;
    if (emirate !== undefined) updateData.emirate = emirate;
    if (areas !== undefined) updateData.areas = areas;
    if (deliveryFee !== undefined) updateData.deliveryFee = deliveryFee;
    if (minimumOrder !== undefined) updateData.minimumOrder = minimumOrder;
    if (estimatedMinutes !== undefined) updateData.estimatedMinutes = estimatedMinutes;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (expressEnabled !== undefined) updateData.expressEnabled = expressEnabled;
    if (expressFee !== undefined) updateData.expressFee = expressFee;
    if (expressHours !== undefined) updateData.expressHours = expressHours;

    const [updated] = await db.update(deliveryZones)
      .set(updateData)
      .where(eq(deliveryZones.id, id))
      .returning();

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: "Delivery zone updated",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update delivery zone",
    };
    res.status(500).json(response);
  }
};

// POST /api/delivery/check-availability - Check delivery availability
const checkDeliveryAvailability: RequestHandler = async (req, res) => {
  try {
    const { emirate, area, orderTotal } = req.body;

    if (!emirate) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Emirate is required",
      };
      return res.status(400).json(response);
    }

    const zones = await db.select().from(deliveryZones).where(
      and(
        eq(deliveryZones.emirate, emirate),
        eq(deliveryZones.isActive, true)
      )
    );

    const zone = zones.find((z) =>
      !area || z.areas.some((a) => a.toLowerCase().includes(area.toLowerCase()))
    );

    if (!zone) {
      const response: ApiResponse<{ available: boolean; message: string }> = {
        success: true,
        data: {
          available: false,
          message: "Delivery is not available in your area",
        },
      };
      return res.json(response);
    }

    const meetsMinimum = !orderTotal || orderTotal >= Number(zone.minimumOrder);

    const response: ApiResponse<{
      available: boolean;
      zone: typeof zone;
      meetsMinimumOrder: boolean;
      minimumOrderRequired: number;
      message?: string;
    }> = {
      success: true,
      data: {
        available: true,
        zone,
        meetsMinimumOrder: meetsMinimum,
        minimumOrderRequired: Number(zone.minimumOrder),
        message: meetsMinimum
          ? `Delivery available! Fee: AED ${zone.deliveryFee}, Est. time: ${zone.estimatedMinutes} mins`
          : `Minimum order of AED ${zone.minimumOrder} required for delivery`,
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check delivery availability",
    };
    res.status(500).json(response);
  }
};

// =====================================================
// DELIVERY TRACKING
// =====================================================

// GET /api/delivery/tracking - Get all trackings (admin) or by order
const getDeliveryTrackings: RequestHandler = async (req, res) => {
  try {
    const { orderId, driverId, status } = req.query;
    let trackings = await db.select().from(deliveryTracking);

    if (orderId) {
      trackings = trackings.filter((t) => t.orderId === orderId);
    }

    if (driverId) {
      trackings = trackings.filter((t) => t.driverId === driverId);
    }

    if (status) {
      trackings = trackings.filter((t) => t.status === status);
    }

    // Sort by creation date (newest first)
    trackings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Enrich tracking data with order details and items
    const allOrders = await db.select().from(orders);
    const allOrderItems = await db.select().from(orderItems);

    const enrichedTrackings = trackings.map((tracking) => {
      const order = allOrders.find((o) => o.id === tracking.orderId);
      if (order) {
        // Get items for this order
        const items = allOrderItems
          .filter((item) => item.orderId === order.id)
          .map((item) => ({
            name: item.productName,
            nameAr: item.productNameAr,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          }));

        return {
          ...tracking,
          customerName: order.customerName,
          customerMobile: order.customerMobile,
          customerId: order.userId,
          deliveryAddress: order.deliveryAddress,
          total: Number(order.total),
          items,
        };
      }
      return tracking;
    });

    const response: ApiResponse<typeof enrichedTrackings> = {
      success: true,
      data: enrichedTrackings,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch trackings",
    };
    res.status(500).json(response);
  }
};

// GET /api/delivery/tracking/:id - Get tracking by ID
const getTrackingById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const trackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.id, id));

    if (trackings.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof trackings[0]> = {
      success: true,
      data: trackings[0],
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch tracking",
    };
    res.status(500).json(response);
  }
};

// GET /api/delivery/tracking/order/:orderNumber - Get tracking by order number
const getTrackingByOrderNumber: RequestHandler = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const trackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.orderNumber, orderNumber));

    if (trackings.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found for this order",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof trackings[0]> = {
      success: true,
      data: trackings[0],
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch tracking",
    };
    res.status(500).json(response);
  }
};

// GET /api/delivery/tracking/by-order/:orderId - Get tracking by order ID
const getTrackingByOrderId: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const trackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.orderId, orderId));

    if (trackings.length === 0) {
      const response: ApiResponse<null> = {
        success: true,
        data: null,
      };
      return res.json(response);
    }

    const response: ApiResponse<typeof trackings[0]> = {
      success: true,
      data: trackings[0],
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch tracking",
    };
    res.status(500).json(response);
  }
};

// POST /api/delivery/tracking/assign - Assign delivery to driver
const assignDelivery: RequestHandler = async (req, res) => {
  console.log("[ASSIGN DELIVERY] Request received:", JSON.stringify(req.body));
  try {
    const validation = assignDeliverySchema.safeParse(req.body);
    if (!validation.success) {
      console.log("[ASSIGN DELIVERY] Validation failed:", validation.error.errors);
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { orderId, driverId, estimatedArrival } = validation.data;

    // Validate order exists
    const orderResults = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderResults.length === 0) {
      console.log("[ASSIGN DELIVERY] Order not found:", orderId);
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const order = orderResults[0];

    // Validate driver
    const driverResults = await db.select().from(users).where(eq(users.id, driverId));
    if (driverResults.length === 0 || driverResults[0].role !== "delivery") {
      console.log("[ASSIGN DELIVERY] Invalid driver:", driverId);
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid delivery driver",
      };
      return res.status(400).json(response);
    }

    const driver = driverResults[0];

    // Check if tracking already exists
    const existingTrackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.orderId, orderId));

    let tracking;
    if (existingTrackings.length > 0) {
      // Update existing tracking
      const existingTimeline = existingTrackings[0].timeline as any[] || [];
      existingTimeline.push({
        status: "assigned",
        timestamp: new Date().toISOString(),
        notes: `Assigned to driver: ${driver.firstName}`,
      });

      [tracking] = await db.update(deliveryTracking)
        .set({
          driverId,
          driverName: `${driver.firstName} ${driver.familyName}`,
          driverMobile: driver.mobile,
          status: "assigned",
          estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : existingTrackings[0].estimatedArrival,
          timeline: existingTimeline,
          updatedAt: new Date(),
        })
        .where(eq(deliveryTracking.id, existingTrackings[0].id))
        .returning();
    } else {
      // Create new tracking
      [tracking] = await db.insert(deliveryTracking).values({
        id: generateId("track"),
        orderId,
        orderNumber: order.orderNumber,
        driverId,
        driverName: `${driver.firstName} ${driver.familyName}`,
        driverMobile: driver.mobile,
        status: "assigned",
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : order.estimatedDeliveryAt,
        timeline: [
          {
            status: "assigned",
            timestamp: new Date().toISOString(),
            notes: `Order assigned to driver: ${driver.firstName}`,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
    }

    // Update order status to ready_for_pickup (driver assigned, but hasn't picked up yet)
    await db.update(orders)
      .set({
        status: "ready_for_pickup",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Create notifications server-side
    // 1. Notify customer that a driver has been assigned (with driver details)
    if (order.customerId || order.userId) {
      const driverFullName = `${driver.firstName} ${driver.familyName}`;
      await createDriverAssignedNotification({ userId: order.userId, customerId: order.customerId }, order.orderNumber, driverFullName, driver.mobile);
    }
    // 2. Notify driver about the assignment
    const addressStr = order.deliveryAddress ?
      `${(order.deliveryAddress as any).building || ''}, ${(order.deliveryAddress as any).street || ''}, ${(order.deliveryAddress as any).area || ''}` :
      'Address not available';
    await createDriverNotification(driverId, order.orderNumber, order.customerName, addressStr);

    console.log("[ASSIGN DELIVERY] Success! Tracking ID:", tracking.id);
    const response: ApiResponse<typeof tracking> = {
      success: true,
      data: tracking,
      message: "Delivery assigned successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("[ASSIGN DELIVERY] Error:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign delivery",
    };
    res.status(500).json(response);
  }
};

// PATCH /api/delivery/tracking/:id/location - Update driver location
const updateDriverLocation: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const trackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.id, id));
    if (trackings.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    const [updated] = await db.update(deliveryTracking)
      .set({
        currentLocation: {
          latitude,
          longitude,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(deliveryTracking.id, id))
      .returning();

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update location",
    };
    res.status(500).json(response);
  }
};

// PATCH /api/delivery/tracking/:id/status - Update delivery status
const updateDeliveryStatus: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, location } = req.body;

    const trackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.id, id));
    if (trackings.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    const tracking = trackings[0];
    const timeline = (tracking.timeline as any[]) || [];
    timeline.push({
      status,
      timestamp: new Date().toISOString(),
      location,
      notes,
    });

    const updateData: any = {
      status,
      timeline,
      updatedAt: new Date(),
    };

    if (status === "delivered") {
      updateData.actualArrival = new Date();
    }

    const [updated] = await db.update(deliveryTracking)
      .set(updateData)
      .where(eq(deliveryTracking.id, id))
      .returning();

    // Update order status if delivered
    if (status === "delivered") {
      await db.update(orders)
        .set({
          status: "delivered",
          actualDeliveryAt: new Date(),
          paymentStatus: "captured",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, tracking.orderId));

      // Send delivered notification
      const orderRes = await db.select().from(orders).where(eq(orders.id, tracking.orderId));
      if (orderRes.length > 0) {
        const order = orderRes[0];
        await createOrderNotification(
          { userId: order.userId, customerId: order.customerId },
          order.orderNumber,
          "delivered"
        );
      }
    }

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: `Delivery status updated to ${status}`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update delivery status",
    };
    res.status(500).json(response);
  }
};

// POST /api/delivery/tracking/:orderId/update - Update delivery status by order ID
const updateDeliveryStatusByOrderId: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, location } = req.body;

    const trackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.orderId, orderId));
    if (trackings.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found for this order",
      };
      return res.status(404).json(response);
    }

    const tracking = trackings[0];
    const timeline = (tracking.timeline as any[]) || [];
    timeline.push({
      status,
      timestamp: new Date().toISOString(),
      location,
      notes,
    });

    const updateData: any = {
      status,
      timeline,
      updatedAt: new Date(),
    };

    if (status === "delivered") {
      updateData.actualArrival = new Date();
    }

    const [updated] = await db.update(deliveryTracking)
      .set(updateData)
      .where(eq(deliveryTracking.id, tracking.id))
      .returning();

    // Update order status based on delivery status
    let orderStatus: string | null = null;
    if (status === "delivered") {
      orderStatus = "delivered";
      await db.update(orders)
        .set({
          status: "delivered",
          actualDeliveryAt: new Date(),
          paymentStatus: "captured",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, tracking.orderId));
    } else if (status === "in_transit" || status === "picked_up") {
      orderStatus = "out_for_delivery";
      await db.update(orders)
        .set({
          status: "out_for_delivery",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, tracking.orderId));
    }

    // Create notification for customer based on delivery status
    const orderResult = await db.select().from(orders).where(eq(orders.id, tracking.orderId));
    if (orderResult.length > 0 && (orderResult[0].customerId || orderResult[0].userId)) {
      const order = orderResult[0];
      const notifyParams = { userId: order.userId, customerId: order.customerId };

      if (status === "assigned") {
        // Send driver assigned notification with driver details
        const driverName = tracking.driverName || updated.driverName || "Driver";
        const driverMobile = tracking.driverMobile || updated.driverMobile || "N/A";
        await createDriverAssignedNotification(notifyParams, order.orderNumber, driverName, driverMobile);
      } else if (status === "in_transit" || status === "picked_up") {
        await createOrderNotification(notifyParams, order.orderNumber, "out_for_delivery");
      } else if (status === "delivered") {
        await createOrderNotification(notifyParams, order.orderNumber, "delivered");
      }
    }


    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: `Delivery status updated to ${status}`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update delivery status",
    };
    res.status(500).json(response);
  }
};

// POST /api/delivery/tracking/:id/complete - Complete delivery with proof
const completeDelivery: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { signature, photo, notes } = req.body;

    const trackings = await db.select().from(deliveryTracking).where(eq(deliveryTracking.id, id));
    if (trackings.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    const tracking = trackings[0];
    const timeline = (tracking.timeline as any[]) || [];
    timeline.push({
      status: "delivered",
      timestamp: new Date().toISOString(),
      notes: notes || "Delivery completed with proof",
    });

    const [updated] = await db.update(deliveryTracking)
      .set({
        status: "delivered",
        actualArrival: new Date(),
        deliveryProof: { signature, photo, notes },
        timeline,
        updatedAt: new Date(),
      })
      .where(eq(deliveryTracking.id, id))
      .returning();

    // Update order
    await db.update(orders)
      .set({
        status: "delivered",
        actualDeliveryAt: new Date(),
        paymentStatus: "captured",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, tracking.orderId));

    // Create notification for customer with driver notes
    const orderResult = await db.select().from(orders).where(eq(orders.id, tracking.orderId));
    if (orderResult.length > 0) {
      const order = orderResult[0];
      const customerId = order.customerId || order.userId;

      if (customerId) {
        console.log(`[Complete Delivery] Creating delivered notification for customer ${customerId}, order ${order.orderNumber}`);

        // Create a custom notification with driver notes
        try {
          const notificationMessage = notes
            ? `Your order ${order.orderNumber} has been delivered. Driver note: ${notes}`
            : `Your order ${order.orderNumber} has been delivered. Enjoy!`;

          const notificationMessageAr = notes
            ? `تم تسليم طلبك ${order.orderNumber}. ملاحظة السائق: ${notes}`
            : `تم تسليم طلبك ${order.orderNumber}. بالهناء والشفاء!`;

          await db.insert(inAppNotifications).values({
            id: generateId("notif"),
            customerId: order.customerId || undefined,
            userId: !order.customerId ? customerId : undefined,
            type: "order",
            title: "Order Delivered",
            titleAr: "تم تسليم الطلب",
            message: notificationMessage,
            messageAr: notificationMessageAr,
            link: "/orders",
            linkTab: null,
            linkId: null,
            unread: true,
            createdAt: new Date(),
          });
          console.log(`[Complete Delivery] ✅ Notification created for customer ${customerId}: Order ${order.orderNumber} delivered with driver note`);
        } catch (notifError) {
          console.error(`[Complete Delivery] ❌ Failed to create notification:`, notifError);
        }
      }
    }

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: "Delivery completed successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("[Complete Delivery] Error:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete delivery",
    };
    res.status(500).json(response);
  }
};

// GET /api/delivery/drivers - Get all delivery drivers
const getDeliveryDrivers: RequestHandler = async (req, res) => {
  try {
    const allUsers = await db.select().from(users).where(
      and(
        eq(users.role, "delivery"),
        eq(users.isActive, true)
      )
    );

    const allTrackings = await db.select().from(deliveryTracking);

    const drivers = allUsers.map((d) => ({
      id: d.id,
      name: `${d.firstName} ${d.familyName}`,
      mobile: d.mobile,
      email: d.email,
      activeDeliveries: allTrackings.filter(
        (t) => t.driverId === d.id && !["delivered", "failed"].includes(t.status)
      ).length,
    }));

    const response: ApiResponse<typeof drivers> = {
      success: true,
      data: drivers,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch drivers",
    };
    res.status(500).json(response);
  }
};

// Register routes
// Address routes
router.get("/addresses", getUserAddresses);
router.get("/addresses/:id", getAddressById);
router.post("/addresses", createAddress);
router.put("/addresses/:id", updateAddress);
router.delete("/addresses/:id", deleteAddress);
router.post("/addresses/:id/set-default", setDefaultAddress);

// Delivery zone routes
router.get("/zones", getDeliveryZones);
router.post("/zones", createDeliveryZone);
router.get("/zones/:id", getDeliveryZoneById);
router.put("/zones/:id", updateDeliveryZone);
router.delete("/zones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const zones = await db.select().from(deliveryZones).where(eq(deliveryZones.id, id));

    if (zones.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Delivery zone not found",
      };
      return res.status(404).json(response);
    }

    await db.delete(deliveryZones).where(eq(deliveryZones.id, id));

    const response: ApiResponse<null> = {
      success: true,
      message: "Delivery zone deleted successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete delivery zone",
    };
    res.status(500).json(response);
  }
});
router.post("/check-availability", checkDeliveryAvailability);

// Delivery tracking routes
router.get("/tracking", getDeliveryTrackings);
router.post("/tracking/assign", assignDelivery);
router.get("/tracking/by-order/:orderId", getTrackingByOrderId);
router.get("/tracking/order/:orderNumber", getTrackingByOrderNumber);
router.post("/tracking/:orderId/update", updateDeliveryStatusByOrderId);
router.patch("/tracking/:id/location", updateDriverLocation);
router.patch("/tracking/:id/status", updateDeliveryStatus);
router.post("/tracking/:id/complete", completeDelivery);
router.get("/tracking/:id", getTrackingById);

// Driver routes
router.get("/drivers", getDeliveryDrivers);

export default router;
