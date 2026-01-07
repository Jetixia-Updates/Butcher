/**
 * UAE VAT rate (5%)
 */
export const VAT_RATE = 0.05;

/**
 * Calculate VAT and total from subtotal
 */
export const calculateVAT = (
  subtotal: number
): {
  subtotal: number;
  vat: number;
  total: number;
} => {
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    vat: parseFloat(vat.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};

/**
 * Format price in UAE Dirham with proper decimal places
 */
export const formatPrice = (price: number): string => {
  return `₫ ${price.toFixed(2)}`;
};

/**
 * Parse price string to number
 */
export const parsePrice = (price: string): number => {
  return parseFloat(price.replace(/[^\d.]/g, ""));
};
