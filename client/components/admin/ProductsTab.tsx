/**
 * Products Management Tab
 * Full CRUD operations for products with image upload, categories, and availability
 */

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  ImagePlus,
  Upload,
  X,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
  MoreVertical,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useProducts, Product } from "@/context/ProductsContext";
import { PRODUCT_CATEGORIES, getCategoryName } from "@shared/categories";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export function ProductsTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const { products, isLoading, refreshProducts, addProduct, updateProduct, deleteProduct } = useProducts();

  // Translations
  const t = {
    productsManagement: isRTL ? "إدارة المنتجات" : "Products Management",
    products: isRTL ? "منتجات" : "products",
    available: isRTL ? "متوفر" : "available",
    unavailable: isRTL ? "غير متوفر" : "unavailable",
    refresh: isRTL ? "تحديث" : "Refresh",
    addProduct: isRTL ? "إضافة منتج" : "Add Product",
    searchPlaceholder: isRTL ? "البحث عن منتج..." : "Search products...",
    allCategories: isRTL ? "جميع الفئات" : "All Categories",
    noProducts: isRTL ? "لا توجد منتجات" : "No products found",
    productName: isRTL ? "اسم المنتج" : "Product Name",
    category: isRTL ? "الفئة" : "Category",
    price: isRTL ? "السعر" : "Price",
    status: isRTL ? "الحالة" : "Status",
    actions: isRTL ? "الإجراءات" : "Actions",
    edit: isRTL ? "تعديل" : "Edit",
    delete: isRTL ? "حذف" : "Delete",
    confirmDelete: isRTL ? "هل أنت متأكد من حذف هذا المنتج؟" : "Are you sure you want to delete this product?",
    cancel: isRTL ? "إلغاء" : "Cancel",
    save: isRTL ? "حفظ" : "Save",
    saving: isRTL ? "جاري الحفظ..." : "Saving...",
    create: isRTL ? "إنشاء" : "Create",
    creating: isRTL ? "جاري الإنشاء..." : "Creating...",
    editProduct: isRTL ? "تعديل المنتج" : "Edit Product",
    addNewProduct: isRTL ? "إضافة منتج جديد" : "Add New Product",
    productNameEn: isRTL ? "اسم المنتج (إنجليزي)" : "Product Name (English)",
    productNameAr: isRTL ? "اسم المنتج (عربي)" : "Product Name (Arabic)",
    productPrice: isRTL ? "السعر (درهم)" : "Price (AED)",
    productCategory: isRTL ? "الفئة" : "Category",
    productDescriptionEn: isRTL ? "الوصف (إنجليزي)" : "Description (English)",
    productDescriptionAr: isRTL ? "الوصف (عربي)" : "Description (Arabic)",
    productImage: isRTL ? "صورة المنتج" : "Product Image",
    productAvailable: isRTL ? "متوفر للبيع" : "Available for Sale",
    outOfStock: isRTL ? "غير متوفر للبيع" : "Out of Stock",
    selectCategory: isRTL ? "اختر الفئة" : "Select Category",
    beef: isRTL ? "لحم بقري" : "Beef",
    lamb: isRTL ? "لحم ضأن" : "Lamb",
    mutton: isRTL ? "لحم خروف" : "Mutton",
    chicken: isRTL ? "دجاج" : "Chicken",
    other: isRTL ? "أخرى" : "Other",
    uploadImage: isRTL ? "رفع صورة" : "Upload Image",
    orEnterUrl: isRTL ? "أو أدخل رابط الصورة" : "Or enter image URL",
    imageUrl: isRTL ? "رابط الصورة" : "Image URL",
    deleteProduct: isRTL ? "حذف المنتج" : "Delete Product",
    deleteWarning: isRTL ? "سيتم حذف هذا المنتج نهائياً ولا يمكن استرجاعه." : "This product will be permanently deleted and cannot be recovered.",
    description: isRTL ? "الوصف" : "Description",
    image: isRTL ? "الصورة" : "Image",
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editModal, setEditModal] = useState<Product | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Product | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Use shared categories for the filter dropdown
  const filterCategories = PRODUCT_CATEGORIES;

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.nameAr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Stats
  const availableCount = products.filter((p) => p.available).length;
  const unavailableCount = products.filter((p) => !p.available).length;

  const handleToggleAvailability = async (product: Product) => {
    await updateProduct(product.id, { available: !product.available });
    setActionMenuId(null);
  };

  const handleDelete = async () => {
    if (deleteModal) {
      await deleteProduct(deleteModal.id);
      setDeleteModal(null);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.productsManagement}</h3>
          <p className="text-sm text-slate-500">
            {products.length} {t.products} • {availableCount} {t.available} • {unavailableCount} {t.unavailable}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.addProduct}
          </button>
          <button
            onClick={refreshProducts}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            {t.refresh}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400",
                isRTL ? "right-3" : "left-3"
              )}
            />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none",
                isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
              )}
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white min-w-[150px]"
            >
              <option value="all">{t.allCategories}</option>
              {filterCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {isRTL ? cat.nameAr : cat.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid/Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t.noProducts}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    className={cn(
                      "px-3 sm:px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:table-cell",
                      isRTL ? "text-right" : "text-left"
                    )}
                  >
                    {t.image}
                  </th>
                  <th
                    className={cn(
                      "px-3 sm:px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap",
                      isRTL ? "text-right" : "text-left"
                    )}
                  >
                    {t.productName}
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden md:table-cell">
                    {t.category}
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {t.price}
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:table-cell">
                    {t.status}
                  </th>
                  <th
                    className={cn(
                      "px-3 sm:px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap",
                      isRTL ? "text-left" : "text-right"
                    )}
                  >
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    {/* Image */}
                    <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-lg overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Name */}
                    <td className="px-3 sm:px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">
                          {isRTL && product.nameAr ? product.nameAr : product.name}
                        </p>
                        {isRTL && product.name && (
                          <p className="text-xs text-slate-500 truncate hidden sm:block">{product.name}</p>
                        )}
                        {!isRTL && product.nameAr && (
                          <p className="text-xs text-slate-500 truncate hidden sm:block">{product.nameAr}</p>
                        )}
                        {/* Show category on mobile under name */}
                        <p className="text-xs text-slate-500 md:hidden">{product.category}</p>
                      </div>
                    </td>
                    {/* Category */}
                    <td className="px-3 sm:px-4 py-3 text-center hidden md:table-cell">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        {product.category}
                      </span>
                    </td>
                    {/* Price */}
                    <td className="px-3 sm:px-4 py-3 text-center font-semibold text-slate-900 text-xs sm:text-sm">
                      {product.price.toFixed(2)} <span className="text-xs text-slate-500">AED</span>
                    </td>
                    {/* Status */}
                    <td className="px-3 sm:px-4 py-3 text-center hidden sm:table-cell">
                      {product.available ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <Eye className="w-3 h-3" />
                          <span className="hidden lg:inline">{t.available}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          <EyeOff className="w-3 h-3" />
                          <span className="hidden lg:inline">{t.unavailable}</span>
                        </span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-3 sm:px-4 py-3">
                      <div className={cn("flex items-center gap-1 sm:gap-2", isRTL ? "justify-start" : "justify-end")}>
                        <button
                          onClick={() => setEditModal(product)}
                          className="p-1.5 sm:p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                          title={t.edit}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleAvailability(product)}
                          className={cn(
                            "p-1.5 sm:p-2 rounded-lg transition-colors",
                            product.available
                              ? "text-green-600 hover:bg-green-50"
                              : "text-red-600 hover:bg-red-50"
                          )}
                          title={product.available ? t.unavailable : t.available}
                        >
                          {product.available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeleteModal(product)}
                          className="p-1.5 sm:p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {addModal && (
        <ProductFormModal
          onClose={() => setAddModal(false)}
          onSave={async (data) => {
            await addProduct(data);
            setAddModal(false);
          }}
          isRTL={isRTL}
          t={t}
          mode="add"
        />
      )}

      {/* Edit Product Modal */}
      {editModal && (
        <ProductFormModal
          product={editModal}
          onClose={() => setEditModal(null)}
          onSave={async (data) => {
            await updateProduct(editModal.id, data);
            setEditModal(null);
          }}
          isRTL={isRTL}
          t={t}
          mode="edit"
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <DeleteConfirmModal
          product={deleteModal}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDelete}
          isRTL={isRTL}
          t={t}
        />
      )}
    </div>
  );
}

