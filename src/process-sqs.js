exports.run = async (event, context, callback) => {
  console.log('Processing message..', event);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};
