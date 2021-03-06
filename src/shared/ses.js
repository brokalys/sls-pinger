const AWS = require('aws-sdk');

module.exports = new AWS.SES({ region: process.env.AWS_REGION });