interface ProductFormModalProps {
  product?: Product;
  onClose: () => void;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  isRTL: boolean;
  t: Record<string, string>;
  mode: "add" | "edit";
}

function ProductFormModal({ product, onClose, onSave, isRTL, t, mode }: ProductFormModalProps) {
  const [name, setName] = useState(product?.name || "");
  const [nameAr, setNameAr] = useState(product?.nameAr || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [category, setCategory] = useState(product?.category || "");
  const [description, setDescription] = useState(product?.description || "");
  const [descriptionAr, setDescriptionAr] = useState(product?.descriptionAr || "");
  const [imageUrl, setImageUrl] = useState(product?.image || "");
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image || null);
  const [available, setAvailable] = useState(product?.available ?? true);
  const [submitting, setSubmitting] = useState(false);

  // Use shared categories
  const categories = PRODUCT_CATEGORIES.map(cat => ({
    value: cat.id,
    label: isRTL ? cat.nameAr : cat.nameEn,
  }));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setImageUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlChange = (url: string) => {
    setImageUrl(url);
    setImagePreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !category || !description) return;

    setSubmitting(true);
    try {
      await onSave({
        name,
        nameAr: nameAr || undefined,
        price: parseFloat(price),
        category,
        description,
        descriptionAr: descriptionAr || undefined,
        image: imageUrl || undefined,
        available,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "add" ? t.addNewProduct : t.editProduct}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Image Upload Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">{t.productImage}</label>
            <div className="flex items-start gap-4">
              {/* Image Preview */}
              <div className="w-32 h-32 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => setImagePreview(null)}
                  />
                ) : (
                  <ImagePlus className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-3">
                {/* File Upload Button */}
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors w-fit">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.uploadImage}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                {/* URL Input */}
                <div>
                  <p className="text-xs text-slate-500 mb-1">{t.orEnterUrl}</p>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => handleImageUrlChange(e.target.value)}
                    placeholder={t.imageUrl}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.productNameEn} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Premium Beef Steak"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.productNameAr}</label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="ستيك لحم بقري ممتاز"
                dir="rtl"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Price and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.productPrice} *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0.01"
                step="0.01"
                required
                placeholder="99.99"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.productCategory} *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
              >
                <option value="">{t.selectCategory}</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description Fields */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.productDescriptionEn} *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Premium quality beef steak, perfect for grilling..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.productDescriptionAr}</label>
            <textarea
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              rows={3}
              placeholder="ستيك لحم بقري عالي الجودة، مثالي للشوي..."
              dir="rtl"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Availability Toggle */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3">
            <label className="block text-sm font-medium text-slate-700">{t.status}</label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAvailable(!available)}
                  className={cn(
                    "relative inline-flex h-7 w-14 items-center rounded-full transition-colors",
                    available ? "bg-green-500" : "bg-red-400"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm",
                      available ? (isRTL ? "translate-x-1" : "translate-x-8") : isRTL ? "translate-x-8" : "translate-x-1"
                    )}
                  />
                </button>
                <span className={cn(
                  "text-sm font-semibold",
                  available ? "text-green-600" : "text-red-600"
                )}>
                  {available ? t.available : t.unavailable}
                </span>
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                available 
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
              )}>
                {available ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {available ? t.productAvailable : t.outOfStock}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
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
              disabled={submitting || !name || !price || !category || !description}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (mode === "add" ? t.creating : t.saving) : mode === "add" ? t.create : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isRTL: boolean;
  t: Record<string, string>;
}

function DeleteConfirmModal({ product, onClose, onConfirm, isRTL, t }: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-red-600">{t.deleteProduct}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            {product.image ? (
              <img src={product.image} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                <Package className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">
                {isRTL && product.nameAr ? product.nameAr : product.name}
              </p>
              <p className="text-sm text-slate-500">{product.category}</p>
              <p className="text-sm font-medium text-primary">{product.price.toFixed(2)} AED</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-lg p-4">
            <p className="text-sm text-red-700">{t.deleteWarning}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? "..." : t.delete}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
