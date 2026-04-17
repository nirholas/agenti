const BASE_URL = 'https://api.bitrefill.com/v2'

export interface BitrefillProduct {
  id: string
  name: string
  type: 'giftcard' | 'esim' | 'topup'
  country: string
  currency: string
  denominations: number[]
  minValue?: number
  maxValue?: number
  description?: string
}

export interface BitrefillInvoice {
  id: string
  paymentAddress: string
  paymentMethod: 'bitcoin' | 'lightning' | 'ethereum' | 'usdc' | 'tether'
  amountDue: number
  currency: string
  expiresAt: number
  product: string
  quantity: number
}

export interface BitrefillOrder {
  id: string
  status: 'pending' | 'paid' | 'completed' | 'failed'
  redemptionCode?: string
  deliveryMethod?: 'email' | 'sms' | 'pin'
  createdAt: number
}

export interface BitrefillConfig {
  apiKey: string
  testMode?: boolean
}

function authHeader(config: BitrefillConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.apiKey}` }
}

async function bitrefillFetch<T>(
  path: string,
  options: RequestInit & { config?: BitrefillConfig } = {}
): Promise<T> {
  const { config, ...init } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config ? authHeader(config) : {}),
    ...(init.headers as Record<string, string> | undefined),
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Bitrefill ${res.status} ${path}: ${body}`)
  }
  return res.json() as Promise<T>
}

function mapProduct(raw: Record<string, unknown>): BitrefillProduct {
  const packages = (raw['packages'] as Array<{ value: number }> | undefined) ?? []
  const denominations = packages.map((p) => p.value)
  const range = raw['range'] as { min: number; max: number } | undefined
  const category = String(raw['category'] ?? '')

  let type: BitrefillProduct['type'] = 'giftcard'
  if (category.toLowerCase().includes('esim') || String(raw['type'] ?? '').toLowerCase().includes('esim')) {
    type = 'esim'
  } else if (category.toLowerCase().includes('topup') || category.toLowerCase().includes('top-up')) {
    type = 'topup'
  }

  return {
    id: String(raw['id'] ?? raw['slug'] ?? ''),
    name: String(raw['name'] ?? ''),
    type,
    country: String(raw['country'] ?? ''),
    currency: String(raw['currency'] ?? 'USD'),
    denominations,
    minValue: range?.min,
    maxValue: range?.max,
    description: raw['description'] ? String(raw['description']) : undefined,
  }
}

export async function searchProducts(
  config: BitrefillConfig,
  query: string,
  options?: { country?: string; type?: BitrefillProduct['type'] }
): Promise<BitrefillProduct[]> {
  const params = new URLSearchParams({ query })
  if (options?.country) params.set('country', options.country)
  if (config.testMode) params.set('test', 'true')

  const data = await bitrefillFetch<{ products?: unknown[] }>(`/products?${params}`, { config })
  const products = data.products ?? []

  return products
    .map((p) => mapProduct(p as Record<string, unknown>))
    .filter((p) => !options?.type || p.type === options.type)
}

export async function createInvoice(
  config: BitrefillConfig,
  params: {
    productId: string
    value: number
    currency?: string
    paymentMethod?: BitrefillInvoice['paymentMethod']
    deliveryEmail?: string
  }
): Promise<BitrefillInvoice> {
  const body: Record<string, unknown> = {
    product_id: params.productId,
    value: params.value,
    payment_method: params.paymentMethod ?? 'usdc',
    ...(params.currency ? { currency: params.currency } : {}),
    ...(params.deliveryEmail ? { delivery_email: params.deliveryEmail } : {}),
    ...(config.testMode ? { test: true } : {}),
  }

  const raw = await bitrefillFetch<Record<string, unknown>>('/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
    config,
  })

  const payment = raw['payment'] as Record<string, unknown> | undefined
  return {
    id: String(raw['id'] ?? ''),
    paymentAddress: String(payment?.['address'] ?? raw['payment_address'] ?? ''),
    paymentMethod: String(payment?.['method'] ?? params.paymentMethod ?? 'usdc') as BitrefillInvoice['paymentMethod'],
    amountDue: Number(payment?.['amount'] ?? raw['amount'] ?? 0),
    currency: String(payment?.['currency'] ?? raw['currency'] ?? 'USDC'),
    expiresAt: Number(raw['expires_at'] ?? 0),
    product: String(raw['product_id'] ?? params.productId),
    quantity: Number(raw['quantity'] ?? 1),
  }
}

export async function waitForOrder(
  config: BitrefillConfig,
  invoiceId: string,
  options?: { timeoutMs?: number; pollIntervalMs?: number }
): Promise<BitrefillOrder> {
  const timeoutMs = options?.timeoutMs ?? 300_000
  const pollIntervalMs = options?.pollIntervalMs ?? 5_000
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const raw = await bitrefillFetch<Record<string, unknown>>(`/invoices/${invoiceId}`, { config })
    const status = String(raw['status'] ?? 'pending') as BitrefillOrder['status']

    if (status === 'completed' || status === 'failed') {
      const redemption = raw['redemption'] as Record<string, unknown> | undefined
      return {
        id: invoiceId,
        status,
        redemptionCode: redemption?.['code'] ? String(redemption['code']) : undefined,
        deliveryMethod: redemption?.['type'] ? (String(redemption['type']) as BitrefillOrder['deliveryMethod']) : undefined,
        createdAt: Number(raw['created_at'] ?? 0),
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error(`Bitrefill order ${invoiceId} did not complete within ${timeoutMs}ms`)
}

export async function getFeaturedProducts(country?: string): Promise<BitrefillProduct[]> {
  const params = country ? `?country=${country}` : ''
  const data = await bitrefillFetch<{ products?: unknown[] }>(`/products/featured${params}`)
  const products = data.products ?? []
  return products.map((p) => mapProduct(p as Record<string, unknown>))
}
