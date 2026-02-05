/**
 * Finance Management Routes
 * Comprehensive financial management, reporting, and accounting (PostgreSQL version)
 */

import { Router, RequestHandler } from "express";
import { eq, gte, lte, and, ne } from "drizzle-orm";
import type {
  FinanceTransaction,
  FinanceAccount,
  FinanceExpense,
  FinanceSummary,
  ProfitLossReport,
  CashFlowReport,
  VATReport,
  CreateExpenseRequest,
  ExpenseCategory,
  ApiResponse,
} from "../../shared/api";
import { db, orders, products, financeAccounts, financeTransactions, financeExpenses } from "../db/connection";
import { randomUUID } from "crypto";

const router = Router();

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

// Helper functions
function getDateRange(period: string): { start: Date; end: Date } {
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
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

// =====================================================
// SUMMARY & DASHBOARD
// =====================================================

const getFinanceSummary: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;
    let start: Date, end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    // Get orders in date range - include orders with captured or authorized payments for revenue
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end && 
             o.status !== "cancelled" && 
             (o.paymentStatus === "captured" || o.paymentStatus === "authorized")
    );

    // Get all products for cost calculation
    const allProducts = await db.select().from(products);
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // Get transactions
    const allTransactions = await db.select().from(financeTransactions);
    const periodTransactions = allTransactions.filter(
      (t) => new Date(t.createdAt) >= start && new Date(t.createdAt) <= end
    );

    // Get expenses
    const allExpenses = await db.select().from(financeExpenses);
    const periodExpenses = allExpenses.filter(
      (e) => new Date(e.createdAt) >= start && new Date(e.createdAt) <= end
    );

    // Get accounts
    const accounts = await db.select().from(financeAccounts);

    // Calculate revenue metrics
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalVAT = filteredOrders.reduce((sum, o) => sum + Number(o.vatAmount), 0);
    const totalRefunds = periodTransactions
      .filter((t) => t.type === "refund")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    // Calculate COGS (would need order items - simplified here)
    const totalCOGS = totalRevenue * 0.6; // Assume 60% COGS for simplicity

    const grossProfit = totalRevenue - totalCOGS;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Calculate expenses
    const totalExpenses = periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const netProfit = grossProfit - totalExpenses;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Revenue by payment method
    const paymentMethodRevenue: Record<string, { amount: number; count: number }> = {};
    filteredOrders.forEach((o) => {
      const method = o.paymentMethod || "unknown";
      if (!paymentMethodRevenue[method]) {
        paymentMethodRevenue[method] = { amount: 0, count: 0 };
      }
      paymentMethodRevenue[method].amount += Number(o.total);
      paymentMethodRevenue[method].count += 1;
    });

    // Expenses by category
    const expensesByCategory: Record<string, { amount: number; count: number }> = {};
    periodExpenses.forEach((e) => {
      if (!expensesByCategory[e.category]) {
        expensesByCategory[e.category] = { amount: 0, count: 0 };
      }
      expensesByCategory[e.category].amount += Number(e.amount);
      expensesByCategory[e.category].count += 1;
    });

    // Cash flow
    const inflow = totalRevenue;
    const outflow = totalExpenses + totalCOGS + totalRefunds;

    const summary: FinanceSummary = {
      period: period as string,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCOGS: Math.round(totalCOGS * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      netProfitMargin: Math.round(netProfitMargin * 100) / 100,
      totalRefunds: Math.round(totalRefunds * 100) / 100,
      totalVAT: Math.round(totalVAT * 100) / 100,
      vatCollected: Math.round(totalVAT * 100) / 100,
      vatPaid: 0,
      vatDue: Math.round(totalVAT * 100) / 100,
      cashFlow: {
        inflow: Math.round(inflow * 100) / 100,
        outflow: Math.round(outflow * 100) / 100,
        net: Math.round((inflow - outflow) * 100) / 100,
      },
      revenueByPaymentMethod: Object.entries(paymentMethodRevenue).map(([method, data]) => ({
        method,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
      })),
      expensesByCategory: Object.entries(expensesByCategory).map(([category, data]) => ({
        category: category as ExpenseCategory,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
      })),
      accountBalances: accounts.map((a) => ({
        accountId: a.id,
        accountName: a.name,
        balance: Number(a.balance),
      })),
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to get finance summary" });
  }
};

// =====================================================
// TRANSACTIONS
// =====================================================

const getTransactions: RequestHandler = async (req, res) => {
  try {
    const { type, status, startDate, endDate, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let transactions = await db.select().from(financeTransactions);

    if (type) transactions = transactions.filter((t) => t.type === type);
    if (status) transactions = transactions.filter((t) => t.status === status);
    if (startDate) transactions = transactions.filter((t) => new Date(t.createdAt) >= new Date(startDate as string));
    if (endDate) transactions = transactions.filter((t) => new Date(t.createdAt) <= new Date(endDate as string));

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const start = (pageNum - 1) * limitNum;
    const paginatedTransactions = transactions.slice(start, start + limitNum);

    res.json({ success: true, data: paginatedTransactions });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get transactions" });
  }
};

const getTransactionById: RequestHandler = async (req, res) => {
  const transactions = await db.select().from(financeTransactions).where(eq(financeTransactions.id, req.params.id));
  if (transactions.length === 0) {
    return res.status(404).json({ success: false, error: "Transaction not found" });
  }
  res.json({ success: true, data: transactions[0] });
};

// =====================================================
// ACCOUNTS
// =====================================================

const getAccounts: RequestHandler = async (req, res) => {
  const accounts = await db.select().from(financeAccounts);
  res.json({ success: true, data: accounts });
};

const getAccountById: RequestHandler = async (req, res) => {
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.id, req.params.id));
  if (accounts.length === 0) {
    return res.status(404).json({ success: false, error: "Account not found" });
  }
  res.json({ success: true, data: accounts[0] });
};

const createAccount: RequestHandler = async (req, res) => {
  const accountId = generateId("acc");
  await db.insert(financeAccounts).values({
    id: accountId,
    ...req.body,
    balance: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [newAccount] = await db.select().from(financeAccounts).where(eq(financeAccounts.id, accountId));
  res.status(201).json({ success: true, data: newAccount });
};

const updateAccount: RequestHandler = async (req, res) => {
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.id, req.params.id));
  if (accounts.length === 0) {
    return res.status(404).json({ success: false, error: "Account not found" });
  }

  await db.update(financeAccounts)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(financeAccounts.id, req.params.id));
  const [updated] = await db.select().from(financeAccounts).where(eq(financeAccounts.id, req.params.id));

  res.json({ success: true, data: updated });
};

