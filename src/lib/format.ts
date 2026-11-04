export function formatGBP(value: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  const { compact = false, sign = false } = opts;
  const abs = Math.abs(value);
  let body: string;
  if (compact && abs >= 1_000_000) {
    body = `£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  } else if (compact && abs >= 1_000) {
    body = `£${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  } else {
    // Always show exact pence (2dp) for non-compact values
    body = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
  }
  const prefix = value < 0 ? '-' : sign ? '+' : '';
  return `${prefix}${body}`;
}

export function formatGBPFull(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  // Slice to YYYY-MM-DD before constructing to avoid UTC→local timezone shift
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseAmount(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
