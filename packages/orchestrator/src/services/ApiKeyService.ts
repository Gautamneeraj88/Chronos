import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { ApiKeyModel } from '../models/apiKey.model';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');
const SALT_ROUNDS = 10;
const KEY_PREFIX = 'chron_live_';

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

    await ApiKeyModel.create({ key: hashed, orgId, userId, name });
    logger.info('API key created', { orgId, userId, name });

    return { rawKey: raw, orgId, userId, name };
  }

  async validate(rawKey: string): Promise<ValidatedApiKey | null> {
    // bcrypt.compare must check every active key — this is intentionally O(n).
    // For high volume, move to a prefix-indexed approach (store key prefix unencrypted).
    const keys = await ApiKeyModel.find({ isActive: true });

    for (const record of keys) {
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
