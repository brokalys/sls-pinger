import AWS from 'aws-sdk';

export default new AWS.SES({ region: process.env.AWS_REGION });
