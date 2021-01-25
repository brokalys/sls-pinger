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

const MAX_MONTHLY_EMAILS = 100;
const startOfMonth = moment.utc().startOf('month').toDate();

export const query = connection.query;

export function getPingersByType(type) {
  return connection.query({
    sql: `
      SELECT *
      FROM pinger_emails
      WHERE unsubscribed_at IS NULL
        AND (limit_reached_at IS NULL OR limit_reached_at < ? OR is_premium = true)
        AND type = ?
   `,
    values: [startOfMonth, type],
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

export async function getEmailsThatShouldBeLimitLocked() {
  return (
    await connection.query(
      `
        SELECT em.email
        FROM pinger_log lo
        INNER JOIN pinger_emails em ON em.id = lo.pinger_id
        WHERE lo.created_at >= ?
          AND em.is_premium = false
        GROUP BY em.email
        HAVING COUNT(*) >= ?
      `,
      [startOfMonth, MAX_MONTHLY_EMAILS],
    )
  ).map((row) => row.email);
}

export async function getEmailsWithLimitLockerNotification(emails) {
  return (
    await connection.query({
      sql: `
        SELECT pl.to
        FROM pinger_log pl
        WHERE pl.created_at >= ?
          AND pl.email_type = ?
        GROUP BY pl.to
      `,
      values: [startOfMonth, 'limit-notification'],
    })
  ).map((row) => row.to);
}

export function limitLockPingerEmails(emails) {
  return connection.query(
    `
      UPDATE pinger_emails
      SET limit_reached_at = NOW()
      WHERE email IN (?)
        AND (limit_reached_at < ? OR limit_reached_at IS NULL)
    `,
    [emails, startOfMonth],
  );
}

export function createPingerStatsEntry(pingerId, data) {
  return connection.query(
    `
      INSERT INTO pinger_property_stats
      SET ?
    `,
    {
      pinger_id: pingerId,
      data,
    },
  );
}
