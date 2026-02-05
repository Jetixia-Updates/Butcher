/**
 * Promo Codes Management Tab
 * Full CRUD operations for promotional codes
 */

import React, { useState } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Tag,
  X,
  Eye,
  EyeOff,
  Percent,
  DollarSign,
  Calendar,
  Hash,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings, PromoCode } from "@/context/SettingsContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export function PromoCodesTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const { promoCodes, addPromoCode, updatePromoCode, deletePromoCode } = useSettings();

  const t = {
    promoCodesManagement: isRTL ? "إدارة أكواد الخصم" : "Promo Codes Management",
    promoCodes: isRTL ? "أكواد الخصم" : "promo codes",
    active: isRTL ? "نشط" : "active",
    inactive: isRTL ? "غير نشط" : "inactive",
    addPromoCode: isRTL ? "إضافة كود خصم" : "Add Promo Code",
    searchPlaceholder: isRTL ? "البحث عن كود خصم..." : "Search promo codes...",
    noPromoCodes: isRTL ? "لا توجد أكواد خصم" : "No promo codes found",
    code: isRTL ? "الكود" : "Code",
    discount: isRTL ? "الخصم" : "Discount",
    type: isRTL ? "النوع" : "Type",
    minOrder: isRTL ? "الحد الأدنى" : "Min Order",
    usage: isRTL ? "الاستخدام" : "Usage",
    status: isRTL ? "الحالة" : "Status",
    actions: isRTL ? "الإجراءات" : "Actions",
    edit: isRTL ? "تعديل" : "Edit",
    delete: isRTL ? "حذف" : "Delete",
    cancel: isRTL ? "إلغاء" : "Cancel",
    save: isRTL ? "حفظ" : "Save",
    create: isRTL ? "إنشاء" : "Create",
    editPromoCode: isRTL ? "تعديل كود الخصم" : "Edit Promo Code",
    addNewPromoCode: isRTL ? "إضافة كود خصم جديد" : "Add New Promo Code",
    promoCode: isRTL ? "كود الخصم" : "Promo Code",
    discountValue: isRTL ? "قيمة الخصم" : "Discount Value",
    discountType: isRTL ? "نوع الخصم" : "Discount Type",
    percent: isRTL ? "نسبة مئوية" : "Percentage",
    fixed: isRTL ? "مبلغ ثابت" : "Fixed Amount",
    minOrderValue: isRTL ? "الحد الأدنى للطلب (درهم)" : "Minimum Order Value (AED)",
    maxUses: isRTL ? "الحد الأقصى للاستخدام" : "Maximum Uses",
    expiryDate: isRTL ? "تاريخ الانتهاء" : "Expiry Date",
    description: isRTL ? "الوصف" : "Description",
    enabled: isRTL ? "مفعل" : "Enabled",
    disabled: isRTL ? "معطل" : "Disabled",
    deletePromoCode: isRTL ? "حذف كود الخصم" : "Delete Promo Code",
    deleteWarning: isRTL ? "سيتم حذف هذا الكود نهائياً ولا يمكن استرجاعه." : "This promo code will be permanently deleted and cannot be recovered.",
    copied: isRTL ? "تم النسخ" : "Copied!",
    unlimited: isRTL ? "غير محدود" : "Unlimited",
    expired: isRTL ? "منتهي" : "Expired",
    noMinimum: isRTL ? "لا يوجد حد أدنى" : "No minimum",
    optional: isRTL ? "اختياري" : "optional",
    uses: isRTL ? "استخدام" : "uses",
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [editModal, setEditModal] = useState<PromoCode | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<PromoCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter promo codes
  const filteredCodes = promoCodes.filter((code) => {
    const matchesSearch =
      !searchQuery ||
      code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Stats
  const activeCount = promoCodes.filter((c) => c.enabled).length;
  const inactiveCount = promoCodes.filter((c) => !c.enabled).length;

  const handleToggleEnabled = (code: PromoCode) => {
    updatePromoCode(code.id, { enabled: !code.enabled });
  };

  const handleDelete = () => {
    if (deleteModal) {
      deletePromoCode(deleteModal.id);
      setDeleteModal(null);
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.promoCodesManagement}</h3>
          <p className="text-sm text-slate-500">
            {promoCodes.length} {t.promoCodes} • {activeCount} {t.active} • {inactiveCount} {t.inactive}
          </p>
        </div>
        <button
          onClick={() => setAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addPromoCode}
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
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
      </div>

      {/* Promo Codes Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredCodes.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t.noPromoCodes}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
                    {t.code}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
                    {t.discount}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                    {t.minOrder}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                    {t.usage}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">
                    {t.status}
                  </th>
                  <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-left" : "text-right")}>
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCodes.map((code) => (
                  <tr key={code.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyCode(code.code, code.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          title={t.copied}
                        >
                          {copiedId === code.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <div>
                          <p className="font-mono font-semibold text-slate-900">{code.code}</p>
                          {code.description && (
                            <p className="text-xs text-slate-500">{code.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {code.type === "percent" ? (
                          <>
                            <Percent className="w-3 h-3" />
                            {code.discount}%
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-3 h-3" />
                            {code.discount} AED
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {code.minOrder ? (
                        <span className="text-sm text-slate-700">{code.minOrder} AED</span>
                      ) : (
                        <span className="text-xs text-slate-400">{t.noMinimum}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-sm text-slate-700">
                        {code.usedCount} / {code.maxUses || "∞"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {isExpired(code.expiryDate) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                          <Calendar className="w-3 h-3" />
                          {t.expired}
                        </span>
                      ) : code.enabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <Eye className="w-3 h-3" />
                          {t.active}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          <EyeOff className="w-3 h-3" />
                          {t.inactive}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn("flex items-center gap-1", isRTL ? "justify-start" : "justify-end")}>
                        <button
                          onClick={() => setEditModal(code)}
                          className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                          title={t.edit}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(code)}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            code.enabled
                              ? "text-green-600 hover:bg-green-50"
                              : "text-red-600 hover:bg-red-50"
                          )}
                          title={code.enabled ? t.disabled : t.enabled}
                        >
                          {code.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeleteModal(code)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Add Modal */}
      {addModal && (
        <PromoCodeFormModal
          onClose={() => setAddModal(false)}
          onSave={async (data) => {
            const result = await addPromoCode(data);
            if (result.success) {
              setAddModal(false);
            } else {
              alert(result.error || "Failed to create promo code. The code may already exist.");
            }
          }}
          isRTL={isRTL}
          t={t}
          mode="add"
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <PromoCodeFormModal
          promoCode={editModal}
          onClose={() => setEditModal(null)}
          onSave={(data) => {
            updatePromoCode(editModal.id, data);
            setEditModal(null);
          }}
          isRTL={isRTL}
          t={t}
          mode="edit"
        />
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? "rtl" : "ltr"}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-red-600">{t.deletePromoCode}</h2>
              <button onClick={() => setDeleteModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <Tag className="w-10 h-10 text-slate-400" />
                <div>
                  <p className="font-mono font-bold text-slate-900">{deleteModal.code}</p>
                  <p className="text-sm text-slate-500">
                    {deleteModal.type === "percent" ? `${deleteModal.discount}%` : `${deleteModal.discount} AED`} off
                  </p>
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

interface PromoCodeFormModalProps {
  promoCode?: PromoCode;
  onClose: () => void;
  onSave: (data: Omit<PromoCode, "id" | "usedCount">) => void;
  isRTL: boolean;
  t: Record<string, string>;
  mode: "add" | "edit";
}

function PromoCodeFormModal({ promoCode, onClose, onSave, isRTL, t, mode }: PromoCodeFormModalProps) {
  const [code, setCode] = useState(promoCode?.code || "");
  const [discount, setDiscount] = useState(promoCode?.discount?.toString() || "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(promoCode?.type || "percent");
  const [minOrder, setMinOrder] = useState(promoCode?.minOrder?.toString() || "");
  const [maxUses, setMaxUses] = useState(promoCode?.maxUses?.toString() || "");
  const [expiryDate, setExpiryDate] = useState(promoCode?.expiryDate || "");
  const [description, setDescription] = useState(promoCode?.description || "");
  const [enabled, setEnabled] = useState(promoCode?.enabled ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discount) return;

    onSave({
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      type: discountType,
      minOrder: minOrder ? parseFloat(minOrder) : undefined,
      maxUses: maxUses ? parseInt(maxUses) : undefined,
      expiryDate: expiryDate || undefined,
      description: description || undefined,
      enabled,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "add" ? t.addNewPromoCode : t.editPromoCode}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.promoCode} *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              placeholder="SAVE20"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono uppercase"
            />
          </div>

          {/* Discount Value and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.discountValue} *
              </label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                min="0"
                step="0.01"
                required
                placeholder="20"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.discountType}
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
              >
                <option value="percent">{t.percent} (%)</option>
                <option value="fixed">{t.fixed} (AED)</option>
              </select>
            </div>
          </div>

          {/* Min Order and Max Uses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.minOrderValue} <span className="text-xs text-slate-400">({t.optional})</span>
              </label>
              <input
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                min="0"
                placeholder="100"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.maxUses} <span className="text-xs text-slate-400">({t.optional})</span>
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                min="0"
                placeholder={t.unlimited}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.expiryDate} <span className="text-xs text-slate-400">({t.optional})</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.description} <span className="text-xs text-slate-400">({t.optional})</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Welcome discount for new customers"
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
              className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={!code || !discount}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mode === "add" ? t.create : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
