import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { Addon, Context } from '../../interfaces';
import * as commands from '../../commands';
import * as text from '../../text';
import * as files from '../../files';
import * as inline from '../../inline';
import * as middleware from '../../middleware';
import cache from '../../cache';
import { mapSignalMessageToContext } from './mapper';
import { Group, SignalMessage } from './models';

const SEND_ENDPOINT = 'v2/send';
const GROUP_ENDPOINT = 'v1/groups';
const RECEIVE_ENDPOINT = 'v1/receive';

const PHONE_NUMBER = cache.config.signal_number;

class SignalAddon implements Addon {
  public baseURL: string = `http://${cache.config.signal_host}`;
  public wsURL: string = `ws://${cache.config.signal_host}/${RECEIVE_ENDPOINT}/${PHONE_NUMBER}?ignore_stories`;
  private axiosInstance: AxiosInstance;
  private ws: WebSocket | null = null;
  private errorHandler: ((error: any, ctx?: any) => void) | null = null;
  private eventHandlers: Record<string, ((ctx: any) => void)[]> = {};
  private hearsHandlers: Array<{ trigger: string | RegExp, callback: (ctx: any) => void }> = [];
  private externalGroups: Record<string, string> = {};

  private static instance: SignalAddon | null = null;

  private constructor() {
    this.axiosInstance = axios.create({ baseURL: this.baseURL });
  }

  public static getInstance(): SignalAddon {
    if (!SignalAddon.instance) {
      SignalAddon.instance = new SignalAddon();
    }
    return SignalAddon.instance;
  }

