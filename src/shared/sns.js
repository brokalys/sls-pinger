import AWS from 'aws-sdk';

AWS.config.update({ region: process.env.AWS_REGION });

export default new AWS.SNS({ apiVersion: '2010-03-31' });
