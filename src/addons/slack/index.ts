import axios, { AxiosInstance } from 'axios';
import { Addon, Context } from '../../interfaces';
import cache from '../../cache';
import { registerCommonHandlers } from '../../handlers';
import * as log from '../../logger';

const SLACK_API = 'https://slack.com/api';

class SlackAddon implements Addon {
  private axiosInstance: AxiosInstance;
  private errorHandler: ((error: any, ctx?: any) => void) | null = null;
  private eventHandlers: Record<string, ((ctx: any) => void)[]> = {};
  private commandHandlers: Map<string, ((ctx: any) => void)[]> = new Map();
  private hearsHandlers: Array<{ trigger: string | RegExp; callback: (ctx: any) => void }> = [];
  private ws: any | null = null;
  private channels: Map<string, { name: string; id: string }> = new Map();

  private static instance: SlackAddon | null = null;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: SLACK_API,
      headers: {
        'Authorization': `Bearer ${cache.config.slack_bot_token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  public static getInstance(): SlackAddon {
    if (!SlackAddon.instance) {
      SlackAddon.instance = new SlackAddon();
    }
    return SlackAddon.instance;
  }

  /**
   * Sends a text message to a Slack channel or DM.
   */
  async sendMessage(chatId: string | number, text: string, options?: any): Promise<string | null> {
    try {
      const channelId = this.resolveChannelId(chatId);
      if (!channelId) {
        log.error(`Slack: Cannot resolve channel ID for ${chatId}`);
        return null;
      }

      const params: Record<string, any> = {
        channel: channelId,
        text: text.substring(0, 4000),
        mrkdwn: true,
        unfurl_links: false,
        unfurl_media: true,
      };

      // Handle thread replies via thread_ts in options
      if (options?.thread_ts) {
        params.thread_ts = options.thread_ts;
      }

      const response = await this.axiosInstance.post('/chat.postMessage', params);

      if (!response.data.ok) {
        log.error('Slack sendMessage error:', response.data.error);
        return null;
      }

      log.info(`Slack message sent to ${channelId}`);
      return response.data.ts;
    } catch (error) {
      log.error('Error sending Slack message:', error);
      if (this.errorHandler) this.errorHandler(error);
      return null;
    }
  }

  /**
   * Sends a photo to Slack.
   */
  async sendPhoto(chatId: string | number, photo: any, options?: any): Promise<string | null> {
    try {
      const channelId = this.resolveChannelId(chatId);
      if (!channelId) return null;

      // Upload file via files.upload_v2
      const form = new FormData();
      form.append('channels', channelId);
      form.append('filename', options?.filename || 'photo.jpg');
      form.append('file', photo);
      if (options?.caption) {
        form.append('title', options.caption);
      }

      await this.axiosInstance.post('/files.upload_v2', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      log.info(`Slack photo sent to ${channelId}`);
      return 'uploaded';
    } catch (error) {
      log.error('Error sending Slack photo:', error);
      if (this.errorHandler) this.errorHandler(error);
      return null;
    }
  }

  /**
   * Sends a document to Slack.
   */
  async sendDocument(chatId: string | number, document: any, options?: any): Promise<string | null> {
    try {
      const channelId = this.resolveChannelId(chatId);
      if (!channelId) return null;

      const form = new FormData();
      form.append('channels', channelId);
      form.append('filename', options?.filename || 'document');
      form.append('file', document);
      if (options?.caption) {
        form.append('title', options.caption);
      }

      await this.axiosInstance.post('/files.upload_v2', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      log.info(`Slack document sent to ${channelId}`);
      return 'uploaded';
    } catch (error) {
      log.error('Error sending Slack document:', error);
      if (this.errorHandler) this.errorHandler(error);
      return null;
    }
  }

  /**
   * Sends a video to Slack.
   */
  async sendVideo(chatId: string | number, video: any, options?: any): Promise<string | null> {
    try {
      const channelId = this.resolveChannelId(chatId);
      if (!channelId) return null;

      const form = new FormData();
      form.append('channels', channelId);
      form.append('filename', options?.filename || 'video.mp4');
      form.append('file', video);
      if (options?.caption) {
        form.append('title', options.caption);
      }

      await this.axiosInstance.post('/files.upload_v2', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      log.info(`Slack video sent to ${channelId}`);
      return 'uploaded';
    } catch (error) {
      log.error('Error sending Slack video:', error);
      if (this.errorHandler) this.errorHandler(error);
      return null;
    }
  }

  /**
   * Registers a command handler.
   */
  command(command: string, callback: (ctx: any) => void): void {
    const handlers = this.commandHandlers.get(command) || [];
    handlers.push(callback);
    this.commandHandlers.set(command, handlers);
  }

  /**
   * Registers an event handler.
   */
  on(event: string | string[], callback: (ctx: any) => void): void {
    if (typeof event === 'string') {
      const handlers = this.eventHandlers[event] || [];
      handlers.push(callback);
      this.eventHandlers[event] = handlers;
    } else {
      event.forEach((ev) => this.on(ev, callback));
    }
  }

  /**
   * Registers a hears handler (text matching).
   */
  hears(trigger: string | string[] | RegExp, callback: (ctx: any) => void): void {
    if (Array.isArray(trigger)) {
      trigger.forEach(t => this.hears(t, callback));
    } else {
      this.hearsHandlers.push({ trigger, callback });
    }
  }

  /**
   * Sets up an error handler.
   */
  catch(handler: (error: any, ctx?: any) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Starts the Slack addon — connects via RTM WebSocket and registers handlers.
   */
  start(): void {
    if (!cache.config.slack_enabled) return;

    log.info('Starting Slack Addon...');
    registerCommonHandlers(this);
    this.connectRTM();
  }

  /**
   * Connects to Slack RTM via WebSocket for real-time message reception.
   */
  private connectRTM(): void {
    // Get WSS URL from Slack
    this.axiosInstance.get('/rtm.connect').then((response) => {
      if (!response.data.ok) {
        log.error('Slack RTM connect failed:', response.data.error);
        return;
      }

      const wsURL = response.data.url;
      log.info('Connecting to Slack RTM WebSocket...');

      // Cache channel list
      response.data.channels?.forEach((ch: any) => {
        this.channels.set(ch.name, { name: ch.name, id: ch.id });
        this.channels.set(ch.id, { name: ch.name, id: ch.id });
      });

      const WebSocket = require('ws');
      this.ws = new WebSocket(wsURL);

      this.ws.on('open', () => {
        log.info('Slack RTM WebSocket connected.');
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleRTMMessage(message);
        } catch (err) {
          log.error('Error parsing Slack RTM message:', err);
        }
      });

      this.ws.on('error', (error: Error) => {
        log.error('Slack WebSocket error:', error);
        if (this.errorHandler) this.errorHandler(error);
      });

      this.ws.on('close', () => {
        log.info('Slack RTM WebSocket closed. Reconnecting in 5 seconds...');
        setTimeout(() => this.connectRTM(), 5000);
      });
    }).catch((error: Error) => {
      log.error('Failed to connect Slack RTM:', error);
      if (this.errorHandler) this.errorHandler(error);
      // Retry after 10 seconds
      setTimeout(() => this.connectRTM(), 10000);
    });
  }

  /**
   * Handles incoming RTM messages from Slack.
   */
  private handleRTMMessage(message: any): void {
    // Only process message events in the configured channel
    if (message.type !== 'message' || !message.channel) return;

    const targetChannel = cache.config.slack_channel_id;
    if (targetChannel && message.channel !== targetChannel) return;

    // Ignore bot messages (including our own)
    if (message.subtype === 'bot_message' || message.bot_id) return;

    // Build a Context-like object from the Slack message
    const ctx = this.buildContext(message);
    if (!ctx) return;

    // Process commands
    const text = ctx.message.text || '';
    if (text.startsWith('/')) {
      const parts = text.split(' ');
      const commandName = parts[0].substring(1).split(':')[0];
      const handlers = this.commandHandlers.get(commandName);
      if (handlers) {
        ctx.match = parts.slice(1).join(' ');
        handlers.forEach(handler => handler(ctx));
        return;
      }
    }

    // Process hears handlers
    for (const { trigger, callback } of this.hearsHandlers) {
      if (typeof trigger === 'string' && text === trigger) {
        callback(ctx);
        return;
      } else if (trigger instanceof RegExp && trigger.test(text)) {
        ctx.match = trigger.exec(text)?.toString() || '';
        callback(ctx);
        return;
      }
    }

    // Process generic message handlers
    const msgHandlers = this.eventHandlers['message'] || [];
    msgHandlers.forEach(handler => handler(ctx));
  }

  /**
   * Builds a Context object from a Slack RTM message.
   */
  private buildContext(msg: any): Context | null {
    if (!msg.user) return null;

    const text = msg.text || '';
    const userId = msg.user;
    const chatId = msg.channel;
    const threadTs = msg.thread_ts || msg.ts;

    // Extract reply info (thread parent)
    let replyToText = '';
    if (msg.parent_user_id) {
      replyToText = `#T${msg.parent_user_id} from`;
    }

