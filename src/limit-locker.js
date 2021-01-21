import moment from 'moment';
import * as db from './shared/db';
import sns from './shared/sns';

const MAX_MONTHLY_EMAILS = 100;

async function isMonthlyLimitWarningSent(email) {
  const [{ count }] = await db.query({
    sql: `
      SELECT COUNT(*) as count
      FROM pinger_log
      WHERE to = ?
        AND created_at >= ?
        AND email_type = ?
    `,
    values: [
      email,
      moment.utc().startOf('month').toDate(),
      'limit-notification',
    ],
  });

  return count > 0;
}

exports.run = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const emails = (
    await db.query(
      `
    SELECT em.email
    FROM pinger_log lo
    INNER JOIN pinger_emails em ON em.id = lo.pinger_id
    WHERE lo.created_at >= ?
      AND em.is_premium = false
      AND (em.limit_reached_at < ? OR em.limit_reached_at IS NULL)
    GROUP BY em.email
    HAVING COUNT(*) >= ?
  `,
      [
        moment.utc().startOf('month').toDate(),
        moment.utc().startOf('month').toDate(),
        MAX_MONTHLY_EMAILS,
      ],
    )
  ).map((row) => row.email);

  if (!emails.length) {
    callback(null, 'Nothing to do');
    return;
  }

  await db.query(
    `
    UPDATE pinger_emails
    SET limit_reached_at = NOW()
    WHERE email IN (?)
  `,
    [emails],
  );

  await Promise.all(
    emails.map((email) => {
      sns
        .publish({
          Message: 'email',
          MessageAttributes: {
            to: {
              DataType: 'String',
              StringValue: email,
            },
            subject: {
              DataType: 'String',
              StringValue: 'Brokalys ikmēneša e-pastu limits ir sasniegts',
            },
            template_id: {
              DataType: 'String',
              StringValue: 'limit-notification-email',
            },
          },
          MessageStructure: 'string',
          TargetArn: `arn:aws:sns:${process.env.AWS_REGION}:173751334418:email-${process.env.STAGE}`,
        })
        .promise();
    }),
  );

  callback(null, 'Success');
};
