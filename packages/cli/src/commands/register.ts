const X402_REGISTRY_URL = 'https://x402scan.com/api/x402/registry/register-origin'

export interface RegisterOptions {
  name?: string
  description?: string
}

export async function runRegister(url: string, options: RegisterOptions): Promise<void> {
  console.log(`Registering ${url} with x402scan...`)

  const payload: Record<string, string> = { origin: url }
  if (options.name) payload['name'] = options.name
  if (options.description) payload['description'] = options.description

  const res = await fetch(X402_REGISTRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Registry returned ${res.status}: ${body}`)
  }

  const data = (await res.json()) as Record<string, unknown>
  console.log('Registered successfully:')
  console.log(JSON.stringify(data, null, 2))
}