    return {
      messenger: 'slack' as any,
      update_id: 0,
      message: {
        web_msg: false,
        message_id: parseInt(msg.ts?.replace('.', '') || '0'),
        from: {
          id: userId,
          is_bot: false,
          first_name: msg.username || `Slack User ${userId}`,
          username: msg.username || '',
          language_code: 'en',
        },
        chat: {
          id: chatId,
          first_name: this.channels.get(chatId)?.name || chatId,
          username: '',
          type: msg.channel.startsWith('C') ? 'group' : 'private',
        },
        date: Math.floor(Date.now() / 1000),
        text: text,
        reply_to_message: {
          from: { is_bot: false },
          text: replyToText,
          caption: '',
        },
        external_reply: { message_id: parseInt(msg.ts?.replace('.', '') || '0') },
        getFile: undefined,
        caption: '',
      },
      chat: {
        id: chatId,
        first_name: this.channels.get(chatId)?.name || chatId,
        username: '',
        type: msg.channel.startsWith('C') ? 'group' : 'private',
      },
      session: {} as any,
      callbackQuery: { data: '', from: { id: userId }, id: msg.ts || '' },
      from: { username: msg.username || '', id: userId },
      inlineQuery: null,
      reply: async (): Promise<void> => {},
      answerCbQuery: async (): Promise<void> => {},
      getChat: async (): Promise<{ id: string; first_name: string; username: string; type: string }> => ({ id: '', first_name: '', username: '', type: 'private' }),
      getFile: async (): Promise<unknown> => ({}),
    };
  }

  /**
   * Resolves a chatId to a Slack channel ID.
   */
  private resolveChannelId(chatId: string | number): string | null {
    const idStr = String(chatId);

    // If it's already a Slack channel ID (starts with C, G, D)
    if (/^[CDG].+$/.test(idStr)) return idStr;

    // Check configured channel
    if (idStr === 'default' || !idStr) {
      return cache.config.slack_channel_id || null;
    }

    // Look up by name
    const channel = this.channels.get(idStr);
    return channel ? channel.id : idStr;
  }
}

export default SlackAddon;
