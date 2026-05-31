import TelegramAddon from './addons/telegram';

export interface ModeData {
  ticketid: string;
  userid: string | number;
  name: string | null;
  category: string;
}

export interface SessionData {
  admin: boolean | null;
  mode: string | null;
  modeData: ModeData;
  lastContactDate: number;
  groupCategory: string | null;
  groupTag: string;
  group: string;
  groupAdmin: string | boolean | null | undefined;
  staffRole?: 'admin' | 'supervisor' | 'agent';
  getSessionKey: (ctx: Context) => string | null;
}

export interface Autoreply {
  question: string;
  answer: string;
}

export enum StaffRole {
  AGENT = 'agent',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin',
}

export enum TicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface StaffMemberConfig {
  telegram_id: string;
  role: StaffRole;
  name: string;
}

export interface WebhookConfig {
  url: string;
  events: WebhookEvent[];
  secret?: string;
}

export type WebhookEvent =
  | 'ticket.created'
  | 'ticket.replied'
  | 'ticket.closed'
  | 'ticket.banned'
  | 'csat.rated'
  | 'ticket.escalated';

export interface CannedResponse {
  key: string;
  text: string;
}

export interface EscalationRule {
  after_hours: number;
  action: 'notify_supervisor' | 'tag_urgent';
}

export interface BusinessHoursConfig {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  offline_message?: string;
}

export interface WebChatConfig {
  enabled: boolean;
  greeting: string;
  primary_color: string;
  logo_url: string;
  position: 'left' | 'right';
  pre_chat_form: {
    name: boolean;
    email: boolean;
    subject: boolean;
    order_number: boolean;
  };
  business_hours?: BusinessHoursConfig;
}

export interface SlackConfig {
  enabled: boolean;
  bot_token: string;
  channel_id: string;
}

export interface DiscordConfig {
  enabled: boolean;
  bot_token: string;
  channel_id: string;
}

export interface LLMConfig {
  use_llm: boolean;
  llm_api_key: string;
  llm_base_url: string;
  llm_model: string;
  llm_knowledge: string;
  llm_memory_depth: number;
  auto_triage: boolean;
  sentiment_alert_threshold: number;
  staff_assist: boolean;
  translate_enabled: boolean;
  translate_target_language: string;
}

export interface WorkflowConfig {
  canned_responses: CannedResponse[];
  escalation_rules: EscalationRule[];
  auto_close_after_days: number;
  business_hours?: BusinessHoursConfig;
}

export interface Language {
  startCommandText: string;
  faqCommandText: string;
  helpCommandText: string;
  confirmationMessage: string;
  contactMessage: string; // left for backward compatibility
  blockedSpam: string;
  ticket: string;
  closed: string;
  acceptedBy: string;
  dear: string;
  regards: string;
  from: string;
  language: string;
  msg_sent: string;
  file_sent: string;
  usr_with_ticket: string;
  banned: string;
  replyPrivate: string;
  services: string;
  customer: string;
  msgForwarding: string;
  back: string;
  whatSubCategory: string;
  prvChatEnded: string;
  prvChatOpened: string;
  prvChatEnd: string;
  prvChatOpenedCustomer: string;
  instructionsSent: string;
  openTickets: string;
  support: string;
  prvChatOnly: string;
  ticketClosed: string;
  links: string;
  textFirst: string;
  ticketClosedError: string;
  automatedReply: string;
  automatedReplyAuthor: string;
  doesntHelp: string;
  automatedReplySent: string;
  ticketReopened: string;
  yourTicketId: string;
  helpCommandStaffText: string;
  regardsGroup: string;
  autoreply: Autoreply[];
  // CSAT survey strings
  csatRatingRequest: string;
  csatThankYou: string;
  // Triage / priority strings
  triagePriority: string;
  triageSummary: string;
  sentimentAlert: string;
  // Assignment strings
  ticketAssignedTo: string;
  ticketUnassigned: string;
  assignedBy: string;
  // Internal note strings
  internalNote: string;
  noteAddedBy: string;
  // Workflow strings
  offlineMessage: string;
  businessHoursClosed: string;
  escalationNotify: string;
}

export interface Category {
  name: string;
  msg: string;
  tag: string;
  group_id: string;
  subgroups: {
    name: string;
    group_id: string;
  }[];
}

export enum ParseMode {
  HTML = 'HTML',
  Markdown = 'Markdown',
  MarkdownV2 = 'MarkdownV2',
  PLAINTEXT = 'plaintext',
}

