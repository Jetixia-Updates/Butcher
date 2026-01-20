/**
 * Banners Management Tab
 * Manage hero carousel banners and promotional content
 */

import React, { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  X,
  Eye,
  EyeOff,
  GripVertical,
  ExternalLink,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings, Banner } from "@/context/SettingsContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export function BannersTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const { banners, addBanner, updateBanner, deleteBanner } = useSettings();

  const t = {
    bannersManagement: isRTL ? "إدارة البانرات" : "Banners Management",
    banners: isRTL ? "بانر" : "banners",
    active: isRTL ? "نشط" : "active",
    inactive: isRTL ? "غير نشط" : "inactive",
    addBanner: isRTL ? "إضافة بانر" : "Add Banner",
    noBanners: isRTL ? "لا توجد بانرات" : "No banners found",
    title: isRTL ? "العنوان" : "Title",
    subtitle: isRTL ? "العنوان الفرعي" : "Subtitle",
    image: isRTL ? "الصورة" : "Image",
    link: isRTL ? "الرابط" : "Link",
    status: isRTL ? "الحالة" : "Status",
    actions: isRTL ? "الإجراءات" : "Actions",
    edit: isRTL ? "تعديل" : "Edit",
    delete: isRTL ? "حذف" : "Delete",
    cancel: isRTL ? "إلغاء" : "Cancel",
    save: isRTL ? "حفظ" : "Save",
    create: isRTL ? "إنشاء" : "Create",
    editBanner: isRTL ? "تعديل البانر" : "Edit Banner",
    addNewBanner: isRTL ? "إضافة بانر جديد" : "Add New Banner",
    titleEn: isRTL ? "العنوان (إنجليزي)" : "Title (English)",
    titleAr: isRTL ? "العنوان (عربي)" : "Title (Arabic)",
    subtitleEn: isRTL ? "العنوان الفرعي (إنجليزي)" : "Subtitle (English)",
    subtitleAr: isRTL ? "العنوان الفرعي (عربي)" : "Subtitle (Arabic)",
    imageUrl: isRTL ? "رابط الصورة" : "Image URL",
    bgColor: isRTL ? "لون الخلفية" : "Background Color",
    linkUrl: isRTL ? "رابط الزر" : "Button Link",
    badge: isRTL ? "الشارة (إنجليزي)" : "Badge (English)",
    badgeAr: isRTL ? "الشارة (عربي)" : "Badge (Arabic)",
    enabled: isRTL ? "مفعل" : "Enabled",
    disabled: isRTL ? "معطل" : "Disabled",
    deleteBanner: isRTL ? "حذف البانر" : "Delete Banner",
    deleteWarning: isRTL ? "سيتم حذف هذا البانر نهائياً ولا يمكن استرجاعه." : "This banner will be permanently deleted and cannot be recovered.",
    optional: isRTL ? "اختياري" : "optional",
    preview: isRTL ? "معاينة" : "Preview",
    uploadImage: isRTL ? "رفع صورة" : "Upload Image",
    orEnterUrl: isRTL ? "أو أدخل رابط الصورة" : "Or enter image URL",
    colorPresets: isRTL ? "ألوان جاهزة" : "Color Presets",
  };

  const [editModal, setEditModal] = useState<Banner | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Banner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sort banners by order
  const sortedBanners = [...banners].sort((a, b) => a.order - b.order);

  const activeCount = banners.filter((b) => b.enabled).length;
  const inactiveCount = banners.filter((b) => !b.enabled).length;

  const handleToggleEnabled = async (banner: Banner) => {
    try {
      await updateBanner(banner.id, { enabled: !banner.enabled });
    } catch (error) {
      setError("Failed to update banner status");
    }
  };

  const handleDelete = async () => {
    if (deleteModal) {
      try {
        setIsSubmitting(true);
        await deleteBanner(deleteModal.id);
        setDeleteModal(null);
      } catch (error) {
        setError("Failed to delete banner");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAddBanner = async (data: Omit<Banner, "id">) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await addBanner({ ...data, order: banners.length + 1 });
      setAddModal(false);
    } catch (error) {
      setError("Failed to create banner. Please try again.");
      console.error("Error creating banner:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBanner = async (id: string, data: Partial<Banner>) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await updateBanner(id, data);
      setEditModal(null);
    } catch (error) {
      setError("Failed to update banner. Please try again.");
      console.error("Error updating banner:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.bannersManagement}</h3>
          <p className="text-sm text-slate-500">
            {banners.length} {t.banners} • {activeCount} {t.active} • {inactiveCount} {t.inactive}
          </p>
        </div>
        <button
          onClick={() => setAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addBanner}
        </button>
      </div>

      {/* Banners Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedBanners.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl shadow-sm">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t.noBanners}</p>
          </div>
        ) : (
          sortedBanners.map((banner, index) => (
            <div
              key={banner.id}
              className={cn(
                "bg-white rounded-xl shadow-sm overflow-hidden border-2 transition-all",
                banner.enabled ? "border-green-200" : "border-slate-200 opacity-60"
              )}
            >
              {/* Banner Preview */}
              <div
                className={cn(
                  "relative h-32 bg-gradient-to-r overflow-hidden",
                  banner.bgColor || "from-red-600 to-red-800"
                )}
              >
                {banner.image && (
                  <img
                    src={banner.image}
                    alt={banner.titleEn}
                    className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
                  />
                )}
                <div className="absolute inset-0 p-4 flex flex-col justify-center">
                  {banner.badge && (
                    <span className="inline-block px-2 py-0.5 bg-white/20 rounded text-xs text-white mb-1 w-fit">
                      {isRTL ? banner.badgeAr || banner.badge : banner.badge}
                    </span>
                  )}
                  <h4 className="text-white font-bold text-lg line-clamp-1">
                    {isRTL ? banner.titleAr : banner.titleEn}
                  </h4>
                  <p className="text-white/80 text-sm line-clamp-1">
                    {isRTL ? banner.subtitleAr : banner.subtitleEn}
                  </p>
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="bg-black/30 text-white text-xs px-2 py-0.5 rounded">
                    #{index + 1}
                  </span>
                </div>
              </div>

              {/* Banner Info & Actions */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      {banner.link}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditModal(banner)}
                      className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                      title={t.edit}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleEnabled(banner)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        banner.enabled
                          ? "text-green-600 hover:bg-green-50"
                          : "text-red-600 hover:bg-red-50"
                      )}
                      title={banner.enabled ? t.disabled : t.enabled}
                    >
                      {banner.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setDeleteModal(banner)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {addModal && (
        <BannerFormModal
          onClose={() => setAddModal(false)}
          onSave={handleAddBanner}
          isRTL={isRTL}
          t={t}
          mode="add"
          isSubmitting={isSubmitting}
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <BannerFormModal
          banner={editModal}
          onClose={() => setEditModal(null)}
          onSave={(data) => handleUpdateBanner(editModal.id, data)}
          isRTL={isRTL}
          t={t}
          mode="edit"
          isSubmitting={isSubmitting}
        />
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? "rtl" : "ltr"}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-red-600">{t.deleteBanner}</h2>
              <button onClick={() => setDeleteModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                {deleteModal.image ? (
                  <img src={deleteModal.image} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900">{deleteModal.titleEn}</p>
                  <p className="text-sm text-slate-500">{deleteModal.subtitleEn}</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <p className="text-sm text-red-700">{t.deleteWarning}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
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

interface BannerFormModalProps {
  banner?: Banner;
  onClose: () => void;
  onSave: (data: Omit<Banner, "id">) => void | Promise<void>;
  isRTL: boolean;
  t: Record<string, string>;
  mode: "add" | "edit";
  isSubmitting?: boolean;
}

const COLOR_PRESETS = [
  { name: "Red", value: "from-red-600 to-red-800" },
  { name: "Amber", value: "from-amber-600 to-amber-800" },
  { name: "Green", value: "from-green-600 to-green-800" },
  { name: "Blue", value: "from-blue-600 to-blue-800" },
  { name: "Purple", value: "from-purple-600 to-purple-800" },
  { name: "Pink", value: "from-pink-600 to-pink-800" },
  { name: "Slate", value: "from-slate-700 to-slate-900" },
  { name: "Orange", value: "from-orange-500 to-red-600" },
];

function BannerFormModal({ banner, onClose, onSave, isRTL, t, mode, isSubmitting = false }: BannerFormModalProps) {
  const [titleEn, setTitleEn] = useState(banner?.titleEn || "");
  const [titleAr, setTitleAr] = useState(banner?.titleAr || "");
  const [subtitleEn, setSubtitleEn] = useState(banner?.subtitleEn || "");
  const [subtitleAr, setSubtitleAr] = useState(banner?.subtitleAr || "");
  const [image, setImage] = useState(banner?.image || "");
  const [bgColor, setBgColor] = useState(banner?.bgColor || "from-red-600 to-red-800");
  const [link, setLink] = useState(banner?.link || "/products");
  const [badge, setBadge] = useState(banner?.badge || "");
  const [badgeAr, setBadgeAr] = useState(banner?.badgeAr || "");
  const [enabled, setEnabled] = useState(banner?.enabled ?? true);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn || !subtitleEn) return;

    await onSave({
      titleEn,
      titleAr: titleAr || titleEn,
      subtitleEn,
      subtitleAr: subtitleAr || subtitleEn,
      image,
      bgColor,
      link,
      badge: badge || undefined,
      badgeAr: badgeAr || undefined,
      enabled,
      order: banner?.order || 1,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "add" ? t.addNewBanner : t.editBanner}
          </h2>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Live Preview */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.preview}</label>
            <div
              className={cn(
                "relative h-32 rounded-xl bg-gradient-to-r overflow-hidden",
                bgColor
              )}
            >
              {image && (
                <img
                  src={image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
                  onError={() => {}}
                />
              )}
              <div className="absolute inset-0 p-4 flex flex-col justify-center">
                {badge && (
                  <span className="inline-block px-2 py-0.5 bg-white/20 rounded text-xs text-white mb-1 w-fit">
                    {badge}
                  </span>
                )}
                <h4 className="text-white font-bold text-lg">{titleEn || "Banner Title"}</h4>
                <p className="text-white/80 text-sm">{subtitleEn || "Banner subtitle goes here"}</p>
              </div>
            </div>
          </div>

          {/* Title Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.titleEn} *</label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                required
                placeholder="Premium Quality Meats"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.titleAr}</label>
              <input
                type="text"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="لحوم عالية الجودة"
                dir="rtl"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Subtitle Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.subtitleEn} *</label>
              <input
                type="text"
                value={subtitleEn}
                onChange={(e) => setSubtitleEn(e.target.value)}
                required
                placeholder="Fresh cuts delivered to your door"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.subtitleAr}</label>
              <input
                type="text"
                value={subtitleAr}
                onChange={(e) => setSubtitleAr(e.target.value)}
                placeholder="قطع طازجة تصل إلى باب منزلك"
                dir="rtl"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Badge Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.badge} <span className="text-xs text-slate-400">({t.optional})</span>
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Premium"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.badgeAr} <span className="text-xs text-slate-400">({t.optional})</span>
              </label>
              <input
                type="text"
                value={badgeAr}
                onChange={(e) => setBadgeAr(e.target.value)}
                placeholder="ممتاز"
                dir="rtl"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.image}</label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                {image ? (
                  <img src={image} alt="" className="w-full h-full object-cover" onError={() => setImage("")} />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors w-fit">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.uploadImage}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <p className="text-xs text-slate-500">{t.orEnterUrl}</p>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Background Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t.colorPresets}</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setBgColor(preset.value)}
                  className={cn(
                    "w-10 h-10 rounded-lg bg-gradient-to-r transition-all",
                    preset.value,
                    bgColor === preset.value && "ring-2 ring-offset-2 ring-primary"
                  )}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.linkUrl}</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/products"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          {/* Enabled Toggle */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{t.status}</p>
                <p className="text-sm text-slate-500">{enabled ? t.enabled : t.disabled}</p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={cn(
                  "relative inline-flex h-7 w-14 items-center rounded-full transition-colors",
                  enabled ? "bg-green-500" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm",
                    enabled ? (isRTL ? "translate-x-1" : "translate-x-8") : isRTL ? "translate-x-8" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={!titleEn || !subtitleEn || isSubmitting}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (mode === "add" ? "Creating..." : "Saving...") : (mode === "add" ? t.create : t.save)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
