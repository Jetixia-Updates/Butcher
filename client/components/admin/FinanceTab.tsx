/**
 * Finance Management Tab
 * Unified financial dashboard: summary, accounts, transactions, expenses, and reports
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Download,
  Wallet,
  Building2,
  Receipt,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  ReceiptCent,
  X,
  Calendar,
  FileText,
} from "lucide-react";
import { financeApi } from "@/lib/api";
import type {
  FinanceSummary,
  FinanceAccount,
  FinanceTransaction,
  FinanceExpense,
  TransactionType,
} from "@shared/api";
import { cn } from "@/lib/utils";
import { CurrencySymbol } from "@/components/CurrencySymbol";
import { useLanguage } from "@/context/LanguageContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

type PeriodPreset = "today" | "week" | "month" | "quarter" | "year";

type ViewState = {
  summary?: FinanceSummary;
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  expenses: FinanceExpense[];
  loading: boolean;
  period: PeriodPreset;
  search: string;
  type: TransactionType | "all";
};

const formatAmount = (amount: number | undefined) => {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return "0";
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const presetOptions: { value: PeriodPreset; label: string; labelAr: string }[] = [
  { value: "today", label: "Today", labelAr: "اليوم" },
  { value: "week", label: "Last 7d", labelAr: "آخر 7 أيام" },
  { value: "month", label: "This Month", labelAr: "هذا الشهر" },
  { value: "quarter", label: "This Quarter", labelAr: "هذا الربع" },
  { value: "year", label: "This Year", labelAr: "هذا العام" },
];

const typeFilters: { value: TransactionType | "all"; label: string; labelAr: string }[] = [
  { value: "all", label: "All", labelAr: "الكل" },
  { value: "sale", label: "Sales", labelAr: "المبيعات" },
  { value: "purchase", label: "Purchases", labelAr: "المشتريات" },
  { value: "expense", label: "Expenses", labelAr: "المصروفات" },
  { value: "refund", label: "Refunds", labelAr: "المبالغ المستردة" },
  { value: "payout", label: "Payouts", labelAr: "الدفعات" },
];

// IFRS-compliant expense categories
const expenseCategories = [
  { code: "rent", name: "Rent", nameAr: "الإيجار", function: "administrative" },
  { code: "utilities", name: "Utilities (Electric, Water, Internet)", nameAr: "المرافق", function: "administrative" },
  { code: "salaries", name: "Salaries & Wages", nameAr: "الرواتب والأجور", function: "administrative" },
  { code: "inventory", name: "Inventory / Raw Materials", nameAr: "المخزون", function: "cost_of_sales" },
  { code: "delivery", name: "Delivery & Shipping", nameAr: "التوصيل والشحن", function: "selling" },
  { code: "marketing", name: "Marketing & Advertising", nameAr: "التسويق والإعلان", function: "selling" },
  { code: "equipment", name: "Equipment", nameAr: "المعدات", function: "administrative" },
  { code: "maintenance", name: "Repairs & Maintenance", nameAr: "الصيانة والإصلاحات", function: "administrative" },
  { code: "insurance", name: "Insurance", nameAr: "التأمين", function: "administrative" },
  { code: "professional_fees", name: "Professional Fees (Legal, Accounting)", nameAr: "الرسوم المهنية", function: "administrative" },
  { code: "licenses_permits", name: "Licenses & Permits", nameAr: "الرخص والتصاريح", function: "administrative" },
  { code: "bank_charges", name: "Bank Charges", nameAr: "رسوم البنك", function: "administrative" },
  { code: "office_supplies", name: "Office Supplies", nameAr: "مستلزمات المكتب", function: "administrative" },
  { code: "travel", name: "Travel & Transportation", nameAr: "السفر والمواصلات", function: "administrative" },
  { code: "employee_benefits", name: "Employee Benefits", nameAr: "مزايا الموظفين", function: "administrative" },
  { code: "taxes", name: "Taxes (Non-VAT)", nameAr: "الضرائب", function: "other_operating" },
  { code: "interest_expense", name: "Interest Expense", nameAr: "مصروفات الفوائد", function: "finance" },
  { code: "depreciation", name: "Depreciation", nameAr: "الإهلاك", function: "administrative" },
  { code: "other", name: "Other / Petty Cash", nameAr: "أخرى / مصروفات نثرية", function: "other_operating" },
];

type ExpenseFormData = {
  category: string;
  grossAmount: string;
  vatAmount: string;
  description: string;
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
};

export function FinanceTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [state, setState] = useState<ViewState>({
    accounts: [],
    transactions: [],
    expenses: [],
    loading: true,
    period: "month",
    search: "",
    type: "all",
  });

  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>({
    category: "rent",
    grossAmount: "",
    vatAmount: "",
    description: "",
    vendor: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    paymentTerms: "net_30",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const getRangeFromPreset = (period: PeriodPreset) => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    switch (period) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const loadData = async (period: PeriodPreset = state.period, type: TransactionType | "all" = state.type) => {
    setState((s) => ({ ...s, loading: true, period, type }));
    try {
      const range = getRangeFromPreset(period);
      const [summaryRes, accountsRes, txRes, expRes] = await Promise.all([
        financeApi.getSummary({ period }),
        financeApi.getAccounts(),
        financeApi.getTransactions({
          type: type === "all" ? undefined : type,
          startDate: range.start,
          endDate: range.end,
        }),
        financeApi.getExpenses({ startDate: range.start, endDate: range.end }),
      ]);

      setState((s) => ({
        ...s,
        summary: summaryRes.data,
        accounts: accountsRes.data || [],
        transactions: txRes.data || [],
        expenses: expRes.data || [],
        loading: false,
        period,
        type,
      }));
    } catch (err) {
      console.error("Failed to fetch finance data:", err);
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle expense form submission
  const handleCreateExpense = async () => {
    if (!expenseForm.grossAmount || !expenseForm.description) {
      alert(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill in required fields");
      return;
    }

    setSubmitting(true);
    try {
      const grossAmount = parseFloat(expenseForm.grossAmount) || 0;
      const vatAmount = parseFloat(expenseForm.vatAmount) || grossAmount * 0.05; // Default 5% VAT

      await financeApi.createExpense({
        category: expenseForm.category as any,
        grossAmount,
        description: expenseForm.description,
        vatAmount,
        vendor: expenseForm.vendor || undefined,
        invoiceNumber: expenseForm.invoiceNumber || undefined,
        invoiceDate: expenseForm.invoiceDate || undefined,
        dueDate: expenseForm.dueDate || undefined,
        paymentTerms: expenseForm.paymentTerms as any,
        notes: expenseForm.notes || undefined,
      });

      // Reset form and close modal
      setExpenseForm({
        category: "rent",
        grossAmount: "",
        vatAmount: "",
        description: "",
        vendor: "",
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split("T")[0],
        dueDate: "",
        paymentTerms: "net_30",
        notes: "",
      });
      setShowExpenseModal(false);
      
      // Reload expenses
      void loadData();
    } catch (error) {
      console.error("Failed to create expense:", error);
      alert(language === "ar" ? "فشل في إنشاء المصروف" : "Failed to create expense");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-calculate VAT when gross amount changes
  const handleGrossAmountChange = (value: string) => {
    setExpenseForm((prev) => ({
      ...prev,
      grossAmount: value,
      vatAmount: value ? (parseFloat(value) * 0.05).toFixed(2) : "",
    }));
  };

  const filteredTransactions = useMemo(() => {
    if (!state.search) return state.transactions;
    const q = state.search.toLowerCase();
    return state.transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.accountName && t.accountName.toLowerCase().includes(q))
    );
  }, [state.transactions, state.search]);

  const t = (key: string) => {
    const map: Record<string, { en: string; ar: string }> = {
      finance: { en: "Finance", ar: "المالية" },
      summary: { en: "Summary", ar: "الملخص" },
      revenue: { en: "Revenue", ar: "الإيرادات" },
      expenses: { en: "Expenses", ar: "المصروفات" },
      grossProfit: { en: "Gross Profit", ar: "مجمل الربح" },
      netProfit: { en: "Net Profit", ar: "صافي الربح" },
      cashFlow: { en: "Cash Flow", ar: "التدفق النقدي" },
      accounts: { en: "Accounts", ar: "الحسابات" },
      transactions: { en: "Transactions", ar: "المعاملات" },
      expensesList: { en: "Expenses", ar: "المصروفات" },
      period: { en: "Period", ar: "الفترة" },
      type: { en: "Type", ar: "النوع" },
      search: { en: "Search", ar: "بحث" },
      amount: { en: "Amount", ar: "المبلغ" },
      account: { en: "Account", ar: "الحساب" },
      reference: { en: "Reference", ar: "مرجع" },
      status: { en: "Status", ar: "الحالة" },
      date: { en: "Date", ar: "التاريخ" },
      description: { en: "Description", ar: "الوصف" },
      download: { en: "Download", ar: "تنزيل" },
      pl: { en: "P&L", ar: "الأرباح والخسائر" },
      cashflow: { en: "Cash Flow", ar: "التدفق النقدي" },
      vat: { en: "VAT", ar: "الضريبة" },
    };
    return map[key]?.[language] ?? key;
  };

  const StatusBadge = ({ status }: { status: FinanceTransaction["status"] }) => {
    const config: Record<string, { color: string; bg: string; label: string }> = {
      completed: { color: "text-green-700", bg: "bg-green-100", label: language === "ar" ? "مكتمل" : "Completed" },
      pending: { color: "text-yellow-700", bg: "bg-yellow-100", label: language === "ar" ? "معلق" : "Pending" },
      failed: { color: "text-red-700", bg: "bg-red-100", label: language === "ar" ? "فشل" : "Failed" },
      cancelled: { color: "text-slate-700", bg: "bg-slate-100", label: language === "ar" ? "ملغي" : "Cancelled" },
    };
    const c = config[status] || config.completed;
    return <span className={cn("px-2 py-0.5 text-xs rounded-full", c.bg, c.color)}>{c.label}</span>;
  };

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("finance")}</h2>
            <p className="text-sm text-slate-500">{language === "ar" ? "لوحة إدارة المالية" : "Financial control center"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={state.period}
              onChange={(e) => void loadData(e.target.value as PeriodPreset, state.type)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {presetOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {language === "ar" ? p.labelAr : p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={state.type}
              onChange={(e) => void loadData(state.period, e.target.value as TransactionType | "all")}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {typeFilters.map((p) => (
                <option key={p.value} value={p.value}>
                  {language === "ar" ? p.labelAr : p.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            {language === "ar" ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard
          title={t("revenue")}
          icon={TrendingUp}
          amount={state.summary?.totalRevenue || 0}
          tone="green"
        />
        <SummaryCard
          title={t("expenses")}
          icon={Receipt}
          amount={state.summary?.totalExpenses || 0}
          tone="red"
        />
        <SummaryCard
          title={t("grossProfit")}
          icon={ArrowUpRight}
          amount={state.summary?.grossProfit || 0}
          subtitle={`${(state.summary?.grossProfitMargin || 0).toFixed(1)}%`}
          tone="blue"
        />
        <SummaryCard
          title={t("netProfit")}
          icon={ArrowDownRight}
          amount={state.summary?.netProfit || 0}
          subtitle={`${(state.summary?.netProfitMargin || 0).toFixed(1)}%`}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Accounts */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Wallet className="w-4 h-4" /> {t("accounts")}
            </div>
            <button className="text-sm text-primary flex items-center gap-1" onClick={() => onNavigate?.("finance")}> 
              <PlusIcon /> {language === "ar" ? "إنشاء" : "Create"}
            </button>
          </div>
          <div className="space-y-2">
            {state.accounts.map((acc) => (
              <div key={acc.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-slate-900">{acc.name}</div>
                    <div className="text-xs text-slate-500">{acc.type}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900 flex items-center justify-end gap-1">
                      <CurrencySymbol className="text-slate-500" /> {formatAmount(acc.balance)} {acc.currency}
                    </div>
                    <div className="text-xs text-slate-500">{acc.bankName || acc.iban || ""}</div>
                  </div>
                </div>
              </div>
            ))}
            {state.accounts.length === 0 && (
              <p className="text-sm text-slate-500">{language === "ar" ? "لا توجد حسابات" : "No accounts"}</p>
            )}
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <CreditCard className="w-4 h-4" /> {t("transactions")}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2 top-2.5" />
                <input
                  value={state.search}
                  onChange={(e) => setState((s) => ({ ...s, search: e.target.value }))}
                  className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder={t("search")}
                />
              </div>
              <button
                className="flex items-center gap-1 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                onClick={() => onNavigate?.("reports")}
              >
                <Download className="w-4 h-4" /> {t("download")}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">{t("date")}</th>
                  <th className="py-2">{t("description")}</th>
                  <th className="py-2">{t("amount")}</th>
                  <th className="py-2">{t("account")}</th>
                  <th className="py-2">{t("reference")}</th>
                  <th className="py-2">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="py-2 text-slate-600">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 text-slate-900">{tx.description}</td>
                    <td className={cn("py-2 font-semibold", tx.amount >= 0 ? "text-green-700" : "text-red-700")}> 
                      <CurrencySymbol className="text-slate-500" /> {formatAmount(Math.abs(tx.amount))} {tx.currency}
                    </td>
                    <td className="py-2 text-slate-600">{tx.accountName}</td>
                    <td className="py-2 text-slate-500">{tx.reference || "-"}</td>
                    <td className="py-2"><StatusBadge status={tx.status} /></td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      {language === "ar" ? "لا توجد معاملات" : "No transactions"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ReceiptCent className="w-4 h-4" /> {t("expensesList")}
          </div>
          <button 
            className="text-sm text-primary flex items-center gap-1" 
            onClick={() => setShowExpenseModal(true)}
          > 
            <PlusIcon /> {language === "ar" ? "إضافة" : "Add"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">{t("date")}</th>
                <th className="py-2">{t("description")}</th>
                <th className="py-2">{t("amount")}</th>
                <th className="py-2">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {state.expenses.map((ex) => (
                <tr key={ex.id} className="border-b last:border-0">
                  <td className="py-2 text-slate-600">{new Date(ex.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 text-slate-900">{ex.description}</td>
                  <td className="py-2 text-slate-700 font-semibold">
                    <CurrencySymbol className="text-slate-500" /> {formatAmount(ex.amount)} {ex.currency}
                  </td>
                  <td className="py-2 text-slate-600">{ex.status}</td>
                </tr>
              ))}
              {state.expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    {language === "ar" ? "لا توجد مصروفات" : "No expenses"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reports quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <ReportCard
          title={t("pl")}
          description={language === "ar" ? "تقرير الأرباح والخسائر" : "Profit & Loss"}
          onClick={() => onNavigate?.("reports")}
          icon={TrendingUp}
        />
        <ReportCard
          title={t("cashflow")}
          description={language === "ar" ? "تقرير التدفق النقدي" : "Cash flow report"}
          onClick={() => onNavigate?.("reports")}
          icon={TrendingDown}
        />
        <ReportCard
          title={t("vat")}
          description={language === "ar" ? "إقرار الضريبة" : "VAT return"}
          onClick={() => onNavigate?.("reports")}
          icon={Building2}
        />
        <ReportCard
          title={language === "ar" ? "الميزانية" : "Balance Sheet"}
          description={language === "ar" ? "الأصول والخصوم" : "Assets & Liabilities"}
          onClick={() => onNavigate?.("reports")}
          icon={Banknote}
        />
        <ReportCard
          title={language === "ar" ? "دليل الحسابات" : "Chart of Accounts"}
          description={language === "ar" ? "شجرة الحسابات" : "Account structure"}
          onClick={() => onNavigate?.("reports")}
          icon={Wallet}
        />
        <ReportCard
          title={language === "ar" ? "القيود اليومية" : "Journal Entries"}
          description={language === "ar" ? "سجل المحاسبة" : "Accounting log"}
          onClick={() => onNavigate?.("reports")}
          icon={Receipt}
        />
      </div>

      {/* UAE Compliance Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {language === "ar" ? "الامتثال لقوانين الإمارات" : "UAE Compliance"}
              </h3>
              <p className="text-sm text-slate-600">
                {language === "ar" ? "إقرار ضريبة القيمة المضافة والتقارير المالية" : "FTA VAT Returns & Financial Reports"}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
            {language === "ar" ? "هيئة الضرائب الاتحادية" : "FTA Compliant"}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* VAT Summary */}
          <div className="bg-white rounded-lg p-4 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">
                {language === "ar" ? "ضريبة القيمة المضافة المستحقة" : "VAT Due"}
              </span>
              <span className="text-xs text-slate-400">5%</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700 flex items-center gap-1">
              <CurrencySymbol className="text-slate-500" /> {formatAmount(state.summary?.vatDue || state.summary?.vatCollected || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar" ? "هذا الربع" : "This Quarter"}
            </p>
          </div>

          {/* TRN */}
          <div className="bg-white rounded-lg p-4 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">
                {language === "ar" ? "رقم التسجيل الضريبي" : "Tax Registration Number"}
              </span>
            </div>
            <div className="text-lg font-mono font-bold text-slate-900">
              100-XXX-XXX-XXX-003
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar" ? "قابل للتعديل في الإعدادات" : "Configurable in Settings"}
            </p>
          </div>

          {/* Next Filing */}
          <div className="bg-white rounded-lg p-4 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">
                {language === "ar" ? "الإقرار القادم" : "Next VAT Filing"}
              </span>
            </div>
            <div className="text-lg font-bold text-amber-600">
              {language === "ar" ? "الربع الأول 2026" : "Q1 2026"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === "ar" ? "الموعد النهائي: 28 أبريل" : "Due: April 28, 2026"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button 
            onClick={() => onNavigate?.("reports")}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            {language === "ar" ? "إنشاء إقرار ضريبي" : "Generate VAT Return"}
          </button>
          <button 
            onClick={() => onNavigate?.("reports")}
            className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 transition"
          >
            {language === "ar" ? "تصدير للهيئة (Excel)" : "Export for FTA (Excel)"}
          </button>
          <button 
            onClick={() => onNavigate?.("reports")}
            className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 transition"
          >
            {language === "ar" ? "سجل التدقيق" : "Audit Log"}
          </button>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowExpenseModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {language === "ar" ? "إضافة مصروف جديد" : "Add New Expense"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {language === "ar" ? "فواتير، إيجار، مصروفات نثرية" : "Bills, Rent, Petty Cash"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowExpenseModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === "ar" ? "الفئة *" : "Category *"}
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {language === "ar" ? cat.nameAr : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === "ar" ? "المبلغ (قبل الضريبة) *" : "Gross Amount (excl. VAT) *"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400">AED</span>
                    <input
                      type="number"
                      step="0.01"
                      value={expenseForm.grossAmount}
                      onChange={(e) => handleGrossAmountChange(e.target.value)}
                      className="w-full pl-14 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === "ar" ? "ضريبة القيمة المضافة (5%)" : "VAT Amount (5%)"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400">AED</span>
                    <input
                      type="number"
                      step="0.01"
                      value={expenseForm.vatAmount}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, vatAmount: e.target.value }))}
                      className="w-full pl-14 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === "ar" ? "الوصف *" : "Description *"}
                </label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder={language === "ar" ? "مثال: فاتورة كهرباء يناير 2026" : "e.g., January 2026 Electricity Bill"}
                />
              </div>

              {/* Vendor & Invoice Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === "ar" ? "المورد / الجهة" : "Vendor / Supplier"}
                  </label>
                  <input
                    type="text"
                    value={expenseForm.vendor}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, vendor: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder={language === "ar" ? "اسم المورد" : "Vendor name"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === "ar" ? "رقم الفاتورة" : "Invoice Number"}
                  </label>
                  <input
                    type="text"
                    value={expenseForm.invoiceNumber}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="INV-001"
                  />
                </div>
              </div>

              {/* Date Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === "ar" ? "تاريخ الفاتورة" : "Invoice Date"}
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      value={expenseForm.invoiceDate}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, invoiceDate: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="date"
                      value={expenseForm.dueDate}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === "ar" ? "شروط الدفع" : "Payment Terms"}
                  </label>
                  <select
                    value={expenseForm.paymentTerms}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="immediate">{language === "ar" ? "فوري" : "Immediate"}</option>
                    <option value="net_7">{language === "ar" ? "صافي 7 أيام" : "Net 7 days"}</option>
                    <option value="net_15">{language === "ar" ? "صافي 15 يوم" : "Net 15 days"}</option>
                    <option value="net_30">{language === "ar" ? "صافي 30 يوم" : "Net 30 days"}</option>
                    <option value="net_60">{language === "ar" ? "صافي 60 يوم" : "Net 60 days"}</option>
                    <option value="net_90">{language === "ar" ? "صافي 90 يوم" : "Net 90 days"}</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === "ar" ? "ملاحظات" : "Notes"}
                </label>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder={language === "ar" ? "ملاحظات إضافية..." : "Additional notes..."}
                />
              </div>

              {/* Total */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">{language === "ar" ? "الإجمالي (شامل الضريبة)" : "Total (incl. VAT)"}</span>
                  <span className="text-xl font-bold text-slate-900">
                    AED {formatAmount((parseFloat(expenseForm.grossAmount) || 0) + (parseFloat(expenseForm.vatAmount) || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition"
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleCreateExpense}
                disabled={submitting}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {language === "ar" ? "جاري الحفظ..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    {language === "ar" ? "حفظ المصروف" : "Save Expense"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  icon: Icon,
  amount,
  tone,
  subtitle,
}: {
  title: string;
  icon: React.ElementType;
  amount: number;
  tone: "green" | "red" | "blue" | "amber";
  subtitle?: string;
}) {
  const colors: Record<typeof tone, { bg: string; text: string }> = {
    green: { bg: "bg-green-50", text: "text-green-700" },
    red: { bg: "bg-red-50", text: "text-red-700" },
    blue: { bg: "bg-blue-50", text: "text-blue-700" },
    amber: { bg: "bg-amber-50", text: "text-amber-700" },
  } as const;
  return (
    <div className={cn("rounded-xl border border-slate-200 p-4 shadow-sm", colors[tone].bg)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{title}</p>
          <p className={cn("text-xl font-semibold flex items-center gap-1", colors[tone].text)}>
            <CurrencySymbol className="text-slate-500" /> {formatAmount(amount)}
          </p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
          <Icon className={cn("w-5 h-5", colors[tone].text)} />
        </div>
      </div>
    </div>
  );
}

function ReportCard({ title, description, onClick, icon: Icon }: { title: string; description: string; onClick: () => void; icon: React.ElementType }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-primary/50 transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-500">{description}</div>
        </div>
      </div>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  );
}
