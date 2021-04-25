const db = require('./shared/db');
const generatePingerCharts = require('./shared/generate-pinger-charts');
const sns = require('./shared/sns');
const createUnsubscribeLink = require('./shared/unsubscribe-link');
const utils = require('./shared/utils');

const FREE_LIMIT = 100;
const PREMIUM_LIMIT = 500;

exports.run = async (event, context) => {
  const { frequency = 'daily' } = event;
  context.callbackWaitsForEmptyEventLoop = false;

  // Retrieve all the PINGERS with frequency {variable} from the DB
  const pingers = await db.getPingersByFrequency(frequency);
  const pingerIds = pingers.map(({ id }) => id);

  if (pingerIds.length <= 0) {
    return;
  }

  // Retrieve the queue for all the matched pingers
  const propertyQueue = await db.getPropertyQueueForPingers(pingerIds);
  const propertyQueueIds = propertyQueue.map(({ id }) => id);

  // Create a map for properties in each PINGER
  // Sample: { 123: [{ ... }, { ... }] }
  const properties = propertyQueue.reduce(
    (carry, data) => ({
      ...carry,
      [data.pinger_id]: [
        ...(carry[data.pinger_id] || []),
        JSON.parse(data.data),
      ],
    }),
    {},
  );

  // Filter PINGERS that have properties
  const pingersWithProperties = pingers.filter((data) => !!properties[data.id]);

  // What if no matches?
  if (pingersWithProperties.length === 0) {
    return;
  }

  // Mark property queue entries as "locked" so we don't
  // send duplicate emails in case of an error
  await db.lockPropertyQueueItems(propertyQueueIds);

  // Insert a stats entry for each pinger
  await Promise.all(
    pingersWithProperties.map((pinger) => {
      const stats = properties[pinger.id]
        .filter(({ calc_price_per_sqm }) => calc_price_per_sqm > 0)
        .map(({ calc_price_per_sqm }) => calc_price_per_sqm.toFixed(2));

      if (stats.length === 0) {
        return;
      }

      return db.createPingerStatsEntry(pinger.id, stats);
    }),
  );

  // Generate summary images for each pinger
  const urls = await generatePingerCharts(pingers, frequency);

  // Publish SNS notification to send email for each PINGER that has properties
  await Promise.all(
    pingersWithProperties.map((pinger) =>
      sendEmail(context, pinger, properties[pinger.id], urls[pinger.id]),
    ),
  );

  // Delete the property queue from DB
  await db.deletePropertyQueueItems(propertyQueueIds);
};

function sendEmail(context, pinger, properties, heroImgUrl) {
  const propertyLimit = pinger.is_premium ? PREMIUM_LIMIT : FREE_LIMIT;

  return sns
    .publish({
      Message: 'email',
      MessageAttributes: {
        to: {
          DataType: 'String',
          StringValue: pinger.email,
        },
        subject: {
          DataType: 'String',
          StringValue: 'Jauni PINGER sludinājumi',
        },
        pinger_id: {
          DataType: 'Number',
          StringValue: String(pinger.id),
        },
        template_id: {
          DataType: 'String',
          StringValue: 'summary',
        },
        template_variables: {
          DataType: 'String',
          StringValue: JSON.stringify({
            is_premium: pinger.is_premium,
            limit_reached: properties.length > propertyLimit,
            hero_img_url: heroImgUrl,
            unsubscribe_url: createUnsubscribeLink(pinger),
            properties: properties
              .splice(0, propertyLimit)
              .map((data) => [
                data.url,
                data.price,
                data.rooms,
                data.area,
                data.calc_price_per_sqm,
                data.category !== 'land'
                  ? `https://map.brokalys.com/#/${data.lat},${data.lng},18/locate-building`
                  : undefined,
              ]),
          }),
        },
      },
      MessageStructure: 'string',
      TargetArn: utils.constructArn(context, process.env.EMAIL_SNS_TOPIC_NAME),
    })
    .promise();
}
