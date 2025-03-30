import { Context, Config } from './interfaces';
import * as db from './db';
import * as log from 'fancy-log'

/**
 * Checks permissions for group and admin.
 *
 * @param ctx - Bot context.
 * @param config - Configuration containing categories and staffchat_id.
 * @returns A promise that resolves to true if permission is granted, otherwise false.
 */
async function checkRights(
  ctx: Context,
  config: { categories: any[]; staffchat_id: any },
): Promise<boolean> {
  const { categories, staffchat_id } = config;

  if (categories) {
    for (const category of categories) {
      // If there are no subgroups, check directly.
      if (!category.subgroups) {
        if (category.group_id === ctx.chat.id) {
          ctx.session.groupAdmin = category.name;
          break;
        }
      } else {
        for (const subgroup of category.subgroups) {
          if (subgroup.group_id === ctx.chat.id) {
            ctx.session.groupAdmin = subgroup.name;
            break;
          }
        }
        if (ctx.session.groupAdmin) break;
      }
    }
  }

  // If in a private chat, clear any group admin assignment.
  if (ctx.session.groupAdmin && ctx.chat.type === 'private') {
    ctx.session.groupAdmin = undefined;
  }

  const hasPermission =
    ctx.chat.id.toString() === staffchat_id || Boolean(ctx.session.groupAdmin);
  if (hasPermission) {
    log.info(`Permission granted for ${ctx.from.username}`);
  }
  return hasPermission;
}

/**
 * Defines user permissions by checking group/admin rights and ban status.
 *
 * @param ctx - Bot context.
 * @param next - Next function to call if permission checks pass.
 * @param config - Configuration settings.
 */
async function checkPermissions(ctx: Context, next: () => any, config: Config) {
  ctx.session.admin = false;
  try {
    const access = await checkRights(ctx, config);
    if (access) {
      ctx.session.admin = true;
    }
  } catch (error) {
    log.error('Error checking rights:', error);
  } finally {
    db.checkBan(ctx.chat.id, ctx.messenger, (ticket) => {
      if (ticket && ticket.status === 'banned') {
        return;
      }
      return next();
    });
  }
}

export { checkRights, checkPermissions };
