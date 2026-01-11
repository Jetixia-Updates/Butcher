import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  RotateCcw,
  CreditCard,
  Smartphone,
  ChevronRight,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useWallet, WalletTransaction } from "@/context/WalletContext";
import { cn } from "@/lib/utils";

export default function WalletPage() {
  const { language } = useLanguage();
  const { balance, transactions, isLoading, topUp } = useWallet();
  const isRTL = language === "ar";

  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  // Translations
  const t = {
    en: {
      title: "My Wallet",
      balance: "Available Balance",
      topUp: "Top Up",
      recentTransactions: "Recent Transactions",
      noTransactions: "No transactions yet",
      startShopping: "Start shopping to earn cashback!",
      selectAmount: "Select Amount",
      customAmount: "Custom Amount",
      paymentMethod: "Payment Method",
      card: "Credit/Debit Card",
      applePay: "Apple Pay",
      cancel: "Cancel",
      confirm: "Confirm Top Up",
      processing: "Processing...",
      success: "Top Up Successful!",
      added: "has been added to your wallet",
      done: "Done",
      credit: "Credit",
      debit: "Payment",
      refund: "Refund",
      topUpLabel: "Top Up",
      cashback: "Cashback",
      aed: "AED",
      earnCashback: "Earn 2% cashback on every order!",
    },
    ar: {
      title: "محفظتي",
      balance: "الرصيد المتاح",
      topUp: "شحن الرصيد",
      recentTransactions: "المعاملات الأخيرة",
      noTransactions: "لا توجد معاملات بعد",
      startShopping: "ابدأ التسوق لكسب الاسترداد النقدي!",
      selectAmount: "اختر المبلغ",
      customAmount: "مبلغ مخصص",
      paymentMethod: "طريقة الدفع",
      card: "بطاقة ائتمان/خصم",
      applePay: "Apple Pay",
      cancel: "إلغاء",
      confirm: "تأكيد الشحن",
      processing: "جاري المعالجة...",
      success: "تم الشحن بنجاح!",
      added: "تمت إضافته إلى محفظتك",
      done: "تم",
      credit: "إضافة",
      debit: "دفع",
      refund: "استرداد",
      topUpLabel: "شحن",
      cashback: "استرداد نقدي",
      aed: "درهم",
      earnCashback: "اكسب 2% استرداد نقدي على كل طلب!",
    },
  };

  const tt = t[language];

  const quickAmounts = [50, 100, 200, 500];

  const handleTopUp = async () => {
    if (topUpAmount <= 0) return;
    
    setIsProcessing(true);
    const success = await topUp(topUpAmount, paymentMethod);
    setIsProcessing(false);

    if (success) {
      setTopUpSuccess(true);
    }
  };

  const resetTopUp = () => {
    setShowTopUp(false);
    setTopUpSuccess(false);
    setTopUpAmount(100);
    setPaymentMethod("card");
  };

  const getTransactionIcon = (type: WalletTransaction["type"]) => {
    switch (type) {
      case "credit":
        return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
      case "debit":
        return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case "refund":
        return <RotateCcw className="w-5 h-5 text-blue-500" />;
      case "topup":
        return <Plus className="w-5 h-5 text-green-500" />;
      case "cashback":
        return <Gift className="w-5 h-5 text-purple-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionLabel = (type: WalletTransaction["type"]) => {
    const labels: Record<string, string> = {
      credit: tt.credit,
      debit: tt.debit,
      refund: tt.refund,
      topup: tt.topUpLabel,
      cashback: tt.cashback,
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary/80 text-white px-4 pt-6 pb-16">
        <h1 className="text-xl font-bold mb-6">{tt.title}</h1>
        
        {/* Balance Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-white/80">{tt.balance}</p>
              <p className="text-3xl font-bold">
                {tt.aed} {balance.toFixed(2)}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowTopUp(true)}
            className="w-full py-3 bg-white text-primary rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {tt.topUp}
          </button>
        </div>

        {/* Cashback Banner */}
        <div className="mt-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-3 flex items-center gap-3">
          <Gift className="w-8 h-8 text-yellow-300" />
          <p className="text-sm text-white/90">{tt.earnCashback}</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-4 -mt-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-border">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">{tt.recentTransactions}</h2>
          </div>
          
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{tt.noTransactions}</p>
              <p className="text-sm text-muted-foreground mt-1">{tt.startShopping}</p>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 mt-4 text-primary font-medium hover:underline"
              >
                {language === "en" ? "Shop Now" : "تسوق الآن"}
                <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    transaction.amount >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
                  )}>
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">
                      {isRTL ? transaction.descriptionAr : transaction.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="px-2 py-0.5 bg-muted rounded-full">
                        {getTransactionLabel(transaction.type)}
                      </span>
                      <span>
                        {new Date(transaction.createdAt).toLocaleDateString(
                          isRTL ? "ar-AE" : "en-US",
                          { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>
                  </div>
                  <div className={cn(
                    "font-semibold",
                    transaction.amount >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {transaction.amount >= 0 ? "+" : ""}{tt.aed} {Math.abs(transaction.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden">
            {topUpSuccess ? (
              // Success State
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">{tt.success}</h2>
                <p className="text-muted-foreground mb-6">
                  {tt.aed} {topUpAmount.toFixed(2)} {tt.added}
                </p>
                <button
                  onClick={resetTopUp}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                >
                  {tt.done}
                </button>
              </div>
            ) : (
              // Top Up Form
              <>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">{tt.topUp}</h2>
                  <button
                    onClick={resetTopUp}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-6">
                  {/* Quick Amounts */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">{tt.selectAmount}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {quickAmounts.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setTopUpAmount(amount)}
                          className={cn(
                            "py-3 rounded-xl font-semibold transition-all",
                            topUpAmount === amount
                              ? "bg-primary text-white"
                              : "bg-muted text-foreground hover:bg-muted/80"
                          )}
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Amount */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">{tt.customAmount}</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {tt.aed}
                      </span>
                      <input
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full pl-16 pr-4 py-3 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                        min="10"
                        step="10"
                      />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">{tt.paymentMethod}</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => setPaymentMethod("card")}
                        className={cn(
                          "w-full p-4 rounded-xl border flex items-center gap-3 transition-all",
                          paymentMethod === "card"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <CreditCard className="w-6 h-6 text-primary" />
                        <span className="font-medium text-foreground">{tt.card}</span>
                        {paymentMethod === "card" && (
                          <CheckCircle className="w-5 h-5 text-primary ml-auto" />
                        )}
                      </button>
                      <button
                        onClick={() => setPaymentMethod("apple_pay")}
                        className={cn(
                          "w-full p-4 rounded-xl border flex items-center gap-3 transition-all",
                          paymentMethod === "apple_pay"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Smartphone className="w-6 h-6 text-gray-900 dark:text-white" />
                        <span className="font-medium text-foreground">{tt.applePay}</span>
                        {paymentMethod === "apple_pay" && (
                          <CheckCircle className="w-5 h-5 text-primary ml-auto" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-border flex gap-3">
                  <button
                    onClick={resetTopUp}
                    className="flex-1 py-3 border border-border rounded-xl font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {tt.cancel}
                  </button>
                  <button
                    onClick={handleTopUp}
                    disabled={topUpAmount <= 0 || isProcessing}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? tt.processing : `${tt.confirm} - ${tt.aed} ${topUpAmount}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
