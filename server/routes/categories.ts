/**
 * Product Categories Routes
 * CRUD operations for categories using PostgreSQL
 */

import { Router, RequestHandler } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, productCategories } from "../db/connection";
import { ApiResponse } from "@shared/api";

const router = Router();

// Helper to generate unique ID
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Validation schemas
const createCategorySchema = z.object({
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

// GET /api/categories - Get all categories
const getCategories: RequestHandler = async (_req, res) => {
  try {
    const result = await db.select().from(productCategories);
    
    // Sort by sortOrder, then name
    result.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.nameEn.localeCompare(b.nameEn);
    });

    const response: ApiResponse<any[]> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error("Error fetching categories:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch categories",
    };
    res.status(500).json(response);
  }
};

// POST /api/categories - Create new category
const createCategory: RequestHandler = async (req, res) => {
  try {
    const validation = createCategorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      });
    }

    const data = validation.data;
    const id = generateId("cat");

    const newCategory = {
      id,
      nameEn: data.nameEn,
      nameAr: data.nameAr,
      icon: data.icon || "🥩",
      color: data.color || "bg-red-100 text-red-600",
      sortOrder: data.sortOrder || 0,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(productCategories).values(newCategory);

    res.status(201).json({
      success: true,
      data: newCategory,
      message: "Category created successfully",
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create category",
    });
  }
};

// PUT /api/categories/:id - Update category
const updateCategory: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateCategorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors.map((e) => e.message).join(", "),
      });
    }

    const data = validation.data;
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await db.update(productCategories).set(updateData).where(eq(productCategories.id, id));

    res.json({
      success: true,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update category",
    });
  }
};

// DELETE /api/categories/:id - Delete category
const deleteCategory: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(productCategories).where(eq(productCategories.id, id));
    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete category",
    });
  }
};

router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
