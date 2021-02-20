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
    db.getPingersByFrequency.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1 }),
      createPropertyQueueItemFixture({ id: 2 }),
      createPropertyQueueItemFixture({ id: 3 }),
    ]);

    await run({ frequency: 'daily' });

    expect(sns.publish).toBeCalledTimes(1);
    expect(sns.publish.mock.calls[0]).toMatchSnapshot();
  });

  test('limits sending 100 property emails for non-premium users', async () => {
    db.getPingersByFrequency.mockReturnValue([
      createPingerFixture({ is_premium: false }),
    ]);
    db.getPropertyQueueForPingers.mockReturnValue(
      new Array(800)
        .fill('')
        .map((row, index) => createPropertyQueueItemFixture({ id: index })),
    );

    await run({ frequency: 'daily' });

    expect(sns.publish).toBeCalledTimes(1);

    const templateVariables = JSON.parse(
      sns.publish.mock.calls[0][0].MessageAttributes.template_variables
        .StringValue,
    );
    expect(templateVariables.limit_reached).toBeTruthy();
    expect(templateVariables.properties).toHaveLength(100);
  });

  test('limits sending 500 property emails for premium users', async () => {
    db.getPingersByFrequency.mockReturnValue([
      createPingerFixture({ is_premium: true }),
    ]);
    db.getPropertyQueueForPingers.mockReturnValue(
      new Array(800)
        .fill('')
        .map((row, index) => createPropertyQueueItemFixture({ id: index })),
    );

    await run({ frequency: 'daily' });

    expect(sns.publish).toBeCalledTimes(1);

    const templateVariables = JSON.parse(
      sns.publish.mock.calls[0][0].MessageAttributes.template_variables
        .StringValue,
    );
    expect(templateVariables.limit_reached).toBeTruthy();
    expect(templateVariables.properties).toHaveLength(500);
  });

  test('inserts an entry into the stats table', async () => {
    db.getPingersByFrequency.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1 }),
      createPropertyQueueItemFixture({
        id: 2,
        data: { calc_price_per_sqm: null },
      }),
    ]);

    await run({ frequency: 'daily' });

    expect(db.createPingerStatsEntry).toBeCalledTimes(1);
    expect(db.createPingerStatsEntry.mock.calls[0]).toMatchSnapshot();
  });

  test('does not insert NULL values into the stats table', async () => {
    db.getPingersByFrequency.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ data: { calc_price_per_sqm: null } }),
    ]);

    await run({ frequency: 'daily' });

    expect(db.createPingerStatsEntry).not.toBeCalled();
  });

  test('does not send a SNS notification if there are no PINGER', async () => {
    db.getPingersByFrequency.mockReturnValue([]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1 }),
      createPropertyQueueItemFixture({ id: 2 }),
      createPropertyQueueItemFixture({ id: 3 }),
    ]);

    await run({ frequency: 'daily' });

    expect(sns.publish).toBeCalledTimes(0);
  });

  test('does not send a SNS notification if there are no properties', async () => {
    db.getPingersByFrequency.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([]);

    await run({ frequency: 'daily' });

    expect(sns.publish).toBeCalledTimes(0);
  });

  test('sends multiple email SNS notifications', async () => {
    db.getPingersByFrequency.mockReturnValue([
      createPingerFixture({ id: 1 }),
      createPingerFixture({ id: 2 }),
    ]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1, pinger_id: 1 }),
      createPropertyQueueItemFixture({ id: 2, pinger_id: 1 }),
      createPropertyQueueItemFixture({ id: 3, pinger_id: 2 }),
    ]);

    await run({ frequency: 'weekly' });

    expect(sns.publish).toBeCalledTimes(2);
  });

  test('locks and deletes used properties', async () => {
    db.getPingersByFrequency.mockReturnValue([createPingerFixture()]);
    db.getPropertyQueueForPingers.mockReturnValue([
      createPropertyQueueItemFixture({ id: 1 }),
      createPropertyQueueItemFixture({ id: 2 }),
      createPropertyQueueItemFixture({ id: 3 }),
    ]);

    await run({ frequency: 'monthly' });

    expect(db.lockPropertyQueueItems).toBeCalledWith([1, 2, 3]);
    expect(db.deletePropertyQueueItems).toBeCalledWith([1, 2, 3]);
  });

  test('adds charts to the emails for pingers that have charts', async () => {
    db.getPingersByFrequency.mockReturnValue([
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

    await run({ frequency: 'weekly' });

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

  test('inserts new summary entries before attempting to generate the summary chart', async () => {
    db.getPingersByFrequency.mockResolvedValue([
      createPingerFixture({ id: 1 }),
    ]);
    db.getPropertyQueueForPingers.mockResolvedValue([
      createPropertyQueueItemFixture({ pinger_id: 1 }),
    ]);

    await run({ frequency: 'weekly' });

    expect(generatePingerCharts.mock.invocationCallOrder[0]).toBeGreaterThan(
      db.createPingerStatsEntry.mock.invocationCallOrder[0],
    );
  });

  test.each(['is_premium', 'unsubscribe_url', 'properties'])(
    'adds the required template_variables field: %j',
    async (field) => {
      db.getPingersByFrequency.mockReturnValue([createPingerFixture()]);
      db.getPropertyQueueForPingers.mockReturnValue([
        createPropertyQueueItemFixture(),
      ]);

      await run({ frequency: 'weekly' });

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

  test('does nothing if no pingers with the given frequency', async () => {
    db.getPingersByFrequency.mockReturnValue([]);

    await run({ frequency: 'monthly' });

    expect(db.getPropertyQueueForPingers).not.toBeCalled();
  });
});
