import { Cache, Config } from './interfaces';
import * as YAML from 'yaml';
import * as fs from 'fs';

const cache: Cache = {
  userId: '',
  ticketIDs: [],
  ticketStatus: {},
  ticketSent: [],
  html: '',
  noSound: '',
  markdown: '',
  io: {},
  config: {
    use_llm: false
  } as Config,
};

cache.config = YAML.parse(
  fs.readFileSync('./config/config.yaml', 'utf8'),
);

export default cache;
