const session = require('telegraf/session');
import * as db from './db';

/**
 * Check permissions of group and admin
 * @param {Object} ctx
 * @param {Object} config
 * @return {Promise} promise
 */
function checkRights(ctx, config) {
  return new Promise(function (resolve, reject) {
    // Is staff - category group
    if (config.categories) {
      config.categories.forEach((element, index) => {
        // No subgroup
        if (config.categories[index].subgroups == undefined) {
          if (config.categories[index].group_id == ctx.chat.id) {
            ctx.session.groupAdmin = config.categories[index].name;
          }
        } else {
          config.categories[index].subgroups.forEach((innerElement, index) => {
            if (innerElement.group_id == ctx.chat.id) {
              ctx.session.groupAdmin = innerElement.name;
            }
          });
        }
      });
    }
    if (ctx.session.groupAdmin && ctx.chat.type == 'private') {
      ctx.session.groupAdmin = undefined;
    }
    // Is admin group
    if (ctx.chat.id.toString() === config.staffchat_id ||
      ctx.session.groupAdmin) {
      console.log('Permission granted for ' + ctx.from.username);
      resolve(true);
    } else resolve(false);
  });
};

/**
 * Adds session middleware
 * @return {String} userid:chatid
 */
function currentSession() {
  return session({
    getSessionKey: (ctx) => {
      if (ctx.callbackQuery && ctx.callbackQuery.id) {
        return `${ctx.from.id}:${ctx.from.id}`;
      } else if (ctx.from && ctx.inlineQuery) {
        return `${ctx.from.id}:${ctx.from.id}`;
      } else if (ctx.from && ctx.chat) {
        return `${ctx.from.id}:${ctx.chat.id}`;
      };
      return null;
    },
  });
};

/**
 * Define user permission
 * @param {Object} ctx
 * @param {Function} next
 * @param {Object} config
 */
function checkPermissions(ctx, next, config) {
  ctx.session.admin = false;
  checkRights(ctx, config).then((access) => {
    if (access) ctx.session.admin = true;
  }).finally(() => {
    db.checkBan(ctx.chat.id, function (ticket) {
      if (ticket != undefined && ticket.status == 'banned') {
        return;
      }
      return next();
    })
  });
};

export {
  checkRights,
  currentSession,
  checkPermissions,
};