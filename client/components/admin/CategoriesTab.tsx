/**
 * Categories Management Tab
 * Allows admins to add, edit, delete, and reorder product categories
 */

import React, { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  X,
  Check,
  ChevronUp,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useCategories } from "@/context/CategoryContext";
import { Category } from "@shared/api";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export function CategoriesTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const { categories, isLoading, refreshCategories, addCategory, updateCategory, deleteCategory } = useCategories();

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Category | null>(null);

  const t = {
    categoriesManagement: isRTL ? "إدارة الفئات" : "Categories Management",
    categories: isRTL ? "فئات" : "categories",
    addCategory: isRTL ? "إضافة فئة" : "Add Category",
    editCategory: isRTL ? "تعديل الفئة" : "Edit Category",
    deleteCategory: isRTL ? "حذف الفئة" : "Delete Category",
    deleteWarning: isRTL ? "هل أنت متأكد من حذف هذه الفئة؟ لن يؤثر هذا على المنتجات الموجودة." : "Are you sure you want to delete this category? This won't affect existing products.",
    noCategories: isRTL ? "لا توجد فئات" : "No categories found",
    refresh: isRTL ? "تحديث" : "Refresh",
    nameEn: isRTL ? "الاسم (إنجليزي)" : "Name (English)",
    nameAr: isRTL ? "الاسم (عربي)" : "Name (Arabic)",
    icon: isRTL ? "الأيقونة" : "Icon",
    color: isRTL ? "اللون" : "Color",
    sortOrder: isRTL ? "الترتيب" : "Sort Order",
    active: isRTL ? "نشط" : "Active",
    inactive: isRTL ? "غير نشط" : "Inactive",
    save: isRTL ? "حفظ" : "Save",
    cancel: isRTL ? "إلغاء" : "Cancel",
    create: isRTL ? "إنشاء" : "Create",
    delete: isRTL ? "حذف" : "Delete",
    moveUp: isRTL ? "تحريك لأعلى" : "Move Up",
    moveDown: isRTL ? "تحريك لأسفل" : "Move Down",
    actions: isRTL ? "الإجراءات" : "Actions",
    status: isRTL ? "الحالة" : "Status",
  };

  const handleMoveUp = async (category: Category, index: number) => {
    if (index === 0) return;
    const prevCategory = categories[index - 1];
    try {
      await updateCategory(category.id, { sortOrder: prevCategory.sortOrder });
      await updateCategory(prevCategory.id, { sortOrder: category.sortOrder });
      await refreshCategories();
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  };

  const handleMoveDown = async (category: Category, index: number) => {
    if (index === categories.length - 1) return;
    const nextCategory = categories[index + 1];
    try {
      await updateCategory(category.id, { sortOrder: nextCategory.sortOrder });
      await updateCategory(nextCategory.id, { sortOrder: category.sortOrder });
      await refreshCategories();
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  };

  const handleDelete = async () => {
    if (deleteModal) {
      try {
        await deleteCategory(deleteModal.id);
        setDeleteModal(null);
      } catch (err) {
        console.error("Failed to delete category:", err);
        alert(isRTL ? "فشل حذف الفئة" : "Failed to delete category");
      }
    }
  };

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.categoriesManagement}</h1>
          <p className="text-slate-500 mt-1">
            {categories.length} {t.categories}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.addCategory}
          </button>
          <button
            onClick={refreshCategories}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            {t.refresh}
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : sortedCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">{t.noCategories}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                  {t.sortOrder}
                </th>
                <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                  {t.icon}
                </th>
                <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                  {t.nameEn}
                </th>
                <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                  {t.nameAr}
                </th>
                <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                  {t.color}
                </th>
                <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                  {t.status}
                </th>
                <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedCategories.map((category, index) => (
                <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveUp(category, index)}
                        disabled={index === 0}
                        className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t.moveUp}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium text-slate-600 w-6 text-center">{category.sortOrder}</span>
                      <button
                        onClick={() => handleMoveDown(category, index)}
                        disabled={index === sortedCategories.length - 1}
                        className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t.moveDown}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-2xl">{category.icon}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{category.nameEn}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900" dir="rtl">{category.nameAr}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-medium", category.color)}>
                      {category.nameEn}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      category.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {category.isActive ? t.active : t.inactive}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                        title={t.editCategory}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModal(category)}
                        className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                        title={t.deleteCategory}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Category Modal */}
      {addModal && (
        <CategoryFormModal
          onClose={() => setAddModal(false)}
          onSave={async (data) => {
            try {
              await addCategory({
                ...data,
                isActive: true,
                sortOrder: categories.length + 1,
              });
              setAddModal(false);
            } catch (err: any) {
              console.error("Failed to add category:", err);
              alert(err?.message || (isRTL ? "فشل إضافة الفئة" : "Failed to add category"));
            }
          }}
          isRTL={isRTL}
          t={t}
          mode="add"
        />
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <CategoryFormModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={async (data) => {
            try {
              await updateCategory(editingCategory.id, data);
              setEditingCategory(null);
            } catch (err: any) {
              console.error("Failed to update category:", err);
              alert(err?.message || (isRTL ? "فشل تحديث الفئة" : "Failed to update category"));
            }
          }}
          isRTL={isRTL}
          t={t}
          mode="edit"
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? "rtl" : "ltr"}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-red-600">{t.deleteCategory}</h2>
              <button onClick={() => setDeleteModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <span className="text-3xl">{deleteModal.icon}</span>
                <div>
                  <p className="font-semibold text-slate-900">{isRTL ? deleteModal.nameAr : deleteModal.nameEn}</p>
                  <p className="text-sm text-slate-500">{isRTL ? deleteModal.nameEn : deleteModal.nameAr}</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <p className="text-sm text-red-700">{t.deleteWarning}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModal(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryFormModalProps {
  category?: Category;
  onClose: () => void;
  onSave: (data: { nameEn: string; nameAr: string; icon: string; color: string; isActive?: boolean; sortOrder?: number }) => Promise<void>;
  isRTL: boolean;
  t: Record<string, string>;
  mode: "add" | "edit";
}

function CategoryFormModal({ category, onClose, onSave, isRTL, t, mode }: CategoryFormModalProps) {
  const [nameEn, setNameEn] = useState(category?.nameEn || "");
  const [nameAr, setNameAr] = useState(category?.nameAr || "");
  const [icon, setIcon] = useState(category?.icon || "🥩");
  const [color, setColor] = useState(category?.color || "bg-red-100 text-red-600");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(category?.sortOrder || 0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn || !nameAr) return;

    setSubmitting(true);
    try {
      await onSave({ nameEn, nameAr, icon, color, isActive, sortOrder });
    } finally {
      setSubmitting(false);
    }
  };

  const icons = ["🥩", "🍖", "🐐", "🍗", "🌿", "⭐", "🥓", "🐟"];
  const colors = [
    { label: "Red", value: "bg-red-100 text-red-600" },
    { label: "Orange", value: "bg-orange-100 text-orange-600" },
    { label: "Amber", value: "bg-amber-100 text-amber-600" },
    { label: "Yellow", value: "bg-yellow-100 text-yellow-600" },
    { label: "Green", value: "bg-green-100 text-green-600" },
    { label: "Purple", value: "bg-purple-100 text-purple-600" },
    { label: "Blue", value: "bg-blue-100 text-blue-600" },
    { label: "Slate", value: "bg-slate-100 text-slate-600" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "add" ? t.addCategory : t.editCategory}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.nameEn} *</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="e.g. Wagyu Beef"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.nameAr} *</label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="مثلاً: واغيو بقري"
              dir="rtl"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.icon}</label>
            <div className="flex flex-wrap gap-2">
              {icons.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setIcon(item)}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg border transition-all",
                    icon === item ? "border-primary bg-primary/5 text-xl" : "border-slate-200 hover:bg-slate-50 text-lg"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">{t.color}</label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded-md border transition-all",
                    color === c.value ? "border-primary ring-2 ring-primary/20" : "border-slate-200"
                  )}
                >
                  <span className={cn("inline-block px-2 py-1 rounded", c.value)}>Aa</span>
                </button>
              ))}
            </div>
          </div>

          {mode === "edit" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.sortOrder}</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  min="0"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    isActive ? "bg-green-500" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isActive ? (isRTL ? "-translate-x-5" : "translate-x-5") : "translate-x-0"
                    )}
                  />
                </button>
                <span className="text-sm font-medium text-slate-700">
                  {isActive ? t.active : t.inactive}
                </span>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting || !nameEn || !nameAr}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? "..." : mode === "add" ? t.create : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoriesTab;