const transferBetweenAccounts: RequestHandler = async (req, res) => {
  const { fromAccountId, toAccountId, amount, notes } = req.body;

  const fromAccounts = await db.select().from(financeAccounts).where(eq(financeAccounts.id, fromAccountId));
  const toAccounts = await db.select().from(financeAccounts).where(eq(financeAccounts.id, toAccountId));

  if (fromAccounts.length === 0 || toAccounts.length === 0) {
    return res.status(404).json({ success: false, error: "Account not found" });
  }

  const fromAccount = fromAccounts[0];
  const toAccount = toAccounts[0];

  if (Number(fromAccount.balance) < amount) {
    return res.status(400).json({ success: false, error: "Insufficient balance" });
  }

  // Update balances
  await db.update(financeAccounts)
    .set({ balance: String(Number(fromAccount.balance) - amount), updatedAt: new Date() })
    .where(eq(financeAccounts.id, fromAccountId));

  await db.update(financeAccounts)
    .set({ balance: String(Number(toAccount.balance) + amount), updatedAt: new Date() })
    .where(eq(financeAccounts.id, toAccountId));

  // Create transaction records
  const timestamp = new Date();
  await db.insert(financeTransactions).values([
    {
      id: generateId("txn"),
      type: "adjustment",
      status: "completed",
      amount: String(-amount),
      currency: "AED",
      description: `Transfer to ${toAccount.name}`,
      referenceType: "manual",
      accountId: fromAccountId,
      accountName: fromAccount.name,
      createdBy: "admin",
      createdAt: timestamp,
      updatedAt: timestamp,
      notes,
    },
    {
      id: generateId("txn"),
      type: "adjustment",
      status: "completed",
      amount: String(amount),
      currency: "AED",
      description: `Transfer from ${fromAccount.name}`,
      referenceType: "manual",
      accountId: toAccountId,
      accountName: toAccount.name,
      createdBy: "admin",
      createdAt: timestamp,
      updatedAt: timestamp,
      notes,
    },
  ]);

  // Get updated accounts
  const updatedFrom = await db.select().from(financeAccounts).where(eq(financeAccounts.id, fromAccountId));
  const updatedTo = await db.select().from(financeAccounts).where(eq(financeAccounts.id, toAccountId));

  res.json({ success: true, data: { from: updatedFrom[0], to: updatedTo[0] } });
};

const reconcileAccount: RequestHandler = async (req, res) => {
  const { statementBalance, reconciliationDate } = req.body;
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.id, req.params.id));

  if (accounts.length === 0) {
    return res.status(404).json({ success: false, error: "Account not found" });
  }

  const account = accounts[0];
  const difference = statementBalance - Number(account.balance);

  if (difference !== 0) {
    // Create adjustment transaction
    await db.insert(financeTransactions).values({
      id: generateId("txn"),
      type: "adjustment",
      status: "completed",
      amount: String(difference),
      currency: "AED",
      description: `Reconciliation adjustment`,
      referenceType: "manual",
      accountId: account.id,
      accountName: account.name,
      createdBy: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: `Reconciliation on ${reconciliationDate}`,
    });
  }

  await db.update(financeAccounts)
    .set({
      balance: String(statementBalance),
      lastReconciled: new Date(reconciliationDate),
      updatedAt: new Date(),
    })
    .where(eq(financeAccounts.id, req.params.id));
  const [updated] = await db.select().from(financeAccounts).where(eq(financeAccounts.id, req.params.id));

  res.json({ success: true, data: updated });
};

// =====================================================
// EXPENSES
// =====================================================

