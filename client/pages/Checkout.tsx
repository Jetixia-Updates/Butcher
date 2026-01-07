import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useBasket } from "@/context/BasketContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { PriceDisplay } from "@/components/CurrencySymbol";

type PaymentMethod = "card" | "cod" | null;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, vat, total } = useBasket();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper function to get localized item name
  const getItemName = (item: typeof items[0]) => {
    return language === "ar" && item.nameAr ? item.nameAr : item.name;
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Your basket is empty
            </h1>
            <button
              onClick={() => navigate("/products")}
              className="btn-primary mt-4"
            >
              Back to Products
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };

  const handleCardPayment = () => {
    setIsProcessing(true);
    navigate("/payment/card");
  };

  const handleCODPayment = () => {
    setIsProcessing(true);
    // Simulate order placement
    setTimeout(() => {
      alert(
        "Order placed successfully! Our team will contact you within 2 hours to confirm delivery."
      );
      navigate("/products");
      setIsProcessing(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-muted text-foreground font-bold flex items-center justify-center mb-2">
                  ✓
                </div>
                <p className="text-xs text-muted-foreground">Basket</p>
              </div>
              <div className="w-12 h-1 bg-muted" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-2">
                  2
                </div>
                <p className="text-xs text-foreground font-semibold">Checkout</p>
              </div>
              <div className="w-12 h-1 bg-muted" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center mb-2">
                  3
                </div>
                <p className="text-xs text-muted-foreground">Confirmation</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Checkout Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Delivery Details */}
              <div className="card-premium p-6">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Delivery Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-semibold text-foreground">
                      {user?.firstName} {user?.familyName}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-semibold text-foreground">
                      {user?.mobile}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-semibold text-foreground">
                      {user?.address}, {user?.emirate}
                    </p>
                  </div>
                </div>
                <button className="btn-outline w-full mt-4 py-2 text-sm">
                  Edit Details
                </button>
              </div>

              {/* Payment Method Selection */}
              <div className="card-premium p-6">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Payment Method
                </h2>

                <div className="space-y-4">
                  {/* Credit Card Option */}
                  <div
                    onClick={() => handlePaymentMethodSelect("card")}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      paymentMethod === "card"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          paymentMethod === "card"
                            ? "border-primary bg-primary"
                            : "border-border"
                        }`}
                      >
                        {paymentMethod === "card" && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          Credit Card
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pay securely with Visa, Mastercard, or American Express
                        </p>
                      </div>
                      <div className="text-2xl">💳</div>
                    </div>
                  </div>

                  {/* Cash on Delivery Option */}
                  <div
                    onClick={() => handlePaymentMethodSelect("cod")}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      paymentMethod === "cod"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          paymentMethod === "cod"
                            ? "border-primary bg-primary"
                            : "border-border"
                        }`}
                      >
                        {paymentMethod === "cod" && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          Cash on Delivery
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pay with cash when your order arrives
                        </p>
                      </div>
                      <div className="text-2xl">💵</div>
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                {paymentMethod && (
                  <button
                    onClick={
                      paymentMethod === "card"
                        ? handleCardPayment
                        : handleCODPayment
                    }
                    disabled={isProcessing}
                    className="w-full btn-primary py-3 rounded-lg font-semibold text-base mt-6 disabled:opacity-50 transition-all"
                  >
                    {isProcessing
                      ? "Processing..."
                      : paymentMethod === "card"
                      ? "Continue to Payment"
                      : "Confirm Order"}
                  </button>
                )}
              </div>

              {/* Order Info */}
              <div className="card-premium p-6 bg-secondary/10">
                <p className="text-sm text-muted-foreground">
                  ℹ️ Your order will be processed securely. No card details are
                  stored on our servers.
                </p>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="card-premium p-6 sticky top-24 space-y-4">
                <h2 className="text-xl font-bold text-foreground">
                  Order Summary
                </h2>

                {/* Items */}
                <div className="space-y-2 max-h-64 overflow-y-auto border-b border-border pb-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-muted-foreground">
                        {getItemName(item)} x {item.quantity.toFixed(3)} {language === "ar" ? "جرام" : "gr"}
                      </span>
                      <span className="font-semibold">
                        <PriceDisplay price={item.price * item.quantity} size="sm" />
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold"><PriceDisplay price={subtotal} size="md" /></span>
                  </div>
                  <div className="flex justify-between items-center bg-secondary/10 -mx-6 px-6 py-2">
                    <span className="text-muted-foreground">VAT (5%)</span>
                    <span className="font-semibold text-secondary">
                      <PriceDisplay price={vat} size="md" />
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-lg font-bold text-foreground">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      <PriceDisplay price={total} size="lg" />
                    </span>
                  </div>
                </div>

                {/* Back to Basket */}
                <button
                  onClick={() => navigate("/basket")}
                  className="btn-outline w-full py-2 text-sm rounded-lg"
                >
                  Back to Basket
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
