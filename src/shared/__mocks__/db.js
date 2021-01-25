export const query = jest.fn();
export const getPingersByType = jest.fn().mockReturnValue([]);
export const getPropertyQueueForPingers = jest.fn().mockReturnValue([]);
export const lockPropertyQueueItems = jest.fn();
export const deletePropertyQueueItems = jest.fn();
export const getEmailsThatShouldBeLimitLocked = jest.fn().mockReturnValue([]);
export const getEmailsWithLimitLockerNotification = jest
  .fn()
  .mockReturnValue([]);
export const limitLockPingerEmails = jest.fn();
export const createPingerStatsEntry = jest.fn();