const getExpenses: RequestHandler = async (req, res) => {
  try {
    const { category, status, startDate, endDate, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let expenses = await db.select().from(financeExpenses);

    if (category) expenses = expenses.filter((e) => e.category === category);
    if (status) expenses = expenses.filter((e) => e.status === status);
    if (startDate) expenses = expenses.filter((e) => new Date(e.createdAt) >= new Date(startDate as string));
    if (endDate) expenses = expenses.filter((e) => new Date(e.createdAt) <= new Date(endDate as string));

    // Sort by date descending
    expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const start = (pageNum - 1) * limitNum;
    const paginatedExpenses = expenses.slice(start, start + limitNum);

    res.json({ success: true, data: paginatedExpenses });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get expenses" });
  }
};

const createExpense: RequestHandler = async (req, res) => {
  const data = req.body as CreateExpenseRequest;
  const grossAmount = data.grossAmount || 0;
  const vatAmount = data.vatAmount || grossAmount * 0.05;
  const totalAmount = grossAmount + vatAmount;
  
  const expenseId = generateId("exp");
  await db.insert(financeExpenses).values({
    id: expenseId,
    expenseNumber: `EXP-${Date.now()}`,
    category: data.category,
    grossAmount: String(grossAmount),
    vatAmount: String(vatAmount),
    amount: String(totalAmount),
    description: data.description,
    descriptionAr: data.descriptionAr,
    vendor: data.vendor,
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    paymentTerms: data.paymentTerms || "net_30",
    notes: data.notes,
    isRecurring: data.isRecurring,
    recurringFrequency: data.recurringFrequency,
    accountId: data.accountId,
    currency: "AED",
    status: "pending",
    createdBy: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [newExpense] = await db.select().from(financeExpenses).where(eq(financeExpenses.id, expenseId));
  res.status(201).json({ success: true, data: newExpense });
};

const updateExpense: RequestHandler = async (req, res) => {
  const expenses = await db.select().from(financeExpenses).where(eq(financeExpenses.id, req.params.id));
  if (expenses.length === 0) {
    return res.status(404).json({ success: false, error: "Expense not found" });
  }

  await db.update(financeExpenses)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(financeExpenses.id, req.params.id));
  const [updated] = await db.select().from(financeExpenses).where(eq(financeExpenses.id, req.params.id));

  res.json({ success: true, data: updated });
};

const deleteExpense: RequestHandler = async (req, res) => {
  const expenses = await db.select().from(financeExpenses).where(eq(financeExpenses.id, req.params.id));
  if (expenses.length === 0) {
    return res.status(404).json({ success: false, error: "Expense not found" });
  }

  await db.delete(financeExpenses).where(eq(financeExpenses.id, req.params.id));
  res.json({ success: true, data: null });
};

const markExpensePaid: RequestHandler = async (req, res) => {
  const { accountId } = req.body;
  const expenses = await db.select().from(financeExpenses).where(eq(financeExpenses.id, req.params.id));

  if (expenses.length === 0) {
    return res.status(404).json({ success: false, error: "Expense not found" });
  }

  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.id, accountId));
  if (accounts.length === 0) {
    return res.status(404).json({ success: false, error: "Account not found" });
  }

  const expense = expenses[0];
  const account = accounts[0];

  // Update expense
  await db.update(financeExpenses)
    .set({
      status: "paid",
      paidAt: new Date(),
      accountId,
      updatedAt: new Date(),
    })
    .where(eq(financeExpenses.id, req.params.id));
  const [updatedExpense] = await db.select().from(financeExpenses).where(eq(financeExpenses.id, req.params.id));

  // Deduct from account
  await db.update(financeAccounts)
    .set({
      balance: String(Number(account.balance) - Number(expense.amount)),
      updatedAt: new Date(),
    })
    .where(eq(financeAccounts.id, accountId));

  // Create transaction
  await db.insert(financeTransactions).values({
    id: generateId("txn"),
    type: "expense",
    status: "completed",
    amount: String(-Number(expense.amount)),
    currency: "AED",
    description: expense.description,
    category: expense.category,
    referenceType: "expense",
    referenceId: expense.id,
    accountId: account.id,
    accountName: account.name,
    createdBy: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  res.json({ success: true, data: updatedExpense });
};

// =====================================================
// VENDORS
// =====================================================

const getVendors: RequestHandler = async (req, res) => {
  try {
    // Return sample vendors (would come from vendors table in production)
    const sampleVendors = [
      {
        id: "v-001",
        code: "V-001",
        name: "Al Ain Farms",
        nameAr: "مزارع العين",
        email: "accounts@alainfarms.ae",
        phone: "+971 4 123 4567",
        trn: "100123456789003",
        defaultPaymentTerms: "net_30",
        currentBalance: 15000,
        isActive: true,
        category: "supplier",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "v-002",
        code: "V-002", 
        name: "Emirates Spices",
        nameAr: "توابل الإمارات",
        email: "billing@emiratesspices.com",
        phone: "+971 4 987 6543",
        trn: "100987654321003",
        defaultPaymentTerms: "net_15",
        currentBalance: 5200,
        isActive: true,
        category: "supplier",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    res.json({ success: true, data: sampleVendors });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get vendors" });
  }
};

const createVendor: RequestHandler = async (req, res) => {
  try {
    const data = req.body;
    const newVendor = {
      id: generateId("v"),
      code: `V-${String(Date.now()).slice(-4)}`,
      ...data,
      currentBalance: data.openingBalance || 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    res.status(201).json({ success: true, data: newVendor });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create vendor" });
  }
};

const getVendorById: RequestHandler = async (req, res) => {
  try {
    const vendor = {
      id: req.params.id,
      code: "V-001",
      name: "Sample Vendor",
      currentBalance: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get vendor" });
  }
};

// =====================================================
// COST CENTERS
// =====================================================

const getCostCenters: RequestHandler = async (req, res) => {
  try {
    const sampleCostCenters = [
      { id: "cc-001", code: "CC-OPS", name: "Operations", nameAr: "العمليات", isActive: true },
      { id: "cc-002", code: "CC-ADMIN", name: "Administration", nameAr: "الإدارة", isActive: true },
      { id: "cc-003", code: "CC-SALES", name: "Sales & Marketing", nameAr: "المبيعات والتسويق", isActive: true },
      { id: "cc-004", code: "CC-DELIVERY", name: "Delivery", nameAr: "التوصيل", isActive: true },
      { id: "cc-005", code: "CC-WAREHOUSE", name: "Warehouse", nameAr: "المستودع", isActive: true },
    ];
    res.json({ success: true, data: sampleCostCenters });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get cost centers" });
  }
};

const createCostCenter: RequestHandler = async (req, res) => {
  try {
    const data = req.body;
    const newCostCenter = {
      id: generateId("cc"),
      ...data,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    res.status(201).json({ success: true, data: newCostCenter });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create cost center" });
  }
};

// =====================================================
// EXPENSE BUDGETS
// =====================================================

const getBudgets: RequestHandler = async (req, res) => {
  try {
    const sampleBudgets = [
      {
        id: "bud-001",
        name: "Operations Q1 2026",
        periodType: "quarterly",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        category: null,
        costCenterId: "cc-001",
        budgetAmount: 50000,
        spentAmount: 22500,
        remainingAmount: 27500,
        percentUsed: 45,
        alertThreshold: 80,
        isAlertSent: false,
        isActive: true,
      },
      {
        id: "bud-002",
        name: "Marketing Monthly",
        periodType: "monthly",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        category: "marketing",
        costCenterId: null,
        budgetAmount: 10000,
        spentAmount: 7800,
        remainingAmount: 2200,
        percentUsed: 78,
        alertThreshold: 80,
        isAlertSent: false,
        isActive: true,
      },
      {
        id: "bud-003",
        name: "Delivery Expenses 2026",
        periodType: "yearly",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        category: "delivery",
        costCenterId: "cc-004",
        budgetAmount: 120000,
        spentAmount: 8500,
        remainingAmount: 111500,
        percentUsed: 7,
        alertThreshold: 80,
        isAlertSent: false,
        isActive: true,
      },
    ];
    res.json({ success: true, data: sampleBudgets });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get budgets" });
  }
};

const createBudget: RequestHandler = async (req, res) => {
  try {
    const data = req.body;
    const newBudget = {
      id: generateId("bud"),
      ...data,
      spentAmount: 0,
      remainingAmount: data.budgetAmount,
      percentUsed: 0,
      isAlertSent: false,
      isActive: true,
      createdBy: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    res.status(201).json({ success: true, data: newBudget });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create budget" });
  }
};

const getBudgetVsActual: RequestHandler = async (req, res) => {
  try {
    const report = {
      period: req.query.period || "quarter",
      asOfDate: new Date().toISOString(),
      summary: {
        totalBudget: 180000,
        totalSpent: 38800,
        totalRemaining: 141200,
        overallVariance: 141200,
        overallVariancePercent: 78.4,
      },
      byCategory: [
        { category: "marketing", budget: 10000, actual: 7800, variance: 2200, variancePercent: 22 },
        { category: "delivery", budget: 10000, actual: 8500, variance: 1500, variancePercent: 15 },
        { category: "salaries", budget: 80000, actual: 18000, variance: 62000, variancePercent: 77.5 },
        { category: "utilities", budget: 5000, actual: 2500, variance: 2500, variancePercent: 50 },
        { category: "rent", budget: 25000, budget_actual: 0, variance: 25000, variancePercent: 100 },
      ],
      byCostCenter: [
        { costCenter: "Operations", budget: 50000, actual: 22500, variance: 27500, variancePercent: 55 },
        { costCenter: "Sales & Marketing", budget: 30000, actual: 7800, variance: 22200, variancePercent: 74 },
        { costCenter: "Delivery", budget: 40000, actual: 8500, variance: 31500, variancePercent: 78.75 },
      ],
    };
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get budget vs actual report" });
  }
};

// =====================================================
// AGING REPORT
// =====================================================

const getAgingReport: RequestHandler = async (req, res) => {
  try {
    // Get all unpaid expenses
    const allExpenses = await db.select().from(financeExpenses);
    const unpaidExpenses = allExpenses.filter(e => e.status !== "paid" && e.status !== "cancelled");
    
    const today = new Date();
    const summary = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90Days: 0, total: 0 };
    const byVendorMap: Record<string, any> = {};
    const details: any[] = [];

    unpaidExpenses.forEach(expense => {
      const dueDate = expense.dueDate ? new Date(expense.dueDate) : new Date(expense.createdAt);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = Number(expense.amount);
      const paidAmount = Number(expense.paidAt ? expense.amount : 0);
      const balance = amount - paidAmount;
      
      let bucket: "current" | "1-30" | "31-60" | "61-90" | "90+" = "current";
      if (daysOverdue <= 0) {
        summary.current += balance;
        bucket = "current";
      } else if (daysOverdue <= 30) {
        summary.days1to30 += balance;
        bucket = "1-30";
      } else if (daysOverdue <= 60) {
        summary.days31to60 += balance;
        bucket = "31-60";
      } else if (daysOverdue <= 90) {
        summary.days61to90 += balance;
        bucket = "61-90";
      } else {
        summary.over90Days += balance;
        bucket = "90+";
      }
      summary.total += balance;

      // By vendor
      const vendorName = expense.vendor || "Unknown";
      if (!byVendorMap[vendorName]) {
        byVendorMap[vendorName] = { vendorId: "", vendorName, current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90Days: 0, total: 0 };
      }
      if (daysOverdue <= 0) byVendorMap[vendorName].current += balance;
      else if (daysOverdue <= 30) byVendorMap[vendorName].days1to30 += balance;
      else if (daysOverdue <= 60) byVendorMap[vendorName].days31to60 += balance;
      else if (daysOverdue <= 90) byVendorMap[vendorName].days61to90 += balance;
      else byVendorMap[vendorName].over90Days += balance;
      byVendorMap[vendorName].total += balance;

      details.push({
        expenseId: expense.id,
        expenseNumber: expense.id,
        vendorName,
        invoiceNumber: expense.invoiceNumber || "-",
        invoiceDate: expense.invoiceDate?.toISOString() || expense.createdAt.toISOString(),
        dueDate: dueDate.toISOString(),
        amount,
        paidAmount,
        balance,
        daysOverdue: Math.max(0, daysOverdue),
        agingBucket: bucket,
      });
    });

    res.json({
      success: true,
      data: {
        asOfDate: today.toISOString(),
        summary,
        byVendor: Object.values(byVendorMap),
        details,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get aging report" });
  }
};

// =====================================================
// EXPENSE APPROVAL WORKFLOW
// =====================================================

const getApprovalRules: RequestHandler = async (req, res) => {
  try {
    const rules = [
      { id: "rule-001", name: "Auto-approve small expenses", minAmount: 0, maxAmount: 500, autoApproveBelow: 500, approverLevel: 0, isActive: true },
      { id: "rule-002", name: "Manager approval (500-5000)", minAmount: 500, maxAmount: 5000, approverRole: "manager", approverLevel: 1, isActive: true },
      { id: "rule-003", name: "Finance approval (5000-20000)", minAmount: 5000, maxAmount: 20000, approverRole: "finance", approverLevel: 2, isActive: true },
      { id: "rule-004", name: "CFO approval (20000+)", minAmount: 20000, maxAmount: null, approverRole: "cfo", approverLevel: 3, isActive: true },
    ];
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get approval rules" });
  }
};

const getPendingApprovals: RequestHandler = async (req, res) => {
  try {
    const allExpenses = await db.select().from(financeExpenses);
    const pending = allExpenses.filter(e => e.approvedBy === null && e.status === "pending");
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get pending approvals" });
  }
};

const approveExpense: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverId, notes } = req.body;
    
    const expenses = await db.select().from(financeExpenses).where(eq(financeExpenses.id, id));
    if (expenses.length === 0) {
      return res.status(404).json({ success: false, error: "Expense not found" });
    }

    await db.update(financeExpenses)
      .set({
        approvedBy: approverId || "admin",
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(financeExpenses.id, id));
    const [updated] = await db.select().from(financeExpenses).where(eq(financeExpenses.id, id));

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to approve expense" });
  }
};

const rejectExpense: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedBy, reason } = req.body;
    
    const expenses = await db.select().from(financeExpenses).where(eq(financeExpenses.id, id));
    if (expenses.length === 0) {
      return res.status(404).json({ success: false, error: "Expense not found" });
    }

    await db.update(financeExpenses)
      .set({
        status: "cancelled",
        notes: reason ? `Rejected: ${reason}` : "Rejected",
        updatedAt: new Date(),
      })
      .where(eq(financeExpenses.id, id));
    const [updated] = await db.select().from(financeExpenses).where(eq(financeExpenses.id, id));

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to reject expense" });
  }
};

const submitForApproval: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    const expenses = await db.select().from(financeExpenses).where(eq(financeExpenses.id, id));
    if (expenses.length === 0) {
      return res.status(404).json({ success: false, error: "Expense not found" });
    }

    // In production, would check approval rules and route to correct approver
    await db.update(financeExpenses)
      .set({
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(financeExpenses.id, id));
    const [updated] = await db.select().from(financeExpenses).where(eq(financeExpenses.id, id));

    res.json({ success: true, data: updated, message: "Submitted for approval" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to submit for approval" });
  }
};

// =====================================================
// EXPENSE CATEGORIES MAPPING (IFRS)
// =====================================================

const getExpenseCategories: RequestHandler = async (req, res) => {
  try {
    const categories = [
      // COGS
      { code: "inventory", name: "Inventory / Raw Materials", nameAr: "المخزون", function: "cost_of_sales", glCode: "5100" },
      { code: "direct_labor", name: "Direct Labor", nameAr: "العمالة المباشرة", function: "cost_of_sales", glCode: "5110" },
      { code: "freight_in", name: "Freight In", nameAr: "الشحن الداخلي", function: "cost_of_sales", glCode: "5120" },
      // Selling & Distribution
      { code: "marketing", name: "Marketing & Advertising", nameAr: "التسويق والإعلان", function: "selling", glCode: "5200" },
      { code: "delivery", name: "Delivery & Shipping", nameAr: "التوصيل والشحن", function: "selling", glCode: "5210" },
      { code: "sales_commission", name: "Sales Commission", nameAr: "عمولة المبيعات", function: "selling", glCode: "5220" },
      // Administrative
      { code: "salaries", name: "Salaries & Wages", nameAr: "الرواتب والأجور", function: "administrative", glCode: "5300" },
      { code: "rent", name: "Rent", nameAr: "الإيجار", function: "administrative", glCode: "5310" },
      { code: "utilities", name: "Utilities", nameAr: "المرافق", function: "administrative", glCode: "5320" },
      { code: "office_supplies", name: "Office Supplies", nameAr: "مستلزمات المكتب", function: "administrative", glCode: "5330" },
      { code: "insurance", name: "Insurance", nameAr: "التأمين", function: "administrative", glCode: "5340" },
      { code: "professional_fees", name: "Professional Fees", nameAr: "الرسوم المهنية", function: "administrative", glCode: "5350" },
      { code: "licenses_permits", name: "Licenses & Permits", nameAr: "الرخص والتصاريح", function: "administrative", glCode: "5360" },
      { code: "bank_charges", name: "Bank Charges", nameAr: "رسوم البنك", function: "administrative", glCode: "5370" },
      // Fixed Assets
      { code: "equipment", name: "Equipment", nameAr: "المعدات", function: "administrative", glCode: "5400" },
      { code: "maintenance", name: "Repairs & Maintenance", nameAr: "الصيانة والإصلاحات", function: "administrative", glCode: "5410" },
      { code: "depreciation", name: "Depreciation", nameAr: "الإهلاك", function: "administrative", glCode: "5420" },
      { code: "amortization", name: "Amortization", nameAr: "الإطفاء", function: "administrative", glCode: "5430" },
      // Finance
      { code: "interest_expense", name: "Interest Expense", nameAr: "مصروفات الفوائد", function: "finance", glCode: "5500" },
      { code: "finance_charges", name: "Finance Charges", nameAr: "الرسوم المالية", function: "finance", glCode: "5510" },
      // Taxes
      { code: "taxes", name: "Taxes (Non-VAT)", nameAr: "الضرائب", function: "other_operating", glCode: "5600" },
      { code: "government_fees", name: "Government Fees", nameAr: "الرسوم الحكومية", function: "other_operating", glCode: "5610" },
      // Employee Benefits (IAS 19)
      { code: "employee_benefits", name: "Employee Benefits", nameAr: "مزايا الموظفين", function: "administrative", glCode: "5700" },
      { code: "training", name: "Training & Development", nameAr: "التدريب والتطوير", function: "administrative", glCode: "5710" },
      { code: "travel", name: "Travel & Transportation", nameAr: "السفر والمواصلات", function: "administrative", glCode: "5720" },
      { code: "meals_entertainment", name: "Meals & Entertainment", nameAr: "الوجبات والترفيه", function: "administrative", glCode: "5730" },
      // Other
      { code: "other", name: "Other Expenses", nameAr: "مصروفات أخرى", function: "other_operating", glCode: "5900" },
    ];
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get expense categories" });
  }
};

// =====================================================
// REPORTS
// =====================================================

const getProfitLossReport: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;
    let start: Date, end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    // Get orders
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end && o.status !== "cancelled"
    );

    const sales = filteredOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const otherIncome = 0;
    const totalRevenue = sales + otherIncome;

    // Get transactions for refunds
    const allTransactions = await db.select().from(financeTransactions);
    const periodTransactions = allTransactions.filter(
      (t) => new Date(t.createdAt) >= start && new Date(t.createdAt) <= end
    );

    // COGS (simplified)
    const inventoryCost = totalRevenue * 0.6;
    const supplierPurchases = periodTransactions
      .filter((t) => t.type === "purchase")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const totalCOGS = inventoryCost;
    const grossProfit = totalRevenue - totalCOGS;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Operating expenses by category
    const allExpenses = await db.select().from(financeExpenses);
    const periodExpenses = allExpenses.filter(
      (e) => new Date(e.createdAt) >= start && new Date(e.createdAt) <= end && e.status === "paid"
    );

    const expenseByCategory: Record<ExpenseCategory, number> = {} as any;
    periodExpenses.forEach((e) => {
      expenseByCategory[e.category as ExpenseCategory] = (expenseByCategory[e.category as ExpenseCategory] || 0) + Number(e.amount);
    });

    const operatingExpenses = Object.entries(expenseByCategory).map(([category, amount]) => ({
      category: category as ExpenseCategory,
      amount,
    }));

    const totalOperatingExpenses = periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const operatingProfit = grossProfit - totalOperatingExpenses;

    // Other expenses
    const vatPaid = 0;
    const refunds = periodTransactions
      .filter((t) => t.type === "refund")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const totalOther = vatPaid + refunds;
    const netProfit = operatingProfit - totalOther;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const report: ProfitLossReport = {
      period: period as string,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      revenue: {
        sales: Math.round(sales * 100) / 100,
        otherIncome,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
      costOfGoodsSold: {
        inventoryCost: Math.round(inventoryCost * 100) / 100,
        supplierPurchases: Math.round(supplierPurchases * 100) / 100,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
      },
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
      operatingExpenses,
      totalOperatingExpenses: Math.round(totalOperatingExpenses * 100) / 100,
      operatingProfit: Math.round(operatingProfit * 100) / 100,
      otherExpenses: {
        vatPaid,
        refunds: Math.round(refunds * 100) / 100,
        totalOther: Math.round(totalOther * 100) / 100,
      },
      netProfit: Math.round(netProfit * 100) / 100,
      netProfitMargin: Math.round(netProfitMargin * 100) / 100,
    };

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to generate profit/loss report" });
  }
};

const getCashFlowReport: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;
    let start: Date, end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    const accounts = await db.select().from(financeAccounts);
    const allTransactions = await db.select().from(financeTransactions);
    const allExpenses = await db.select().from(financeExpenses);
    const allOrders = await db.select().from(orders);

    const periodTransactions = allTransactions.filter(
      (t) => new Date(t.createdAt) >= start && new Date(t.createdAt) <= end
    );

    // Opening balance (simplified)
    const openingBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0) - 
      periodTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

    // Get orders
    const filteredOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end && o.status !== "cancelled"
    );

    const cardOrders = filteredOrders.filter((o) => o.paymentMethod === "card");
    const codOrders = filteredOrders.filter((o) => o.paymentMethod === "cod");

    const cashFromSales = cardOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const cashFromCOD = codOrders.reduce((sum, o) => sum + Number(o.total), 0);

    const cashFromRefunds = periodTransactions
      .filter((t) => t.type === "refund")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const cashToSuppliers = periodTransactions
      .filter((t) => t.type === "purchase")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const periodExpenses = allExpenses.filter(
      (e) => e.status === "paid" && e.paidAt && new Date(e.paidAt) >= start && new Date(e.paidAt) <= end
    );
    const cashToExpenses = periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const netOperating = cashFromSales + cashFromCOD + cashFromRefunds - cashToSuppliers - cashToExpenses;

    const closingBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const netCashFlow = closingBalance - openingBalance;

    // Daily cash flow
    const dailyCashFlow: CashFlowReport["dailyCashFlow"] = [];
    const currentDate = new Date(start);
    let runningBalance = openingBalance;

    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59);

      const dayInflow = periodTransactions
        .filter((t) => Number(t.amount) > 0 && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const dayOutflow = Math.abs(
        periodTransactions
          .filter((t) => Number(t.amount) < 0 && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd)
          .reduce((sum, t) => sum + Number(t.amount), 0)
      );

      const dayNet = dayInflow - dayOutflow;
      runningBalance += dayNet;

      dailyCashFlow.push({
        date: currentDate.toISOString().split("T")[0],
        inflow: Math.round(dayInflow * 100) / 100,
        outflow: Math.round(dayOutflow * 100) / 100,
        net: Math.round(dayNet * 100) / 100,
        balance: Math.round(runningBalance * 100) / 100,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const report: CashFlowReport = {
      period: period as string,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      openingBalance: Math.round(openingBalance * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      operatingActivities: {
        cashFromSales: Math.round(cashFromSales * 100) / 100,
        cashFromCOD: Math.round(cashFromCOD * 100) / 100,
        cashFromRefunds: Math.round(cashFromRefunds * 100) / 100,
        cashToSuppliers: Math.round(cashToSuppliers * 100) / 100,
        cashToExpenses: Math.round(cashToExpenses * 100) / 100,
        netOperating: Math.round(netOperating * 100) / 100,
      },
      investingActivities: {
        equipmentPurchases: 0,
        netInvesting: 0,
      },
      financingActivities: {
        ownerDrawings: 0,
        capitalInjection: 0,
        netFinancing: 0,
      },
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      dailyCashFlow,
    };

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to generate cash flow report" });
  }
};

const getVATReport: RequestHandler = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;
    let start: Date, end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      const range = getDateRange(period as string);
      start = range.start;
      end = range.end;
    }

    // Get orders for sales VAT
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end && o.status !== "cancelled"
    );

    const salesTaxableAmount = filteredOrders.reduce((sum, o) => sum + (Number(o.total) - Number(o.vatAmount)), 0);
    const salesVATAmount = filteredOrders.reduce((sum, o) => sum + Number(o.vatAmount), 0);

    // Purchases VAT (from supplier invoices)
    const purchasesTaxableAmount = 0;
    const purchasesVATAmount = 0;

    const vatDue = salesVATAmount - purchasesVATAmount;
    const vatRefund = vatDue < 0 ? Math.abs(vatDue) : 0;
    const netVAT = vatDue > 0 ? vatDue : 0;

    // Transaction details
    const transactionDetails = filteredOrders.map((o) => ({
      date: o.createdAt.toISOString(),
      type: "sale" as const,
      reference: o.orderNumber,
      taxableAmount: Math.round((Number(o.total) - Number(o.vatAmount)) * 100) / 100,
      vatAmount: Math.round(Number(o.vatAmount) * 100) / 100,
      vatRate: 5,
    }));

    const report: VATReport = {
      period: period as string,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      salesVAT: {
        taxableAmount: Math.round(salesTaxableAmount * 100) / 100,
        vatAmount: Math.round(salesVATAmount * 100) / 100,
        exemptAmount: 0,
      },
      purchasesVAT: {
        taxableAmount: Math.round(purchasesTaxableAmount * 100) / 100,
        vatAmount: Math.round(purchasesVATAmount * 100) / 100,
      },
      vatDue: Math.round(vatDue * 100) / 100,
      vatRefund: Math.round(vatRefund * 100) / 100,
      netVAT: Math.round(netVAT * 100) / 100,
      transactionDetails,
    };

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to generate VAT report" });
  }
};