  async sendMessage(chatId: string | number, text: string, options?: any): Promise<void> {
    try {
      // Build the payload in the required format.
      const payload = {
        base64_attachments: options?.base64_attachments || [],
        // edit_timestamp: options?.edit_timestamp || 0,
        mentions: options?.mentions || [],
        message: text,
        notify_self: options?.notify_self !== undefined ? options.notify_self : true,
        number: PHONE_NUMBER,
        quote_author: options?.quote_author || "",
        // quote_mentions: options?.quote_mentions || [],
        // quote_message: options?.quote_message || "",
        // quote_timestamp: options?.quote_timestamp || 0,
        recipients: options?.recipients || [chatId],
        sticker: options?.sticker || "",
        text_mode: "styled"
      };
      await this.axiosInstance.post(`/${SEND_ENDPOINT}`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Signal message sent successfully.');
    } catch (error) {
      console.error('Error sending Signal message:', error);
      if (this.errorHandler) this.errorHandler(error);
    }
  }

  private async getGroupId(internalGroupId: string): Promise<string | null> {
    if (this.externalGroups[internalGroupId]) {
      return this.externalGroups[internalGroupId];
    }
    try {
      const response = await this.axiosInstance.get(`/${GROUP_ENDPOINT}/${PHONE_NUMBER}`);
      const groups = response.data as Group[];
      const groupId = groups.find((group: Group) => group.internal_id === internalGroupId);
      return groupId ? groupId.id : null;
    } catch (error) {
      console.error('Error listing Signal groups:', error);
      if (this.errorHandler) this.errorHandler(error);
    }
    return null;
  }

  private async setGroupAdmin(ctx: Context): Promise<void> {
    if (!this.isGroup(ctx)) return;
    const groupId = ctx.chat.id;
    try {
      const response = await this.axiosInstance.get(`/${GROUP_ENDPOINT}/${PHONE_NUMBER}/${groupId}`);
      const group = response.data as Group;
      const admins = group?.admins || [];
      if (group && admins.some((admin: string) => admin === ctx.from.id)) {
        ctx.session.admin = true;
      }
    } catch (error) {
      console.error('Error getting Signal group admins:', error);
    }
  }

  private setIsBot(signalMessage: SignalMessage, ctx: Context): void {
    if (signalMessage.envelope.dataMessage.quote?.authorNumber === PHONE_NUMBER) {
      ctx.message.reply_to_message.from.is_bot = true;
    }
  }

  async sendPhoto(chatId: string | number, photo: any, options?: any): Promise<void> {
    try {
      const payload = {
        message: options?.caption || '',
        number: options?.number || chatId,
        recipients: options?.recipients || [chatId],
        media: { type: 'photo', content: photo },
      };
      await this.axiosInstance.post(`/${SEND_ENDPOINT}`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Signal photo sent successfully.');
    } catch (error) {
      console.error('Error sending Signal photo:', error);
      if (this.errorHandler) this.errorHandler(error);
    }
  }

  async sendVideo(chatId: string | number, video: any, options?: any): Promise<void> {
    try {
      const payload = {
        message: options?.caption || '',
        number: options?.number || chatId,
        recipients: options?.recipients || [chatId],
        media: { type: 'video', content: video },
      };
      await this.axiosInstance.post(`/${SEND_ENDPOINT}`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Signal video sent successfully.');
    } catch (error) {
      console.error('Error sending Signal video:', error);
      if (this.errorHandler) this.errorHandler(error);
    }
  }

  async sendDocument(chatId: string | number, document: any, options?: any): Promise<void> {
    try {
      const payload = {
        message: options?.caption || '',
        number: options?.number || chatId,
        recipients: options?.recipients || [chatId],
        media: { type: 'document', content: document },
      };
      await this.axiosInstance.post(`/${SEND_ENDPOINT}`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('Signal document sent successfully.');
    } catch (error) {
      console.error('Error sending Signal document:', error);
      if (this.errorHandler) this.errorHandler(error);
    }
  }

  command(command: string, callback: (ctx: any) => void): void {
    const key = `command:${command}`;
    if (!this.eventHandlers[key]) {
      this.eventHandlers[key] = [];
    }
    this.eventHandlers[key].push(callback);
  }

  on(event: string | string[], callback: (ctx: any) => void): void {
    if (typeof event === 'string') {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(callback);
    } else {
      event.forEach((ev) => this.on(ev, callback));
    }
  }

  hears(trigger: string | string[] | RegExp, callback: (ctx: any) => void): void {
    if (Array.isArray(trigger)) {
      trigger.forEach(t => this.hears(t, callback));
    } else {
      this.hearsHandlers.push({ trigger, callback });
    }
  }

  catch(handler: (error: any, ctx?: any) => void): void {
    this.errorHandler = handler;
  }

  start(): void {
    console.log('Starting Signal Addon with WebSocket connection...');

    // Mimic Telegram's registration of commands, event handlers, and hears handlers.
    const self = this;

    // Register commands.
    this.command('open', (ctx: Context) => commands.openCommand(ctx));
    this.command('close', (ctx: Context) => commands.closeCommand(ctx));
    this.command('ban', (ctx: Context) => commands.banCommand(ctx));
    this.command('reopen', (ctx: Context) => commands.reopenCommand(ctx));
    this.command('unban', (ctx: Context) => commands.unbanCommand(ctx));
    this.command('clear', (ctx: Context) => commands.clearCommand(ctx));
    this.command('id', (ctx: Context) => {
      middleware.reply(ctx, `User ID: ${ctx.from.id}\nGroup ID: ${ctx.chat.id}`, {
        parse_mode: cache.config.parse_mode,
      });
    });
    this.command('faq', (ctx: Context) => {
      middleware.reply(ctx, cache.config.language.faqCommandText, {
        parse_mode: cache.config.parse_mode,
      });
    });
    this.command('help', (ctx: Context) => commands.helpCommand(ctx));
    this.command('links', (ctx: Context) => {
      let links = '';
      const subcategories: string[] = [];
      for (const cat of cache.config.categories) {
        if (cat) {
          for (const subgroup of cat.subgroups) {
            if (subgroup) {
              const catName = subgroup.name;
              const id = (cat.name + subgroup.name)
                .replace(/[\[\]\:\ "]/g, '')
                .substring(0, 63);
              if (subcategories.indexOf(id) === -1) {
                subcategories.push(id);
                // For Signal, build a URL that points to your Signal number.
                links += `${catName} - https://signal.me/#p/+19194324159?start=${id}\n`;
              }
            }
          }
        }
      }
      middleware.reply(ctx, `${cache.config.language.links}:\n${links}`, {
        parse_mode: cache.config.parse_mode,
      });
    });
    if (cache.config.pass_start === false) {
      this.command('start', (ctx: Context) => {
        if (ctx.chat.type === 'private') {
          middleware.reply(ctx, cache.config.language.startCommandText);
          if (cache.config.categories && cache.config.categories.length > 0) {
            setTimeout(() => {
              middleware.reply(ctx, cache.config.language.services);
            }, 500);
          }
        } else {
          middleware.reply(ctx, cache.config.language.prvChatOnly);
        }
      });
    }

    // Register event handlers.
    this.on('callback_query', (ctx: Context) => inline.callbackQuery(ctx));
    this.on([':photo'], (ctx: Context) => files.fileHandler('photo', self, ctx));
    this.on([':video'], (ctx: Context) => files.fileHandler('video', self, ctx));
    this.on([':document'], (ctx: Context) => files.fileHandler('document', self, ctx));

    // Register generic text handlers.
    this.hears(cache.config.language.back, (ctx: Context) =>
      middleware.reply(ctx, cache.config.language.services, [])
    );
    this.hears('testing', (ctx: Context) => text.handleText(self, ctx, []));
    this.hears(/(.+)/, (ctx: Context) => text.handleText(self, ctx, []));

    // Global error handling.
    this.catch((err: any, ctx: Context) => {
      console.log('Error: ', err);
      try {
        middleware.reply(ctx, 'Message is not sent due to an error.');
      } catch (e) {
        console.log('Could not send error msg to chat: ', e);
      }
    });

    // Open the WebSocket connection.
    this.connectWebSocket();
  }

  /**
   * Establish a WebSocket connection to receive messages.
   * On connection close, attempt to reconnect after 5 seconds.
   */
  private connectWebSocket(): void {
    this.ws = new WebSocket(this.wsURL);

    this.ws.on('open', () => {
      console.log('WebSocket connection established for Signal.');
    });

    this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (this.errorHandler) this.errorHandler(error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket connection closed. Reconnecting in 5 seconds...');
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }

  private isGroup(ctx: Context): boolean {
    return ctx.chat.type === 'group';
  }

  private async setExternalGroupId(ctx: Context) {
    if (this.isGroup(ctx) && ctx.chat.id) {
      const groupId = ctx.chat.id;
      const externalGroupId = await this.getGroupId(groupId)
      if (externalGroupId) {
        this.externalGroups[groupId] = externalGroupId;
        ctx.chat.id = externalGroupId;
        console.log(`Mapped internal group ID ${groupId} to external group ID ${externalGroupId}`);
      } else {
        console.error(`Failed to map internal group ID ${groupId} to external group ID.`);
      }
    }
  }

  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const signalMessage = JSON.parse(data.toString()) as SignalMessage;
      if (signalMessage.envelope.dataMessage === undefined) {
        console.log('Ignoring Signal message without dataMessage:', signalMessage);
        return;
      }
      // Map the raw Signal message to a Context.
      const messageContext: Context = mapSignalMessageToContext(signalMessage);
      await this.setExternalGroupId(messageContext);
      await this.setGroupAdmin(messageContext);
      this.setIsBot(signalMessage, messageContext);

      let isCommand = false;
      // Process command handlers (if the message starts with '/').
      if (messageContext.message && typeof messageContext.message.text === 'string' && messageContext.message.text.startsWith('/')) {
        isCommand = true;
        const parts = messageContext.message.text.split(' ');
        const commandName = parts[0].substring(1);
        const commandKey = `command:${commandName}`;
        if (this.eventHandlers[commandKey]) {
          this.eventHandlers[commandKey].forEach(handler => handler(messageContext));
        }
      }

      // Process generic "message" handlers.
      if (this.eventHandlers['message']) {
        this.eventHandlers['message'].forEach(handler => handler(messageContext));
      }

      // Process hears handlers only if the message is not a command.
      if (!isCommand) {
        this.hearsHandlers.forEach(({ trigger, callback }) => {
          if (typeof trigger === 'string' && messageContext.message.text === trigger) {
            callback(messageContext);
          } else if (trigger instanceof RegExp && trigger.test(messageContext.message.text)) {
            callback(messageContext);
          }
        });
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  }
}

export default SignalAddon;

