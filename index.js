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

const fileName = 'previous-date.txt';

Bugsnag.register('76d5f4207c779acf8eea5ae606a25ca9');

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
      AND type = "rent"
      AND category = "apartment"
      AND (rent_type = "monthly" OR rent_type IS NULL)
      AND (rooms >= 2 OR rooms IS NULL)
      AND price <= 300
      AND price >= 180
      AND (
        Contains(GeomFromText('POLYGON((56.94806 24.0798, 56.93907 24.09336, 56.95518 24.15087, 56.96819 24.12752, 56.94806 24.0798))'), point(lat, lng))
        OR Contains(GeomFromText('POLYGON((56.96538 24.20769, 56.94619 24.20666, 56.95356 24.15364, 56.96718 24.14899, 56.96987 24.18468, 56.96538 24.20769))'), point(lat, lng))
      )
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

      result.content = result.content.toString('utf8').replace(/(<([^>]+)>)/ig, "");

      if (result.images) {
        result.images = JSON.parse(result.images);
      }

      result.url = `https://view.brokalys.com/?link=${encodeURIComponent(result.url)}`;

      const template = Handlebars.compile(content);
      const html = template(result);

      var data = {
        from: 'Brokalys <noreply@brokalys.com>',
        to: 'kristaps.aboltins@gmail.com',
        cc: 'matiss.ja+brokalys@gmail.com',
        subject: 'Jauns īres sludinājums mammas dzīvoklim',
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