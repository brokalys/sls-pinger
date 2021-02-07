export const query = jest.fn();
export const getPingersByFrequency = jest.fn().mockReturnValue([]);
export const getPropertyQueueForPingers = jest.fn().mockReturnValue([]);
export const lockPropertyQueueItems = jest.fn();
export const deletePropertyQueueItems = jest.fn();
export const getEmailsThatShouldBeLimitLocked = jest.fn().mockReturnValue([]);
export const getEmailsWithLimitLockerNotification = jest
  .fn()
  .mockReturnValue([]);
export const limitLockPingerEmails = jest.fn();
export const createPingerStatsEntry = jest.fn();
export const logPingerAttempt = jest.fn();
export const updatePingerAttemptTimestamp = jest.fn();
export const getAvailablePingers = jest.fn().mockReturnValue([]);
export const queuePingerForSummaryEmail = jest.fn();
export const getPropertyStats = jest.fn().mockReturnValue([]);
