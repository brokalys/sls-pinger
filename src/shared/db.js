const serverlessMysql = require('serverless-mysql');
const moment = require('moment');

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

function getPingersByFrequency(frequency) {
  return connection.query({
    sql: `
      SELECT pinger.*, (CASE WHEN premium.email IS NULL THEN false ELSE true END) as is_premium
      FROM pinger_emails as pinger
      LEFT JOIN pinger_premium_emails premium ON premium.email = pinger.email
      WHERE pinger.unsubscribed_at IS NULL
        AND (pinger.limit_reached_at IS NULL OR pinger.limit_reached_at < ? OR premium.email IS NOT NULL)
        AND pinger.frequency = ?
   `,
    values: [startOfMonth, frequency],
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }

      if (field.name === 'categories' || field.name === 'types') {
        return JSON.parse(field.string());
      }

      if (field.name === 'is_premium') {
        return field.string() === '1';
      }

      return next();
    },
  });
}

function getPropertyQueueForPingers(pingerIds) {
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

function lockPropertyQueueItems(itemIds) {
  return connection.query({
    sql: `
      UPDATE pinger_queue
      SET locked = 1
      WHERE id IN (?)
   `,
    values: [itemIds],
  });
}

function deletePropertyQueueItems(itemIds) {
  return connection.query({
    sql: `
      DELETE FROM pinger_queue
      WHERE id IN (?)
   `,
    values: [itemIds],
  });
}

async function getEmailsThatShouldBeLimitLocked() {
  return (
    await connection.query(
      `
        SELECT em.email
        FROM pinger_log lo
        INNER JOIN pinger_emails em ON em.id = lo.pinger_id
        LEFT JOIN pinger_premium_emails premium ON premium.email = em.email
        WHERE lo.created_at >= ?
          AND premium.email IS NULL
        GROUP BY em.email
        HAVING COUNT(*) >= ?
      `,
      [startOfMonth, MAX_MONTHLY_EMAILS],
    )
  ).map((row) => row.email);
}

async function getEmailsWithLimitLockerNotification(emails) {
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

function limitLockPingerEmails(emails) {
  return connection.query(
    `
      UPDATE pinger_emails
      SET limit_reached_at = NOW()
      WHERE email IN (?)
        AND (limit_reached_at < ? OR limit_reached_at IS NULL)
        AND unsubscribed_at IS NULL
    `,
    [emails, startOfMonth],
  );
}

function createPingerStatsEntry(pingerId, data) {
  return connection.query(
    `
      INSERT INTO pinger_property_stats
      SET ?
    `,
    {
      pinger_id: pingerId,
      data: JSON.stringify(data),
    },
  );
}

function logPingerAttempt(values) {
  return connection.query({
    sql: 'INSERT INTO pinger_log SET ?',
    values,
  });
}

function updatePingerAttemptTimestamp(id) {
  return connection.query({
    sql: `UPDATE pinger_log SET sent_at = NOW() WHERE id = ?`,
    values: [id],
  });
}

function getAvailablePingers() {
  return connection.query({
    sql: `
      SELECT pinger.*, (CASE WHEN premium.email IS NULL THEN false ELSE true END) as is_premium
      FROM pinger_emails pinger
      LEFT JOIN pinger_premium_emails premium ON premium.email = pinger.email
      WHERE pinger.unsubscribed_at IS NULL
        AND (pinger.limit_reached_at IS NULL OR pinger.limit_reached_at < ? OR premium.email IS NOT NULL)
    `,
    values: [moment.utc().startOf('month').toDate()],
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }

      if (field.name === 'categories' || field.name === 'types') {
        return JSON.parse(field.string());
      }

      if (field.name === 'is_premium') {
        return field.string() === '1';
      }

      return next();
    },
  });
}

function queuePingerForSummaryEmail(pingerId, data) {
  return connection.query({
    sql: `
      INSERT INTO pinger_queue
      SET ?
   `,
    values: {
      pinger_id: pingerId,
      data: JSON.stringify(data),
    },
  });
}

function getPropertyStats(pingerIds, frequency) {
  let identifier = 'DAY';

  switch (frequency) {
    case 'weekly':
      identifier = 'WEEK';
      break;
    case 'monthly':
      identifier = 'MONTH';
      break;
  }

  return connection.query({
    sql: `
      SELECT *
      FROM pinger_property_stats
      WHERE created_at >= DATE_ADD(CURDATE(), INTERVAL -12 ${identifier})
        AND pinger_id IN (?)
      ORDER BY created_at DESC
   `,
    values: [pingerIds],
    typeCast(field, next) {
      if (field.name === 'data') {
        return JSON.parse(field.string());
      }

      return next();
    },
  });
}

module.exports = {
  getPingersByFrequency,
  getPropertyQueueForPingers,
  lockPropertyQueueItems,
  deletePropertyQueueItems,
  getEmailsThatShouldBeLimitLocked,
  getEmailsWithLimitLockerNotification,
  limitLockPingerEmails,
  createPingerStatsEntry,
  logPingerAttempt,
  updatePingerAttemptTimestamp,
  getAvailablePingers,
  queuePingerForSummaryEmail,
  getPropertyStats,
};
