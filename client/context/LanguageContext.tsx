import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    "header.title": "BUTCHER",
    "header.subtitle": "Premium Quality Meats",
    "header.adminPanel": "Admin Panel",
    
    // Products Page
    "products.title": "Premium Cuts",
    "products.welcome": "Welcome, {name}! Browse our selection of premium meats.",
    "products.guestMessage": "Browse our selection as a guest. Log in to add items to your basket.",
    "products.noProducts": "No products available in this category",
    "products.loginPrompt": "Want to add items to your basket?",
    "products.loginPromptDesc": "Create an account or log in to start shopping.",
    "products.loginNow": "Login Now",
    
    // Categories
    "category.all": "All",
    "category.beef": "Beef",
    "category.lamb": "Lamb",
    "category.chicken": "Chicken",
    "category.goat": "Goat",
    
    // Product Card
    "product.add": "Add",
    "product.added": "Added!",
    "product.login": "Login to Buy",
    "product.outOfStock": "Out of Stock",
    
    // Basket
    "basket.title": "Your Basket",
    "basket.subtitle": "Review your items and proceed to checkout",
    "basket.empty": "Your basket is empty",
    "basket.emptyDesc": "Start adding some premium meats to your basket!",
    "basket.continueShopping": "Continue Shopping",
    "basket.summary": "Order Summary",
    "basket.subtotal": "Subtotal",
    "basket.delivery": "Delivery",
    "basket.total": "Total",
    "basket.checkout": "Proceed to Checkout",
    "basket.remove": "Remove",
    
    // Login Page
    "login.title": "BUTCHER",
    "login.subtitle": "Premium Quality Meats Delivered Fresh",
    "login.phone": "Phone Number",
    "login.password": "Password",
    "login.forgotPassword": "Forgot Password?",
    "login.enterPassword": "Enter your password",
    "login.loginButton": "Login",
    "login.loggingIn": "Logging in...",
    "login.noAccount": "Don't have an account?",
    "login.register": "Register",
    "login.or": "OR",
    "login.continueAsVisitor": "Continue as Visitor",
    "login.logout": "Logout",
    "login.loginLink": "Login",
    
    // Footer
    "footer.title": "BUTCHER",
    "footer.description": "Premium quality meats delivered fresh to your door. Since 2020.",
    "footer.quickLinks": "Quick Links",
    "footer.products": "Products",
    "footer.about": "About Us",
    "footer.faq": "FAQ",
    "footer.contact": "Contact",
    "footer.contactUs": "Contact Us",
    "footer.address": "Address",
    "footer.phone": "Phone",
    "footer.whatsapp": "WhatsApp",
    "footer.status": "Status",
    "footer.rights": "All rights reserved.",
    "footer.terms": "Terms",
    "footer.privacy": "Privacy",
    "footer.returns": "Returns",
    
    // Forgot Password
    "forgot.title": "Forgot Password",
    "forgot.subtitle": "Enter your details to receive a password reset link",
    "forgot.phone": "Registered Phone Number",
    "forgot.email": "Registered Email",
    "forgot.phonePlaceholder": "Enter your phone number",
    "forgot.emailPlaceholder": "Enter your email address",
    "forgot.invalidPhone": "Please enter a valid phone number",
    "forgot.invalidEmail": "Please enter a valid email address",
    "forgot.emailNote": "We'll send a reset link to this email if it matches your account",
    "forgot.sending": "Sending...",
    "forgot.sendButton": "Send Reset Link",
    "forgot.successTitle": "Check Your Email!",
    "forgot.successMessage": "We've sent a password reset link to your email. Please check your inbox and follow the instructions.",
    "forgot.backToLogin": "Back to Login",
    "forgot.notFound": "No account found with this phone number and email combination",
    
    // Reset Password
    "reset.title": "Reset Password",
    "reset.subtitle": "Create a new password for your account",
    "reset.newPassword": "New Password",
    "reset.newPasswordPlaceholder": "Enter new password",
    "reset.confirmPassword": "Confirm Password",
    "reset.confirmPasswordPlaceholder": "Confirm new password",
    "reset.passwordRequired": "Password is required",
    "reset.passwordWeak": "Password must be at least 8 characters with uppercase, lowercase, and number",
    "reset.confirmRequired": "Please confirm your password",
    "reset.passwordMismatch": "Passwords do not match",
    "reset.passwordHint": "Minimum 8 characters with uppercase, lowercase, and number",
    "reset.resetting": "Resetting...",
    "reset.resetButton": "Reset Password",
    "reset.successTitle": "Password Reset Successfully!",
    "reset.successMessage": "Your password has been changed. You can now login with your new password.",
    "reset.loginNow": "Login Now",
    "reset.invalidTitle": "Invalid or Expired Link",
    "reset.invalidMessage": "This password reset link is invalid or has expired. Please request a new one.",
    "reset.requestNew": "Request New Link",
    "reset.verifying": "Verifying link...",
    "reset.backToLogin": "Back to Login",
    "reset.genericError": "Something went wrong. Please try again.",
    
    // Common
    "common.aed": "₫",
    "common.free": "Free",
    
    // Admin
    "admin.title": "Butcher Admin",
    "admin.subtitle": "Management System",
    "admin.dashboardOverview": "Dashboard Overview",
    "admin.viewStore": "View Store",
    "admin.notifications": "Notifications",
    "admin.noNotifications": "No new notifications",
    
    // Admin Tabs
    "admin.dashboard": "Dashboard",
    "admin.orders": "Orders",
    "admin.products": "Products",
    "admin.inventory": "Inventory",
    "admin.suppliers": "Suppliers",
    "admin.users": "Users",
    "admin.delivery": "Delivery",
    "admin.payments": "Payments",
    "admin.reports": "Reports",
    "admin.settings": "Settings",
    
    // Dashboard
    "dashboard.todayOrders": "Today's Orders",
    "dashboard.todayRevenue": "Today's Revenue",
    "dashboard.pendingOrders": "Pending Orders",
    "dashboard.totalCustomers": "Total Customers",
    "dashboard.recentOrders": "Recent Orders",
    "dashboard.quickActions": "Quick Actions",
    "dashboard.viewAllOrders": "View All Orders",
    "dashboard.lowStockAlerts": "Low Stock Alerts",
    "dashboard.topProducts": "Top Products",
    
    // Orders
    "orders.title": "Orders Management",
    "orders.allOrders": "All Orders",
    "orders.pending": "Pending",
    "orders.confirmed": "Confirmed",
    "orders.processing": "Processing",
    "orders.outForDelivery": "Out for Delivery",
    "orders.delivered": "Delivered",
    "orders.cancelled": "Cancelled",
    "orders.orderNumber": "Order #",
    "orders.customer": "Customer",
    "orders.items": "Items",
    "orders.total": "Total",
    "orders.status": "Status",
    "orders.date": "Date",
    "orders.actions": "Actions",
    "orders.viewDetails": "View Details",
    "orders.updateStatus": "Update Status",
    "orders.noOrders": "No orders found",
    
    // Stock/Inventory
    "stock.title": "Inventory Management",
    "stock.product": "Product",
    "stock.available": "Available",
    "stock.reserved": "Reserved",
    "stock.total": "Total",
    "stock.threshold": "Threshold",
    "stock.restock": "Restock",
    "stock.lowStock": "Low Stock",
    "stock.inStock": "In Stock",
    "stock.outOfStock": "Out of Stock",
    
    // Users
    "users.title": "User Management",
    "users.name": "Name",
    "users.email": "Email",
    "users.phone": "Phone",
    "users.role": "Role",
    "users.status": "Status",
    "users.active": "Active",
    "users.inactive": "Inactive",
    "users.customer": "Customer",
    "users.admin": "Admin",
    "users.staff": "Staff",
    "users.driver": "Driver",
    
    // Delivery
    "delivery.title": "Delivery Management",
    "delivery.zones": "Delivery Zones",
    "delivery.tracking": "Tracking",
    "delivery.drivers": "Drivers",
    "delivery.zone": "Zone",
    "delivery.fee": "Fee",
    "delivery.estimatedTime": "Est. Time",
    
    // Payments
    "payments.title": "Payments",
    "payments.transaction": "Transaction",
    "payments.amount": "Amount",
    "payments.method": "Method",
    "payments.card": "Card",
    "payments.cod": "Cash on Delivery",
    "payments.bankTransfer": "Bank Transfer",
    "payments.completed": "Completed",
    "payments.pending": "Pending",
    "payments.failed": "Failed",
    "payments.refunded": "Refunded",
    
    // Reports
    "reports.title": "Reports & Analytics",
    "reports.salesReport": "Sales Report",
    "reports.inventoryReport": "Inventory Report",
    "reports.customerReport": "Customer Report",
    "reports.export": "Export",
    "reports.dateRange": "Date Range",
    "reports.today": "Today",
    "reports.thisWeek": "This Week",
    "reports.thisMonth": "This Month",
    "reports.custom": "Custom",
  },
  ar: {
    // Header
    "header.title": "الجزارة",
    "header.subtitle": "لحوم عالية الجودة",
    "header.adminPanel": "لوحة الإدارة",
    
    // Products Page
    "products.title": "قطع ممتازة",
    "products.welcome": "مرحباً {name}! تصفح مجموعتنا من اللحوم الممتازة.",
    "products.guestMessage": "تصفح مجموعتنا كزائر. سجل الدخول لإضافة عناصر إلى سلتك.",
    "products.noProducts": "لا توجد منتجات متاحة في هذه الفئة",
    "products.loginPrompt": "هل تريد إضافة عناصر إلى سلتك؟",
    "products.loginPromptDesc": "أنشئ حساباً أو سجل الدخول لبدء التسوق.",
    "products.loginNow": "تسجيل الدخول الآن",
    
    // Categories
    "category.all": "الكل",
    "category.beef": "لحم البقر",
    "category.lamb": "لحم الخروف",
    "category.chicken": "دجاج",
    "category.goat": "لحم ماعز",
    
    // Product Card
    "product.add": "إضافة",
    "product.added": "تمت الإضافة!",
    "product.login": "تسجيل الدخول للشراء",
    "product.outOfStock": "غير متوفر",
    
    // Basket
    "basket.title": "سلتك",
    "basket.subtitle": "راجع عناصرك واستمر للدفع",
    "basket.empty": "سلتك فارغة",
    "basket.emptyDesc": "ابدأ بإضافة بعض اللحوم الممتازة إلى سلتك!",
    "basket.continueShopping": "متابعة التسوق",
    "basket.summary": "ملخص الطلب",
    "basket.subtotal": "المجموع الفرعي",
    "basket.delivery": "التوصيل",
    "basket.total": "المجموع",
    "basket.checkout": "الانتقال للدفع",
    "basket.remove": "حذف",
    
    // Login Page
    "login.title": "الجزارة",
    "login.subtitle": "لحوم عالية الجودة طازجة إلى باب منزلك",
    "login.phone": "رقم الهاتف",
    "login.password": "كلمة المرور",
    "login.forgotPassword": "نسيت كلمة المرور؟",
    "login.enterPassword": "أدخل كلمة المرور",
    "login.loginButton": "تسجيل الدخول",
    "login.loggingIn": "جاري تسجيل الدخول...",
    "login.noAccount": "ليس لديك حساب؟",
    "login.register": "سجل الآن",
    "login.or": "أو",
    "login.continueAsVisitor": "متابعة كزائر",
    "login.logout": "تسجيل الخروج",
    "login.loginLink": "تسجيل الدخول",
    
    // Footer
    "footer.title": "الجزارة",
    "footer.description": "لحوم عالية الجودة يتم توصيلها طازجة إلى باب منزلك. منذ 2020.",
    "footer.quickLinks": "روابط سريعة",
    "footer.products": "المنتجات",
    "footer.about": "من نحن",
    "footer.faq": "الأسئلة الشائعة",
    "footer.contact": "اتصل بنا",
    "footer.contactUs": "اتصل بنا",
    "footer.address": "العنوان",
    "footer.phone": "الهاتف",
    "footer.whatsapp": "واتساب",
    "footer.status": "الحالة",
    "footer.rights": "جميع الحقوق محفوظة.",
    "footer.terms": "الشروط",
    "footer.privacy": "الخصوصية",
    "footer.returns": "المرتجعات",
    
    // Forgot Password
    "forgot.title": "نسيت كلمة المرور",
    "forgot.subtitle": "أدخل بياناتك لاستلام رابط إعادة تعيين كلمة المرور",
    "forgot.phone": "رقم الهاتف المسجل",
    "forgot.email": "البريد الإلكتروني المسجل",
    "forgot.phonePlaceholder": "أدخل رقم هاتفك",
    "forgot.emailPlaceholder": "أدخل بريدك الإلكتروني",
    "forgot.invalidPhone": "يرجى إدخال رقم هاتف صالح",
    "forgot.invalidEmail": "يرجى إدخال بريد إلكتروني صالح",
    "forgot.emailNote": "سنرسل رابط إعادة التعيين إلى هذا البريد إذا كان مطابقاً لحسابك",
    "forgot.sending": "جاري الإرسال...",
    "forgot.sendButton": "إرسال رابط إعادة التعيين",
    "forgot.successTitle": "تحقق من بريدك الإلكتروني!",
    "forgot.successMessage": "لقد أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد واتباع التعليمات.",
    "forgot.backToLogin": "العودة لتسجيل الدخول",
    "forgot.notFound": "لم يتم العثور على حساب بهذا الرقم والبريد الإلكتروني",
    
    // Reset Password
    "reset.title": "إعادة تعيين كلمة المرور",
    "reset.subtitle": "أنشئ كلمة مرور جديدة لحسابك",
    "reset.newPassword": "كلمة المرور الجديدة",
    "reset.newPasswordPlaceholder": "أدخل كلمة المرور الجديدة",
    "reset.confirmPassword": "تأكيد كلمة المرور",
    "reset.confirmPasswordPlaceholder": "أكد كلمة المرور الجديدة",
    "reset.passwordRequired": "كلمة المرور مطلوبة",
    "reset.passwordWeak": "يجب أن تكون كلمة المرور 8 أحرف على الأقل مع حرف كبير وصغير ورقم",
    "reset.confirmRequired": "يرجى تأكيد كلمة المرور",
    "reset.passwordMismatch": "كلمات المرور غير متطابقة",
    "reset.passwordHint": "8 أحرف على الأقل مع حرف كبير وصغير ورقم",
    "reset.resetting": "جاري إعادة التعيين...",
    "reset.resetButton": "إعادة تعيين كلمة المرور",
    "reset.successTitle": "تم إعادة تعيين كلمة المرور بنجاح!",
    "reset.successMessage": "تم تغيير كلمة المرور. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.",
    "reset.loginNow": "تسجيل الدخول الآن",
    "reset.invalidTitle": "رابط غير صالح أو منتهي",
    "reset.invalidMessage": "رابط إعادة تعيين كلمة المرور هذا غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.",
    "reset.requestNew": "طلب رابط جديد",
    "reset.verifying": "جاري التحقق من الرابط...",
    "reset.backToLogin": "العودة لتسجيل الدخول",
    "reset.genericError": "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    
    // Common
    "common.aed": "₫",
    "common.free": "مجاناً",
    
    // Admin
    "admin.title": "إدارة الجزارة",
    "admin.subtitle": "نظام الإدارة",
    "admin.dashboardOverview": "نظرة عامة على لوحة التحكم",
    "admin.viewStore": "عرض المتجر",
    "admin.notifications": "الإشعارات",
    "admin.noNotifications": "لا توجد إشعارات جديدة",
    
    // Admin Tabs
    "admin.dashboard": "لوحة التحكم",
    "admin.orders": "الطلبات",
    "admin.products": "المنتجات",
    "admin.inventory": "المخزون",
    "admin.suppliers": "الموردون",
    "admin.users": "المستخدمون",
    "admin.delivery": "التوصيل",
    "admin.payments": "المدفوعات",
    "admin.reports": "التقارير",
    "admin.settings": "الإعدادات",
    
    // Dashboard
    "dashboard.todayOrders": "طلبات اليوم",
    "dashboard.todayRevenue": "إيرادات اليوم",
    "dashboard.pendingOrders": "الطلبات المعلقة",
    "dashboard.totalCustomers": "إجمالي العملاء",
    "dashboard.recentOrders": "الطلبات الأخيرة",
    "dashboard.quickActions": "إجراءات سريعة",
    "dashboard.viewAllOrders": "عرض جميع الطلبات",
    "dashboard.lowStockAlerts": "تنبيهات المخزون المنخفض",
    "dashboard.topProducts": "أفضل المنتجات",
    
    // Orders
    "orders.title": "إدارة الطلبات",
    "orders.allOrders": "جميع الطلبات",
    "orders.pending": "قيد الانتظار",
    "orders.confirmed": "مؤكد",
    "orders.processing": "قيد المعالجة",
    "orders.outForDelivery": "خارج للتوصيل",
    "orders.delivered": "تم التوصيل",
    "orders.cancelled": "ملغي",
    "orders.orderNumber": "رقم الطلب",
    "orders.customer": "العميل",
    "orders.items": "العناصر",
    "orders.total": "المجموع",
    "orders.status": "الحالة",
    "orders.date": "التاريخ",
    "orders.actions": "الإجراءات",
    "orders.viewDetails": "عرض التفاصيل",
    "orders.updateStatus": "تحديث الحالة",
    "orders.noOrders": "لا توجد طلبات",
    
    // Stock/Inventory
    "stock.title": "إدارة المخزون",
    "stock.product": "المنتج",
    "stock.available": "متاح",
    "stock.reserved": "محجوز",
    "stock.total": "الإجمالي",
    "stock.threshold": "الحد الأدنى",
    "stock.restock": "إعادة التخزين",
    "stock.lowStock": "مخزون منخفض",
    "stock.inStock": "متوفر",
    "stock.outOfStock": "غير متوفر",
    
    // Users
    "users.title": "إدارة المستخدمين",
    "users.name": "الاسم",
    "users.email": "البريد الإلكتروني",
    "users.phone": "الهاتف",
    "users.role": "الدور",
    "users.status": "الحالة",
    "users.active": "نشط",
    "users.inactive": "غير نشط",
    "users.customer": "عميل",
    "users.admin": "مدير",
    "users.staff": "موظف",
    "users.driver": "سائق",
    
    // Delivery
    "delivery.title": "إدارة التوصيل",
    "delivery.zones": "مناطق التوصيل",
    "delivery.tracking": "التتبع",
    "delivery.drivers": "السائقون",
    "delivery.zone": "المنطقة",
    "delivery.fee": "الرسوم",
    "delivery.estimatedTime": "الوقت المتوقع",
    
    // Payments
    "payments.title": "المدفوعات",
    "payments.transaction": "المعاملة",
    "payments.amount": "المبلغ",
    "payments.method": "طريقة الدفع",
    "payments.card": "بطاقة",
    "payments.cod": "الدفع عند الاستلام",
    "payments.bankTransfer": "تحويل بنكي",
    "payments.completed": "مكتمل",
    "payments.pending": "قيد الانتظار",
    "payments.failed": "فشل",
    "payments.refunded": "مسترد",
    
    // Reports
    "reports.title": "التقارير والتحليلات",
    "reports.salesReport": "تقرير المبيعات",
    "reports.inventoryReport": "تقرير المخزون",
    "reports.customerReport": "تقرير العملاء",
    "reports.export": "تصدير",
    "reports.dateRange": "نطاق التاريخ",
    "reports.today": "اليوم",
    "reports.thisWeek": "هذا الأسبوع",
    "reports.thisMonth": "هذا الشهر",
    "reports.custom": "مخصص",
  },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>("en");

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language;
    if (savedLanguage === "ar" || savedLanguage === "en") {
      setLanguageState(savedLanguage);
      document.documentElement.dir = savedLanguage === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem("language", newLanguage);
    document.documentElement.dir = newLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLanguage;
  };

  const t = (key: string, replacements?: Record<string, string>): string => {
    let translation = translations[language][key] || key;
    
    // Replace placeholders like {name}
    if (replacements) {
      Object.keys(replacements).forEach((placeholder) => {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
      });
    }
    
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
