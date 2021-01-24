import fs from 'fs';
import Handlebars from 'handlebars';
import * as db from './shared/db';
import ses from './shared/ses';

exports.run = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const { MessageAttributes } = event.Records[0].Sns;

  const to = MessageAttributes.to.Value;
  const subject = MessageAttributes.subject.Value;
  const pingerId = (MessageAttributes.pinger_id || {}).Value;
  const templateId = MessageAttributes.template_id.Value;
  const templateVariables = MessageAttributes.template_variables
    ? JSON.parse(MessageAttributes.template_variables.Value)
    : {};

  const content = fs.readFileSync(`src/templates/${templateId}.html`, 'utf8');
  const template = Handlebars.compile(content);
  const html = template(templateVariables);

  const data = {
    from: 'Brokalys <noreply@brokalys.com>',
    subject,
    to,
    html,
    replyTo: 'Matiss <matiss@brokalys.com>',
  };

  const { insertId } = await db.query({
    sql: 'INSERT INTO pinger_log SET ?',
    values: {
      to: data.to,
      from: data.from,
      subject: data.subject,
      content: data.html,
      pinger_id: pingerId,
      email_type: templateId,
      property_id: templateVariables.propertyId || null,
    },
  });

  await ses
    .sendEmail({
      Destination: {
        ToAddresses: [data.to],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: data.html,
          },
        },
        Subject: { Data: data.subject },
      },
      ReplyToAddresses: [data.replyTo],
      Source: data.from,
    })
    .promise();

  await db.query({
    sql: `UPDATE pinger_log SET sent_at = NOW() WHERE id = ?`,
    values: [insertId],
  });

  callback(null, 'Success');
};
