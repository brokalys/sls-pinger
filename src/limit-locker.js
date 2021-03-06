import * as db from './shared/db';
import sns from './shared/sns';
import * as utils from './shared/utils';

exports.run = async (event, context) => {
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
          TargetArn: utils.constructArn(
            context,
            process.env.EMAIL_SNS_TOPIC_NAME,
          ),
        })
        .promise();
    }),
  );
};
