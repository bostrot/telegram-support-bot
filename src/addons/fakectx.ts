import {Context} from './ctx';

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
    reply_to_message: undefined,
    getFile: undefined,
    caption: undefined,
  },
  chat: {
    id: 'WEB12345678',
    first_name: 'Web User',
    username: 'webuser',
    type: 'private',
  },
  session: undefined,
  reply: undefined,
  callbackQuery: {
    data: '',
    from: {
      id: undefined,
    },
    id: undefined,
  },
  from: {
    username: undefined,
    id: '',
  },
  inlineQuery: undefined,
  answerCbQuery: function(arg0: any, arg1: boolean): void {
    throw new Error('Function not implemented.');
  },
  getChat: undefined,
  getFile: undefined,
};

export default fakectx;
