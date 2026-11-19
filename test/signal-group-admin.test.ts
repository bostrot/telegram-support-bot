// Tests for the Signal addon: staff (admin) rights must be tied to the configured staff group (GHSA-wq8w-p5p2-r74c)
const mockAxiosGet = jest.fn();

jest.mock('axios', () => ({
  create: jest.fn(() => ({ get: mockAxiosGet, post: jest.fn() })),
}));
jest.mock('../src/handlers', () => ({ registerCommonHandlers: jest.fn() }));
jest.mock('../src/cache', () => ({
  __esModule: true,
  default: {
    config: {
      signal_number: '+10000000000',
      signal_host: 'signal-cli:40153',
      staffchat_id: 'STAFF_GROUP',
      staffchat_thread_id: null,
      categories: [{ group_id: 'CATEGORY_GROUP', name: 'Billing' }],
    },
  },
}));

import SignalAddon from '../src/addons/signal';

const ATTACKER = '+19999999999';

function groupCtx(groupId: string): any {
  return {
    chat: { id: groupId, type: 'group' },
    from: { id: ATTACKER, username: 'attacker' },
    message: {},
    session: {},
  };
}

describe('SignalAddon setGroupAdmin', () => {
  const addon: any = SignalAddon.getInstance();

  beforeEach(() => {
    mockAxiosGet.mockReset();
    // The sender is an admin of whatever Signal group is queried.
    mockAxiosGet.mockResolvedValue({ data: { admins: [ATTACKER] } });
  });

  it('does not grant admin to an admin of an unconfigured Signal group', async () => {
    const ctx = groupCtx('ATTACKER_GROUP');
    await addon.setGroupAdmin(ctx);
    expect(ctx.session.admin).toBeFalsy();
  });

  it('grants admin to a group admin in the configured staff chat', async () => {
    const ctx = groupCtx('STAFF_GROUP');
    await addon.setGroupAdmin(ctx);
    expect(ctx.session.admin).toBe(true);
  });

  it('grants admin to a group admin in a configured category group', async () => {
    const ctx = groupCtx('CATEGORY_GROUP');
    await addon.setGroupAdmin(ctx);
    expect(ctx.session.admin).toBe(true);
    expect(ctx.session.groupAdmin).toBe('Billing');
  });

  it('does not grant admin to a non-admin member of the staff chat', async () => {
    mockAxiosGet.mockResolvedValue({ data: { admins: ['+15555555555'] } });
    const ctx = groupCtx('STAFF_GROUP');
    await addon.setGroupAdmin(ctx);
    expect(ctx.session.admin).toBeFalsy();
  });

  it('does not grant admin in private chats', async () => {
    const ctx = groupCtx(ATTACKER);
    ctx.chat.type = 'private';
    await addon.setGroupAdmin(ctx);
    expect(ctx.session.admin).toBeFalsy();
  });
});
