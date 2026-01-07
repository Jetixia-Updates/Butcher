import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isValidEmail, isValidUAEPhone } from "@/utils/validators";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const { t } = useLanguage();

  const [mobile, setMobile] = useState("+971 ");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ mobile?: string; email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  const validateForm = () => {
    const newErrors: { mobile?: string; email?: string } = {};

    if (!isValidUAEPhone(mobile)) {
      newErrors.mobile = t("forgot.invalidPhone");
    }

    if (!email || !isValidEmail(email)) {
      newErrors.email = t("forgot.invalidEmail");
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

    const result = requestPasswordReset(email, mobile);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setServerError(result.error || t("forgot.genericError"));
    }

    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
        {/* Header */}
        <div className="py-6 px-4">
          <div className="max-w-md mx-auto flex justify-center">
            <LanguageSwitcher variant="compact" />
          </div>
        </div>

        {/* Success Message */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="card-premium p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t("forgot.successTitle")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("forgot.successMessage")}
              </p>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg mb-6">
                📧 {email}
              </p>
              <Link
                to="/login"
                className="btn-primary inline-block px-6 py-3 rounded-lg font-semibold"
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* Header */}
      <div className="py-6 px-4">
        <div className="max-w-md mx-auto flex justify-center">
          <LanguageSwitcher variant="compact" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-primary mb-2">🔑</h1>
            <h2 className="text-3xl font-bold text-foreground">{t("forgot.title")}</h2>
            <p className="text-muted-foreground text-sm mt-2">
              {t("forgot.subtitle")}
            </p>
          </div>

          {/* Forgot Password Form */}
          <form
            onSubmit={handleSubmit}
            className="card-premium p-8 space-y-6 animate-slide-up"
          >
            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {serverError}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("forgot.phone")}
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  let value = e.target.value;
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
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("forgot.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors({ ...errors, email: undefined });
                  }
                }}
                placeholder={t("forgot.emailPlaceholder")}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
                  errors.email
                    ? "border-destructive bg-destructive/5"
                    : "border-input bg-white focus:border-primary"
                } text-foreground placeholder-muted-foreground focus:outline-none`}
              />
              {errors.email && (
                <p className="text-destructive text-sm mt-1">{errors.email}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {t("forgot.emailNote")}
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 rounded-lg font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? t("forgot.sending") : t("forgot.sendButton")}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="text-center mt-6">
            <Link
              to="/login"
              className="text-primary font-semibold hover:text-primary/80 transition-colors"
            >
              ← {t("forgot.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
