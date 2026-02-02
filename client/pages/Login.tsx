import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogIn, UserPlus, User } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginWithCredentials, login } = useAuth();
  const { t, language } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  const validateForm = () => {
    const newErrors: { username?: string; password?: string } = {};

    if (!username || username.length < 3) {
      newErrors.username = language === "ar" 
        ? "يرجى إدخال اسم المستخدم أو البريد الإلكتروني (3 أحرف على الأقل)" 
        : "Please enter a username or email (at least 3 characters)";
    }

    if (!password) {
      newErrors.password = language === "ar" ? "كلمة المرور مطلوبة" : "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Call backend API for login
    const result = await loginWithCredentials(username, password);
    
    if (result.success) {
      navigate("/home");
    } else {
      setErrors({ ...errors, password: result.error || "Login failed" });
    }
    
    setIsLoading(false);
  };

  const handleVisitorMode = () => {
    navigate("/visitor");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* Header */}
      <header className="py-3 px-3 sm:py-4 sm:px-4 border-b border-border/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          {/* Left side - Register & Login icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/register"
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === "register" 
                  ? "bg-primary text-white" 
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
              onClick={() => setActiveTab("register")}
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden xs:inline">{language === "ar" ? "تسجيل" : "Register"}</span>
            </Link>
            <button
              onClick={() => setActiveTab("login")}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === "login" 
                  ? "bg-primary text-white" 
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden xs:inline">{language === "ar" ? "دخول" : "Login"}</span>
            </button>
          </div>

          {/* Right side - Language Switcher */}
          <div className="flex items-center">
            <LanguageSwitcher variant="compact" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
        <div className="w-full max-w-md">
          {/* Logo & Title - Responsive */}
          <div className="text-center mb-6 sm:mb-10 animate-fade-in">
            <div className="text-5xl sm:text-7xl mb-3 sm:mb-4">🥩</div>
            <p className="text-base sm:text-lg text-muted-foreground mb-1">
              {language === "ar" ? "مرحباً بكم في" : "Welcome to"}
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight">
              {language === "ar" ? "الجزار" : "BUTCHER"}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2 sm:mt-3">
              {t("login.subtitle")}
            </p>
          </div>

          {/* Login Form */}
          <form
            onSubmit={handleLogin}
            className="card-premium p-4 sm:p-8 space-y-4 sm:space-y-6 animate-slide-up"
          >
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                {language === "ar" ? "اسم المستخدم أو البريد الإلكتروني" : "Username or Email"}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    // Allow alphanumeric, underscore, @, dot, hyphen for email support
                    const value = e.target.value.replace(/[^a-zA-Z0-9_@.\-]/g, "");
                    setUsername(value);
                    if (errors.username) {
                      setErrors({ ...errors, username: undefined });
                    }
                  }}
                  placeholder={language === "ar" ? "أدخل اسم المستخدم أو البريد الإلكتروني" : "Enter your username or email"}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border-2 transition-colors ${
                    errors.username
                      ? "border-destructive bg-destructive/5"
                      : "border-input bg-white dark:bg-gray-800 focus:border-primary"
                  } text-foreground placeholder-muted-foreground focus:outline-none`}
                />
              </div>
              {errors.username && (
                <p className="text-destructive text-sm mt-1">{errors.username}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-foreground">
                  {t("login.password")}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {t("login.forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors({ ...errors, password: undefined });
                    }
                  }}
                  placeholder={t("login.enterPassword")}
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
                    errors.password
                      ? "border-destructive bg-destructive/5"
                      : "border-input bg-white dark:bg-gray-800 focus:border-primary"
                  } text-foreground placeholder-muted-foreground focus:outline-none pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 rounded-lg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? t("login.loggingIn") : t("login.loginButton")}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">{t("login.or")}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleVisitorMode}
              className="w-full btn-outline py-3 rounded-lg font-semibold text-base transition-all"
            >
              {t("login.continueAsVisitor")}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center mt-6">
            <p className="text-muted-foreground">
              {t("login.noAccount")}{" "}
              <Link
                to="/register"
                className="text-primary font-semibold hover:text-primary/80 transition-colors"
              >
                {t("login.register")}
              </Link>
            </p>
          </div>

          {/* Footer Links */}
          <div className="mt-8 pt-8 border-t border-border space-y-2 text-center text-xs text-muted-foreground">
            <p>
              📍 Dubai, UAE | ☎ +971 50 123 4567 | 🟢 Open Now
            </p>
            <p className="text-xs">
              <a href="#" className="hover:text-foreground">Terms</a> · {" "}
              <a href="#" className="hover:text-foreground">Privacy</a> · {" "}
              <a href="#" className="hover:text-foreground">Contact</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
