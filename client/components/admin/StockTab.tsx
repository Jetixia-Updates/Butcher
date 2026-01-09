/**
 * Stock/Inventory Management Tab
 * Manage inventory, restock, and view low stock alerts
 */

import React, { useEffect, useState } from "react";
import {
  Search,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  History,
  Settings,
  X,
} from "lucide-react";
import { stockApi } from "@/lib/api";
import type { StockItem, StockMovement, LowStockAlert } from "@shared/api";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Format weight - always display in kg
 * Converts grams to kilograms with 3 decimal precision
 */
function formatWeight(grams: number, isRTL?: boolean): { value: string; unit: string } {
  return { value: (grams / 1000).toFixed(3), unit: isRTL ? "كجم" : "kg" };
}

function WeightDisplay({ grams, className, isRTL }: { grams: number; className?: string; isRTL?: boolean }) {
  const { value, unit } = formatWeight(grams, isRTL);
  return (
    <span className={className}>
      {value} <span className="text-xs text-slate-400">{unit}</span>
    </span>
  );
}

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export function StockTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  // Translations
  const t = {
    inventoryManagement: isRTL ? 'إدارة المخزون' : 'Inventory Management',
    products: isRTL ? 'منتجات' : 'products',
    lowStockAlerts: isRTL ? 'تنبيهات المخزون المنخفض' : 'low stock alerts',
    refresh: isRTL ? 'تحديث' : 'Refresh',
    inventory: isRTL ? 'المخزون' : 'Inventory',
    alerts: isRTL ? 'تنبيهات المخزون' : 'Low Stock Alerts',
    history: isRTL ? 'سجل الحركة' : 'Movement History',
    searchPlaceholder: isRTL ? 'البحث برقم المنتج...' : 'Search by product ID...',
    noItems: isRTL ? 'لا توجد عناصر في المخزون' : 'No inventory items found',
    product: isRTL ? 'المنتج' : 'Product',
    quantity: isRTL ? 'الكمية' : 'Quantity',
    reserved: isRTL ? 'محجوز' : 'Reserved',
    available: isRTL ? 'متوفر' : 'Available',
    threshold: isRTL ? 'الحد الأدنى' : 'Threshold',
    status: isRTL ? 'الحالة' : 'Status',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    outOfStock: isRTL ? 'نفاد المخزون' : 'Out of Stock',
    lowStock: isRTL ? 'مخزون منخفض' : 'Low Stock',
    inStock: isRTL ? 'متوفر' : 'In Stock',
    restock: isRTL ? 'إعادة التخزين' : 'Restock',
    settings: isRTL ? 'الإعدادات' : 'Settings',
    allWellStocked: isRTL ? 'جميع المنتجات متوفرة بكميات جيدة!' : 'All products are well stocked!',
    current: isRTL ? 'الحالي' : 'Current',
    suggestedReorder: isRTL ? 'كمية الطلب المقترحة' : 'Suggested reorder',
    restockNow: isRTL ? 'إعادة التخزين الآن' : 'Restock Now',
    noMovements: isRTL ? 'لا يوجد سجل حركة' : 'No movement history',
    restockProduct: isRTL ? 'إعادة تخزين المنتج' : 'Restock Product',
    productId: isRTL ? 'رقم المنتج' : 'Product ID',
    currentStock: isRTL ? 'المخزون الحالي' : 'Current Stock',
    quantityToAdd: isRTL ? 'الكمية المراد إضافتها (جرام)' : 'Quantity to Add (grams)',
    enterWeight: isRTL ? 'أدخل الوزن بالجرام (مثال: 500.000 لـ 500 جرام)' : 'Enter weight in grams (e.g., 500.000 for 500g)',
    batchNumber: isRTL ? 'رقم الدفعة (اختياري)' : 'Batch Number (optional)',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    adding: isRTL ? 'جاري الإضافة...' : 'Adding...',
    addStock: isRTL ? 'إضافة مخزون' : 'Add Stock',
    stockSettings: isRTL ? 'إعدادات المخزون' : 'Stock Settings',
    lowStockThreshold: isRTL ? 'حد المخزون المنخفض (جرام)' : 'Low Stock Threshold (grams)',
    thresholdHint: isRTL ? 'تنبيه عندما ينخفض المخزون المتاح عن هذا المستوى (بالجرام)' : 'Alert when available stock falls below this (in grams)',
    reorderPoint: isRTL ? 'نقطة إعادة الطلب (جرام)' : 'Reorder Point (grams)',
    reorderPointHint: isRTL ? 'يوصى بإعادة الطلب عند الوصول لهذا المستوى (بالجرام)' : 'Recommended to reorder when stock reaches this level (in grams)',
    reorderQuantity: isRTL ? 'كمية إعادة الطلب (جرام)' : 'Reorder Quantity (grams)',
    reorderQuantityHint: isRTL ? 'الكمية المقترحة للطلب (بالجرام)' : 'Suggested quantity to order (in grams)',
    saving: isRTL ? 'جاري الحفظ...' : 'Saving...',
    saveSettings: isRTL ? 'حفظ الإعدادات' : 'Save Settings',
  };

  const [stock, setStock] = useState<StockItem[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"inventory" | "alerts" | "history">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [restockModal, setRestockModal] = useState<StockItem | null>(null);
  const [thresholdsModal, setThresholdsModal] = useState<StockItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [stockRes, alertsRes, movementsRes] = await Promise.all([
      stockApi.getAll(),
      stockApi.getAlerts(),
      stockApi.getMovements({ limit: 50 }),
    ]);

    if (stockRes.success && stockRes.data) setStock(stockRes.data);
    if (alertsRes.success && alertsRes.data) setAlerts(alertsRes.data);
    if (movementsRes.success && movementsRes.data) setMovements(movementsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestock = async (productId: string, quantity: number, batchNumber?: string) => {
    const response = await stockApi.restock(productId, quantity, batchNumber);
    if (response.success) {
      await fetchData();
      setRestockModal(null);
    }
  };

  const handleUpdateThresholds = async (
    productId: string,
    lowStockThreshold: number,
    reorderPoint: number,
    reorderQuantity: number
  ) => {
    const response = await stockApi.updateThresholds(productId, lowStockThreshold, reorderPoint, reorderQuantity);
    if (response.success) {
      await fetchData();
      setThresholdsModal(null);
    }
  };

  const filteredStock = stock.filter((item) => {
    if (!searchQuery) return true;
    return item.productId.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.inventoryManagement}</h3>
          <p className="text-sm text-slate-500">
            {stock.length} {t.products} • {alerts.length} {t.lowStockAlerts}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {t.refresh}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-1">
            {[
              { id: "inventory", label: t.inventory, icon: Package },
              { id: "alerts", label: t.alerts, icon: AlertTriangle, count: alerts.length },
              { id: "history", label: t.history, icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as typeof activeView)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeView === tab.id
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      "bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full",
                      isRTL ? "mr-1" : "ml-1"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search (for inventory view) */}
        {activeView === "inventory" && (
          <div className="p-4 border-b border-slate-200">
            <div className="relative max-w-md">
              <Search className={cn(
                "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400",
                isRTL ? "right-3" : "left-3"
              )} />
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
        )}

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activeView === "inventory" ? (
            <InventoryTable
              items={filteredStock}
              onRestock={(item) => setRestockModal(item)}
              onSettings={(item) => setThresholdsModal(item)}
              isRTL={isRTL}
              t={t}
            />
          ) : activeView === "alerts" ? (
            <AlertsList
              alerts={alerts}
              onRestock={(alert) => {
                const item = stock.find((s) => s.productId === alert.productId);
                if (item) setRestockModal(item);
              }}
              isRTL={isRTL}
              t={t}
            />
          ) : (
            <MovementHistory movements={movements} isRTL={isRTL} t={t} />
          )}
        </div>
      </div>

      {/* Restock Modal */}
      {restockModal && (
        <RestockModal
          item={restockModal}
          onClose={() => setRestockModal(null)}
          onRestock={handleRestock}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* Thresholds Modal */}
      {thresholdsModal && (
        <ThresholdsModal
          item={thresholdsModal}
          onClose={() => setThresholdsModal(null)}
          onSave={handleUpdateThresholds}
          isRTL={isRTL}
          t={t}
        />
      )}
    </div>
  );
}

function InventoryTable({
  items,
  onRestock,
  onSettings,
  isRTL,
  t,
}: {
  items: StockItem[];
  onRestock: (item: StockItem) => void;
  onSettings: (item: StockItem) => void;
  isRTL: boolean;
  t: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">{t.noItems}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-right" : "text-left")}>
              {t.product}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
              {t.quantity}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
              {t.reserved}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
              {t.available}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
              {t.threshold}
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
              {t.status}
            </th>
            <th className={cn("px-4 py-3 text-xs font-semibold text-slate-500 uppercase", isRTL ? "text-left" : "text-right")}>
              {t.actions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item) => {
            const isLow = item.availableQuantity <= item.lowStockThreshold;
            const isOut = item.availableQuantity === 0;
            return (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">{item.productId}</span>
                </td>
                <td className="px-4 py-3 text-center font-medium">
                  <WeightDisplay grams={item.quantity} isRTL={isRTL} />
                </td>
                <td className="px-4 py-3 text-center text-slate-500">
                  <WeightDisplay grams={item.reservedQuantity} isRTL={isRTL} />
                </td>
                <td className="px-4 py-3 text-center">
                  <WeightDisplay 
                    grams={item.availableQuantity} 
                    isRTL={isRTL}
                    className={cn(
                      "font-semibold",
                      isOut ? "text-red-600" : isLow ? "text-orange-600" : "text-green-600"
                    )}
                  />
                </td>
                <td className="px-4 py-3 text-center text-slate-500">
                  <WeightDisplay grams={item.lowStockThreshold} isRTL={isRTL} />
                </td>
                <td className="px-4 py-3 text-center">
                  {isOut ? (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      {t.outOfStock}
                    </span>
                  ) : isLow ? (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      {t.lowStock}
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      {t.inStock}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className={cn("flex items-center gap-2", isRTL ? "justify-start" : "justify-end")}>
                    <button
                      onClick={() => onRestock(item)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
                    >
                      <Plus className="w-4 h-4" />
                      {t.restock}
                    </button>
                    <button
                      onClick={() => onSettings(item)}
                      className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      title={t.settings}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AlertsList({
  alerts,
  onRestock,
  isRTL,
  t,
}: {
  alerts: LowStockAlert[];
  onRestock: (alert: LowStockAlert) => void;
  isRTL: boolean;
  t: Record<string, string>;
}) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-green-300 mx-auto mb-4" />
        <p className="text-green-600 font-medium">{t.allWellStocked}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.productId}
          className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">{alert.productName}</p>
              <p className="text-sm text-slate-500">
                {t.current}: {formatWeight(alert.currentQuantity, isRTL).value}{formatWeight(alert.currentQuantity, isRTL).unit} • {t.threshold}: {formatWeight(alert.threshold, isRTL).value}{formatWeight(alert.threshold, isRTL).unit}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={isRTL ? "text-left" : "text-right"}>
              <p className="text-sm text-slate-500">{t.suggestedReorder}</p>
              <p className="font-semibold text-slate-900">{formatWeight(alert.suggestedReorderQuantity, isRTL).value}{formatWeight(alert.suggestedReorderQuantity, isRTL).unit}</p>
            </div>
            <button
              onClick={() => onRestock(alert)}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              {t.restockNow}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MovementHistory({ movements, isRTL, t }: { movements: StockMovement[]; isRTL: boolean; t: Record<string, string> }) {
  if (movements.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">{t.noMovements}</p>
      </div>
    );
  }

  const typeStyles: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    in: { bg: "bg-green-100", text: "text-green-700", icon: Plus },
    out: { bg: "bg-red-100", text: "text-red-700", icon: Minus },
    adjustment: { bg: "bg-blue-100", text: "text-blue-700", icon: Settings },
    reserved: { bg: "bg-yellow-100", text: "text-yellow-700", icon: Package },
    released: { bg: "bg-purple-100", text: "text-purple-700", icon: Package },
  };

  return (
    <div className="space-y-2">
      {movements.map((movement) => {
        const style = typeStyles[movement.type] || typeStyles.adjustment;
        const Icon = style.icon;
        return (
          <div
            key={movement.id}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", style.bg)}>
                <Icon className={cn("w-4 h-4", style.text)} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {movement.productId}
                </p>
                <p className="text-xs text-slate-500">{movement.reason}</p>
              </div>
            </div>
            <div className={isRTL ? "text-left" : "text-right"}>
              <p className={cn("font-semibold", style.text)}>
                {movement.type === "out" ? "-" : "+"}{formatWeight(movement.quantity, isRTL).value}{formatWeight(movement.quantity, isRTL).unit}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(movement.createdAt).toLocaleString(isRTL ? 'ar' : 'en')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RestockModal({
  item,
  onClose,
  onRestock,
  isRTL,
  t,
}: {
  item: StockItem;
  onClose: () => void;
  onRestock: (productId: string, quantity: number, batchNumber?: string) => void;
  isRTL: boolean;
  t: Record<string, string>;
}) {
  const [quantity, setQuantity] = useState(item.reorderQuantity.toString());
  const [batchNumber, setBatchNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onRestock(item.productId, parseFloat(quantity), batchNumber || undefined);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{t.restockProduct}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-500">{t.productId}</p>
            <p className="font-mono font-medium">{item.productId}</p>
          </div>

          <div>
            <p className="text-sm text-slate-500">{t.currentStock}</p>
            <p className="font-medium">
              {formatWeight(item.availableQuantity, isRTL).value}{formatWeight(item.availableQuantity, isRTL).unit} {t.available} ({formatWeight(item.reservedQuantity, isRTL).value}{formatWeight(item.reservedQuantity, isRTL).unit} {t.reserved})
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.quantityToAdd} *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0.001"
              step="0.001"
              required
              placeholder="000.000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">{t.enterWeight}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.batchNumber}
            </label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder={isRTL ? "مثال: BATCH-2026-001" : "e.g., BATCH-2026-001"}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t.adding : t.addStock}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ThresholdsModal({
  item,
  onClose,
  onSave,
  isRTL,
  t,
}: {
  item: StockItem;
  onClose: () => void;
  onSave: (productId: string, lowThreshold: number, reorderPoint: number, reorderQty: number) => void;
  isRTL: boolean;
  t: Record<string, string>;
}) {
  const [lowThreshold, setLowThreshold] = useState(item.lowStockThreshold.toString());
  const [reorderPoint, setReorderPoint] = useState(item.reorderPoint.toString());
  const [reorderQty, setReorderQty] = useState(item.reorderQuantity.toString());
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSave(
      item.productId,
      parseFloat(lowThreshold),
      parseFloat(reorderPoint),
      parseFloat(reorderQty)
    );
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{t.stockSettings}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm text-slate-500">{t.productId}</p>
            <p className="font-mono font-medium">{item.productId}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.lowStockThreshold}
            </label>
            <input
              type="number"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(e.target.value)}
              min="0"
              step="0.001"
              required
              placeholder="000.000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">{t.thresholdHint}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.reorderPoint}
            </label>
            <input
              type="number"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              min="0"
              step="0.001"
              required
              placeholder="000.000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">{t.reorderPointHint}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.reorderQuantity}
            </label>
            <input
              type="number"
              value={reorderQty}
              onChange={(e) => setReorderQty(e.target.value)}
              min="0.001"
              step="0.001"
              required
              placeholder="000.000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">{t.reorderQuantityHint}</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t.saving : t.saveSettings}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
