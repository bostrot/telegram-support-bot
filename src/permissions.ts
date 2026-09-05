import { Context, Config } from './interfaces';
import * as db from './db';
import * as team from './team';
import cache from './cache';
import * as log from './logger'

/**
 * Returns true when a staff chat message is outside the configured forum topic (#183).
 * Without staffchat_thread_id every topic of the staff chat is accepted.
 */
function isOutsideStaffThread(ctx: Context, staffchatId: string | number): boolean {
  const threadId = cache.config?.staffchat_thread_id;
  if (!threadId || ctx.chat.id.toString() !== staffchatId.toString()) return false;
  const msg = ctx.message?.message_id ? ctx.message : ctx.editedMessage;
  return (msg?.message_thread_id ?? null) !== threadId;
}

/**
 * Checks permissions for group and admin.
 */
async function checkRights(
  ctx: Context,
  config: { categories: Array<{ group_id: number | string; name?: string; subgroups?: Array<{ group_id: number | string; name: string }> }>; staffchat_id: string | number },
): Promise<boolean> {
  const { categories, staffchat_id } = config;

  if (categories) {
    for (const category of categories) {
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

  if (ctx.session.groupAdmin && ctx.chat.type === 'private') {
    ctx.session.groupAdmin = undefined;
  }

  let hasPermission =
    ctx.chat.id.toString() === staffchat_id.toString() || Boolean(ctx.session.groupAdmin);
  if (hasPermission && isOutsideStaffThread(ctx, staffchat_id)) {
    hasPermission = false;
  }
  if (hasPermission) {
    log.info(`Permission granted for @${ctx.from.username ?? '-'} (${ctx.from.id})`);
  }
  return hasPermission;
}

/**
 * Defines user permissions by checking group/admin rights and ban status.
 * Also initializes staff role cache.
 */
async function checkPermissions(ctx: Context, next: () => any, config: Config) {
  ctx.session.admin = false;
  try {
    const access = await checkRights(ctx, config);
    if (access) {
      ctx.session.admin = true;
      const role = team.getStaffRole(ctx.from.id.toString());
      if (role) {
        ctx.session.staffRole = role;
      }
    }
  } catch (error) {
    log.error('Error checking rights:', error);
  } finally {
    const ticket = await db.checkBan(ctx.chat.id, ctx.messenger);
    if (ticket && ticket.status === 'banned') {
      return;
    }
    next();
  }
}

export { checkRights, checkPermissions, isOutsideStaffThread };
