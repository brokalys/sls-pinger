import * as db from './shared/db';
import generatePingerCharts from './shared/generate-pinger-charts';
import sns from './shared/sns';
import createUnsubscribeLink from './shared/unsubscribe-link';

export async function run(event, context = {}) {
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
    pingersWithProperties.map((pinger) =>
      db.createPingerStatsEntry(
        pinger.id,
        properties[pinger.id].map(
          ({ calc_price_per_sqm }) => calc_price_per_sqm,
        ),
      ),
    ),
  );

  // Generate summary images for each pinger
  const urls = await generatePingerCharts(pingerIds);

  // Publish SNS notification to send email for each PINGER that has properties
  await Promise.all(
    pingersWithProperties.map((pinger) =>
      sendEmail(pinger, properties[pinger.id], urls[pinger.id]),
    ),
  );

  // Delete the property queue from DB
  await db.deletePropertyQueueItems(propertyQueueIds);
}

function sendEmail(pinger, properties, heroImgUrl) {
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
            hero_img_url: heroImgUrl,
            unsubscribe_url: createUnsubscribeLink(pinger),
            properties: properties.map((data) => [
              data.url,
              data.price,
              data.rooms,
              data.area,
            ]),
          }),
        },
      },
      MessageStructure: 'string',
      TargetArn: `arn:aws:sns:${process.env.AWS_REGION}:173751334418:email-${process.env.STAGE}`,
    })
    .promise();
}
