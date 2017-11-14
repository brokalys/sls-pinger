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

const fileName = 'previous-date-5.txt';

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
    WHERE created_at > ?
      AND type = "sell"
      AND (
        ST_Contains(ST_GeomFromText('POLYGON((56.69093 23.79364, 56.68548 23.79178, 56.68226 23.80394, 56.68972 23.81005, 56.69269 23.80091, 56.69093 23.79364))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.65207 23.81845, 56.64226 23.82282, 56.63929 23.82377, 56.64103 23.83355, 56.64918 23.83972, 56.65304 23.83922, 56.65415 23.82174, 56.65394 23.81728, 56.65217 23.81604, 56.64703 23.81922, 56.64665 23.82016, 56.65207 23.81845))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.60127 23.69373, 56.59503 23.69236, 56.58331 23.67794, 56.58478 23.67128, 56.59485 23.67451, 56.6035 23.68168, 56.60562 23.69133, 56.60127 23.69373))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.6483 23.81166, 56.63688 23.80274, 56.64047 23.78523, 56.64862 23.78284, 56.65395 23.78865, 56.6483 23.81166))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.67019 23.8266, 56.66415 23.82351, 56.66601 23.80963, 56.67094 23.80669, 56.67584 23.81492, 56.67496 23.82784, 56.67019 23.8266))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.69376 23.83862, 56.68905 23.83381, 56.68 23.85029, 56.68132 23.86093, 56.68691 23.86331, 56.69301 23.85132, 56.69376 23.83862))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.70055 23.7315, 56.69565 23.73356, 56.69691 23.74341, 56.70043 23.74052, 56.70055 23.7315))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.63405 23.80197, 56.62862 23.7903, 56.62626 23.78643, 56.63018 23.77794, 56.63636 23.78695, 56.63695 23.79678, 56.63405 23.80197))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.63678 23.77579, 56.63254 23.77201, 56.63235 23.76677, 56.63486 23.75889, 56.63858 23.76549, 56.63981 23.77115, 56.63678 23.77579))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.69904 23.66867, 56.68367 23.69495, 56.67604 23.70644, 56.65377 23.71811, 56.6415 23.74077, 56.63924 23.75553, 56.64509 23.77922, 56.63301 23.80394, 56.63678 23.8139, 56.63133 23.83921, 56.63574 23.85172, 56.65157 23.77695, 56.64929 23.74887, 56.68615 23.7134, 56.69904 23.66867))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.67009 23.6618, 56.66726 23.66198, 56.66764 23.67262, 56.67 23.67176, 56.67009 23.6618))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.64589 23.68369, 56.64438 23.68403, 56.64283 23.68481, 56.64273 23.68858, 56.64473 23.68791, 56.64695 23.68663, 56.64589 23.68369))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.66321 23.70781, 56.66085 23.70875, 56.66156 23.71296, 56.66387 23.71159, 56.66335 23.70613, 56.66047 23.70772, 56.66047 23.70841, 56.66321 23.70781))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.65873 23.7551, 56.65736 23.75733, 56.65637 23.76102, 56.65818 23.76441, 56.66025 23.75556, 56.65873 23.7551))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.62848 23.69133, 56.62796 23.68738, 56.62909 23.68549, 56.63164 23.68403, 56.63173 23.68867, 56.63494 23.68858, 56.63576 23.68662, 56.6366 23.68752, 56.63815 23.68498, 56.64229 23.68117, 56.64178 23.67579, 56.644 23.67828, 56.64452 23.66837, 56.62848 23.69133))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.64254 23.68335, 56.64509 23.66065, 56.64684 23.65554, 56.64914 23.65271, 56.64849 23.64687, 56.649 23.644, 56.64915 23.64095, 56.65068 23.63858, 56.65318 23.63651, 56.66154 23.63083, 56.66549 23.62681, 56.66863 23.62919, 56.6725 23.62661, 56.67401 23.62335, 56.67509 23.62618, 56.66811 23.63657, 56.66205 23.63622, 56.64721 23.66178, 56.64528 23.68167, 56.64254 23.68335))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.63778 23.74703, 56.6356 23.74755, 56.63669 23.75072, 56.63822 23.75013, 56.63863 23.74738, 56.63778 23.74703))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.62229 23.77733, 56.62215 23.77411, 56.6246 23.77338, 56.626 23.77381, 56.62682 23.77587, 56.62785 23.77647, 56.62903 23.77698, 56.63328 23.77973, 56.63529 23.77813, 56.63728 23.77599, 56.6408 23.76506, 56.64202 23.76961, 56.63853 23.77974, 56.63669 23.78368, 56.6263 23.78016, 56.62229 23.77733))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.64032 23.74446, 56.63343 23.73347, 56.62994 23.73021, 56.62654 23.73133, 56.62357 23.72764, 56.61712 23.72561, 56.61724 23.72193, 56.62566 23.72401, 56.63247 23.72814, 56.63484 23.73115, 56.6407 23.74077, 56.64032 23.74446))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.68745 23.71141, 56.6891 23.71785, 56.68994 23.72257, 56.69296 23.72703, 56.69993 23.746, 56.70337 23.75905, 56.70441 23.7769, 56.70361 23.78729, 56.69776 23.75642, 56.69564 23.75181, 56.68692 23.72084, 56.68745 23.71141))'), point(lat, lng))
      OR ST_Contains(ST_GeomFromText('POLYGON((56.69499 23.79905, 56.69631 23.79484, 56.69433 23.79132, 56.69178 23.79398, 56.69298 23.80354, 56.69499 23.79905))'), point(lat, lng))
      )
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
        to: 'janis@balticreal.lv',
        bcc: 'matiss@brokalys.com, kristaps@brokalys.com',
        subject: 'Jelgava: Jauns PINGER sludinājums',
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