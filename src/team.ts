import { Context } from './interfaces';
import cache from './cache';
import * as db from './db';
import * as middleware from './middleware';
import * as log from 'fancy-log'

/**
 * Initializes staff member cache from config on startup.
 */
export function initStaffCache(): void {
    const staffRoles = cache.config.staff_roles || [];
    cache.staffMembers = new Map();
    cache.mutedTickets = new Set();

    for (const member of staffRoles) {
        cache.staffMembers.set(member.telegram_id, member);
    }

    log.info(`Loaded ${cache.staffMembers.size} staff members from config.`);
}

/**
 * Gets the role of a staff member by their Telegram ID.
 */
export function getStaffRole(telegramId: string): 'admin' | 'supervisor' | 'agent' | null {
    const member = cache.staffMembers.get(telegramId);
    if (!member) return null;
    return member.role as 'admin' | 'supervisor' | 'agent';
}

/**
 * Checks if a user has permission to perform an action.
 */
export function canPerformAction(
    telegramId: string,
    action: 'reply' | 'assign' | 'view_analytics' | 'manage_team',
): boolean {
    const role = getStaffRole(telegramId);

    switch (action) {
        case 'reply':
            return ['admin', 'supervisor', 'agent'].includes(role || '');
        case 'assign':
            return ['admin', 'supervisor'].includes(role || '');
        case 'view_analytics':
            return ['admin', 'supervisor'].includes(role || '');
        case 'manage_team':
            return role === 'admin';
        default:
            return false;
    }
}

/**
 * Assigns a ticket to a specific staff member.
 */
export async function assignTicketCommand(ctx: Context, targetId: string, ticketId: number): Promise<void> {
    const role = getStaffRole(targetId);
    if (!role) {
        middleware.reply(ctx, `User ${targetId} is not a registered staff member.`);
        return;
    }

    await db.assignTicket(ticketId, targetId);

    const member = cache.staffMembers.get(targetId);
    const memberName = member?.name || targetId;
    middleware.reply(ctx, `${cache.config.language.ticketAssignedTo} ${memberName}`);

    // Notify the assigned agent
    if (targetId !== ctx.from.id) {
        middleware.sendMessage(
            targetId,
            cache.config.staffchat_type,
            `📋 You have been assigned ticket #T${ticketId.toString().padStart(6, '0')} by ${ctx.message?.from?.first_name || 'staff'}.`,
            { parse_mode: cache.config.parse_mode },
        ).catch(log.error);
    }

    await db.recordAnalyticsEvent('ticket.assigned', ticketId, targetId, { assigned_by: ctx.from.id });
}

/**
 * Unassigns a ticket from its current assignee.
 */
export async function unassignTicketCommand(ctx: Context, ticketId: number): Promise<void> {
    await db.unassignTicket(ticketId);
    middleware.reply(ctx, cache.config.language.ticketUnassigned);
}

/**
 * Adds tags to a ticket.
 */
export async function addTagsCommand(ctx: Context, ticketId: number, tags: string[]): Promise<void> {
    await db.addTags(ticketId, tags);
    middleware.reply(ctx, `Tags added: ${tags.join(', ')}`);
}

/**
 * Removes a tag from a ticket.
 */
export async function removeTagCommand(ctx: Context, ticketId: number, tag: string): Promise<void> {
    await db.removeTag(ticketId, tag);
    middleware.reply(ctx, `Tag removed: ${tag}`);
}

/**
 * Sets the priority of a ticket.
 */
export async function setPriorityCommand(
    ctx: Context,
    ticketId: number,
    priority: 'low' | 'normal' | 'high' | 'urgent',
): Promise<void> {
    await db.setPriority(ticketId, priority as any);

    const icons: Record<string, string> = { urgent: '🔴', high: '🟠', normal: '🟡', low: '⚪' };
    middleware.reply(ctx, `${icons[priority]} Priority set to ${priority.toUpperCase()}`);
}

/**
 * Mutes notifications for a ticket.
 */
export async function muteTicketCommand(ctx: Context, ticketId: number): Promise<void> {
    cache.mutedTickets.add(ticketId.toString());
    middleware.reply(ctx, `🔇 Ticket #T${ticketId.toString().padStart(6, '0')} muted.`);
}

/**
 * Unmutes notifications for a ticket.
 */
export async function unmuteTicketCommand(ctx: Context, ticketId: number): Promise<void> {
    cache.mutedTickets.delete(ticketId.toString());
    middleware.reply(ctx, `🔊 Ticket #T${ticketId.toString().padStart(6, '0')} unmuted.`);
}

/**
 * Adds an internal note to a ticket (not forwarded to user).
 */
export async function addInternalNoteCommand(ctx: Context, ticketId: number, text: string): Promise<void> {
    await db.addInternalNote(ticketId, ctx.from.id.toString(), text);

    // Show note in staff chat
    const esc = middleware.strictEscape;
    middleware.sendMessage(
        cache.config.staffchat_id,
        cache.config.staffchat_type,
        `📝 ${cache.config.language.internalNote} #T${ticketId.toString().padStart(6, '0')} (${cache.config.language.noteAddedBy} ${esc(ctx.message?.from?.first_name || 'staff')}):\n${esc(text)}`,
        { parse_mode: cache.config.parse_mode },
    ).catch(log.error);

    await db.recordAnalyticsEvent('internal_note', ticketId, ctx.from.id.toString());
}

/**
 * Shows all internal notes for a ticket.
 */
export async function showNotesCommand(ctx: Context, ticketId: number): Promise<void> {
    const notes = await db.getInternalNotes(ticketId);
    if (notes.length === 0) {
        middleware.reply(ctx, `No internal notes for ticket #T${ticketId.toString().padStart(6, '0')}.`);
        return;
    }

    const esc = middleware.strictEscape;
    let output = `📝 ${cache.config.language.internalNote} #T${ticketId.toString().padStart(6, '0')}:\n\n`;
    for (const note of notes) {
        const author = cache.staffMembers.get(note.author_id);
        const authorName = author?.name || note.author_id;
        output += `• [${authorName}] ${esc(note.text)}\n`;
    }

    middleware.reply(ctx, output.trim());
}

/**
 * Lists all staff members and their roles.
 */
export async function listStaffCommand(ctx: Context): Promise<void> {
    if (cache.staffMembers.size === 0) {
        middleware.reply(ctx, 'No staff members configured.');
        return;
    }

    let output = '👥 *Staff Members*:\n\n';
    for (const [id, member] of cache.staffMembers) {
        const roleIcons: Record<string, string> = { admin: '👑', supervisor: '⭐', agent: '🔧' };
        output += `${roleIcons[member.role] || ''} ${member.name} (${member.role})\n`;
    }

    middleware.reply(ctx, output.trim(), { parse_mode: cache.config.parse_mode });
}

/**
 * Checks if a ticket is muted (no notifications should be sent).
 */
export function isTicketMuted(ticketId: number): boolean {
    return cache.mutedTickets.has(ticketId.toString());
}
