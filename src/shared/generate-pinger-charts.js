import moment from 'moment';
import * as db from './db';
import generateChart from './generate-chart';

export default async function generatePingerCharts(pingerIds) {
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
        uniqueDates: [],
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
    idsWithCharts.map((id) =>
      generateChart(
        `${id}/${moment().format('YYYY-MM-DD')}.svg`,
        state.entities[id].values,
        moment(state.entities[id].minDate).add(11, 'days').valueOf(),
      ),
    ),
  );

  return urls.reduce(
    (carry, url, index) => ({ ...carry, [idsWithCharts[index]]: url }),
    {},
  );
}
