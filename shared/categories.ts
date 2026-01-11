/**
 * Shared Categories Configuration
 * Used by both frontend (homepage, products) and admin
 */

export interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
}

export const PRODUCT_CATEGORIES: Category[] = [
  { id: "Beef", nameEn: "Beef", nameAr: "لحم بقري", icon: "🥩", color: "bg-red-100 text-red-600" },
  { id: "Lamb", nameEn: "Lamb", nameAr: "لحم ضأن", icon: "🍖", color: "bg-orange-100 text-orange-600" },
  { id: "Goat", nameEn: "Goat", nameAr: "لحم ماعز", icon: "🐐", color: "bg-amber-100 text-amber-600" },
  { id: "Chicken", nameEn: "Chicken", nameAr: "دجاج", icon: "🍗", color: "bg-yellow-100 text-yellow-600" },
  { id: "Marinated", nameEn: "Marinated", nameAr: "متبل", icon: "🌿", color: "bg-green-100 text-green-600" },
  { id: "Premium", nameEn: "Premium", nameAr: "فاخر", icon: "⭐", color: "bg-purple-100 text-purple-600" },
];

// Get category by ID
export function getCategoryById(id: string): Category | undefined {
  return PRODUCT_CATEGORIES.find(cat => cat.id.toLowerCase() === id.toLowerCase());
}

// Get all category IDs
export function getCategoryIds(): string[] {
  return PRODUCT_CATEGORIES.map(cat => cat.id);
}

// Get category name based on language
export function getCategoryName(id: string, language: 'en' | 'ar'): string {
  const category = getCategoryById(id);
  if (!category) return id;
  return language === 'ar' ? category.nameAr : category.nameEn;
}
