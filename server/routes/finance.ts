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
} from "@shared/api";
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

    // Get orders in date range
    const allOrders = await db.select().from(orders);
    const filteredOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= start && new Date(o.createdAt) <= end && o.status !== "cancelled"
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
  const [newAccount] = await db.insert(financeAccounts).values({
    id: generateId("acc"),
    ...req.body,
    balance: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  res.status(201).json({ success: true, data: newAccount });
};

const updateAccount: RequestHandler = async (req, res) => {
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.id, req.params.id));
  if (accounts.length === 0) {
    return res.status(404).json({ success: false, error: "Account not found" });
  }

  const [updated] = await db.update(financeAccounts)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(financeAccounts.id, req.params.id))
    .returning();

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

  const [updated] = await db.update(financeAccounts)
    .set({
      balance: String(statementBalance),
      lastReconciled: new Date(reconciliationDate),
      updatedAt: new Date(),
    })
    .where(eq(financeAccounts.id, req.params.id))
    .returning();

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
  const [newExpense] = await db.insert(financeExpenses).values({
    id: generateId("exp"),
    category: data.category,
    amount: String(data.amount),
    description: data.description,
    descriptionAr: data.descriptionAr,
    vendor: data.vendor,
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    notes: data.notes,
    isRecurring: data.isRecurring,
    recurringFrequency: data.recurringFrequency,
    accountId: data.accountId,
    currency: "AED",
    status: "pending",
    createdBy: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  res.status(201).json({ success: true, data: newExpense });
};

const updateExpense: RequestHandler = async (req, res) => {
  const expenses = await db.select().from(financeExpenses).where(eq(financeExpenses.id, req.params.id));
  if (expenses.length === 0) {
    return res.status(404).json({ success: false, error: "Expense not found" });
  }

  const [updated] = await db.update(financeExpenses)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(financeExpenses.id, req.params.id))
    .returning();

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
  const [updatedExpense] = await db.update(financeExpenses)
    .set({
      status: "paid",
      paidAt: new Date(),
      accountId,
      updatedAt: new Date(),
    })
    .where(eq(financeExpenses.id, req.params.id))
    .returning();

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
router.get("/reports/profit-loss", getProfitLossReport);
router.get("/reports/cash-flow", getCashFlowReport);
router.get("/reports/vat", getVATReport);
router.post("/reports/export", exportReport);

export default router;
