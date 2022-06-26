interface SessionData {
  admin: boolean;
  mode: string;
  modeData: { ticketid: string; userid: any; name: any; category: string };
  groupCategory: any;
  group: any;
  groupAdmin: any;
  getSessionKey: Function;
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
  reply: null;
  callbackQuery: { data: string; from: { id: any }; id: any };
  from: { username: any; id: string };
  inlineQuery: any;
  answerCbQuery: (arg0: any, arg1: boolean) => void;
  getChat: Function;
  getFile: Function;
}

export {SessionData, Context};
