import * as fs from 'fs';
import * as fancyLog from 'fancy-log';

const debugFile = './config/debug.log';

/** Lazily reads log_level from config.yaml directly (avoids circular dep via cache). */
let cachedLogLevel: string | undefined;
function getLogLevel(): string {
  if (cachedLogLevel !== undefined) return cachedLogLevel;
  try {
    const YAML = require('yaml');
    const content = fs.readFileSync('./config/config.yaml', 'utf8');
    const parsed = YAML.parse(content);
    cachedLogLevel = (parsed.log_level as string) || 'NONE';
  } catch (_e) {
    cachedLogLevel = 'NONE';
  }
  return cachedLogLevel;
}

/** Returns a formatted ISO timestamp string. */
function ts(): string {
  return new Date().toISOString();
}

/** Appends a timestamped message to the debug log file if the current level permits it. */
function appendToFile(msg: string, level: 'info' | 'error'): void {
  const lvl = getLogLevel();
  if (lvl === 'NONE') return;
  if (lvl === 'ERROR' && level === 'info') return;

  try {
    fs.appendFileSync(debugFile, `[${ts()}] ${msg}\n`, 'utf8');
  } catch (_e) {
    // Silently ignore file write errors.
  }
}

/** Wraps fancy-log.info: always logs to stdout, writes to debug.log if level allows. */
function info(...args: unknown[]): void {
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  appendToFile(msg, 'info');
  fancyLog.info.apply(null, args as [any]);
}

/** Wraps fancy-log.error: always logs to stdout, writes to debug.log if level allows. */
function error(...args: unknown[]): void {
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  appendToFile(msg, 'error');
  fancyLog.error.apply(null, args as [any]);
}

export { info, error };
