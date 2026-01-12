import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// Import admin tab components
import { AdminLayout, AdminTab } from "@/components/admin/AdminLayout";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { ProductsTab } from "@/components/admin/ProductsTab";
import { StockTab } from "@/components/admin/StockTab";
import { SuppliersTab } from "@/components/admin/SuppliersTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { CustomersTab } from "@/components/admin/CustomersTab";
import { DeliveryTab } from "@/components/admin/DeliveryTab";
import { FinanceTab } from "@/components/admin/FinanceTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { PromoCodesTab } from "@/components/admin/PromoCodesTab";
import { BannersTab } from "@/components/admin/BannersTab";
import { SettingsTab } from "@/components/admin/SettingsTab";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Redirect if not admin
  React.useEffect(() => {
    if (!isAdmin) {
      navigate("/admin/login");
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  const handleTabNavigate = (tab: string, id?: string) => {
    setActiveTab(tab as AdminTab);
    if (tab === "orders" && id) {
      setSelectedOrderId(id);
    } else {
      setSelectedOrderId(null);
    }
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSelectedOrderId(null); // Clear selection when manually changing tabs
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab onNavigate={handleTabNavigate} />;
      case "orders":
        return <OrdersTab onNavigate={handleTabNavigate} selectedOrderId={selectedOrderId} onClearSelection={() => setSelectedOrderId(null)} />;
      case "products":
        return <ProductsTab onNavigate={handleTabNavigate} />;
      case "stock":
        return <StockTab onNavigate={handleTabNavigate} />;
      case "suppliers":
        return <SuppliersTab onNavigate={handleTabNavigate} />;
      case "users":
        return <UsersTab onNavigate={handleTabNavigate} />;
      case "customers":
        return <CustomersTab onNavigate={handleTabNavigate} />;
      case "delivery":
        return <DeliveryTab onNavigate={handleTabNavigate} />;
      case "finance":
        return <FinanceTab onNavigate={handleTabNavigate} />;
      case "payments":
        return <PaymentsTab onNavigate={handleTabNavigate} />;
      case "reports":
        return <ReportsTab onNavigate={handleTabNavigate} />;
      case "promoCodes":
        return <PromoCodesTab onNavigate={handleTabNavigate} />;
      case "banners":
        return <BannersTab onNavigate={handleTabNavigate} />;
      case "settings":
        return <SettingsTab onNavigate={handleTabNavigate} />;
      default:
        return <DashboardTab onNavigate={handleTabNavigate} />;
    }
  };

  return (
    <AdminLayout 
      activeTab={activeTab} 
      onTabChange={handleTabChange}
      onNavigateWithId={handleTabNavigate}
    >
      {renderTabContent()}
    </AdminLayout>
  );
}
