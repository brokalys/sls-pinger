export function createPropertyFixture(customData = {}) {
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

export function createPropertyQueueItemFixture(customData = {}) {
  return {
    id: 1,
    pinger_id: 1,
    data: JSON.stringify(createPropertyFixture(customData.data)),
    locked: 0,
    ...customData,
  };
}

export function createPropertyStatFixture(customData = {}) {
  return {
    id: 1,
    pinger_id: 1,
    data: [120, 200],
    created_at: '2021-01-01T10:20:22Z',
    ...customData,
  };
}
