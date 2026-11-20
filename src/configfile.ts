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
