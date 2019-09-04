'use strict';

require('dotenv').config();

const AWS   = require('aws-sdk');
const Mysql = require('mysql');
const Q     = require('q');
const sns   = new AWS.SNS({apiVersion: '2010-03-31'});

AWS.config.update({ region: process.env.AWS_REGION });

module.exports.run = (event, context, callback) => {

  const pingers = [];

  const connection = Mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USERNAME,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE,
    timezone : 'Z',
    typeCast : true,
  });

  const buildQuery = (ping) => {
    return `
      SELECT * 
      FROM properties 
      WHERE created_at > ? 
       ${ ping.categories ? `AND category IN ("${ JSON.parse(ping.categories).join('","') }")` : '' }
       ${ ping.types ? `AND type IN ("${ JSON.parse(ping.types).join('","') }")` : '' }
       ${ ping.types && JSON.parse(ping.types).indexOf('rent') >= 0 ? 'AND (rent_type IS NULL OR rent_type = "monthly")' : '' }
       ${ ping.price_min > 0 ? `AND price >= ${ping.price_min}` : '' }
       ${ ping.price_max > 0 ? `AND price <= ${ping.price_max}` : '' }
       ${ ping.rooms_min > 0 ? `AND rooms >= ${ping.rooms_min}` : '' }
       ${ ping.rooms_max > 0 ? `AND rooms <= ${ping.rooms_max}` : '' }
       ${ ping.area_m2_min > 0 ? `AND (area >= ${ping.area_m2_min} AND area_measurement = "m2" OR area_measurement != "m2")` : '' }
       ${ ping.area_m2_max > 0 ? `AND (area <= ${ping.area_m2_max} AND area_measurement = "m2" OR area_measurement != "m2")` : '' }
       ${ ping.additional ? `AND ${ping.additional}` : '' }
       ${ ping.location ? `AND ST_Contains(ST_GeomFromText('POLYGON((${ ping.location }))'), point(lat, lng))` : '' }
      ORDER BY created_at
    `;
  };

  Q.fcall(() => {
    const deferred = Q.defer();

    connection.connect();

    connection.query('SELECT * FROM pinger_emails WHERE unsubscribed_at IS NULL AND confirmed = 1', (error, results) => {
      connection.end();
      if (error) {
        deferred.reject(error);
        return;
      }

      if (results.length < 1) {
        deferred.reject(results);
        return;
      }

      results.forEach((result) => {
        try {
          const newPing = {
            id: result.id,
            query: buildQuery(result),
          };

          pingers.push(newPing);
        } catch (e) {
          console.error('Failed constructing pinger', e);
        }
      });

      deferred.resolve(pingers);
      console.log(pingers);
    });

    return deferred.promise;
  })

  // Invoke all
  .then((pingers) => pingers.map(pinger => {
    const deferred = Q.defer();

    sns.publish({
      Message: 'ping',
      MessageAttributes: {
        query: {
          DataType: 'String',
          StringValue: pinger.query,
        },
        id: {
          DataType: 'String',
          StringValue: '' + pinger.id,
        },
      },
      MessageStructure: 'string',
      TargetArn: 'arn:aws:sns:eu-west-1:173751334418:pinger'
    }, (error, data) => {
      if (error) {
        deferred.reject(error);
        return;
      }

      deferred.resolve();
    });

    return deferred.promise;
  }))

  // Success
  .then(matches => {
    callback(null, `Invoked ${matches.length} item-crawlers.`);
  })

  // Error
  .catch(reason => {
    callback(reason);
  });
};
