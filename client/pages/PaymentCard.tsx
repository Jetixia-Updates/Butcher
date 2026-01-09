import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useBasket } from "@/context/BasketContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications, createOrderNotification, createUserOrderNotification, createDetailedInvoiceNotification, generateInvoiceNumber, type InvoiceData } from "@/context/NotificationContext";
import { formatPrice } from "@/utils/vat";
import {
  isValidCardNumber,
  isValidCVV,
  isValidExpiryDate,
} from "@/utils/validators";
import { ordersApi, deliveryApi } from "@/lib/api";
import type { Address } from "@shared/api";

export default function PaymentCardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, subtotal, vat, total, clearBasket } = useBasket();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  
  // Get addressId and delivery time slot from navigation state (passed from Checkout)
  const addressId = (location.state as { addressId?: string; deliveryTimeSlot?: string })?.addressId || "";
  const deliveryTimeSlot = (location.state as { addressId?: string; deliveryTimeSlot?: string })?.deliveryTimeSlot || "";
  
  // State for delivery address
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  const [formData, setFormData] = useState({
    cardholderName: user?.firstName || "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    billingAddress: user?.address || "",
    vat_reference: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch delivery address on mount
  React.useEffect(() => {
    const fetchAddress = async () => {
      if (!addressId || !user?.id) return;
      
      try {
        const response = await deliveryApi.getAddresses(user.id);
        if (response.success && response.data) {
          const address = response.data.find(a => a.id === addressId);
          if (address) {
            setSelectedAddress(address);
          }
        }
      } catch (err) {
        console.error("Failed to fetch address:", err);
      }
    };
    
    fetchAddress();
  }, [addressId, user?.id]);

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

  // If no addressId was passed, redirect back to checkout
  if (!addressId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              No delivery address selected
            </h1>
            <p className="text-muted-foreground mb-4">
              Please select a delivery address before proceeding to payment.
            </p>
            <button
              onClick={() => navigate("/checkout")}
              className="btn-primary mt-4"
            >
              Back to Checkout
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.cardholderName.trim()) {
      newErrors.cardholderName = "Cardholder name is required";
    }

    if (!isValidCardNumber(formData.cardNumber)) {
      newErrors.cardNumber = "Invalid card number";
    }

    if (!isValidExpiryDate(formData.expiryDate)) {
      newErrors.expiryDate = "Invalid expiry date (MM/YY)";
    }

    if (!isValidCVV(formData.cvv)) {
      newErrors.cvv = "Invalid CVV (3-4 digits)";
    }

    if (formData.billingAddress.length < 5) {
      newErrors.billingAddress = "Please enter a valid billing address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let processedValue = value;

    // Format card number with spaces
    if (name === "cardNumber") {
      processedValue = value
        .replace(/\s/g, "")
        .replace(/(\d{4})/g, "$1 ")
        .trim();
    }

    // Format expiry date
    if (name === "expiryDate") {
      processedValue = value
        .replace(/\D/g, "")
        .slice(0, 4)
        .replace(/(\d{2})(\d{0,2})/, "$1/$2");
    }

    // Only allow digits for CVV
    if (name === "cvv") {
      processedValue = value.replace(/\D/g, "").slice(0, 4);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);
    setApiError(null);

    // Build delivery notes with time slot and VAT reference
    const deliveryNotesParts: string[] = [];
    if (deliveryTimeSlot) {
      deliveryNotesParts.push(`Preferred Delivery Time: ${deliveryTimeSlot}`);
    }
    if (formData.vat_reference) {
      deliveryNotesParts.push(`VAT Reference: ${formData.vat_reference}`);
    }
    const deliveryNotes = deliveryNotesParts.join(" | ");

    try {
      // Create order in the backend
      const response = await ordersApi.create({
        userId: user?.id || "",
        items: items.map((item) => ({
          productId: item.productId || item.id.split('_')[0], // Use productId, fallback to extracting from id
          quantity: item.quantity,
          notes: item.notes,
        })),
        addressId: addressId,
        paymentMethod: "card",
        deliveryNotes: deliveryNotes,
      });

      if (response.success && response.data) {
        // Add notification for the admin
        addNotification(createOrderNotification(response.data.orderNumber, "new"));
        
        // Add notification for the user
        addNotification(createUserOrderNotification(response.data.orderNumber, "placed"));
        
        // Generate TAX invoice
        const invoiceNumber = generateInvoiceNumber(response.data.orderNumber);
        const invoiceData: InvoiceData = {
          invoiceNumber,
          orderNumber: response.data.orderNumber,
          date: new Date().toLocaleDateString("en-AE", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          customerName: selectedAddress?.fullName || formData.cardholderName || user?.firstName + " " + user?.familyName || "Customer",
          customerMobile: selectedAddress?.mobile || user?.mobile || "",
          customerAddress: selectedAddress 
            ? `${selectedAddress.building}, ${selectedAddress.street}, ${selectedAddress.area}, ${selectedAddress.emirate}`
            : formData.billingAddress,
          items: items.map((item) => ({
            name: item.name,
            nameAr: item.nameAr,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
          })),
          subtotal,
          vatRate: 5,
          vatAmount: vat,
          total,
          paymentMethod: "card",
          vatReference: formData.vat_reference || undefined,
        };

        // Send TAX invoice notification to the user
        addNotification(createDetailedInvoiceNotification(invoiceData));
        
        clearBasket();
        alert(
          `Payment successful! Your order has been placed.\n\nOrder ID: ${response.data.orderNumber}\nInvoice: ${invoiceNumber}\n\nYour TAX invoice has been sent to your notifications.\n\nThank you for your order!`
        );
        navigate("/products");
      } else {
        setApiError(response.error || "Failed to create order. Please try again.");
      }
    } catch (err) {
      setApiError("Network error. Please check your connection and try again.");
    }

    setIsProcessing(false);
  };

  const FormField = ({
    label,
    name,
    type = "text",
    placeholder,
    required = true,
    helper,
  }: {
    label: string;
    name: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    helper?: string;
  }) => (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-2">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={formData[name as keyof typeof formData]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2 rounded-lg border-2 transition-colors ${
          errors[name]
            ? "border-destructive bg-destructive/5"
            : "border-input bg-white focus:border-primary"
        } text-foreground placeholder-muted-foreground focus:outline-none`}
      />
      {errors[name] && (
        <p className="text-destructive text-xs mt-1">{errors[name]}</p>
      )}
      {helper && !errors[name] && (
        <p className="text-muted-foreground text-xs mt-1">{helper}</p>
      )}
    </div>
  );

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
                <div className="w-10 h-10 rounded-full bg-muted text-foreground font-bold flex items-center justify-center mb-2">
                  ✓
                </div>
                <p className="text-xs text-muted-foreground">Checkout</p>
              </div>
              <div className="w-12 h-1 bg-muted" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-2">
                  3
                </div>
                <p className="text-xs text-foreground font-semibold">Payment</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Payment Form */}
            <div className="lg:col-span-2">
              <div className="card-premium p-8 space-y-6">
                <h1 className="text-3xl font-bold text-foreground">
                  Complete Payment
                </h1>
                <p className="text-muted-foreground">
                  All transactions are secure and encrypted
                </p>

                {/* API Error Display */}
                {apiError && (
                  <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg">
                    {apiError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Cardholder Name */}
                  <FormField
                    label="Cardholder Name"
                    name="cardholderName"
                    placeholder="John Doe"
                  />

                  {/* Card Number */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Card Number<span className="text-destructive">*</span>
                    </label>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 bg-white border-input">
                      <svg
                        className="w-6 h-6 text-secondary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M20 8H4V6h16m0 5H4v2h16m0 5H4v2h16z" />
                      </svg>
                      <input
                        type="text"
                        name="cardNumber"
                        value={formData.cardNumber}
                        onChange={handleChange}
                        placeholder="1234 5678 9012 3456"
                        className="flex-1 outline-none text-foreground placeholder-muted-foreground"
                      />
                    </div>
                    {errors.cardNumber && (
                      <p className="text-destructive text-xs mt-1">
                        {errors.cardNumber}
                      </p>
                    )}
                  </div>

                  {/* Expiry & CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Expiry Date"
                      name="expiryDate"
                      placeholder="MM/YY"
                      helper="Valid through end of month"
                    />
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        CVV<span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showCVV ? "text" : "password"}
                          name="cvv"
                          value={formData.cvv}
                          onChange={handleChange}
                          placeholder="123"
                          className={`w-full px-4 py-2 rounded-lg border-2 transition-colors ${
                            errors.cvv
                              ? "border-destructive bg-destructive/5"
                              : "border-input bg-white focus:border-primary"
                          } text-foreground placeholder-muted-foreground focus:outline-none`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCVV(!showCVV)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-sm"
                        >
                          {showCVV ? "Hide" : "Show"}
                        </button>
                      </div>
                      {errors.cvv && (
                        <p className="text-destructive text-xs mt-1">
                          {errors.cvv}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Billing Address
                      <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      name="billingAddress"
                      value={formData.billingAddress}
                      onChange={handleChange}
                      placeholder="Enter your billing address"
                      rows={3}
                      className={`w-full px-4 py-2 rounded-lg border-2 transition-colors resize-none ${
                        errors.billingAddress
                          ? "border-destructive bg-destructive/5"
                          : "border-input bg-white focus:border-primary"
                      } text-foreground placeholder-muted-foreground focus:outline-none`}
                    />
                    {errors.billingAddress && (
                      <p className="text-destructive text-xs mt-1">
                        {errors.billingAddress}
                      </p>
                    )}
                  </div>

                  {/* VAT Reference */}
                  <FormField
                    label="VAT Invoice Reference"
                    name="vat_reference"
                    placeholder="Optional: Enter your company VAT number"
                    required={false}
                  />

                  {/* Security Notice */}
                  <div className="bg-secondary/10 border border-secondary rounded-lg p-4 space-y-2">
                    <div className="flex gap-2">
                      <svg
                        className="w-5 h-5 text-secondary flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                      </svg>
                      <div className="text-sm text-secondary">
                        <p className="font-semibold">Secure Payment</p>
                        <p className="text-xs mt-1">
                          Your card details are encrypted and never stored on our servers
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full btn-primary py-3 rounded-lg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isProcessing
                      ? "Processing Payment..."
                      : `Pay ${formatPrice(total)}`}
                  </button>

                  {/* Back Link */}
                  <button
                    type="button"
                    onClick={() => navigate("/checkout")}
                    className="w-full btn-outline py-2 rounded-lg text-sm font-semibold"
                  >
                    Back to Checkout
                  </button>
                </form>
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
                        {item.name} x {item.quantity}
                      </span>
                      <span className="font-semibold">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-secondary/10 -mx-6 px-6 py-2">
                    <span className="text-muted-foreground">VAT (5%)</span>
                    <span className="font-semibold text-secondary">
                      {formatPrice(vat)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-lg font-bold text-foreground">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
