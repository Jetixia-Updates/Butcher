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
    if (listRes.success && listRes.data) setSuppliers(listRes.data);
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
      alert("Please fill in supplier name, email, phone, and primary contact name.");
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
      setSelected(res.data);
      await fetchSuppliers();
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const confirmDelete = window.confirm("Delete supplier? This cannot be undone if no pending POs.");
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
      await fetchSuppliers();
      await handleSelect(selected);
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
      await loadSupplierRelations(selected.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Suppliers</h3>
            <p className="text-sm text-slate-500">International supplier lifecycle: onboarding, scoring, compliance, and POs.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchSuppliers}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")}/> Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> New Supplier
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Suppliers" value={stats.totalSuppliers} icon={Building2} tone="slate" />
        <StatCard label="Active" value={stats.activeSuppliers} icon={BadgeCheck} tone="green" />
        <StatCard label="Pending" value={stats.pendingSuppliers} icon={AlertCircle} tone="amber" />
        <StatCard label="Total Spend" value={formatCurrency(stats.totalSpent)} icon={BadgeDollarSign} tone="blue" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              label="Status"
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v as SupplierStatus | "all" }))}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "pending", label: "Pending" },
                { value: "inactive", label: "Inactive" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
            <Select
              label="Category"
              value={filters.category}
              onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
              options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search name, code, email, phone"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Contacts</th>
                <th className="text-left px-4 py-3">Terms</th>
                <th className="text-left px-4 py-3">Spend</th>
                <th className="text-left px-4 py-3">Performance</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.code} · {s.email}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" /> {s.address.city}, {s.address.country}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.contacts[0]?.name || "-"}
                    <div className="text-xs text-slate-500">{s.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      {paymentLabels[s.paymentTerms]}
                    </div>
                    <div className="text-xs text-slate-500">Limit {formatCurrency(s.creditLimit)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="font-semibold">{formatCurrency(s.totalSpent)}</div>
                    <div className="text-xs text-slate-500">Orders {s.totalOrders}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" /> {s.rating.toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-500">OTD {s.onTimeDeliveryRate}% · Quality {s.qualityScore}%</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusColors[s.status])}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSelect(s)}
                      className="text-primary font-semibold hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">No suppliers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", statusColors[selected.status])}>{selected.status}</span>
                    <span className="text-xs text-slate-500">Code {selected.code}</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mt-1">{selected.name}</h4>
                  <div className="text-sm text-slate-600 flex flex-wrap gap-2 mt-2">
                    <div className="flex items-center gap-1"><Mail className="w-4 h-4" /> {selected.email}</div>
                    <div className="flex items-center gap-1"><Phone className="w-4 h-4" /> {selected.phone}</div>
                    {selected.website && <div className="flex items-center gap-1"><Globe2 className="w-4 h-4" /> <a className="text-primary" href={selected.website} target="_blank" rel="noreferrer">Website</a></div>}
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4" /> {selected.address.street}, {selected.address.city}, {selected.address.country}
                  </div>
                  {selected.notes && <p className="text-sm text-slate-600 mt-2">Notes: {selected.notes}</p>}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2">
                    <button onClick={() => handleStatusChange("active")} className="px-3 py-1 text-xs rounded-lg bg-green-100 text-green-700">Activate</button>
                    <button onClick={() => handleStatusChange("suspended")} className="px-3 py-1 text-xs rounded-lg bg-red-100 text-red-700">Suspend</button>
                  </div>
                  <button onClick={handleDelete} className="px-3 py-1 text-xs rounded-lg bg-slate-100 text-slate-600 hover:bg-red-50">Delete</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm text-slate-700">
                <Metric label="Credit Limit" value={formatCurrency(selected.creditLimit)} icon={Wallet} />
                <Metric label="Balance" value={formatCurrency(selected.currentBalance)} icon={BadgeDollarSign} />
                <Metric label="Last Order" value={formatDate(selected.lastOrderAt)} icon={CalendarClock} />
                <Metric label="Categories" value={selected.categories.join(", ") || "-"} icon={Package} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="w-4 h-4" /> Contacts</div>
                <button
                  onClick={() => handleAddContact({ name: "New Contact", position: "Sales", email: selected.email, phone: selected.phone, isPrimary: false })}
                  className="text-sm text-primary flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {selected.contacts.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-3 flex justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {c.name}
                        {c.isPrimary && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Primary</span>}
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
                {selected.contacts.length === 0 && <p className="text-sm text-slate-500">No contacts</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-semibold text-slate-900"><Truck className="w-4 h-4" /> Purchase Orders</div>
                <button onClick={() => setShowPoForm(true)} className="text-sm text-primary flex items-center gap-1">
                  <Plus className="w-4 h-4" /> New PO
                </button>
              </div>
              <div className="space-y-2">
                {purchaseOrders.map((po) => (
                  <div key={po.id} className="border border-slate-200 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{po.orderNumber}</div>
                      <div className="text-xs text-slate-500">{po.items.length} items · {formatCurrency(po.total)} · {po.status}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{formatDate(po.orderDate)}</div>
                      <div className="font-medium text-slate-700">{po.status}</div>
                    </div>
                  </div>
                ))}
                {purchaseOrders.length === 0 && <p className="text-sm text-slate-500">No purchase orders</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3"><Package className="w-4 h-4" /> Products</div>
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="font-semibold text-slate-900">{p.productName}</div>
                    <div className="text-xs text-slate-500">SKU {p.supplierSku || "-"} · MOQ {p.minimumOrderQuantity}g · Lead {p.leadTimeDays}d</div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 mt-1">
                      <BadgeDollarSign className="w-4 h-4" /> {formatCurrency(p.unitCost)} per kg
                      {p.isPreferred && <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Preferred</span>}
                    </div>
                  </div>
                ))}
                {products.length === 0 && <p className="text-sm text-slate-500">No supplier products</p>}
              </div>
              <button
                onClick={() => handleAddProduct({
                  productId: `custom-${Date.now()}`,
                  productName: "New Item",
                  supplierSku: "SKU",
                  unitCost: 10,
                  minimumOrderQuantity: 1000,
                  leadTimeDays: 3,
                  isPreferred: false,
                  notes: "",
                })}
                className="mt-3 text-sm text-primary flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Quick add product
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-3"><ShieldCheck className="w-4 h-4" /> Compliance</div>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> VAT/Tax: {selected.taxNumber || "Pending"}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Payment terms: {paymentLabels[selected.paymentTerms]}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Currency: {selected.currency}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">New Supplier</h4>
                <p className="text-sm text-slate-500">Capture core legal, banking, and contact data.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg"><Ban className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto">
              <Input label="Supplier Name" required value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <Input label="Arabic Name" value={form.nameAr || ""} onChange={(v) => setForm((f) => ({ ...f, nameAr: v }))} />
              <Input label="Email" required value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
              <Input label="Phone" required value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              <Input label="Website" value={form.website || ""} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
              <Input label="Tax Number / TRN" value={form.taxNumber || ""} onChange={(v) => setForm((f) => ({ ...f, taxNumber: v }))} />
              <Select
                label="Payment Terms"
                value={form.paymentTerms}
                onChange={(v) => setForm((f) => ({ ...f, paymentTerms: v as PaymentTerms }))}
                options={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
              />
              <Input label="Credit Limit (AED)" type="number" value={form.creditLimit?.toString() ?? "0"} onChange={(v) => setForm((f) => ({ ...f, creditLimit: Number(v) }))} />
              <Input label="Currency" value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v as Currency }))} />
              <Input label="Categories (comma separated)" value={form.categories.join(", ")} onChange={(v) => setForm((f) => ({ ...f, categories: v.split(",").map((c) => c.trim()).filter(Boolean) }))} />
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Address</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <Input label="Street" value={form.address.street} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, street: v } }))} />
                  <Input label="City" value={form.address.city} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, city: v } }))} />
                  <Input label="State" value={form.address.state} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, state: v } }))} />
                  <Input label="Country" value={form.address.country} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, country: v } }))} />
                  <Input label="Postal Code" value={form.address.postalCode} onChange={(v) => setForm((f) => ({ ...f, address: { ...f.address, postalCode: v } }))} />
                  <Input label="Notes" value={form.notes || ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Primary Contact</label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                  <Input label="Name" value={form.contacts[0].name} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], name: v }] }))} />
                  <Input label="Position" value={form.contacts[0].position} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], position: v }] }))} />
                  <Input label="Email" value={form.contacts[0].email} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], email: v }] }))} />
                  <Input label="Phone" value={form.contacts[0].phone} onChange={(v) => setForm((f) => ({ ...f, contacts: [{ ...f.contacts[0], phone: v }] }))} />
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-primary text-white rounded-lg flex items-center gap-2">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}Create Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPoForm && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Create Purchase Order</h4>
                <p className="text-sm text-slate-500">Supplier: {selected.name}</p>
              </div>
              <button onClick={() => setShowPoForm(false)} className="p-2 hover:bg-slate-100 rounded-lg"><Ban className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreatePO} className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {poItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-slate-200 rounded-lg p-3">
                  <Input label="Product ID" value={item.productId} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, productId: v } : it))} />
                  <Input label="Quantity (g)" type="number" value={item.quantity.toString()} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, quantity: Number(v) } : it))} />
                  <Input label="Unit Cost (per kg)" type="number" value={item.unitCost.toString()} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, unitCost: Number(v) } : it))} />
                  <Input label="Notes" value={item.notes || ""} onChange={(v) => setPoItems((arr) => arr.map((it, i) => i === idx ? { ...it, notes: v } : it))} />
                </div>
              ))}
              <div className="flex justify-between">
                <button type="button" onClick={() => setPoItems((arr) => [...arr, { productId: "", quantity: 0, unitCost: 0 }])} className="text-sm text-primary flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPoForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">Create PO</button>
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
    <div className={cn("rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3", colors[tone].bg)}>
      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
        <Icon className={cn("w-5 h-5", colors[tone].text)} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-900">{value}</div>
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
