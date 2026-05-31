
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
    staffMembers: new Map(),
    mutedTickets: new Set(),
    recoveryBaseline: 0,
}));

jest.mock('../src/db', () => ({
    closeAll: jest.fn().mockResolvedValue(undefined),
    open: jest.fn((callback, groups) => callback([])),
    add: jest.fn().mockResolvedValue(0),
    getTicketById: jest.fn().mockResolvedValue({ id: 1, userid: 456, category: 'test' }),
    getTicketByInternalId: jest.fn().mockResolvedValue(null),
    getByTicketId: jest.fn((ticketId, callback) =>
        callback({ userid: 789, id: { toString: () => ticketId } })
    ),
    reopen: jest.fn(),
    // New team collaboration & analytics methods
    addTicketMessage: jest.fn().mockResolvedValue(undefined),
    getConversationHistory: jest.fn().mockResolvedValue([]),
    recordAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
    getAnalyticsEvents: jest.fn().mockResolvedValue([]),
    addInternalNote: jest.fn().mockResolvedValue(undefined),
    getInternalNotes: jest.fn().mockResolvedValue([]),
    assignTicket: jest.fn().mockResolvedValue(undefined),
    unassignTicket: jest.fn().mockResolvedValue(undefined),
    addTags: jest.fn().mockResolvedValue(undefined),
    removeTag: jest.fn().mockResolvedValue(undefined),
    setPriority: jest.fn().mockResolvedValue(undefined),
    setTriageInfo: jest.fn().mockResolvedValue(undefined),
    setFirstResponseAt: jest.fn().mockResolvedValue(undefined),
    setClosedAt: jest.fn().mockResolvedValue(undefined),
    openByTag: jest.fn((callback, tag, category) => callback([])),
    recordCSAT: jest.fn().mockResolvedValue(undefined),
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
            getMessages: jest.fn().mockResolvedValue([]),
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

jest.mock('../src/recovery', () => ({
    runRecovery: jest.fn().mockResolvedValue(undefined),
}));

// NOTE: ../src/staff is NOT globally mocked here. Tests that need it can either:
// - Import the real implementation (e.g., staff.test.ts tests privateReply, ticketMsg)
// - Mock specific functions inline with jest.mock in their own test file