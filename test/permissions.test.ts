import { checkRights } from '../src/permissions';

// --- Permissions Module Tests --- //
describe('Permissions Module', () => {
    describe('checkRights', () => {
      it('should grant permission when a matching category is found', async () => {
        const ctx: any = { chat: { id: 'group1', type: 'group' }, session: {}, from: { username: 'user1' } };
        const config = { categories: [{ group_id: 'group1', name: 'Test' }], staffchat_id: 'staff1' };
        const result = await checkRights(ctx, config);
        expect(result).toBe(true);
        expect(ctx.session.groupAdmin).toBe('Test');
      });
  
      it('should deny permission if no matching group exists', async () => {
        const ctx: any = { chat: { id: 'group2', type: 'group' }, session: {} };
        const config = { categories: [{ group_id: 'group1', name: 'Test' }], staffchat_id: 'staff1' };
        const result = await checkRights(ctx, config);
        expect(result).toBe(false);
      });
    });
  });