import { createHelius } from 'helius-sdk'
import type { Webhook, CreateWebhookRequest } from 'helius-sdk/types/webhooks'

export interface CreateWatchOptions {
  addresses: string[]
  webhookUrl: string
  webhookType?: string
  transactionTypes?: string[]
  authHeader?: string
}

export interface WebhookInfo {
  webhookId: string
  webhookUrl: string
  addresses: string[]
  transactionTypes: string[]
  webhookType: string
}

function toWebhookInfo(w: Webhook): WebhookInfo {
  return {
    webhookId: w.webhookID,
    webhookUrl: w.webhookURL,
    addresses: w.accountAddresses ?? [],
    transactionTypes: w.transactionTypes ?? [],
    webhookType: w.webhookType,
  }
}

export async function createAddressWebhook(
  apiKey: string,
  options: CreateWatchOptions,
): Promise<WebhookInfo> {
  const helius = createHelius({ apiKey })
  const req: CreateWebhookRequest = {
    accountAddresses: options.addresses,
    webhookURL: options.webhookUrl,
    webhookType: options.webhookType ?? 'enhanced',
    transactionTypes: options.transactionTypes ?? ['TRANSFER'],
    authHeader: options.authHeader,
  }
  const webhook = await helius.webhooks.create(req)
  return toWebhookInfo(webhook)
}

export async function deleteAddressWebhook(apiKey: string, webhookId: string): Promise<void> {
  const helius = createHelius({ apiKey })
  await helius.webhooks.delete(webhookId)
}

export async function listAddressWebhooks(apiKey: string): Promise<WebhookInfo[]> {
  const helius = createHelius({ apiKey })
  const webhooks = await helius.webhooks.getAll()
  return webhooks.map(toWebhookInfo)
}

export async function updateAddressWebhook(
  apiKey: string,
  webhookId: string,
  updates: Partial<CreateWatchOptions>,
): Promise<WebhookInfo> {
  const helius = createHelius({ apiKey })
  const webhook = await helius.webhooks.update(webhookId, {
    ...(updates.addresses && { accountAddresses: updates.addresses }),
    ...(updates.webhookUrl && { webhookURL: updates.webhookUrl }),
    ...(updates.webhookType && { webhookType: updates.webhookType }),
    ...(updates.transactionTypes && { transactionTypes: updates.transactionTypes }),
  })
  return toWebhookInfo(webhook)
}
