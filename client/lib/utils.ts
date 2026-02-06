import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse a date value. Returns a valid Date or null if invalid.
 */
export function safeDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Safely convert a value to an ISO string. Returns fallback if invalid.
 */
export function safeISOString(value: unknown, fallback: string = new Date().toISOString()): string {
  const d = safeDate(value);
  return d ? d.toISOString() : fallback;
}

/**
 * Safely format a date for display. Returns fallback string if invalid.
 */
export function safeDateFormat(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
  fallback: string = "-"
): string {
  const d = safeDate(value);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString(locale, options);
  } catch {
    return fallback;
  }
}

/**
 * Safely format a time for display. Returns fallback string if invalid.
 */
export function safeTimeFormat(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
  fallback: string = "-"
): string {
  const d = safeDate(value);
  if (!d) return fallback;
  try {
    return d.toLocaleTimeString(locale, options);
  } catch {
    return fallback;
  }
}

/**
 * Safely format a date+time for display. Returns fallback string if invalid.
 */
export function safeDateTimeFormat(
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
  fallback: string = "-"
): string {
  const d = safeDate(value);
  if (!d) return fallback;
  try {
    return d.toLocaleString(locale, options);
  } catch {
    return fallback;
  }
}
