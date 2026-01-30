/**
 * Date utilities for handling timezone-safe date operations.
 * 
 * The problem: When you do `new Date('2026-02-14').toISOString()`, JavaScript
 * interprets the date string as midnight UTC. If you're in a timezone behind UTC
 * (like US timezones), displaying this date locally will show the previous day.
 * 
 * Solution: Parse date strings and set time to noon local time before converting
 * to ISO string. This ensures the date doesn't shift when displayed.
 */

/**
 * Converts a date string (yyyy-MM-dd) to an ISO string that preserves the intended date.
 * Sets time to noon local time to avoid timezone shift issues.
 */
export function dateToISOString(dateString: string): string {
  // Parse the date parts
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date at noon local time to avoid timezone shifts
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.toISOString();
}

/**
 * Parses an ISO date string and returns a Date object.
 * Use this when you need to compare or display dates.
 */
export function parseDate(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Formats a date for display in date input fields (yyyy-MM-dd format).
 * Handles the date in local timezone.
 */
export function formatDateForInput(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the start of today in local timezone
 */
export function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Gets the end of today in local timezone
 */
export function getEndOfToday(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

/**
 * Formats a date for display (e.g., "Jan 21, 2026")
 */
export function formatDateForDisplay(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats time for display (e.g., "2:30 PM")
 */
export function formatTimeForDisplay(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
