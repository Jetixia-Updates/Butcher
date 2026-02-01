import React from "react";
import { useLanguage } from "@/context/LanguageContext";

interface LanguageSwitcherProps {
  variant?: "compact" | "full";
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = "compact",
}) => {
  const { language, setLanguage } = useLanguage();

  if (variant === "compact") {
    return (
      <div className="flex gap-0.5 items-center bg-white dark:bg-slate-800 border border-border rounded-md p-0.5 sm:p-1">
        <button
          onClick={() => setLanguage("en")}
          className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs sm:text-sm font-medium rounded transition-colors ${
            language === "en"
              ? "bg-primary text-primary-foreground"
              : "text-gray-700 dark:text-gray-200 hover:bg-muted"
          }`}
        >
          <span className="hidden sm:inline">EN</span>
          <span className="sm:hidden">E</span>
        </button>
        <button
          onClick={() => setLanguage("ar")}
          className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs sm:text-sm font-medium rounded transition-colors ${
            language === "ar"
              ? "bg-primary text-primary-foreground"
              : "text-gray-700 dark:text-gray-200 hover:bg-muted"
          }`}
        >
          <span className="hidden sm:inline">AR</span>
          <span className="sm:hidden">ع</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <button
        onClick={() => setLanguage("en")}
        className={`text-sm font-semibold transition-colors pb-2 ${
          language === "en"
            ? "text-primary border-b-2 border-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLanguage("ar")}
        className={`text-sm font-semibold transition-colors pb-2 ${
          language === "ar"
            ? "text-primary border-b-2 border-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        العربية
      </button>
    </div>
  );
};
