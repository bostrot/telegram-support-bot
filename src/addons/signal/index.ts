import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { Addon, Context } from '../../interfaces';
import cache from '../../cache';
import { mapSignalMessageToContext } from './mapper';
import { Group, SignalMessage } from './models';
import { registerCommonHandlers } from '../../handlers';
import * as db from '../../db';
import * as log from 'fancy-log';

const SEND_ENDPOINT = 'v2/send';
const GROUP_ENDPOINT = 'v1/groups';
const RECEIVE_ENDPOINT = 'v1/receive';
const ATTACHMENTS_ENDPOINT = 'v1/attachments';
const TYPING_INDICATOR_ENDPOINT = 'v1/typing-indicator';

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

  async sendMessage(chatId: string | number, text: string, options?: any): Promise<string | null> {
    try {
      // Build the payload in the required format.
      const payload = {
        base64_attachments: options?.base64_attachments || [],
        mentions: options?.mentions || [],
        message: text,
        notify_self: options?.notify_self !== undefined ? options.notify_self : true,
        number: PHONE_NUMBER,
        quote_author: options?.quote_author || "",
        // Use chatId as the sole recipient regardless of options
        recipients: [chatId],
        sticker: options?.sticker || "",
        text_mode: "styled"
      };
      const response = await this.axiosInstance.post(`/${SEND_ENDPOINT}`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      const timestamp = response.data.timestamp;
      log.info('Signal message sent successfully.');
      return timestamp;
    } catch (error) {
      log.error('Error sending Signal message:', error);
      if (this.errorHandler) this.errorHandler(error);
      return null;
    } finally {
      await this.hideTypingIndicator(chatId);
    }
  }

  async getGroupId(internalGroupId: string): Promise<string | null> {
    if (this.externalGroups[internalGroupId]) {
      return this.externalGroups[internalGroupId];
    }
    try {
      const response = await this.axiosInstance.get(`/${GROUP_ENDPOINT}/${PHONE_NUMBER}`);
      const groups = response.data as Group[];
      // Find the group that matches the internal ID
      const group = groups.find((group: Group) => group.internal_id === internalGroupId);
      return group ? group.id : null;
    } catch (error) {
      log.error('Error listing Signal groups:', error);
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
      // If the sender is in the group's admin list, mark as admin in the session
      if (group && admins.some((admin: string) => admin === ctx.from.id)) {
        ctx.session.admin = true;
      }
    } catch (error) {
      log.error('Error getting Signal group admins:', error);
    }
  }

  private setIsBot(signalMessage: SignalMessage, ctx: Context): void {
    // Mark as bot if the quoted message author is the bot's phone number
    if (signalMessage.envelope.dataMessage.quote?.authorNumber === PHONE_NUMBER) {
      ctx.message.reply_to_message.from.is_bot = true;
    }
  }

  // --- Helper method to send a file attachment ---
  private async sendFile(chatId: string | number, fileId: any, caption: string = ''): Promise<string | null> {
    try {
      // Download attachment by fileId
      const attachment = await this.axiosInstance.get(`/${ATTACHMENTS_ENDPOINT}/${fileId}`, { responseType: 'arraybuffer' });
      const base64File = Buffer.from(attachment.data).toString('base64');
      // Build the payload with the proper data URI format
      const payload = {
        base64_attachments: [
          `data:${attachment.headers['content-type']};filename:${fileId};base64,${base64File}`
        ],
        message: caption,
        number: PHONE_NUMBER,
        // Use chatId as the sole recipient
        recipients: [chatId],
        text_mode: "styled"
      };
      const response = await this.axiosInstance.post(`/${SEND_ENDPOINT}`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      // Delete the temporary downloaded attachment
      await this.axiosInstance.delete(`/${ATTACHMENTS_ENDPOINT}/${fileId}`);
      log.info(`Signal file ${fileId} sent successfully.`);
      return response.data.timestamp;
    } catch (error) {
      log.error(`Error sending Signal file ${fileId}:`, error);
      if (this.errorHandler) this.errorHandler(error);
      return null;
    } finally {
      await this.hideTypingIndicator(chatId);
    }
  }
  // --- End helper method ---

  // --- Updated file upload methods using base64_attachments and chatId as recipient ---
  async sendPhoto(chatId: string | number, photoId: any, options?: any): Promise<string | null> {
    // Use the helper method with an optional caption.
    return await this.sendFile(chatId, photoId, options?.caption || '');
  }

  async sendVideo(chatId: string | number, videoId: any, options?: any): Promise<string | null> {
    // Use the helper method with an optional caption.
    return await this.sendFile(chatId, videoId, options?.caption || '');
  }

  async sendDocument(chatId: string | number, documentId: any, options?: any): Promise<string | null> {
    // Use the helper method with an optional caption.
    return await this.sendFile(chatId, documentId, options?.caption || '');
  }
  
  private async showTypingIndicator(chatId: string | number): Promise<void> {
    try {
      await this.axiosInstance.put(`/${TYPING_INDICATOR_ENDPOINT}/${PHONE_NUMBER}`, { recipient: chatId }, {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (this.errorHandler) this.errorHandler(error);
    }
  }

  private async hideTypingIndicator(chatId: string | number): Promise<void> {
    try {
      await this.axiosInstance.delete(`/${TYPING_INDICATOR_ENDPOINT}/${PHONE_NUMBER}`, {
        data: { recipient: chatId },
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
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
    log.info('Starting Signal Addon with WebSocket connection...');
    // Register commands.
    registerCommonHandlers(this);
    // Open the WebSocket connection.
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    this.ws = new WebSocket(this.wsURL);
    this.ws.on('open', () => {
      log.info('WebSocket connection established for Signal.');
    });
    this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));
    this.ws.on('error', (error) => {
      log.error('WebSocket error:', error);
      if (this.errorHandler) this.errorHandler(error);
    });
    this.ws.on('close', () => {
      log.info('WebSocket connection closed. Reconnecting in 5 seconds...');
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }

  private isGroup(ctx: Context): boolean {
    return ctx.chat.type === 'group';
  }

  private async setExternalGroupId(ctx: Context) {
    if (this.isGroup(ctx) && ctx.chat.id) {
      const groupId = ctx.chat.id;
      const externalGroupId = await this.getGroupId(groupId);
      if (externalGroupId) {
        this.externalGroups[groupId] = externalGroupId;
        ctx.chat.id = externalGroupId;
        log.info(`Mapped internal group ID ${groupId} to external group ID ${externalGroupId}`);
      } else {
        log.error(`Failed to map internal group ID ${groupId} to external group ID.`);
      }
    }
  }

  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const signalMessage = JSON.parse(data.toString()) as SignalMessage;
      if (signalMessage.envelope.dataMessage === undefined) {
        return;
      }
      
      // Map the raw Signal message to a Context.
      const messageContext: Context = mapSignalMessageToContext(signalMessage);
      
      // Show typing indicator immediately when a message (or attachment) is received.
      await this.showTypingIndicator(messageContext.chat.id);
      // Schedule hiding the indicator after 10 seconds in case no outgoing response is sent.
      setTimeout(() => {
        this.hideTypingIndicator(messageContext.chat.id);
      }, 10000);
      
      // Set external group id if needed.
      await this.setExternalGroupId(messageContext);
      // Set group admin flag.
      await this.setGroupAdmin(messageContext);
      // Mark message as coming from a bot if applicable.
      this.setIsBot(signalMessage, messageContext);
  
      // Process attachments if present.
      const attachments = signalMessage.envelope.dataMessage.attachments;
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.contentType.startsWith('image/')) {
            if (this.eventHandlers[':photo']) {
              this.eventHandlers[':photo'].forEach(handler => handler(messageContext));
            }
          } else if (attachment.contentType.startsWith('video/')) {
            if (this.eventHandlers[':video']) {
              this.eventHandlers[':video'].forEach(handler => handler(messageContext));
            }
          } else {
            if (this.eventHandlers[':document']) {
              this.eventHandlers[':document'].forEach(handler => handler(messageContext));
            }
          }
        }
        // Optionally, attachments can be processed exclusively.
        return;
      }
      
      // Process command handlers if message starts with a slash.
      let isCommand = false;
      if (messageContext.message && typeof messageContext.message.text === 'string' &&
          messageContext.message.text.startsWith('/')) {
        isCommand = true;
        const parts = messageContext.message.text.split(' ');
        const commandName = parts[0].substring(1);
        const commandKey = `command:${commandName}`;
        if (this.eventHandlers[commandKey]) {
          this.eventHandlers[commandKey].forEach(handler => handler(messageContext));
        }
      }
      
      // Process generic message handlers.
      if (this.eventHandlers['message']) {
        this.eventHandlers['message'].forEach(handler => handler(messageContext));
      }
      
      // Process hears handlers if message is not a command.
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
      log.error('Error processing WebSocket message:', err);
    }
  }  
}

export default SignalAddon;
