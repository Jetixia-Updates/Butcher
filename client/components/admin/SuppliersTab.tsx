import React, { useEffect, useMemo, useState } from "react";
import {
  Factory,
  Search,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Globe2,
  CreditCard,
  Star,
  BadgeCheck,
  Building2,
  Wallet,
  AlertCircle,
  Truck,
  Package,
  ShieldCheck,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban,
  BadgeDollarSign,
  CalendarClock,
  Loader2,
  Bell,
  FileText,
} from "lucide-react";
import { suppliersApi } from "@/lib/api";
import type {
  Supplier,
  SupplierStatus,
  SupplierContact,
  SupplierProduct,
  PurchaseOrder,
  CreateSupplierRequest,
  PaymentTerms,
  CreatePurchaseOrderRequest,
  Currency,
} from "@shared/api";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

const statusColors: Record<SupplierStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
};

const paymentLabels: Record<PaymentTerms, string> = {
  net_7: "Net 7",
  net_15: "Net 15",
  net_30: "Net 30",
  net_60: "Net 60",
  cod: "Cash on Delivery",
  prepaid: "Prepaid",
};

interface SuppliersTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

interface SupplierFormState extends Omit<CreateSupplierRequest, "contacts" | "address"> {
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  contacts: Omit<SupplierContact, "id">[];
}

