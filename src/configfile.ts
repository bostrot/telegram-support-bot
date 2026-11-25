import * as fs from 'fs';
import * as YAML from 'yaml';

export const CONFIG_PATH = './config/config.yaml';

export interface ConfigFileResult {
  config: Record<string, unknown>;
  /** Operator-facing explanation when the file could not be used, else undefined. */
  problem?: string;
}

/**
 * Reads and parses the YAML config file. Never throws: problems are returned as a
 * message for the operator. The message names the file and, for syntax errors, the
 * line and column, but never echoes file content (it may contain the bot token).
 */
export function readConfigFile(
  path: string = CONFIG_PATH,
  read: (path: string) => string = (p) => fs.readFileSync(p, 'utf8'),
): ConfigFileResult {
  let content: string;
  try {
    content = read(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {
        config: {},
        problem: `Config file ${path} not found. Copy config/config-sample.yaml to ` +
          `${path} and set at least bot_token, staffchat_id and owner_id.`,
      };
    }
    const code = (err as NodeJS.ErrnoException)?.code || 'unknown error';
    return { config: {}, problem: `Config file ${path} could not be read (${code}).` };
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (err) {
    // The YAML error message quotes the offending source line after the position,
    // so keep only its first line and drop the quoted snippet.
    const reason = String((err as Error)?.message ?? err).split('\n')[0].replace(/:\s*$/, '');
    return {
      config: {},
      problem: `Config file ${path} is not valid YAML: ${reason}. Check the indentation ` +
        'and quotes on that line (compare with config/config-sample.yaml).',
    };
  }

  // YAML.parse('') and a comments-only file return null: treat as an empty config.
  if (parsed === null || parsed === undefined) {
    return { config: {} };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      config: {},
      problem: `Config file ${path} must contain "key: value" settings at the top level ` +
        `(found ${Array.isArray(parsed) ? 'a list' : 'a single value'}).`,
    };
  }
  return { config: parsed as Record<string, unknown> };
}

/** Sample values from config-sample.yaml that must be replaced before running. */
const PLACEHOLDERS: Record<string, string> = {
  staffchat_id: 'SUPERGROUP_CHAT_ID',
  owner_id: 'YOUR_TELEGRAM_ID',
};

/** Numeric settings that are checked, with the value used when they are unusable. */
export const NUMBER_DEFAULTS: Record<string, number> = {
  spam_time: 300000,
  spam_cant_msg: 5,
};

const NUMBER_HINTS: Record<string, string> = {
  spam_time: 'a plain number of milliseconds, e.g. 300000 for 5 minutes',
  spam_cant_msg: 'a whole number of messages, e.g. 5',
};

/**
 * Checks config values that commonly go wrong when editing the sample file.
 * Quoted numbers ('300000') are converted in place; values that are not usable
 * numbers (e.g. `5 * 60 * 1000`, which YAML reads as text) are replaced by their
 * default. Returns one warning per problem for the operator. Like readConfigFile,
 * it never echoes the configured values.
 */
export function checkConfigValues(config: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) {
    if (String(config[key] ?? '').trim() !== placeholder) continue;
    let warning = `${key} is still the sample value '${placeholder}' in ${CONFIG_PATH}.`;
    if (key === 'owner_id') {
      // db.ts derives the collection name from owner_id.
      warning += ' Set it before tickets are stored: changing it later starts with an empty ' +
        'ticket history.';
    }
    warnings.push(warning);
  }

  for (const [key, fallback] of Object.entries(NUMBER_DEFAULTS)) {
    const value = config[key];
    const number = typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value;
    if (typeof number === 'number' && Number.isInteger(number) && number >= 0) {
      config[key] = number;
      continue;
    }
    warnings.push(`${key} must be ${NUMBER_HINTS[key]}; the configured value is not, ` +
      `so ${fallback} is used.`);
    config[key] = fallback;
  }

  return warnings;
}
