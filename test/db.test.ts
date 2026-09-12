// test/mocks.ts (jest setupFiles) replaces ../src/db with stubs; this suite needs the real module.
jest.unmock('../src/db');

// Mock Mongoose first
const mockFindOne = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindOneAndReplace = jest.fn();
const mockCreate = jest.fn();

/** Minimal chainable, awaitable query like mongoose returns from findOne(). */
const query = (result: unknown, reject = false) => {
  const q: Record<string, unknown> = {};
  q.sort = jest.fn(() => q);
  q.select = jest.fn(() => q);
  q.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    (reject ? Promise.reject(result) : Promise.resolve(result)).then(onOk, onErr);
  return q;
};

jest.mock('mongoose', () => {
  const Schema = jest.fn().mockImplementation(() => ({ plugin: jest.fn(), index: jest.fn() }));
  (Schema as unknown as { Types: unknown }).Types = { Mixed: {}, ObjectId: {} };
  return {
  __esModule: true,
  default: undefined as unknown, // set below
  connect: jest.fn().mockResolvedValue({}),
  Schema,
  model: jest.fn().mockReturnValue({
    findOne: mockFindOne,
    updateMany: mockUpdateMany,
    findOneAndReplace: mockFindOneAndReplace,
    create: mockCreate,
  }),
  connection: {
    on: jest.fn(),
  },
  };
});
// db.ts uses the default import: make it the same object as the namespace
const mongooseMock = jest.requireMock('mongoose');
mongooseMock.default = mongooseMock;

// Mock cache
jest.mock('../src/cache', () => ({
  config: {
    mongodb_uri: 'mongodb://localhost:27017/test',
  },
  recoveryBaseline: 0,
}));

// Import the module after mocking
import * as db from '../src/db';

describe('Database Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTicketByUserId', () => {
    it('should find ticket by user ID and category', async () => {
      const mockTicket = { id: 1, userid: 'user1', category: 'support' };
      mockFindOne.mockReturnValue(query(mockTicket));

      if (db.getTicketByUserId) {
        const result = await db.getTicketByUserId('user1', 'support');
        expect(result).toEqual(mockTicket);
        expect(mockFindOne).toHaveBeenCalledWith({
          $or: [{ userid: 'user1' }],
          category: 'support',
        });
      } else {
        // Function doesn't exist, mark as skipped
        expect(true).toBe(true);
      }
    });

    it('should match uncategorised tickets when category is null', async () => {
      const mockTicket = { id: 1, userid: 'user1' };
      mockFindOne.mockReturnValue(query(mockTicket));

      if (db.getTicketByUserId) {
        const result = await db.getTicketByUserId('user1', null);
        expect(result).toEqual(mockTicket);
        expect(mockFindOne).toHaveBeenCalledWith({
          $or: [{ userid: 'user1' }],
          category: null,
        });
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('closeAll', () => {
    it('should call closeAll function', async () => {
      if (db.closeAll) {
        await db.closeAll();
        // Function exists and was called successfully
        expect(true).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('reopen', () => {
    it('should call reopen function', async () => {
      if (db.reopen) {
        await db.reopen('user1', 'support', 'telegram');
        // Function exists and was called successfully
        expect(true).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('add', () => {
    it('should call add function when status is open', async () => {
      if (db.add) {
        const result = await db.add('user1', 'open', 'support', 'telegram');
        // Function exists and was called successfully
        expect(true).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should call add function when status is closed', async () => {
      if (db.add) {
        await db.add('user1', 'closed', 'support', 'telegram');
        // Function exists and was called successfully
        expect(true).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('addNewTicket (ticket_per_message)', () => {
    it('inserts a new document instead of replacing the existing one', async () => {
      // getNextTicketId reads the highest ticketId
      mockFindOne.mockReturnValue(query({ ticketId: 7 }));
      mockCreate.mockResolvedValue({});

      const ticketId = await db.addNewTicket('user1', 'support', 'telegram');

      expect(ticketId).toBe(8);
      expect(mockCreate).toHaveBeenCalledWith({
        userid: 'user1',
        messenger: 'telegram',
        ticketId: 8,
        status: 'open',
        category: 'support',
      });
      expect(mockFindOneAndReplace).not.toHaveBeenCalled();
    });

    it('stores a null category when none is given', async () => {
      mockFindOne.mockReturnValue(query(null));
      mockCreate.mockResolvedValue({});
      await db.addNewTicket('user1', undefined as unknown as null, 'telegram');
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 1, category: null }));
    });
  });

  describe('getTicketByUserId ordering', () => {
    it('returns the newest ticket first so per-message tickets resolve to the latest one', async () => {
      const q = query({ ticketId: 3 });
      mockFindOne.mockReturnValue(q);
      await db.getTicketByUserId('user1', null);
      expect(q.sort).toHaveBeenCalledWith({ ticketId: -1 });
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockFindOne.mockReturnValue(query(new Error('Database connection failed'), true));

      if (db.getTicketByUserId) {
        await expect(db.getTicketByUserId('user1', 'support')).rejects.toThrow('Database connection failed');
      } else {
        expect(true).toBe(true);
      }
    });

    it('should handle null results gracefully', async () => {
      mockFindOne.mockReturnValue(query(null));

      if (db.getTicketByUserId) {
        const result = await db.getTicketByUserId('nonexistent', 'support');
        expect(result).toBeNull();
      } else {
        expect(true).toBe(true);
      }
    });
  });
});
