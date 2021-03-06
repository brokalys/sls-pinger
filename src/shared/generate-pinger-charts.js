const moment = require('moment');
const db = require('./db');
const generateChart = require('./generate-chart');

module.exports = async function generatePingerCharts(pingers) {
  const pingerIds = pingers.map(({ id }) => id);
  const pingerHashMap = pingers.reduce(
    (carry, pinger) => ({ ...carry, [pinger.id]: pinger }),
    {},
  );
  const stats = await db.getPropertyStats(pingerIds);

  const state = {
    ids: [],
    entities: {},
  };

  stats.forEach((row) => {
    const createdAt = moment(row.created_at).format('YYYY-MM-DD');

    if (!state.entities[row.pinger_id]) {
      state.entities[row.pinger_id] = {
        values: [],
        minDate: null,
        maxDate: null,
        uniqueDates: [],
        frequency: pingerHashMap[row.pinger_id].frequency,
      };
      state.ids.push(row.pinger_id);
    }

    if (!state.entities[row.pinger_id].uniqueDates.includes(createdAt)) {
      state.entities[row.pinger_id].uniqueDates.push(createdAt);
    }

    if (
      !state.entities[row.pinger_id].minDate ||
      state.entities[row.pinger_id].minDate > row.created_at
    ) {
      state.entities[row.pinger_id].minDate = row.created_at;
    }

    if (
      !state.entities[row.pinger_id].maxDate ||
      state.entities[row.pinger_id].maxDate < row.created_at
    ) {
      state.entities[row.pinger_id].maxDate = row.created_at;
    }

    row.data.forEach((price) => {
      state.entities[row.pinger_id].values.push({
        x: createdAt,
        y: price,
      });
    });
  });

  const idsWithCharts = state.ids.filter(
    (id) => state.entities[id].uniqueDates.length >= 2,
  );

  const urls = await Promise.all(
    idsWithCharts.map((id) => {
      const idHash = pingerHashMap[id].id_hash;
      const maxDate = moment(state.entities[id].maxDate);
      const calculatedFutureDate = moment(state.entities[id].minDate).add(
        11,
        mapPingerFrequencyToMomentJs(state.entities[id].frequency),
      );

      return generateChart(
        `${idHash}.svg`,
        state.entities[id].values,
        (maxDate.isAfter(calculatedFutureDate)
          ? maxDate
          : calculatedFutureDate
        ).valueOf(),
      );
    }),
  );

  return urls.reduce(
    (carry, url, index) => ({ ...carry, [idsWithCharts[index]]: url }),
    {},
  );
};

function mapPingerFrequencyToMomentJs(frequency) {
  switch (frequency) {
    case 'daily':
      return 'days';
    case 'weekly':
      return 'weeks';
    case 'monthly':
      return 'months';
  }

  return 'days';
}
