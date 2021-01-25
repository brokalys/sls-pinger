import moment from 'moment';
import s3 from './s3';
import generateChart from './generate-chart';

jest.mock('./s3');

describe('generate-chart', () => {
  afterEach(jest.clearAllMocks);

  test('constructs a SVG chart', async () => {
    await generateChart(
      'test.svg',
      [{ x: '2021-01-01', y: 120 }],
      moment('2021-01-12').valueOf(),
    );

    expect(s3.putObject).toBeCalled();
    expect(s3.putObject.mock.calls[0][0].Body).toMatchSnapshot();
  });

  test('uploads the SVG chart to S3', async () => {
    s3.getSignedUrlPromise.mockReturnValue('https://url-to-file/test.svg');

    const url = await generateChart(
      'test.svg',
      [{ x: '2021-01-01', y: 120 }],
      moment('2021-01-12').valueOf(),
    );

    expect(s3.putObject).toBeCalled();
    expect(s3.getSignedUrlPromise).toBeCalled();
    expect(url).toMatch('https://url-to-file/test.svg');
  });
});
