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

  const buildQuery = ping => {
    return `
      SELECT *
      FROM properties
      WHERE created_at > ?
       ${
         ping.categories
           ? `AND category IN ("${JSON.parse(ping.categories).join('","')}")`
           : ''
       }
       ${
         ping.types
           ? `AND type IN ("${JSON.parse(ping.types).join('","')}")`
           : ''
       }
       ${
         ping.types && JSON.parse(ping.types).indexOf('rent') >= 0
           ? 'AND (rent_type IS NULL OR rent_type = "monthly")'
           : ''
       }
       ${ping.price_min > 0 ? `AND price >= ${ping.price_min}` : ''}
       ${ping.price_max > 0 ? `AND price <= ${ping.price_max}` : ''}
       ${ping.rooms_min > 0 ? `AND rooms >= ${ping.rooms_min}` : ''}
       ${ping.rooms_max > 0 ? `AND rooms <= ${ping.rooms_max}` : ''}
       ${
         ping.area_m2_min > 0
           ? `AND (area >= ${ping.area_m2_min} AND area_measurement = "m2" OR area_measurement != "m2")`
           : ''
       }
       ${
         ping.area_m2_max > 0
           ? `AND (area <= ${ping.area_m2_max} AND area_measurement = "m2" OR area_measurement != "m2")`
           : ''
       }
       ${ping.additional ? `AND ${ping.additional}` : ''}
       ${
         ping.location
           ? `AND ST_Contains(ST_GeomFromText('POLYGON((${ping.location}))'), point(lat, lng))`
           : ''
       }
      ORDER BY created_at
    `;
  };

  const results = await connection.query({
    sql:
      'SELECT * FROM pinger_emails WHERE unsubscribed_at IS NULL AND confirmed = 1',
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }

      return next();
    },
  });

  await connection.query(
    'UPDATE pinger_emails SET last_check_at = ? WHERE unsubscribed_at IS NULL AND confirmed = 1',
    [moment.utc().toDate(), id],
  );

  await Promise.all(
    results
      .filter(result => result.last_check_at !== null)
      .map(result =>
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
            TargetArn: 'arn:aws:sns:eu-west-1:173751334418:pinger',
          })
          .promise(),
      ),
  );

  callback(null, `Invoked ${results.length} item-crawlers.`);
};
