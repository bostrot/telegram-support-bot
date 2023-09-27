import {Context, SessionData} from '../interfaces';

const fakectx: Context = {
  update_id: 617718635,
  message: {
    web_msg: true,
    message_id: 4260,
    from: {
      id: 'WEB12345678',
      is_bot: false,
      first_name: 'Web User',
      username: 'webuser',
      language_code: 'en',
    },
    chat: {
      id: 'WEB12345678',
      first_name: 'Web User',
      username: 'webuser',
      type: 'private',
    },
    date: 1630660070,
    text: 'hello',
    reply_to_message: {
      from: {
        is_bot: false,
      },
      text: '',
      caption: '',
    },
    getFile: () => {},
    caption: '',
  },
  chat: {
    id: 'WEB12345678',
    first_name: 'Web User',
    username: 'webuser',
    type: 'private',
  },
  session: {
    group: '',
    groupTag: '',
    groupCategory: null
  } as SessionData,
  callbackQuery: {
    data: '',
    from: {
      id: '',
    },
    id: '',
  },
  from: {
    username: '',
    id: '',
  },
  inlineQuery: () => {},
  answerCbQuery: function(arg0: any, arg1: boolean): void {
    throw new Error('Function not implemented.');
  },
  reply: () => {},
  getChat: () => {},
  getFile: () => {},
};

export default fakectx;
