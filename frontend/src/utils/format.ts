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

export function sessionSerial(id: string, dateISO: string): string {
  const dateTag = dateISO.slice(0, 10).replace(/-/g, '')
  const short = id.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `SESH-${dateTag}-${short}`
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return formatDate(iso, { weekday: undefined, year: 'numeric' })
}