const exportReport: RequestHandler = (req, res) => {
  const { reportType, format, startDate, endDate } = req.body;
  
  // In production, generate actual files
  res.json({
    success: true,
    data: {
      url: `/api/finance/reports/download/${reportType}-${format}-${Date.now()}`,
      filename: `${reportType}-report-${startDate}-${endDate}.${format}`,
    },
  });
};

// =====================================================
// UAE COMPLIANCE - BALANCE SHEET
// =====================================================

const getBalanceSheet: RequestHandler = async (req, res) => {
  try {
    const { asOfDate } = req.query;
    const endDate = asOfDate ? new Date(asOfDate as string) : new Date();

    // Get all orders up to date
    const allOrders = await db.select().from(orders);
    const completedOrders = allOrders.filter(
      (o) => new Date(o.createdAt) <= endDate && 
             o.status !== "cancelled" && 
             o.paymentStatus === "captured"
    );

    // Get all expenses up to date
    const allExpenses = await db.select().from(financeExpenses);
    const paidExpenses = allExpenses.filter(
      (e) => e.paidAt && new Date(e.paidAt) <= endDate
    );

    // Get finance accounts
    const accounts = await db.select().from(financeAccounts);

    // Calculate totals
    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalExpenses = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalVAT = completedOrders.reduce((sum, o) => sum + Number(o.vatAmount), 0);

    // Assets
    const cashInHand = accounts
      .filter((a) => a.type === "cash")
      .reduce((sum, a) => sum + Number(a.balance), 0);
    const bankAccounts = accounts
      .filter((a) => a.type === "bank")
      .reduce((sum, a) => sum + Number(a.balance), 0);
    const accountsReceivable = allOrders
      .filter((o) => o.paymentStatus === "pending" && o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total), 0);
    
    // Estimate inventory (simplified - would need proper inventory tracking)
    const inventoryValue = totalRevenue * 0.3; // Rough estimate
    
    const totalCurrentAssets = cashInHand + bankAccounts + accountsReceivable + inventoryValue;
    const fixedAssets = 50000; // Would come from fixed asset register
    const totalAssets = totalCurrentAssets + fixedAssets;

    // Liabilities
    const vatPayable = totalVAT;
    const accountsPayable = allExpenses
      .filter((e) => e.status === "pending" || e.status === "approved")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCurrentLiabilities = vatPayable + accountsPayable;
    const longTermLiabilities = 0;
    const totalLiabilities = totalCurrentLiabilities + longTermLiabilities;

    // Equity
    const openingCapital = 100000; // Would come from settings
    const retainedEarnings = totalRevenue - totalExpenses - (totalRevenue * 0.6); // Simplified
    const netIncome = totalRevenue - totalExpenses - (totalRevenue * 0.6);
    const totalEquity = openingCapital + retainedEarnings;

    const balanceSheet = {
      asOfDate: endDate.toISOString(),
      assets: {
        currentAssets: {
          cashInHand: Math.round(cashInHand * 100) / 100,
          bankAccounts: Math.round(bankAccounts * 100) / 100,
          accountsReceivable: Math.round(accountsReceivable * 100) / 100,
          inventory: Math.round(inventoryValue * 100) / 100,
          total: Math.round(totalCurrentAssets * 100) / 100,
        },
        fixedAssets: {
          equipment: 30000,
          furniture: 10000,
          vehicles: 10000,
          total: fixedAssets,
        },
        totalAssets: Math.round(totalAssets * 100) / 100,
      },
      liabilities: {
        currentLiabilities: {
          accountsPayable: Math.round(accountsPayable * 100) / 100,
          vatPayable: Math.round(vatPayable * 100) / 100,
          accruedExpenses: 0,
          total: Math.round(totalCurrentLiabilities * 100) / 100,
        },
        longTermLiabilities: {
          loans: 0,
          total: longTermLiabilities,
        },
        totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      },
      equity: {
        openingCapital: openingCapital,
        retainedEarnings: Math.round(retainedEarnings * 100) / 100,
        currentYearIncome: Math.round(netIncome * 100) / 100,
        totalEquity: Math.round(totalEquity * 100) / 100,
      },
      // Accounting equation check
      balanceCheck: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };

    res.json({ success: true, data: balanceSheet });
  } catch (error) {
    console.error("Balance sheet error:", error);
    res.status(500).json({ success: false, error: "Failed to generate balance sheet" });
  }
};

