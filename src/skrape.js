'use strict';

require('dotenv').config();

const Q       = require('q');
const Mysql   = require('mysql');
const Curl    = require('node-libcurl').Curl;

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

module.exports.run = (event, context, callback) => {
  if (getRandomArbitrary(1, 4) > 3) {
    callback(null, 'Skip');
    return;
  }

  const connection = Mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_SKRAPE_USERNAME,
    password : process.env.DB_SKRAPE_PASSWORD,
    database : process.env.DB_SKRAPE_DATABASE,
    timezone : 'Z',
    typeCast : true,
  });

  Q.fcall(() => {
    const deferred = Q.defer();

    connection.connect();
    connection.query('SELECT phone FROM phones ORDER BY RAND() LIMIT 1', (err, result) => {
      if (err) return deferred.reject(err);
      deferred.resolve(result[0]);
    });

    return deferred.promise;
  })

  .then(({ phone }) => {
    var curl = new Curl();
    curl.setOpt('URL', 'http://www.skrapeunlaime.lv/api/user/register');
    curl.setOpt(Curl.option.POSTFIELDS, { 'email': '', phone });
    curl.setOpt('COOKIE', 'PHPSESSID=6791be56e3b9c433d7c82868xsdsd11d');

    curl.on('end', (statusCode, body) => {
      deferred.resolve({ body, statusCode });
    });

    curl.on('error', () => deferred.reject('CURL failed'));
    curl.perform();
  })

  // SUCCESS
  .then(() => {
    callback(null, 'Success');
    connection.end();
  })

  // Catch errors
  .catch((error) => {
    console.error('error', error);
    callback(error);
    connection.end();
  });

};