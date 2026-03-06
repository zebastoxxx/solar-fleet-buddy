import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatCOP = (amount: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);

export const formatCOPShort = (amount: number): string => {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
};

export const formatHours = (hours: number): string => `${hours.toFixed(1)}h`;

export const formatHorometer = (hours: number): string =>
  `${hours.toLocaleString('es-CO', { minimumFractionDigits: 1 })} h`;

export const formatDate = (date: string | Date): string =>
  format(new Date(date), 'd MMM yyyy', { locale: es });

export const formatDateTime = (date: string | Date): string =>
  format(new Date(date), 'd MMM yyyy, HH:mm', { locale: es });

export const formatRelative = (date: string | Date): string => {
  const d = new Date(date);
  if (isToday(d)) return `Hoy, ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Ayer, ${format(d, 'HH:mm')}`;
  return formatDate(date);
};

export const formatAgo = (date: string | Date): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
