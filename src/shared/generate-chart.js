import * as vega from 'vega';
import chartBase from './data/base-chart.json';
import s3 from './s3';

export default async function generateChart(fileName, values, maxDate) {
  chartBase.data[0].values = values;
  chartBase.scales[0].domainMax = maxDate;

  const view = new vega.View(vega.parse(chartBase), {
    renderer: 'none',
  });

  const svgStr = await view.toSVG();

  await s3
    .putObject({
      Bucket: `${process.env.STAGE}-pinger-charts`,
      Key: fileName,
      Body: svgStr,
      ContentType: 'image/svg+xml',
    })
    .promise();

  const url = await s3.getSignedUrlPromise('getObject', {
    Bucket: `${process.env.STAGE}-pinger-charts`,
    Key: fileName,
    Expires: 31557600, // 1 year
  });

  return url;
}
