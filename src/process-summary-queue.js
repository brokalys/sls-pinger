import * as db from './shared/db';
import sns from './shared/sns';

export async function run(event, context = {}) {
  const { type = 'daily' } = event;
  context.callbackWaitsForEmptyEventLoop = false;

  // Retrieve all the PINGERS with type {variable} from the DB
  const pingers = await db.getPingersByType(type);
  const pingerIds = pingers.map(({ id }) => id);

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

  // Mark property queue entries as "locked" so we don't
  // send duplicate emails in case of an error
  db.lockPropertyQueueItems(propertyQueueIds);

  // Publish SNS notification to send email for each PINGER that has properties
  await Promise.all(
    pingersWithProperties.map((pinger) =>
      sns
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
                properties: properties[pinger.id],
              }),
            },
          },
          MessageStructure: 'string',
          TargetArn: `arn:aws:sns:${process.env.AWS_REGION}:173751334418:email-${process.env.STAGE}`,
        })
        .promise(),
    ),
  );

  // Delete the property queue from DB
  db.deletePropertyQueueItems(propertyQueueIds);
}
