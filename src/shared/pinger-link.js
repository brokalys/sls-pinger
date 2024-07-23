function createUnsubscribeLink(pinger) {
  return `https://unsubscribe.brokalys.com/?key=${encodeURIComponent(
    pinger.unsubscribe_key,
  )}&id=${encodeURIComponent(pinger.id_hash)}`;
}

function createAllPingersLink(pinger) {
  const id = encodeURIComponent(pinger.id_hash);
  const unsubscribeKey = encodeURIComponent(pinger.unsubscribe_key);

  return `https://pinger.brokalys.com/#/pingers/${id},${unsubscribeKey}`;
}

module.exports = {
  unsubscribeLink: createUnsubscribeLink,
  allPingersLink: createAllPingersLink,
};
