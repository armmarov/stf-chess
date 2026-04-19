import apiClient from './client'

export async function getFee(): Promise<number> {
  const { data } = await apiClient.get<{ fee: number }>('/config/fee')
  return data.fee
}

export async function setFee(fee: number): Promise<number> {
  const { data } = await apiClient.put<{ fee: number }>('/config/fee', { fee })
  return data.fee
}
