
jest.mock('../src/cache', () => ({
    config: {
        parse_mode: 'MarkdownV2',
        language: {
            dear: 'Dear',
            regards: 'Regards',
            regardsGroup: 'Support Team',
            ticket: 'Ticket',
            from: 'from',
            language: 'en',
            helpCommandText: 'Help text for users',
            helpCommandStaffText: 'Help text for staff',
            openTickets: 'Open Tickets',
            closed: 'closed',
            ticketClosed: 'Ticket closed.',
            ticketClosedError: 'Ticket not found or already closed.',
            faqCommandText: 'FAQ text',
            links: 'Links',
            startCommandText: 'Start text',
            services: 'Services',
            prvChatOnly: 'Private chat only',
            back: 'Back',
            msg_sent: 'Message sent',
        },
        dev_mode: false,
        clean_replies: false,
        anonymous_replies: false,
        staffchat_type: 'telegram',
        autoreply: [],
        direct_reply: true,
        categories: [
            { group_id: 'group1', name: 'Category1' },
            // Add more sample categories if needed
        ],
        pass_start: false,
        show_auto_replied: true,
        auto_close_tickets: false,
    },
    ticketIDs: [],
    ticketStatus: [],
    ticketSent: [],
    io: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
    userId: 123,
}));

jest.mock('../src/db', () => ({
    closeAll: jest.fn(),
    open: jest.fn((callback, groups) => callback([])),
    add: jest.fn(),
    getTicketById: jest.fn((id, group, callback) =>
        callback({ id: 1, userid: 456, category: 'test' })
    ),
    getTicketByInternalId: jest.fn(),
    getByTicketId: jest.fn((ticketId, callback) =>
        callback({ userid: 789, id: { toString: () => ticketId } })
    ),
    reopen: jest.fn(),
}));

// --- Mocks for External Modules --- //
jest.mock('grammy', () => ({
    Bot: jest.fn().mockImplementation(() => ({
        init: jest.fn().mockResolvedValue({}),
        command: jest.fn(),
        on: jest.fn(),
        hears: jest.fn(),
        catch: jest.fn(),
        start: jest.fn(),
        api: {
            sendMessage: jest.fn(),
            sendPhoto: jest.fn(),
            sendDocument: jest.fn(),
            sendVideo: jest.fn(),
            config: { use: jest.fn() },
        },
        botInfo: { username: 'dummy_bot' },
    })),
    // Minimal session middleware
    session: jest.fn().mockImplementation(({ initial }) => {
        return (ctx: any, next: () => any) => next();
    }),
}));

jest.mock('axios', () => ({
    create: jest.fn(() => ({
        post: jest.fn(),
        get: jest.fn(),
    })),
}));

jest.mock('ws', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
    }));
});