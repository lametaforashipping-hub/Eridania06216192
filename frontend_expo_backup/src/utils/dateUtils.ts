/**
 * Date utilities for timezone handling
 * Default timezone: America/Santo_Domingo (AST, UTC-4)
 */

const DEFAULT_TIMEZONE = 'America/Santo_Domingo';
const DEFAULT_LOCALE = 'es-DO';

/**
 * Format a date/time string to the local timezone
 * @param dateString - ISO date string or Date object
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in local timezone
 */
export function formatDateTime(
  dateString: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return '';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options,
    };
    
    return date.toLocaleString(DEFAULT_LOCALE, defaultOptions);
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(dateString);
  }
}

/**
 * Format only the date part
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return '';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...options,
    };
    
    return date.toLocaleDateString(DEFAULT_LOCALE, defaultOptions);
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(dateString);
  }
}

/**
 * Format only the time part
 */
export function formatTime(
  dateString: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return '';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: DEFAULT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options,
    };
    
    return date.toLocaleTimeString(DEFAULT_LOCALE, defaultOptions);
  } catch (error) {
    console.error('Error formatting time:', error);
    return String(dateString);
  }
}

/**
 * Get the current date/time in the local timezone
 */
export function getCurrentDateTime(): Date {
  return new Date();
}

/**
 * Format a date for ticket display (e.g., "02/03/2026, 7:50 p. m.")
 */
export function formatTicketDateTime(dateString: string | Date | null | undefined): string {
  return formatDateTime(dateString, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date for short display (e.g., "02/03/26 7:50 PM")
 */
export function formatShortDateTime(dateString: string | Date | null | undefined): string {
  return formatDateTime(dateString, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
