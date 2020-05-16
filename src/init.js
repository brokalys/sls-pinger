const serverlessMysql = require('serverless-mysql');
const moment = require('moment');
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ apiVersion: '2010-03-31' });

AWS.config.update({ region: process.env.AWS_REGION });

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

exports.run = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const buildQuery = (ping) => {
    return `
      {
        properties(
          created_at: { gte: "%date%" }
          category: { eq: "${JSON.parse(ping.categories)[0]}" }
          type: { eq: "${JSON.parse(ping.types)[0]}" }
          region: { in: ["${ping.location}"] }
          price: {
            ${ping.price_min > 0 ? `gte: ${ping.price_min}` : ''}
            ${ping.price_max > 0 ? `lte: ${ping.price_max}` : ''}
          }
          rooms: {
            ${ping.rooms_min > 0 ? `gte: ${ping.rooms_min}` : ''}
            ${ping.rooms_max > 0 ? `lte: ${ping.rooms_max}` : ''}
          }
          area: {
            ${ping.area_m2_min > 0 ? `gte: ${ping.area_m2_min}` : ''}
            ${ping.area_m2_max > 0 ? `lte: ${ping.area_m2_max}` : ''}
          }
          floor: {
            ${ping.floor_min > 0 ? `gte: ${ping.floor_min}` : ''}
            ${ping.floor_max > 0 ? `lte: ${ping.floor_max}` : ''}
          }
        ) {
          results {
            id
            url
            price
            images
            content
            price
            rooms
            area
          }
        }
      }
    `;
  };

  const results = await connection.query({
    sql: `
    SELECT *
    FROM pinger_emails
    WHERE unsubscribed_at IS NULL
      AND confirmed = 1
      AND (limit_reached_at IS NULL OR limit_reached_at < ? OR is_premium = true)
   `,
    values: [moment.utc().startOf('month').toDate()],
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }

      return next();
    },
  });

  const availablePingers = results
    .filter((result) => result.last_check_at !== null)
    .filter((result) => moment().diff(result.last_check_at, 'days') < 2);

  // Simple DDOS protection - require an engineer to
  // intervene if there are too many new sign-ups
  if (availablePingers.length > 100) {
    throw new Error('Pinger MAX limit exceeded');
  }

  await connection.query(
    'UPDATE pinger_emails SET last_check_at = ? WHERE id IN (?)',
    [moment.utc().toDate(), results.map(({ id }) => id)],
  );

  await Promise.all(
    availablePingers.map((result) =>
      sns
        .publish({
          Message: 'ping',
          MessageAttributes: {
            query: {
              DataType: 'String',
              StringValue: buildQuery(result),
            },
            pinger: {
              DataType: 'String',
              StringValue: JSON.stringify(result),
            },
          },
          MessageStructure: 'string',
          TargetArn: `arn:aws:sns:${process.env.AWS_REGION}:173751334418:pinger`,
        })
        .promise(),
    ),
  );

  callback(null, `Invoked ${results.length} item-crawlers.`);
};
