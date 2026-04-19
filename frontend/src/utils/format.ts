/** Extract HH:MM from an ISO datetime string or passthrough a bare HH:MM string. */
export function toHHMM(isoOrTime: string): string {
  if (isoOrTime.includes('T')) return isoOrTime.slice(11, 16)
  return isoOrTime.slice(0, 5)
}

/** Extract YYYY-MM-DD from an ISO datetime or date string. */
export function toDateString(iso: string): string {
  return iso.slice(0, 10)
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(toDateString(iso) + 'T00:00:00').toLocaleDateString('en-MY', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  })
}
