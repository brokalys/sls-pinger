import * as db from './shared/db';
import sns from './shared/sns';
import { run } from './process-summary-queue';
import {
  createPingerFixture,
  createPropertyQueueItemFixture,
} from '__fixtures__';

jest.mock('./shared/db');
jest.mock('./shared/sns');

describe('process-summary-queue', () => {
  afterEach(jest.clearAllMocks);

  test('sends an email SNS notification', async () => {
    db.getPingersByType.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1 }),
      createPropertyQueueItemFixture({ id: 2 }),
      createPropertyQueueItemFixture({ id: 3 }),
    ]);

    await run({ type: 'daily' });

    expect(sns.publish).toBeCalledTimes(1);
  });

  test('does not send a SNS notification if there are no PINGER', async () => {
    db.getPingersByType.mockReturnValue([]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1 }),
      createPropertyQueueItemFixture({ id: 2 }),
      createPropertyQueueItemFixture({ id: 3 }),
    ]);

    await run({ type: 'daily' });

    expect(sns.publish).toBeCalledTimes(0);
  });

  test('does not send a SNS notification if there are no properties', async () => {
    db.getPingersByType.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([]);

    await run({ type: 'daily' });

    expect(sns.publish).toBeCalledTimes(0);
  });

  test('sends multiple email SNS notifications', async () => {
    db.getPingersByType.mockReturnValue([
      createPingerFixture({ id: 1 }),
      createPingerFixture({ id: 2 }),
    ]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1, pinger_id: 1 }),
      createPropertyQueueItemFixture({ id: 2, pinger_id: 1 }),
      createPropertyQueueItemFixture({ id: 3, pinger_id: 2 }),
    ]);

    await run({ type: 'weekly' });

    expect(sns.publish).toBeCalledTimes(2);
  });

  test('locks and deletes used properties', async () => {
    db.getPingersByType.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1 }),
      createPropertyQueueItemFixture({ id: 2 }),
      createPropertyQueueItemFixture({ id: 3 }),
    ]);

    await run({ type: 'monthly' });

    expect(db.lockPropertyQueueItems).toBeCalledWith([1, 2, 3]);
    expect(db.deletePropertyQueueItems).toBeCalledWith([1, 2, 3]);
  });
});
