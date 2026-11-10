const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number | null | undefined, currency = 'USD'): string {
  if (value == null) return '—';
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    formatters.set(currency, f);
  }
  return f.format(value);
}

/** "+$1.20 (+4.3%)" */
export function formatChange(from: number, to: number, currency = 'USD'): string {
  const diff = to - from;
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  const pct = from > 0 ? ` (${sign}${Math.abs((diff / from) * 100).toFixed(1)}%)` : '';
  return `${sign}${formatMoney(Math.abs(diff), currency)}${pct}`;
}

/** "006/165" when the set size is known, else "006". */
export function formatCardNumber(localId: string, officialCount: number | null | undefined): string {
  return officialCount ? `${localId}/${officialCount}` : localId;
}

/** Human labels for TCGplayer printing names. */
export function formatVariant(variant: string): string {
  const labels: Record<string, string> = {
    normal: 'Normal',
    holofoil: 'Holofoil',
    'reverse-holofoil': 'Reverse Holo',
    '1stEditionHolofoil': '1st Edition Holo',
    '1stEditionNormal': '1st Edition',
    unlimitedHolofoil: 'Unlimited Holo',
    default: 'Standard',
    foil: 'Foil',
  };
  return labels[variant] ?? variant.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** TCGdex image base URL -> sized image. */
export function cardImage(imageUrl: string | null | undefined, size: 'low' | 'high' = 'low') {
  return imageUrl ? `${imageUrl}/${size}.webp` : null;
}
