// Tests for the Telegram "/" command menu entries (register_commands)
import { staffMenu, userMenu } from '../src/commandmenu';
import { Config } from '../src/interfaces';

const config = (overrides: Partial<Config> = {}): Config =>
  ({
    allow_user_close: false,
    allow_broadcast: false,
    ticket_ref_codes: false,
    user_commands: [],
    canned_responses: [],
    ...overrides,
  }) as Config;

const names = (entries: { command: string }[]) => entries.map((e) => e.command);

describe('userMenu', () => {
  it('lists the basic user commands and no staff commands', () => {
    const menu = names(userMenu(config()));
    expect(menu).toEqual(['start', 'help', 'faq', 'id']);
  });

  it('adds /close only when users may close their ticket', () => {
    expect(names(userMenu(config({ allow_user_close: true })))).toContain('close');
  });

  it('adds custom user_commands, falling back to the name as description', () => {
    const menu = userMenu(config({
      user_commands: [
        { command: 'hours', text: 'Mon-Fri', description: 'Opening hours' },
        { command: 'price', text: '5€' },
      ],
    }));
    expect(menu).toContainEqual({ command: 'hours', description: 'Opening hours' });
    expect(menu).toContainEqual({ command: 'price', description: 'price' });
  });

  it('drops commands Telegram would reject and duplicates', () => {
    const menu = names(userMenu(config({
      user_commands: [
        { command: 'Hours', text: 'x' },
        { command: 'opening-hours', text: 'x' },
        { command: 'a'.repeat(33), text: 'x' },
        { command: 'help', text: 'x', description: 'duplicate' },
        { command: undefined, text: 'x' },
      ] as Config['user_commands'],
    })));
    expect(menu).toEqual(['start', 'help', 'faq', 'id']);
  });
});

describe('staffMenu', () => {
  it('lists the staff commands without optional ones by default', () => {
    const menu = names(staffMenu(config()));
    expect(menu).toEqual(expect.arrayContaining(['open', 'close', 'reopen', 'note', 'ban', 'stats']));
    expect(menu).not.toContain('ref');
    expect(menu).not.toContain('broadcast');
  });

  it('adds /ref and /broadcast when enabled', () => {
    const menu = names(staffMenu(config({ ticket_ref_codes: true, allow_broadcast: true })));
    expect(menu).toEqual(expect.arrayContaining(['ref', 'broadcast']));
  });

  it('adds canned responses with a shortened, single-line description', () => {
    const menu = staffMenu(config({
      canned_responses: [
        { key: 'shipping', text: 'Your order should\narrive within 3-5 days.' },
        { key: 'long', text: 'x'.repeat(400) },
        { key: 'open', text: 'shadows a built-in command' },
      ],
    }));
    expect(menu).toContainEqual({ command: 'shipping', description: 'Template: Your order should arrive within 3-5 days.' });
    const long = menu.find((e) => e.command === 'long');
    expect(long.description).toHaveLength(256);
    expect(menu.filter((e) => e.command === 'open')).toEqual([{ command: 'open', description: 'List open tickets' }]);
  });

  it('never exceeds Telegram\'s limit of 100 commands', () => {
    const canned = Array.from({ length: 150 }, (_, i) => ({ key: `t${i}`, text: 'x' }));
    expect(staffMenu(config({ canned_responses: canned }))).toHaveLength(100);
  });
});
