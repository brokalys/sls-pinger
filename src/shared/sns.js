const AWS = require('aws-sdk');

AWS.config.update({ region: process.env.AWS_REGION });

module.exports = new AWS.SNS({ apiVersion: '2010-03-31' });
