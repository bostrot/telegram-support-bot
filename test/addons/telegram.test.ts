import TelegramAddon from "../../src/addons/telegram";

describe('TelegramAddon Module', () => {
    it('should return a singleton instance', () => {
      const token = 'dummy-token';
      const instance1 = TelegramAddon.getInstance(token);
      const instance2 = TelegramAddon.getInstance();
      expect(instance1).toBe(instance2);
    });
  
    it('initSession should return a session middleware function', () => {
      const instance = TelegramAddon.getInstance('dummy-token');
      const sessionMiddleware = instance.initSession();
      expect(typeof sessionMiddleware).toBe('function');
    });
  });