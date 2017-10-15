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

const fileName = 'previous-date-2.txt';

Bugsnag.register('76d5f4207c779acf8eea5ae606a25ca9');

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

  const connection = Mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USERNAME,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE,
    timezone : 'Z',
    typeCast : true,
  });

  connection.connect();

  const query = `
    SELECT * 
    FROM properties 
    WHERE created_at > ? 
      AND category = "apartment"
      AND type = "sell"
      AND floor >= 2
      AND rooms >= 1 AND rooms <= 2
      AND area >= 25
      AND area <= 35
      AND price <= 70000
      AND ST_Contains(ST_GeomFromText('POLYGON((56.96388 24.07499, 56.95499 24.07499, 56.95087 24.07671, 56.94694 24.08134, 56.9416 24.08684, 56.93261 24.09044, 56.92259 24.07413, 56.92389 24.05964, 56.93018 24.04993, 56.93861 24.04478, 56.94923 24.04136, 56.95321 24.04015, 56.95972 24.03998, 56.96331 24.04373, 56.969 24.04614, 56.9738 24.04924, 56.97689 24.05714, 56.97642 24.06641, 56.97221 24.07207, 56.96987 24.07671, 56.96285 24.07585, 56.96388 24.07499))'), point(lat, lng))
  ORDER BY created_at
  `;

  connection.query(query, [date], (error, results) => {
    connection.destroy();

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
    return;
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
        to: 'janis@balticreal.lv'
        bcc: 'matiss@brokalys.com, kristaps@brokalys.com',
        subject: '2. kategorija: Jauns PINGER sludinājums',
        html,
      };

      mailgun.messages().send(data, (error, body) => {
        if (error) {
          deferred.reject(error);
          return;
        }

        console.log(body);
        deferred.resolve();
      });
    });

    return deferred.promise;
  }));
})

.then(() => {
  console.log('DONE. No errors.');
})

// Catch errors
.catch((error) => {
  console.error('error', error);
});