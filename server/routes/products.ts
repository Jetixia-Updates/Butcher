/**
 * Products Routes
 * CRUD operations for products using PostgreSQL
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Product, ApiResponse } from "@shared/api";
import { db, products } from "../db/connection";

const router = Router();

// Helper to generate unique ID
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  price: z.number().positive(),
  costPrice: z.number().nonnegative().optional(),
  category: z.string().min(1),
  description: z.string().min(1),
  descriptionAr: z.string().optional(),
  image: z.string().optional(),
  unit: z.enum(["kg", "piece", "gram"]).optional(),
  minOrderQuantity: z.number().positive().optional(),
  maxOrderQuantity: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const updateProductSchema = createProductSchema.partial();

// Helper to convert DB product to API product
function toApiProduct(dbProduct: typeof products.$inferSelect): Product {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    nameAr: dbProduct.nameAr || undefined,
    sku: dbProduct.sku,
    barcode: dbProduct.barcode || undefined,
    price: parseFloat(dbProduct.price),
    costPrice: parseFloat(dbProduct.costPrice),
    category: dbProduct.category,
    description: dbProduct.description || "",
    descriptionAr: dbProduct.descriptionAr || undefined,
    image: dbProduct.image || undefined,
    unit: dbProduct.unit,
    minOrderQuantity: parseFloat(dbProduct.minOrderQuantity),
    maxOrderQuantity: parseFloat(dbProduct.maxOrderQuantity),
    isActive: dbProduct.isActive,
    isFeatured: dbProduct.isFeatured,
    tags: (dbProduct.tags as string[]) || [],
    discount: dbProduct.discount ? parseFloat(dbProduct.discount) : undefined,
    rating: dbProduct.rating ? parseFloat(dbProduct.rating) : undefined,
    badges: (dbProduct.badges as ("halal" | "organic" | "grass-fed" | "premium" | "fresh" | "local")[]) || undefined,
    createdAt: dbProduct.createdAt.toISOString(),
    updatedAt: dbProduct.updatedAt.toISOString(),
  };
}

// GET /api/products - Get all products
const getProducts: RequestHandler = async (req, res) => {
  try {
    const { category, active, featured, search } = req.query;

    let result = await db.select().from(products);

    // Filter by category
    if (category) {
      result = result.filter(
        (p) => p.category.toLowerCase() === (category as string).toLowerCase()
      );
    }

    // Filter by active status
    if (active !== undefined) {
      result = result.filter((p) => p.isActive === (active === "true"));
    }

    // Filter by featured
    if (featured !== undefined) {
      result = result.filter((p) => p.isFeatured === (featured === "true"));
    }

    // Search by name or description
    if (search) {
      const searchLower = (search as string).toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.description && p.description.toLowerCase().includes(searchLower)) ||
          (p.nameAr && p.nameAr.includes(search as string))
      );
    }

    // Convert to API format and sort
    const apiProducts = result.map(toApiProduct);
    apiProducts.sort((a, b) => a.name.localeCompare(b.name));

    const response: ApiResponse<Product[]> = {
      success: true,
      data: apiProducts,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching products:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch products",
    };
    res.status(500).json(response);
  }
};

// GET /api/products/:id - Get product by ID
const getProductById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(products).where(eq(products.id, id));

    if (result.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Product not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Product> = {
      success: true,
      data: toApiProduct(result[0]),
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product",
    };
    res.status(500).json(response);
  }
};

// POST /api/products - Create new product
const createProduct: RequestHandler = async (req, res) => {
  try {
    const validation = createProductSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;

    // Check if SKU already exists
    const existing = await db.select().from(products).where(eq(products.sku, data.sku));
    if (existing.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "A product with this SKU already exists",
      };
      return res.status(400).json(response);
    }

    const newProduct = {
      id: generateId("prod"),
      name: data.name,
      nameAr: data.nameAr || null,
      sku: data.sku,
      barcode: data.barcode || null,
      price: String(data.price),
      costPrice: String(data.costPrice || 0),
      category: data.category,
      description: data.description,
      descriptionAr: data.descriptionAr || null,
      image: data.image || null,
      unit: data.unit || "kg" as const,
      minOrderQuantity: String(data.minOrderQuantity || 0.25),
      maxOrderQuantity: String(data.maxOrderQuantity || 10),
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
      tags: data.tags || [],
    };

    await db.insert(products).values(newProduct);

    const result = await db.select().from(products).where(eq(products.id, newProduct.id));

    const response: ApiResponse<Product> = {
      success: true,
      data: toApiProduct(result[0]),
      message: "Product created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating product:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create product",
    };
    res.status(500).json(response);
  }
};

// PUT /api/products/:id - Update product
const updateProduct: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await db.select().from(products).where(eq(products.id, id));
    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Product not found",
      };
      return res.status(404).json(response);
    }

    const validation = updateProductSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      };
      return res.status(400).json(response);
    }

    const data = validation.data;

    // Check SKU uniqueness if updating
    if (data.sku && data.sku.toLowerCase() !== existing[0].sku.toLowerCase()) {
      const skuCheck = await db.select().from(products).where(eq(products.sku, data.sku));
      if (skuCheck.length > 0 && skuCheck[0].id !== id) {
        const response: ApiResponse<null> = {
          success: false,
          error: "A product with this SKU already exists",
        };
        return res.status(400).json(response);
      }
    }

    // Build update object
    const updateData: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.barcode !== undefined) updateData.barcode = data.barcode;
    if (data.price !== undefined) updateData.price = String(data.price);
    if (data.costPrice !== undefined) updateData.costPrice = String(data.costPrice);
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.minOrderQuantity !== undefined) updateData.minOrderQuantity = String(data.minOrderQuantity);
    if (data.maxOrderQuantity !== undefined) updateData.maxOrderQuantity = String(data.maxOrderQuantity);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.tags !== undefined) updateData.tags = data.tags;

    await db.update(products).set(updateData).where(eq(products.id, id));

    const result = await db.select().from(products).where(eq(products.id, id));

    const response: ApiResponse<Product> = {
      success: true,
      data: toApiProduct(result[0]),
      message: "Product updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating product:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update product",
    };
    res.status(500).json(response);
  }
};

// DELETE /api/products/:id - Delete product (soft delete)
const deleteProduct: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await db.select().from(products).where(eq(products.id, id));
    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Product not found",
      };
      return res.status(404).json(response);
    }

    // Soft delete - just deactivate
    await db.update(products).set({ 
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(products.id, id));

    const response: ApiResponse<null> = {
      success: true,
      message: "Product deleted successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting product:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete product",
    };
    res.status(500).json(response);
  }
};

// Register routes
router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
