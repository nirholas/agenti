/**
 * Shared KV-backed Secret Service
 * Single source of truth for storing/listing/retrieving secrets, scoped by userScopeId (urlSafeId)
 */

export interface SecretRecord {
  id: string;
  secret: string;
  amount: string;
  description: string;
  createdAt: number;
  retrievalCount: number;
}

export interface SecretServiceDeps {
  kv: KVNamespace;
}

export interface StoreSecretInput {
  userScopeId: string; // urlSafeId used to scope keys
  secret: string;
  amount: string; // USD (string) – pricing logic enforced by Host MCP
  description: string;
}

export interface ListSecretsInput {
  userScopeId: string;
}

export interface RetrieveSecretInput {
  userScopeId: string;
  secretId: string;
}

export function createSecretService({ kv }: SecretServiceDeps) {
  const keyFor = (userScopeId: string, secretId: string) => `${userScopeId}:secrets:${secretId}`;

  return {
    /**
     * Store a secret scoped to the user's Durable Object instance
     */
    async storeSecret({ userScopeId, secret, amount, description }: StoreSecretInput) {
      const secretId = crypto.randomUUID();
      const record: SecretRecord = {
        id: secretId,
        secret,
        amount,
        description,
        createdAt: Date.now(),
        retrievalCount: 0
      };

      await kv.put(keyFor(userScopeId, secretId), JSON.stringify(record));

      return record;
    },

    /**
     * List secret metadata only (no secret value)
     */
    async listSecrets({ userScopeId }: ListSecretsInput) {
      const prefix = `${userScopeId}:secrets:`;
      const keys = await kv.list({ prefix });
      const items = await Promise.all(
        keys.keys.map(async (k) => {
          const data = await kv.get(k.name);
          if (!data) return null;
          const record = JSON.parse(data) as SecretRecord;
          return {
            id: record.id,
            amount: record.amount,
            retrievalCount: record.retrievalCount,
            createdAt: new Date(record.createdAt).toISOString()
          };
        })
      );

      return items.filter(Boolean) as Array<{
        id: string;
        amount: string;
        retrievalCount: number;
        createdAt: string;
      }>;
    },

    /**
     * Retrieve a secret by id and increment retrieval count
     */
    async retrieveSecret({ userScopeId, secretId }: RetrieveSecretInput) {
      const key = keyFor(userScopeId, secretId);
      const data = await kv.get(key);
      if (!data) return null;

      const record = JSON.parse(data) as SecretRecord;
      record.retrievalCount += 1;
      await kv.put(key, JSON.stringify(record));

      return record;
    }
  } as const;
}


