// Tests for inline callback authorization: unassign:<ticketId> must require the assign permission
jest.mock('../src/addons/telegram', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../src/middleware', () => ({ reply: jest.fn(), sendMessage: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/team', () => ({
  canPerformAction: jest.fn(),
  assignTicketCommand: jest.fn().mockResolvedValue(undefined),
  unassignTicketCommand: jest.fn().mockResolvedValue(undefined),
}));

import * as team from '../src/team';
import { callbackQuery } from '../src/inline';

function cbCtx(data: string): any {
  return {
    callbackQuery: { data, from: { id: 42 }, id: 'cb1' },
    chat: { id: 'staff', type: 'group' },
    session: {},
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
  };
}

describe('inline.callbackQuery unassign', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects unassign from a user without the assign permission', async () => {
    (team.canPerformAction as jest.Mock).mockReturnValue(false);
    const ctx = cbCtx('unassign:7');
    await callbackQuery(ctx);
    expect(team.canPerformAction).toHaveBeenCalledWith('42', 'assign');
    expect(team.unassignTicketCommand).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('You cannot unassign tickets.', true);
  });

  it('allows unassign for a user with the assign permission', async () => {
    (team.canPerformAction as jest.Mock).mockReturnValue(true);
    const ctx = cbCtx('unassign:7');
    await callbackQuery(ctx);
    expect(team.unassignTicketCommand).toHaveBeenCalledWith(ctx, 7);
  });
});
