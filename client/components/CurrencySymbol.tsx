import React from "react";

interface CurrencySymbolProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const CurrencySymbol: React.FC<CurrencySymbolProps> = ({
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  };

  // Use CSS mask to apply currentColor to the SVG image
  return (
    <span
      className={`inline-block ${sizeClasses[size]} ${className}`}
      style={{
        verticalAlign: "middle",
        backgroundColor: "currentColor",
        maskImage: "url(https://upload.wikimedia.org/wikipedia/commons/e/ee/UAE_Dirham_Symbol.svg)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: "url(https://upload.wikimedia.org/wikipedia/commons/e/ee/UAE_Dirham_Symbol.svg)",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
      aria-label="AED"
    />
  );
};

interface PriceDisplayProps {
  price: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  size = "md",
  className = "",
}) => {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <CurrencySymbol size={size} />
      <span>{price.toFixed(2)}</span>
    </span>
  );
};
