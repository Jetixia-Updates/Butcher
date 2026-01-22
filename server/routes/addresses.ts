/**
 * Addresses API Routes
 * Handles customer delivery addresses CRUD operations
 */

import { Router, Request, Response } from "express";
import { db, addresses } from "../db/connection";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";

const router = Router();

// Helper to get customer or user ID from request
const getOwnerInfo = (req: Request): { customerId?: string; userId?: string } | null => {
  const customerId = req.headers["x-customer-id"] as string;
  const userId = req.headers["x-user-id"] as string;
  
  if (customerId) {
    return { customerId };
  }
  if (userId) {
    return { userId };
  }
  return null;
};

// Validation schemas
const addressSchema = z.object({
  label: z.string().min(1).max(50),
  fullName: z.string().min(1).max(200),
  mobile: z.string().min(1).max(20),
  emirate: z.string().min(1).max(100),
  area: z.string().min(1).max(200),
  street: z.string().min(1),
  building: z.string().min(1).max(200),
  floor: z.string().max(20).optional(),
  apartment: z.string().max(50).optional(),
  landmark: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/addresses - Get all addresses for customer/user
router.get("/", async (req: Request, res: Response) => {
  try {
    const owner = getOwnerInfo(req);
    if (!owner) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    let userAddresses;
    if (owner.customerId) {
      userAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.customerId, owner.customerId))
        .orderBy(addresses.createdAt);
    } else {
      userAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.userId, owner.userId!))
        .orderBy(addresses.createdAt);
    }

    res.json({ success: true, data: userAddresses });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({ success: false, error: "Failed to fetch addresses" });
  }
});

// POST /api/addresses - Create new address
router.post("/", async (req: Request, res: Response) => {
  try {
    const owner = getOwnerInfo(req);
    console.log("[Addresses] Creating address for:", owner);
    
    if (!owner) {
      console.log("[Addresses] No authentication provided");
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const validation = addressSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.log("[Addresses] Validation failed:", errorMessages);
      return res.status(400).json({ success: false, error: errorMessages });
    }

    const data = validation.data;
    const addressId = randomUUID();

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      if (owner.customerId) {
        await db
          .update(addresses)
          .set({ isDefault: false })
          .where(eq(addresses.customerId, owner.customerId));
      } else {
        await db
          .update(addresses)
          .set({ isDefault: false })
          .where(eq(addresses.userId, owner.userId!));
      }
    }

    // If no other addresses exist, make this the default
    let existingAddresses;
    if (owner.customerId) {
      existingAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.customerId, owner.customerId));
    } else {
      existingAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.userId, owner.userId!));
    }
    
    const shouldBeDefault = data.isDefault || existingAddresses.length === 0;

    const [newAddress] = await db
      .insert(addresses)
      .values({
        id: addressId,
        customerId: owner.customerId || null,
        userId: owner.userId || null,
        label: data.label,
        fullName: data.fullName,
        mobile: data.mobile,
        emirate: data.emirate,
        area: data.area,
        street: data.street,
        building: data.building,
        floor: data.floor || null,
        apartment: data.apartment || null,
        landmark: data.landmark || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        isDefault: shouldBeDefault,
      })
      .returning();

    console.log("[Addresses] Address created successfully:", addressId);
    res.json({ success: true, data: newAddress });
  } catch (error) {
    console.error("[Addresses] Error creating address:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create address";
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// PUT /api/addresses/:id - Update address
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const owner = getOwnerInfo(req);
    if (!owner) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { id } = req.params;
    const validation = addressSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.message });
    }

    const data = validation.data;

    // Check ownership
    let existing;
    if (owner.customerId) {
      [existing] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), eq(addresses.customerId, owner.customerId)));
    } else {
      [existing] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), eq(addresses.userId, owner.userId!)));
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: "Address not found" });
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      if (owner.customerId) {
        await db
          .update(addresses)
          .set({ isDefault: false })
          .where(eq(addresses.customerId, owner.customerId));
      } else {
        await db
          .update(addresses)
          .set({ isDefault: false })
          .where(eq(addresses.userId, owner.userId!));
      }
    }

    const [updated] = await db
      .update(addresses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(addresses.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ success: false, error: "Failed to update address" });
  }
});

// DELETE /api/addresses/:id - Delete address
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const owner = getOwnerInfo(req);
    if (!owner) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { id } = req.params;

    // Check ownership
    let existing;
    if (owner.customerId) {
      [existing] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), eq(addresses.customerId, owner.customerId)));
    } else {
      [existing] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), eq(addresses.userId, owner.userId!)));
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: "Address not found" });
    }

    await db
      .delete(addresses)
      .where(eq(addresses.id, id));

    // If deleted address was default, make another one default
    if (existing.isDefault) {
      let firstAddress;
      if (owner.customerId) {
        [firstAddress] = await db
          .select()
          .from(addresses)
          .where(eq(addresses.customerId, owner.customerId))
          .limit(1);
      } else {
        [firstAddress] = await db
          .select()
          .from(addresses)
          .where(eq(addresses.userId, owner.userId!))
          .limit(1);
      }

      if (firstAddress) {
        await db
          .update(addresses)
          .set({ isDefault: true })
          .where(eq(addresses.id, firstAddress.id));
      }
    }

    res.json({ success: true, message: "Address deleted" });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ success: false, error: "Failed to delete address" });
  }
});

// PUT /api/addresses/:id/default - Set address as default
router.put("/:id/default", async (req: Request, res: Response) => {
  try {
    const owner = getOwnerInfo(req);
    if (!owner) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { id } = req.params;

    // Check ownership
    let existing;
    if (owner.customerId) {
      [existing] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), eq(addresses.customerId, owner.customerId)));
    } else {
      [existing] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), eq(addresses.userId, owner.userId!)));
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: "Address not found" });
    }

    // Unset all defaults
    if (owner.customerId) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.customerId, owner.customerId));
    } else {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, owner.userId!));
    }

    // Set this one as default
    const [updated] = await db
      .update(addresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(addresses.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({ success: false, error: "Failed to set default address" });
  }
});

export default router;
