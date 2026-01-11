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
import { ChatProvider } from "@/context/ChatContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { ReviewsProvider } from "@/context/ReviewsContext";
import { LoyaltyProvider } from "@/context/LoyaltyContext";
import { OrdersProvider } from "@/context/OrdersContext";
import { WalletProvider } from "@/context/WalletContext";
import { useCapacitorInit } from "@/hooks/useCapacitor";
import { Layout } from "@/components/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Visitor from "./pages/Visitor";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Basket from "./pages/Basket";
import Checkout from "./pages/Checkout";
import PaymentCard from "./pages/PaymentCard";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Wishlist from "./pages/Wishlist";
import Wallet from "./pages/Wallet";
import Home from "./pages/Home";
import Deals from "./pages/Deals";
import TrackOrder from "./pages/TrackOrder";
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
            <ChatProvider>
              <ProductsProvider>
                <WishlistProvider>
                  <ReviewsProvider>
                    <LoyaltyProvider>
                      <OrdersProvider>
                        <WalletProvider>
                          <BasketProvider>
                            <TooltipProvider>
                              <Toaster />
                              <Sonner />
                              <BrowserRouter>
                                <Routes>
                                  {/* Auth Routes - No header/footer */}
                                  <Route path="/" element={<Login />} />
                                  <Route path="/login" element={<Login />} />
                                  <Route path="/register" element={<Register />} />
                                  <Route path="/forgot-password" element={<ForgotPassword />} />
                                  <Route path="/reset-password" element={<ResetPassword />} />

                                  {/* Homepage & Visitor Routes - With header/footer */}
                                  <Route path="/home" element={<Layout><Home /></Layout>} />
                                  <Route path="/visitor" element={<Layout><Visitor /></Layout>} />
                                  
                                  {/* Shopping Routes - With header/footer */}
                                  <Route path="/products" element={<Layout><Products /></Layout>} />
                                  <Route path="/products/:id" element={<Layout><ProductDetail /></Layout>} />
                                  <Route path="/deals" element={<Layout><Deals /></Layout>} />

                                  {/* Checkout Flow - With header/footer */}
                                  <Route path="/basket" element={<Layout><Basket /></Layout>} />
                                  <Route path="/checkout" element={<Layout><Checkout /></Layout>} />
                                  <Route path="/payment/card" element={<Layout><PaymentCard /></Layout>} />

                                  {/* User Account Routes - With header/footer */}
                                  <Route path="/orders" element={<Layout><Orders /></Layout>} />
                                  <Route path="/track/:orderNumber" element={<Layout><TrackOrder /></Layout>} />
                                  <Route path="/profile" element={<Layout><Profile /></Layout>} />
                                  <Route path="/wishlist" element={<Layout><Wishlist /></Layout>} />
                                  <Route path="/wallet" element={<Layout><Wallet /></Layout>} />

                                  {/* Admin Routes - No header/footer for login, custom layout for dashboard */}
                                  <Route path="/admin/login" element={<AdminLogin />} />
                                  <Route path="/admin/dashboard" element={<AdminDashboard />} />

                                  {/* Catch All - With header/footer */}
                                  <Route path="*" element={<Layout><NotFound /></Layout>} />
                                </Routes>
                              </BrowserRouter>
                            </TooltipProvider>
                          </BasketProvider>
                        </WalletProvider>
                      </OrdersProvider>
                    </LoyaltyProvider>
                  </ReviewsProvider>
                </WishlistProvider>
              </ProductsProvider>
            </ChatProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
