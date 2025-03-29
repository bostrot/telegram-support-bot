import * as middleware from '../src/middleware';
import cache from '../src/cache';

// --- File Utilities Tests --- //
describe('File Utilities Module', () => {
    describe('strictEscape', () => {
      it('escapes MarkdownV2 special characters', () => {
        cache.config.parse_mode = 'MarkdownV2';
        const input = 'Hello *world*';
        const output = middleware.strictEscape(input);
        expect(output).toContain('\\*');
      });
  
      it('escapes HTML characters', () => {
        cache.config.parse_mode = 'HTML';
        const input = '<div>"Hello"</div>';
        const output = middleware.strictEscape(input);
        expect(output).toContain('&lt;');
        expect(output).toContain('&quot;');
      });
    });
  });