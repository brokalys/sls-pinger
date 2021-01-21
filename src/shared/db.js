import serverlessMysql from 'serverless-mysql';
import moment from 'moment';

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

export function getPingersByType(type) {
  return connection.query({
    sql: `
      SELECT *
      FROM pinger_emails
      WHERE unsubscribed_at IS NULL
        AND (limit_reached_at IS NULL OR limit_reached_at < ? OR is_premium = true)
        AND type = ?
   `,
    values: [moment.utc().startOf('month').toDate(), type],
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
}

export function getPropertyQueueForPingers(pingerIds) {
  return connection.query({
    sql: `
      SELECT *
      FROM pinger_queue
      WHERE pinger_id IN (?)
        AND locked = 0
   `,
    values: [pingerIds],
  });
}

export function lockPropertyQueueItems(itemIds) {
  return connection.query({
    sql: `
      UPDATE pinger_queue
      SET locked = 1
      WHERE id IN (?)
   `,
    values: [itemIds],
  });
}

export function deletePropertyQueueItems(itemIds) {
  return connection.query({
    sql: `
      DELETE FROM pinger_queue
      WHERE id IN (?)
   `,
    values: [itemIds],
  });
}
