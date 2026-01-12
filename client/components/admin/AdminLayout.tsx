/**
 * Admin Layout Component
 * Sidebar navigation with tabs for all admin features
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications, formatRelativeTime, createOrderNotification, createStockNotification, Notification } from "@/context/NotificationContext";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  CreditCard,
  BarChart3,
  Banknote,
  Settings,
  LogOut,
  Bell,
  Store,
  Menu,
  X,
  Check,
  CheckCheck,
  Trash2,
  Factory,
  MessageCircle,
  Send,
  ChevronLeft,
  FileText,
  Paperclip,
  Download,
  Image,
  File,
  Beef,
  Tag,
  ImageIcon,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminChat, ChatAttachment } from "@/context/ChatContext";

export type AdminTab =
  | "dashboard"
  | "orders"
  | "products"
  | "stock"
  | "suppliers"
  | "users"
  | "customers"
  | "delivery"
  | "finance"
  | "payments"
  | "reports"
  | "promoCodes"
  | "banners"
  | "settings";

interface AdminLayoutProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onNavigateWithId?: (tab: string, id?: string) => void;
  children: React.ReactNode;
  notifications?: number;
}

const tabConfig: { id: AdminTab; labelKey: string; icon: React.ElementType }[] = [
  { id: "dashboard", labelKey: "admin.dashboard", icon: LayoutDashboard },
  { id: "orders", labelKey: "admin.orders", icon: ShoppingCart },
  { id: "products", labelKey: "admin.products", icon: Beef },
  { id: "stock", labelKey: "admin.inventory", icon: Package },
  { id: "suppliers", labelKey: "admin.suppliers", icon: Factory },
  { id: "users", labelKey: "admin.users", icon: Users },
  { id: "customers", labelKey: "admin.customers", icon: Wallet },
  { id: "delivery", labelKey: "admin.delivery", icon: Truck },
  { id: "finance", labelKey: "admin.finance", icon: Banknote },
  { id: "payments", labelKey: "admin.payments", icon: CreditCard },
  { id: "reports", labelKey: "admin.reports", icon: BarChart3 },
  { id: "promoCodes", labelKey: "admin.promoCodes", icon: Tag },
  { id: "banners", labelKey: "admin.banners", icon: ImageIcon },
  { id: "settings", labelKey: "admin.settings", icon: Settings },
];

export function AdminLayout({
  activeTab,
  onTabChange,
  onNavigateWithId,
  children,
  notifications: orderNotifications = 0,
}: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAllNotifications,
    addNotification 
  } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminAttachments, setAdminAttachments] = useState<ChatAttachment[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Notification | null>(null);
  const chatMessagesRef = React.useRef<HTMLDivElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  // Use admin chat hook
  const { chats, sendMessage: sendAdminMessage, markAsRead: markChatAsRead, totalUnread: chatTotalUnread } = useAdminChat();
  
  // Get selected chat
  const selectedChat = chats.find(c => c.userId === selectedChatUserId);

  // Scroll to bottom when messages change or chat is opened
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [selectedChat?.messages, chatOpen]);

  // Mark messages as read when a chat is selected
  useEffect(() => {
    if (selectedChatUserId && selectedChat && selectedChat.unreadCount > 0) {
      markChatAsRead(selectedChatUserId);
    }
  }, [selectedChatUserId, selectedChat, markChatAsRead]);

  // Handle file selection for admin chat
  const handleAdminFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: ChatAttachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      newAttachments.push({
        id: `att_${Date.now()}_${i}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: dataUrl,
      });
    }
    
    setAdminAttachments(prev => [...prev, ...newAttachments]);
    if (adminFileInputRef.current) {
      adminFileInputRef.current.value = "";
    }
  };

  // Remove admin attachment
  const removeAdminAttachment = (id: string) => {
    setAdminAttachments(prev => prev.filter(att => att.id !== id));
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  // Handle sending admin message
  const handleSendAdminMessage = () => {
    if ((!adminMessage.trim() && adminAttachments.length === 0) || !selectedChatUserId) return;
    sendAdminMessage(selectedChatUserId, adminMessage.trim(), adminAttachments.length > 0 ? adminAttachments : undefined);
    setAdminMessage("");
    setAdminAttachments([]);
  };

  // Seed some initial demo notifications if none exist
  useEffect(() => {
    if (notifications.length === 0) {
      // Add demo notifications
      addNotification(createOrderNotification("ORD-2026-0015", "new"));
      setTimeout(() => {
        addNotification(createStockNotification("Premium Beef Steak", 2.5));
      }, 100);
      setTimeout(() => {
        addNotification(createOrderNotification("ORD-2026-0012", "delivered"));
      }, 200);
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  // Check if a notification is an invoice
  const isInvoiceNotification = (notification: Notification) => {
    return notification.title.includes("TAX Invoice") || notification.title.includes("فاتورة ضريبية");
  };

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markAsRead(notif.id);
    
    // Check if this is a TAX invoice notification
    if (isInvoiceNotification(notif)) {
      setSelectedInvoice(notif);
      setNotificationOpen(false);
      return;
    }
    
    if (notif.linkTab) {
      // Use onNavigateWithId if available and there's a linkId, otherwise use onTabChange
      if (onNavigateWithId && notif.linkId) {
        onNavigateWithId(notif.linkTab, notif.linkId);
      } else {
        onTabChange(notif.linkTab as AdminTab);
      }
    }
    setNotificationOpen(false);
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingCart className="w-4 h-4 text-blue-500" />;
      case "stock":
        return <Package className="w-4 h-4 text-orange-500" />;
      case "delivery":
        return <Truck className="w-4 h-4 text-green-500" />;
      case "payment":
        return <CreditCard className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:transform-none flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{t("admin.title")}</h1>
              <p className="text-xs text-slate-400">{t("admin.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                {t(tab.labelKey)}
                {tab.id === "orders" && orderNotifications > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {orderNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-700 flex-shrink-0 mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">
                {user?.firstName?.[0] || "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.firstName} {user?.familyName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/products")}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              <Store className="w-4 h-4" />
              {t("admin.viewStore")}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top header */}
        <header className="h-14 sm:h-16 bg-white shadow-sm flex items-center justify-between px-2 sm:px-4 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg flex-shrink-0"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h2 className="text-sm sm:text-xl font-bold text-slate-900 truncate">
              {activeTab === "dashboard" ? t("admin.dashboardOverview") : t(`admin.${activeTab}`)}
            </h2>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {/* Language Switcher */}
            <div className="flex gap-0.5 items-center bg-slate-100 border border-slate-200 rounded-md p-0.5 sm:p-1">
              <button
                onClick={() => setLanguage("en")}
                className={cn(
                  "px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium rounded transition-colors",
                  language === "en"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-200"
                )}
              >
                E
              </button>
              <button
                onClick={() => setLanguage("ar")}
                className={cn(
                  "px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium rounded transition-colors",
                  language === "ar"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-200"
                )}
              >
                ع
              </button>
            </div>

            {/* Admin Chat */}
            <div className="relative">
              <button 
                onClick={() => {
                  setChatOpen(!chatOpen);
                  setNotificationOpen(false);
                }}
                className="relative p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                {chatTotalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-green-500 text-white text-xs font-bold rounded-full px-1">
                    {chatTotalUnread > 99 ? '99+' : chatTotalUnread}
                  </span>
                )}
              </button>

              {/* Chat Panel */}
              {chatOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => {
                      setChatOpen(false);
                      setSelectedChatUserId(null);
                    }} 
                  />
                  <div className={`absolute ${language === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-80 sm:w-[450px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden`}>
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                      {selectedChatUserId && (
                        <button
                          onClick={() => setSelectedChatUserId(null)}
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                        >
                          <ChevronLeft className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                        {selectedChat ? selectedChat.userName : (language === 'ar' ? 'محادثات العملاء' : 'Customer Chats')}
                      </h3>
                      {chatTotalUnread > 0 && !selectedChatUserId && (
                        <span className={`${language === 'ar' ? 'mr-auto' : 'ml-auto'} text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full`}>
                          {chatTotalUnread} {language === 'ar' ? 'جديد' : 'new'}
                        </span>
                      )}
                    </div>

                    {!selectedChatUserId ? (
                      /* User list */
                      <div className="max-h-96 overflow-y-auto">
                        {chats.length > 0 ? (
                          chats
                            .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
                            .map((chat) => (
                            <button
                              key={chat.userId}
                              onClick={() => setSelectedChatUserId(chat.userId)}
                              className={cn(
                                "w-full p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left",
                                chat.unreadCount > 0 && "bg-green-50/50"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="font-medium text-slate-700">
                                    {chat.userName[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium text-slate-900 truncate">{chat.userName}</p>
                                    {chat.unreadCount > 0 && (
                                      <span className="flex-shrink-0 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {chat.unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-500 truncate">
                                    {chat.messages[chat.messages.length - 1]?.text || ''}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {new Date(chat.lastMessageAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-8 text-center text-slate-500">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p>{language === 'ar' ? 'لا توجد محادثات بعد' : 'No chats yet'}</p>
                            <p className="text-sm mt-1">{language === 'ar' ? 'ستظهر رسائل العملاء هنا' : 'Customer messages will appear here'}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Chat conversation */
                      <div className="flex flex-col h-96">
                        {/* Messages */}
                        <div 
                          ref={chatMessagesRef}
                          className="flex-1 overflow-y-auto p-4 space-y-3"
                        >
                          {selectedChat?.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={cn(
                                "max-w-[80%] rounded-lg p-3",
                                msg.sender === 'admin'
                                  ? "bg-primary text-white ml-auto rounded-br-none"
                                  : "bg-slate-100 text-slate-900 rounded-bl-none"
                              )}
                            >
                              {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                              {/* Attachments */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className={`${msg.text ? "mt-2" : ""} space-y-2`}>
                                  {msg.attachments.map((att) => (
                                    <div key={att.id}>
                                      {att.type.startsWith("image/") ? (
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                          <img 
                                            src={att.url} 
                                            alt={att.name} 
                                            className="max-w-full rounded-lg max-h-40 object-cover"
                                          />
                                        </a>
                                      ) : (
                                        <a 
                                          href={att.url} 
                                          download={att.name}
                                          className={cn(
                                            "flex items-center gap-2 p-2 rounded-lg transition-colors",
                                            msg.sender === 'admin' 
                                              ? "bg-white/20 hover:bg-white/30" 
                                              : "bg-slate-200 hover:bg-slate-300"
                                          )}
                                        >
                                          {getFileIcon(att.type)}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{att.name}</p>
                                            <p className={cn(
                                              "text-xs",
                                              msg.sender === 'admin' ? "opacity-70" : "text-slate-500"
                                            )}>
                                              {formatFileSize(att.size)}
                                            </p>
                                          </div>
                                          <Download className="w-4 h-4 flex-shrink-0" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className={cn(
                                "text-xs mt-1",
                                msg.sender === 'admin' ? "text-white/70" : "text-slate-400"
                              )}>
                                {new Date(msg.timestamp).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                        
                        {/* Attachment Preview */}
                        {adminAttachments.length > 0 && (
                          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
                            {adminAttachments.map((att) => (
                              <div key={att.id} className="relative group">
                                {att.type.startsWith("image/") ? (
                                  <img src={att.url} alt={att.name} className="w-12 h-12 rounded object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded bg-slate-200 flex items-center justify-center">
                                    {getFileIcon(att.type)}
                                  </div>
                                )}
                                <button
                                  onClick={() => removeAdminAttachment(att.id)}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Input */}
                        <div className="p-3 border-t border-slate-100 bg-slate-50">
                          <div className="flex gap-2">
                            <input
                              type="file"
                              ref={adminFileInputRef}
                              onChange={handleAdminFileSelect}
                              multiple
                              className="hidden"
                              accept="*/*"
                            />
                            <button
                              onClick={() => adminFileInputRef.current?.click()}
                              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 rounded-lg transition-colors"
                              title={language === 'ar' ? 'إرفاق ملف' : 'Attach file'}
                            >
                              <Paperclip className="w-5 h-5" />
                            </button>
                            <input
                              type="text"
                              value={adminMessage}
                              onChange={(e) => setAdminMessage(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleSendAdminMessage()}
                              placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <button
                              onClick={handleSendAdminMessage}
                              disabled={!adminMessage.trim() && adminAttachments.length === 0}
                              className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => {
                  setNotificationOpen(!notificationOpen);
                  setChatOpen(false);
                }}
                className="relative p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notificationOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setNotificationOpen(false)} 
                  />
                  <div className={`absolute ${language === 'ar' ? 'left-0' : 'right-0'} top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden`}>
                    <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm sm:text-base">{t("admin.notifications")}</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsRead()}
                          className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 whitespace-nowrap"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            className={cn(
                              "p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group",
                              notif.unread && "bg-blue-50/50"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className="mt-0.5 flex-shrink-0">
                                {getNotificationIcon(notif.type)}
                              </div>
                              {/* Content */}
                              <div 
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => handleNotificationClick(notif)}
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {language === 'ar' ? notif.titleAr : notif.title}
                                </p>
                                <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                                  {isInvoiceNotification(notif)
                                    ? (language === 'ar' ? 'اضغط لعرض الفاتورة الكاملة' : 'Click to view full invoice')
                                    : (language === 'ar' ? notif.messageAr : notif.message)
                                  }
                                </p>
                                {isInvoiceNotification(notif) && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600 font-medium">
                                    <FileText className="w-3 h-3" />
                                    {language === 'ar' ? 'عرض الفاتورة' : 'View Invoice'}
                                  </span>
                                )}
                                <p className="text-xs text-slate-400 mt-1">
                                  {formatRelativeTime(notif.createdAt, language)}
                                </p>
                              </div>
                              {/* Actions */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {notif.unread && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                    className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 hover:text-green-600"
                                    title={language === 'ar' ? 'تحديد كمقروء' : 'Mark as read'}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                                  className="p-1.5 hover:bg-slate-200 rounded-md text-slate-500 hover:text-red-600"
                                  title={language === 'ar' ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              {/* Unread indicator */}
                              {notif.unread && (
                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">{t("admin.noNotifications")}</p>
                        </div>
                      )}
                    </div>
                    {/* Footer with clear all */}
                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <button
                          onClick={() => clearAllNotifications()}
                          className="w-full text-center text-sm text-slate-500 hover:text-red-600 font-medium py-1"
                        >
                          {language === 'ar' ? 'مسح جميع الإشعارات' : 'Clear all notifications'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20">{children}</main>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-white">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <div>
                  <h2 className="font-bold text-lg">
                    {language === "ar" ? "فاتورة ضريبية" : "TAX Invoice"}
                  </h2>
                  <p className="text-sm opacity-90">
                    {formatRelativeTime(selectedInvoice.createdAt, language)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Invoice Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 leading-relaxed">
                {language === "ar" ? selectedInvoice.messageAr : selectedInvoice.message}
              </pre>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex gap-3">
              <button
                onClick={() => {
                  // Copy invoice to clipboard
                  const invoiceText = language === "ar" ? selectedInvoice.messageAr : selectedInvoice.message;
                  navigator.clipboard.writeText(invoiceText);
                  alert(language === "ar" ? "تم نسخ الفاتورة!" : "Invoice copied to clipboard!");
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {language === "ar" ? "نسخ الفاتورة" : "Copy Invoice"}
              </button>
              <button
                onClick={() => {
                  // Print invoice
                  const invoiceText = language === "ar" ? selectedInvoice.messageAr : selectedInvoice.message;
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>${language === "ar" ? "فاتورة ضريبية" : "TAX Invoice"}</title>
                          <style>
                            body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
                            @media print { body { padding: 0; } }
                          </style>
                        </head>
                        <body>${invoiceText}</body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {language === "ar" ? "طباعة" : "Print"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
