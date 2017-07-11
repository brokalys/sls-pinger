'use strict';

require('dotenv').config();

const Q       = require('q');
const fs      = require('fs');
const Mysql   = require('mysql');
const mailgun = require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY, 
  domain: process.env.MAILGUN_DOMAIN,
});

const fileName = 'previous-date.txt';

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
  });

  connection.connect();

  const query = 'SELECT type, category, rent_type, lat, lng, price, url, created_at FROM `properties` WHERE created_at > ? ORDER BY created_at';
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

  const deferred = Q.defer();

  results.forEach((result) => {

    // Mammas filtri
    if (result.type === 'rent' && 
        result.category === 'apartment' &&
        result.rent_type === 'monthly' &&
        result.price <= 190 &&
        result.lat >= 56.951328 &&
        result.lat <= 56.971734 &&
        result.lng >= 24.135442 &&
        result.lng <= 24.161523) {

      var data = {
        from: 'Brokalys <noreply@brokalys.com>',
        to: 'matiss.ja+brokalys@gmail.com',
        // cc: 'matiss.ja+brokalys@gmail.com', // @todo: when swapping over to kristaps, uncomment this
        subject: 'Jauns īres sludinājums mammas dzīvoklim',
        text: 'Adrese: ' + result.url
      };

      mailgun.messages().send(data, (error, body) => {
        if (error) {
          deferred.reject(error);
          return;
        }

        console.log(body);
        deferred.resolve();
      });
    }

  });

  return deferred.promise;
})

.then(() => {
  console.log('DONE. No errors.');
})

// Catch errors
.catch((error) => {
  console.error(error);
});