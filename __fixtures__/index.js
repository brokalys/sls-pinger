const pinger = require('./pinger');
const property = require('./property');

module.exports = {
  ...pinger,
  ...property,
};
