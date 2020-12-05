const db = require('./db');
const config = require('../config/config');

/**
 * Helper function for reply keyboard
 * @param {Array} keys
 * @return {Object} reply_markup
 */
function replyKeyboard(keys) {
  return {
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
      // Get subcategories
      for (const j in config.categories[i].subgroups) {
        if (j !== undefined) {
          subKeys.push([config.categories[i].subgroups[j].name]);
          // Create subcategory button events
          bot.hears(config.categories[i].subgroups[j].name, (ctx) => {
            ctx.reply(
                'You messages will now be forwarded to vendors of the group: ' +
              config.categories[i].subgroups[j].name, removeKeyboard());
            // Set subgroup
            ctx.session.group = config.categories[i].subgroups[j].group_id;
            ctx.session.groupCategory = config.categories[i].subgroups[j].name;
          });
          subKeys.push(['Go back']);
        }
      }
      // Create subcategory buttons
      bot.hears(config.categories[i].name, (ctx) => {
        ctx.reply(
            'Which subcategory describes your needs the best? ',
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
    ctx.reply('Private chat ended.');
    return;
  }
  // Get Ticket ID from DB
  db.check(ctx.callbackQuery.data, function(ticket) {
    ctx.session.mode = 'private_reply';
    ctx.session.modeData = {
      ticketid: ctx.callbackQuery.data,
      userid: ticket.userid,
    };
    bot.telegram.sendMessage(ctx.callbackQuery.from.id,
        `${config.lang_ticket} ` +
        `#T${ticket.id.toString().padStart(6, '0')}` +
        `\n\n` +
        `Private Chat opened with customer.`,
        {
          parse_mode: 'html',
          reply_markup: {
            html: '',
            inline_keyboard: [
              [
                {
                  'text': 'End Private chat',
                  'callback_data': 'R',
                },
              ],
            ],
          },
        }
    );
  });
  ctx.answerCbQuery('Instructions were sent to you in private chat.');
};

module.exports = {
  callbackQuery,
  initInline,
  replyKeyboard,
  removeKeyboard,
};
