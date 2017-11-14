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

const fileName = 'previous-date-4.txt';

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

const currentDate = (new Date()).toISOString();

// Read the date of the last call
Q.fcall(() => {
  const deferred = Q.defer();
  const fsConstants = fs.constants || fs;

  fs.access(fileName, fsConstants.R_OK | fsConstants.W_OK, (err) => {
    if (err) {
      fs.writeFile(fileName, currentDate, (err) => {
        if (err) {
          deferred.reject(err);
          return;
        }

        deferred.resolve(currentDate);
      });
      return;
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
    WHERE published_at > ?
      AND type = "sell"
      AND (
        ST_Contains(ST_GeomFromText('POLYGON((57.02613 23.49772, 57.02576 23.49584, 57.01716 23.50378, 57.00883 23.51414, 57.00856 23.51586, 57.02229 23.50329, 57.02613 23.49772))'), point(lat, lng))
        OR ST_Contains(ST_GeomFromText('POLYGON((57.00868 23.51499, 56.98634 23.54409, 56.97665 23.56234, 56.97335 23.59915, 56.96484 23.6258, 56.96927 23.74224, 56.97655 23.79148, 56.98936 23.85963, 56.99877 23.90037, 57.00716 23.92643, 57.0074 23.92735, 57.01659 23.94902, 57.03297 23.98875, 57.04427 24.00302, 57.06217 24.02159, 57.07063 24.04443, 57.09162 24.13279, 57.10724 24.17259, 57.12882 24.2176, 57.14223 24.23873, 57.16024 24.26156, 57.17112 24.28946, 57.21498 24.36572, 57.23135 24.38427, 57.24282 24.39551, 57.26907 24.40996, 57.30005 24.4047, 57.3048 24.40473, 57.30473 24.40922, 57.28864 24.41237, 57.2776 24.41524, 57.26701 24.4128, 57.25883 24.40933, 57.25121 24.40466, 57.23712 24.39455, 57.23368 24.39123, 57.22365 24.38565, 57.1955 24.34362, 57.169 24.29409, 57.15477 24.28826, 57.14092 24.24199, 57.12731 24.22003, 57.10633 24.17713, 57.09068 24.13703, 57.07651 24.09235, 57.07296 24.07822, 57.06978 24.06306, 57.06604 24.03671, 57.06062 24.02418, 57.04954 24.0139, 57.03773 23.9985, 57.02852 23.98388, 57.02391 23.97588, 57.01666 23.95666, 57.00501 23.93801, 57.00204 23.91497, 56.99105 23.87988, 56.98101 23.82799, 56.97541 23.7931, 56.9716 23.77061, 56.96848 23.74768, 56.96636 23.73204, 56.96461 23.71597, 56.96252 23.68222, 56.96181 23.6564, 56.96225 23.64234, 56.96342 23.6308, 56.96485 23.6193, 56.96762 23.6092, 56.97213 23.59795, 56.97453 23.56619, 56.97792 23.55493, 56.99054 23.53093, 56.99151 23.52617, 56.99426 23.52416, 56.9994 23.51964, 57.00489 23.51651, 57.00678 23.51507, 57.00868 23.51499))'), point(lat, lng))
      )
    ORDER BY published_at
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
  const deferred = Q.defer();
  const lastDate = results.length > 0 ? (new Date(results[results.length - 1].published_at)).toISOString() : currentDate;

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
        // bcc: 'matiss@brokalys.com, kristaps@brokalys.com',
        subject: 'Saulkrasti-Ragaciems: Jauns PINGER sludinājums',
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