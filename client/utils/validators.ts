/**
 * UAE Phone validation
 * Accepts formats: +971 50 123 4567, +971501234567, +97150 1234567
 */
export const isValidUAEPhone = (phone: string): boolean => {
  const phoneRegex = /^\+971\s?\d{2}\s?\d{3}\s?\d{4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};

/**
 * Strong password validation
 * Requirements: At least 8 characters, 1 uppercase, 1 special character
 */
export const isStrongPassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Email validation
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Name validation (first name, family name)
 * Allows letters, spaces, hyphens
 */
export const isValidName = (name: string): boolean => {
  const nameRegex = /^[a-zA-Z\s\-']{2,}$/;
  return nameRegex.test(name);
};

/**
 * Credit card number validation (Luhn algorithm)
 */
export const isValidCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(cleaned)) return false;

  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

/**
 * CVV validation (3 or 4 digits)
 */
export const isValidCVV = (cvv: string): boolean => {
  const cvvRegex = /^\d{3,4}$/;
  return cvvRegex.test(cvv);
};

/**
 * Expiry date validation (MM/YY format)
 */
export const isValidExpiryDate = (expiryDate: string): boolean => {
  const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
  if (!expiryRegex.test(expiryDate)) return false;

  const [month, year] = expiryDate.split("/");
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear() % 100;
  const currentMonth = currentDate.getMonth() + 1;

  const expYear = parseInt(year, 10);
  const expMonth = parseInt(month, 10);

  if (expYear < currentYear) return false;
  if (expYear === currentYear && expMonth < currentMonth) return false;

  return true;
};

/**
 * AED amount validation (positive number with up to 2 decimal places)
 */
export const isValidAmount = (amount: string): boolean => {
  const amountRegex = /^\d+(\.\d{1,2})?$/;
  return amountRegex.test(amount) && parseFloat(amount) > 0;
};
