const fs = require('fs');
const serverlessMysql = require('serverless-mysql');
const mailgun = require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});
const Handlebars = require('handlebars');

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

  const { MessageAttributes } = event.Records[0].Sns;
  console.log('Input', JSON.stringify(MessageAttributes));

  const to = MessageAttributes.to.Value;
  const subject = MessageAttributes.subject.Value;
  const pingerId = (MessageAttributes.pinger_id || {}).Value;
  const templateId = MessageAttributes.template_id.Value;
  const templateVariables = MessageAttributes.template_variables
    ? JSON.parse(MessageAttributes.template_variables.Value)
    : {};

  const content = fs.readFileSync(`src/${templateId}.html`, 'utf8');
  const template = Handlebars.compile(content);
  const html = template(templateVariables);

  const data = {
    from: 'Brokalys <noreply@brokalys.com>',
    subject,
    to,
    html,
  };

  const email = await mailgun.messages().send(data);

  await connection.query({
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

  callback(null, 'Success');
};
