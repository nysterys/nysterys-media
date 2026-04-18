// ============================================================
// utils/format.js — Safe formatting utilities
// All date/number formatting goes through here.
// Never throws on bad input — always returns a fallback string.
// ============================================================
import { format, parseISO, isValid } from 'date-fns';

/**
 * Safely format any date string or Date object.
 * Returns '—' for null, undefined, empty string, or invalid dates.
 */
export function fmtDate(d, fmt = 'MMM d, yyyy') {
  if (!d) return '—';
  try {
    // If it's already a Date object
    if (d instanceof Date) {
      return isValid(d) ? format(d, fmt) : '—';
    }
    // String: use parseISO which handles timezone correctly
    const parsed = parseISO(String(d));
    return isValid(parsed) ? format(parsed, fmt) : '—';
  } catch {
    return '—';
  }
}

/**
 * Safely format a yyyy-MM string into a month label (e.g. "April 2026").
 * Validates the string is a proper yyyy-MM before parsing.
 */
export function fmtMonth(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '—';
  try {
    const parsed = parseISO(ym + '-01');
    return isValid(parsed) ? format(parsed, 'MMMM yyyy') : ym;
  } catch {
    return ym;
  }
}

/**
 * Safely format a money value.
 */
export function fmtMoney(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Extract valid yyyy-MM month strings from an array of rows with a date field.
 * Filters out malformed dates (like '20265-03-21') before slicing.
 */
export function extractMonths(rows, dateField = 'invoice_date') {
  return [...new Set(
    rows
      .map(r => r[dateField])
      .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .map(d => d.slice(0, 7))
  )].sort().reverse();
}

/**
 * Validate that a string is a reasonable date value (yyyy-MM-dd).
 * Used before saving to DB.
 */
export function isValidDateString(d) {
  if (!d) return true; // empty/null is allowed (optional fields)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = parseISO(d);
  return isValid(parsed);
}

/**
 * Validate a numeric value — returns true if empty (optional) or a valid number.
 */
export function isValidNumber(v) {
  if (v === '' || v == null) return true;
  return !isNaN(parseFloat(v)) && isFinite(v);
}

/**
 * Validate an email address format.
 */
export function isValidEmail(email) {
  if (!email) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate a URL format.
 */
export function isValidUrl(url) {
  if (!url) return true; // optional
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
