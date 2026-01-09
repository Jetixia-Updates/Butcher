import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Package, Truck, CreditCard, CheckCircle, X, Trash2, FileText, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBasket } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications, formatRelativeTime, Notification } from "@/context/NotificationContext";
import { useUserChat } from "@/context/ChatContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  showBasketIcon?: boolean;
}

// User notification types with icons
const getNotificationIcon = (type: string, title?: string) => {
  // Check if it's an invoice notification
  if (title && (title.includes("TAX Invoice") || title.includes("فاتورة ضريبية"))) {
    return <FileText className="w-4 h-4 text-emerald-500" />;
  }
  
  switch (type) {
    case "order":
      return <Package className="w-4 h-4 text-blue-500" />;
    case "delivery":
      return <Truck className="w-4 h-4 text-green-500" />;
    case "payment":
      return <CreditCard className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

export const Header: React.FC<HeaderProps> = ({ showBasketIcon = true }) => {
  const navigate = useNavigate();
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { itemCount } = useBasket();
  const { t, language } = useLanguage();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useNotifications();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Notification | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const notificationRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Use chat context for user messages
  const { messages: chatMessages, unreadCount: chatUnreadCount, sendMessage: sendChatMessage, markAsRead: markChatAsRead } = useUserChat(user?.id);

  // Filter notifications for user (exclude admin-only types like stock)
  const userNotifications = notifications.filter(n => 
    ["order", "delivery", "payment", "system"].includes(n.type)
  ).slice(0, 10);

  const userUnreadCount = userNotifications.filter(n => n.unread).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setShowChat(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (showChat && chatUnreadCount > 0) {
      markChatAsRead();
    }
  }, [showChat, chatUnreadCount, markChatAsRead]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, showChat]);

  // Send chat message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !user?.id) return;

    const userName = `${user.firstName || ""} ${user.familyName || ""}`.trim() || "Customer";
    const userEmail = user.email || "";
    
    sendChatMessage(userName, userEmail, newMessage.trim());
    setNewMessage("");
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Check if this is a TAX invoice notification (title contains "TAX Invoice" or "فاتورة ضريبية")
    if (notification.title.includes("TAX Invoice") || notification.title.includes("فاتورة ضريبية")) {
      setSelectedInvoice(notification);
      setShowNotifications(false);
      return;
    }
    
    if (notification.link) {
      navigate(notification.link);
    }
    setShowNotifications(false);
  };

  // Check if a notification is an invoice
  const isInvoiceNotification = (notification: Notification) => {
    return notification.title.includes("TAX Invoice") || notification.title.includes("فاتورة ضريبية");
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-3 sm:py-4">
          {/* Left: Language Switcher */}
          <div className="flex-1 flex items-center">
            <LanguageSwitcher variant="compact" />
          </div>

          {/* Center: Logo */}
          <Link
            to="/"
            className="flex-shrink-0 text-center"
          >
            <div className="inline-block">
              <h1 className="text-lg sm:text-2xl font-bold text-primary">
                🥩 {t("header.title")}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium hidden xs:block">
                {t("header.subtitle")}
              </p>
            </div>
          </Link>

          {/* Right: Auth & Basket */}
          <div className="flex-1 flex justify-end items-center gap-2 sm:gap-4">
            {/* Chat Icon - Only for logged in users */}
            {isLoggedIn && (
              <div className="relative" ref={chatRef}>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Chat with Admin"
                >
                  <MessageCircle className="w-5 h-5 text-primary" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                    </span>
                  )}
                </button>

                {/* Chat Dropdown */}
                {showChat && (
                  <div className={`fixed sm:absolute inset-x-2 sm:inset-x-auto top-14 sm:top-auto sm:mt-2 ${language === "ar" ? "sm:left-0 sm:right-auto" : "sm:right-0 sm:left-auto"} w-auto sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden`}>
                    {/* Chat Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        <div>
                          <h3 className="font-semibold text-sm">
                            {language === "ar" ? "الدعم الفني" : "Customer Support"}
                          </h3>
                          <p className="text-xs opacity-80">
                            {language === "ar" ? "نحن هنا للمساعدة" : "We're here to help"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowChat(false)}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div 
                      ref={chatMessagesRef}
                      className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50"
                    >
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                          <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                          <p className="text-sm text-center">
                            {language === "ar" 
                              ? "ابدأ محادثة مع فريق الدعم"
                              : "Start a conversation with our support team"}
                          </p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                msg.sender === "user"
                                  ? "bg-primary text-white rounded-br-md"
                                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
                              }`}
                            >
                              <p className="text-sm">{msg.text}</p>
                              <p className={`text-xs mt-1 ${
                                msg.sender === "user" ? "text-white/70" : "text-gray-400"
                              }`}>
                                {new Date(msg.timestamp).toLocaleTimeString(language === "ar" ? "ar-AE" : "en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="p-3 border-t bg-white">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                          placeholder={language === "ar" ? "اكتب رسالتك..." : "Type your message..."}
                          className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim()}
                          className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notification Bell - Only for logged in users */}
            {isLoggedIn && (
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-primary" />
                  {userUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {userUnreadCount > 9 ? "9+" : userUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className={`fixed sm:absolute inset-x-2 sm:inset-x-auto top-14 sm:top-auto sm:mt-2 ${language === "ar" ? "sm:left-0 sm:right-auto" : "sm:right-0 sm:left-auto"} w-auto sm:w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                        {language === "ar" ? "الإشعارات" : "Notifications"}
                      </h3>
                      <div className="flex items-center gap-2">
                        {userUnreadCount > 0 && (
                          <button
                            onClick={() => markAllAsRead()}
                            className="text-xs text-primary hover:underline whitespace-nowrap"
                          >
                            {language === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto">
                      {userNotifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>{language === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
                        </div>
                      ) : (
                        userNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                              notification.unread ? "bg-blue-50/50" : ""
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notification.type, notification.title)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm ${notification.unread ? "font-semibold" : "font-medium"} text-gray-900`}>
                                  {language === "ar" ? notification.titleAr : notification.title}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                  className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
                                >
                                  <X className="w-3 h-3 text-gray-400" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                {isInvoiceNotification(notification) 
                                  ? (language === "ar" ? "اضغط لعرض الفاتورة الكاملة" : "Click to view full invoice")
                                  : (language === "ar" ? notification.messageAr : notification.message)
                                }
                              </p>
                              {isInvoiceNotification(notification) && (
                                <span className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600 font-medium">
                                  <FileText className="w-3 h-3" />
                                  {language === "ar" ? "عرض الفاتورة" : "View Invoice"}
                                </span>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {formatRelativeTime(notification.createdAt, language)}
                              </p>
                            </div>
                            {notification.unread && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    {userNotifications.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-t">
                        <button
                          onClick={() => {
                            clearAllNotifications();
                            setShowNotifications(false);
                          }}
                          className="w-full text-center text-xs text-red-500 hover:text-red-600 py-1 flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          {language === "ar" ? "مسح جميع الإشعارات" : "Clear all notifications"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {showBasketIcon && isLoggedIn && (
              <Link to="/basket" className="relative group">
                <svg
                  className="w-6 h-6 text-primary group-hover:text-primary/80 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10-8l2 8m-6 8a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z"
                  />
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
            )}

            {isLoggedIn ? (
              <div className="flex items-center gap-1 sm:gap-4">
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  {user?.firstName}
                </span>
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    className="p-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-md hover:bg-gray-100 sm:hover:bg-transparent sm:btn-outline text-sm flex items-center gap-1"
                    title={t("header.adminPanel")}
                  >
                    <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="hidden sm:inline">{t("header.adminPanel")}</span>
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    window.location.href = "/";
                  }}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-md hover:bg-gray-100 sm:hover:bg-transparent sm:btn-outline text-sm flex items-center"
                  title={t("login.logout")}
                >
                  <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">{t("login.logout")}</span>
                </button>
              </div>
            ) : (
              <Link to="/" className="btn-primary text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-1.5">
                {t("login.loginLink")}
              </Link>
            )}
          </div>
        </div>
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
    </header>
  );
};
