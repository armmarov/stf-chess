import type { RecordLevel, RecordCategory } from '@/api/records'

function ordinal(n: number): string {
  // Special-case 11th, 12th, 13th (and equivalents in teens: 111-113, etc.)
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const mod10 = n % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}

export function placementLabel(p: number | null): string {
  if (p === null) return 'Participation'
  if (p === 1) return 'Champion'
  if (p === 2) return '1st Runner-up'
  if (p === 3) return '2nd Runner-up'
  return `${ordinal(p)} place`
}

export const LEVEL_LABELS: Record<RecordLevel, string> = {
  sekolah: 'Sekolah',
  daerah: 'Daerah',
  negeri: 'Negeri',
  kebangsaan: 'Kebangsaan',
  antarabangsa: 'Antarabangsa',
}

export const CATEGORY_LABELS: Record<RecordCategory, string> = {
  u13: 'U-13',
  u14: 'U-14',
  u15: 'U-15',
  u16: 'U-16',
  u17: 'U-17',
  u18: 'U-18',
  u21: 'U-21',
  open: 'Open',
}
