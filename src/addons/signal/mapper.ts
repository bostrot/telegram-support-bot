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
    var chatType = 'private';
    var chatId = senderId;
    var replyId = dataMessage.quote?.id;
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
          message_id: replyId,
        },
        reply_to_message: {
          from: {
            is_bot: false,
          },
          text: signalMsg.envelope.dataMessage.quote?.text,
          caption: signalMsg.envelope.dataMessage.quote?.text,
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
      answerCbQuery: function(arg0: any, arg1: boolean): void {
        throw new Error('Function not implemented.');
      },
      reply: () => {},
      getChat: () => {},
      getFile: async () => {
        return {
          file_id: signalMsg.envelope.dataMessage.attachments[0].id,
        };
      }

    };
  
    return context;
  }
  