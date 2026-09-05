import { Context, Messenger, SessionData } from "../../interfaces";
import { SignalMessage } from "./models";

export function mapSignalMessageToContext(signalMsg: SignalMessage): Context {
    const { envelope, account } = signalMsg;
    const { dataMessage } = envelope;
  
    // Use envelope.timestamp as a unique update_id and message_id.
    const updateId = envelope.timestamp;
    const messageId = envelope.timestamp;
    const dateInSeconds = Math.floor(envelope.timestamp / 1000);
  
    // Use envelope.source as the sender id.
    const senderId = envelope.source;
    // Create a simple username by removing spaces from the sourceName.
    const username = envelope.sourceName.replace(/\s/g, '').toLowerCase();
  
    // Create a chat object based on envelope data.
    let chatType = 'private';
    let chatId = senderId;
    const replyId = dataMessage.quote?.id;
    if (dataMessage.groupInfo) {
      chatId = dataMessage.groupInfo.groupId;
      chatType = 'group';
    }
    const chat = {
      id: chatId,
      first_name: envelope.sourceName,
      username,
      type: chatType,
    };
  
    // Build the context object.
    const context: Context = {
      update_id: updateId,
      messenger: Messenger.SIGNAL,
      message: {
        web_msg: true,
        message_id: messageId,
        from: {
          id: senderId,
          is_bot: false,
          first_name: envelope.sourceName,
          username,
          language_code: 'en',
        },
        chat: chat,
        date: dateInSeconds,
        text: dataMessage.message,
        external_reply: {
          message_id: replyId ?? 0,
        },
        reply_to_message: {
          from: {
            is_bot: false,
          },
          text: signalMsg.envelope.dataMessage.quote?.text ?? '',
          caption: signalMsg.envelope.dataMessage.quote?.text ?? '',
        },
        getFile: () => {},
        caption: dataMessage.message,
      },
      chat: chat,
      session: {
        group: '',
        groupTag: '',
        groupCategory: null,
      } as SessionData,
      callbackQuery: {
        data: '',
        from: {
          id: '',
        },
        id: '',
      },
      from: {
        username,
        id: senderId,
      },
      inlineQuery: () => {},
      answerCbQuery: async (_text?: string, _showAlert?: boolean): Promise<void> => {
        throw new Error('Function not implemented.');
      },
      reply: async (): Promise<void> => {},
      getChat: async (): Promise<{ id: string; first_name: string; username: string; type: string }> => ({ id: senderId, first_name: '', username: '', type: 'private' }),
      getFile: async (): Promise<unknown> => {
        const attachments = signalMsg.envelope.dataMessage.attachments ?? [];
        return { file_id: attachments[0]?.id };
      },

    };
  
    return context;
  }
  