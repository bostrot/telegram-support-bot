import cache from './cache';
import * as db from './db';
import * as middleware from './middleware';
import { Context } from './interfaces';
import * as log from './logger'

/**
 * Records a CSAT rating for a ticket.
 */
export async function recordCSATRating(
    ticketId: number,
    rating: number,
    comment: string = '',
): Promise<void> {
    await db.recordCSAT(ticketId, rating, comment);
}

/**
 * Sends a CSAT survey to the user when their ticket is closed.
 */
export async function sendCSATSurvey(userId: string | number, messenger: string, ticketId: number): Promise<void> {
    if (!cache.config.enable_csat) return;

    const msg = cache.config.language.csatRatingRequest || 'How would you rate your support experience?';

    // Build inline keyboard with star ratings
    const keyboard = {
        parse_mode: cache.config.parse_mode,
        reply_markup: {
            inline_keyboard: [
                [{ text: '⭐', callback_data: `csat:${ticketId}:1` }],
                [{ text: '⭐⭐', callback_data: `csat:${ticketId}:2` }],
                [{ text: '⭐⭐⭐', callback_data: `csat:${ticketId}:3` }],
                [{ text: '⭐⭐⭐⭐', callback_data: `csat:${ticketId}:4` }],
                [{ text: '⭐⭐⭐⭐⭐', callback_data: `csat:${ticketId}:5` }],
            ],
        },
    };

    await middleware.sendMessage(userId, messenger, msg, keyboard);
}

/**
 * Handles CSAT rating callback from user.
 */
export async function handleCSATCallback(ticketId: number, rating: number): Promise<void> {
    await recordCSATRating(ticketId, rating);
}

/**
 * Calculates average first response time in minutes for a given period.
 */
export async function getAverageResponseTime(startDate?: Date, endDate?: Date): Promise<number | null> {
    try {
        const createdEvents = await db.getAnalyticsEvents('ticket_created', startDate, endDate);
        const replyEvents = await db.getAnalyticsEvents('first_reply', startDate, endDate);

        if (createdEvents.length === 0 || replyEvents.length === 0) return null;

        let totalMinutes = 0;
        let count = 0;

        for (const created of createdEvents) {
            const matchingReply = replyEvents.find(
                (r) => r.ticketId === created.ticketId && new Date(r.timestamp) > new Date(created.timestamp),
            );
            if (matchingReply) {
                const diffMs = new Date(matchingReply.timestamp).getTime() - new Date(created.timestamp).getTime();
                totalMinutes += diffMs / 60000;
                count++;
            }
        }

        return count > 0 ? Math.round(totalMinutes / count * 10) / 10 : null;
    } catch (err) {
        log.error('Error calculating average response time:', err);
        return null;
    }
}

/**
 * Calculates average resolution time in minutes for a given period.
 */
export async function getAverageResolutionTime(startDate?: Date, endDate?: Date): Promise<number | null> {
    try {
        const createdEvents = await db.getAnalyticsEvents('ticket_created', startDate, endDate);
        const closedEvents = await db.getAnalyticsEvents('ticket_closed', startDate, endDate);

        if (createdEvents.length === 0 || closedEvents.length === 0) return null;

        let totalMinutes = 0;
        let count = 0;

        for (const created of createdEvents) {
            const matchingClosed = closedEvents.find(
                (c) => c.ticketId === created.ticketId && new Date(c.timestamp) > new Date(created.timestamp),
            );
            if (matchingClosed) {
                const diffMs = new Date(matchingClosed.timestamp).getTime() - new Date(created.timestamp).getTime();
                totalMinutes += diffMs / 60000;
                count++;
            }
        }

        return count > 0 ? Math.round(totalMinutes / count * 10) / 10 : null;
    } catch (err) {
        log.error('Error calculating average resolution time:', err);
        return null;
    }
}

/**
 * Gets the average CSAT rating for a given period.
 */
export async function getAverageCSAT(startDate?: Date, endDate?: Date): Promise<number | null> {
    try {
        const events = await db.getAnalyticsEvents('csat.rated', startDate, endDate);
        if (events.length === 0) return null;

        const totalRating = events.reduce((sum, e) => sum + (e.metadata?.rating || 0), 0);
        return Math.round(totalRating / events.length * 10) / 10;
    } catch (err) {
        log.error('Error calculating average CSAT:', err);
        return null;
    }
}

