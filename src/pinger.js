'use strict';

require('dotenv').config();

const Q       = require('q');
const fs      = require('fs');
const Mysql   = require('mysql');
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

module.exports.run = (event, context, callback) => {
  let email;
  const mainQuery = event.Records[0].Sns.MessageAttributes.query.Value;
  const id = event.Records[0].Sns.MessageAttributes.id.Value;

  const currentDate = (new Date()).toISOString();

  const connection = Mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USERNAME,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE,
    timezone : 'Z',
    typeCast : true,
  });

  const connectionProperties = Mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USERNAME,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_PROPERTIES_DATABASE,
    timezone : 'Z',
    typeCast : true,
  });

  connection.connect();

  // Read the date of the last call
  Q.fcall(() => {
    const deferred = Q.defer();

    connection.query('SELECT last_check_at, email FROM pinger_emails WHERE id = ?', [id], (error, results) => {
      if (error) {
        deferred.reject(error);
        return;
      }

      if (results.length < 1) {
        deferred.reject(results);
        return;
      }

      email = results[0].email;
      deferred.resolve(results[0].last_check_at);
    });

    return deferred.promise;
  })

  // Load the properties since last call
  .then((date) => {
    const deferred = Q.defer();

    connectionProperties.connect();
    connectionProperties.query(mainQuery, [date], (error, results) => {
      connectionProperties.end();
      if (error) {
        deferred.reject(error);
        return;
      }

      deferred.resolve(results);
    });

    return deferred.promise;
  })

  // Write the date back in the file
  .then((properties) => {
    const deferred = Q.defer();
    const lastDate = currentDate.replace('T', ' ').replace('Z', '');

    connection.query('UPDATE pinger_emails SET last_check_at = ? WHERE id = ?', [lastDate, id], (error, results) => {
      if (error) {
        deferred.reject(error);
        return;
      }

      deferred.resolve(properties);
    });

    return deferred.promise;
  })

  // Send notifications
  .then((results) => {
    if (results.length === 0) {
      return [];
    }

    return Q.all(results.map((result) => {
      const deferred = Q.defer();

      fs.readFile('src/email.html', 'utf8', (err, content) => {
        if (err) {
          deferred.reject(err);
          return;
        }

        result.content = nl2br((result.content || '').toString('utf8').replace(/(<([^>]+)>)/ig, ""));

        if (result.images) {
          result.images = JSON.parse(result.images);
        }

        result.url = `https://view.brokalys.com/?link=${encodeURIComponent(result.url)}`;
        result.price = numeral(result.price).format('0,0 €');

        const template = Handlebars.compile(content);
        const html = template(result);

        var data = {
          from: 'Brokalys <noreply@brokalys.com>',
          to: email,
          subject: 'Jauns PINGER sludinājums',
          html,
        };

        mailgun.messages().send(data, (error, body) => {
          if (error) {
            deferred.reject(error);
            return;
          }

          console.log(body);
          deferred.resolve({
            email: data,
            property: result,
          });
        });
      });

      return deferred.promise;
    }));
  })

  // Save in database
  .then((results) => {
    if (results.length === 0) {
      return [];
    }

    const deferred = Q.defer();
    const query = 'INSERT INTO pinger_log (`to`, `bcc`, `from`, `subject`, `content`, `property_id`, `pinger_id`) VALUES ?';

    const data = results.map((row) => [
      row.email.to,
      row.email.bcc,
      row.email.from,
      row.email.subject,
      row.email.html,
      row.property.id,
      id,
    ]);

    connection.query(query, [data], (error, response) => {
      if (error) {
        deferred.reject(error);
        return;
      }

      deferred.resolve(response);
    })

    return deferred.promise;
  })

  .then(() => {
    console.log('DONE. No errors.');
    callback(null, 'Success');
    connection.destroy();
  })

  // Catch errors
  .catch((error) => {
    console.error('error', error);
    callback(error);
    connection.destroy();
  });
}