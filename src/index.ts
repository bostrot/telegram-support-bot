import fs from 'fs';
import { migrateData } from './migrate';
import cache from './cache';
import { Addon } from './interfaces';
import * as db from './db';
import * as error from './error';
import TelegramAddon from './addons/telegram';
import SignalAddon from './addons/signal';
import * as log from 'fancy-log'

/**
 * Check and migrate SQLite database to MongoDB.
 */
async function checkAndMigrateDatabase() {
  const sqliteDbPath = './config/support.db';
  const migratedDbPath = './config/support.old.db';

  if (fs.existsSync(sqliteDbPath)) {
    log.info('SQLite database detected. Starting migration...');
    try {
      await migrateData();
      fs.renameSync(sqliteDbPath, migratedDbPath);
      log.info('Migration completed successfully. Renamed support.db to support.old.db');
    } catch (err) {
      log.error('Migration failed:', err);
      process.exit(1);
    }
  } else {
    log.info('No SQLite database detected. Skipping migration.');
  }
}

/**
 * Factory function to create enabled addons.
 */
function createAddons(): Addon[] {
  const addons: Addon[] = [];

  // Create Telegram addon if a bot token is provided.
  if (cache.config && cache.config.bot_token) {
    if (cache.config.bot_token === 'YOUR_BOT_TOKEN') {
      log.error('Please change your bot token in config/config.yaml');
      process.exit(1);
    }
    const telegram = TelegramAddon.getInstance(cache.config.bot_token);
    // Tag the addon with its platform (for later identification).
    (telegram as any).platform = 'telegram';
    addons.push(telegram);
  }

  // Create Signal addon if enabled.
  if (cache.config && cache.config.signal_enabled) {
    const signalAddon = SignalAddon.getInstance();
    (signalAddon as any).platform = 'signal';
    addons.push(signalAddon);
  }

  return addons;
}

/**
 * Main initialization function.
 */
async function main(logs = true) {
  await db.connect();
  await checkAndMigrateDatabase();

  // Create and store all enabled addons.
  const addons = createAddons();
  // cache.addons = addons;

  // Initialize the webserver if enabled and if there's a Telegram addon.
  const telegramAddon = addons.find((addon) => (addon as any).platform === 'telegram');
  if (cache.config.web_server && telegramAddon) {
    // webserver.init(telegramAddon);
  }

  // Initialize global error handling.
  error.init(logs);

  // Start each addon. Each addon handles its own platform-specific configuration.
  addons.forEach((addon) => {
    addon.start();
  });
}

main();

export { createAddons, main };