interface PurchaseOrderDraftItem {
  productId: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

function formatCurrency(amount: number | undefined) {
  if (amount === undefined) return "-";
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(amount);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export function SuppliersTab({ onNavigate }: SuppliersTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const t = {
    // Header actions
    notifications: isRTL ? "الإشعارات" : "Notifications",
    viewInvoices: isRTL ? "عرض الفواتير" : "View invoices",
    refresh: isRTL ? "تحديث" : "Refresh",
    newSupplier: isRTL ? "مورد جديد" : "New Supplier",
    
    // Stats cards
    totalSuppliers: isRTL ? "إجمالي الموردين" : "Total Suppliers",
    active: isRTL ? "نشط" : "Active",
    pending: isRTL ? "معلق" : "Pending",
    totalSpend: isRTL ? "إجمالي الإنفاق" : "Total Spend",
    
    // Notifications panel
    supplierNotifications: isRTL ? "إشعارات الموردين" : "Supplier Notifications",
    close: isRTL ? "إغلاق" : "Close",
    noNotifications: isRTL ? "لا توجد إشعارات" : "No notifications",
    pendingPurchaseOrders: isRTL ? "أوامر الشراء المعلقة" : "Pending purchase orders",
    ordersAwaitingAction: isRTL ? "أمر(أوامر) في انتظار الإجراء" : "order(s) awaiting action",
    suppliersCompliance: isRTL ? "الموردين • الامتثال" : "Suppliers • Compliance",
    supplierPendingApproval: isRTL ? "المورد في انتظار الموافقة" : "Supplier pending approval",
    requiresActivation: isRTL ? "يتطلب التفعيل" : "requires activation",
    kycVerification: isRTL ? "التحقق • التحقق من الهوية" : "KYC • Verification",
    items: isRTL ? "عناصر" : "items",
    
    // Filters
    status: isRTL ? "الحالة" : "Status",
    category: isRTL ? "الفئة" : "Category",
    all: isRTL ? "الكل" : "All",
    inactive: isRTL ? "غير نشط" : "Inactive",
    suspended: isRTL ? "معلق" : "Suspended",
    searchPlaceholder: isRTL ? "البحث بالاسم، الكود، البريد، الهاتف" : "Search name, code, email, phone",
    
    // Table headers
    supplier: isRTL ? "المورد" : "Supplier",
    contacts: isRTL ? "جهات الاتصال" : "Contacts",
    terms: isRTL ? "الشروط" : "Terms",
    spend: isRTL ? "الإنفاق" : "Spend",
    performance: isRTL ? "الأداء" : "Performance",
    actions: isRTL ? "الإجراءات" : "Actions",
    view: isRTL ? "عرض" : "View",
    noSuppliersFound: isRTL ? "لم يتم العثور على موردين" : "No suppliers found",
    
    // Table cell labels
    limit: isRTL ? "الحد" : "Limit",
    orders: isRTL ? "الطلبات" : "Orders",
    otd: isRTL ? "التسليم في الوقت" : "OTD",
    quality: isRTL ? "الجودة" : "Quality",
    
    // Supplier detail
    code: isRTL ? "الكود" : "Code",
    website: isRTL ? "الموقع" : "Website",
    notes: isRTL ? "ملاحظات" : "Notes",
    activate: isRTL ? "تفعيل" : "Activate",
    suspend: isRTL ? "تعليق" : "Suspend",
    delete: isRTL ? "حذف" : "Delete",
    creditLimit: isRTL ? "حد الائتمان" : "Credit Limit",
    balance: isRTL ? "الرصيد" : "Balance",
    lastOrder: isRTL ? "آخر طلب" : "Last Order",
    categories: isRTL ? "الفئات" : "Categories",
    
    // Contacts section
    contactsTitle: isRTL ? "جهات الاتصال" : "Contacts",
    addContact: isRTL ? "إضافة جهة اتصال" : "Add Contact",
    primary: isRTL ? "أساسي" : "Primary",
    noContacts: isRTL ? "لا توجد جهات اتصال" : "No contacts",
    contactName: isRTL ? "اسم جهة الاتصال" : "Contact name",
    contactPosition: isRTL ? "منصب جهة الاتصال" : "Contact position",
    contactEmail: isRTL ? "بريد جهة الاتصال" : "Contact email",
    contactPhone: isRTL ? "هاتف جهة الاتصال" : "Contact phone",
    sales: isRTL ? "المبيعات" : "Sales",
    
    // Purchase orders section
    purchaseOrders: isRTL ? "أوامر الشراء" : "Purchase Orders",
    newPO: isRTL ? "أمر شراء جديد" : "New PO",
    noPurchaseOrders: isRTL ? "لا توجد أوامر شراء" : "No purchase orders",
    
    // Products section
    products: isRTL ? "المنتجات" : "Products",
    noSupplierProducts: isRTL ? "لا توجد منتجات للمورد" : "No supplier products",
    quickAddProduct: isRTL ? "إضافة منتج سريع" : "Quick add product",
    sku: isRTL ? "رمز المنتج" : "SKU",
    moq: isRTL ? "الحد الأدنى للطلب" : "MOQ",
    lead: isRTL ? "وقت التسليم" : "Lead",
    perKg: isRTL ? "لكل كجم" : "per kg",
    preferred: isRTL ? "مفضل" : "Preferred",
    productName: isRTL ? "اسم المنتج" : "Product name",
    unitCost: isRTL ? "تكلفة الوحدة" : "Unit cost",
    unitCostPerKg: isRTL ? "تكلفة الوحدة (لكل كجم)" : "Unit cost (per kg)",
    moqGrams: isRTL ? "الحد الأدنى للطلب (جرام)" : "MOQ (grams)",
    leadTimeDays: isRTL ? "وقت التسليم (أيام)" : "Lead time (days)",
    
    // Compliance section
    compliance: isRTL ? "الامتثال" : "Compliance",
    vatTax: isRTL ? "ضريبة القيمة المضافة/الضريبة" : "VAT/Tax",
    paymentTerms: isRTL ? "شروط الدفع" : "Payment terms",
    currency: isRTL ? "العملة" : "Currency",
    
    // New supplier form
    newSupplierTitle: isRTL ? "مورد جديد" : "New Supplier",
    newSupplierDescription: isRTL ? "التقاط البيانات القانونية والمصرفية وبيانات الاتصال الأساسية." : "Capture core legal, banking, and contact data.",
    supplierName: isRTL ? "اسم المورد" : "Supplier Name",
    arabicName: isRTL ? "الاسم بالعربية" : "Arabic Name",
    email: isRTL ? "البريد الإلكتروني" : "Email",
    phone: isRTL ? "الهاتف" : "Phone",
    taxNumber: isRTL ? "الرقم الضريبي / TRN" : "Tax Number / TRN",
    creditLimitAED: isRTL ? "حد الائتمان (درهم)" : "Credit Limit (AED)",
    categoriesComma: isRTL ? "الفئات (مفصولة بفاصلة)" : "Categories (comma separated)",
    address: isRTL ? "العنوان" : "Address",
    street: isRTL ? "الشارع" : "Street",
    city: isRTL ? "المدينة" : "City",
    state: isRTL ? "الولاية" : "State",
    country: isRTL ? "الدولة" : "Country",
    postalCode: isRTL ? "الرمز البريدي" : "Postal Code",
    primaryContact: isRTL ? "جهة الاتصال الأساسية" : "Primary Contact",
    name: isRTL ? "الاسم" : "Name",
    position: isRTL ? "المنصب" : "Position",
    cancel: isRTL ? "إلغاء" : "Cancel",
    createSupplier: isRTL ? "إنشاء مورد" : "Create Supplier",
    
    // Purchase order form
    createPurchaseOrder: isRTL ? "إنشاء أمر شراء" : "Create Purchase Order",
    productId: isRTL ? "معرف المنتج" : "Product ID",
    quantityG: isRTL ? "الكمية (جرام)" : "Quantity (g)",
    unitCostPerKgLabel: isRTL ? "تكلفة الوحدة (لكل كجم)" : "Unit Cost (per kg)",
    addItem: isRTL ? "إضافة عنصر" : "Add Item",
    createPO: isRTL ? "إنشاء أمر الشراء" : "Create PO",
    
    // Validation messages
    validationMessage: isRTL ? "يرجى ملء اسم المورد والبريد الإلكتروني والهاتف واسم جهة الاتصال الأساسية." : "Please fill in supplier name, email, phone, and primary contact name.",
    deleteConfirm: isRTL ? "هل تريد حذف المورد؟ لا يمكن التراجع عن هذا الإجراء إذا لم تكن هناك أوامر شراء معلقة." : "Delete supplier? This cannot be undone if no pending POs.",
    
    // Payment labels
    net7: isRTL ? "صافي 7 أيام" : "Net 7",
    net15: isRTL ? "صافي 15 يوم" : "Net 15",
    net30: isRTL ? "صافي 30 يوم" : "Net 30",
    net60: isRTL ? "صافي 60 يوم" : "Net 60",
    cod: isRTL ? "الدفع عند الاستلام" : "Cash on Delivery",
    prepaid: isRTL ? "مدفوع مقدماً" : "Prepaid",
  };

  const paymentLabelsTranslated: Record<PaymentTerms, string> = {
    net_7: t.net7,
    net_15: t.net15,
    net_30: t.net30,
    net_60: t.net60,
    cod: t.cod,
    prepaid: t.prepaid,
  };

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<{ totalSuppliers: number; activeSuppliers: number; pendingSuppliers: number; totalSpent: number; pendingOrders: number }>({
    totalSuppliers: 0,
    activeSuppliers: 0,
    pendingSuppliers: 0,
    totalSpent: 0,
    pendingOrders: 0,
  });
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filters, setFilters] = useState<{ status: "all" | SupplierStatus; category: string; search: string }>({
    status: "all",
    category: "all",
    search: "",
  });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPoForm, setShowPoForm] = useState(false);
  const [poItems, setPoItems] = useState<PurchaseOrderDraftItem[]>([{ productId: "", quantity: 0, unitCost: 0 }]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [form, setForm] = useState<SupplierFormState>({
    name: "",
    nameAr: "",
    email: "",
    phone: "",
    website: "",
    taxNumber: "",
    paymentTerms: "net_30",
    currency: "AED",
    creditLimit: 0,
    categories: [],
    notes: "",
    address: { street: "", city: "", state: "", country: "UAE", postalCode: "" },
    contacts: [
      { name: "", position: "", email: "", phone: "", isPrimary: true },
    ],
  });

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (filters.status !== "all" && s.status !== filters.status) return false;
      if (filters.category !== "all" && !s.categories.includes(filters.category)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.phone.includes(filters.search)
        );
      }
      return true;
    });
  }, [filters, suppliers]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => s.categories.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [suppliers]);

  const fetchSuppliers = async () => {
    setLoading(true);
    const [listRes, statsRes] = await Promise.all([
      suppliersApi.getAll({ status: filters.status === "all" ? undefined : filters.status, category: filters.category === "all" ? undefined : filters.category, search: filters.search || undefined }),
      suppliersApi.getStats(),
    ]);
    let list: Supplier[] = [];
    if (listRes.success && listRes.data) {
      list = listRes.data;
      setSuppliers(listRes.data);
    }
    if (statsRes.success && statsRes.data) {
      setStats({
        totalSuppliers: statsRes.data.totalSuppliers,
        activeSuppliers: statsRes.data.activeSuppliers,
        pendingSuppliers: statsRes.data.pendingSuppliers,
        totalSpent: statsRes.data.totalSpent,
        pendingOrders: statsRes.data.pendingOrders,
      });
    }
    setLoading(false);
    return list;
  };

  const refreshSelection = async (supplierId: string) => {
    const list = await fetchSuppliers();
    const updated = list.find((s) => s.id === supplierId);
    if (updated) setSelected(updated);
  };

  const loadSupplierRelations = async (supplierId: string) => {
    const [prodRes, poRes] = await Promise.all([
      suppliersApi.getProducts(supplierId),
      suppliersApi.getPurchaseOrders({ supplierId }),
    ]);
    if (prodRes.success && prodRes.data) setProducts(prodRes.data);
    if (poRes.success && poRes.data) setPurchaseOrders(poRes.data);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSelect = async (supplier: Supplier) => {
    setSelected(supplier);
    await loadSupplierRelations(supplier.id);
  };

  const resetForm = () => {
    setForm({
      name: "",
      nameAr: "",
      email: "",
      phone: "",
      website: "",
      taxNumber: "",
      paymentTerms: "net_30",
      currency: "AED",
      creditLimit: 0,
      categories: [],
      notes: "",
      address: { street: "", city: "", state: "", country: "UAE", postalCode: "" },
      contacts: [{ name: "", position: "", email: "", phone: "", isPrimary: true }],
    });
    setPoItems([{ productId: "", quantity: 0, unitCost: 0 }]);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    // Basic client-side validation for required fields
    if (!form.name || !form.email || !form.phone || form.contacts[0].name === "") {
      alert(t.validationMessage);
      return;
    }
    setCreating(true);
    const payload: CreateSupplierRequest = {
      name: form.name,
      nameAr: form.nameAr || undefined,
      email: form.email,
      phone: form.phone,
      website: form.website || undefined,
      taxNumber: form.taxNumber || undefined,
      paymentTerms: form.paymentTerms,
      currency: form.currency,
      creditLimit: form.creditLimit,
      categories: form.categories.length ? form.categories : ["general"],
      notes: form.notes || undefined,
      address: form.address,
      contacts: form.contacts,
    };
    const res = await suppliersApi.create(payload);
    if (res.success && res.data) {
      setShowForm(false);
      resetForm();
      await fetchSuppliers();
      setSelected(res.data);
      await loadSupplierRelations(res.data.id);
    } else if (!res.success && res.error) {
      alert(res.error);
    }
    setCreating(false);
  };

  const handleStatusChange = async (status: SupplierStatus) => {
    if (!selected) return;
    const res = await suppliersApi.updateStatus(selected.id, status);
    if (res.success && res.data) {
      await refreshSelection(selected.id);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const confirmDelete = window.confirm(t.deleteConfirm);
    if (!confirmDelete) return;
    const res = await suppliersApi.delete(selected.id);
    if (res.success) {
      setSelected(null);
      await fetchSuppliers();
    }
  };

  const handleAddContact = async (contact: Omit<SupplierContact, "id">) => {
    if (!selected) return;
    const res = await suppliersApi.addContact(selected.id, contact);
    if (res.success) {
      await refreshSelection(selected.id);
      await loadSupplierRelations(selected.id);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!selected) return;
    const res = await suppliersApi.removeContact(selected.id, contactId);
    if (res.success) {
      await fetchSuppliers();
      await handleSelect(selected);
    }
  };

  const handleAddProduct = async (product: Omit<SupplierProduct, "id" | "supplierId" | "createdAt" | "updatedAt" | "lastPurchasePrice" | "lastPurchaseDate">) => {
    if (!selected) return;
    const res = await suppliersApi.addProduct(selected.id, product);
    if (res.success) {
      await refreshSelection(selected.id);
      await loadSupplierRelations(selected.id);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const items = poItems.filter((i) => i.productId && i.quantity > 0 && i.unitCost > 0);
    if (items.length === 0) return;
    const payload: CreatePurchaseOrderRequest = {
      supplierId: selected.id,
      items,
      expectedDeliveryDate: new Date().toISOString(),
      deliveryAddress: selected.address.street,
      shippingCost: 0,
      discount: 0,
    };
    const res = await suppliersApi.createPurchaseOrder(payload);
    if (res.success) {
      setShowPoForm(false);
      setPoItems([{ productId: "", quantity: 0, unitCost: 0 }]);
      await refreshSelection(selected.id);
      await loadSupplierRelations(selected.id);
    }
  };

  const handleViewInvoices = () => {
    onNavigate?.("orders");
  };

  const handleNotifications = () => {
    setNotificationsOpen((o) => !o);
  };

  const promptAddContact = async () => {
    const name = window.prompt(t.contactName);
    if (!name) return;
    const position = window.prompt(t.contactPosition, t.sales);
    const email = window.prompt(t.contactEmail, selected?.email || "");
    const phone = window.prompt(t.contactPhone, selected?.phone || "");
    await handleAddContact({ name, position: position || "", email: email || "", phone: phone || "", isPrimary: false });
  };

  const promptQuickAddProduct = async () => {
    const productNameValue = window.prompt(t.productName, "New Item");
    if (!productNameValue) return;
    const unitCostValue = Number(window.prompt(t.unitCostPerKg, "10"));
    if (!unitCostValue || Number.isNaN(unitCostValue)) return;
    const minimumOrderQuantity = Number(window.prompt(t.moqGrams, "1000")) || 1000;
    const leadTimeDaysValue = Number(window.prompt(t.leadTimeDays, "3")) || 3;
    await handleAddProduct({
      productId: `custom-${Date.now()}`,
      productName: productNameValue,
      supplierSku: "SKU",
      unitCost: unitCostValue,
      minimumOrderQuantity,
      leadTimeDays: leadTimeDaysValue,
      isPreferred: false,
      notes: "",
    });
  };

  const buildNotifications = () => {
    const items = [] as { id: string; title: string; message: string; meta: string }[];
    if (stats.pendingOrders > 0) {
      items.push({
        id: "pending-pos",
        title: t.pendingPurchaseOrders,
        message: `${stats.pendingOrders} ${t.ordersAwaitingAction}` ,
        meta: t.suppliersCompliance
      });
    }
    purchaseOrders.slice(0, 5).forEach((po) => {
      items.push({
        id: po.id,
        title: `${po.orderNumber} (${po.status})`,
        message: `${po.items.length} ${t.items} • ${formatCurrency(po.total)}`,
        meta: formatDate(po.orderDate),
      });
    });
    if (selected && selected.status === "pending") {
      items.push({
        id: "supplier-pending",
        title: t.supplierPendingApproval,
        message: `${selected.name} ${t.requiresActivation}`,
        meta: t.kycVerification
      });
    }
    return items;
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={handleNotifications}
            className="relative p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            title={t.notifications}
          >
            <Bell className="w-5 h-5" />
            {stats.pendingOrders > 0 && (
              <span className={cn("absolute -top-1 px-1.5 min-w-[18px] h-[18px] text-[11px] bg-red-500 text-white rounded-full flex items-center justify-center", isRTL ? "-left-1" : "-right-1")}>
                {stats.pendingOrders}
              </span>
            )}
          </button>
          <button
            onClick={handleViewInvoices}
            className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            title={t.viewInvoices}
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={fetchSuppliers}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")}/> {t.refresh}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> {t.newSupplier}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label={t.totalSuppliers} value={stats.totalSuppliers} icon={Building2} tone="slate" />
        <StatCard label={t.active} value={stats.activeSuppliers} icon={BadgeCheck} tone="green" />
        <StatCard label={t.pending} value={stats.pendingSuppliers} icon={AlertCircle} tone="amber" />
        <StatCard label={t.totalSpend} value={formatCurrency(stats.totalSpent)} icon={BadgeDollarSign} tone="blue" />
      </div>

      {notificationsOpen && (
        <div className="relative z-10">
          <div className={cn("absolute mt-1 w-full md:w-96 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden", isRTL ? "left-0" : "right-0")} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="font-semibold text-slate-900 flex items-center gap-2"><Bell className="w-4 h-4" /> {t.supplierNotifications}</div>
              <button onClick={() => setNotificationsOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">{t.close}</button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {buildNotifications().length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-500">{t.noNotifications}</div>
              )}
              {buildNotifications().map((n) => (
                <div key={n.id} className="px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-900">{n.title}</div>
                  <div className="text-slate-600">{n.message}</div>
                  <div className="text-xs text-slate-400 mt-1">{n.meta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              label={t.status}
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v as SupplierStatus | "all" }))}
              options={[
                { value: "all", label: t.all },
                { value: "active", label: t.active },
                { value: "pending", label: t.pending },
                { value: "inactive", label: t.inactive },
                { value: "suspended", label: t.suspended },
              ]}
            />
            <Select
              label={t.category}
              value={filters.category}
              onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
              options={[{ value: "all", label: t.all }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </div>
          <div className="relative w-full md:w-72">
            <Search className={cn("w-4 h-4 absolute top-1/2 -translate-y-1/2 text-slate-400", isRTL ? "right-3" : "left-3")} />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder={t.searchPlaceholder}
              className={cn("w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent", isRTL ? "pr-10 pl-4" : "pl-10 pr-4")}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className={cn("px-3 sm:px-4 py-3 text-xs sm:text-sm", isRTL ? "text-right" : "text-left")}>{t.supplier}</th>
                <th className={cn("px-3 sm:px-4 py-3 text-xs sm:text-sm hidden md:table-cell", isRTL ? "text-right" : "text-left")}>{t.contacts}</th>
                <th className={cn("px-3 sm:px-4 py-3 text-xs sm:text-sm hidden lg:table-cell", isRTL ? "text-right" : "text-left")}>{t.terms}</th>
                <th className={cn("px-3 sm:px-4 py-3 text-xs sm:text-sm hidden lg:table-cell", isRTL ? "text-right" : "text-left")}>{t.spend}</th>
                <th className={cn("px-3 sm:px-4 py-3 text-xs sm:text-sm hidden xl:table-cell", isRTL ? "text-right" : "text-left")}>{t.performance}</th>
                <th className={cn("px-3 sm:px-4 py-3 text-xs sm:text-sm", isRTL ? "text-right" : "text-left")}>{t.status}</th>
                <th className={cn("px-3 sm:px-4 py-3 text-xs sm:text-sm", isRTL ? "text-left" : "text-right")}>{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 sm:px-4 py-3">
                    <div className="font-semibold text-slate-900 text-sm">{s.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[150px] sm:max-w-none">{s.code} · {s.email}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{s.address.city}, {s.address.country}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-slate-600 hidden md:table-cell">
                    {s.contacts[0]?.name || "-"}
                    <div className="text-xs text-slate-500">{s.phone}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-slate-600 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      {paymentLabelsTranslated[s.paymentTerms]}
                    </div>
                    <div className="text-xs text-slate-500">{t.limit} {formatCurrency(s.creditLimit)}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-slate-600 hidden lg:table-cell">
                    <div className="font-semibold">{formatCurrency(s.totalSpent)}</div>
                    <div className="text-xs text-slate-500">{t.orders} {s.totalOrders}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-slate-600 hidden xl:table-cell">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" /> {s.rating.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-500">{t.otd} {s.onTimeDeliveryRate}% · {t.quality} {s.qualityScore}%</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusColors[s.status])}>{s.status}</span>
                  </td>
                  <td className={cn("px-3 sm:px-4 py-3", isRTL ? "text-left" : "text-right")}>
                    <button
                      onClick={() => handleSelect(s)}
                      className="text-primary font-semibold hover:underline text-sm"
                    >
                      {t.view}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">{t.noSuppliersFound}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusColors[selected.status])}>{selected.status}</span>
                    <span className="text-xs text-slate-500">{t.code} {selected.code}</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mt-1">{selected.name}</h4>
                  <div className="text-sm text-slate-600 flex flex-wrap gap-2 mt-2">
                    <div className="flex items-center gap-1"><Mail className="w-4 h-4" /> {selected.email}</div>
                    <div className="flex items-center gap-1"><Phone className="w-4 h-4" /> {selected.phone}</div>
                    {selected.website && <div className="flex items-center gap-1"><Globe2 className="w-4 h-4" /> <a className="text-primary" href={selected.website} target="_blank" rel="noreferrer">{t.website}</a></div>}
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4" /> {selected.address.street}, {selected.address.city}, {selected.address.country}
                  </div>
                  {selected.notes && <p className="text-sm text-slate-600 mt-2">{t.notes}: {selected.notes}</p>}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2">
                    <button disabled={selected.status === "active"} onClick={() => handleStatusChange("active")} className={cn("px-3 py-1 text-xs rounded-lg", selected.status === "active" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-green-100 text-green-700")}>{t.activate}</button>
                    <button disabled={selected.status === "suspended"} onClick={() => handleStatusChange("suspended")} className={cn("px-3 py-1 text-xs rounded-lg", selected.status === "suspended" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-red-100 text-red-700")}>{t.suspend}</button>
                  </div>
                  <button onClick={handleDelete} className="px-3 py-1 text-xs rounded-lg bg-slate-100 text-slate-600 hover:bg-red-50">{t.delete}</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm text-slate-700">
                <Metric label={t.creditLimit} value={formatCurrency(selected.creditLimit)} icon={Wallet} />
                <Metric label={t.balance} value={formatCurrency(selected.currentBalance)} icon={BadgeDollarSign} />
                <Metric label={t.lastOrder} value={formatDate(selected.lastOrderAt)} icon={CalendarClock} />
                <Metric label={t.categories} value={selected.categories.join(", ") || "-"} icon={Package} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="w-4 h-4" /> {t.contactsTitle}</div>
                <button
                  onClick={() => promptAddContact()}
                  className="text-sm text-primary flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> {t.addContact}
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {selected.contacts.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-3 flex justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {c.name}
                        {c.isPrimary && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{t.primary}</span>}
                      </div>
                      <div className="text-xs text-slate-500">{c.position}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</div>
                    </div>
                    {!c.isPrimary && (
                      <button onClick={() => handleRemoveContact(c.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {selected.contacts.length === 0 && <p className="text-sm text-slate-500">{t.noContacts}</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><Truck className="w-4 h-4" /> {t.purchaseOrders}</div>
                <button onClick={() => setShowPoForm(true)} className="text-sm text-primary flex items-center gap-1">
                  <Plus className="w-4 h-4" /> {t.newPO}
                </button>
              </div>
              <div className="space-y-2">
                {purchaseOrders.map((po) => (
                  <div key={po.id} className="border border-slate-200 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{po.orderNumber}</div>
                      <div className="text-xs text-slate-500">{po.items.length} {t.items} · {formatCurrency(po.total)} · {po.status}</div>
                    </div>
                    <div className={cn("text-xs text-slate-500", isRTL ? "text-left" : "text-right")}>
                      <div>{formatDate(po.orderDate)}</div>
                      <div className="font-medium text-slate-700">{po.status}</div>
                    </div>
                  </div>
                ))}
                {purchaseOrders.length === 0 && <p className="text-sm text-slate-500">{t.noPurchaseOrders}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3"><Package className="w-4 h-4" /> {t.products}</div>
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="font-semibold text-slate-900">{p.productName}</div>
                    <div className="text-xs text-slate-500">{t.sku} {p.supplierSku || "-"} · {t.moq} {p.minimumOrderQuantity}g · {t.lead} {p.leadTimeDays}d</div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 mt-1">
                      <BadgeDollarSign className="w-4 h-4" /> {formatCurrency(p.unitCost)} {t.perKg}
                      {p.isPreferred && <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">{t.preferred}</span>}
                    </div>
                  </div>
                ))}
                {products.length === 0 && <p className="text-sm text-slate-500">{t.noSupplierProducts}</p>}
              </div>
              <button
                onClick={() => promptQuickAddProduct()}
                className="mt-3 text-sm text-primary flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> {t.quickAddProduct}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3"><ShieldCheck className="w-4 h-4" /> {t.compliance}</div>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> {t.vatTax}: {selected.taxNumber || t.pending}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> {t.paymentTerms}: {paymentLabelsTranslated[selected.paymentTerms]}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> {t.currency}: {selected.currency}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{t.newSupplierTitle}</h4>
                <p className="text-sm text-slate-500">{t.newSupplierDescription}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg"><Ban className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto">
              <Input label={t.supplierName} required value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <Input label={t.arabicName} value={form.nameAr || ""} onChange={(v) => setForm((f) => ({ ...f, nameAr: v }))} />
              <Input label={t.email} required value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
              <Input label={t.phone} required value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              <Input label={t.website} value={form.website || ""} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
              <Input label={t.taxNumber} value={form.taxNumber || ""} onChange={(v) => setForm((f) => ({ ...f, taxNumber: v }))} />
              <Select
                label={t.paymentTerms}
                value={form.paymentTerms}
                onChange={(v) => setForm((f) => ({ ...f, paymentTerms: v as PaymentTerms }))}
                options={Object.entries(paymentLabelsTranslated).map(([value, label]) => ({ value, label }))}
              />
              <Input label={t.creditLimitAED} type="number" value={form.creditLimit?.toString() ?? "0"} onChange={(v) => setForm((f) => ({ ...f, creditLimit: Number(v) }))} />
              <Input label={t.currency} value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v as Currency }))} />
              <Input label={t.categoriesComma} value={form.categories.join(", ")} onChange={(v) => setForm((f) => ({ ...f, categories: v.split(",").map((c) => c.trim()).filter(Boolean) }))} />
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">{t.address}</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <Input label={t.street} value={form.address.street} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, street: v } }))} />
                  <Input label={t.city} value={form.address.city} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, city: v } }))} />
                  <Input label={t.state} value={form.address.state} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, state: v } }))} />
                  <Input label={t.country} value={form.address.country} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, country: v } }))} />
                  <Input label={t.postalCode} value={form.address.postalCode} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, postalCode: v } }))} />
                  <Input label={t.notes} value={form.notes || ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">{t.primaryContact}</label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                  <Input label={t.name} value={form.contacts[0].name} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], name: v }] }))} />
                  <Input label={t.position} value={form.contacts[0].position} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], position: v }] }))} />
                  <Input label={t.email} value={form.contacts[0].email} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], email: v }] }))} />
                  <Input label={t.phone} value={form.contacts[0].phone} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], phone: v }] }))} />
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg">{t.cancel}</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-primary text-white rounded-lg flex items-center gap-2">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}{t.createSupplier}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPoForm && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{t.createPurchaseOrder}</h4>
                <p className="text-sm text-slate-500">{t.supplier}: {selected.name}</p>
              </div>
              <button onClick={() => setShowPoForm(false)} className="p-2 hover:bg-slate-100 rounded-lg"><Ban className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreatePO} className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {poItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-slate-200 rounded-lg p-3">
                  <Input label={t.productId} value={item.productId} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, productId: v } : it))} />
                  <Input label={t.quantityG} type="number" value={item.quantity.toString()} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, quantity: Number(v) } : it))} />
                  <Input label={t.unitCostPerKgLabel} type="number" value={item.unitCost.toString()} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, unitCost: Number(v) } : it))} />
                  <Input label={t.notes} value={item.notes || ""} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, notes: v } : it))} />
                </div>
              ))}
              <div className="flex justify-between">
                <button type="button" onClick={() => setPoItems((arr) => [...arr, { productId: "", quantity: 0, unitCost: 0 }])} className="text-sm text-primary flex items-center gap-1">
                  <Plus className="w-4 h-4" /> {t.addItem}
                </button>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPoForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">{t.createPO}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ElementType; tone: "slate" | "green" | "amber" | "blue" }) {
  const colors: Record<typeof tone, { bg: string; text: string }> = {
    slate: { bg: "bg-slate-50", text: "text-slate-700" },
    green: { bg: "bg-green-50", text: "text-green-700" },
    amber: { bg: "bg-amber-50", text: "text-amber-700" },
    blue: { bg: "bg-blue-50", text: "text-blue-700" },
  } as const;
  return (
    <div className={cn("rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3", colors[tone].bg)}>
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
        <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", colors[tone].text)} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500 truncate">{label}</div>
        <div className="text-sm sm:text-lg font-semibold text-slate-900 truncate">{value}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <Icon className="w-4 h-4 text-slate-400" />
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="text-sm text-slate-700 flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

function Input({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="text-sm text-slate-700 flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}{required ? " *" : ""}</span>
      <input
        value={value}
        required={required}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
      />
    </label>
  );
}
