import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Format an ISO date string as "Mar 12, 2026 14:30" (24-hour local time).
 */
export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year} ${hours}:${minutes}`;
}

/**
 * Format an ISO date string as a short date label, e.g. "Mar 12".
 */
export function formatDateShort(isoString: string): string {
  const d = new Date(isoString);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

/**
 * Calculate a success rate as an integer percentage (0–100).
 * Returns 0 when total is 0 to avoid division by zero.
 */
export function successRate(success: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((success / total) * 100);
}
