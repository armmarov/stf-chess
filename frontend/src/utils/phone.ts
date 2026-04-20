export function toWhatsAppNumber(raw: string | null | undefined, defaultCc = '60'): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D+/g, '')
  if (!digits) return null
  // Leading 0 assumed local (MY default) — strip and prefix defaultCc
  if (digits.startsWith('0')) return defaultCc + digits.slice(1)
  return digits
}
