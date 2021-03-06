function createPropertyFixture(customData = {}) {
  return {
    category: 'apartment',
    type: 'sell',
    lat: 56.9965,
    lng: 24.245176,
    price: 100000,
    url: 'https://brokalys.com/',
    area: 45,
    rooms: 2,
    calc_price_per_sqm: 122.32,
    ...customData,
  };
}

function createPropertyQueueItemFixture(customData = {}) {
  return {
    id: 1,
    pinger_id: 1,
    locked: 0,
    ...customData,
    data: JSON.stringify(createPropertyFixture(customData.data)),
  };
}

function createPropertyStatFixture(customData = {}) {
  return {
    id: 1,
    pinger_id: 1,
    data: ['120.00', '200.20'],
    created_at: '2021-01-01T10:20:22Z',
    ...customData,
  };
}

module.exports = {
  createPropertyFixture,
  createPropertyQueueItemFixture,
  createPropertyStatFixture,
};
