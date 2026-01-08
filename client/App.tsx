import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { BasketProvider } from "@/context/BasketContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { useCapacitorInit } from "@/hooks/useCapacitor";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Visitor from "./pages/Visitor";
import Products from "./pages/Products";
import Basket from "./pages/Basket";
import Checkout from "./pages/Checkout";
import PaymentCard from "./pages/PaymentCard";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Initialize Capacitor for native mobile features
  useCapacitorInit();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <ProductsProvider>
              <BasketProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <Routes>
                      {/* Auth Routes */}
                      <Route path="/" element={<Login />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />

                      {/* Visitor & Shopping Routes */}
                      <Route path="/visitor" element={<Visitor />} />
                      <Route path="/products" element={<Products />} />

                      {/* Checkout Flow */}
                      <Route path="/basket" element={<Basket />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/payment/card" element={<PaymentCard />} />

                      {/* Admin Routes */}
                      <Route path="/admin/login" element={<AdminLogin />} />
                      <Route path="/admin/dashboard" element={<AdminDashboard />} />

                      {/* Catch All */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
              </BasketProvider>
            </ProductsProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
