import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isValidEmail } from "@/utils/validators";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const { t, language } = useLanguage();
  const isRTL = language === "ar";

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [serverError, setServerError] = useState("");

  const validateForm = () => {
    const newErrors: { email?: string } = {};
    if (!email || !isValidEmail(email)) {
      newErrors.email = t("forgot.invalidEmail");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) return;

    setIsLoading(true);

    const result = await requestPasswordReset(email);

    if (result.success) {
      setIsSuccess(true);
      if (result.resetLink) {
        setResetLink(result.resetLink);
      }
    } else {
      setServerError(result.error || t("forgot.genericError"));
    }

    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
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
                {t("forgot.successTitle")}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                {t("forgot.successMessage")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground bg-muted p-2 sm:p-3 rounded-lg mb-4 sm:mb-6 break-all">
                📧 {email}
              </p>
              {resetLink && (
                <Link
                  to={resetLink}
                  className="block mb-4 text-sm bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  🔗 {isRTL ? "اضغط هنا لإعادة تعيين كلمة المرور" : "Click here to reset your password"}
                </Link>
              )}
              <Link
                to="/login"
                className="btn-primary inline-block px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base"
              >
                {t("forgot.backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <div className="py-4 sm:py-6 px-3 sm:px-4">
        <div className="max-w-md mx-auto flex justify-center">
          <LanguageSwitcher variant="compact" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8 animate-fade-in">
            <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">🔑</h1>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t("forgot.title")}</h2>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2">
              {isRTL ? "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين" : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

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
                {t("forgot.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({});
                }}
                placeholder={t("forgot.emailPlaceholder")}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 transition-colors text-sm sm:text-base ${
                  errors.email
                    ? "border-destructive bg-destructive/5"
                    : "border-input bg-white dark:bg-gray-800 focus:border-primary"
                } text-foreground placeholder-muted-foreground focus:outline-none`}
              />
              {errors.email && (
                <p className="text-destructive text-xs sm:text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? t("forgot.sending") : t("forgot.sendButton")}
            </button>
          </form>

          <div className="text-center mt-4 sm:mt-6">
            <Link
              to="/login"
              className="text-primary font-semibold hover:text-primary/80 transition-colors text-sm sm:text-base"
            >
              ← {t("forgot.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
