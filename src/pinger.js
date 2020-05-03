const serverlessMysql = require('serverless-mysql');
const moment = require('moment');
const numeral = require('numeral');
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ apiVersion: '2010-03-31' });

AWS.config.update({ region: process.env.AWS_REGION });

function nl2br(str, is_xhtml) {
  var breakTag =
    is_xhtml || typeof is_xhtml === 'undefined' ? '<br />' : '<br>';
  return (str + '').replace(
    /([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
    '$1' + breakTag + '$2',
  );
}

const connectionProperties = serverlessMysql({
  config: {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_PROPERTIES_DATABASE,
    timezone: 'Z',
    typeCast: true,
  },
});

function getUnsubscribeLink(pinger) {
  return `https://unsubscribe.brokalys.com/?key=${encodeURIComponent(
    pinger.unsubscribe_key,
  )}&id=${encodeURIComponent(pinger.id)}`;
}

exports.run = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const { MessageAttributes } = event.Records[0].Sns;
  const mainQuery = MessageAttributes.query.Value;
  const pinger = JSON.parse(MessageAttributes.pinger.Value);
  console.log('Pinger ID', pinger.id);

  const results = await connectionProperties.query(mainQuery, [
    pinger.last_check_at,
  ]);

  if (results.length >= 30) {
    throw new Error(
      'There might be an issue with the pinger. Too many emails would be sent.',
    );
  }

  await Promise.all(
    results
      .map((result) => {
        result.content = nl2br(
          (result.content || '').toString('utf8').replace(/(<([^>]+)>)/gi, ''),
        );

        if (result.images) {
          result.images = JSON.parse(result.images);
        }

        result.unsubscribe_url = getUnsubscribeLink(pinger);
        result.url = `https://view.brokalys.com/?link=${encodeURIComponent(
          result.url,
        )}`;
        result.price = numeral(result.price).format('0,0 €');
        result.property_id = result.id;

        return {
          to: pinger.email,
          pinger_id: pinger.id,
          template_id: 'email',
          template_variables: result,
        };
      })
      .map((data) =>
        sns
          .publish({
            Message: 'email',
            MessageAttributes: {
              to: {
                DataType: 'String',
                StringValue: data.to,
              },
              subject: {
                DataType: 'String',
                StringValue: 'Jauns PINGER sludinājums',
              },
              pinger_id: {
                DataType: 'Number',
                StringValue: String(data.pinger_id),
              },
              template_id: {
                DataType: 'String',
                StringValue: data.template_id,
              },
              template_variables: {
                DataType: 'String',
                StringValue: JSON.stringify(data.template_variables),
              },
            },
            MessageStructure: 'string',
            TargetArn: `arn:aws:sns:${process.env.AWS_REGION}:173751334418:email`,
          })
          .promise(),
      ),
  );

  callback(null, 'Success');
};
