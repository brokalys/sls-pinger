const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const client = new SNSClient({ region: process.env.AWS_REGION });

module.exports = {
  publish: function (message) {
    return client.send(new PublishCommand(message));
  },
};
