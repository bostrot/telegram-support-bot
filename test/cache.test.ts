import cache from '../src/cache';
import * as fs from 'fs';
import * as YAML from 'yaml';

// Mock file system and YAML
jest.mock('fs');
jest.mock('yaml');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockYAML = YAML as jest.Mocked<typeof YAML>;

describe('Cache Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have default cache structure', () => {
    expect(cache).toHaveProperty('userId');
    expect(cache).toHaveProperty('ticketIDs');
    expect(cache).toHaveProperty('ticketStatus');
    expect(cache).toHaveProperty('ticketSent');
    expect(cache).toHaveProperty('io');
    expect(cache).toHaveProperty('config');
  });

  it('should initialize with correct default values', () => {
    expect(typeof cache.userId).toBe('number');
    expect(Array.isArray(cache.ticketIDs)).toBe(true);
    expect(Array.isArray(cache.ticketStatus)).toBe(true);
    expect(Array.isArray(cache.ticketSent)).toBe(true);
    expect(typeof cache.io).toBe('object');
    expect(typeof cache.config).toBe('object');
  });

  it('should have config with language properties', () => {
    expect(cache.config).toHaveProperty('language');
    expect(cache.config.language).toHaveProperty('dear');
    expect(cache.config.language).toHaveProperty('regards');
  });

  it('should be a singleton instance', () => {
    const cache1 = require('../src/cache').default;
    const cache2 = require('../src/cache').default;
    expect(cache1).toBe(cache2);
  });

  it('should allow modification of cache properties', () => {
    const originalUserId = cache.userId;
    cache.userId = 'test123';
    expect(cache.userId).toBe('test123');
    
    // Reset for other tests
    cache.userId = originalUserId;
  });

  it('should allow adding items to arrays', () => {
    const originalLength = cache.ticketIDs.length;
    cache.ticketIDs.push('T001');
    expect(cache.ticketIDs.length).toBe(originalLength + 1);
    expect(cache.ticketIDs).toContain('T001');
    
    // Clean up
    cache.ticketIDs.pop();
  });

  it('should have configuration properties', () => {
    expect(cache.config).toHaveProperty('parse_mode');
    expect(cache.config).toHaveProperty('categories');
    expect(cache.config).toHaveProperty('anonymous_replies');
    expect(cache.config).toHaveProperty('clean_replies');
  });
});
