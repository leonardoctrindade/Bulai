const { get } = require('./http');
const { flightLinks, hotelLinks, applyFlightFilters, applyHotelFilters, sortOffers } = require('./travel');

const AMADEUS_HOST = () => (process.env.AMADEUS_HOST || 'https://test.api.amadeus.com').replace(/\/$/, '');

function amadeusConfigured() {
  return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

let amadeusCache = null;
async function amadeusToken() {
  if (!amadeusConfigured()) return null;
  if (amadeusCache && amadeusCache.exp > Date.now() + 15000) return amadeusCache.token;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.AMADEUS_CLIENT_ID,
    client_secret: process.env.AMADEUS_CLIENT_SECRET,
  });
  const data = await get(`${AMADEUS_HOST()}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    accept: 'application/json',
    timeout: 12000,
  });
  amadeusCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 600) * 1000 };
  return data.access_token;
}

async function amadeusGet(path) {
  const token = await amadeusToken();
  if (!token) return null;
  return get(`${AMADEUS_HOST()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    accept: 'application/json',
    timeout: 15000,
  });
}

function parseDuration(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
}

async function amadeusFlights(v) {
  if (!amadeusConfigured()) return [];
  const cabin = { economy: 'ECONOMY', premium: 'PREMIUM_ECONOMY', business: 'BUSINESS', first: 'FIRST' }[v.cabin];
  const qs = new URLSearchParams({
    originLocationCode: v.origin.code,
    destinationLocationCode: v.destination.code,
    departureDate: v.depart,
    adults: String(v.pax.adults),
    travelClass: cabin,
    currencyCode: 'BRL',
    max: '20',
  });
  if (v.trip === 'round') qs.set('returnDate', v.ret);
  if (v.pax.children) qs.set('children', String(v.pax.children));
  if (v.pax.infants) qs.set('infants', String(v.pax.infants));
  if (v.maxStops === 0) qs.set('nonStop', 'true');
  if (v.maxPrice) qs.set('maxPrice', String(Math.round(v.maxPrice)));
  const data = await amadeusGet(`/v2/shopping/flight-offers?${qs}`);
  const dict = new Map((data.dictionaries?.carriers ? Object.entries(data.dictionaries.carriers) : []));
  return (data.data || []).map(offer => {
    const segs = (offer.itineraries || []).flatMap(it => it.segments || []);
    const first = segs[0];
    const stops = Math.max(0, (offer.itineraries?.[0]?.segments?.length || 1) - 1);
    const code = offer.validatingAirlineCodes?.[0] || first?.carrierCode || '';
    const dep = first?.departure?.at;
    return {
      source: 'Amadeus',
      price: Number(offer.price?.grandTotal || offer.price?.total),
      currency: offer.price?.currency || 'BRL',
      priceBasis: 'trajeto',
      title: `${v.origin.code} → ${v.destination.code}`,
      airline: code,
      airlineName: dict.get(code) || code,
      stops,
      depart: dep || null,
      arrive: segs.at(-1)?.arrival?.at || null,
      durationMin: parseDuration(offer.itineraries?.[0]?.duration),
      baggage: null,
      url: `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=${encodeURIComponent(`${code} ${v.origin.code} ${v.destination.code} ${v.depart}`)}`,
    };
  }).filter(Boolean);
}

async function amadeusHotels(v, center) {
  if (!amadeusConfigured()) return [];
  const loc = await amadeusGet(`/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(v.city)}&page%5Blimit%5D=1`);
  const cityCode = loc.data?.[0]?.iataCode;
  if (!cityCode) return [];
  const qs = new URLSearchParams({
    cityCode,
    checkInDate: v.checkIn,
    checkOutDate: v.checkOut,
    adults: String(Math.max(1, Math.round(v.adults / v.rooms.length))),
    roomQuantity: String(v.rooms.length),
    currency: 'BRL',
    bestRateOnly: 'true',
  });
  if (v.childAges.length) qs.set('childAges', v.childAges.join(','));
  if (v.stars) qs.set('ratings', String(v.stars));
  const data = await amadeusGet(`/v3/shopping/hotel-offers?${qs}`);
  return (data.data || []).map(row => {
    const offer = (row.offers || [])[0];
    const price = Number(offer?.price?.total);
    const lat = row.hotel?.latitude != null ? Number(row.hotel.latitude) : null;
    const lon = row.hotel?.longitude != null ? Number(row.hotel.longitude) : null;
    let distanceKm = null;
    if (center && lat != null && lon != null) {
      const { hav } = require('./places');
      distanceKm = +hav(center.lat, center.lon, lat, lon).toFixed(1);
    }
    return {
      source: 'Amadeus',
      price,
      currency: offer?.price?.currency || 'BRL',
      priceBasis: 'estadia',
      title: row.hotel?.name || 'Hotel',
      stars: row.hotel?.rating ? Number(row.hotel.rating) : null,
      rating: null,
      distanceKm,
      propertyType: null,
      breakfast: null,
      freeCancellation: null,
      amenities: null,
      url: `https://www.google.com/travel/hotels?hl=pt-BR&gl=br&curr=BRL&q=${encodeURIComponent(row.hotel?.name + ' ' + v.city)}`,
    };
  }).filter(o => o.price > 0);
}

