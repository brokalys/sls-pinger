'use strict';

require('dotenv').config();

const exec = require('child_process').exec;
const Q       = require('q');
const Mysql   = require('mysql');

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

module.exports.run = (event, context, callback) => {
  if (getRandomArbitrary(1, 7) > 6) {
    callback(null, 'Skip');
    return;
  }

  const currentDate = (new Date()).toISOString().replace('T', ' ').replace('Z', '');

  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
    'Mozilla/5.0 (Windows NT 5.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
  ];

  let agent = agents[Math.floor(Math.random() * agents.length)];
  let headers = `-H 'Pragma: no-cache' -H 'Origin: http://www.skrapeunlaime.lv' -H 'User-Agent: ${agent}' -H 'Accept: application/json; q=1.0, text/*; q=0.8, */*; q=0.1' -H 'Cache-Control: no-cache' -H 'X-Requested-With: XMLHttpRequest' -H 'Connection: keep-alive' -H 'Referer: http://www.skrapeunlaime.lv/'`;

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
    connection.query('SELECT phone FROM phones WHERE last_action < ? ORDER BY RAND() LIMIT 1', [currentDate.substr(0, 10)], (err, result) => {
      if (err) return deferred.reject(err);
      if (result.length === 0) return deferred.reject('nothing-left');
      deferred.resolve(result[0]);
    });

    return deferred.promise;
  })

  .then(({ phone }) => {
    const deferred = Q.defer();

    connection.query('UPDATE phones SET last_action = ? WHERE phone = ?', [currentDate, phone], (err, result) => {
      if (err) return deferred.reject(err);
      deferred.resolve(phone);
    });

    return deferred.promise;
  })

  .then((phone) => {
    const deferred = Q.defer();

    const s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const sessionid = Array(32).join().split(',').map(function() { return s.charAt(Math.floor(Math.random() * s.length)); }).join('');

    const data = {
      phone,
      sessionid,
    };

    const cmd = `curl 'http://www.skrapeunlaime.lv/api/user/register' ${headers} -H 'Content-Type: application/x-www-form-urlencoded' --data 'email=&number=${phone}' -H 'Cookie: PHPSESSID=${sessionid}'`;
    exec(cmd, function (error, response) {
      if (error !== null) return deferred.reject(error);
      connection.query('INSERT INTO log SET phone = ?, response = ?, type = 1', [phone, response], (err, result) => {
        if (err) return deferred.reject(err);
        deferred.resolve(data);
      });
    });

    return deferred.promise;
  })

  .then((data) => {
    const deferred = Q.defer();

    const cmd = `curl 'http://www.skrapeunlaime.lv/skrape/?x=' ${headers} -H 'Cookie: PHPSESSID=${data.sessionid}'`;
    exec(cmd, function (error, response) {
      if (error !== null) return deferred.reject(error);

      console.log(response);
      data.url = (response.match(/data-results-url=\\"(.*?)\\"/) || ['', 'http://www.skrapeunlaime.lv/uzvara/'])[1].replace(/\\\//g, '/');

      connection.query('INSERT INTO log SET phone = ?, response = ?, type = 2', [data.phone, response], (err, result) => {
        if (err) return deferred.reject(err);
        deferred.resolve(data);
      });
    });

    return deferred.promise;
  })

  .then((data) => {
    const deferred = Q.defer();

    const cmd = `curl '${data.url}?x=' ${headers} -H 'Cookie: PHPSESSID=${data.sessionid}'`;
    exec(cmd, function (error, response) {
      if (error !== null) return deferred.reject(error);
      connection.query('INSERT INTO log SET phone = ?, response = ?, type = 3, url = ?', [data.phone, response, data.url], (err, result) => {
        if (err) return deferred.reject(err);
        deferred.resolve(data);
      });
    });

    return deferred.promise;
  })

  // SUCCESS
  .then(() => {
    callback(null, 'Success');
    connection.end();
  })

  // Catch errors
  .catch((error) => {
    if (error !== 'nothing-left') {
      console.error('error', error);
      callback(error);
    }
    connection.end();
  });

};