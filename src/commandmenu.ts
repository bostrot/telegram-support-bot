/**
 * Command menu entries for Telegram's "/" autocomplete (register_commands).
 *
 * Users in private chats see the user commands, the staff chat sees the staff
 * commands. Entries follow the enabled options, so a command that would only
 * answer "not enabled" is not advertised.
 */

import { Config } from './interfaces';

export interface MenuCommand {
  command: string;
  description: string;
}

// Telegram limits: 1-32 chars of a-z, 0-9 and _, descriptions up to 256 chars, 100 commands
const COMMAND_PATTERN = /^[a-z0-9_]{1,32}$/;
const MAX_DESCRIPTION = 256;
const MAX_COMMANDS = 100;

const truncate = (text: string): string =>
  text.length > MAX_DESCRIPTION ? text.substring(0, MAX_DESCRIPTION - 1) + '…' : text;

/**
 * Drops entries Telegram would reject (and with them the whole list) and duplicates.
 */
const sanitize = (entries: MenuCommand[]): MenuCommand[] => {
  const seen = new Set<string>();
  const result: MenuCommand[] = [];
  for (const entry of entries) {
    const command = String(entry.command ?? '').trim();
    const description = String(entry.description ?? '').replace(/\s+/g, ' ').trim();
    if (!COMMAND_PATTERN.test(command) || seen.has(command)) continue;
    seen.add(command);
    result.push({ command, description: truncate(description || command) });
  }
  return result.slice(0, MAX_COMMANDS);
};

/**
 * Commands shown to users in private chats.
 */
export function userMenu(config: Config): MenuCommand[] {
  const entries: MenuCommand[] = [
    { command: 'start', description: 'How to use this bot' },
    { command: 'help', description: 'List the available commands' },
    { command: 'faq', description: 'Frequently asked questions' },
  ];
  if (config.allow_user_close) {
    entries.push({ command: 'close', description: 'Close your ticket' });
  }
  for (const c of config.user_commands || []) {
    entries.push({ command: c?.command, description: c?.description ?? '' });
  }
  entries.push({ command: 'id', description: 'Show your user id' });
  return sanitize(entries);
}

/**
 * Commands shown in the staff chat, including canned responses (/<key>).
 */
export function staffMenu(config: Config): MenuCommand[] {
  const entries: MenuCommand[] = [
    { command: 'open', description: 'List open tickets' },
    { command: 'close', description: 'Close the ticket (reply to it)' },
    { command: 'reopen', description: 'Reopen a closed ticket (reply to it)' },
    { command: 'ticket', description: 'Ticket details: /ticket <id>' },
  ];
  if (config.ticket_ref_codes) {
    entries.push({ command: 'ref', description: 'Find a ticket by reference code: /ref <code>' });
  }
  entries.push(
    { command: 'note', description: 'Add an internal note: /note <text>' },
    { command: 'notes', description: 'Show internal notes of the ticket' },
    { command: 'assign', description: 'Assign the ticket: /assign <telegram_id>' },
    { command: 'unassign', description: 'Unassign the ticket' },
    { command: 'priority', description: 'Set priority: low, normal, high, urgent' },
    { command: 'tag', description: 'Tag the ticket: /tag <tags>' },
    { command: 'untag', description: 'Remove a tag: /untag <tag>' },
    { command: 'mute', description: 'Mute ticket notifications' },
    { command: 'unmute', description: 'Unmute ticket notifications' },
    { command: 'ban', description: 'Ban the user (reply to a ticket)' },
    { command: 'unban', description: 'Unban the user (reply to a ticket)' },
    { command: 'clear', description: 'Close all tickets' },
    { command: 'templates', description: 'List canned responses' },
  );
  if (config.allow_broadcast) {
    entries.push({ command: 'broadcast', description: 'Message every user: /broadcast <text>' });
  }
  entries.push(
    { command: 'staff', description: 'List staff members and roles' },
    { command: 'stats', description: 'Show support statistics' },
    { command: 'help', description: 'List the available commands' },
    { command: 'id', description: 'Show your user id and the group id' },
  );
  for (const r of config.canned_responses || []) {
    entries.push({ command: r?.key, description: `Template: ${r?.text ?? ''}` });
  }
  return sanitize(entries);
}