// =====================================================
// UAE COMPLIANCE - CHART OF ACCOUNTS
// =====================================================

const getChartOfAccounts: RequestHandler = async (req, res) => {
  try {
    // Return default UAE-compliant chart of accounts
    const defaultAccounts = [
      // Assets (1xxx)
      { code: "1000", name: "Assets", nameAr: "الأصول", accountClass: "asset", isHeader: true },
      { code: "1100", name: "Cash & Bank", nameAr: "النقد والبنوك", accountClass: "asset" },
      { code: "1110", name: "Cash in Hand", nameAr: "النقد في الصندوق", accountClass: "asset" },
      { code: "1120", name: "Bank Accounts", nameAr: "الحسابات البنكية", accountClass: "asset" },
      { code: "1200", name: "Accounts Receivable", nameAr: "الذمم المدينة", accountClass: "asset" },
      { code: "1300", name: "Inventory", nameAr: "المخزون", accountClass: "asset" },
      { code: "1400", name: "Fixed Assets", nameAr: "الأصول الثابتة", accountClass: "asset" },
      
      // Liabilities (2xxx)
      { code: "2000", name: "Liabilities", nameAr: "الالتزامات", accountClass: "liability", isHeader: true },
      { code: "2100", name: "Accounts Payable", nameAr: "الذمم الدائنة", accountClass: "liability" },
      { code: "2200", name: "VAT Payable", nameAr: "ضريبة القيمة المضافة المستحقة", accountClass: "liability" },
      { code: "2300", name: "Accrued Expenses", nameAr: "المصروفات المستحقة", accountClass: "liability" },
      
      // Equity (3xxx)
      { code: "3000", name: "Equity", nameAr: "حقوق الملكية", accountClass: "equity", isHeader: true },
      { code: "3100", name: "Owner's Capital", nameAr: "رأس مال المالك", accountClass: "equity" },
      { code: "3200", name: "Retained Earnings", nameAr: "الأرباح المحتجزة", accountClass: "equity" },
      
      // Revenue (4xxx)
      { code: "4000", name: "Revenue", nameAr: "الإيرادات", accountClass: "revenue", isHeader: true },
      { code: "4100", name: "Sales Revenue", nameAr: "إيرادات المبيعات", accountClass: "revenue" },
      { code: "4200", name: "Delivery Revenue", nameAr: "إيرادات التوصيل", accountClass: "revenue" },
      { code: "4900", name: "Other Income", nameAr: "إيرادات أخرى", accountClass: "revenue" },
      
      // Expenses (5xxx)
      { code: "5000", name: "Expenses", nameAr: "المصروفات", accountClass: "expense", isHeader: true },
      { code: "5100", name: "Cost of Goods Sold", nameAr: "تكلفة البضاعة المباعة", accountClass: "expense" },
      { code: "5200", name: "Salaries & Wages", nameAr: "الرواتب والأجور", accountClass: "expense" },
      { code: "5300", name: "Rent Expense", nameAr: "مصروف الإيجار", accountClass: "expense" },
      { code: "5400", name: "Utilities", nameAr: "المرافق", accountClass: "expense" },
      { code: "5500", name: "Marketing", nameAr: "التسويق", accountClass: "expense" },
      { code: "5600", name: "Delivery Expenses", nameAr: "مصروفات التوصيل", accountClass: "expense" },
      { code: "5700", name: "Maintenance", nameAr: "الصيانة", accountClass: "expense" },
      { code: "5800", name: "Bank Charges", nameAr: "رسوم بنكية", accountClass: "expense" },
      { code: "5900", name: "Other Expenses", nameAr: "مصروفات أخرى", accountClass: "expense" },
    ];

    res.json({ success: true, data: defaultAccounts });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get chart of accounts" });
  }
};

