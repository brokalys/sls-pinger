const fs = require('fs');
const serverlessMysql = require('serverless-mysql');
const moment = require('moment');
const mailgun = require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});
const Handlebars = require('handlebars');
const numeral = require('numeral');

function nl2br(str, is_xhtml) {
  var breakTag =
    is_xhtml || typeof is_xhtml === 'undefined' ? '<br />' : '<br>';
  return (str + '').replace(
    /([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
    '$1' + breakTag + '$2',
  );
}

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

const connectionProperties = serverlessMysql({
  config: {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_PROPERTIES_DATABASE,
    timezone: 'Z',
    typeCast: true,
  },
});

const MAX_MONTHLY_EMAIL = 100;
const EMAIL_SETTINGS = {
  from: 'Brokalys <noreply@brokalys.com>',
};

function getUnsubscribeLink(pinger) {
  return `https://unsubscribe.brokalys.com/?key=${encodeURIComponent(
    pinger.unsubscribe_key,
  )}&id=${encodeURIComponent(pinger.id)}`;
}

async function isMonthlyLimitWarningSent(pinger) {
  const [{ count }] = await connection.query({
    sql: `
      SELECT COUNT(*) as count
      FROM pinger_log
      WHERE pinger_id = ?
        AND created_at >= ?
        AND email_type = ?
    `,
    values: [
      pinger.id,
      moment
        .utc()
        .startOf('month')
        .toDate(),
      'limit-notification',
    ],
  });

  return count > 0;
}

async function sendMonthlyLimitWarning(pinger) {
  const content = fs.readFileSync('src/limit-notification-email.html', 'utf8');
  const template = Handlebars.compile(content);

  pinger.unsubscribe_url = getUnsubscribeLink(pinger);

  const data = {
    ...EMAIL_SETTINGS,
    to: pinger.email,
    subject: 'Brokalys ikmēneša e-pastu limits ir sasniegts',
    html: template(pinger),
  };

  await connection.query(
    'INSERT INTO pinger_log (`to`, `from`, `subject`, `content`, `pinger_id`, `email_type`) VALUES ?',
    [
      [
        [
          data.to,
          data.from,
          data.subject,
          data.html,
          pinger.id,
          'limit-notification',
        ],
      ],
    ],
  );

  await mailgun.messages().send(data);
}

exports.run = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const mainQuery = event.Records[0].Sns.MessageAttributes.query.Value;
  const id = event.Records[0].Sns.MessageAttributes.id.Value;

  const [pinger] = await connection.query({
    sql: 'SELECT * FROM pinger_emails WHERE id = ?',
    values: [id],
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }

      return next();
    },
  });
  const [{ count: emailsSent }] = await connection.query({
    sql:
      'SELECT COUNT(*) as count FROM pinger_log WHERE pinger_id = ? AND created_at >= ?',
    values: [
      id,
      moment
        .utc()
        .startOf('month')
        .toDate(),
    ],
  });

  await connection.query(
    'UPDATE pinger_emails SET last_check_at = ? WHERE id = ?',
    [moment.utc().toDate(), id],
  );

  if (pinger.last_check_at === null) {
    callback(null, 'Initial run successful');
    return;
  }

  // if (emailsSent >= MAX_MONTHLY_EMAIL && !pinger.is_premium) {
  //   if ((await isMonthlyLimitWarningSent(pinger)) === false) {
  //     await sendMonthlyLimitWarning(pinger);
  //   }

  //   callback(null, 'Monthly limit exceeded');
  //   return;
  // }

  const results = await connectionProperties.query(mainQuery, [
    pinger.last_check_at,
  ]);

  if (results.length) {
    const content = fs.readFileSync('src/email.html', 'utf8');
    const template = Handlebars.compile(content);

    results = await Promise.all(
      results.map(async result => {
        result.content = nl2br(
          (result.content || '').toString('utf8').replace(/(<([^>]+)>)/gi, ''),
        );

        if (result.images) {
          result.images = JSON.parse(result.images);
        }

        result.unsubscribe_url = getUnsubscribeLink(pinger);
        result.url = `https://view.brokalys.com/?link=${encodeURIComponent(
          result.url,
        )}`;
        result.price = numeral(result.price).format('0,0 €');

        const html = template(result);
        const data = {
          ...EMAIL_SETTINGS,
          to: pinger.email,
          subject: 'Jauns PINGER sludinājums',
          html,
        };

        await mailgun.messages().send(data);

        return Promise.resolve({
          email: data,
          property: result,
        });
      }),
    );

    await connection.query(
      'INSERT INTO pinger_log (`to`, `bcc`, `from`, `subject`, `content`, `property_id`, `pinger_id`) VALUES ?',
      [
        results.map(row => [
          row.email.to,
          row.email.bcc,
          row.email.from,
          row.email.subject,
          row.email.html,
          row.property.id,
          id,
        ]),
      ],
    );
  }

  callback(null, 'Success');
};
