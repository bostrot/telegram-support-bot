// Tests for the Signal addon dispatch: command arguments (#85/#159) and the fall-through
// to hears handlers that makes custom user commands (#84) and canned responses work.
const axiosInstance = {
  post: jest.fn().mockResolvedValue({ data: { timestamp: 1700000000 } }),
  get: jest.fn().mockResolvedValue({ data: [] }),
  put: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
};

jest.mock('axios', () => ({ create: jest.fn(() => axiosInstance) }));
jest.mock('ws', () => jest.fn().mockImplementation(() => ({ on: jest.fn() })));
jest.mock('../src/handlers', () => ({ registerCommonHandlers: jest.fn() }));
jest.mock('../src/cache', () => ({
  __esModule: true,
  default: { config: { signal_number: '+490000', signal_host: 'signal:8080' } },
}));

import SignalAddon from '../src/addons/signal';
import { Context } from '../src/interfaces';
import { SignalMessage } from '../src/addons/signal/models';

const signalMessage = (message: string): SignalMessage =>
  ({
    account: '+490000',
    envelope: {
      source: '+491111',
      sourceNumber: '+491111',
      sourceUuid: 'uuid',
      sourceName: 'Alice Example',
      sourceDevice: 1,
      timestamp: 1700000000,
      serverReceivedTimestamp: 1700000000,
      serverDeliveredTimestamp: 1700000000,
      dataMessage: {
        timestamp: 1700000000,
        message,
        expiresInSeconds: 0,
        viewOnce: false,
      },
    },
  } as SignalMessage);

const deliver = async (addon: SignalAddon, message: string): Promise<void> => {
  await (addon as unknown as { handleMessage: (data: string) => Promise<void> }).handleMessage(
    JSON.stringify(signalMessage(message)),
  );
};

describe('SignalAddon dispatch', () => {
  const addon = SignalAddon.getInstance();
  const handlers = (addon as unknown as { eventHandlers: Record<string, unknown[]> }).eventHandlers;
  const hears = (addon as unknown as { hearsHandlers: unknown[] }).hearsHandlers;

  // handleMessage schedules a 10s timer to hide the typing indicator
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    hears.length = 0;
  });

  it('passes the text behind a command as ctx.match (#85, #159)', async () => {
    const ticket = jest.fn();
    addon.command('ticket', ticket);
    await deliver(addon, '/ticket 1234');

    expect(ticket).toHaveBeenCalledTimes(1);
    expect((ticket.mock.calls[0][0] as Context).match).toBe('1234');
  });

  it('keeps multi-word arguments intact for /broadcast', async () => {
    const broadcast = jest.fn();
    addon.command('broadcast', broadcast);
    await deliver(addon, '/broadcast we are back online');

    expect((broadcast.mock.calls[0][0] as Context).match).toBe('we are back online');
  });

  it('leaves ctx.match empty for a command without arguments', async () => {
    const open = jest.fn();
    addon.command('open', open);
    await deliver(addon, '/open');

    expect((open.mock.calls[0][0] as Context).match).toBe('');
  });

  it('routes unknown slash commands to hears with the capture group (#84)', async () => {
    const canned = jest.fn();
    addon.hears(/^\/(\w+)(?:@\w+)?$/, canned);
    await deliver(addon, '/faq');

    expect(canned).toHaveBeenCalledTimes(1);
    const ctx = canned.mock.calls[0][0] as Context;
    expect(Array.isArray(ctx.match) ? ctx.match[1] : ctx.match).toBe('faq');
  });

  it('does not run hears handlers once a command handler took the message', async () => {
    const close = jest.fn();
    const canned = jest.fn();
    addon.command('close', close);
    addon.hears(/^\/(\w+)$/, canned);
    await deliver(addon, '/close');

    expect(close).toHaveBeenCalledTimes(1);
    expect(canned).not.toHaveBeenCalled();
  });

  it('runs only the first matching hears trigger', async () => {
    const canned = jest.fn();
    const catchAll = jest.fn();
    addon.hears(/^\/(\w+)(?:@\w+)?$/, canned);
    addon.hears(/(.+)/, catchAll);
    await deliver(addon, '/faq');

    expect(canned).toHaveBeenCalledTimes(1);
    // otherwise the catch-all would open a ticket containing "/faq" on top of the answer
    expect(catchAll).not.toHaveBeenCalled();
  });

  it('ignores updates without text, such as reactions', async () => {
    const catchAll = jest.fn();
    addon.hears(/(.+)/, catchAll);
    const raw = JSON.parse(JSON.stringify(signalMessage('x')));
    raw.envelope.dataMessage.message = null;
    await (addon as unknown as { handleMessage: (data: string) => Promise<void> }).handleMessage(
      JSON.stringify(raw),
    );

    expect(catchAll).not.toHaveBeenCalled();
  });

  it('still matches plain text triggers', async () => {
    const back = jest.fn();
    addon.hears('Back', back);
    await deliver(addon, 'Back');

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('has no sticker support, so the sticker handler is never registered', () => {
    expect((addon as { sendSticker?: unknown }).sendSticker).toBeUndefined();
  });
});
