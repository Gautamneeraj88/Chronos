import { WebhookModel } from '../models/webhook.model';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');

export interface WebhookSummary {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
  secret?: string;
}

export class WebhookService {
  async list(orgId: string): Promise<WebhookSummary[]> {
    const records = await WebhookModel.find({ orgId }).sort({ createdAt: -1 });
    return records.map(this.toSummary);
  }

  async create(orgId: string, input: CreateWebhookInput): Promise<WebhookSummary> {
    const record = await WebhookModel.create({
      orgId,
      url: input.url,
      events: input.events,
      secret: input.secret ?? null,
    });
    logger.info('Webhook created', { orgId, url: input.url });
    return this.toSummary(record);
  }

  async delete(id: string, orgId: string): Promise<boolean> {
    const result = await WebhookModel.deleteOne({ _id: id, orgId });
    logger.info('Webhook deleted', { id, orgId });
    return result.deletedCount > 0;
  }

  /** Fetch all active webhooks for an org — used by the notifier dispatcher. */
  async listActive(orgId: string): Promise<WebhookSummary[]> {
    const records = await WebhookModel.find({ orgId, isActive: true });
    return records.map(this.toSummary);
  }

  private toSummary(r: InstanceType<typeof WebhookModel>): WebhookSummary {
    return {
      id: (r._id as { toString(): string }).toString(),
      orgId: r.orgId,
      url: r.url,
      events: r.events,
      secret: r.secret,
      isActive: r.isActive,
      failureCount: r.failureCount,
      lastTriggeredAt: r.lastTriggeredAt ? r.lastTriggeredAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
