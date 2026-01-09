import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isValidUAEPhone, isStrongPassword } from "@/utils/validators";
import { LogIn, UserPlus } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginWithCredentials, login } = useAuth();
  const { t, language } = useLanguage();

  const [mobile, setMobile] = useState("+971 ");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  const validateForm = () => {
    const newErrors: { mobile?: string; password?: string } = {};

    if (!isValidUAEPhone(mobile)) {
      newErrors.mobile = "Please enter a valid UAE phone number (+971 XX XXX XXXX)";
    }

    if (!password) {
      newErrors.password = "Password is required";
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
    const result = await loginWithCredentials(mobile, password);
    
    if (result.success) {
      navigate("/products");
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
      <header className="py-4 px-4 border-b border-border/50 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          {/* Left side - Register & Login icons */}
          <div className="flex items-center gap-2">
            <Link
              to="/register"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "register" 
                  ? "bg-primary text-white" 
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
              onClick={() => setActiveTab("register")}
            >
              <UserPlus className="w-4 h-4" />
              {language === "ar" ? "تسجيل" : "Register"}
            </Link>
            <button
              onClick={() => setActiveTab("login")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "login" 
                  ? "bg-primary text-white" 
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
            >
              <LogIn className="w-4 h-4" />
              {language === "ar" ? "دخول" : "Login"}
            </button>
          </div>

          {/* Right side - Language Switcher */}
          <div className="flex items-center">
            <LanguageSwitcher variant="compact" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo & Title - Larger */}
          <div className="text-center mb-10 animate-fade-in">
            <div className="text-7xl mb-4">🥩</div>
            <p className="text-lg text-muted-foreground mb-1">
              {language === "ar" ? "مرحباً بكم في" : "Welcome to"}
            </p>
            <h1 className="text-5xl font-bold text-foreground tracking-tight">
              {language === "ar" ? "الجزار" : "BUTCHER"}
            </h1>
            <p className="text-muted-foreground text-sm mt-3">
              {t("login.subtitle")}
            </p>
          </div>

          {/* Login Form */}
          <form
            onSubmit={handleLogin}
            className="card-premium p-8 space-y-6 animate-slide-up"
          >
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("login.phone")}
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  let value = e.target.value;
                  // Ensure it starts with +971
                  if (!value.startsWith("+971")) {
                    value = "+971";
                  }
                  setMobile(value);
                  if (errors.mobile) {
                    setErrors({ ...errors, mobile: undefined });
                  }
                }}
                placeholder="+971 50 123 4567"
                className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
                  errors.mobile
                    ? "border-destructive bg-destructive/5"
                    : "border-input bg-white focus:border-primary"
                } text-foreground placeholder-muted-foreground focus:outline-none`}
              />
              {errors.mobile && (
                <p className="text-destructive text-sm mt-1">{errors.mobile}</p>
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
                      : "border-input bg-white focus:border-primary"
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
