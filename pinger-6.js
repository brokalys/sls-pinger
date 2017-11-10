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

const fileName = 'previous-date-6.txt';

Bugsnag.register('76d5f4207c779acf8eea5ae606a25ca9');

const connection = Mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USERNAME,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_DATABASE,
  timezone : 'Z',
  typeCast : true,
});

function nl2br(str, is_xhtml) {
    var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';
    return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
}

// Read the date of the last call
Q.fcall(() => {
  const deferred = Q.defer();
  const fsConstants = fs.constants || fs;

  fs.access(fileName, fsConstants.R_OK | fsConstants.W_OK, (err) => {
    if (err) {
      const currentDate = (new Date()).toISOString();

      fs.writeFile(fileName, currentDate, (err) => {
        if (err) {
          deferred.reject(err);
          return;
        }

        deferred.resolve(currentDate);
      });
    }

    fs.readFile(fileName, 'utf8', (err, data) => {
      if (err) {
        deferred.reject(err);
        return;
      }

      deferred.resolve(data);
    });
  });

  return deferred.promise;
})

// Load the properties since last call
.then((date) => {
  const deferred = Q.defer();

  connection.connect();

  const query = `
    SELECT * 
    FROM properties 
    WHERE created_at > ? 
      AND category = "apartment"
      AND type = "rent"
      AND (rent_type IS NULL OR rent_type = "monthly")
      AND price <= 700
      AND rooms = 4
      AND ST_Contains(ST_GeomFromText('POLYGON((56.95771 24.09787, 56.95581 24.09645, 56.95019 24.10006, 56.94602 24.10394, 56.94363 24.11091, 56.95547 24.13066, 56.95776 24.12587, 56.96241 24.11633, 56.96268 24.10593, 56.96207 24.0981, 56.95771 24.09787))'), point(lat, lng))
    ORDER BY created_at
  `;

  connection.query(query, [date], (error, results) => {
    if (error) {
      deferred.reject(error);
      return;
    }

    deferred.resolve(results);
  });

  return deferred.promise;
})

// Write the date back in the file
.then((results) => {
  if (results.length === 0) {
    return results;
  }

  const deferred = Q.defer();
  const lastDate = (new Date(results[results.length - 1].created_at)).toISOString();

  fs.writeFile(fileName, lastDate, (err) => {
    if (err) {
      deferred.reject(err);
      return;
    }

    deferred.resolve(results);
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

    fs.readFile('email.html', 'utf8', (err, content) => {
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
        to: 'janis@balticreal.lv',
        bcc: 'matiss@brokalys.com, kristaps@brokalys.com',
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
  const query = 'INSERT INTO pinger_emails (`to`, `bcc`, `from`, `subject`, `content`, `property_id`) VALUES ?';

  const data = results.map((row) => [
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
})

.then(() => {
  connection.destroy();
  console.log('DONE. No errors.');
})

// Catch errors
.catch((error) => {
  console.error('error', error);
  connection.destroy();
});