/**
 * Helpers around `ctx.match`.
 *
 * grammY sets `ctx.match` to a string for command triggers (the text behind the
 * command) and to a `RegExpMatchArray` for RegExp triggers. The Signal, Slack and
 * Discord addons follow the same contract, so every consumer has to cope with both
 * shapes — these two helpers do that in one place.
 */
export type Match = string | RegExpMatchArray | undefined | null;

/**
 * The argument behind a command: `/ticket 42` → `42`.
 *
 * For RegExp triggers the first capture group is used, falling back to the whole
 * match. Returns an empty string when there is no argument.
 */
export function matchArg(match: Match): string {
  if (typeof match === 'string') return match.trim();
  if (Array.isArray(match)) return String(match[1] ?? match[0] ?? '').trim();
  return '';
}

/**
 * The command key of a `/key` style trigger, without the leading slash.
 *
 * @returns the key, or null when the match holds no usable value.
 */
export function matchedCommand(match: Match): string | null {
  const value = matchArg(match);
  return value.replace(/^\//, '') || null;
}
