import serverlessMysql from 'serverless-mysql';
import moment from 'moment';
import inside from 'point-in-polygon';

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
        inside([property.lat, property.lng], pinger.location),
      );

    console.log(
      'Potential invocations',
      pingers.length,
      'for property',
      property.url,
    );

    return {
      property,
      pingers,
    };
  });

  // @todo: invoke SNS to send emails
  // @todo: should email sender have concurrency?

  console.log('FIN');
}
