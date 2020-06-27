import AWS from 'aws-sdk';
import serverlessMysql from 'serverless-mysql';
import moment from 'moment';
import numeral from 'numeral';
import inside from 'point-in-polygon';

const sns = new AWS.SNS({ apiVersion: '2010-03-31' });
const connection = serverlessMysql({
  config: {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: 'Z',
    typeCast: true,
  },
});

function parseLocation(location) {
  return location
    .split(', ')
    .map((row) => row.split(' ').map((row) => parseFloat(row)))
    .slice(0, -1);
}

function nl2br(str, is_xhtml) {
  const breakTag =
    is_xhtml || typeof is_xhtml === 'undefined' ? '<br />' : '<br>';
  return (str + '').replace(
    /([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
    '$1' + breakTag + '$2',
  );
}

function getUnsubscribeLink(pinger) {
  return `https://unsubscribe.brokalys.com/?key=${encodeURIComponent(
    pinger.unsubscribe_key,
  )}&id=${encodeURIComponent(pinger.id)}`;
}

export async function run(event, context) {
  const properties = event.Records.map((row) => JSON.parse(row.body)).filter(
    (property) =>
      property.lat &&
      property.lng &&
      property.price > 0 &&
      ['sell', 'rent'].includes(property.type),
  );

  if (properties.length === 0) {
    return;
  }

  const results = await connection.query({
    sql: `
    SELECT *
    FROM pinger_emails
    WHERE unsubscribed_at IS NULL
      AND (limit_reached_at IS NULL OR limit_reached_at < ? OR is_premium = true)
   `,
    values: [moment.utc().startOf('month').toDate()],
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }

      if (field.name === 'categories' || field.name === 'types') {
        return JSON.parse(field.string());
      }

      return next();
    },
  });

  const invocations = properties.map((property) => {
    const pingers = results
      .filter((pinger) => pinger.categories.includes(property.category))
      .filter((pinger) => pinger.types.includes(property.type))
      .filter(
        (pinger) =>
          pinger.price_min === null || property.price >= pinger.price_min,
      )
      .filter(
        (pinger) =>
          pinger.price_max === null || property.price <= pinger.price_max,
      )
      .filter(
        (pinger) =>
          pinger.rooms_min === null || property.rooms >= pinger.rooms_min,
      )
      .filter(
        (pinger) =>
          pinger.rooms_max === null || property.rooms <= pinger.rooms_max,
      )
      .filter(
        (pinger) =>
          pinger.area_m2_min === null || property.area >= pinger.area_m2_min,
      )
      .filter(
        (pinger) =>
          pinger.area_m2_max === null || property.area <= pinger.area_m2_max,
      )
      .filter(
        (pinger) =>
          pinger.floor_min === null || property.floor >= pinger.floor_min,
      )
      .filter(
        (pinger) =>
          pinger.floor_max === null || property.floor <= pinger.floor_max,
      )
      .filter((pinger) =>
        inside([property.lat, property.lng], parseLocation(pinger.location)),
      );

    console.log(
      'Potential invocations',
      pingers.length,
      'for property',
      property.url,
    );

    return pingers.map((pinger) => ({ ...pinger, property }));
  });

  // Flatten the data
  const availableInvocations = [].concat.apply([], invocations);

  await Promise.all(
    availableInvocations
      .map((pinger) => {
        const result = pinger.property;
        result.content = nl2br(result.content.replace(/(<([^>]+)>)/gi, ''));

        result.unsubscribe_url = getUnsubscribeLink(pinger);
        result.url = `https://view.brokalys.com/?link=${encodeURIComponent(
          result.url,
        )}`;
        result.price = numeral(result.price).format('0,0 €');

        return {
          to: pinger.email,
          pinger_id: pinger.id,
          template_id: 'email',
          template_variables: result,
        };
      })
      .map((data) =>
        sns
          .publish({
            Message: 'email',
            MessageAttributes: {
              to: {
                DataType: 'String',
                StringValue: data.to,
              },
              subject: {
                DataType: 'String',
                StringValue: 'Jauns PINGER sludinājums',
              },
              pinger_id: {
                DataType: 'Number',
                StringValue: String(data.pinger_id),
              },
              template_id: {
                DataType: 'String',
                StringValue: data.template_id,
              },
              template_variables: {
                DataType: 'String',
                StringValue: JSON.stringify(data.template_variables),
              },
            },
            MessageStructure: 'string',
            TargetArn: `arn:aws:sns:${process.env.AWS_REGION}:173751334418:email-${process.env.STAGE}`,
          })
          .promise(),
      ),
  );
}
