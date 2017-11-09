// Loop:
// - Get previous timestamp
// - Get all ads matching a criteria and within timestamp
// - Update timestamp
// - Send email
'use strict';

require('dotenv').config();

const Q       = require('q');
const fs      = require('fs');
const Bugsnag = require('bugsnag');
const Mysql   = require('mysql');
const mailgun = require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY, 
  domain: process.env.MAILGUN_DOMAIN,
});
const Handlebars = require('handlebars');
const numeral = require('numeral');

const fileName = 'previous-date-custom.txt';

Bugsnag.register('76d5f4207c779acf8eea5ae606a25ca9');

const connection = Mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USERNAME,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_DATABASE,
  timezone : 'Z',
  typeCast : true,
});

const date = (new Date()).toISOString();

function nl2br(str, is_xhtml) {
    var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';
    return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}

function buildQuery(ping) {
    // @todo
    return `
        SELECT *
        FROM properties
        WHERE created_at > ${connection.escape(date)}
          AND category IN ("${ JSON.parse(ping.categories).join('", "') }")
        ORDER BY id DESC
        LIMIT 1
    `;
}

// Read the date of the last call
Q.fcall(() => {
  const deferred = Q.defer();
  
  connection.connect();

  connection.query('SELECT * FROM pinger WHERE unsubscribed_at IS NULL AND (last_check_at <= ? OR last_check_at IS NULL)', [date], (error, results) => {
    if (error) return deferred.reject(error);

    deferred.resolve(results);
  });

  return deferred.promise;
})

// Get properties
.then((pings) => Q.all(pings.map((ping) => {
    const deferred = Q.defer();

    connection.query(buildQuery(ping), (error, properties) => {
        if (error) return deferred.reject(error);

        console.log(properties);
        deferred.resolve({
            ping,
            properties,
        });
    });

    return deferred.promise;
})))

// Send emails
.then((data) => Q.all(data.map(({ ping, properties }) => {
    const deferred = Q.defer();

    fs.readFile('email.html', 'utf8', (error, content) => {
        if (error) return deferred.reject(error);

        console.log(properties);
        deferred.resolve({
            ping,
            properties: Q.all(properties.map((property) => {
                const deferred = Q.defer();
                property.content = nl2br((property.content || '').toString('utf8').replace(/(<([^>]+)>)/ig, ""));

                if (property.images) {
                    property.images = JSON.parse(property.images);
                }

                property.url = `https://view.brokalys.com/?link=${encodeURIComponent(property.url)}`;
                property.price = numeral(property.price).format('0,0 €');

                const template = Handlebars.compile(content);
                const html = template(result);

                const data = {
                    from: 'Brokalys <noreply@brokalys.com>',
                    to: ping.email,
                    bcc: 'matiss@brokalys.com',
                    subject: 'Jauns PINGER sludinājums',
                    html,
                };

                mailgun.messages().send(data, (error, body) => {
                    if (error) return deferred.reject(error);

                    deferred.resolve({
                        property,
                        email: data,
                    });

                    // connection.query('UPDATE pinger SET last_check_at = ? WHERE id = ?', [date, ping.id], (error) => {
                    //     if (error) return deferred.reject(error);

                    //     deferred.resolve(property);
                    // });
                });

                return deferred.promise;
            })),
        });

    });

    return deferred.promise;
})))

// Save in database
// .then((data) => {
//     return Q.all(data.map(({ ping }) => {
//         const deferred = Q.defer();

//         connection.query('UPDATE pinger SET last_check_at = ? WHERE id = ?', [date, ping.id], (error) => {
//             if (error) return deferred.reject(error);

//             deferred.resolve(property);
//         });

//         return deferred.promise;
//     }));
// })

.then((results) => Q.all(results.map(({ properties }) => {
  if (properties.length === 0) {
    return [];
  }

  const deferred = Q.defer();
  const query = 'INSERT INTO pinger_emails (`to`, `bcc`, `from`, `subject`, `content`, `property_id`) VALUES ?';

  const data = properties.map((row) => [
    row.email.to,
    row.email.bcc,
    row.email.from,
    row.email.subject,
    row.email.html,
    row.property.id,
  ]);

  connection.query(query, [data], (error, response) => {
    if (error) {
      deferred.reject(error);
      return;
    }

    deferred.resolve(response);
  })

  return deferred.promise;
})))

.then(() => {
  connection.destroy();
  console.log('DONE. No errors.');
})

// Catch errors
.catch((error) => {
  console.error('error', error);
  connection.destroy();
});