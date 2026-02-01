import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import crypto from 'crypto';

const vaultUrl = process.env.AZURE_KEY_VAULT_URL;
const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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

// ============== PIN MANAGEMENT ==============

// Hash PIN with user-specific salt
function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex');
}

// Get PIN secret name for user
function getPinSecretName(userId: string): string {
  return `${userId}-system-pin`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .substring(0, 127);
}

// Get lockout secret name for user
function getLockoutSecretName(userId: string): string {
  return `${userId}-system-lockout`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .substring(0, 127);
}

// Save or update user's PIN
export async function saveUserPin(userId: string, pin: string): Promise<void> {
  const client = getClient();
  const secretName = getPinSecretName(userId);
  
  // Validate PIN format (4-6 digits)
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits');
  }
  
  // Generate salt and hash
  const salt = crypto.randomBytes(32).toString('hex');
  const hashedPin = hashPin(pin, salt);
  
  await client.setSecret(secretName, JSON.stringify({ hash: hashedPin, salt }), {
    tags: {
      userId: Buffer.from(userId).toString('base64'),
      type: 'pin',
      createdAt: new Date().toISOString(),
    },
  });
  
  // Clear any lockout when PIN is set/updated
  await clearUserLockout(userId);
}

// Check if user has a PIN set
export async function hasUserPin(userId: string): Promise<boolean> {
  const client = getClient();
  const secretName = getPinSecretName(userId);
  
  try {
    await client.getSecret(secretName);
    return true;
  } catch (error: unknown) {
    const azureError = error as { code?: string; statusCode?: number };
    if (azureError.code === 'SecretNotFound' || azureError.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

// Get lockout status
async function getLockoutStatus(userId: string): Promise<{ locked: boolean; attemptsLeft: number; unlockTime?: Date }> {
  const client = getClient();
  const secretName = getLockoutSecretName(userId);
  
  try {
    const secret = await client.getSecret(secretName);
    if (!secret.value) {
      return { locked: false, attemptsLeft: MAX_PIN_ATTEMPTS };
    }
    
    const lockoutData = JSON.parse(secret.value);
    const now = Date.now();
    
    // Check if lockout has expired
    if (lockoutData.lockedUntil && now < lockoutData.lockedUntil) {
      return { 
        locked: true, 
        attemptsLeft: 0, 
        unlockTime: new Date(lockoutData.lockedUntil) 
      };
    }
    
    // Lockout expired, reset
    if (lockoutData.lockedUntil && now >= lockoutData.lockedUntil) {
      await clearUserLockout(userId);
      return { locked: false, attemptsLeft: MAX_PIN_ATTEMPTS };
    }
    
    return { 
      locked: false, 
      attemptsLeft: MAX_PIN_ATTEMPTS - (lockoutData.failedAttempts || 0) 
    };
  } catch (error: unknown) {
    const azureError = error as { code?: string; statusCode?: number };
    if (azureError.code === 'SecretNotFound' || azureError.statusCode === 404) {
      return { locked: false, attemptsLeft: MAX_PIN_ATTEMPTS };
    }
    throw error;
  }
}

// Record failed attempt
async function recordFailedAttempt(userId: string): Promise<{ locked: boolean; attemptsLeft: number; unlockTime?: Date }> {
  const client = getClient();
  const secretName = getLockoutSecretName(userId);
  
  let lockoutData = { failedAttempts: 0, lockedUntil: null as number | null };
  
  try {
    const existing = await client.getSecret(secretName);
    if (existing.value) {
      lockoutData = JSON.parse(existing.value);
    }
  } catch {
    // No existing lockout data
  }
  
  lockoutData.failedAttempts = (lockoutData.failedAttempts || 0) + 1;
  
  // Lock out after max attempts
  if (lockoutData.failedAttempts >= MAX_PIN_ATTEMPTS) {
    lockoutData.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  
  await client.setSecret(secretName, JSON.stringify(lockoutData), {
    tags: {
      userId: Buffer.from(userId).toString('base64'),
      type: 'lockout',
    },
  });
  
  if (lockoutData.lockedUntil) {
    return { 
      locked: true, 
      attemptsLeft: 0, 
      unlockTime: new Date(lockoutData.lockedUntil) 
    };
  }
  
  return { 
    locked: false, 
    attemptsLeft: MAX_PIN_ATTEMPTS - lockoutData.failedAttempts 
  };
}

// Clear lockout
async function clearUserLockout(userId: string): Promise<void> {
  const client = getClient();
  const secretName = getLockoutSecretName(userId);
  
  try {
    await client.beginDeleteSecret(secretName);
  } catch {
    // Ignore if doesn't exist
  }
}

// Verify user's PIN
export async function verifyUserPin(userId: string, pin: string): Promise<{ 
  valid: boolean; 
  locked: boolean; 
  attemptsLeft: number;
  unlockTime?: Date;
  error?: string;
}> {
  // Check lockout first
  const lockoutStatus = await getLockoutStatus(userId);
  if (lockoutStatus.locked) {
    return { 
      valid: false, 
      locked: true, 
      attemptsLeft: 0,
      unlockTime: lockoutStatus.unlockTime,
      error: `Too many failed attempts. Try again after ${lockoutStatus.unlockTime?.toLocaleTimeString()}`
    };
  }
  
  const client = getClient();
  const secretName = getPinSecretName(userId);
  
  try {
    const secret = await client.getSecret(secretName);
    if (!secret.value) {
      return { valid: false, locked: false, attemptsLeft: lockoutStatus.attemptsLeft, error: 'No PIN set' };
    }
    
    const { hash, salt } = JSON.parse(secret.value);
    const inputHash = hashPin(pin, salt);
    
    if (inputHash === hash) {
      // Clear failed attempts on success
      await clearUserLockout(userId);
      return { valid: true, locked: false, attemptsLeft: MAX_PIN_ATTEMPTS };
    }
    
    // Record failed attempt
    const newStatus = await recordFailedAttempt(userId);
    return { 
      valid: false, 
      locked: newStatus.locked,
      attemptsLeft: newStatus.attemptsLeft,
      unlockTime: newStatus.unlockTime,
      error: newStatus.locked 
        ? `Too many failed attempts. Try again in 15 minutes.`
        : `Incorrect PIN. ${newStatus.attemptsLeft} attempts remaining.`
    };
  } catch (error: unknown) {
    const azureError = error as { code?: string; statusCode?: number };
    if (azureError.code === 'SecretNotFound' || azureError.statusCode === 404) {
      return { valid: false, locked: false, attemptsLeft: MAX_PIN_ATTEMPTS, error: 'No PIN set' };
    }
    throw error;
  }
}

// Get unmasked secret value after PIN verification
export async function getSecretWithPin(
  userId: string,
  pin: string,
  category: SecretCategory,
  key: string
): Promise<{ 
  success: boolean; 
  value?: string; 
  error?: string;
  locked?: boolean;
  attemptsLeft?: number;
}> {
  // Verify PIN first
  const pinResult = await verifyUserPin(userId, pin);
  
  if (!pinResult.valid) {
    return { 
      success: false, 
      error: pinResult.error,
      locked: pinResult.locked,
      attemptsLeft: pinResult.attemptsLeft,
    };
  }
  
  // PIN valid, get the actual secret
  const value = await getSecret(userId, category, key);
  
  if (!value) {
    return { success: false, error: 'Secret not found' };
  }
  
  return { success: true, value };
}