/**
 * Gets ticket count for a given period.
 */
export async function getTicketCount(startDate?: Date, endDate?: Date): Promise<number> {
    try {
        const events = await db.getAnalyticsEvents('ticket_created', startDate, endDate);
        return events.length;
    } catch (err) {
        log.error('Error getting ticket count:', err);
        return 0;
    }
}

/**
 * Gets per-agent statistics for a given period.
 */
export async function getAgentStats(startDate?: Date, endDate?: Date): Promise<Array<{ agent_id: string; ticketsResolved: number; avgResponseTime: number | null }>> {
    try {
        const replyEvents = await db.getAnalyticsEvents('staff_reply', startDate, endDate);
        const closedEvents = await db.getAnalyticsEvents('ticket_closed', startDate, endDate);

        const agentMap = new Map<string, { ticketsResolved: number; responseTimes: number[] }>();

        for (const event of replyEvents) {
            if (!event.agent_id) continue;
            if (!agentMap.has(event.agent_id)) {
                agentMap.set(event.agent_id, { ticketsResolved: 0, responseTimes: [] });
            }
        }

        for (const event of closedEvents) {
            if (!event.agent_id) continue;
            const stats = agentMap.get(event.agent_id);
            if (stats) {
                stats.ticketsResolved++;
            } else {
                agentMap.set(event.agent_id, { ticketsResolved: 1, responseTimes: [] });
            }
        }

        return Array.from(agentMap.entries()).map(([agentId, stats]) => ({
            agent_id: agentId,
            ticketsResolved: stats.ticketsResolved,
            avgResponseTime: null, // TODO: calculate from first_reply events per agent
        }));
    } catch (err) {
        log.error('Error getting agent stats:', err);
        return [];
    }
}

/**
 * Generates a daily summary message for the staff chat.
 */
export async function generateDailySummary(): Promise<string> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const todayCount = await getTicketCount(new Date(now.toDateString()), now);
    const weekCount = await getTicketCount(weekAgo, now);
    const avgResponseTime = await getAverageResponseTime(weekAgo, now);
    const avgResolutionTime = await getAverageResolutionTime(weekAgo, now);
    const avgCSAT = await getAverageCSAT(weekAgo, now);

    let summary = `📊 *Daily Support Summary*\n\n`;
    summary += `📋 Tickets today: ${todayCount}\n`;
    summary += `📈 Tickets this week: ${weekCount}\n`;

    if (avgResponseTime !== null) {
        summary += `⏱️ Avg first response: ${avgResponseTime} min\n`;
    }
    if (avgResolutionTime !== null) {
        summary += `✅ Avg resolution: ${Math.round(avgResolutionTime / 60)}h ${Math.round(avgResolutionTime % 60)}m\n`;
    }
    if (avgCSAT !== null) {
        summary += `⭐ CSAT score: ${avgCSAT}/5.0\n`;
    }

    return summary;
}

/**
 * Sends the daily summary to the staff chat.
 */
export async function sendDailySummary(): Promise<void> {
    try {
        const summary = await generateDailySummary();
        await middleware.sendMessage(
            cache.config.staffchat_id,
            cache.config.staffchat_type,
            summary,
            { parse_mode: cache.config.parse_mode },
        );
        log.info('Daily summary sent to staff chat.');
    } catch (err) {
        log.error('Error sending daily summary:', err);
    }
}

/**
 * Shows analytics stats command for staff.
 */
export async function showStatsCommand(ctx: Context): Promise<void> {
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const todayCount = await getTicketCount(new Date(new Date().toDateString()), new Date());
    const weekCount = await getTicketCount(weekAgo, new Date());
    const avgResponseTime = await getAverageResponseTime(weekAgo, new Date());
    const avgCSAT = await getAverageCSAT(weekAgo, new Date());

    let stats = `📊 *Support Stats (last 7 days)*\n\n`;
    stats += `📋 Tickets today: ${todayCount}\n`;
    stats += `📈 Tickets this week: ${weekCount}\n`;

    if (avgResponseTime !== null) {
        stats += `⏱️ Avg first response: ${avgResponseTime} min\n`;
    }
    if (avgCSAT !== null) {
        stats += `⭐ CSAT score: ${avgCSAT}/5.0\n`;
    }

    middleware.reply(ctx, stats, { parse_mode: cache.config.parse_mode });
}
