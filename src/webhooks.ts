import axios from 'axios';
import cache from './cache';
import * as log from 'fancy-log'
import { WebhookEvent } from './interfaces';

export interface WebhookPayload {
    event: string;
    ticket_id: number;
    user_id: string | null;
    timestamp: string;
    message_preview?: string;
    metadata?: Record<string, any>;
}

/**
 * Sends a webhook event to all configured URLs that subscribe to the given event.
 */
export async function sendWebhook(
    event: WebhookEvent | string,
    ticketId: number,
    userId: string | null = null,
    messagePreview: string = '',
    metadata: Record<string, any> = {},
): Promise<void> {
    const webhooks = cache.config.webhooks || [];
    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
        event,
        ticket_id: ticketId,
        user_id: userId,
        timestamp: new Date().toISOString(),
        message_preview: messagePreview.substring(0, 200),
        metadata,
    };

    for (const webhook of webhooks) {
        if (!webhook.events.includes(event as WebhookEvent)) continue;

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'telegram-support-bot/5.0',
            };

            // Add HMAC signature if secret is configured
            if (webhook.secret) {
                const crypto = await import('crypto');
                const sig = crypto.createHmac('sha256', webhook.secret)
                    .update(JSON.stringify(payload))
                    .digest('hex');
                headers['X-TSB-Signature'] = sig;
            }

            await axios.post(webhook.url, payload, {
                headers,
                timeout: 5000,
            });

            log.info(`Webhook sent to ${webhook.url} for event ${event}`);
        } catch (err) {
            log.error(`Webhook failed for ${webhook.url}:`, err);
        }
    }
}

/**
 * Convenience wrapper for common webhook events.
 */
export const webhooks = {
    ticketCreated: async (ticketId: number, userId: string, messagePreview?: string) => {
        await sendWebhook('ticket.created', ticketId, userId, messagePreview || '');
    },
    ticketReplied: async (ticketId: number, agentId: string, messagePreview?: string) => {
        await sendWebhook('ticket.replied', ticketId, null, messagePreview || '', { agent_id: agentId });
    },
    ticketClosed: async (ticketId: number, userId: string) => {
        await sendWebhook('ticket.closed', ticketId, userId);
    },
    ticketBanned: async (ticketId: number, userId: string) => {
        await sendWebhook('ticket.banned', ticketId, userId);
    },
    csatRated: async (ticketId: number, rating: number, comment?: string) => {
        await sendWebhook('csat.rated', ticketId, null, '', { rating, comment });
    },
    ticketEscalated: async (ticketId: number, reason: string) => {
        await sendWebhook('ticket.escalated', ticketId, null, '', { reason });
    },
};
