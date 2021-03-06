function createPingerFixture(customData = {}) {
  return {
    id: 1,
    id_hash: 'c8bf6e7b-7eba-11eb-b2a8-663c33f40218',
    categories: ['apartment'],
    types: ['sell'],
    price_min: 100000,
    price_max: 200000,
    price_type: 'total',
    rooms_min: null,
    rooms_max: null,
    area_m2_min: null,
    area_m2_max: null,
    floor_min: null,
    floor_max: null,
    location:
      '56.992294 24.136619, 56.976394 23.995790, 56.924904 24.005336, 56.889288 24.108467, 56.932211 24.291935, 56.996502 24.245176, 56.992294 24.136619, 56.992294 24.136619',
    frequency: 'immediate',
    is_premium: true,
    ...customData,
  };
}

module.exports = { createPingerFixture };
