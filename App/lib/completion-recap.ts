/** Accept both the live quest timer ("3m 04s") and older colon-form recaps. */
export function parseCompletionDuration(duration: string): number | null {
  const text = duration.trim();
  if (/^\d+:\d{2}(?::\d{2})?$/.test(text)) {
    const parts = text.split(":").map(Number);
    if (parts.slice(1).some((part) => part >= 60)) return null;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    return Number.isSafeInteger(seconds) ? seconds : null;
  }
  if (!/^(?:\d+d\s*)?(?:\d+h\s*)?(?:\d+m\s*)?(?:\d+s)?$/.test(text) || !text) return null;
  const multiplier: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };
  const seconds = Array.from(text.matchAll(/(\d+)([dhms])/g)).reduce((total, match) => total + Number(match[1]) * multiplier[match[2]], 0);
  return Number.isSafeInteger(seconds) ? seconds : null;
}
