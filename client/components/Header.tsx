import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Package, Truck, CreditCard, CheckCircle, X, Trash2, FileText, MessageCircle, Send, Paperclip, Download, Image, File, Heart, User, ShoppingBag, ChevronDown, Sun, Moon, Home, Percent, Wallet } from "lucide-react";
import { useDraggable } from "@/hooks/useDraggable";
import { useAuth } from "@/context/AuthContext";
import { useBasket } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications, formatRelativeTime, Notification } from "@/context/NotificationContext";
import { useUserChat, ChatAttachment } from "@/context/ChatContext";
import { useWishlist } from "@/context/WishlistContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// Dark mode hook
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkMode");
      if (saved !== null) return JSON.parse(saved);
      // Default to light mode (day mode) unless explicitly selected
      return false;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // Update Capacitor status bar if on native app
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(console.error);
      if (Capacitor.getPlatform() === 'android') {
        StatusBar.setBackgroundColor({ color: isDark ? '#111827' : '#ffffff' }).catch(console.error);
      }
    }

    localStorage.setItem("darkMode", JSON.stringify(isDark));
  }, [isDark]);

  const toggleDarkMode = () => setIsDark(!isDark);

  return { isDark, toggleDarkMode };
};

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
  const { items: wishlistItems } = useWishlist();
  const { isDark, toggleDarkMode } = useDarkMode();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Notification | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use chat context for user messages
  const { messages: chatMessages, unreadCount: chatUnreadCount, sendMessage: sendChatMessage, markAsRead: markChatAsRead } = useUserChat(user?.id);

  // Filter notifications for user (exclude admin-only types like stock)
  // Types can be: order, order_placed, order_confirmed, order_delivered, delivery, delivery_in_transit, driver_assigned, payment, system
  const userNotifications = notifications.filter(n => 
    n.type && (
      n.type.startsWith("order") || 
      n.type.startsWith("delivery") || 
      n.type.startsWith("driver") || 
      n.type.startsWith("payment") || 
      n.type === "system"
    )
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
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
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

  // Scroll to bottom when new messages arrive or chat opens
  useEffect(() => {
    if (chatMessagesRef.current && showChat) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (chatMessagesRef.current) {
          chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [chatMessages, showChat]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: ChatAttachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Convert file to base64 data URL
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
    
    setChatAttachments(prev => [...prev, ...newAttachments]);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setChatAttachments(prev => prev.filter(att => att.id !== id));
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type?.startsWith("image/")) return <Image className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  // Send chat message
  const handleSendMessage = () => {
    if ((!newMessage.trim() && chatAttachments.length === 0) || !user?.id) return;

    const userName = `${user.firstName || ""} ${user.familyName || ""}`.trim() || "Customer";
    const userEmail = user.email || "";
    
    sendChatMessage(userName, userEmail, newMessage.trim(), chatAttachments.length > 0 ? chatAttachments : undefined);
    setNewMessage("");
    setChatAttachments([]);
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Check if this is a TAX invoice notification (title contains "TAX Invoice" or "فاتورة ضريبية")
    if (notification.title?.includes("TAX Invoice") || notification.title?.includes("فاتورة ضريبية")) {
      setSelectedInvoice(notification);
      setShowNotifications(false);
      return;
    }
    
    if (notification.link) {
      // Sanitize old/invalid links - redirect to base page instead of non-existent detail pages
      let targetLink = notification.link;
      
      // Fix: /orders/order_xxx -> /orders (order detail page doesn't exist)
      if (targetLink.startsWith("/orders/")) {
        targetLink = "/orders";
      }
      // Fix: /admin/orders/xxx -> /admin/dashboard (admin order detail page doesn't exist)
      if (targetLink.startsWith("/admin/orders/")) {
        targetLink = "/admin/dashboard";
      }
      // Fix: /admin -> /admin/dashboard
      if (targetLink === "/admin") {
        targetLink = "/admin/dashboard";
      }
      
      navigate(targetLink);
    }
    setShowNotifications(false);
  };

  // Check if a notification is an invoice
  const isInvoiceNotification = (notification: Notification) => {
    return notification.title?.includes("TAX Invoice") || notification.title?.includes("فاتورة ضريبية");
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-2 sm:py-4">
          {/* Left: Language Switcher & Dark Mode */}
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher variant="compact" />
            <button
              onClick={toggleDarkMode}
              className="flex p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>

          {/* Center: Logo */}
          <Link
            to="/home"
            className="flex-shrink-0 text-center mx-1 sm:mx-4"
          >
            <div className="inline-block">
              <h1 className="text-base sm:text-2xl font-bold text-primary whitespace-nowrap">
                🥩 {t("header.title")}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium hidden sm:block">
                {t("header.subtitle")}
              </p>
            </div>
          </Link>

          {/* Right: Auth & Basket */}
          <div className="flex items-center gap-1 sm:gap-4">
            {/* Chat Icon - Only for logged in users */}
            {isLoggedIn && (
              <div className="relative" ref={chatRef}>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="relative p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Chat with Admin"
                >
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                    </span>
                  )}
                </button>

                {/* Chat Dropdown */}
                {showChat && (
                  <div className={`fixed sm:absolute inset-x-2 sm:inset-x-auto top-14 sm:top-auto sm:mt-2 ${language === "ar" ? "sm:left-0 sm:right-auto" : "sm:right-0 sm:left-auto"} w-auto sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden`}>
                    {/* Chat Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        <div>
                          <h3 className="font-semibold text-sm">
                            {t("header.customerSupport")}
                          </h3>
                          <p className="text-xs opacity-80">
                            {t("header.hereToHelp")}
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
                      className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900"
                    >
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                          <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                          <p className="text-sm text-center">
                            {t("header.startConversation")}
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
                                  : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-bl-md"
                              }`}
                            >
                              {msg.text && <p className="text-sm">{msg.text}</p>}
                              {/* Attachments */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className={`${msg.text ? "mt-2" : ""} space-y-2`}>
                                  {msg.attachments.map((att) => (
                                    <div key={att.id}>
                                      {att.type?.startsWith("image/") ? (
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
                                          className={`flex items-center gap-2 p-2 rounded-lg ${
                                            msg.sender === "user" 
                                              ? "bg-white/20 hover:bg-white/30" 
                                              : "bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500"
                                          } transition-colors`}
                                        >
                                          {getFileIcon(att.type)}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{att.name}</p>
                                            <p className={`text-xs ${msg.sender === "user" ? "opacity-70" : "text-gray-500 dark:text-gray-400"}`}>
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
                              <p className={`text-xs mt-1 ${
                                msg.sender === "user" ? "text-white/70" : "text-gray-400 dark:text-gray-500"
                              }`}>
                                {(() => {
                                  const d = new Date(msg.timestamp);
                                  return isNaN(d.getTime()) ? "-" : d.toLocaleTimeString(language === "ar" ? "ar-AE" : "en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                })()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Attachment Preview */}
                    {chatAttachments.length > 0 && (
                      <div className="px-3 py-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-2">
                        {chatAttachments.map((att) => (
                          <div key={att.id} className="relative group">
                            {att.type?.startsWith("image/") ? (
                              <img src={att.url} alt={att.name} className="w-12 h-12 rounded object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                {getFileIcon(att.type)}
                              </div>
                            )}
                            <button
                              onClick={() => removeAttachment(att.id)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chat Input */}
                    <div className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
                      <div className="flex gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          multiple
                          className="hidden"
                          accept="*/*"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                          title={t("header.attachFile")}
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                          placeholder={t("header.typeMessage")}
                          className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() && chatAttachments.length === 0}
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
                  className="relative p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  {userUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {userUnreadCount > 9 ? "9+" : userUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className={`fixed sm:absolute inset-x-2 sm:inset-x-auto top-14 sm:top-auto sm:mt-2 ${language === "ar" ? "sm:left-0 sm:right-auto" : "sm:right-0 sm:left-auto"} w-auto sm:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                        {t("header.notifications")}
                      </h3>
                      <div className="flex items-center gap-2">
                        {userUnreadCount > 0 && (
                          <button
                            onClick={() => markAllAsRead()}
                            className="text-xs text-primary hover:underline whitespace-nowrap"
                          >
                            {t("header.markAllRead")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto">
                      {userNotifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                          <p>{t("header.noNotifications")}</p>
                        </div>
                      ) : (
                        userNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                              notification.unread ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notification.type, notification.title)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm ${notification.unread ? "font-semibold" : "font-medium"} text-gray-900 dark:text-white`}>
                                  {language === "ar" ? notification.titleAr : notification.title}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                  className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                >
                                  <X className="w-3 h-3 text-gray-400" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-200 mt-0.5 line-clamp-2">
                                {isInvoiceNotification(notification) 
                                  ? t("header.clickToViewInvoice")
                                  : (language === "ar" ? notification.messageAr : notification.message)
                                }
                              </p>
                              {isInvoiceNotification(notification) && (
                                <span className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-300 font-medium">
                                  <FileText className="w-3 h-3" />
                                  {t("header.viewInvoice")}
                                </span>
                              )}
                              <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
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
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600">
                        <button
                          onClick={() => {
                            clearAllNotifications();
                            setShowNotifications(false);
                          }}
                          className="w-full text-center text-xs text-red-500 hover:text-red-600 py-1 flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("header.clearAll")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {showBasketIcon && (
              <Link to="/basket" className="relative group p-1">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-primary group-hover:text-primary/80 transition-colors"
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

            {/* Wishlist Icon - Only for logged in users */}
            {isLoggedIn && (
              <Link to="/wishlist" className="relative group hidden sm:block">
                <Heart className="w-5 h-5 text-primary group-hover:text-primary/80 transition-colors" />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {wishlistItems.length > 9 ? "9+" : wishlistItems.length}
                  </span>
                )}
              </Link>
            )}

            {isLoggedIn ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1 p-1.5 sm:p-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <span className="hidden sm:inline text-sm text-muted-foreground max-w-[80px] truncate">
                    {user?.firstName}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform hidden sm:block ${showUserMenu ? "rotate-180" : ""}`} />
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className={`absolute top-full mt-2 ${language === "ar" ? "left-0" : "right-0"} w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden`}>
                    {/* User Info */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                      <p className="font-semibold text-foreground text-sm">{user?.firstName} {user?.familyName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        to="/home"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Home className="w-4 h-4 text-muted-foreground" />
                        {t("header.home")}
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        {t("header.myAccount")}
                      </Link>
                      <Link
                        to="/orders"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                        {t("header.myOrders")}
                      </Link>
                      <Link
                        to="/wallet"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        {t("header.wallet")}
                      </Link>
                      <Link
                        to="/deals"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Percent className="w-4 h-4 text-muted-foreground" />
                        {t("header.dealsOffers")}
                      </Link>
                      <Link
                        to="/wishlist"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Heart className="w-4 h-4 text-muted-foreground" />
                        {t("header.wishlist")}
                        {wishlistItems.length > 0 && (
                          <span className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
                            {wishlistItems.length}
                          </span>
                        )}
                      </Link>
                      
                      {isAdmin && (
                        <>
                          <div className="border-t border-gray-100 dark:border-gray-600 my-2" />
                          <Link
                            to="/admin/dashboard"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {t("header.adminPanel")}
                          </Link>
                        </>
                      )}
                      
                      <div className="border-t border-gray-100 dark:border-gray-600 my-2" />
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                          window.location.href = "/";
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {t("login.logout")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link to="/login" className="text-[11px] sm:text-sm px-1.5 py-1 sm:px-3 sm:py-1.5 text-primary hover:text-primary/80 font-medium whitespace-nowrap">
                  {t("header.login")}
                </Link>
                <Link to="/register" className="btn-primary text-[11px] sm:text-sm px-1.5 py-1 sm:px-3 sm:py-1.5 whitespace-nowrap">
                  {t("header.register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          language={language}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </header>
  );
};

// Extracted Invoice Modal with draggable support
function InvoiceModal({ invoice, language, onClose }: { invoice: Notification; language: "en" | "ar"; onClose: () => void }) {
  const { dragHandleProps, dialogStyle } = useDraggable();
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden" style={dialogStyle}>
        {/* Modal Header - Drag Handle */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-white" {...dragHandleProps}>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="font-bold text-lg">
                {t("header.taxInvoice")}
              </h2>
              <p className="text-sm opacity-90">
                {formatRelativeTime(invoice.createdAt, language)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 leading-relaxed">
            {language === "ar" ? invoice.messageAr : invoice.message}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex gap-3">
          <button
            onClick={() => {
              const invoiceText = language === "ar" ? invoice.messageAr : invoice.message;
              navigator.clipboard.writeText(invoiceText);
              alert(t("header.invoiceCopied"));
            }}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {t("header.copyInvoice")}
          </button>
          <button
            onClick={() => {
              const invoiceText = language === "ar" ? invoice.messageAr : invoice.message;
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(`
                  <html>
                    <head>
                      <title>${t("header.taxInvoice")}</title>
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
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {t("header.print")}
          </button>
        </div>
      </div>
    </div>
  );
}
