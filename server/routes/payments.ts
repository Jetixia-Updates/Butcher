/**
 * Payment Routes
 * Payment processing, refunds, and payment history (PostgreSQL version)
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq, gte, lte, and } from "drizzle-orm";
import type { Payment, PaymentRefund, SavedCard, ApiResponse, PaginatedResponse } from "../../shared/api";
import { db, payments, orders } from "../db/connection";
import { sendOrderNotification } from "../services/notifications";
import { randomUUID } from "crypto";

const router = Router();

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

// Validation schemas
const processPaymentSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["card", "cod", "bank_transfer"]),
  cardToken: z.string().optional(),
  saveCard: z.boolean().optional(),
});

const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
});

// Mock payment gateway integration
async function processWithGateway(
  amount: number,
  method: string,
  cardToken?: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  console.log(`💳 Processing payment: AED ${amount} via ${method}`);

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Simulate success (95% success rate)
  if (Math.random() > 0.05) {
    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  return {
    success: false,
    error: "Payment declined. Please try another card.",
  };
}

// Mock refund processing
async function processRefundWithGateway(
  transactionId: string,
  amount: number
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  console.log(`💰 Processing refund: AED ${amount} for transaction ${transactionId}`);

  await new Promise((resolve) => setTimeout(resolve, 200));

  if (Math.random() > 0.02) {
    return {
      success: true,
      refundId: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  return {
    success: false,
    error: "Refund failed. Please try again later.",
  };
}

// GET /api/payments - Get all payments (admin)
const getPayments: RequestHandler = async (req, res) => {
  try {
    // Prevent caching to ensure fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { userId, orderId, status, method, page = "1", limit = "20", startDate, endDate } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let allPayments = await db.select().from(payments);

    // Filter by user (through orders)
    if (userId) {
      const userOrders = await db.select().from(orders).where(eq(orders.userId, userId as string));
      const userOrderIds = userOrders.map((o) => o.id);
      allPayments = allPayments.filter((p) => userOrderIds.includes(p.orderId));
    }

    // Filter by order
    if (orderId) {
      allPayments = allPayments.filter((p) => p.orderId === orderId);
    }

    // Filter by status
    if (status) {
      allPayments = allPayments.filter((p) => p.status === status);
    }

    // Filter by method
    if (method) {
      allPayments = allPayments.filter((p) => p.method === method);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate as string);
      allPayments = allPayments.filter((p) => new Date(p.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      allPayments = allPayments.filter((p) => new Date(p.createdAt) <= end);
    }

    // Sort by date (newest first)
    allPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const total = allPayments.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedPayments = allPayments.slice(startIndex, startIndex + limitNum);

    const response: PaginatedResponse<typeof paginatedPayments[0]> = {
      success: true,
      data: paginatedPayments,
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
      error: error instanceof Error ? error.message : "Failed to fetch payments",
    };
    res.status(500).json(response);
  }
};

// GET /api/payments/:id - Get payment by ID
const getPaymentById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(payments).where(eq(payments.id, id));

    if (result.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Payment not found",
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
      error: error instanceof Error ? error.message : "Failed to fetch payment",
    };
    res.status(500).json(response);
  }
};

// GET /api/payments/order/:orderId - Get payment by order ID
const getPaymentByOrderId: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await db.select().from(payments).where(eq(payments.orderId, orderId));

    if (result.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Payment not found for this order",
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
      error: error instanceof Error ? error.message : "Failed to fetch payment",
    };
    res.status(500).json(response);
  }
};

// POST /api/payments/process - Process payment
const processPayment: RequestHandler = async (req, res) => {
  try {
    const validation = processPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { orderId, amount, method, cardToken, saveCard } = validation.data;

    // Validate order
    const orderResult = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Order not found",
      };
      return res.status(404).json(response);
    }

    const order = orderResult[0];

    // Check if payment already exists
    const existingPayment = await db.select().from(payments).where(eq(payments.orderId, orderId));
    if (existingPayment.length > 0 && existingPayment[0].status === "captured") {
      const response: ApiResponse<null> = {
        success: false,
        error: "Payment already processed for this order",
      };
      return res.status(400).json(response);
    }

    // Process with gateway (for card payments)
    let gatewayTransactionId: string | undefined = undefined;
    if (method === "card") {
      const gatewayResult = await processWithGateway(amount, method, cardToken);

      if (!gatewayResult.success) {
        // Update order payment status
        const ordersInDb = await db.select().from(orders).where(eq(orders.id, orderId));
        if (ordersInDb.length > 0) {
          let statusHistory = (ordersInDb[0].statusHistory as any[]) || [];
          statusHistory.push({
            status: ordersInDb[0].status,
            changedBy: "system",
            changedAt: new Date().toISOString(),
            notes: `Payment failed: ${gatewayResult.error || "Decline"}`
          });

          await db.update(orders)
            .set({
              paymentStatus: "failed",
              statusHistory,
              updatedAt: new Date()
            })
            .where(eq(orders.id, orderId));
        }

        const response: ApiResponse<null> = {
          success: false,
          error: gatewayResult.error || "Payment failed",
        };
        return res.status(400).json(response);
      }

      gatewayTransactionId = gatewayResult.transactionId;
    }

    // Create or update payment record
    let payment;
    if (existingPayment.length > 0) {
      // Update existing payment
      [payment] = await db.update(payments)
        .set({
          status: method === "cod" ? "pending" : "captured",
          gatewayTransactionId,
          cardBrand: method === "card" ? "Visa" : null,
          cardLast4: method === "card" ? "4242" : null,
          cardExpiryMonth: method === "card" ? 12 : null,
          cardExpiryYear: method === "card" ? 2028 : null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existingPayment[0].id))
        .returning();
    } else {
      // Create new payment
      [payment] = await db.insert(payments).values({
        id: generateId("pay"),
        orderId,
        orderNumber: order.orderNumber,
        amount: String(amount),
        currency: "AED",
        method,
        status: method === "cod" ? "pending" : "captured",
        gatewayTransactionId,
        cardBrand: method === "card" ? "Visa" : null,
        cardLast4: method === "card" ? "4242" : null,
        cardExpiryMonth: method === "card" ? 12 : null,
        cardExpiryYear: method === "card" ? 2028 : null,
        refundedAmount: "0",
        refunds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
    }

    // Update order
    const ordersInDb = await db.select().from(orders).where(eq(orders.id, orderId));
    if (ordersInDb.length > 0) {
      let statusHistory = (ordersInDb[0].statusHistory as any[]) || [];
      statusHistory.push({
        status: ordersInDb[0].status,
        changedBy: "system",
        changedAt: new Date().toISOString(),
        notes: `Payment status updated to ${payment.status} via ${method}`
      });

      await db.update(orders)
        .set({
          paymentStatus: payment.status,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

    const response: ApiResponse<typeof payment> = {
      success: true,
      data: payment,
      message: method === "cod" ? "Order confirmed. Pay on delivery." : "Payment successful",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process payment",
    };
    res.status(500).json(response);
  }
};

// POST /api/payments/:id/refund - Refund payment
const refundPayment: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const processedBy = req.headers["x-user-id"] as string || "admin";

    const validation = refundSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const { amount, reason } = validation.data;

    const paymentResult = await db.select().from(payments).where(eq(payments.id, id));
    if (paymentResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Payment not found",
      };
      return res.status(404).json(response);
    }

    const payment = paymentResult[0];

    // Validate refund amount
    const maxRefundable = Number(payment.amount) - Number(payment.refundedAmount || 0);
    if (amount > maxRefundable) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Maximum refundable amount is AED ${maxRefundable.toFixed(2)}`,
      };
      return res.status(400).json(response);
    }

    // Process refund with gateway (for card payments)
    if (payment.method === "card" && payment.gatewayTransactionId) {
      const refundResult = await processRefundWithGateway(payment.gatewayTransactionId, amount);
      if (!refundResult.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: refundResult.error,
        };
        return res.status(400).json(response);
      }
    }

    // Create refund record
    const refund: PaymentRefund = {
      id: generateId("ref"),
      amount,
      reason,
      status: "completed",
      processedBy,
      createdAt: new Date().toISOString(),
    };

    const existingRefunds = (payment.refunds as PaymentRefund[]) || [];
    const newRefunds = [...existingRefunds, refund];
    const newRefundedAmount = Number(payment.refundedAmount || 0) + amount;
    const newStatus = newRefundedAmount >= Number(payment.amount) ? "refunded" : "partially_refunded";

    const [updated] = await db.update(payments)
      .set({
        refunds: newRefunds,
        refundedAmount: String(newRefundedAmount),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    // Update order
    const ordersInDb = await db.select().from(orders).where(eq(orders.id, payment.orderId));
    if (ordersInDb.length > 0) {
      const currentOrder = ordersInDb[0];
      let statusHistory = (currentOrder.statusHistory as any[]) || [];
      statusHistory.push({
        status: newStatus === "refunded" ? "refunded" : currentOrder.status,
        changedBy: processedBy,
        changedAt: new Date().toISOString(),
        notes: `Refund processed: AED ${amount.toFixed(2)}. Reason: ${reason}`
      });

      await db.update(orders)
        .set({
          paymentStatus: newStatus,
          status: newStatus === "refunded" ? "refunded" : undefined,
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, payment.orderId));
    }

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: `Refund of AED ${amount.toFixed(2)} processed successfully`,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process refund",
    };
    res.status(500).json(response);
  }
};

// GET /api/payments/stats - Get payment statistics
const getPaymentStats: RequestHandler = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let allPayments = await db.select().from(payments);

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate as string);
      allPayments = allPayments.filter((p) => new Date(p.createdAt) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      allPayments = allPayments.filter((p) => new Date(p.createdAt) <= end);
    }

    const stats = {
      totalPayments: allPayments.length,
      totalAmount: allPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      capturedAmount: allPayments
        .filter((p) => p.status === "captured")
        .reduce((sum, p) => sum + Number(p.amount), 0),
      refundedAmount: allPayments.reduce((sum, p) => sum + Number(p.refundedAmount || 0), 0),
      pendingAmount: allPayments
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + Number(p.amount), 0),
      failedPayments: allPayments.filter((p) => p.status === "failed").length,
      byMethod: {
        card: allPayments.filter((p) => p.method === "card").length,
        cod: allPayments.filter((p) => p.method === "cod").length,
        bankTransfer: allPayments.filter((p) => p.method === "bank_transfer").length,
      },
      byStatus: {
        pending: allPayments.filter((p) => p.status === "pending").length,
        captured: allPayments.filter((p) => p.status === "captured").length,
        failed: allPayments.filter((p) => p.status === "failed").length,
        refunded: allPayments.filter((p) => p.status === "refunded").length,
        partiallyRefunded: allPayments.filter((p) => p.status === "partially_refunded").length,
      },
    };

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch payment stats",
    };
    res.status(500).json(response);
  }
};

// POST /api/payments/:id/capture - Capture authorized payment
const capturePayment: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentResult = await db.select().from(payments).where(eq(payments.id, id));

    if (paymentResult.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Payment not found",
      };
      return res.status(404).json(response);
    }

    const payment = paymentResult[0];

    if (payment.status !== "authorized" && payment.status !== "pending") {
      const response: ApiResponse<null> = {
        success: false,
        error: `Cannot capture payment with status: ${payment.status}`,
      };
      return res.status(400).json(response);
    }

    // Update payment status
    const [updated] = await db.update(payments)
      .set({
        status: "captured",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    // Update order
    const ordersInDb = await db.select().from(orders).where(eq(orders.id, payment.orderId));
    if (ordersInDb.length > 0) {
      const currentOrder = ordersInDb[0];
      let statusHistory = (currentOrder.statusHistory as any[]) || [];
      statusHistory.push({
        status: currentOrder.status,
        changedBy: "admin",
        changedAt: new Date().toISOString(),
        notes: "Payment captured manually"
      });

      await db.update(orders)
        .set({
          paymentStatus: "captured",
          statusHistory,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, payment.orderId));
    }

    const response: ApiResponse<typeof updated> = {
      success: true,
      data: updated,
      message: "Payment captured successfully",
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to capture payment",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getPayments);
router.get("/stats", getPaymentStats);
router.get("/:id", getPaymentById);
router.get("/order/:orderId", getPaymentByOrderId);
router.post("/process", processPayment);
router.post("/:id/refund", refundPayment);
router.post("/:id/capture", capturePayment);

export default router;
