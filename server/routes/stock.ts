/**
 * Stock Management Routes
 * Inventory tracking, auto-reduction, and low stock alerts (PostgreSQL version)
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { StockItem, StockMovement, LowStockAlert, ApiResponse, Order } from "../../shared/api";
import { db, stock, stockMovements, products } from "../db/connection";
import { sendLowStockNotifications } from "../services/notifications";
import { randomUUID } from "crypto";

const router = Router();

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

// Helper to convert decimal strings to numbers
function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value) || 0;
}

// Validation schemas
const updateStockSchema = z.object({
  productId: z.string(),
  quantity: z.number(),
  type: z.enum(["in", "out", "adjustment"]),
  reason: z.string(),
});

const bulkUpdateSchema = z.array(updateStockSchema);

// GET /api/stock - Get all stock items
const getStock: RequestHandler = async (req, res) => {
  try {
    const { lowStockOnly, productId } = req.query;
    let stockItems = await db.select().from(stock);

    // Filter by product
    if (productId) {
      stockItems = stockItems.filter((s) => s.productId === productId);
    }

    // Filter low stock only
    if (lowStockOnly === "true") {
      stockItems = stockItems.filter((s) => toNumber(s.availableQuantity) <= s.lowStockThreshold);
    }

    // Get all products for enrichment
    const allProducts = await db.select().from(products);

    // Enrich with product info and convert decimals
    const enrichedStock = stockItems.map((stockItem) => {
      const product = allProducts.find((p) => p.id === stockItem.productId);
      return {
        id: stockItem.id,
        productId: stockItem.productId,
        quantity: toNumber(stockItem.quantity),
        reservedQuantity: toNumber(stockItem.reservedQuantity),
        availableQuantity: toNumber(stockItem.availableQuantity),
        lowStockThreshold: stockItem.lowStockThreshold,
        reorderPoint: stockItem.reorderPoint,
        reorderQuantity: stockItem.reorderQuantity,
        lastRestockedAt: stockItem.lastRestockedAt,
        expiryDate: stockItem.expiryDate,
        batchNumber: stockItem.batchNumber,
        updatedAt: stockItem.updatedAt,
        productName: product?.name || "Unknown",
        productNameAr: product?.nameAr,
        productSku: product?.sku,
        productPrice: product?.price ? toNumber(product.price) : undefined,
      };
    });

    const response: ApiResponse<typeof enrichedStock> = {
      success: true,
      data: enrichedStock,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch stock",
    };
    res.status(500).json(response);
  }
};

// GET /api/stock/:productId - Get stock for specific product
const getStockByProduct: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;
    const stockItems = await db.select().from(stock).where(eq(stock.productId, productId));

    if (stockItems.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Stock item not found",
      };
      return res.status(404).json(response);
    }

    const stockItem = stockItems[0];
    const productResults = await db.select().from(products).where(eq(products.id, productId));
    const product = productResults[0];

    const data: StockItem & { productName?: string } = {
      id: stockItem.id,
      productId: stockItem.productId,
      quantity: toNumber(stockItem.quantity),
      reservedQuantity: toNumber(stockItem.reservedQuantity),
      availableQuantity: toNumber(stockItem.availableQuantity),
      lowStockThreshold: stockItem.lowStockThreshold,
      reorderPoint: stockItem.reorderPoint,
      reorderQuantity: stockItem.reorderQuantity,
      lastRestockedAt: stockItem.lastRestockedAt?.toISOString(),
      expiryDate: stockItem.expiryDate?.toISOString(),
      batchNumber: stockItem.batchNumber || undefined,
      updatedAt: stockItem.updatedAt.toISOString(),
      productName: product?.name,
    };

    const response: ApiResponse<typeof data> = {
      success: true,
      data,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch stock",
    };
    res.status(500).json(response);
  }
};

// POST /api/stock/update - Update stock (single item)
const updateStock: RequestHandler = async (req, res) => {
  try {
    const validation = updateStockSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { productId, quantity, type, reason } = validation.data;
    const performedBy = req.headers["x-user-id"] as string || "admin";

    const result = await updateStockItem(productId, quantity, type, reason, performedBy);

    if (!result.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    const response: ApiResponse<StockItem> = {
      success: true,
      data: result.stockItem!,
      message: `Stock ${type === "in" ? "increased" : type === "out" ? "decreased" : "adjusted"} successfully`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update stock",
    };
    res.status(500).json(response);
  }
};

// POST /api/stock/bulk-update - Update multiple stock items
const bulkUpdateStock: RequestHandler = async (req, res) => {
  try {
    const validation = bulkUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const updates = validation.data;
    const performedBy = req.headers["x-user-id"] as string || "admin";
    const results: { productId: string; success: boolean; error?: string }[] = [];

    for (const update of updates) {
      const result = await updateStockItem(
        update.productId,
        update.quantity,
        update.type,
        update.reason,
        performedBy
      );
      results.push({
        productId: update.productId,
        success: result.success,
        error: result.error,
      });
    }

    const response: ApiResponse<typeof results> = {
      success: true,
      data: results,
      message: `Processed ${results.length} stock updates`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to bulk update stock",
    };
    res.status(500).json(response);
  }
};

// GET /api/stock/alerts - Get low stock alerts
const getLowStockAlerts: RequestHandler = async (req, res) => {
  try {
    const allStock = await db.select().from(stock);
    const allProducts = await db.select().from(products);
    
    const alerts: LowStockAlert[] = [];

    for (const stockItem of allStock) {
      const availQty = toNumber(stockItem.availableQuantity);
      if (availQty <= stockItem.lowStockThreshold) {
        const product = allProducts.find((p) => p.id === stockItem.productId);
        if (product) {
          alerts.push({
            productId: stockItem.productId,
            productName: product.name,
            currentQuantity: availQty,
            threshold: stockItem.lowStockThreshold,
            reorderPoint: stockItem.reorderPoint,
            suggestedReorderQuantity: stockItem.reorderQuantity,
          });
        }
      }
    }

    // Sort by urgency (lowest stock first)
    alerts.sort((a, b) => a.currentQuantity - b.currentQuantity);

    const response: ApiResponse<LowStockAlert[]> = {
      success: true,
      data: alerts,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch alerts",
    };
    res.status(500).json(response);
  }
};

// GET /api/stock/movements - Get stock movement history
const getStockMovements: RequestHandler = async (req, res) => {
  try {
    const { productId, type, startDate, endDate, limit = "100" } = req.query;
    let movements = await db.select().from(stockMovements);

    // Filter by product
    if (productId) {
      movements = movements.filter((m) => m.productId === productId);
    }

    // Filter by type
    if (type) {
      movements = movements.filter((m) => m.type === type);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate as string);
      movements = movements.filter((m) => new Date(m.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      movements = movements.filter((m) => new Date(m.createdAt) <= end);
    }

    // Sort by date (newest first)
    movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Limit results
    movements = movements.slice(0, parseInt(limit as string));

    // Enrich with product names and convert decimals
    const allProducts = await db.select().from(products);
    const enrichedMovements = movements.map((m) => {
      const product = allProducts.find((p) => p.id === m.productId);
      return {
        id: m.id,
        productId: m.productId,
        type: m.type,
        quantity: toNumber(m.quantity),
        previousQuantity: toNumber(m.previousQuantity),
        newQuantity: toNumber(m.newQuantity),
        reason: m.reason,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        performedBy: m.performedBy,
        createdAt: m.createdAt,
        productName: product?.name || "Unknown",
      };
    });

    const response: ApiResponse<typeof enrichedMovements> = {
      success: true,
      data: enrichedMovements,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch movements",
    };
    res.status(500).json(response);
  }
};

// POST /api/stock/restock/:productId - Restock a product
const restockProduct: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, batchNumber, expiryDate } = req.body;
    const performedBy = req.headers["x-user-id"] as string || "admin";

    if (!quantity || quantity <= 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Quantity must be greater than 0",
      };
      return res.status(400).json(response);
    }

    const stockItems = await db.select().from(stock).where(eq(stock.productId, productId));
    if (stockItems.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Stock item not found",
      };
      return res.status(404).json(response);
    }

    const stockItem = stockItems[0];
    const previousQuantity = toNumber(stockItem.quantity);
    const newQuantity = previousQuantity + quantity;
    const newAvailable = newQuantity - toNumber(stockItem.reservedQuantity);

    // Update stock
    const [updatedStock] = await db.update(stock)
      .set({
        quantity: String(newQuantity),
        availableQuantity: String(newAvailable),
        lastRestockedAt: new Date(),
        updatedAt: new Date(),
        batchNumber: batchNumber || stockItem.batchNumber,
        expiryDate: expiryDate ? new Date(expiryDate) : stockItem.expiryDate,
      })
      .where(eq(stock.id, stockItem.id))
      .returning();

    // Record movement
    await db.insert(stockMovements).values({
      id: generateId("mov"),
      productId,
      type: "in",
      quantity: String(quantity),
      previousQuantity: String(previousQuantity),
      newQuantity: String(newQuantity),
      reason: `Restock - Batch: ${batchNumber || "N/A"}`,
      referenceType: "manual",
      performedBy,
      createdAt: new Date(),
    });

    const response: ApiResponse<StockItem> = {
      success: true,
      data: {
        id: updatedStock.id,
        productId: updatedStock.productId,
        quantity: toNumber(updatedStock.quantity),
        reservedQuantity: toNumber(updatedStock.reservedQuantity),
        availableQuantity: toNumber(updatedStock.availableQuantity),
        lowStockThreshold: updatedStock.lowStockThreshold,
        reorderPoint: updatedStock.reorderPoint,
        reorderQuantity: updatedStock.reorderQuantity,
        lastRestockedAt: updatedStock.lastRestockedAt?.toISOString(),
        expiryDate: updatedStock.expiryDate?.toISOString(),
        batchNumber: updatedStock.batchNumber || undefined,
        updatedAt: updatedStock.updatedAt.toISOString(),
      },
      message: `Successfully restocked ${quantity} units`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restock product",
    };
    res.status(500).json(response);
  }
};

// PATCH /api/stock/:productId/thresholds - Update stock thresholds
const updateStockThresholds: RequestHandler = async (req, res) => {
  try {
    const { productId } = req.params;
    const { lowStockThreshold, reorderPoint, reorderQuantity } = req.body;

    const stockItems = await db.select().from(stock).where(eq(stock.productId, productId));
    if (stockItems.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Stock item not found",
      };
      return res.status(404).json(response);
    }

    const stockItem = stockItems[0];
    const updateData: Partial<typeof stock.$inferInsert> = { updatedAt: new Date() };

    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
    if (reorderPoint !== undefined) updateData.reorderPoint = reorderPoint;
    if (reorderQuantity !== undefined) updateData.reorderQuantity = reorderQuantity;

    const [updatedStock] = await db.update(stock)
      .set(updateData)
      .where(eq(stock.id, stockItem.id))
      .returning();

    const response: ApiResponse<StockItem> = {
      success: true,
      data: {
        id: updatedStock.id,
        productId: updatedStock.productId,
        quantity: toNumber(updatedStock.quantity),
        reservedQuantity: toNumber(updatedStock.reservedQuantity),
        availableQuantity: toNumber(updatedStock.availableQuantity),
        lowStockThreshold: updatedStock.lowStockThreshold,
        reorderPoint: updatedStock.reorderPoint,
        reorderQuantity: updatedStock.reorderQuantity,
        lastRestockedAt: updatedStock.lastRestockedAt?.toISOString(),
        expiryDate: updatedStock.expiryDate?.toISOString(),
        batchNumber: updatedStock.batchNumber || undefined,
        updatedAt: updatedStock.updatedAt.toISOString(),
      },
      message: "Stock thresholds updated",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update thresholds",
    };
    res.status(500).json(response);
  }
};

// =====================================================
// HELPER FUNCTIONS (exported for use by orders)
// =====================================================

// Update stock item
export async function updateStockItem(
  productId: string,
  quantity: number,
  type: "in" | "out" | "adjustment" | "reserved" | "released",
  reason: string,
  performedBy: string,
  referenceType?: "order" | "return" | "waste" | "transfer" | "manual",
  referenceId?: string
): Promise<{ success: boolean; stockItem?: StockItem; error?: string }> {
  const stockItems = await db.select().from(stock).where(eq(stock.productId, productId));

  if (stockItems.length === 0) {
    return { success: false, error: `Stock item not found for product ${productId}` };
  }

  const stockItem = stockItems[0];
  const previousQuantity = toNumber(stockItem.quantity);
  const currentReserved = toNumber(stockItem.reservedQuantity);
  const currentAvailable = toNumber(stockItem.availableQuantity);
  
  let newQuantity = previousQuantity;
  let newReserved = currentReserved;

  // Apply change based on type
  switch (type) {
    case "in":
      newQuantity += quantity;
      break;
    case "out":
      if (currentAvailable < quantity) {
        return { success: false, error: `Insufficient stock for product ${productId}` };
      }
      newQuantity -= quantity;
      break;
    case "reserved":
      if (currentAvailable < quantity) {
        return { success: false, error: `Insufficient stock to reserve for product ${productId}` };
      }
      newReserved += quantity;
      break;
    case "released":
      newReserved = Math.max(0, newReserved - quantity);
      break;
    case "adjustment":
      newQuantity = quantity;
      break;
  }

  // Recalculate available
  const newAvailable = newQuantity - newReserved;

  // Update in database
  const [updatedStock] = await db.update(stock)
    .set({
      quantity: String(newQuantity),
      reservedQuantity: String(newReserved),
      availableQuantity: String(newAvailable),
      updatedAt: new Date(),
    })
    .where(eq(stock.id, stockItem.id))
    .returning();

  // Record movement
  await db.insert(stockMovements).values({
    id: generateId("mov"),
    productId,
    type,
    quantity: String(Math.abs(quantity)),
    previousQuantity: String(previousQuantity),
    newQuantity: String(newQuantity),
    reason,
    referenceType,
    referenceId,
    performedBy,
    createdAt: new Date(),
  });

  // Check for low stock alert
  if (newAvailable <= stockItem.lowStockThreshold) {
    const productResults = await db.select().from(products).where(eq(products.id, productId));
    const product = productResults[0];
    if (product) {
      // Send low stock notification (async)
      sendLowStockNotifications(product.name, newAvailable, stockItem.lowStockThreshold)
        .catch(console.error);
    }
  }

  const resultStockItem: StockItem = {
    id: updatedStock.id,
    productId: updatedStock.productId,
    quantity: toNumber(updatedStock.quantity),
    reservedQuantity: toNumber(updatedStock.reservedQuantity),
    availableQuantity: toNumber(updatedStock.availableQuantity),
    lowStockThreshold: updatedStock.lowStockThreshold,
    reorderPoint: updatedStock.reorderPoint,
    reorderQuantity: updatedStock.reorderQuantity,
    lastRestockedAt: updatedStock.lastRestockedAt?.toISOString(),
    expiryDate: updatedStock.expiryDate?.toISOString(),
    batchNumber: updatedStock.batchNumber || undefined,
    updatedAt: updatedStock.updatedAt.toISOString(),
  };

  return { success: true, stockItem: resultStockItem };
}

// Reduce stock when order is placed (reserve stock)
export async function reduceStockForOrder(order: Order): Promise<{ success: boolean; error?: string }> {
  // First, validate all items have sufficient stock
  for (const item of order.items) {
    const stockItems = await db.select().from(stock).where(eq(stock.productId, item.productId));
    if (stockItems.length === 0) {
      return { success: false, error: `Stock not found for product: ${item.productName}` };
    }
    const availQty = toNumber(stockItems[0].availableQuantity);
    if (availQty < item.quantity) {
      return { 
        success: false, 
        error: `Insufficient stock for ${item.productName}. Available: ${availQty}, Requested: ${item.quantity}` 
      };
    }
  }

  // Reserve stock for each item
  for (const item of order.items) {
    await updateStockItem(
      item.productId,
      item.quantity,
      "reserved",
      `Reserved for order ${order.orderNumber}`,
      "system",
      "order",
      order.id
    );
  }

  return { success: true };
}

// Release stock when order is cancelled
export async function releaseStockForOrder(order: Order): Promise<{ success: boolean; error?: string }> {
  for (const item of order.items) {
    await updateStockItem(
      item.productId,
      item.quantity,
      "released",
      `Released from cancelled order ${order.orderNumber}`,
      "system",
      "order",
      order.id
    );
  }

  return { success: true };
}

// Confirm stock reduction when order is delivered
export async function confirmStockReductionForOrder(order: Order): Promise<{ success: boolean; error?: string }> {
  for (const item of order.items) {
    const stockItems = await db.select().from(stock).where(eq(stock.productId, item.productId));
    if (stockItems.length > 0) {
      const stockItem = stockItems[0];
      const currentReserved = toNumber(stockItem.reservedQuantity);
      const currentQuantity = toNumber(stockItem.quantity);
      const newReserved = Math.max(0, currentReserved - item.quantity);

      // Update stock
      await db.update(stock)
        .set({
          reservedQuantity: String(newReserved),
          updatedAt: new Date(),
        })
        .where(eq(stock.id, stockItem.id));

      // Record movement
      await db.insert(stockMovements).values({
        id: generateId("mov"),
        productId: item.productId,
        type: "out",
        quantity: String(item.quantity),
        previousQuantity: String(currentQuantity + item.quantity),
        newQuantity: String(currentQuantity),
        reason: `Sold via order ${order.orderNumber}`,
        referenceType: "order",
        referenceId: order.id,
        performedBy: "system",
        createdAt: new Date(),
      });
    }
  }

  return { success: true };
}

// Register routes
router.get("/", getStock);
router.get("/alerts", getLowStockAlerts);
router.get("/movements", getStockMovements);
router.get("/:productId", getStockByProduct);
router.post("/update", updateStock);
router.post("/bulk-update", bulkUpdateStock);
router.post("/restock/:productId", restockProduct);
router.patch("/:productId/thresholds", updateStockThresholds);

export default router;
