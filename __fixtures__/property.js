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
