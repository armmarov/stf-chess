import apiClient from './client'

export type PaymentStatus = 'pending' | 'approved' | 'rejected'

export interface PaymentStudent {
  id: string
  name: string
  username: string
}

export interface PaymentSession {
  id: string
  date: string
  startTime: string
  place: string
  isCancelled: boolean
}

export interface Payment {
  id: string
  studentId: string
  sessionId: string | null
  // Decimal serialised as string by Prisma — use parseFloat() for arithmetic/display
  amount: string
  status: PaymentStatus
  receiptUrl: string
  note: string | null
  uploadedAt: string
  reviewedAt: string | null
  student: PaymentStudent
  session: PaymentSession | null
  reviewedBy: { id: string; name: string } | null
}

export interface ListPaymentsQuery {
  status?: PaymentStatus
  sessionId?: string
  studentId?: string
}

/** Converts a receiptUrl like `/api/payments/{id}/receipt` to an absolute URL. */
export function getReceiptFullUrl(receiptUrl: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
  const origin = new URL(base).origin
  return origin + receiptUrl
}

export async function uploadPayment(sessionId: string, file: File): Promise<Payment> {
  const form = new FormData()
  form.append('sessionId', sessionId)
  form.append('receipt', file)
  const { data } = await apiClient.post<{ payment: Payment }>('/payments', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.payment
}

export async function listPayments(query?: ListPaymentsQuery): Promise<Payment[]> {
  const params: Record<string, string> = {}
  if (query?.status) params.status = query.status
  if (query?.sessionId) params.sessionId = query.sessionId
  if (query?.studentId) params.studentId = query.studentId
  const { data } = await apiClient.get<{ payments: Payment[] }>('/payments', { params })
  return data.payments
}

export async function getPayment(id: string): Promise<Payment> {
  const { data } = await apiClient.get<{ payment: Payment }>(`/payments/${id}`)
  return data.payment
}

export async function reviewPayment(
  id: string,
  decision: 'approve' | 'reject',
  note?: string,
): Promise<Payment> {
  const { data } = await apiClient.patch<{ payment: Payment }>(`/payments/${id}/review`, {
    decision,
    note: note ?? null,
  })
  return data.payment
}
