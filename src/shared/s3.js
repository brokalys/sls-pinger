const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client();

module.exports = {
  putObject: function (message) {
    return client.send(new PutObjectCommand(message));
  },
};
