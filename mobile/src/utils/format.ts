/** Short relative time: now, 5m, 3h, 2d, 4w */
export const timeAgo = (iso: string, lang: 'en' | 'ar' = 'en'): string => {
  const u = lang === 'ar' ? { now: 'الآن', m: 'د', h: 'س', d: 'ي', w: 'أ' } : { now: 'now', m: 'm', h: 'h', d: 'd', w: 'w' };
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return u.now;
  if (m < 60) return `${m}${u.m}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${u.h}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}${u.d}`;
  return `${Math.floor(d / 7)}${u.w}`;
};

export const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};
