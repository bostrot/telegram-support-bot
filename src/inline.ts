import { Context, Messenger, ModeData } from './interfaces';
import TelegramAddon from './addons/telegram';
import cache from './cache';
import * as middleware from './middleware';

/**
 * Helper function for reply keyboard.
 *
 * @param keys - Keyboard keys.
 * @returns An object containing reply_markup.
 */
const replyKeyboard = (keys: any[]) => ({
  parse_mode: cache.config.parse_mode,
  reply_markup: { keyboard: keys },
});

/**
 * Helper function to remove keyboard.
 *
 * @returns An object with remove_keyboard option.
 */
const removeKeyboard = () => ({
  parse_mode: cache.config.parse_mode,
  reply_markup: { remove_keyboard: true },
});

/**
 * Creates a handler for category selection (without subgroups).
 *
 * @param category - The category object from config.
 * @returns A function that handles category selection.
 */
const createCategoryHandler = (category: any) => (ctx: Context) => {
  ctx.session.mode = '';
  ctx.session.modeData = {} as ModeData;
  if (category.msg !== undefined) {
    middleware.reply(ctx, category.msg);
  } else {
    middleware.reply(
      ctx,
      `${cache.config.language.msgForwarding}\n*${category.name}*`,
      removeKeyboard()
    );
  }
  ctx.session.group = category.group_id;
  ctx.session.groupTag = category.tag || '';
  ctx.session.groupCategory = category.name;
};

/**
 * Creates a handler for subcategory selection.
 *
 * @param category - The parent category object.
 * @param subgroup - The subgroup object.
 * @param displayName - The display name for the subcategory.
 * @returns A function that handles subcategory selection.
 */
const createSubcategoryHandler = (category: any, subgroup: any, displayName: string) => (ctx: Context) => {
  ctx.session.mode = '';
  ctx.session.modeData = {} as ModeData;
  middleware.reply(
    ctx,
    `${cache.config.language.msgForwarding}\n*${displayName}*`,
    removeKeyboard()
  );
  ctx.session.group = subgroup.group_id;
  ctx.session.groupCategory = subgroup.name;
};

/**
 * Initializes inline keyboard buttons and event handlers for categories and subgroups.
 *
 * @param bot - Instance of the Telegram addon.
 * @returns An array of keys for the inline keyboard.
 */
function initInline(bot: TelegramAddon) {
  const keys: string[][] = [];
  const { categories, language } = cache.config;

  if (categories === undefined) {
    return keys;
  }
  for (const category of categories) {
    keys.push([category.name]);

    // If there are no subgroups, register category handlers directly.
    if (!Array.isArray(category.subgroups) || category.subgroups.length === 0) {
      // Create a start command string by removing special characters and limiting length.
      const startStr = `/start ${category.name.replace(/[\[\]\:\ "]/g, '').substring(0, 63)}`;
      const handler = createCategoryHandler(category);

      bot.hears(startStr, handler);
      bot.hears(category.name, handler);
      continue;
    }

    // Process subgroups.
    const subKeys: string[][] = [];
    for (const subgroup of category.subgroups) {
      const fullDisplayName = `${category.name}: ${subgroup.name}`;
      // For consistency with original code, wrap display name in an array.
      const fullNameKey = [fullDisplayName];
      subKeys.push(fullNameKey);

      // Generate a start command string for the subcategory.
      const startStr = `/start ${JSON.stringify(fullNameKey)
        .replace(/[\[\]\:\ "]/g, '')
        .substring(0, 63)}`;

      const subHandler = createSubcategoryHandler(category, subgroup, fullDisplayName);
      bot.hears(startStr, subHandler);
      bot.hears(fullNameKey, subHandler);
    }

    // Append a "back" option.
    subKeys.push([language.back]);

    // When the category name is heard, display its subcategories.
    bot.hears(category.name, (ctx: Context) => {
      ctx.session.mode = '';
      ctx.session.modeData = {} as ModeData;
      middleware.reply(ctx, language.whatSubCategory, replyKeyboard(subKeys));
    });
  }
  return keys;
}

/**
 * Handles callback queries.
 *
 * @param ctx - The context of the callback.
 */
function callbackQuery(ctx: Context) {
  // End callback session if data equals 'R'
  if (ctx.callbackQuery.data === 'R') {
    ctx.session.mode = '';
    ctx.session.modeData = {} as ModeData;
    middleware.reply(ctx, cache.config.language.prvChatEnded);
    return;
  }
  // Extract parts from callback data.
  const [id, name, category, ticketid] = ctx.callbackQuery.data.split('---');

  ctx.session.mode = 'private_reply';
  ctx.session.modeData = {
    ticketid,
    userid: id,
    name,
    category,
  };

  const messageText =
    ctx.chat.type !== 'private'
      ? `${cache.config.language.ticket} #T${ticketid.toString().padStart(6, '0')}\n\n${cache.config.language.prvChatOpened}`
      : cache.config.language.prvChatOpenedCustomer;

  middleware.sendMessage(ctx.callbackQuery.from.id, Messenger.TELEGRAM, messageText, {
    parse_mode: cache.config.parse_mode,
    reply_markup: {
      html: '',
      inline_keyboard: [
        [
          {
            text: cache.config.language.prvChatEnd,
            callback_data: 'R',
          },
        ],
      ],
    },
  });

  ctx.answerCbQuery(cache.config.language.instructionsSent, true);
}

export { callbackQuery, initInline, replyKeyboard, removeKeyboard };
