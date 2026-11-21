const RADIUS_KM = 30;

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function hav(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const r = x => x * Math.PI / 180;
  const x = Math.sin(r(lat2 - lat1) / 2) ** 2
    + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function includesTerm(hay, needle) {
  const n = norm(needle);
  const h = norm(hay);
  if (!n || !h) return false;
  let i = h.indexOf(n);
  while (i >= 0) {
    const before = i === 0 || /[^a-z0-9]/.test(h[i - 1]);
    const after = i + n.length === h.length || /[^a-z0-9]/.test(h[i + n.length]);
    if (before && after) return true;
    i = h.indexOf(n, i + 1);
  }
  return false;
}

function shopMatchesChain(shopName, chain) {
  const aliases = chain.aliases || [chain.osmQuery || chain.name];
  return aliases.some(a => includesTerm(shopName, a));
}

function nearest(shops, lat, lon) {
  if (!shops || !shops.length) return null;
  return shops
    .map(s => ({ ...s, km: hav(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.km - b.km)[0];
}

function publicNearest(n) {
  if (!n) return null;
  return {
    name: n.name,
    address: n.addr || n.address || null,
    km: +n.km.toFixed(1),
    lat: n.lat,
    lon: n.lon,
  };
}

// Nearby = chain has a branch within radiusKm. Everything else is the online section,
// keeping a farther branch when we found one so the UI can say how far it is.
function splitOffers(items, shopsByChain, lat, lon, radiusKm = RADIUS_KM) {
  const nearby = [];
  const online = [];
  for (const item of items || []) {
    if (item.onlineOnly || !item.chainId) {
      online.push({ ...item, nearest: null, channel: 'online' });
      continue;
    }
    const n = nearest(shopsByChain[item.chainId] || [], lat, lon);
    const pub = publicNearest(n);
    if (n && n.km <= radiusKm) nearby.push({ ...item, nearest: pub, channel: 'nearby' });
    else online.push({ ...item, nearest: pub, channel: 'online' });
  }
  const byPrice = (a, b) => a.price - b.price;
  nearby.sort(byPrice);
  online.sort(byPrice);
  return { nearby, online };
}

function normalizeCep(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length === 8 ? d : null;
}

module.exports = {
  RADIUS_KM, norm, hav, includesTerm, shopMatchesChain, nearest, splitOffers, normalizeCep,
};
