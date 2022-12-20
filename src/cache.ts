import { Cache, Config } from './interfaces';
import TelegramAddon from './addons/telegram';
import * as YAML from 'yaml';
import * as fs from 'fs';

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

cache.config = YAML.parse(
  fs.readFileSync('./config/config.yaml', 'utf8'),
);

export default cache;