export class Config {
  bot_token: string = '';
  spam_cant_msg: number = 0;
  staffchat_id: string | number = '';
  staffchat_type: Messenger = Messenger.TELEGRAM;
  staffchat_parse_mode: ParseMode = ParseMode.MarkdownV2;
  owner_id: string = '';
  spam_time: number = 5;
  parse_mode: string = ParseMode.MarkdownV2;
  allow_private: boolean = false;
  direct_reply: boolean = false;
  auto_close_tickets: boolean = false;
  anonymous_tickets: boolean = false;
  anonymous_replies: boolean = false;
  show_auto_replied: boolean = true;
  signal_enabled: boolean = false;
  signal_number: string = '';
  signal_host: string = 'signal-cli:40153';
  web_server: boolean = false;
  web_server_port: number = 3000;
  web_server_ssl_cert: string = '';
  web_server_ssl_key: string = '';
  dev_mode: boolean = false;
  show_user_ticket: boolean = false;
  language: Language = {} as Language;
  autoreply_confirmation: boolean = true;
  autoreply: Autoreply[] = [];
  clean_replies: boolean = false;
  pass_start: boolean = false;
  categories: Category[] = [];
  mongodb_uri: string = 'mongodb://mongodb:27017/support';
  // LLM settings (legacy flat fields for backward compat)
  use_llm: boolean = false;
  llm_api_key: string = '';
  llm_base_url: string = '';
  llm_model: string = '';
  llm_knowledge: string = '';
  // New AI features
  llm_memory_depth: number = 10;
  auto_triage: boolean = false;
  sentiment_alert_threshold: number = 2;
  staff_assist: boolean = false;
  translate_enabled: boolean = false;
  translate_target_language: string = 'en';
  // Team collaboration
  staff_roles: StaffMemberConfig[] = [];
  enable_csat: boolean = false;
  daily_summary_time: string = '09:00';
  // Webhooks
  webhooks: WebhookConfig[] = [];
  // Integrations
  slack_enabled: boolean = false;
  slack_bot_token: string = '';
  slack_channel_id: string = '';
  discord_enabled: boolean = false;
  discord_bot_token: string = '';
  discord_channel_id: string = '';
  api_enabled: boolean = false;
  api_token: string = '';
  // Web chat widget
  web_chat: WebChatConfig = {
    enabled: false,
    greeting: 'Hi! How can we help you?',
    primary_color: '#6366f1',
    logo_url: '',
    position: 'right',
    pre_chat_form: { name: true, email: true, subject: false, order_number: false },
  };
  // Workflows & automation
  canned_responses: CannedResponse[] = [];
  escalation_rules: EscalationRule[] = [];
  auto_close_after_days: number = 0;
}

export interface SocketEmit {
  emit(event: string, data: unknown): void;
}

export interface SocketTo {
  to(roomId: string): SocketEmit;
}

export interface Cache {
  userId: string;
  ticketIDs: Record<string, string | number>;
  ticketStatus: Record<string, boolean>;
  ticketSent: Record<string, number | undefined>;
  html: string;
  noSound: string;
  markdown: string;
  io: SocketTo;
  config: Config;
  // Team collaboration cache
  staffMembers: Map<string, StaffMemberConfig>;
  mutedTickets: Set<string>;
  // Recovery baseline — highest ticket ID discovered from chat history on startup
  recoveryBaseline: number;
}

/**
 * Context
 */
export class Context {
  messenger: Messenger = 'telegram' as Messenger;
  update_id: number = 0;
  match?: string;
  message: {
    web_msg: boolean;
    message_id: number;
    from: {
      id: string;
      is_bot: false;
      first_name: string;
      username: string;
      language_code: string;
    };
    chat: {
      id: string;
      first_name: string;
      username: string;
      type: string;
    };
    date: number;
    text: string;
    reply_to_message: {
      from: { is_bot: boolean };
      text: string;
      caption: string;
    };
    external_reply?: {
      message_id: number,
    },
    getFile?: any;
    caption: string;
  } = {} as Context['message'];
  chat: {
    id: string;
    first_name: string;
    username: string;
    type: string;
  } = {} as Context['chat'];
  session: SessionData = {} as SessionData;
  callbackQuery: { data: string; from: { id: string | number }; id: string } = { data: '', from: { id: '' }, id: '' };
  from: { username: string; id: string | number } = { username: '', id: '' };
  inlineQuery: unknown = null;
  reply: (text: string, options?: Record<string, unknown>) => Promise<void> = async () => {};
  answerCbQuery: (text?: string, showAlert?: boolean) => Promise<void> = async () => {};
  getChat: () => Promise<{ id: string; first_name: string; username: string; type: string }> = async () => ({ id: '', first_name: '', username: '', type: 'private' });
  getFile: () => Promise<unknown> = async () => {};
}

export interface Addon {
  platform?: string;
  botInfo?: Record<string, unknown>;

  /**
   * Sends a text message.
   * @param chatId The target chat identifier.
   * @param text The text message to send.
   * @param options Optional parameters.
   */
  sendMessage(chatId: string | number, text: string, options?: Record<string, unknown>): void | Promise<void> | Promise<string | null>;

  /**
   * Sends a photo.
   * @param chatId The target chat identifier.
   * @param photo The photo content to send.
   * @param options Optional parameters (e.g. caption, recipients).
   */
  sendPhoto(chatId: string | number, photo: unknown, options?: Record<string, unknown>): Promise<void> | Promise<string | null>;

  /**
   * Sends a document.
   * @param chatId The target chat identifier.
   * @param document The document content to send.
   * @param options Optional parameters (e.g. caption, recipients).
   */
  sendDocument(chatId: string | number, document: unknown, options?: Record<string, unknown>): Promise<void> | Promise<string | null>;

  /**
   * Sends a video.
   * @param chatId The target chat identifier.
   * @param video The video content to send.
   * @param options Optional parameters (e.g. caption, recipients).
   */
  sendVideo(chatId: string | number, video: unknown, options?: Record<string, unknown>): Promise<void> | Promise<string | null>;

  /**
   * Registers a command handler.
   * @param command The command string (e.g. 'start', 'help').
   * @param callback The function to handle the command.
   */
  command(command: string, callback: (ctx: Context) => void): void;

  /**
   * Registers an event handler.
   * @param event The event name or an array of event names.
   * @param callback The function to handle the event.
   */
  on(event: string | string[], callback: (ctx: Context) => void): void;

  /**
   * Starts the addon (e.g. begin processing incoming messages).
   */
  start(): void;

  /**
   * Sets up an error handler.
   * @param handler The error handler function.
   */
  catch(handler: (error: Error, ctx?: Context) => void): void;

  /**
   * Registers a text/regex handler.
   */
  hears(trigger: string | string[] | RegExp, callback: (ctx: Context) => void): void;
}

export enum Messenger {
  TELEGRAM = 'telegram',
  SIGNAL = 'signal',
  WEB = 'web',
}


