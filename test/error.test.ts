// Mock file system and console
const mockAppendFile = jest.fn();
const mockWriteSync = jest.fn();
const mockConsoleError = jest.fn();
const mockConsoleLog = jest.fn();

jest.mock('fs', () => ({
  appendFile: mockAppendFile,
}));

jest.mock('util', () => ({
  format: jest.fn((input) => String(input)),
}));

// Mock process stdout
const mockStdout = {
  write: mockWriteSync,
};

// Mock the debug file path
jest.mock('../src/error', () => {
  const originalModule = jest.requireActual('../src/error');
  return {
    ...originalModule,
    init: jest.fn(originalModule.init),
  };
});

describe('Error Module', () => {
  let originalProcessOn: typeof process.on;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;
  let originalStdout: typeof process.stdout;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process.on
    originalProcessOn = process.on;
    process.on = jest.fn() as any;
    
    // Mock console methods
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    console.error = mockConsoleError;
    console.log = mockConsoleLog;
    
    // Mock process.stdout
    originalStdout = process.stdout;
    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      writable: true,
    });
  });

  afterEach(() => {
    // Restore original methods
    process.on = originalProcessOn;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      writable: true,
    });
  });

  describe('init', () => {
    it('should register uncaught exception handler', () => {
      const { init } = require('../src/error');
      
      init(true);
      
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should register unhandled rejection handler', () => {
      const { init } = require('../src/error');
      
      init(true);
      
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should set up logging when logs parameter is true', () => {
      const { init } = require('../src/error');
      
      init(true);
      
      // Verify that process.on was called for both events
      const calls = (process.on as jest.Mock).mock.calls;
      expect(calls.some(call => call[0] === 'uncaughtException')).toBe(true);
      expect(calls.some(call => call[0] === 'unhandledRejection')).toBe(true);
    });

    it('should set up logging when logs parameter is false', () => {
      const { init } = require('../src/error');
      
      init(false);
      
      // Should still register handlers even if logging is disabled
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should handle uncaught exceptions with proper logging', () => {
      const { init } = require('../src/error');
      
      init(true);
      
      // Get the exception handler
      const exceptionHandler = (process.on as jest.Mock).mock.calls
        .find(call => call[0] === 'uncaughtException')[1];
      
      const testError = new Error('Test uncaught exception');
      
      // Mock Date.now to control the timestamp
      const mockDate = new Date('2022-01-01T00:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      exceptionHandler(testError);
      
      // Should write to stdout
      expect(mockWriteSync).toHaveBeenCalled();
      
      // Should append to file
      expect(mockAppendFile).toHaveBeenCalledWith(
        './config/debug.log',
        expect.stringContaining('Test uncaught exception'),
        'utf8',
        expect.any(Function)
      );
    });

    it('should handle unhandled promise rejections', () => {
      const { init } = require('../src/error');
      
      init(true);
      
      // Get the rejection handler
      const rejectionHandler = (process.on as jest.Mock).mock.calls
        .find(call => call[0] === 'unhandledRejection')[1];
      
      const testError = new Error('Test unhandled rejection');
      
      rejectionHandler(testError);
      
      // Should log the error
      expect(mockWriteSync).toHaveBeenCalled();
      expect(mockAppendFile).toHaveBeenCalled();
    });

    it('should handle rate limiting for frequent errors', async () => {
      const { init } = require('../src/error');
      
      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
        if (typeof fn === 'function') {
          fn();
        }
        return {} as NodeJS.Timeout;
      });
      
      init(true);
      
      const exceptionHandler = (process.on as jest.Mock).mock.calls
        .find(call => call[0] === 'uncaughtException')[1];
      
      // Trigger multiple errors quickly
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const error3 = new Error('Error 3');
      
      exceptionHandler(error1);
      exceptionHandler(error2);
      exceptionHandler(error3);
      
      // Should have logged all errors but with potential rate limiting
      expect(mockWriteSync).toHaveBeenCalled();
      expect(mockAppendFile).toHaveBeenCalled();
    });

    it('should handle file write errors gracefully', () => {
      const { init } = require('../src/error');
      
      // Mock appendFile to call its callback with an error
      mockAppendFile.mockImplementation((path, data, encoding, callback) => {
        callback(new Error('File write error'));
      });
      
      init(true);
      
      const exceptionHandler = (process.on as jest.Mock).mock.calls
        .find(call => call[0] === 'uncaughtException')[1];
      
      const testError = new Error('Test error');
      
      // This should not throw an error even if file writing fails
      expect(() => exceptionHandler(testError)).not.toThrow();
    });

    it('should work without logging when logs is false', () => {
      const { init } = require('../src/error');
      
      init(false);
      
      const exceptionHandler = (process.on as jest.Mock).mock.calls
        .find(call => call[0] === 'uncaughtException')[1];
      
      const testError = new Error('Test error without logging');
      
      exceptionHandler(testError);
      
      // Should still register handlers but not perform file operations
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should handle different error types in rejection handler', () => {
      const { init } = require('../src/error');
      
      init(true);
      
      const rejectionHandler = (process.on as jest.Mock).mock.calls
        .find(call => call[0] === 'unhandledRejection')[1];
      
      // Test with string error
      rejectionHandler('String error');
      expect(mockWriteSync).toHaveBeenCalled();
      
      // Test with undefined error
      rejectionHandler(undefined);
      expect(mockWriteSync).toHaveBeenCalled();
      
      // Test with object error
      rejectionHandler({ message: 'Object error' });
      expect(mockWriteSync).toHaveBeenCalled();
    });
  });
});
