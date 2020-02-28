const fs = require('fs');
const serverlessMysql = require('serverless-mysql');
const mailgun = require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});
const Handlebars = require('handlebars');
const numeral = require('numeral');

function nl2br(str, is_xhtml) {
    var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';
    return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}

const connection = serverlessMysql({
  config: {
    host     : process.env.DB_HOST,
    user     : process.env.DB_USERNAME,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE,
    timezone : 'Z',
    typeCast : true,
  },
});

const connectionProperties = serverlessMysql({
  config: {
    host     : process.env.DB_HOST,
    user     : process.env.DB_USERNAME,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_PROPERTIES_DATABASE,
    timezone : 'Z',
    typeCast : true,
  },
});

exports.run = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const mainQuery = event.Records[0].Sns.MessageAttributes.query.Value;
  const id = event.Records[0].Sns.MessageAttributes.id.Value;

  const currentDate = (new Date()).toISOString();
  const lastDate = currentDate.replace('T', ' ').replace('Z', '');

  const [pinger] = await connection.query('SELECT * FROM pinger_emails WHERE id = ?', [id]);

  let results = [];

  if (pinger.last_check_at !== null) {
    results = await connectionProperties.query(mainQuery, [pinger.last_check_at]);
  }

  await connection.query('UPDATE pinger_emails SET last_check_at = ? WHERE id = ?', [lastDate, id]);

  if (results.length) {
    const content = fs.readFileSync('src/email.html', 'utf8');
    const template = Handlebars.compile(content);

    results = await Promise.all(results.map(async (result) => {
      result.content = nl2br((result.content || '').toString('utf8').replace(/(<([^>]+)>)/ig, ""));

      if (result.images) {
        result.images = JSON.parse(result.images);
      }

      result.unsubscribe_url = `https://unsubscribe.brokalys.com/?key=${encodeURIComponent(pinger.unsubscribe_key)}&id=${encodeURIComponent(pinger.id)}`;
      result.url = `https://view.brokalys.com/?link=${encodeURIComponent(result.url)}`;
      result.price = numeral(result.price).format('0,0 €');

      const html = template(result);
      const data = {
        from: 'Brokalys <noreply@brokalys.com>',
        to: pinger.email,
        subject: 'Jauns PINGER sludinājums',
        html,
      };

      await mailgun.messages().send(data);

      return Promise.resolve({
        email: data,
        property: result,
      });
    }));

    await connection.query(
      'INSERT INTO pinger_log (`to`, `bcc`, `from`, `subject`, `content`, `property_id`, `pinger_id`) VALUES ?',
      [
        results.map((row) => [
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
}