const createChartAccount: RequestHandler = async (req, res) => {
  try {
    const { code, name, nameAr, accountClass, parentId, description } = req.body;
    
    // Validate
    if (!code || !name || !accountClass) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // In production, save to database
    const newAccount = {
      id: generateId("acc"),
      code,
      name,
      nameAr,
      accountClass,
      parentId,
      description,
      isActive: true,
      isSystemAccount: false,
      balance: "0",
      normalBalance: ["asset", "expense"].includes(accountClass) ? "debit" : "credit",
      createdAt: new Date().toISOString(),
    };

    res.json({ success: true, data: newAccount });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create account" });
  }
};

// =====================================================
// UAE COMPLIANCE - JOURNAL ENTRIES
// =====================================================

const getJournalEntries: RequestHandler = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    // Get recent orders as sample journal entries
    const allOrders = await db.select().from(orders);
    const recentOrders = allOrders
      .filter((o) => o.paymentStatus === "captured")
      .slice(0, 20);

    const journalEntries = recentOrders.map((order, idx) => ({
      id: `je_${order.id}`,
      entryNumber: `JE-${new Date(order.createdAt).getFullYear()}-${String(idx + 1).padStart(4, "0")}`,
      entryDate: order.createdAt.toISOString(),
      description: `Sale - Order ${order.orderNumber}`,
      descriptionAr: `مبيعات - طلب ${order.orderNumber}`,
      reference: order.orderNumber,
      referenceType: "order",
      referenceId: order.id,
      status: "posted",
      totalDebit: Number(order.total),
      totalCredit: Number(order.total),
      createdBy: "system",
      postedAt: order.createdAt.toISOString(),
      lines: [
        {
          accountCode: "1110",
          accountName: "Cash in Hand",
          debit: Number(order.total),
          credit: 0,
          description: `Payment received for ${order.orderNumber}`,
        },
        {
          accountCode: "4100",
          accountName: "Sales Revenue",
          debit: 0,
          credit: Number(order.total) - Number(order.vatAmount),
          description: `Sale ${order.orderNumber}`,
        },
        {
          accountCode: "2200",
          accountName: "VAT Payable",
          debit: 0,
          credit: Number(order.vatAmount),
          description: `VAT on ${order.orderNumber}`,
        },
      ],
    }));

    res.json({ success: true, data: journalEntries });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get journal entries" });
  }
};

