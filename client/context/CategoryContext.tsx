import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { categoriesApi } from "@/lib/api";
import { Category } from "@shared/api";
import { PRODUCT_CATEGORIES } from "@shared/categories";

interface CategoryContextType {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refreshCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  getCategoryName: (id: string, language?: "en" | "ar") => string;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await categoriesApi.getAll();
      if (response.success && response.data) {
        // If no categories in DB, seed with defaults (optional but helpful)
        if (response.data.length === 0) {
          console.log("No categories found, seeding with defaults...");
          for (const cat of PRODUCT_CATEGORIES) {
             await categoriesApi.create({
               nameEn: cat.nameEn,
               nameAr: cat.nameAr,
               icon: cat.icon,
               color: cat.color,
               sortOrder: 0,
               isActive: true
             });
          }
          const retryResponse = await categoriesApi.getAll();
          if (retryResponse.success && retryResponse.data) {
            setCategories(retryResponse.data);
          }
        } else {
          setCategories(response.data);
        }
      } else {
        setError(response.error || "Failed to fetch categories");
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setError("Failed to fetch categories from server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (category: Omit<Category, "id" | "createdAt" | "updatedAt">) => {
    try {
      const response = await categoriesApi.create(category);
      if (response.success) {
        await fetchCategories();
      } else {
        throw new Error(response.error || "Failed to add category");
      }
    } catch (err) {
      console.error("Failed to add category:", err);
      throw err;
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const response = await categoriesApi.update(id, updates);
      if (response.success) {
        await fetchCategories();
      } else {
        throw new Error(response.error || "Failed to update category");
      }
    } catch (err) {
      console.error("Failed to update category:", err);
      throw err;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const response = await categoriesApi.delete(id);
      if (response.success) {
        await fetchCategories();
      } else {
        throw new Error(response.error || "Failed to delete category");
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
      throw err;
    }
  };

  const getCategoryName = (id: string, language: "en" | "ar" = "en") => {
    const category = categories.find((c) => c.id === id);
    if (!category) return id;
    return language === "ar" ? category.nameAr : category.nameEn;
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        isLoading,
        error,
        refreshCategories: fetchCategories,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryName,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error("useCategories must be used within a CategoryProvider");
  }
  return context;
};
