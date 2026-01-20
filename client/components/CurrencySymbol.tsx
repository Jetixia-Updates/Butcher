import React from "react";

interface CurrencySymbolProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export const CurrencySymbol: React.FC<CurrencySymbolProps> = ({
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    xs: "w-2.5 h-2.5",
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
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  size = "md",
  className = "",
}) => {
  // Ensure price is a number (API may return strings for decimal values)
  const numericPrice = typeof price === 'string' ? parseFloat(price) : (typeof price === 'number' ? price : 0);
  const displayPrice = isNaN(numericPrice) ? 0 : numericPrice;
  
  return (
    <span className={`inline-flex items-center gap-1 [text-decoration:inherit] ${className}`}>
      <CurrencySymbol size={size} className="[text-decoration:inherit]" />
      <span className="[text-decoration:inherit]">{displayPrice.toFixed(2)}</span>
    </span>
  );
};
