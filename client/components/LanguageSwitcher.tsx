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
      <div className="flex gap-1 items-center bg-white border border-border rounded-md p-1">
        <button
          onClick={() => setLanguage("en")}
          className={`px-2 py-1 text-sm font-medium rounded transition-colors ${
            language === "en"
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage("ar")}
          className={`px-2 py-1 text-sm font-medium rounded transition-colors ${
            language === "ar"
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          AR
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
