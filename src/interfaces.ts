import TelegramAddon from './addons/telegram';

export interface ModeData {
  ticketid: string;
  userid: string | number;
  name: any;
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
  groupAdmin: any;
  getSessionKey: Function;
}

export interface Autoreply {
  question: string;
  answer: string;
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
  bot_token: string;
  spam_cant_msg: number;
  staffchat_id: string | number;
  staffchat_type: Messenger = Messenger.TELEGRAM;
  staffchat_parse_mode: ParseMode = ParseMode.MarkdownV2;
  owner_id: string;
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
  language: Language;
  autoreply_confirmation: boolean = true;
  autoreply: Autoreply[];
  clean_replies: boolean = false;
  pass_start: boolean = false;
  categories: Category[] = [];
  mongodb_uri: string = 'mongodb://mongodb:27017/support';
  use_llm: boolean = false;
  llm_api_key: string;
  llm_base_url: string;
  llm_model: string;
  llm_knowledge: string;
}

export interface Cache {
  userId: string;
  ticketIDs: any;
  ticketStatus: any;
  ticketSent: any;
  html: string;
  noSound: string;
  markdown: string;
  io: any;
  config: Config;
}

/**
 * Context
 */
export class Context {
  messenger: Messenger = null;
  update_id: number;
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
    external_reply: {
      message_id: number,
    },
    getFile?: any;
    caption: string;
  };
  chat: {
    id: string;
    first_name: string;
    username: string;
    type: string;
  };
  session: SessionData;
  callbackQuery: { data: string; from: { id: any }; id: any };
  from: { username: any; id: string };
  inlineQuery: any;
  reply: Function;
  answerCbQuery: (arg0: any, arg1: boolean) => void;
  getChat: Function;
  getFile: Function;
}

export interface Addon {
  /**
   * Sends a text message.
   * @param chatId The target chat identifier.
   * @param text The text message to send.
   * @param options Optional parameters.
   */
  sendMessage(chatId: string | number, text: string, options?: any): void | Promise<void> | Promise<string | null>;

  /**
   * Sends a photo.
   * @param chatId The target chat identifier.
   * @param photo The photo content to send.
   * @param options Optional parameters (e.g. caption, recipients).
   */
  sendPhoto(chatId: string | number, photo: any, options?: any): void | Promise<void> | Promise<string | null>;

  /**
   * Sends a document.
   * @param chatId The target chat identifier.
   * @param document The document content to send.
   * @param options Optional parameters (e.g. caption, recipients).
   */
  sendDocument(chatId: string | number, document: any, options?: any): void | Promise<void> | Promise<string | null>;

  /**
   * Sends a video.
   * @param chatId The target chat identifier.
   * @param video The video content to send.
   * @param options Optional parameters (e.g. caption, recipients).
   */
  sendVideo(chatId: string | number, video: any, options?: any): void | Promise<void> | Promise<string | null>;

  /**
   * Registers a command handler.
   * @param command The command string (e.g. 'start', 'help').
   * @param callback The function to handle the command.
   */
  command(command: string, callback: (ctx: any) => void): void;

  /**
   * Registers an event handler.
   * @param event The event name or an array of event names.
   * @param callback The function to handle the event.
   */
  on(event: string | string[], callback: (ctx: any) => void): void;

  /**
   * Starts the addon (e.g. begin processing incoming messages).
   */
  start(): void;

  /**
   * Sets up an error handler.
   * @param handler The error handler function.
   */
  catch(handler: (error: any, ctx?: any) => void): void;
}

export enum Messenger {
  TELEGRAM = 'telegram',
  SIGNAL = 'signal',
  WEB = 'web',
}


