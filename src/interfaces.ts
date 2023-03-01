import TelegramAddon from './addons/telegram';

interface ModeData {
  ticketid: string;
  userid: string | number;
  name: any;
  category: string;
}

interface SessionData {
  admin: boolean | null;
  mode: string | null;
  modeData: ModeData;
  groupCategory: string | null;
  groupTag: string;
  group: string;
  groupAdmin: any;
  getSessionKey: Function;
}

interface Autoreply {
  question: string;
  answer: string;
}

interface Language {
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

interface Category {
  name: string;
  msg: string;
  tag: string;
  group_id: string;
  subgroups: {
    name: string;
    group_id: string;
  }[];
}

interface Config {
  bot_token: string;
  spam_cant_msg: number;
  staffchat_id: string | number;
  owner_id: string;
  spam_time: number;
  parse_mode: string;
  allow_private: boolean;
  direct_reply: boolean;
  auto_close_tickets: boolean;
  anonymous_tickets: boolean;
  anonymous_replies: boolean;
  show_auto_replied: boolean;
  signal_enabled: boolean;
  signal_number: string;
  web_server: boolean;
  web_server_port: number;
  web_server_ssl_cert: string;
  web_server_ssl_key: string;
  dev_mode: boolean;
  show_user_ticket: boolean;
  language: Language;
  autoreply_confirmation: boolean;
  autoreply: Autoreply[];
  clean_replies: boolean;
  pass_start: boolean;
  categories: Category[];
}

interface Cache {
  ticketID: string;
  ticketIDs: any;
  ticketStatus: any;
  ticketSent: any;
  html: string;
  noSound: string;
  markdown: string;
  io: any;
  bot: TelegramAddon;
  config: Config;
}

/**
 * Context
 */
class Context {
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

export {SessionData, Context, Language, Config, Cache, ModeData};
