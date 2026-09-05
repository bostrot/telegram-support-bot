import { Cache, Config, Language, Messenger, ParseMode, SocketTo } from './interfaces';
import * as YAML from 'yaml';
import * as fs from 'fs';
import * as log from './logger';
import { mergeLanguage } from './language';

const cache: Cache = {
  userId: '',
  ticketIDs: {},
  ticketStatus: {},
  ticketSent: {},
  html: '',
  noSound: '',
  markdown: '',
  io: {} as SocketTo,
  config: {} as Config,
  staffMembers: new Map(),
  mutedTickets: new Set(),
  recoveryBaseline: 0,
};


let parsedConfig: Record<string, unknown>;
try {
  parsedConfig = YAML.parse(
    fs.readFileSync('./config/config.yaml', 'utf8'),
  );
} catch (err) {
  // Config file missing or unreadable — use empty object so defaults apply
  parsedConfig = {};
}
// YAML.parse('') returns null, not undefined — normalize to empty object
if (parsedConfig === null) {
  parsedConfig = {};
}

// Apply defaults for missing config fields to prevent runtime errors
cache.config = {
  use_llm: false,
  staffchat_type: Messenger.TELEGRAM,
  staffchat_parse_mode: ParseMode.MarkdownV2,
  spam_time: 5 * 60 * 1000,
  parse_mode: ParseMode.MarkdownV2,
  language: {} as Language,
  allow_private: false,
  direct_reply: false,
  auto_close_tickets: false,
  anonymous_tickets: false,
  anonymous_replies: false,
  show_auto_replied: true,
  signal_enabled: false,
  signal_number: '',
  signal_host: 'signal-cli:40153',
  web_server: false,
  web_server_port: 3000,
  dev_mode: false,
  log_level: 'NONE',
  show_user_ticket: false,
  pass_start: false,
  clean_replies: false,
  autoreply_confirmation: true,
  categories: [],
  mongodb_uri: 'mongodb://mongodb:27017/support',
  llm_memory_depth: 10,
  auto_triage: false,
  sentiment_alert_threshold: 2,
  staff_assist: false,
  translate_enabled: false,
  translate_target_language: 'en',
  staff_roles: [],
  enable_csat: false,
  daily_summary_time: '09:00',
  webhooks: [],
  slack_enabled: false,
  discord_enabled: false,
  api_enabled: false,
  autoreply: [],
  canned_responses: [],
  escalation_rules: [],
  auto_close_after_days: 0,
  staffchat_thread_id: null,
  ticket_per_message: false,
  allow_broadcast: false,
  forward_edited_messages: true,
  start_keyboard: [],
  show_replied_mark: true,
  allow_user_close: false,
  forward_stickers: true,
  user_commands: [],
  forward_replies_to_parent: false,
  ...parsedConfig,
} as unknown as Config;

// Ensure array fields are actually arrays (YAML `{}` becomes empty object)
const arrayFields = [
  'categories', 'staff_roles', 'webhooks', 'autoreply',
  'canned_responses', 'escalation_rules', 'user_commands', 'start_keyboard',
];
for (const field of arrayFields) {
  const cfg = cache.config as any;
  if (!Array.isArray(cfg[field])) {
    cfg[field] = [];
  }
}

cache.config.language = mergeLanguage(parsedConfig.language);

if (cache.config.use_llm && !cache.config.llm_knowledge) {
  log.error(
    'use_llm is enabled but llm_knowledge is empty: the LLM is instructed to answer only from the knowledge base and will not auto-reply.',
  );
}

export default cache;
