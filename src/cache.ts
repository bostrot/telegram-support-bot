import { Cache, Config, Language, Messenger, ParseMode, SocketTo } from './interfaces';
import * as YAML from 'yaml';
import * as fs from 'fs';

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

// Default language strings — used when config doesn't provide them
const defaultLanguage: Partial<Language> = {
  startCommandText: '/start - Start the bot',
  faqCommandText: '/faq - Frequently Asked Questions',
  helpCommandText: '/help - Get help',
  confirmationMessage: 'Your message has been sent. We will get back to you as soon as possible.',
  contactMessage: '',
  blockedSpam: 'You are blocked due to spam.',
  ticket: 'Ticket',
  closed: 'Closed',
  acceptedBy: 'Accepted by',
  dear: 'Dear',
  regards: 'Regards',
  from: 'from',
  language: 'Language',
  msg_sent: 'Message sent!',
  file_sent: 'File sent!',
  usr_with_ticket: 'User with ticket',
  banned: 'Banned',
  replyPrivate: 'Reply in private chat',
  services: 'Services',
  customer: 'Customer',
  msgForwarding: 'Message forwarding',
  back: 'Back',
  whatSubCategory: 'What sub-category?',
  prvChatEnded: 'Private chat ended.',
  prvChatOpened: 'Private chat opened.',
  prvChatEnd: 'End private chat',
  prvChatOpenedCustomer: 'Staff has opened a private chat with you.',
  instructionsSent: 'Instructions sent!',
  openTickets: 'Open Tickets',
  support: 'Support',
  prvChatOnly: 'Private chat only',
  ticketClosed: 'Ticket closed',
  links: 'Links',
  textFirst: 'Please send a text message first.',
  ticketClosedError: 'This ticket is closed. Please open a new one.',
  automatedReply: 'Automated Reply',
  automatedReplyAuthor: 'Support Team',
  doesntHelp: "That doesn't help",
  automatedReplySent: 'An automated reply has been sent.',
  ticketReopened: 'Ticket reopened!',
  yourTicketId: 'Your Ticket ID',
  helpCommandStaffText: '/help - Staff commands reference',
  regardsGroup: 'Regards, Support Team',
  csatRatingRequest: 'Please rate your support experience (1-5):',
  csatThankYou: 'Thank you for your feedback!',
  triagePriority: 'Priority',
  triageSummary: 'Triage Summary',
  sentimentAlert: 'Sentiment Alert',
  ticketAssignedTo: 'Ticket assigned to',
  ticketUnassigned: 'Ticket unassigned',
  assignedBy: 'Assigned by',
  internalNote: 'Internal Note',
  noteAddedBy: 'Note added by',
  offlineMessage: "We're currently offline. We'll get back to you when we're available.",
  businessHoursClosed: 'Our support hours are from {start} to {end}.',
  escalationNotify: 'This ticket has been escalated.',
};

const parsedConfig = YAML.parse(
  fs.readFileSync('./config/config.yaml', 'utf8'),
);

// Apply defaults for missing config fields to prevent runtime errors
cache.config = {
  use_llm: false,
  staffchat_type: Messenger.TELEGRAM,
  staffchat_parse_mode: ParseMode.MarkdownV2,
  spam_time: 5 * 60 * 1000,
  parse_mode: ParseMode.MarkdownV2,
  language: defaultLanguage,
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
  ...parsedConfig,
} as Config;

// Ensure array fields are actually arrays (YAML `{}` becomes empty object)
const arrayFields = [
  'categories', 'staff_roles', 'webhooks', 'autoreply',
  'canned_responses', 'escalation_rules',
];
for (const field of arrayFields) {
  const cfg = cache.config as any;
  if (!Array.isArray(cfg[field])) {
    cfg[field] = [];
  }
}

// Merge language config: user values override defaults, missing keys get default fallback
if (parsedConfig.language && typeof parsedConfig.language === 'object') {
  cache.config.language = { ...defaultLanguage, ...parsedConfig.language };
}

export default cache;
