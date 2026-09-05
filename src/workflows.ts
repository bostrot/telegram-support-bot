import cache from './cache';
import * as db from './db';
import * as middleware from './middleware';
import { Context } from './interfaces';
import * as log from './logger'

/**
 * Checks if the current time is within business hours.
 */
export function isWithinBusinessHours(): boolean {
    const bh = cache.config.web_chat?.business_hours;
    if (!bh || !bh.enabled) return true; // No business hours configured = always open

    const now = new Date();
    const timezone = bh.timezone || 'UTC';

    // Get current time in the configured timezone
    const nowStr = now.toLocaleString('en-US', { timeZone: timezone });
    const localTime = new Date(nowStr);
    const hours = localTime.getHours();
    const minutes = localTime.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;

    // Parse start and end times
    const [startH, startM] = bh.start.split(':').map(Number);
    const [endH, endM] = bh.end.split(':').map(Number);
    const startTimeInMinutes = startH * 60 + (startM || 0);
    const endTimeInMinutes = endH * 60 + (endM || 0);

    if (startTimeInMinutes < endTimeInMinutes) {
        return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    } else {
        // Handles overnight hours (e.g., 22:00 - 06:00)
        return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    }
}

/**
 * Checks for auto-escalation rules and applies them.
 */
export async function checkEscalation(ticketId: number): Promise<void> {
    const rules = cache.config.escalation_rules || [];
    if (rules.length === 0) return;

    const ticket = await db.getTicketById(ticketId, null);
    if (!ticket) return;

    // Use first_response_at or fallback to analytics event for creation time
    let createdAt: Date | null = ticket.first_response_at;
    if (!createdAt) {
      const createdEvents = await db.getAnalyticsEvents('ticket_created');
      const ticketCreated = createdEvents.find((e: any) => e.ticketId === ticketId);
      if (ticketCreated) {
        createdAt = new Date(ticketCreated.timestamp);
      }
    }
    if (!createdAt) return;

    for (const rule of rules) {
        const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreated >= rule.after_hours && !ticket.assigned_to) {
            switch (rule.action) {
                case 'notify_supervisor':
                    // Find supervisors and notify them
                    for (const [id, member] of cache.staffMembers) {
                        if (member.role === 'supervisor') {
                            await middleware.sendMessage(
                                id,
                                cache.config.staffchat_type,
                                `${cache.config.language.escalationNotify} ${rule.after_hours}h — Ticket #T${ticketId.toString().padStart(6, '0')}`,
                                { parse_mode: cache.config.parse_mode },
                            );
                        }
                    }
                    await db.recordAnalyticsEvent('ticket_escalated', ticketId, null, { reason: `no_response_${rule.after_hours}h` });
                    break;

                case 'tag_urgent':
                    await db.setPriority(ticketId, 'urgent' as any);
                    await db.addTags(ticketId, ['auto-escalated']);
                    await db.recordAnalyticsEvent('ticket_escalated', ticketId, null, { reason: `auto_tag_${rule.after_hours}h` });
                    break;
            }
        }
    }
}

/**
 * Checks for auto-close on inactivity and closes eligible tickets.
 */
export async function checkAutoClose(): Promise<void> {
    const days = cache.config.auto_close_after_days || 0;
    if (days <= 0) return;

    try {
        const cutoffDate = new Date(Date.now() - days * 86400000);
        const openTickets = await db.Supportee.find({ status: 'open' });

        for (const ticket of openTickets) {
            // Check if there's been recent activity
            const messages = await db.TicketMessage.find({ ticketId: ticket.ticketId })
                .sort({ timestamp: -1 })
                .limit(1);

            if (messages.length === 0 || new Date(messages[0].timestamp) < cutoffDate) {
                await db.add(ticket.userid, 'closed', ticket.category, ticket.messenger);
                await db.setClosedAt(ticket.ticketId);
                await db.recordAnalyticsEvent('ticket_closed', ticket.ticketId, null, { reason: 'auto_close_inactivity' });

                // Notify user
                const msg = `${cache.config.language.ticket} #T${ticket.ticketId.toString().padStart(6, '0')} ${cache.config.language.closed}\n\nYour ticket was auto-closed due to inactivity (${days} days). You can open a new ticket at any time.`;
                await middleware.sendMessage(ticket.userid, ticket.messenger, msg);

                log.info(`Auto-closed ticket #T${ticket.ticketId} (inactivity ${days}d)`);
            }
        }
    } catch (err) {
        log.error('Error in auto-close check:', err);
    }
}

/**
 * Gets a canned response by key.
 */
export function getCannedResponse(key: string): string | null {
    const responses = cache.config.canned_responses || [];
    const found = responses.find((r) => r.key.toLowerCase() === key.toLowerCase());
    return found ? found.text : null;
}

/**
 * Lists all available canned response keys.
 */
export function listCannedResponses(): string {
    const responses = cache.config.canned_responses || [];
    if (responses.length === 0) return 'No canned responses configured.';

    let output = '*Available templates:*\n\n';
    for (const resp of responses) {
        output += `/${resp.key} — ${resp.text.substring(0, 50)}${resp.text.length > 50 ? '...' : ''}\n`;
    }
    return output;
}

/**
 * Handles canned response command. Staff types /template_key to insert the template text.
 */
export async function handleCannedResponse(ctx: Context, key: string): Promise<string | null> {
    const text = getCannedResponse(key);
    if (!text) return null;
    return text;
}

/**
 * Runs periodic workflow checks (auto-close, escalation).
 * Should be called from a setInterval in the main index.ts.
 */
export async function runWorkflowChecks(): Promise<void> {
    await checkAutoClose();
    log.info('Workflow checks completed.');
}
