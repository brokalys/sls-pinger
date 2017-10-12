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

const fileName = 'previous-date.txt';

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
      AND ST_Contains(ST_GeomFromText('POLYGON((57.22862 24.38596, 57.23498 24.39359, 57.24664 24.40553, 57.24756 24.40622, 57.25314 24.40994, 57.25694 24.41196, 57.25746 24.41023, 57.26058 24.41187, 57.26214 24.41043, 57.26337 24.4108, 57.26593 24.41265, 57.26713 24.41425, 57.27173 24.41548, 57.27486 24.41651, 57.27704 24.41748, 57.27924 24.41703, 57.28186 24.41635, 57.28435 24.41463, 57.28773 24.41292, 57.29285 24.41053, 57.29823 24.40995, 57.30434 24.40965, 57.3092 24.41174, 57.31219 24.41263, 57.3134 24.41393, 57.31835 24.41685, 57.32131 24.41085, 57.32405 24.4096, 57.32674 24.40747, 57.32857 24.40784, 57.33311 24.40575, 57.33623 24.4048, 57.33946 24.40561, 57.34534 24.40553, 57.34976 24.40433, 57.35407 24.40309, 57.36684 24.40681, 57.37536 24.4027, 57.3845 24.40274, 57.39261 24.40269, 57.40335 24.40149, 57.41409 24.39875, 57.42491 24.39579, 57.43523 24.39261, 57.4449 24.389, 57.44937 24.38648, 57.45023 24.38872, 57.45924 24.38888, 57.46699 24.3893, 57.4747 24.3843, 57.48028 24.38638, 57.48338 24.38373, 57.48754 24.38552, 57.49384 24.38443, 57.49605 24.38522, 57.50479 24.38279, 57.51136 24.3827, 57.51873 24.38021, 57.52413 24.38132, 57.52697 24.38047, 57.53296 24.37559, 57.5406 24.36778, 57.54308 24.36832, 57.54658 24.36648, 57.55241 24.36974, 57.56119 24.37179, 57.56523 24.37038, 57.56936 24.37308, 57.57003 24.37049, 57.58068 24.36635, 57.58315 24.37021, 57.58478 24.37025, 57.59081 24.37287, 57.5977 24.37458, 57.60072 24.37391, 57.60513 24.37972, 57.60923 24.38372, 57.61133 24.38952, 57.61406 24.39046, 57.62087 24.38867, 57.63571 24.37883, 57.64593 24.37558, 57.6479 24.37413, 57.65429 24.37403, 57.65754 24.37275, 57.66407 24.3698, 57.67467 24.36845, 57.68151 24.36567, 57.68311 24.36401, 57.69204 24.36081, 57.70094 24.35678, 57.70706 24.35498, 57.71976 24.34814, 57.73209 24.34716, 57.738 24.34844, 57.74856 24.35017, 57.75376 24.3522, 57.75181 24.35781, 57.75639 24.3627, 57.75882 24.35369, 57.76616 24.35215, 57.77244 24.35308, 57.77333 24.35617, 57.78463 24.35514, 57.78854 24.3553, 57.79353 24.35235, 57.8011 24.35094, 57.80742 24.34889, 57.80796 24.2873, 57.33948 24.32508, 57.22862 24.38596))'), point(lat, lng))
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
        to: 'matiss@brokalys.com',
        cc: 'kristaps@brokalys.com',
        subject: 'Jauns PINGER sludinājums',
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