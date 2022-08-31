import {Context} from './interfaces';
import * as db from './db';
import {Config} from './interfaces';

/**
 * Check permissions of group and admin
 * @param {Context} ctx
 * @param {Object} config
 * @return {Promise} promise
 */
function checkRights(
    ctx: Context,
    config: { categories: any[]; staffchat_id: any },
) {
  return new Promise(function(resolve, reject) {
    // Is staff - category group
    if (config.categories) {
      config.categories.forEach((element, index) => {
        // No subgroup
        if (config.categories[index].subgroups == undefined) {
          if (config.categories[index].group_id == ctx.chat.id) {
            ctx.session.groupAdmin = config.categories[index].name;
          }
        } else {
          config.categories[index].subgroups.forEach(
              (
              // eslint-disable-next-line max-len
                  innerElement: { group_id: { toString: () => any }; name: any },
                  index: any,
              ) => {
                if (innerElement.group_id == ctx.chat.id) {
                  ctx.session.groupAdmin = innerElement.name;
                }
              },
          );
        }
      });
    }
    if (ctx.session.groupAdmin && ctx.chat.type == 'private') {
      ctx.session.groupAdmin = undefined;
    }
    // Is admin group
    if (
      ctx.chat.id.toString() === config.staffchat_id ||
      ctx.session.groupAdmin
    ) {
      console.log('Permission granted for ' + ctx.from.username);
      resolve(true);
    } else resolve(false);
  });
}

/**
 * Define user permission
 * @param {Context} ctx
 * @param {Function} next
 * @param {Config} config
 */
function checkPermissions(ctx: Context, next: () => any, config: Config) {
  ctx.session.admin = false;
  checkRights(ctx, config)
      .then((access) => {
        if (access) ctx.session.admin = true;
      })
      .finally(() => {
        db.checkBan(ctx.chat.id, function(ticket) {
          if (ticket != undefined && ticket.status == 'banned') {
            return;
          }
          return next();
        });
      });
}

export {checkRights, checkPermissions};
