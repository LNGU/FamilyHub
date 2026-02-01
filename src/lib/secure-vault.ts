import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const vaultUrl = process.env.AZURE_KEY_VAULT_URL;

// Lazy initialization to avoid errors when env var is not set during build
let _client: SecretClient | null = null;

function getClient(): SecretClient {
  if (!_client) {
    if (!vaultUrl) {
      throw new Error('AZURE_KEY_VAULT_URL environment variable is not set');
    }
    // DefaultAzureCredential automatically uses Managed Identity in Azure,
    // falls back to VS Code/CLI credentials locally
    const credential = new DefaultAzureCredential();
    _client = new SecretClient(vaultUrl, credential);
  }
  return _client;
}

export type SecretCategory = 'financial' | 'identity' | 'medical';

// Secret names are sanitized: user-email-category-key
function getSecretName(userId: string, category: string, key: string): string {
  const sanitized = `${userId}-${category}-${key}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .substring(0, 127); // Key Vault name limit
  return sanitized;
}

export async function saveSecret(
  userId: string,
  category: SecretCategory,
  key: string,
  value: string,
  metadata?: Record<string, string>
): Promise<void> {
  const client = getClient();
  const secretName = getSecretName(userId, category, key);
  
  await client.setSecret(secretName, value, {
    tags: {
      userId: Buffer.from(userId).toString('base64'), // Obfuscate email in tags
      category,
      key,
      createdAt: new Date().toISOString(),
      ...metadata,
    },
  });
}

export async function getSecret(
  userId: string,
  category: SecretCategory,
  key: string
): Promise<string | null> {
  const client = getClient();
  const secretName = getSecretName(userId, category, key);
  
  try {
    const secret = await client.getSecret(secretName);
    return secret.value || null;
  } catch (error: unknown) {
    const azureError = error as { code?: string; statusCode?: number };
    if (azureError.code === 'SecretNotFound' || azureError.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

export async function deleteSecret(
  userId: string,
  category: SecretCategory,
  key: string
): Promise<void> {
  const client = getClient();
  const secretName = getSecretName(userId, category, key);
  await client.beginDeleteSecret(secretName);
}

// Get masked versions for AI context (never expose full values)
export async function getSecretsMasked(userId: string): Promise<Array<{
  category: string;
  key: string;
  maskedValue: string;
  createdAt: string;
}>> {
  const client = getClient();
  const secrets: Array<{ category: string; key: string; maskedValue: string; createdAt: string }> = [];
  const userIdBase64 = Buffer.from(userId).toString('base64');
  
  try {
    // List all secrets and filter by user
    for await (const secretProperties of client.listPropertiesOfSecrets()) {
      if (secretProperties.tags?.userId === userIdBase64) {
        const value = await getSecret(
          userId,
          secretProperties.tags.category as SecretCategory,
          secretProperties.tags.key
        );
        
        secrets.push({
          category: secretProperties.tags.category,
          key: secretProperties.tags.key,
          maskedValue: maskValue(secretProperties.tags.key, value || ''),
          createdAt: secretProperties.tags.createdAt || '',
        });
      }
    }
  } catch (error) {
    console.error('Error listing secrets from Key Vault:', error);
    // Return empty array rather than failing - allows app to work without vault
  }
  
  return secrets;
}

// Mask sensitive values appropriately based on the key name
function maskValue(key: string, value: string): string {
  const lowerKey = key.toLowerCase();
  
  // SSN: XXX-XX-1234
  if (lowerKey.includes('ssn') || lowerKey.includes('social')) {
    return value.length >= 4 ? `XXX-XX-${value.slice(-4)}` : '****';
  }
  
  // Bank accounts: ****1234
  if (lowerKey.includes('account') || lowerKey.includes('routing')) {
    return value.length >= 4 ? `****${value.slice(-4)}` : '****';
  }
  
  // Credit cards: ****-****-****-1234
  if (lowerKey.includes('card')) {
    return value.length >= 4 ? `****-****-****-${value.slice(-4)}` : '****';
  }
  
  // Passwords/PINs: completely masked
  if (lowerKey.includes('password') || lowerKey.includes('pin')) {
    return '********';
  }
  
  // Default: show first and last char
  return value.length > 2 ? `${value[0]}${'*'.repeat(value.length - 2)}${value.slice(-1)}` : '****';
}
