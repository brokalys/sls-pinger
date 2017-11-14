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

const fileName = 'previous-date-zanis.txt';

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
      AND category = "apartment"
      AND type = "rent"
      AND (rent_type IS NULL OR rent_type = "monthly")
      AND price >= 200 AND price <= 300
      AND floor >= 2 AND floor <= 3
      AND ST_Contains(ST_GeomFromText('POLYGON((56.95714 24.11499, 56.95658 24.11619, 56.9563 24.11671, 56.95593 24.11722, 56.95555 24.11808, 56.95537 24.11842, 56.95527 24.11877, 56.95509 24.11911, 56.95499 24.11945, 56.9548 24.1198, 56.95471 24.12014, 56.95452 24.12014, 56.95443 24.12048, 56.95434 24.12083, 56.95424 24.12117, 56.95424 24.12151, 56.95415 24.12186, 56.95406 24.1222, 56.95396 24.12254, 56.95387 24.12289, 56.95368 24.12289, 56.95359 24.12323, 56.9534 24.1234, 56.95321 24.12374, 56.95303 24.12409, 56.95284 24.12443, 56.95265 24.1246, 56.95256 24.12495, 56.95237 24.12512, 56.95218 24.12546, 56.95209 24.1258, 56.9519 24.12598, 56.95181 24.12632, 56.95181 24.12666, 56.9519 24.12701, 56.9519 24.12735, 56.95172 24.12786, 56.95153 24.12821, 56.95134 24.12855, 56.95115 24.12889, 56.95097 24.12924, 56.95078 24.12958, 56.95059 24.12992, 56.9504 24.1301, 56.95012 24.13044, 56.94994 24.13061, 56.94975 24.13095, 56.94956 24.1313, 56.94937 24.13181, 56.94928 24.13216, 56.94909 24.13267, 56.94891 24.13301, 56.94863 24.13353, 56.94844 24.13404, 56.94825 24.13456, 56.94797 24.13507, 56.94797 24.13542, 56.94788 24.13576, 56.94769 24.13645, 56.9476 24.13696, 56.9475 24.13748, 56.94741 24.13799, 56.94722 24.13868, 56.94713 24.13954, 56.94713 24.14005, 56.94713 24.14057, 56.94703 24.14091, 56.94703 24.14143, 56.94703 24.14194, 56.94703 24.14228, 56.94703 24.14263, 56.94703 24.14297, 56.94713 24.14331, 56.94713 24.14383, 56.94713 24.14434, 56.94722 24.14503, 56.94731 24.14537, 56.94731 24.14589, 56.94741 24.14623, 56.94741 24.14675, 56.9475 24.14709, 56.9475 24.14743, 56.9475 24.14778, 56.9476 24.14812, 56.94778 24.14846, 56.94788 24.14881, 56.94825 24.14915, 56.94844 24.14949, 56.94872 24.14984, 56.94891 24.15018, 56.949 24.15052, 56.949 24.15087, 56.94928 24.15087, 56.94984 24.15121, 56.95022 24.15138, 56.95059 24.15138, 56.95087 24.15155, 56.95115 24.15155, 56.95153 24.15155, 56.95181 24.15155, 56.95209 24.15155, 56.95256 24.15138, 56.95284 24.15138, 56.95312 24.15121, 56.95349 24.15104, 56.95443 24.15087, 56.95499 24.15087, 56.95537 24.1507, 56.95583 24.1507, 56.95621 24.1507, 56.95649 24.1507, 56.95677 24.1507, 56.95714 24.1507, 56.95743 24.1507, 56.9578 24.1507, 56.95817 24.1507, 56.95864 24.1507, 56.95902 24.1507, 56.9593 24.15087, 56.95958 24.15104, 56.95986 24.15121, 56.96033 24.15121, 56.96061 24.15121, 56.96089 24.15138, 56.96117 24.15155, 56.96145 24.15155, 56.96173 24.15155, 56.96201 24.15155, 56.96229 24.15138, 56.96257 24.15138, 56.96295 24.15087, 56.96323 24.15035, 56.96342 24.14984, 56.9636 24.14932, 56.96379 24.14881, 56.96398 24.14829, 56.96416 24.14778, 56.96435 24.14692, 56.96435 24.14589, 56.96444 24.14503, 56.96454 24.14434, 56.96473 24.14383, 56.96473 24.14297, 56.96491 24.14246, 56.9651 24.14194, 56.96538 24.14143, 56.96566 24.14108, 56.96575 24.14057, 56.96585 24.13954, 56.96604 24.13885, 56.96613 24.13834, 56.96641 24.13765, 56.9666 24.13713, 56.96688 24.13662, 56.96706 24.1361, 56.96725 24.13559, 56.96763 24.13507, 56.96781 24.13456, 56.96809 24.13422, 56.96837 24.13422, 56.96866 24.13422, 56.96894 24.13404, 56.96922 24.13387, 56.9695 24.13353, 56.96978 24.13319, 56.97006 24.13284, 56.97034 24.1325, 56.97071 24.13233, 56.97099 24.13216, 56.97128 24.13181, 56.97156 24.13147, 56.97184 24.13113, 56.97212 24.13078, 56.97249 24.13044, 56.97268 24.12992, 56.97277 24.12941, 56.97287 24.12872, 56.97287 24.12821, 56.97296 24.12752, 56.97296 24.12701, 56.97296 24.12632, 56.97296 24.12563, 56.97296 24.12512, 56.97287 24.1246, 56.97249 24.12392, 56.9723 24.1234, 56.97184 24.12271, 56.97165 24.1222, 56.97118 24.12151, 56.97034 24.12066, 56.96968 24.11997, 56.96856 24.11911, 56.96819 24.11842, 56.96791 24.11791, 56.96735 24.11722, 56.96697 24.11671, 56.9666 24.11619, 56.96641 24.11568, 56.96566 24.11516, 56.96463 24.11465, 56.96435 24.1143, 56.96407 24.11396, 56.96379 24.11362, 56.96351 24.11327, 56.96323 24.11293, 56.96276 24.11259, 56.96239 24.11224, 56.9621 24.1119, 56.96182 24.11173, 56.96154 24.11156, 56.96126 24.11139, 56.96098 24.11121, 56.9607 24.11104, 56.96033 24.11104, 56.96005 24.11104, 56.95939 24.11156, 56.95799 24.11327, 56.95733 24.11448, 56.95724 24.11551, 56.95724 24.11585, 56.95724 24.11619, 56.95714 24.11654, 56.95714 24.11688, 56.95714 24.11722, 56.95714 24.11499))'), point(lat, lng))
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
  const lastDate = results.length > 0 ? (new Date(results[results.length - 1].created_at)).toISOString() : currentDate;

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
        to: 'zanete.sterna@gmail.com',
        bcc: 'matiss@brokalys.com',
        subject: 'Dzīvoklis: Jauns PINGER sludinājums',
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