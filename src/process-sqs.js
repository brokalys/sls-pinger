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
          pinger.price_min === null || pinger.price_min >= property.price,
      )
      .filter(
        (pinger) =>
          pinger.price_max === null || pinger.price_max <= property.price,
      )
      .filter(
        (pinger) =>
          pinger.rooms_min === null || pinger.rooms_min >= property.rooms,
      )
      .filter(
        (pinger) =>
          pinger.rooms_max === null || pinger.rooms_max <= property.rooms,
      )
      .filter(
        (pinger) =>
          pinger.area_m2_min === null || pinger.area_m2_min >= property.area,
      )
      .filter(
        (pinger) =>
          pinger.area_m2_max === null || pinger.area_m2_max <= property.area,
      )
      .filter(
        (pinger) =>
          pinger.floor_min === null || pinger.floor_min >= property.floor,
      )
      .filter(
        (pinger) =>
          pinger.floor_max === null || pinger.floor_max <= property.floor,
      )
      .filter((pinger) =>
        inside([property.lng, property.lat], pinger.location),
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
