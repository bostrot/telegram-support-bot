import {Context, Messenger, SessionData} from '../interfaces';

const fakectx: Context = {
  update_id: 617718635,
  messenger: Messenger.TELEGRAM,
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
    external_reply: {
      message_id: 0,
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
  answerCbQuery: async (_text?: string, _showAlert?: boolean): Promise<void> => {
    throw new Error('Function not implemented.');
  },
  reply: async (): Promise<void> => {},
  getChat: async (): Promise<{ id: string; first_name: string; username: string; type: string }> => ({ id: '', first_name: '', username: '', type: 'private' }),
  getFile: async (): Promise<unknown> => ({}),
};

export default fakectx;