async function probe(url) {
  await get(url, { text: true, timeout: 7000, accept: 'text/html,application/json' });
}

function sourceResult(source, url, status, note, offers = []) {
  return { source, url, status, note, offers };
}

async function runLinkSource(item, search) {
  try {
    if (search) {
      const offers = await search();
      return sourceResult(item.source, item.url, offers.length ? 'ok' : 'sem_dados', offers.length ? null : 'Sem preço legível na resposta automática.', offers);
    }
    await probe(item.url);
    return sourceResult(item.source, item.url, 'sem_dados', 'O site abre, mas o preço só aparece no navegador. Nada foi inventado.');
  } catch (e) {
    const msg = String(e.message || e);
    const blocked = /HTTP 40[0139]|HTTP 429|HTTP 5|aborted|Timeout|ENOTFOUND|EAI_AGAIN|certificate/i.test(msg);
    return sourceResult(item.source, item.url, blocked ? 'bloqueado' : 'erro', msg);
  }
}

async function searchFlights(v) {
  const links = flightLinks(v);
  const jobs = links.map(link => {
    if (link.source === 'Amadeus') return null;
    return runLinkSource(link);
  }).filter(Boolean);
  if (amadeusConfigured()) {
    jobs.push((async () => {
      const book = links.find(l => l.source === 'Google Voos');
      try {
        const offers = await amadeusFlights(v);
        return sourceResult('Amadeus', book.url, offers.length ? 'ok' : 'sem_dados', offers.length ? null : 'Amadeus não devolveu tarifa para este trecho.', offers);
      } catch (e) {
        return sourceResult('Amadeus', book.url, 'erro', String(e.message || e));
      }
    })());
  }
  const results = await Promise.all(jobs);
  let offers = applyFlightFilters(results.flatMap(r => r.offers), v);
  offers = sortOffers(offers, v.sort).slice(0, 30);
  return {
    offers,
    sources: results.map(({ offers: _o, ...rest }) => rest),
    configured: { amadeus: amadeusConfigured() },
    message: offers.length ? null : 'Nenhum preço automático nesta busca. Os links abaixo abrem a pesquisa já preenchida. Não mostramos valor inventado.',
  };
}

async function searchHotels(v, center) {
  const links = hotelLinks(v);
  const jobs = links.map(link => runLinkSource(link));
  if (amadeusConfigured()) {
    jobs.push((async () => {
      const book = links.find(l => l.source === 'Google Hotéis');
      try {
        const offers = await amadeusHotels(v, center);
        return sourceResult('Amadeus', book.url, offers.length ? 'ok' : 'sem_dados', offers.length ? null : 'Amadeus não devolveu hotel para esta cidade.', offers);
      } catch (e) {
        return sourceResult('Amadeus', book.url, 'erro', String(e.message || e));
      }
    })());
  }
  const results = await Promise.all(jobs);
  let offers = applyHotelFilters(results.flatMap(r => r.offers), v);
  offers = sortOffers(offers, v.sort).slice(0, 30);
  return {
    offers,
    sources: results.map(({ offers: _o, ...rest }) => rest),
    configured: { amadeus: amadeusConfigured() },
    center: center || null,
    message: offers.length ? null : 'Nenhum preço automático nesta busca. Os links abaixo abrem a pesquisa já preenchida (adultos, idades das crianças, datas e quartos). Não mostramos valor inventado.',
  };
}

module.exports = { searchFlights, searchHotels, amadeusConfigured };