const createJournalEntry: RequestHandler = async (req, res) => {
  try {
    const { entryDate, description, descriptionAr, reference, lines } = req.body;
    
    if (!lines || lines.length < 2) {
      return res.status(400).json({ success: false, error: "Journal entry must have at least 2 lines" });
    }

    // Validate debits = credits
    const totalDebit = lines.reduce((sum: number, l: any) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum: number, l: any) => sum + (Number(l.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        error: `Debits (${totalDebit}) must equal Credits (${totalCredit})` 
      });
    }

    const entryNumber = `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    
    const entry = {
      id: generateId("je"),
      entryNumber,
      entryDate: entryDate || new Date().toISOString(),
      description,
      descriptionAr,
      reference,
      status: "draft",
      totalDebit,
      totalCredit,
      lines,
      createdBy: "admin",
      createdAt: new Date().toISOString(),
    };

    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create journal entry" });
  }
};

const postJournalEntry: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    
    // In production, update entry status and account balances
    res.json({ 
      success: true, 
      data: { id, status: "posted", postedAt: new Date().toISOString() },
      message: "Journal entry posted successfully" 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to post journal entry" });
  }
};

// =====================================================
// UAE COMPLIANCE - AUDIT LOG
// =====================================================

const getAuditLog: RequestHandler = async (req, res) => {
  try {
    const { entityType, startDate, endDate, limit = 100 } = req.query;

    // Get order history as sample audit log
    const allOrders = await db.select().from(orders);
    const auditEntries = allOrders.slice(0, Number(limit)).flatMap((order) => {
      const entries = [];
      
      // Order created
      entries.push({
        id: `audit_${order.id}_create`,
        entityType: "order",
        entityId: order.id,
        action: "create",
        previousValue: null,
        newValue: { status: "pending", total: Number(order.total) },
        userId: order.userId || "guest",
        userName: order.customerName,
        createdAt: order.createdAt.toISOString(),
      });

      // Status changes from history
      const history = (order.statusHistory as any[]) || [];
      history.forEach((h, idx) => {
        entries.push({
          id: `audit_${order.id}_status_${idx}`,
          entityType: "order",
          entityId: order.id,
          action: "status_change",
          previousValue: { status: history[idx - 1]?.status || "pending" },
          newValue: { status: h.status },
          changedFields: ["status"],
          userId: h.changedBy || "system",
          userName: h.changedBy || "System",
          createdAt: h.changedAt,
        });
      });

      return entries;
    });

    res.json({ success: true, data: auditEntries.slice(0, Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
};

// =====================================================
// UAE COMPLIANCE - VAT RETURNS (FTA Form 201)
// =====================================================

const getVATReturns: RequestHandler = async (req, res) => {
  try {
    // Return list of VAT return periods
    const currentYear = new Date().getFullYear();
    const vatReturns = [];

    // Generate quarterly periods
    for (let q = 1; q <= 4; q++) {
      const startMonth = (q - 1) * 3;
      const periodStart = new Date(currentYear, startMonth, 1);
      const periodEnd = new Date(currentYear, startMonth + 3, 0);
      const dueDate = new Date(currentYear, startMonth + 3, 28);

      vatReturns.push({
        id: `vat_${currentYear}_q${q}`,
        period: `Q${q} ${currentYear}`,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        dueDate: dueDate.toISOString(),
        status: q < Math.ceil((new Date().getMonth() + 1) / 3) ? "submitted" : "draft",
        netVatDue: Math.round(Math.random() * 10000 * 100) / 100,
      });
    }

    res.json({ success: true, data: vatReturns });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get VAT returns" });
  }
};

const createVATReturn: RequestHandler = async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.body;
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Get all orders in period
    const allOrders = await db.select().from(orders);
    const periodOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= start && 
             new Date(o.createdAt) <= end && 
             o.status !== "cancelled"
    );

    // Calculate VAT by emirate (simplified - using Dubai as default)
    const totalSales = periodOrders.reduce((sum, o) => sum + Number(o.total) - Number(o.vatAmount), 0);
    const totalVat = periodOrders.reduce((sum, o) => sum + Number(o.vatAmount), 0);

    // FTA VAT Return Form 201 structure
    const vatReturn = {
      id: generateId("vat"),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      dueDate: new Date(end.getFullYear(), end.getMonth() + 1, 28).toISOString(),
      
      // Box 1-7: Sales by Emirate (simplified - all in Dubai)
      box1Amount: 0, box1Vat: 0, // Abu Dhabi
      box2Amount: totalSales, box2Vat: totalVat, // Dubai
      box3Amount: 0, box3Vat: 0, // Sharjah
      box4Amount: 0, box4Vat: 0, // Ajman
      box5Amount: 0, box5Vat: 0, // UAQ
      box6Amount: 0, box6Vat: 0, // RAK
      box7Amount: 0, box7Vat: 0, // Fujairah
      
      // Box 8: Zero-rated supplies
      box8Amount: 0,
      
      // Box 9: Exempt supplies
      box9Amount: 0,
      
      // Box 10: Recoverable VAT on expenses
      box10Vat: 0,
      
      // Totals
      totalSalesVat: Math.round(totalVat * 100) / 100,
      totalPurchasesVat: 0,
      netVatDue: Math.round(totalVat * 100) / 100,
      
      status: "draft",
      createdAt: new Date().toISOString(),
    };

    res.json({ success: true, data: vatReturn });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create VAT return" });
  }
};

// =====================================================
// ROUTES
// =====================================================

router.get("/summary", getFinanceSummary);
router.get("/transactions", getTransactions);
router.get("/transactions/:id", getTransactionById);
router.get("/accounts", getAccounts);
router.get("/accounts/:id", getAccountById);
router.post("/accounts", createAccount);
router.put("/accounts/:id", updateAccount);
router.post("/accounts/transfer", transferBetweenAccounts);
router.post("/accounts/:id/reconcile", reconcileAccount);
router.get("/expenses", getExpenses);
router.post("/expenses", createExpense);
router.put("/expenses/:id", updateExpense);
router.delete("/expenses/:id", deleteExpense);
router.post("/expenses/:id/pay", markExpensePaid);
router.post("/expenses/:id/approve", approveExpense);
router.post("/expenses/:id/reject", rejectExpense);
router.post("/expenses/:id/submit", submitForApproval);
router.get("/expenses/pending-approvals", getPendingApprovals);
router.get("/expenses/categories", getExpenseCategories);
router.get("/expenses/aging", getAgingReport);
router.get("/vendors", getVendors);
router.post("/vendors", createVendor);
router.get("/vendors/:id", getVendorById);
router.get("/cost-centers", getCostCenters);
router.post("/cost-centers", createCostCenter);
router.get("/budgets", getBudgets);
router.post("/budgets", createBudget);
router.get("/budgets/vs-actual", getBudgetVsActual);
router.get("/approval-rules", getApprovalRules);
router.get("/reports/profit-loss", getProfitLossReport);
router.get("/reports/cash-flow", getCashFlowReport);
router.get("/reports/vat", getVATReport);
router.get("/reports/balance-sheet", getBalanceSheet);
router.get("/chart-of-accounts", getChartOfAccounts);
router.post("/chart-of-accounts", createChartAccount);
router.get("/journal-entries", getJournalEntries);
router.post("/journal-entries", createJournalEntry);
router.post("/journal-entries/:id/post", postJournalEntry);
router.get("/audit-log", getAuditLog);
router.get("/vat-returns", getVATReturns);
router.post("/vat-returns", createVATReturn);
router.post("/reports/export", exportReport);

export default router;
