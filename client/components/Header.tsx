import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useBasket } from "@/context/BasketContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  showBasketIcon?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ showBasketIcon = true }) => {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { itemCount } = useBasket();
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Left: Language Switcher */}
          <div className="flex-1">
            <LanguageSwitcher variant="compact" />
          </div>

          {/* Center: Logo */}
          <Link
            to="/"
            className="flex-1 text-center"
          >
            <div className="inline-block">
              <h1 className="text-2xl font-bold text-primary">
                🥩 {t("header.title")}
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                {t("header.subtitle")}
              </p>
            </div>
          </Link>

          {/* Right: Auth & Basket */}
          <div className="flex-1 flex justify-end items-center gap-4">
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
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {user?.firstName}
                </span>
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    className="btn-outline text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t("header.adminPanel")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    window.location.href = "/";
                  }}
                  className="btn-outline text-sm"
                >
                  {t("login.logout")}
                </button>
              </div>
            ) : (
              <Link to="/" className="btn-primary text-sm">
                {t("login.loginLink")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
