import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isStrongPassword } from "@/utils/validators";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyResetToken, resetPassword } = useAuth();
  const { t } = useLanguage();

  const token = searchParams.get("token") || "";
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setIsValidToken(false);
      return;
    }

    const result = verifyResetToken(token);
    setIsValidToken(result.valid);
    if (result.email) {
      setUserEmail(result.email);
    }
  }, [token, verifyResetToken]);

  const validateForm = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      newErrors.password = t("reset.passwordRequired");
    } else if (!isStrongPassword(password)) {
      newErrors.password = t("reset.passwordWeak");
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t("reset.confirmRequired");
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t("reset.passwordMismatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = resetPassword(token, password);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setServerError(result.error || t("reset.genericError"));
    }

    setIsLoading(false);
  };

  // Invalid or expired token
  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
        <div className="py-4 sm:py-6 px-3 sm:px-4">
          <div className="max-w-md mx-auto flex justify-center">
            <LanguageSwitcher variant="compact" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
          <div className="w-full max-w-md">
            <div className="card-premium p-4 sm:p-8 text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                {t("reset.invalidTitle")}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                {t("reset.invalidMessage")}
              </p>
              <Link
                to="/forgot-password"
                className="btn-primary inline-block px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base"
              >
                {t("reset.requestNew")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state while verifying token
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 sm:w-8 sm:h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-muted-foreground">{t("reset.verifying")}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
        <div className="py-4 sm:py-6 px-3 sm:px-4">
          <div className="max-w-md mx-auto flex justify-center">
            <LanguageSwitcher variant="compact" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
          <div className="w-full max-w-md">
            <div className="card-premium p-4 sm:p-8 text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                {t("reset.successTitle")}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                {t("reset.successMessage")}
              </p>
              <Link
                to="/login"
                className="btn-primary inline-block px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base"
              >
                {t("reset.loginNow")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* Header */}
      <div className="py-4 sm:py-6 px-3 sm:px-4">
        <div className="max-w-md mx-auto flex justify-center">
          <LanguageSwitcher variant="compact" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-6 sm:mb-8 animate-fade-in">
            <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">🔐</h1>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t("reset.title")}</h2>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2">
              {t("reset.subtitle")}
            </p>
            {userEmail && (
              <p className="text-xs sm:text-sm text-primary mt-2 break-all">
                📧 {userEmail}
              </p>
            )}
          </div>

          {/* Reset Password Form */}
          <form
            onSubmit={handleSubmit}
            className="card-premium p-4 sm:p-8 space-y-4 sm:space-y-6 animate-slide-up"
          >
            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm">
                {serverError}
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                {t("reset.newPassword")}
              </label>
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
                  placeholder={t("reset.newPasswordPlaceholder")}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 transition-colors text-sm sm:text-base ${
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
                <p className="text-destructive text-xs sm:text-sm mt-1">{errors.password}</p>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                {t("reset.passwordHint")}
              </p>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-foreground mb-2">
                {t("reset.confirmPassword")}
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                }}
                placeholder={t("reset.confirmPasswordPlaceholder")}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 transition-colors text-sm sm:text-base ${
                  errors.confirmPassword
                    ? "border-destructive bg-destructive/5"
                    : "border-input bg-white dark:bg-gray-800 focus:border-primary"
                } text-foreground placeholder-muted-foreground focus:outline-none`}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-xs sm:text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? t("reset.resetting") : t("reset.resetButton")}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="text-center mt-4 sm:mt-6">
            <Link
              to="/login"
              className="text-primary font-semibold hover:text-primary/80 transition-colors text-sm sm:text-base"
            >
              ← {t("reset.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
