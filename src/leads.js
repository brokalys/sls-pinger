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

const fileName = 'previous-date-leads.txt';

Bugsnag.register('76d5f4207c779acf8eea5ae606a25ca9');

const connection = Mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USERNAME,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_DATABASE,
  timezone : 'Z',
  typeCast : true,
});

connection.connect();

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

  const query = `
    SELECT contact_email, type, created_at
    FROM properties 
    WHERE created_at > ? 
    AND (contact_email LIKE "%@gmail.com" OR contact_email LIKE "%@inbox.lv")
    AND contact_email NOT LIKE "%**%"
    AND type IN ('sell', 'rent', 'buy', 'want_to_rent')
    GROUP BY contact_email, type, created_at
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

.then((results) => {
  return Q.all(results.map((row) => {
    const deferred = Q.defer();

    connection.query('SELECT COUNT(*) as count FROM properties WHERE contact_email = ?', [row.contact_email], (error, emailCount) => {
      if (error) {
        deferred.reject(error);
        return;
      }

      if (emailCount[0].count === 1) {
        deferred.resolve(row);
        return;
      }

      deferred.resolve(false);
    });

    return deferred.promise;
  }));
})

.then((results) => {
  return Q.all(results.filter((result) => result).map((row) => {
    const deferred = Q.defer();

    connection.query('SELECT COUNT(*) as count FROM lead_emails WHERE email = ?', [row.contact_email], (error, emailCount) => {
      if (error) {
        deferred.reject(error);
        return;
      }

      if (emailCount[0].count === 0) {
        deferred.resolve(row);
        return;
      }

      deferred.resolve(false);
    });

    return deferred.promise;
  }));
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

  return Q.all(results.filter((result) => result).map((result) => {
    const deferred = Q.defer();

    fs.readFile('email.html', 'utf8', (err, content) => {
      if (err) {
        deferred.reject(err);
        return;
      }

const sell = `
Sveiki! Šeit Jums raksta Kristaps no Brokalys.com 
Rakstu sakarā ar Jūsu tikko ievietoto īpašuma pārdošanas sludinājumu.

Skatos, ka mūsu sadarbības brokeris varētu palīdzēt atrast klientu, sagatavot līgumu un pārlecināties, ka darījums norit korekti. Sakiet, vai Jūs interesē brokeru piedāvājumi un vēlētos, lai ar Jums sazinās?

Ar cieņu, Kristaps
Brokalys.com aģentu menedžeris`;

const buy = `
Sveiki! Šeit Jums raksta Kristaps no Brokalys.com 
Rakstu sakarā ar Jūsu tikko ievietoto nekustamā īpašuma pirkšanas sludinājumu.

Skatos, ka mūsu sadarbības brokerim portfelī ir īpašumi, kas atbilst Jūsu meklētajam. Sakiet, vai Jūs interesē brokeru piedāvājumi un vēlētos, lai ar Jums sazinās?

Ar cieņu, Kristaps
Brokalys.com aģentu menedžeris`;

const rent = `
Sveiki! Šeit Jums raksta Kristaps no Brokalys.com 
Rakstu sakarā ar Jūsu tikko ievietoto īres sludinājumu.

Skatos, ka mūsu sadarbības brokeris varētu palīdzēt atrast klientu, sagatavot līgumu un pārlecināties, ka darījums norit korekti. Sakiet, vai Jūs interesē brokeru piedāvājumi un vēlētos, lai ar Jums sazinās?

Ar cieņu, Kristaps
Brokalys.com aģentu menedžeris`;

const want_to_rent = `
Sveiki! Šeit Jums raksta Kristaps no Brokalys.com 
Rakstu sakarā ar Jūsu tikko ievietoto īres sludinājumu.

Mūsu sadarbības īres brokerim portfelī ir īpašumi, kas varētu atbilst Jūsu vajadzībām. Sakiet, vai Jūs interesē brokeru piedāvājumi un vēlētos, lai ar Jums sazinās?

Ar cieņu, Kristaps
Brokalys.com aģentu menedžeris`;

      let template = '';

      if (result.type === 'sell') {
        template = sell;
      } else if (result.type === 'buy') {
        template = buy;
      } else if (result.type === 'rent') {
        template = rent;
      } else if (result.type === 'want_to_rent') {
        template = want_to_rent;
      }

      if (template === '') {
        throw new Error('Empty template');
      }

      var data = {
        from: 'Kristaps <kristaps@brokalys.com>',
        to: result.contact_email,
        subject: 'Par Jūsu ievietoto sludinājumu',
        text: template,
      };

      mailgun.messages().send(data, (error, body) => {
        if (error) {
          deferred.reject(error);
          return;
        }

        console.log(body);
        deferred.resolve(result);
      });
    });

    return deferred.promise;
  }));
})

// SAVE
.then((results) => {
  return Q.all(results.map((row) => {
    const deferred = Q.defer();

    connection.query('INSERT INTO lead_emails SET email = ?', [row.contact_email], (error, emailCount) => {
      if (error) {
        deferred.reject(error);
        return;
      }

      deferred.resolve(row);
    });

    return deferred.promise;
  }));
})

.then(() => {
  console.log('DONE. No errors.');
  connection.destroy();
})

// Catch errors
.catch((error) => {
  console.error('error', error);
  connection.destroy();
});