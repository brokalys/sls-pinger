function constructArn(context, topicName) {
  const functionArnCols = context.invokedFunctionArn.split(':');
  const region = functionArnCols[3];
  const accountId = functionArnCols[4];

  return `arn:aws:sns:${region}:${accountId}:${topicName}`;
}

module.exports = { constructArn };
