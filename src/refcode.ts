/**
 * Checked ticket reference codes (ticket_ref_codes, #211).
 *
 * A code such as `TR-016J-D` is the ticket id in Crockford base32 followed by a
 * Crockford mod-37 check symbol, so single-character typos and adjacent swaps are
 * rejected. It is purely informational: it identifies a ticket for staff lookup and
 * never grants access, links users or merges identities.
 */

import cache from './cache';
import { strictEscape } from './middleware';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CHECK_ALPHABET = ALPHABET + '*~$=U';
const PREFIX = 'TR';
const MIN_LENGTH = 4;
// 32^10 = 2^50 stays within Number.MAX_SAFE_INTEGER
const MAX_LENGTH = 10;

/** Maps the ambiguous characters Crockford allows on input (O→0, I/L→1). */
const normalize = (str: string): string =>
  str.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');

/**
 * Formats a ticket id as a checked reference code, e.g. 1234 → "TR-016J-D".
 */
export function encodeRefCode(ticketId: number): string {
  if (!Number.isSafeInteger(ticketId) || ticketId < 0) {
    throw new Error(`Invalid ticket id: ${ticketId}`);
  }
  let body = '';
  let rest = ticketId;
  do {
    body = ALPHABET[rest % 32] + body;
    rest = Math.floor(rest / 32);
  } while (rest > 0);
  return `${PREFIX}-${body.padStart(MIN_LENGTH, '0')}-${CHECK_ALPHABET[ticketId % 37]}`;
}

/**
 * Parses a reference code back into a ticket id.
 * Case, hyphens, spaces and the "TR-" prefix are optional; returns null when the
 * code is malformed or its check symbol does not match (typo).
 */
export function parseRefCode(input?: string | null): number | null {
  if (!input) return null;
  const str = input
    .trim()
    .toUpperCase()
    .replace(new RegExp(`^${PREFIX}[\\s-]+`), '')
    .replace(/[\s-]/g, '');
  if (str.length < 2) return null;

  const body = normalize(str.slice(0, -1));
  const check = CHECK_ALPHABET.indexOf(normalize(str.slice(-1)));
  if (body.length > MAX_LENGTH || check < 0) return null;

  let value = 0;
  for (const char of body) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = value * 32 + digit;
  }
  return value % 37 === check ? value : null;
}

/**
 * Formats the reference code line appended to user confirmations, or '' when
 * ticket_ref_codes is off.
 */
export function userRefCodeLine(ticketId: number, messenger: string): string {
  if (!cache.config.ticket_ref_codes) return '';
  const code = encodeRefCode(ticketId);
  // Only Telegram renders the configured parse mode; other channels get the plain code
  return `\n${cache.config.language.ticketRef}: ${messenger === 'telegram' ? strictEscape(code) : code}`;
}
