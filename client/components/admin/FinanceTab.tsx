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
            <button className="text-sm text-primary flex items-center gap-1" onClick={() => onNavigate?.("accounts")}> 
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
          <button className="text-sm text-primary flex items-center gap-1" onClick={() => onNavigate?.("suppliers")}> 
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          description={language === "ar" ? "تقرير الضريبة" : "VAT return"}
          onClick={() => onNavigate?.("reports")}
          icon={Building2}
        />
      </div>
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
