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
import { DeliveryTab } from "@/components/admin/DeliveryTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { ReportsTab } from "@/components/admin/ReportsTab";

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
      case "delivery":
        return <DeliveryTab onNavigate={handleTabNavigate} />;
      case "payments":
        return <PaymentsTab onNavigate={handleTabNavigate} />;
      case "reports":
        return <ReportsTab onNavigate={handleTabNavigate} />;
      case "settings":
        return <SettingsTab />;
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

// Settings Tab Component
function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Settings</h3>
        <p className="text-sm text-slate-500">
          Configure your butcher shop application
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h4 className="font-semibold text-slate-900 mb-4 text-sm sm:text-base">Store Information</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Store Name
              </label>
              <input
                type="text"
                defaultValue="Premium Butcher Shop"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                defaultValue="contact@butcher.ae"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                defaultValue="+971 4 123 4567"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h4 className="font-semibold text-slate-900 mb-4 text-sm sm:text-base">Order Settings</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Order Value (AED)
              </label>
              <input
                type="number"
                defaultValue="50"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Default Delivery Fee (AED)
              </label>
              <input
                type="number"
                defaultValue="15"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableCOD"
                defaultChecked
                className="w-5 h-5 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <label htmlFor="enableCOD" className="text-sm font-medium text-slate-700">
                Enable Cash on Delivery
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h4 className="font-semibold text-slate-900 mb-4 text-sm sm:text-base">Notification Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Email Notifications</p>
                <p className="text-sm text-slate-500">Send emails for order updates</p>
              </div>
              <button className="relative w-12 h-6 bg-primary rounded-full">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">SMS Notifications</p>
                <p className="text-sm text-slate-500">Send SMS for order updates</p>
              </div>
              <button className="relative w-12 h-6 bg-primary rounded-full">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Low Stock Alerts</p>
                <p className="text-sm text-slate-500">Get notified for low inventory</p>
              </div>
              <button className="relative w-12 h-6 bg-primary rounded-full">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h4 className="font-semibold text-slate-900 mb-4 text-sm sm:text-base">VAT Settings</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                VAT Rate (%)
              </label>
              <input
                type="number"
                defaultValue="5"
                step="0.1"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                TRN (Tax Registration Number)
              </label>
              <input
                type="text"
                defaultValue="100123456700003"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showVAT"
                defaultChecked
                className="w-5 h-5 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <label htmlFor="showVAT" className="text-sm font-medium text-slate-700">
                Show VAT breakdown on invoices
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button className="px-6 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50">
          Reset to Defaults
        </button>
        <button className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">
          Save Changes
        </button>
      </div>
    </div>
  );
}
