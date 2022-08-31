import {Cache, Config} from './interfaces';
import TelegramAddon from './addons/telegram';

const cache: Cache = {
  ticketID: '',
  ticketIDs: [],
  ticketStatus: {},
  ticketSent: [],
  html: '',
  noSound: '',
  markdown: '',
  io: {},
  bot: {} as TelegramAddon,
  config: {} as Config,
};

export default cache;
