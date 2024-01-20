const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const client = new SESClient({ region: process.env.AWS_REGION });

module.exports = {
  sendEmail: function (message) {
    return client.send(new SendEmailCommand(message));
  },
};
