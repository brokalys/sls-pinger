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
  const bucketName = `${process.env.STAGE}-pinger-charts`;

  await s3
    .putObject({
      Bucket: bucketName,
      Key: fileName,
      Body: svgStr,
      ContentType: 'image/svg+xml',
    })
    .promise();

  return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
}
