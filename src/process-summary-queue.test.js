import * as db from './shared/db';
import generatePingerCharts from './shared/generate-pinger-charts';
import sns from './shared/sns';
import { run } from './process-summary-queue';
import {
  createPingerFixture,
  createPropertyQueueItemFixture,
} from '__fixtures__';

jest.mock('./shared/db');
jest.mock('./shared/generate-pinger-charts', () =>
  jest.fn().mockResolvedValue({}),
);
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
    expect(sns.publish.mock.calls[0]).toMatchSnapshot();
  });

  test('inserts an entry into the stats table', async () => {
    db.getPingersByType.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture(),
    ]);

    await run({ type: 'daily' });

    expect(db.createPingerStatsEntry).toBeCalledTimes(1);
    expect(db.createPingerStatsEntry.mock.calls[0]).toMatchSnapshot();
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

  test('adds charts to the emails for pingers that have charts', async () => {
    db.getPingersByType.mockReturnValue([
      createPingerFixture({ id: 1 }),
      createPingerFixture({ id: 2 }),
    ]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1, pinger_id: 1 }),
      createPropertyQueueItemFixture({ id: 2, pinger_id: 2 }),
    ]);
    generatePingerCharts.mockResolvedValue({
      1: 'https://url.for/chart.svg',
    });

    await run({ type: 'weekly' });

    const deepHeroImgMatcher = expect.objectContaining({
      MessageAttributes: expect.objectContaining({
        template_variables: expect.objectContaining({
          StringValue: expect.stringContaining(
            '"hero_img_url":"https://url.for/chart.svg"',
          ),
        }),
      }),
    });
    expect(sns.publish.mock.calls[0][0]).toEqual(deepHeroImgMatcher);
    expect(sns.publish.mock.calls[1][0]).not.toEqual(deepHeroImgMatcher);
  });

  test.each(['is_premium', 'unsubscribe_url', 'properties'])(
    'adds the required template_variables field: %j',
    async (field) => {
      db.getPingersByType.mockReturnValue([createPingerFixture()]);
      db.getPropertyQueueForPingers.mockReturnValue([
        createPropertyQueueItemFixture(),
      ]);

      await run({ type: 'weekly' });

      expect(sns.publish.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          MessageAttributes: expect.objectContaining({
            template_variables: expect.objectContaining({
              StringValue: expect.stringContaining(JSON.stringify(field)),
            }),
          }),
        }),
      );
    },
  );
});
