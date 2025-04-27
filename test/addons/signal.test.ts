import SignalAddon from "../../src/addons/signal";

describe('SignalAddon Module', () => {
    it('should return a singleton instance', () => {
      const instance1 = SignalAddon.getInstance();
      const instance2 = SignalAddon.getInstance();
      expect(instance1).toBe(instance2);
    });
  
    it('sendMessage should post payload via axios', async () => {
      const instance = SignalAddon.getInstance();
      const axiosInstance = instance['axiosInstance'];
      const postMock = jest.spyOn(axiosInstance, 'post').mockResolvedValue({ data: {} });
      await instance.sendMessage('123', 'Test message', { recipients: ['123'] });
      expect(postMock).toHaveBeenCalledWith(
        '/v2/send',
        expect.objectContaining({ message: 'Test message', recipients: ['123'] }),
        expect.any(Object)
      );
      postMock.mockRestore();
    });
  
    it('getGroupId should return external group id if found', async () => {
      const instance = SignalAddon.getInstance();
      const axiosInstance = instance['axiosInstance'];
      const groups: any[] = [{ id: 'external1', internal_id: 'group1' }];
      const getMock = jest.spyOn(axiosInstance, 'get').mockResolvedValue({ data: groups });
      const result = await instance.getGroupId('group1');
      expect(result).toBe('external1');
      getMock.mockRestore();
    });
  });
  