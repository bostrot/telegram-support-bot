import * as db from './db';
import config from '../config/config';
import * as middleware from './middleware';

/**
 * Helper function for reply keyboard
 * @param {Array} keys
 * @return {Object} reply_markup
 */
function replyKeyboard(keys) {
  return {
    parse_mode: 'html',
    reply_markup: {
      keyboard: keys,
    },
  };
};

/**
 * Helper function to remove keyboard
 * @return {Object} reply_markup
 */
function removeKeyboard() {
  return {
    parse_mode: 'html',
    reply_markup: {
      remove_keyboard: true,
    },
  };
};

/**
 * Initialize categories from config
 * @param {Object} bot
 * @param {Object} config
 * @return {Array} keys
 */
function initInline(bot, config) {
  const keys = [];
  // Get categories from config file
  for (const i in config.categories) {
    if (i !== undefined) {
      keys.push([config.categories[i].name]);
      const subKeys = [];
      // Check if it has no subcategory
      if (config.categories[i].subgroups == undefined) {
        // Create category button events for start with parameter
        // Full category name to 64 Byte without special chars
        let startStr = '/start ' + config.categories[i].name
          .replace(/[\[\]\:\ "]/g, '')
          .substr(0,63);
        bot.hears(startStr, (ctx) => {
          ctx.session.mode = undefined;
          ctx.session.modeData = undefined;
          // Info text
          if (config.categories[i].msg != undefined) {
            ctx.reply(config.categories[i].msg);
          } else {
            ctx.reply(config.language.msgForwarding + '\n' +
              `<b>${config.categories[i].name}</b>`, removeKeyboard());
            ctx.session.group = config.categories[i].group_id;
            ctx.session.groupCategory = config.categories[i].name;
          }
        });
        // Create subcategory button events
        bot.hears(config.categories[i].name, (ctx) => {
          ctx.session.mode = undefined;
          ctx.session.modeData = undefined;
          // Info text
          if (config.categories[i].msg != undefined) {
            ctx.reply(config.categories[i].msg);
          } else {
            ctx.reply(config.language.msgForwarding + '\n' +
              `<b>${config.categories[i].name}</b>`, removeKeyboard());
            ctx.session.group = config.categories[i].group_id;
            ctx.session.groupCategory = config.categories[i].name;
          }
        });
        continue;
      }
      // Get subcategories
      for (const j in config.categories[i].subgroups) {
        if (j !== undefined) {
          let categoryFullId = [config.categories[i].name +
          ': ' + config.categories[i].subgroups[j].name];
          subKeys.push(categoryFullId);
          
          // Create subcategory button events for start with parameter
          // Full category name to 64 Byte without special chars
          let startStr = '/start ' + JSON.stringify(categoryFullId)
            .replace(/[\[\]\:\ "]/g, '')
            .substr(0,63);
          bot.hears(startStr, (ctx) => {
            ctx.session.mode = undefined;
            ctx.session.modeData = undefined;
            ctx.reply(config.language.msgForwarding + '\n' +
              `<b>${categoryFullId}</b>`, removeKeyboard());
            // Set subgroup
            ctx.session.group = config.categories[i].subgroups[j].group_id;
            ctx.session.groupCategory = config.categories[i].subgroups[j].name;
          });
          
          // Create subcategory button events
          bot.hears(categoryFullId, (ctx) => {
            ctx.session.mode = undefined;
            ctx.session.modeData = undefined;
            ctx.reply(config.language.msgForwarding + '\n' +
              `<b>${categoryFullId}</b>`, removeKeyboard());
            // Set subgroup
            ctx.session.group = config.categories[i].subgroups[j].group_id;
            ctx.session.groupCategory = config.categories[i].subgroups[j].name;
          });
        }
      }
      subKeys.push([config.language.back]);
      // Create subcategory buttons
      bot.hears(config.categories[i].name, (ctx) => {
        ctx.session.mode = undefined;
        ctx.session.modeData = undefined;
        ctx.reply(config.language.whatSubCategory,
            replyKeyboard(subKeys));
      });
    }
  }
  return keys;
};

/**
 * Callback query handler
 * @param {Object} bot
 * @param {Object} ctx
 */
function callbackQuery(bot, ctx) {
  // Check whether to end callback session
  if (ctx.callbackQuery.data === 'R') {
    ctx.session.mode = undefined;
    ctx.session.modeData = undefined;
    ctx.reply(config.language.prvChatEnded);
    return;
  }
  // Get Ticket ID from DB
  const id = ctx.callbackQuery.data.split('---')[0];
  const name = ctx.callbackQuery.data.split('---')[1];
  let category = ctx.callbackQuery.data.split('---')[2];
  const ticketid = ctx.callbackQuery.data.split('---')[3];
  ctx.session.mode = 'private_reply';
  ctx.session.modeData = {
    ticketid: ticketid,
    userid: id,
    name: name,
    category: category,
  };
  middleware.msg(ctx.callbackQuery.from.id, ctx.chat.type !== 'private' ?
    `${config.language.ticket} ` +
    `#T${ticketid.toString().padStart(6, '0')}` +
    `\n\n` +
    config.language.prvChatOpened : config.language.prvChatOpenedCustomer,
    {
      parse_mode: 'html',
      reply_markup: {
        html: '',
        inline_keyboard: [
          [
            {
              'text': config.language.prvChatEnd,
              'callback_data': 'R',
            },
          ],
        ],
      },
    });

  // TODO: forward to bot? not possible without triggering start command
  // var t = ('https://t.me/' + bot.options.username + '?start=X');
  ctx.answerCbQuery(config.language.instructionsSent, true,
      /* {
        'url': t,
      } */
    );
};

export {
  callbackQuery,
  initInline,
  replyKeyboard,
  removeKeyboard,
};
