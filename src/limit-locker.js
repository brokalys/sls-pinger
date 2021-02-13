import * as db from './shared/db';
import sns from './shared/sns';

exports.run = async (event, context = {}) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Get all emails that should be in the `locked` state
  const lockedEmails = await db.getEmailsThatShouldBeLimitLocked();

  if (!lockedEmails.length) {
    return;
  }

  // Lock all the emails that have not yet been locked
  await db.limitLockPingerEmails(lockedEmails);

  // Emails that have received limit-locker notification email
  const limitNotificationEmails = await db.getEmailsWithLimitLockerNotification(
    lockedEmails,
  );

  // Filter emails that have NOT received the notification
  const emails = lockedEmails.filter(
    (email) => !limitNotificationEmails.includes(email),
  );

  if (!emails.length) {
    return;
  }

  // Send all the emails
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
};
