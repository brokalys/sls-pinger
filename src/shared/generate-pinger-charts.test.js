import moment from 'moment';
import * as db from './db';
import generateChart from './generate-chart';
import generatePingerCharts from './generate-pinger-charts';
import { createPingerFixture, createPropertyStatFixture } from '__fixtures__';

jest.mock('./db');
jest.mock('./generate-chart', () => jest.fn().mockResolvedValue('url'));

describe('generate-pinger-charts', () => {
  afterEach(jest.clearAllMocks);

  test('builds a single chart', async () => {
    db.getPropertyStats.mockReturnValue([
      createPropertyStatFixture({ created_at: '2021-01-01' }),
      createPropertyStatFixture({ created_at: '2021-01-02' }),
      createPropertyStatFixture({ created_at: '2021-01-03' }),
    ]);

    const urls = await generatePingerCharts([createPingerFixture()]);

    expect(db.getPropertyStats).toBeCalledWith([1]);
    expect(urls).toEqual({
      1: expect.any(String),
    });
  });

  test('build multiple charts', async () => {
    db.getPropertyStats.mockReturnValue([
      createPropertyStatFixture({ pinger_id: 1, created_at: '2021-01-01' }),
      createPropertyStatFixture({ pinger_id: 1, created_at: '2021-01-02' }),
      createPropertyStatFixture({ pinger_id: 2, created_at: '2021-01-03' }),
      createPropertyStatFixture({ pinger_id: 2, created_at: '2021-01-04' }),
    ]);

    const urls = await generatePingerCharts([
      createPingerFixture({ id: 1 }),
      createPingerFixture({ id: 2 }),
    ]);

    expect(db.getPropertyStats).toBeCalledWith([1, 2]);
    expect(urls).toEqual({
      1: expect.any(String),
      2: expect.any(String),
    });
  });

  test('does not construct a chart for pinger with only one X-axis datapoint', async () => {
    db.getPropertyStats.mockReturnValue([
      createPropertyStatFixture({ pinger_id: 1, created_at: '2021-01-01' }),
      createPropertyStatFixture({ pinger_id: 1, created_at: '2021-01-02' }),
      createPropertyStatFixture({ pinger_id: 2, created_at: '2021-01-03' }),
    ]);

    const urls = await generatePingerCharts([
      createPingerFixture({ id: 1 }),
      createPingerFixture({ id: 2 }),
    ]);

    expect(db.getPropertyStats).toBeCalledWith([1, 2]);
    expect(urls).toEqual({
      1: expect.any(String),
    });
  });

  test('does not construct a chart for pinger with no X-axis datapoints', async () => {
    db.getPropertyStats.mockReturnValue([]);

    const urls = await generatePingerCharts([
      createPingerFixture({ id: 1 }),
      createPingerFixture({ id: 2 }),
    ]);

    expect(db.getPropertyStats).toBeCalledWith([1, 2]);
    expect(urls).toEqual({});
  });

  test.each([
    ['daily', '2021-01-01', '2021-01-12'],
    ['weekly', '2021-01-01', '2021-03-19'],
    ['monthly', '2021-01-01', '2021-12-01'],
  ])(
    'adds 11 days to the minimum X-axis datapoint for max X axis value for %j pinger',
    async (frequency, start, end) => {
      db.getPropertyStats.mockReturnValue([
        createPropertyStatFixture({ created_at: start }),
        createPropertyStatFixture({ created_at: moment(start).add(1, 'day') }),
      ]);

      const urls = await generatePingerCharts([
        createPingerFixture({ frequency }),
      ]);

      expect(generateChart).toBeCalledWith(
        expect.stringMatching(/^1\/(.*)\.svg$/),
        expect.anything(),
        moment(end).valueOf(),
      );
    },
  );

  test('has more than 12 data-points in the chart', async () => {
    db.getPropertyStats.mockReturnValue([
      createPropertyStatFixture({ created_at: '2021-01-01' }),
      createPropertyStatFixture({ created_at: '2021-01-02' }),
      createPropertyStatFixture({ created_at: '2021-01-03' }),
      createPropertyStatFixture({ created_at: '2021-01-04' }),
      createPropertyStatFixture({ created_at: '2021-01-05' }),
      createPropertyStatFixture({ created_at: '2021-01-06' }),
      createPropertyStatFixture({ created_at: '2021-01-07' }),
      createPropertyStatFixture({ created_at: '2021-01-08' }),
      createPropertyStatFixture({ created_at: '2021-01-09' }),
      createPropertyStatFixture({ created_at: '2021-01-10' }),
      createPropertyStatFixture({ created_at: '2021-01-11' }),
      createPropertyStatFixture({ created_at: '2021-01-12' }),
      createPropertyStatFixture({ created_at: '2021-01-13' }),
    ]);

    const urls = await generatePingerCharts([createPingerFixture()]);

    expect(generateChart).toBeCalledWith(
      expect.stringMatching(/^1\/(.*)\.svg$/),
      expect.anything(),
      moment('2021-01-13').valueOf(),
    );
  });
});
