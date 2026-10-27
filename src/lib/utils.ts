import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CustomerTier } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'Bs.'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `${safeAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Parses any date string, timestamp or Date instance safely in the local timezone.
 * Avoids the standard JavaScript bug where "YYYY-MM-DD" is interpreted as UTC midnight,
 * which in western timezones (such as Bolivia GMT-4) rolls back to the previous day (yesterday).
 */
export function parseDateSafely(dateInput: string | number | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? new Date() : new Date(dateInput.getTime());
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  const str = String(dateInput).trim();
  if (!str) return new Date();

  // YYYY-MM-DD format (e.g., 2026-10-09)
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    // Set to local noon (12:00:00) so timezone offsets or daylight saving can never cross midnight
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  }

  // YYYY-MM-DD HH:mm or YYYY-MM-DD HH:mm:ss format
  const ymdTimeMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (ymdTimeMatch) {
    const [, y, m, d, hh, mm, ss] = ymdTimeMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), ss ? Number(ss) : 0);
  }

  // DD/MM/YYYY or DD-MM-YYYY format
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Returns a local date string in YYYY-MM-DD format without UTC displacement.
 */
export function getLocalDateString(dateInput: Date | number | string = new Date()): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = parseDateSafely(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a local 24-hour time string in HH:mm or HH:mm:ss format.
 */
export function getLocalTimeString(dateInput: Date | number | string = new Date(), includeSeconds: boolean = false): string {
  if (typeof dateInput === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateInput.trim())) {
    return includeSeconds ? dateInput.trim() : dateInput.trim().slice(0, 5);
  }
  const d = parseDateSafely(dateInput);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (includeSeconds) {
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${hours}:${minutes}`;
}

/**
 * Formats date into calibrated DD/MM/YYYY string. Guaranteed not to shift by -1 day.
 */
export function formatDate(dateString: string | number | Date | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = parseDateSafely(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateString);
  }
}

/**
 * Formats time into calibrated HH:mm (24h) string.
 */
export function formatTime(timestamp?: number | string | Date): string {
  try {
    if (!timestamp) {
      const now = new Date();
      return getLocalTimeString(now);
    }
    return getLocalTimeString(timestamp);
  } catch {
    return '00:00';
  }
}

/**
 * Formats date and time into calibrated DD/MM/YYYY HH:mm string.
 */
export function formatDateTime(timestamp?: number | string | Date): string {
  try {
    const d = parseDateSafely(timestamp);
    const datePart = formatDate(d);
    const timePart = getLocalTimeString(d);
    return `${datePart} ${timePart}`;
  } catch {
    return '';
  }
}

/**
 * Returns current calibrated system date and time objects.
 */
export function getCurrentDateTime(): { date: string; time: string; full: string } {
  const now = new Date();
  const date = getLocalDateString(now);
  const time = getLocalTimeString(now);
  const full = `${formatDate(now)} ${time}`;
  return { date, time, full };
}

/**
 * Safely computes day of week in Spanish without UTC rollback.
 */
export function getDayOfWeekName(dateInput: string | number | Date): string {
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const d = parseDateSafely(dateInput);
  return daysOfWeek[d.getDay()];
}

/**
 * Safely gets days difference from now without timezone distortion.
 */
export function getDiffDaysFromNow(dateInput: string | number | Date): number {
  const now = new Date();
  const target = parseDateSafely(dateInput);
  const msDiff = now.getTime() - target.getTime();
  return msDiff / (1000 * 60 * 60 * 24);
}

export function getCustomerTier(pairs: number): CustomerTier {
  if (pairs >= 10) return 'Premium';
  if (pairs >= 7) return 'VIP';
  if (pairs >= 4) return 'Frecuente';
  if (pairs >= 2) return 'Intermitente';
  return 'Casual';
}

export function getCustomerFollowUpAlert(tier: CustomerTier): { alert: string; color: string; badge: string } {
  switch (tier) {
    case 'Premium':
      return {
        alert: '⭐ Cliente de Honor (10+ pares): Aplicar descuento preferencial y atención prioritaria inmediata.',
        color: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
        badge: 'PREMIUM ⭐'
      };
    case 'VIP':
      return {
        alert: '💎 Cliente VIP (7-9 pares): Ofrecer reserva anticipada de nuevas colecciones sin depósito previo.',
        color: 'text-purple-300 border-purple-500/40 bg-purple-500/10',
        badge: 'VIP 💎'
      };
    case 'Frecuente':
      return {
        alert: '🔥 Cliente Frecuente (4-6 pares): Notificar llegada de calzados en su talla favorita.',
        color: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
        badge: 'FRECUENTE 🔥'
      };
    case 'Intermitente':
      return {
        alert: '⚡ Cliente Intermitente (2-3 pares): Enviar mensaje de reactivación con catálogo de ofertas.',
        color: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
        badge: 'INTERMITENTE ⚡'
      };
    case 'Casual':
    default:
      return {
        alert: '🌱 Cliente Casual (1 par): Realizar seguimiento de satisfacción y consulta sobre la talla recibida.',
        color: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
        badge: 'CASUAL 🌱'
      };
  }
}

export const BOLIVIA_DEPARTMENTS = [
  'Cochabamba',
  'La Paz',
  'Santa Cruz',
  'Oruro',
  'Potosí',
  'Chuquisaca',
  'Tarija',
  'Beni',
  'Pando'
] as const;

/**
 * Computes exact chronological millisecond timestamp for a sale
 * combining its date and time, with fallback to createdAt.
 */
export function getSaleChronologicalTimestamp(sale: { date?: string; time?: string; createdAt?: number }): number {
  if (sale.date) {
    const timeStr = (sale.time || '00:00').trim();
    const timeParts = timeStr.split(':');
    const hh = parseInt(timeParts[0] || '0', 10);
    const mm = parseInt(timeParts[1] || '0', 10);

    // Format YYYY-MM-DD
    const ymd = sale.date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
      const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), hh, mm, 0);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    // Format DD/MM/YYYY
    const dmy = sale.date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10), hh, mm, 0);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    const fallbackDate = new Date(`${sale.date} ${timeStr}`);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate.getTime();
  }
  return sale.createdAt || 0;
}

