export function createPropertyFixture(customData = {}) {
  return {
    category: 'apartment',
    type: 'sell',
    lat: 56.9965,
    lng: 24.245176,
    price: 100000,
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
