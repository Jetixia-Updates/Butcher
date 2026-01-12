/**
 * Delivery and Address Management Routes
 * Address CRUD, delivery zones, and delivery tracking
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import type { 
  Address, 
  CreateAddressRequest, 
  DeliveryZone, 
  DeliveryTracking, 
  AssignDeliveryRequest,
  CompleteDeliveryRequest,
  ApiResponse 
} from "@shared/api";
import { db, generateId } from "../db";
import { sendOrderNotification } from "../services/notifications";

const router = Router();

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
});

// =====================================================
// ADDRESS MANAGEMENT
// =====================================================

// GET /api/addresses - Get all addresses for a user
const getUserAddresses: RequestHandler = (req, res) => {
  try {
    const userId = req.query.userId as string || req.headers["x-user-id"] as string;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "User ID is required",
      };
      return res.status(400).json(response);
    }

    const addresses = Array.from(db.addresses.values())
      .filter((a) => a.userId === userId)
      .sort((a, b) => {
        // Default address first
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const response: ApiResponse<Address[]> = {
      success: true,
      data: addresses,
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
const getAddressById: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const address = db.addresses.get(id);

    if (!address) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Address> = {
      success: true,
      data: address,
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
const createAddress: RequestHandler = (req, res) => {
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

    // If this is the first address or is default, unset other defaults
    const userAddresses = Array.from(db.addresses.values()).filter((a) => a.userId === userId);
    const isFirstAddress = userAddresses.length === 0;

    if (data.isDefault || isFirstAddress) {
      userAddresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    const address: Address = {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addresses.set(address.id, address);

    const response: ApiResponse<Address> = {
      success: true,
      data: address,
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
const updateAddress: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const address = db.addresses.get(id);

    if (!address) {
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

    // Handle default setting
    if (data.isDefault) {
      const userAddresses = Array.from(db.addresses.values()).filter((a) => a.userId === address.userId);
      userAddresses.forEach((a) => {
        if (a.id !== id) a.isDefault = false;
      });
    }

    // Update address
    Object.assign(address, data, { updatedAt: new Date().toISOString() });

    const response: ApiResponse<Address> = {
      success: true,
      data: address,
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
const deleteAddress: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const address = db.addresses.get(id);

    if (!address) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    db.addresses.delete(id);

    // If deleted address was default, set another as default
    if (address.isDefault) {
      const userAddresses = Array.from(db.addresses.values()).filter((a) => a.userId === address.userId);
      if (userAddresses.length > 0) {
        userAddresses[0].isDefault = true;
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
const setDefaultAddress: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const address = db.addresses.get(id);

    if (!address) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    // Unset other defaults
    const userAddresses = Array.from(db.addresses.values()).filter((a) => a.userId === address.userId);
    userAddresses.forEach((a) => {
      a.isDefault = a.id === id;
    });

    const response: ApiResponse<Address> = {
      success: true,
      data: address,
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
const getDeliveryZones: RequestHandler = (req, res) => {
  try {
    const { emirate, activeOnly } = req.query;
    let zones = Array.from(db.deliveryZones.values());

    if (emirate) {
      zones = zones.filter((z) => z.emirate === emirate);
    }

    if (activeOnly === "true") {
      zones = zones.filter((z) => z.isActive);
    }

    const response: ApiResponse<DeliveryZone[]> = {
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
const getDeliveryZoneById: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const zone = db.deliveryZones.get(id);

    if (!zone) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Delivery zone not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<DeliveryZone> = {
      success: true,
      data: zone,
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
const createDeliveryZone: RequestHandler = (req, res) => {
  try {
    const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive } = req.body;

    const zone: DeliveryZone = {
      id: generateId("zone"),
      name,
      nameAr,
      emirate,
      areas: areas || [],
      deliveryFee: deliveryFee || 20,
      minimumOrder: minimumOrder || 50,
      estimatedMinutes: estimatedMinutes || 60,
      isActive: isActive ?? true,
    };

    db.deliveryZones.set(zone.id, zone);

    const response: ApiResponse<DeliveryZone> = {
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
const updateDeliveryZone: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const zone = db.deliveryZones.get(id);

    if (!zone) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Delivery zone not found",
      };
      return res.status(404).json(response);
    }

    const { name, nameAr, emirate, areas, deliveryFee, minimumOrder, estimatedMinutes, isActive } = req.body;

    if (name !== undefined) zone.name = name;
    if (nameAr !== undefined) zone.nameAr = nameAr;
    if (emirate !== undefined) zone.emirate = emirate;
    if (areas !== undefined) zone.areas = areas;
    if (deliveryFee !== undefined) zone.deliveryFee = deliveryFee;
    if (minimumOrder !== undefined) zone.minimumOrder = minimumOrder;
    if (estimatedMinutes !== undefined) zone.estimatedMinutes = estimatedMinutes;
    if (isActive !== undefined) zone.isActive = isActive;

    const response: ApiResponse<DeliveryZone> = {
      success: true,
      data: zone,
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
const checkDeliveryAvailability: RequestHandler = (req, res) => {
  try {
    const { emirate, area, orderTotal } = req.body;

    if (!emirate) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Emirate is required",
      };
      return res.status(400).json(response);
    }

    const zone = Array.from(db.deliveryZones.values()).find(
      (z) => z.emirate === emirate && z.isActive && (
        !area || z.areas.some((a) => a.toLowerCase().includes(area.toLowerCase()))
      )
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

    const meetsMinimum = !orderTotal || orderTotal >= zone.minimumOrder;

    const response: ApiResponse<{
      available: boolean;
      zone: DeliveryZone;
      meetsMinimumOrder: boolean;
      minimumOrderRequired: number;
      message?: string;
    }> = {
      success: true,
      data: {
        available: true,
        zone,
        meetsMinimumOrder: meetsMinimum,
        minimumOrderRequired: zone.minimumOrder,
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
const getDeliveryTrackings: RequestHandler = (req, res) => {
  try {
    const { orderId, driverId, status } = req.query;
    let trackings = Array.from(db.deliveryTracking.values());

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

    const response: ApiResponse<DeliveryTracking[]> = {
      success: true,
      data: trackings,
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
const getTrackingById: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const tracking = db.deliveryTracking.get(id);

    if (!tracking) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<DeliveryTracking> = {
      success: true,
      data: tracking,
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
const getTrackingByOrderNumber: RequestHandler = (req, res) => {
  try {
    const { orderNumber } = req.params;
    const tracking = Array.from(db.deliveryTracking.values()).find((t) => t.orderNumber === orderNumber);

    if (!tracking) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found for this order",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<DeliveryTracking> = {
      success: true,
      data: tracking,
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
const getTrackingByOrderId: RequestHandler = (req, res) => {
  try {
    const { orderId } = req.params;
    const tracking = Array.from(db.deliveryTracking.values()).find((t) => t.orderId === orderId);

    if (!tracking) {
      // Return empty success response instead of error (order may not have tracking yet)
      const response: ApiResponse<null> = {
        success: true,
        data: null,
      };
      return res.json(response);
    }

    const response: ApiResponse<DeliveryTracking> = {
      success: true,
      data: tracking,
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
  try {
    const validation = assignDeliverySchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { orderId, driverId, estimatedArrival } = validation.data;

    // Validate order
    const order = db.orders.get(orderId);
    if (!order) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    // Validate driver
    const driver = db.users.get(driverId);
    if (!driver || driver.role !== "delivery") {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid delivery driver",
      };
      return res.status(400).json(response);
    }

    // Check if tracking already exists
    let tracking = Array.from(db.deliveryTracking.values()).find((t) => t.orderId === orderId);

    if (tracking) {
      // Update existing tracking
      tracking.driverId = driverId;
      tracking.driverName = `${driver.firstName} ${driver.familyName}`;
      tracking.driverMobile = driver.mobile;
      tracking.status = "assigned";
      tracking.estimatedArrival = estimatedArrival || tracking.estimatedArrival;
      tracking.updatedAt = new Date().toISOString();
      tracking.timeline.push({
        status: "assigned",
        timestamp: new Date().toISOString(),
        notes: `Assigned to driver: ${driver.firstName}`,
      });
    } else {
      // Create new tracking
      tracking = {
        id: generateId("track"),
        orderId,
        orderNumber: order.orderNumber,
        driverId,
        driverName: `${driver.firstName} ${driver.familyName}`,
        driverMobile: driver.mobile,
        status: "assigned",
        estimatedArrival: estimatedArrival || order.estimatedDeliveryAt,
        timeline: [
          {
            status: "assigned",
            timestamp: new Date().toISOString(),
            notes: `Order assigned to driver: ${driver.firstName}`,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.deliveryTracking.set(tracking.id, tracking);
    }

    // Update order status
    order.status = "out_for_delivery";
    order.statusHistory.push({
      status: "out_for_delivery",
      changedBy: driverId,
      changedAt: new Date().toISOString(),
      notes: `Assigned to ${driver.firstName}`,
    });
    order.updatedAt = new Date().toISOString();

    // Send notification
    sendOrderNotification(order, "order_shipped", {
      driverName: `${driver.firstName}`,
      driverPhone: driver.mobile,
    }).catch(console.error);

    const response: ApiResponse<DeliveryTracking> = {
      success: true,
      data: tracking,
      message: "Delivery assigned successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign delivery",
    };
    res.status(500).json(response);
  }
};

// PATCH /api/delivery/tracking/:id/location - Update driver location
const updateDriverLocation: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const tracking = db.deliveryTracking.get(id);
    if (!tracking) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    tracking.currentLocation = {
      latitude,
      longitude,
      updatedAt: new Date().toISOString(),
    };
    tracking.updatedAt = new Date().toISOString();

    const response: ApiResponse<DeliveryTracking> = {
      success: true,
      data: tracking,
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

    const tracking = db.deliveryTracking.get(id);
    if (!tracking) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    tracking.status = status;
    tracking.updatedAt = new Date().toISOString();
    tracking.timeline.push({
      status,
      timestamp: new Date().toISOString(),
      location,
      notes,
    });

    // Update order status if delivered
    if (status === "delivered") {
      tracking.actualArrival = new Date().toISOString();
      const order = db.orders.get(tracking.orderId);
      if (order) {
        order.status = "delivered";
        order.actualDeliveryAt = new Date().toISOString();
        order.paymentStatus = "captured";
        order.statusHistory.push({
          status: "delivered",
          changedBy: tracking.driverId || "driver",
          changedAt: new Date().toISOString(),
          notes: "Delivered successfully",
        });
        order.updatedAt = new Date().toISOString();

        // Send notification
        sendOrderNotification(order, "order_delivered").catch(console.error);
      }
    }

    const response: ApiResponse<DeliveryTracking> = {
      success: true,
      data: tracking,
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

    const tracking = db.deliveryTracking.get(id);
    if (!tracking) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Tracking not found",
      };
      return res.status(404).json(response);
    }

    tracking.status = "delivered";
    tracking.actualArrival = new Date().toISOString();
    tracking.deliveryProof = {
      signature,
      photo,
      notes,
    };
    tracking.updatedAt = new Date().toISOString();
    tracking.timeline.push({
      status: "delivered",
      timestamp: new Date().toISOString(),
      notes: "Delivery completed with proof",
    });

    // Update order
    const order = db.orders.get(tracking.orderId);
    if (order) {
      order.status = "delivered";
      order.actualDeliveryAt = new Date().toISOString();
      order.paymentStatus = "captured";
      order.statusHistory.push({
        status: "delivered",
        changedBy: tracking.driverId || "driver",
        changedAt: new Date().toISOString(),
        notes: "Delivered with proof",
      });
      order.updatedAt = new Date().toISOString();

      // Send notification
      sendOrderNotification(order, "order_delivered").catch(console.error);
    }

    const response: ApiResponse<DeliveryTracking> = {
      success: true,
      data: tracking,
      message: "Delivery completed successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete delivery",
    };
    res.status(500).json(response);
  }
};

// GET /api/delivery/drivers - Get all delivery drivers
const getDeliveryDrivers: RequestHandler = (req, res) => {
  try {
    const drivers = Array.from(db.users.values())
      .filter((u) => u.role === "delivery" && u.isActive)
      .map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.familyName}`,
        mobile: d.mobile,
        email: d.email,
        // Count active deliveries
        activeDeliveries: Array.from(db.deliveryTracking.values())
          .filter((t) => t.driverId === d.id && !["delivered", "failed"].includes(t.status)).length,
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
    const zone = db.deliveryZones.get(id);

    if (!zone) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Delivery zone not found",
      };
      return res.status(404).json(response);
    }

    db.deliveryZones.delete(id);

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
router.patch("/tracking/:id/location", updateDriverLocation);
router.patch("/tracking/:id/status", updateDeliveryStatus);
router.post("/tracking/:id/complete", completeDelivery);
router.get("/tracking/:id", getTrackingById);

// Driver routes
router.get("/drivers", getDeliveryDrivers);

export default router;
