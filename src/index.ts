import fs from 'fs';
import { migrateData } from './migrate';
import cache from './cache';
import { Addon } from './interfaces';
import * as db from './db';
import * as error from './error';
import TelegramAddon from './addons/telegram';
import SignalAddon from './addons/signal';
import SlackAddon from './addons/slack';
import DiscordAddon from './addons/discord';
import * as team from './team';
import * as analytics from './analytics';
import * as workflows from './workflows';
import * as recovery from './recovery';
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

  // Create Slack addon if enabled.
  if (cache.config && cache.config.slack_enabled) {
    const slackAddon = SlackAddon.getInstance();
    (slackAddon as any).platform = 'slack';
    addons.push(slackAddon);
  }

  // Create Discord addon if enabled.
  if (cache.config && cache.config.discord_enabled) {
    const discordAddon = DiscordAddon.getInstance();
    (discordAddon as any).platform = 'discord';
    addons.push(discordAddon);
  }

  return addons;
}

/**
 * Main initialization function.
 */
async function main(logs = true) {
  await db.connect();
  await checkAndMigrateDatabase();

  // Run startup recovery: scan chat history to discover highest ticket ID
  try {
    await recovery.runRecovery();
  } catch (err) {
    log.error('Startup recovery failed — bot will continue with DB-only fallback:', err);
  }

  // Initialize staff member cache from config
  team.initStaffCache();

  // Create and store all enabled addons.
  const addons = createAddons();

  // Initialize the webserver if enabled and if there's a Telegram addon.
  const telegramAddon = addons.find((addon) => (addon as any).platform === 'telegram');

  // Initialize global error handling.
  error.init(logs);

  // Start each addon. Each addon handles its own platform-specific configuration.
  addons.forEach((addon) => {
    addon.start();
  });

  // Set up daily summary cron job
  const summaryTime = cache.config.daily_summary_time || '09:00';
  if (summaryTime) {
    const [hours, minutes] = summaryTime.split(':').map(Number);
    const runDailySummary = () => {
      analytics.sendDailySummary().then(() => {
        // Schedule for next day at the same time
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes);
        const delay = target.getTime() - now.getTime();
        setTimeout(runDailySummary, delay);
      });
    };

    // Calculate initial delay to first run time
    const now = new Date();
    const targetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    let delay = targetToday.getTime() - now.getTime();
    if (delay < 0) {
      // If the time has already passed today, schedule for tomorrow
      delay += 86400000;
    }
    setTimeout(runDailySummary, Math.max(delay, 0));
    log.info(`Daily summary scheduled at ${summaryTime} UTC (first run in ${Math.round(delay / 60000)} min)`);
  }

  // Set up periodic workflow checks (every 30 minutes)
  const workflowInterval = setInterval(() => {
    workflows.runWorkflowChecks();
  }, 30 * 60 * 1000);
  workflowInterval.unref(); // Don't keep process alive
  log.info('Workflow periodic checks started (every 30 min)');
}

main();

export { createAddons, main };
