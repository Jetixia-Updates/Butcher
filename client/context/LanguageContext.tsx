import React, { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";

export type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: Record<string, string>) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t: i18nT, i18n } = useTranslation();
  const [language, setLanguageState] = useState<Language>(
    (i18n.language as Language) || "en"
  );

  // Sync initial language from i18next (which reads localStorage)
  useEffect(() => {
    const lng = i18n.language as Language;
    if (lng === "ar" || lng === "en") {
      setLanguageState(lng);
      document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = lng;
    }
  }, [i18n.language]);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    i18n.changeLanguage(newLanguage);
    localStorage.setItem("language", newLanguage);
    document.documentElement.dir = newLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLanguage;
  };

  // Backward-compatible t() — supports both dot-notation "header.title" and nested "header.title"
  const t = (key: string, replacements?: Record<string, string>): string => {
    const result = i18nT(key, replacements || {});
    return typeof result === "string" ? result : key;
  };

  const isRTL = language === "ar";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
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
