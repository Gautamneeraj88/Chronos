import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { ApiKeyModel } from '../models/apiKey.model';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');
const SALT_ROUNDS = 10;
const KEY_PREFIX = 'chron_live_';
// Number of random chars to store as a plaintext prefix for O(1) DB filtering.
// Position: KEY_PREFIX.length … KEY_PREFIX.length + PREFIX_LEN (into the random hex part).
// With 8 hex chars (32-bit space) the chance of two keys sharing a prefix is ~1 in 4 billion.
const PREFIX_LEN = 8;

function extractPrefix(rawKey: string): string {
  return rawKey.substring(KEY_PREFIX.length, KEY_PREFIX.length + PREFIX_LEN);
}

export interface CreatedApiKey {
  rawKey: string;   // returned ONCE — never stored in plaintext
  orgId: string;
  userId: string;
  name: string;
}

export interface ValidatedApiKey {
  orgId: string;
  userId: string;
}

export class ApiKeyService {
  async create(orgId: string, userId: string, name: string): Promise<CreatedApiKey> {
    const raw = KEY_PREFIX + randomBytes(24).toString('hex');
    const hashed = await bcrypt.hash(raw, SALT_ROUNDS);

    await ApiKeyModel.create({ key: hashed, keyPrefix: extractPrefix(raw), orgId, userId, name });
    logger.info('API key created', { orgId, userId, name });

    return { rawKey: raw, orgId, userId, name };
  }

  async validate(rawKey: string): Promise<ValidatedApiKey | null> {
    // Filter by keyPrefix first (indexed, instant) then bcrypt only the matching candidates.
    // In practice this always returns ≤1 record, making this effectively O(1).
    const candidates = await ApiKeyModel.find({
      isActive: true,
      keyPrefix: extractPrefix(rawKey),
    });

    for (const record of candidates) {
      const matches = await bcrypt.compare(rawKey, record.key);
      if (matches) {
        // Update lastUsedAt asynchronously — don't block the auth response
        ApiKeyModel.updateOne({ _id: record._id }, { lastUsedAt: new Date() }).catch(() => {});
        return { orgId: record.orgId, userId: record.userId };
      }
    }

    return null;
  }
}
